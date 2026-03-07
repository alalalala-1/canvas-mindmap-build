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
 * 布局数据提供者（置信度分层版）
 *
 * 设计原则：
 * - 高度决策由 adjustAllTextNodeHeights + NodeHeightService 统一负责
 * - 本层只做"读取/合并/兜底"，避免再做第二套高度策略
 *
 * 高度来源置信度分层（从高到低）：
 * 1. DOM-mounted memory.height（当前屏幕真实节点，最可信）
 * 2. valid trustedHeight（历史 DOM 实测真值，trustState='valid'）
 * 3. file.height（持久化稳定值）
 * 4. virtualized memory.height（引擎内存回声，低优先级）
 * 5. estimate（最后兜底）
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
     * 构建合并后的节点（合并内存节点和文件节点的真值）
     * 优先级：memory > file > estimate
     */
    private buildMergedNode(
        memoryNode: CanvasNodeLike,
        fileNode: CanvasNodeLike | undefined
    ): CanvasNodeLike {
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

        return mergedNode;
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

        // [V4] 生成全量合并后的节点真值（用于隐藏子树修复）
        const mergedAllNodes = new Map<string, CanvasNodeLike>();
        for (const [nodeId, memoryNode] of allNodes.entries()) {
            const fileNode = fileNodes.get(nodeId);
            const mergedNode = this.buildMergedNode(memoryNode, fileNode);
            mergedAllNodes.set(nodeId, mergedNode);
        }

        const visibleNodes = new Map<string, CanvasNodeLike>();

        // [置信度分层统计] 按来源统计高度
        let fromDomMounted = 0;      // DOM-mounted memory.height（最可信）
        let fromTrusted = 0;         // valid trustedHeight
        let fromFile = 0;            // file.height
        let fromMemoryVirtualized = 0; // virtualized memory.height（低优先级）
        let fromEstimate = 0;        // estimate（兜底）

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

            const resolved = this.resolveHeightWithConfidence(memoryNode, fileNode, mergedNode, width, viewportRect);
            mergedNode.height = resolved.height;

            // 按来源统计
            switch (resolved.source) {
                case 'dom-mounted': fromDomMounted++; break;
                case 'trusted': fromTrusted++; break;
                case 'file': fromFile++; break;
                case 'memory-virtualized': fromMemoryVirtualized++; break;
                case 'estimate': fromEstimate++; break;
            }

            const domState = this.getNodeDomState(memoryNode, viewportRect);
            if (domState.visible) domVisibleCount++;
            if (domState.inViewport) inViewportCount++;

            visibleNodes.set(nodeId, mergedNode);
        }

        const visibleCount = visibleNodes.size;
        const domVisibleRate = visibleCount > 0 ? domVisibleCount / visibleCount : 0;
        const inViewportRate = visibleCount > 0 ? inViewportCount / visibleCount : 0;

        // [置信度分层日志] 清晰展示高度来源分布
        const reliableCount = fromDomMounted + fromTrusted + fromFile;
        const unreliableCount = fromMemoryVirtualized + fromEstimate;
        log(
            `[LayoutData] HeightSource: domMounted=${fromDomMounted}, trusted=${fromTrusted}, file=${fromFile}, ` +
            `memoryVirtualized=${fromMemoryVirtualized}, estimate=${fromEstimate} | ` +
            `reliable=${reliableCount}, unreliable=${unreliableCount} | ` +
            `visible=${visibleCount}, domVisible=${domVisibleCount}(${(domVisibleRate * 100).toFixed(1)}%), ` +
            `inViewport=${inViewportCount}(${(inViewportRate * 100).toFixed(1)}%), file=${canvasFilePath || 'unknown'}`
        );

        return {
            visibleNodes,
            allNodes,
            mergedAllNodes,
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

    /**
     * [置信度分层] 高度解析（核心方法）
     *
     * 优先级：
     * 1. DOM-mounted memory.height（当前屏幕真实节点，最可信）
     * 2. valid trustedHeight（历史 DOM 实测真值，trustState='valid'）
     * 3. file.height（持久化稳定值）
     * 4. virtualized memory.height（引擎内存回声，低优先级）
     * 5. estimate（最后兜底）
     */
    private resolveHeightWithConfidence(
        memoryNode: CanvasNodeLike,
        fileNode: CanvasNodeLike | undefined,
        mergedNode: CanvasNodeLike,
        width: number,
        viewportRect: DOMRect | null
    ): { height: number; source: 'dom-mounted' | 'trusted' | 'file' | 'memory-virtualized' | 'estimate' } {
        const memoryHeight = this.getPositiveNumber(memoryNode.height);
        const fileHeight = this.getPositiveNumber(fileNode?.height);

        // 1. 检查是否 DOM-mounted（最可信）
        if (this.isNodeDomMounted(memoryNode)) {
            if (memoryHeight !== undefined) {
                return { height: memoryHeight, source: 'dom-mounted' };
            }
        }

        // 2. 检查 valid trustedHeight（历史 DOM 实测真值）
        const memoryTrustedHeight = this.getValidTrustedHeight(memoryNode, width);
        if (memoryTrustedHeight !== undefined) {
            return { height: memoryTrustedHeight, source: 'trusted' };
        }

        const fileTrustedHeight = this.getValidTrustedHeight(fileNode, width);
        if (fileTrustedHeight !== undefined) {
            return { height: fileTrustedHeight, source: 'trusted' };
        }

        // 3. file.height（持久化稳定值）
        if (fileHeight !== undefined) {
            return { height: fileHeight, source: 'file' };
        }

        // 4. virtualized memory.height（低优先级，节点不在 DOM 中）
        if (memoryHeight !== undefined) {
            return { height: memoryHeight, source: 'memory-virtualized' };
        }

        // 5. estimate（最后兜底）
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

    /**
     * 检查节点是否 DOM-mounted（实际可见且可测量）
     */
    private isNodeDomMounted(node: CanvasNodeLike): boolean {
        const nodeEl = node?.nodeEl;
        if (!(nodeEl instanceof HTMLElement)) {
            return false;
        }
        // 节点必须在 DOM 中且有实际尺寸
        const display = window.getComputedStyle(nodeEl).display;
        if (display === 'none') {
            return false;
        }
        return nodeEl.offsetHeight > 0 && nodeEl.offsetWidth > 0;
    }

    /**
     * 获取有效的 trustedHeight
     * 条件：trustedHeight 存在，trustState='valid'，宽度匹配
     */
    private getValidTrustedHeight(node: CanvasNodeLike | undefined, currentWidth: number): number | undefined {
        if (!node?.data?.heightMeta) {
            return undefined;
        }

        const heightMeta = node.data.heightMeta;

        // 检查 trustedHeight 是否存在
        const trustedHeight = this.getPositiveNumber(heightMeta.trustedHeight);
        if (trustedHeight === undefined) {
            return undefined;
        }

        // 检查 trustState 是否为 'valid'
        if (heightMeta.trustState !== 'valid') {
            return undefined;
        }

        // 检查宽度是否匹配（允许 1px 容差）
        const trustedWidth = heightMeta.trustedWidth;
        if (typeof trustedWidth === 'number' && Math.abs(trustedWidth - currentWidth) > 1) {
            return undefined;
        }

        return trustedHeight;
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
