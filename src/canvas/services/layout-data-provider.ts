import { App } from 'obsidian';
import { CanvasFileService } from './canvas-file-service';
import { VisibilityService } from './visibility-service';
import { log } from '../../utils/logger';
import { CONSTANTS } from '../../constants';
import {
    estimateTextNodeHeight,
    getCurrentCanvasFilePath,
    getNodeIdFromEdgeEndpoint,
    isFormulaContent,
    isImageContent,
    isRecord
} from '../../utils/canvas-utils';
import {
    CanvasDataLike,
    CanvasEdgeLike,
    CanvasLike,
    CanvasNodeLike,
    LayoutData
} from '../types';

/**
 * 布局数据提供者（SSOT 简化版）
 *
 * 设计原则：
 * - 高度决策由 adjustAllTextNodeHeights + NodeHeightService 统一负责
 * - 本层只做“读取/合并/兜底”，避免再做第二套高度策略
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

    async getLayoutData(canvas: unknown): Promise<LayoutData | null> {
        if (!isRecord(canvas)) return null;
        const canvasLike = canvas as CanvasLike;

        const allNodes = this.getCanvasNodes(canvasLike);
        const edges = this.getCanvasEdges(canvasLike);
        if (allNodes.size === 0) return null;

        this.logEdgeEndpointHealth(edges, allNodes);

        const visibleNodeIds = this.visibilityService.getVisibleNodeIds(allNodes, edges);
        if (visibleNodeIds.size === 0) return null;

        const visibleEdges = edges.filter((edge) => {
            const fromId = getNodeIdFromEdgeEndpoint(edge.from);
            const toId = getNodeIdFromEdgeEndpoint(edge.to);
            return !!fromId && !!toId && visibleNodeIds.has(fromId) && visibleNodeIds.has(toId);
        });

        let originalEdges = edges;
        const fileNodes = new Map<string, CanvasNodeLike>();
        let floatingNodes = new Set<string>();
        let canvasData: CanvasDataLike | null = null;

        const canvasFilePath = canvasLike.file?.path || getCurrentCanvasFilePath(this.app);
        if (canvasFilePath) {
            try {
                canvasData = await this.canvasFileService.readCanvasData(canvasFilePath);
                if (canvasData) {
                    const nodesList = this.canvasFileService.getNodes(canvasData);
                    for (const node of nodesList) {
                        if (node?.id) fileNodes.set(node.id, node);
                    }
                    originalEdges = this.canvasFileService.getEdges(canvasData);
                    floatingNodes = this.getValidatedFloatingNodes(canvasData, allNodes, originalEdges, edges);
                }
            } catch (err) {
                log('[LayoutData] 读取 canvas 文件失败', err);
            }
        }

        const visibleNodes = new Map<string, CanvasNodeLike>();
        let fromMemory = 0;
        let fromFile = 0;
        let fromEstimate = 0;

        let domVisibleCount = 0;
        let inViewportCount = 0;
        const viewportRect = this.getViewportRect();

        for (const nodeId of visibleNodeIds) {
            const memoryNode = allNodes.get(nodeId);
            if (!memoryNode) continue;

            const fileNode = fileNodes.get(nodeId);
            const mergedNode: CanvasNodeLike = {
                ...(fileNode || {}),
                ...memoryNode,
                text: typeof memoryNode.text === 'string' ? memoryNode.text : fileNode?.text
            };

            const width = this.getPositiveNumber(memoryNode.width)
                ?? this.getPositiveNumber(fileNode?.width)
                ?? CONSTANTS.LAYOUT.TEXT_NODE_WIDTH;
            mergedNode.width = width;

            const resolved = this.resolveHeight(memoryNode, fileNode, mergedNode, width);
            mergedNode.height = resolved.height;

            if (resolved.source === 'memory') fromMemory++;
            else if (resolved.source === 'file') fromFile++;
            else fromEstimate++;

            const domState = this.getNodeDomState(memoryNode, viewportRect);
            if (domState.visible) domVisibleCount++;
            if (domState.inViewport) inViewportCount++;

            visibleNodes.set(nodeId, mergedNode);
        }

        const visibleCount = visibleNodes.size;
        const domVisibleRate = visibleCount > 0 ? domVisibleCount / visibleCount : 0;
        const inViewportRate = visibleCount > 0 ? inViewportCount / visibleCount : 0;

        log(
            `[LayoutData] HeightSource: memory=${fromMemory}, file=${fromFile}, estimate=${fromEstimate}, ` +
            `visible=${visibleCount}, domVisible=${domVisibleCount}(${(domVisibleRate * 100).toFixed(1)}%), ` +
            `inViewport=${inViewportCount}(${(inViewportRate * 100).toFixed(1)}%), file=${canvasFilePath || 'unknown'}`
        );

        return {
            visibleNodes,
            allNodes,
            edges: visibleEdges,
            originalEdges,
            canvasData,
            floatingNodes,
            canvasFilePath: canvasFilePath || '',
            visibilityStats: {
                visibleCount,
                domVisibleCount,
                domVisibleRate,
                inViewportCount,
                inViewportRate
            }
        };
    }

    private resolveHeight(
        memoryNode: CanvasNodeLike,
        fileNode: CanvasNodeLike | undefined,
        mergedNode: CanvasNodeLike,
        width: number
    ): { height: number; source: 'memory' | 'file' | 'estimate' } {
        const memoryHeight = this.getPositiveNumber(memoryNode.height);
        if (memoryHeight !== undefined) {
            return { height: memoryHeight, source: 'memory' };
        }

        const fileHeight = this.getPositiveNumber(fileNode?.height);
        if (fileHeight !== undefined) {
            return { height: fileHeight, source: 'file' };
        }

        const content = mergedNode.text || '';
        let estimated = estimateTextNodeHeight(content, width, CONSTANTS.LAYOUT.TEXT_NODE_MAX_HEIGHT);
        if (isFormulaContent(content)) {
            estimated = CONSTANTS.LAYOUT.FORMULA_NODE_HEIGHT;
        } else if (isImageContent(content)) {
            estimated = CONSTANTS.LAYOUT.IMAGE_NODE_HEIGHT;
        }
        return {
            height: Math.max(estimated, CONSTANTS.TYPOGRAPHY.MIN_NODE_HEIGHT),
            source: 'estimate'
        };
    }

    private getNodeDomState(node: CanvasNodeLike, viewportRect: DOMRect | null): { visible: boolean; inViewport: boolean } {
        const nodeEl = node?.nodeEl;
        if (!(nodeEl instanceof HTMLElement)) {
            return { visible: false, inViewport: false };
        }

        const display = window.getComputedStyle(nodeEl).display;
        if (display === 'none') {
            return { visible: false, inViewport: false };
        }

        const rect = nodeEl.getBoundingClientRect();
        const visible = rect.height > 0 && rect.width > 0;
        if (!visible) {
            return { visible: false, inViewport: false };
        }

        if (!viewportRect) {
            return { visible: true, inViewport: true };
        }

        const inViewport = !(
            rect.right < viewportRect.left ||
            rect.left > viewportRect.right ||
            rect.bottom < viewportRect.top ||
            rect.top > viewportRect.bottom
        );

        return { visible: true, inViewport };
    }

    private getViewportRect(): DOMRect | null {
        const viewportEl = document.querySelector('.canvas-wrapper') || document.querySelector('.canvas-viewport');
        if (!(viewportEl instanceof HTMLElement)) return null;
        return viewportEl.getBoundingClientRect();
    }

    private getPositiveNumber(value: unknown): number | undefined {
        return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
    }

    private logEdgeEndpointHealth(edges: CanvasEdgeLike[], allNodes: Map<string, CanvasNodeLike>): void {
        let missingFrom = 0;
        let missingTo = 0;
        let missingFromNode = 0;
        let missingToNode = 0;
        const sample: Array<{ id?: string; fromId?: string | null; toId?: string | null }> = [];

        for (const edge of edges) {
            const fromId = getNodeIdFromEdgeEndpoint(edge.from);
            const toId = getNodeIdFromEdgeEndpoint(edge.to);

            if (!fromId) missingFrom++;
            if (!toId) missingTo++;
            if (fromId && !allNodes.has(fromId)) missingFromNode++;
            if (toId && !allNodes.has(toId)) missingToNode++;

            if (
                sample.length < 5 &&
                (!fromId || !toId || (fromId && !allNodes.has(fromId)) || (toId && !allNodes.has(toId)))
            ) {
                sample.push({ id: edge.id, fromId, toId });
            }
        }

        if (missingFrom || missingTo || missingFromNode || missingToNode) {
            log(
                `[LayoutData] 边端点异常: total=${edges.length}, missingFrom=${missingFrom}, missingTo=${missingTo}, ` +
                `missingFromNode=${missingFromNode}, missingToNode=${missingToNode}, ` +
                `sample=${sample.map(s => `${s.id || 'unknown'}:${s.fromId || 'null'}->${s.toId || 'null'}`).join('|')}`
            );
        }
    }

    private getValidatedFloatingNodes(
        canvasData: CanvasDataLike,
        memoryNodes: Map<string, CanvasNodeLike>,
        originalEdges: CanvasEdgeLike[],
        memoryEdges: CanvasEdgeLike[]
    ): Set<string> {
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

    private getEdgeToNodeId(edge: CanvasEdgeLike): string | null {
        const nodeId = getNodeIdFromEdgeEndpoint(edge.to);
        if (nodeId) return nodeId;
        return typeof edge.toNode === 'string' ? edge.toNode : null;
    }

    private getCanvasNodes(canvas: CanvasLike): Map<string, CanvasNodeLike> {
        if (canvas.nodes instanceof Map) {
            return canvas.nodes;
        }
        if (canvas.nodes && isRecord(canvas.nodes)) {
            return new Map(Object.entries(canvas.nodes));
        }
        return new Map();
    }

    private getCanvasEdges(canvas: CanvasLike): CanvasEdgeLike[] {
        if (canvas.edges instanceof Map) {
            return Array.from(canvas.edges.values());
        }
        if (Array.isArray(canvas.edges)) {
            return canvas.edges;
        }
        return [];
    }
}
