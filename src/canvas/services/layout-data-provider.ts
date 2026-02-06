import { App, ItemView } from 'obsidian';
import { CanvasFileService } from './canvas-file-service';
import { VisibilityService } from './visibility-service';
import { debug, info, warn, error } from '../../utils/logger';

export interface LayoutData {
    visibleNodes: Map<string, any>;
    allNodes: Map<string, any>; // 内存中的所有节点
    edges: any[];               // 内存中的所有边
    originalEdges: any[];       // 文件中的所有边
    canvasData: any;            // 画布完整数据
    floatingNodes: Set<string>; // 浮动节点 ID 集合
    canvasFilePath: string;     // 画布文件路径
}

/**
 * 布局数据提供者 - 负责为布局引擎准备所需的所有数据
 * 统一了从内存和文件中获取数据的逻辑
 */
export class LayoutDataProvider {
    private app: App;
    private canvasFileService: CanvasFileService;
    private visibilityService: VisibilityService;

    constructor(app: App, canvasFileService: CanvasFileService, visibilityService: VisibilityService) {
        this.app = app;
        this.canvasFileService = canvasFileService;
        this.visibilityService = visibilityService;
    }

    /**
     * 获取布局所需的所有数据
     */
    async getLayoutData(canvas: any): Promise<LayoutData | null> {
        if (!canvas) {
            warn('LayoutDataProvider: Canvas 对象无效');
            return null;
        }

        // 1. 获取内存中的基本数据
        const allNodes = canvas.nodes instanceof Map ? canvas.nodes : new Map(Object.entries(canvas.nodes));
        const edges = canvas.edges instanceof Map ? Array.from(canvas.edges.values()) : 
                     Array.isArray(canvas.edges) ? canvas.edges : [];

        if (!allNodes || allNodes.size === 0) {
            warn('LayoutDataProvider: 未找到任何节点');
            return null;
        }

        // 2. 获取可见节点 ID
        const visibleNodeIds = this.visibilityService.getVisibleNodeIds(allNodes, edges);
        if (visibleNodeIds.size === 0) {
            warn('LayoutDataProvider: 未找到任何可见节点');
            return null;
        }

        // 3. 从文件中读取原始数据
        let originalEdges = edges;
        let fileNodes = new Map<string, any>();
        let floatingNodes = new Set<string>();
        let canvasData: any = null;
        const canvasFilePath = canvas.file?.path || (this.app.workspace.activeLeaf?.view as any).file?.path;

        if (canvasFilePath) {
            try {
                canvasData = await this.canvasFileService.readCanvasData(canvasFilePath);
                if (canvasData) {
                    // 读取文件中的节点数据
                    const nodesList = this.canvasFileService.getNodes(canvasData);
                    for (const node of nodesList) {
                        if (node.id) fileNodes.set(node.id, node);
                    }

                    // 读取文件中的边数据
                    originalEdges = this.canvasFileService.getEdges(canvasData);

                    // 读取、验证并清理浮动节点
                    floatingNodes = this.getValidatedFloatingNodes(canvasData, allNodes, originalEdges, edges);
                }
            } catch (e) {
                error('LayoutDataProvider: 读取文件数据失败', e);
            }
        }

        // 4. 合并内存和文件数据，构建可见节点 Map
        const visibleNodes = new Map<string, any>();
        allNodes.forEach((node: any, id: string) => {
            if (visibleNodeIds.has(id)) {
                const fileNode = fileNodes.get(id);
                const nodeText = fileNode?.text || node.text;

                const mergedNode = {
                    ...node,
                    ...(fileNode || {}),
                    text: nodeText
                };
                visibleNodes.set(id, mergedNode);
            }
        });

        return {
            visibleNodes,
            allNodes,
            edges,
            originalEdges,
            canvasData,
            floatingNodes,
            canvasFilePath: canvasFilePath || ''
        };
    }

    /**
     * 获取并验证浮动节点，同时清理 canvasData 中的无效标记
     */
    private getValidatedFloatingNodes(canvasData: any, memoryNodes: Map<string, any>, originalEdges: any[], memoryEdges: any[]): Set<string> {
        const floatingNodes = new Set<string>();
        const floatingInfo = this.canvasFileService.getFloatingNodesInfo(canvasData);
        const floatingNodesToRemove: string[] = [];
        
        for (const nodeId of floatingInfo.floatingNodes) {
            // 只保留当前存在的节点
            if (!memoryNodes.has(nodeId)) {
                floatingNodesToRemove.push(nodeId);
                continue;
            }

            // 验证：浮动节点不应该有入边
            const hasIncomingEdge = originalEdges.some((edge: any) => {
                const toId = edge.to?.node?.id || edge.toNode || 
                            (typeof edge.to === 'string' ? edge.to : null);
                return toId === nodeId;
            });

            // 补充验证：内存中的边也需要检查，因为新连的边可能还没写入文件
            const hasIncomingMemoryEdge = memoryEdges.some((edge: any) => {
                const toId = edge.to?.node?.id || edge.toNode || 
                            (typeof edge.to === 'string' ? edge.to : null);
                return toId === nodeId;
            });

            if (!hasIncomingEdge && !hasIncomingMemoryEdge) {
                floatingNodes.add(nodeId);
            } else {
                info(`LayoutDataProvider: 节点 ${nodeId} 有入边(文件:${hasIncomingEdge}, 内存:${hasIncomingMemoryEdge})，清除浮动状态标记`);
                floatingNodesToRemove.push(nodeId);
            }
        }

        // 清理 canvasData 中的无效标记
        for (const nodeId of floatingNodesToRemove) {
            if (canvasData?.metadata?.floatingNodes?.[nodeId]) {
                delete canvasData.metadata.floatingNodes[nodeId];
            }
            if (canvasData?.nodes) {
                const nodeData = canvasData.nodes.find((n: any) => n.id === nodeId);
                if (nodeData?.data?.isFloating) {
                    delete nodeData.data.isFloating;
                    delete nodeData.data.originalParent;
                    delete nodeData.data.floatingTimestamp;
                }
            }
            // 同时清理内存中的节点数据，确保后续逻辑不再认为它是浮动节点
            const memoryNode = memoryNodes.get(nodeId);
            if (memoryNode?.data?.isFloating) {
                delete memoryNode.data.isFloating;
                delete memoryNode.data.originalParent;
                delete memoryNode.data.floatingTimestamp;
            }
        }

        if (floatingNodes.size > 0) {
            info(`LayoutDataProvider: 发现 ${floatingNodes.size} 个有效浮动节点: [${Array.from(floatingNodes).join(', ')}]`);
        }

        return floatingNodes;
    }
}
