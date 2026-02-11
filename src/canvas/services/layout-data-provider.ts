import { App, ItemView } from 'obsidian';
import { CanvasFileService } from './canvas-file-service';
import { VisibilityService } from './visibility-service';
import { log } from '../../utils/logger';

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
        if (!canvas) return null;

        const allNodes = canvas.nodes instanceof Map ? canvas.nodes : new Map(Object.entries(canvas.nodes));
        const edges = canvas.edges instanceof Map ? Array.from(canvas.edges.values()) : 
                     Array.isArray(canvas.edges) ? canvas.edges : [];

        if (!allNodes || allNodes.size === 0) return null;

        const visibleNodeIds = this.visibilityService.getVisibleNodeIds(allNodes, edges);
        if (visibleNodeIds.size === 0) return null;

        // 过滤可见边：只保留两个端点都可见的边
        const visibleEdges = edges.filter((edge: any) => {
            const fromId = this.getNodeIdFromEdgeEndpoint(edge?.from);
            const toId = this.getNodeIdFromEdgeEndpoint(edge?.to);
            return fromId && toId && visibleNodeIds.has(fromId) && visibleNodeIds.has(toId);
        });

        let originalEdges = edges;
        let fileNodes = new Map<string, any>();
        let floatingNodes = new Set<string>();
        let canvasData: any = null;
        const canvasFilePath = canvas.file?.path || (this.app.workspace.activeLeaf?.view as any).file?.path;

        if (canvasFilePath) {
            try {
                canvasData = await this.canvasFileService.readCanvasData(canvasFilePath);
                if (canvasData) {
                    const nodesList = this.canvasFileService.getNodes(canvasData);
                    for (const node of nodesList) {
                        if (node.id) fileNodes.set(node.id, node);
                    }
                    originalEdges = this.canvasFileService.getEdges(canvasData);
                    floatingNodes = this.getValidatedFloatingNodes(canvasData, allNodes, originalEdges, edges);
                }
            } catch (e) {
                log('[LayoutData] 错误: 读取文件', e);
            }
        }

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
            edges: visibleEdges, // 使用过滤后的可见边
            originalEdges,
            canvasData,
            floatingNodes,
            canvasFilePath: canvasFilePath || ''
        };
    }

    /**
     * 从边的端点获取节点 ID
     */
    private getNodeIdFromEdgeEndpoint(endpoint: any): string | null {
        if (!endpoint) return null;
        if (typeof endpoint === 'string') return endpoint;
        if (typeof endpoint.nodeId === 'string') return endpoint.nodeId;
        if (endpoint.node && typeof endpoint.node.id === 'string') return endpoint.node.id;
        return null;
    }

    /**
     * 获取并验证浮动节点，同时清理 canvasData 中的无效标记
     */
    private getValidatedFloatingNodes(canvasData: any, memoryNodes: Map<string, any>, originalEdges: any[], memoryEdges: any[]): Set<string> {
        const floatingNodes = new Set<string>();
        const floatingInfo = this.canvasFileService.getFloatingNodesInfo(canvasData);
        const floatingNodesToRemove: string[] = [];
        
        for (const nodeId of floatingInfo.floatingNodes) {
            if (!memoryNodes.has(nodeId)) {
                floatingNodesToRemove.push(nodeId);
                continue;
            }

            const hasIncomingEdge = originalEdges.some((edge: any) => {
                const toId = edge.to?.node?.id || edge.toNode || 
                            (typeof edge.to === 'string' ? edge.to : null);
                return toId === nodeId;
            });

            const hasIncomingMemoryEdge = memoryEdges.some((edge: any) => {
                const toId = edge.to?.node?.id || edge.toNode || 
                            (typeof edge.to === 'string' ? edge.to : null);
                return toId === nodeId;
            });

            if (!hasIncomingEdge && !hasIncomingMemoryEdge) {
                floatingNodes.add(nodeId);
            } else {
                // 只有当确定有入边时才记录清理日志
                if (hasIncomingEdge || hasIncomingMemoryEdge) {
                    log(`[LayoutData] 验证发现入边，清理浮动标记: ${nodeId}`);
                }
                floatingNodesToRemove.push(nodeId);
            }
        }

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
            const memoryNode = memoryNodes.get(nodeId);
            if (memoryNode?.data?.isFloating) {
                delete memoryNode.data.isFloating;
                delete memoryNode.data.originalParent;
                delete memoryNode.data.floatingTimestamp;
            }
        }

        if (floatingNodes.size > 0) {
            log(`[LayoutData] 浮动: ${floatingNodes.size}`);
        }

        return floatingNodes;
    }
}
