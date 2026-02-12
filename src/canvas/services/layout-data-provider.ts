import { App } from 'obsidian';
import { CanvasFileService } from './canvas-file-service';
import { VisibilityService } from './visibility-service';
import { log } from '../../utils/logger';
import { getCurrentCanvasFilePath } from '../../utils/canvas-utils';

type FloatingNodeMetadata = {
    isFloating?: boolean;
    originalParent?: string;
    floatingTimestamp?: number;
};

type CanvasNodeLike = {
    id?: string;
    text?: string;
    height?: number;
    nodeEl?: HTMLElement;
    data?: FloatingNodeMetadata;
};

type EdgeEndpointLike = {
    nodeId?: string;
    node?: { id?: string };
};

type EdgeLike = {
    from?: unknown;
    to?: unknown;
    fromNode?: string;
    toNode?: string;
};

type CanvasDataLike = {
    nodes?: CanvasNodeLike[];
    edges?: EdgeLike[];
    metadata?: {
        floatingNodes?: Record<string, unknown>;
    };
};

type CanvasFileDataLike = {
    nodes?: CanvasNodeLike[];
    edges?: EdgeLike[];
};

type CanvasLike = {
    nodes?: Map<string, CanvasNodeLike> | Record<string, CanvasNodeLike>;
    edges?: Map<string, EdgeLike> | EdgeLike[];
    fileData?: CanvasFileDataLike;
    file?: { path?: string };
};

export interface LayoutData {
    visibleNodes: Map<string, CanvasNodeLike>;
    allNodes: Map<string, CanvasNodeLike>;
    edges: EdgeLike[];
    originalEdges: EdgeLike[];
    canvasData: CanvasDataLike | null;
    floatingNodes: Set<string>;
    canvasFilePath: string;
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
    async getLayoutData(canvas: unknown): Promise<LayoutData | null> {
        if (!this.isRecord(canvas)) return null;
        const canvasLike = canvas as CanvasLike;

        const allNodes = this.getCanvasNodes(canvasLike);
        const edges = this.getCanvasEdges(canvasLike);

        if (!allNodes || allNodes.size === 0) return null;

        const visibleNodeIds = this.visibilityService.getVisibleNodeIds(allNodes, edges);
        if (visibleNodeIds.size === 0) return null;

        // 过滤可见边：只保留两个端点都可见的边
        const visibleEdges = edges.filter((edge) => {
            const fromId = this.getNodeIdFromEdgeEndpoint(edge.from);
            const toId = this.getNodeIdFromEdgeEndpoint(edge.to);
            return fromId && toId && visibleNodeIds.has(fromId) && visibleNodeIds.has(toId);
        });

        let originalEdges = edges;
        let fileNodes = new Map<string, CanvasNodeLike>();
        let floatingNodes = new Set<string>();
        let canvasData: CanvasDataLike | null = null;
        const canvasFilePath = canvasLike.file?.path || getCurrentCanvasFilePath(this.app);

        if (canvasFilePath) {
            try {
                canvasData = await this.canvasFileService.readCanvasData(canvasFilePath);
                if (canvasData) {
                    const nodesList = this.canvasFileService.getNodes(canvasData);
                    if (Array.isArray(nodesList)) {
                        for (const node of nodesList) {
                            if (node?.id) fileNodes.set(node.id, node);
                        }
                    }
                    originalEdges = this.canvasFileService.getEdges(canvasData);
                    floatingNodes = this.getValidatedFloatingNodes(canvasData, allNodes, originalEdges, edges);
                }
            } catch (e) {
                log('[LayoutData] 错误: 读取文件', e);
            }
        }

        const visibleNodes = new Map<string, CanvasNodeLike>();
        let domHeightAppliedCount = 0;
        let domHeightMissingElCount = 0;
        let domHeightHiddenCount = 0;
        let domHeightZeroCount = 0;
        const domHeightDiffSamples: Array<{ id: string; domHeight: number; dataHeight: number }> = [];
        const heightSamples: Array<{ id: string; height: number }> = [];
        allNodes.forEach((node, id) => {
            if (visibleNodeIds.has(id)) {
                const fileNode = fileNodes.get(id);
                const nodeText = fileNode?.text || node.text;

                const mergedNode = {
                    ...(fileNode || {}),
                    ...node,
                    text: nodeText
                };

                const nodeEl = node?.nodeEl;
                if (nodeEl && nodeEl instanceof HTMLElement) {
                    const display = window.getComputedStyle(nodeEl).display;
                    if (display !== 'none') {
                        const rectHeight = nodeEl.getBoundingClientRect().height;
                        const domHeight = rectHeight > 0 ? rectHeight : nodeEl.clientHeight;
                        if (domHeight && domHeight > 0) {
                            const dataHeight = typeof mergedNode.height === 'number' ? mergedNode.height : 0;
                            if (!dataHeight || domHeight > dataHeight + 4) {
                                mergedNode.height = domHeight;
                                domHeightAppliedCount++;
                                if (domHeightDiffSamples.length < 5) {
                                    domHeightDiffSamples.push({ id, domHeight, dataHeight });
                                }
                            }
                        } else {
                            domHeightZeroCount++;
                        }
                    } else {
                        domHeightHiddenCount++;
                    }
                } else {
                    domHeightMissingElCount++;
                }

                visibleNodes.set(id, mergedNode);
                const finalHeight = typeof mergedNode.height === 'number' ? mergedNode.height : 0;
                if (heightSamples.length < 20) {
                    heightSamples.push({ id, height: finalHeight });
                }
            }
        });

        const visibleCount = visibleNodes.size;
        if (visibleCount > 0) {
            const heights = Array.from(visibleNodes.values()).map(n => (typeof n.height === 'number' ? n.height : 0));
            const heightSum = heights.reduce((a, b) => a + b, 0);
            const heightMin = Math.min(...heights);
            const heightMax = Math.max(...heights);
            const zeroHeightCount = heights.filter(h => h <= 0).length;
            const avgHeight = heightSum / heights.length;
            log(`[LayoutData] 高度统计 count=${visibleCount}, min=${heightMin.toFixed(1)}, max=${heightMax.toFixed(1)}, avg=${avgHeight.toFixed(1)}, zero=${zeroHeightCount}, dom覆盖=${domHeightAppliedCount}, 无元素=${domHeightMissingElCount}, 隐藏=${domHeightHiddenCount}, 0高=${domHeightZeroCount}`);
        }

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
    private getNodeIdFromEdgeEndpoint(endpoint: unknown): string | null {
        if (!endpoint) return null;
        if (typeof endpoint === 'string') return endpoint;
        if (!this.isRecord(endpoint)) return null;
        const endpointLike = endpoint as EdgeEndpointLike;
        if (typeof endpointLike.nodeId === 'string') return endpointLike.nodeId;
        if (this.isRecord(endpointLike.node) && typeof endpointLike.node.id === 'string') return endpointLike.node.id;
        return null;
    }

    /**
     * 获取并验证浮动节点，同时清理 canvasData 中的无效标记
     */
    private getValidatedFloatingNodes(canvasData: CanvasDataLike, memoryNodes: Map<string, CanvasNodeLike>, originalEdges: EdgeLike[], memoryEdges: EdgeLike[]): Set<string> {
        const floatingNodes = new Set<string>();
        const floatingInfo = this.canvasFileService.getFloatingNodesInfo(canvasData);
        const floatingNodesToRemove: string[] = [];
        
        for (const nodeId of floatingInfo.floatingNodes) {
            if (!memoryNodes.has(nodeId)) {
                floatingNodesToRemove.push(nodeId);
                continue;
            }

            const hasIncomingEdge = originalEdges.some((edge) => this.getEdgeToNodeId(edge) === nodeId);
            const hasIncomingMemoryEdge = memoryEdges.some((edge) => this.getEdgeToNodeId(edge) === nodeId);

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
            if (Array.isArray(canvasData?.nodes)) {
                const nodeData = canvasData.nodes.find((n) => n?.id === nodeId);
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

    private getEdgeToNodeId(edge: EdgeLike): string | null {
        const nodeId = this.getNodeIdFromEdgeEndpoint(edge.to);
        if (nodeId) return nodeId;
        return typeof edge.toNode === 'string' ? edge.toNode : null;
    }

    private getCanvasNodes(canvas: CanvasLike): Map<string, CanvasNodeLike> {
        if (canvas.nodes instanceof Map) {
            return canvas.nodes;
        }
        if (canvas.nodes && this.isRecord(canvas.nodes)) {
            return new Map(Object.entries(canvas.nodes) as Array<[string, CanvasNodeLike]>);
        }
        return new Map();
    }

    private getCanvasEdges(canvas: CanvasLike): EdgeLike[] {
        if (canvas.edges instanceof Map) {
            return Array.from(canvas.edges.values());
        }
        if (Array.isArray(canvas.edges)) {
            return canvas.edges;
        }
        return [];
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null;
    }
}
