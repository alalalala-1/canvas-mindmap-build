import { arrangeLayout as originalArrangeLayout } from '../layout';
import {
    CanvasArrangerSettings,
    CanvasDataLike,
    CanvasEdgeLike,
    CanvasLike,
    CanvasNodeLike,
    FloatingNodeRecord
} from '../types';
import { CollapseStateManager } from '../../state/collapse-state';
import { LayoutDataProvider } from './layout-data-provider';
import { handleError } from '../../utils/error-handler';
import {
    getEdgesFromCanvas,
    getNodeIdFromEdgeEndpoint,
    getNodesFromCanvas,
    parseFloatingNodeInfo
} from '../../utils/canvas-utils';
import { log } from '../../utils/logger';

export class CollapseToggleService {
    constructor(
        private collapseStateManager: CollapseStateManager,
        private layoutDataProvider: LayoutDataProvider,
        private getLayoutSettings: () => CanvasArrangerSettings
    ) {}

    collectHiddenNodeIds(
        nodes: Map<string, CanvasNodeLike>,
        edges: CanvasEdgeLike[],
        canvasData: CanvasDataLike
    ): Set<string> {
        const allCollapsedNodes = this.collapseStateManager.getAllCollapsedNodes();
        const allHiddenNodeIds = new Set<string>();

        for (const collapsedId of allCollapsedNodes) {
            if (!nodes.has(collapsedId)) continue;
            this.collapseStateManager.addAllDescendantsToSet(collapsedId, edges, allHiddenNodeIds);
        }

        if (canvasData?.metadata?.floatingNodes) {
            for (const [floatingNodeId, info] of Object.entries(canvasData.metadata.floatingNodes)) {
                const { isFloating, originalParent } = parseFloatingNodeInfo(info as boolean | FloatingNodeRecord);

                if (isFloating && originalParent && allCollapsedNodes.has(originalParent)) {
                    allHiddenNodeIds.add(floatingNodeId);
                }
            }
        }

        return allHiddenNodeIds;
    }

    applyVisibilityToNodes(nodes: Map<string, CanvasNodeLike>, hiddenIds: Set<string>): void {
        nodes.forEach((node, id) => {
            if (node?.nodeEl) {
                const shouldHide = hiddenIds.has(id);
                node.nodeEl.style.display = shouldHide ? 'none' : '';
            }
        });
    }

    applyVisibilityToEdges(edges: CanvasEdgeLike[], hiddenIds: Set<string>): void {
        for (const edge of edges) {
            const fromId = getNodeIdFromEdgeEndpoint(edge?.from);
            const toId = getNodeIdFromEdgeEndpoint(edge?.to);
            const shouldHide = (fromId && hiddenIds.has(fromId)) || (toId && hiddenIds.has(toId));
            if (edge.lineGroupEl) edge.lineGroupEl.style.display = shouldHide ? 'none' : '';
            if (edge.lineEndGroupEl) edge.lineEndGroupEl.style.display = shouldHide ? 'none' : '';
        }
    }

    calculateAnchorOffset(
        nodeId: string,
        nodes: Map<string, CanvasNodeLike>,
        newLayout: Map<string, { x: number; y: number }>
    ): { offsetX: number; offsetY: number } {
        const anchorNode = nodes.get(nodeId);
        const anchorLayout = newLayout.get(nodeId);
        const anchorX = anchorNode && typeof anchorNode.x === 'number' ? anchorNode.x : 0;
        const anchorY = anchorNode && typeof anchorNode.y === 'number' ? anchorNode.y : 0;
        return {
            offsetX: anchorLayout ? anchorX - anchorLayout.x : 0,
            offsetY: anchorLayout ? anchorY - anchorLayout.y : 0,
        };
    }

    updateNodePositionsWithOffset(
        newLayout: Map<string, { x: number; y: number }>,
        nodes: Map<string, CanvasNodeLike>,
        offsetX: number,
        offsetY: number
    ): number {
        let updatedCount = 0;
        let movedCount = 0;
        let missingCount = 0;
        let maxDelta = 0;
        let totalDelta = 0;
        for (const [targetNodeId, newPosition] of newLayout.entries()) {
            const node = nodes.get(targetNodeId);
            if (node) {
                const targetX = isNaN(newPosition.x) ? 0 : newPosition.x + offsetX;
                const targetY = isNaN(newPosition.y) ? 0 : newPosition.y + offsetY;

                const nodeX = typeof node.x === 'number' ? node.x : 0;
                const nodeY = typeof node.y === 'number' ? node.y : 0;
                const dx = Math.abs(nodeX - targetX);
                const dy = Math.abs(nodeY - targetY);
                const delta = Math.hypot(dx, dy);
                if (delta > 0.5) movedCount++;
                if (delta > maxDelta) maxDelta = delta;
                totalDelta += delta;
                if (Math.abs(nodeX - targetX) > 0.5 || Math.abs(nodeY - targetY) > 0.5) {
                    if (typeof node.setData === 'function') {
                        const currentData = node.getData ? node.getData() : {};
                        node.setData({
                            ...currentData,
                            x: targetX,
                            y: targetY,
                        });
                        updatedCount++;
                    } else {
                        node.x = targetX;
                        node.y = targetY;
                        if (typeof node.update === 'function') node.update();
                        updatedCount++;
                    }
                }
            } else {
                missingCount++;
            }
        }
        const avgDelta = updatedCount > 0 ? totalDelta / updatedCount : 0;
        log(`[Layout] TogglePos: updated=${updatedCount}, moved=${movedCount}, missing=${missingCount}, maxDelta=${maxDelta.toFixed(1)}, avgDelta=${avgDelta.toFixed(1)}, offset=(${offsetX.toFixed(1)},${offsetY.toFixed(1)})`);
        return updatedCount;
    }

    applyToggleVisibility(
        nodeId: string,
        nodes: Map<string, CanvasNodeLike>,
        edges: CanvasEdgeLike[],
        canvasData: CanvasDataLike
    ): void {
        log(`[Layout] Toggle: 当前操作=${nodeId}, 已折叠=${Array.from(this.collapseStateManager.getAllCollapsedNodes()).join(',')}`);

        const allHiddenNodeIds = this.collectHiddenNodeIds(nodes, edges, canvasData);
        log(`[Layout] Toggle: 需要隐藏 ${allHiddenNodeIds.size} 个节点`);

        this.applyVisibilityToNodes(nodes, allHiddenNodeIds);
        this.applyVisibilityToEdges(edges, allHiddenNodeIds);
    }

    async autoArrangeAfterToggle(nodeId: string, canvas: CanvasLike, isCollapsing: boolean = true) {
        if (!canvas) return;

        const nodes = this.getCanvasNodes(canvas);
        const edges = canvas.fileData?.edges || this.getCanvasEdges(canvas);

        if (!nodes || nodes.size === 0) return;

        try {
            const canvasData = (canvas.fileData || canvas) as CanvasDataLike;
            this.applyToggleVisibility(nodeId, nodes, edges, canvasData);

            const layoutData = await this.layoutDataProvider.getLayoutData(canvas);
            if (!layoutData) {
                log(`[Layout] Toggle: 无法获取布局数据`);
                return;
            }

            const { visibleNodes, edges: visibleEdges, canvasData: finalCanvasData } = layoutData;
            log(`[Layout] Toggle: 可见节点=${visibleNodes.size}, 可见边=${visibleEdges.length}`);

            if (visibleNodes.size <= 1) {
                log(`[Layout] Toggle: 可见节点太少，跳过布局`);
                return;
            }

            const newLayout = originalArrangeLayout(
                visibleNodes,
                visibleEdges,
                this.getLayoutSettings(),
                layoutData.originalEdges,
                layoutData.allNodes,
                finalCanvasData || canvasData
            );

            if (!newLayout || newLayout.size === 0) return;

            const { offsetX, offsetY } = this.calculateAnchorOffset(nodeId, nodes, newLayout);

            const updatedCount = await this.updateNodePositionsWithOffset(newLayout, nodes, offsetX, offsetY);

            if (typeof canvas.requestUpdate === 'function') canvas.requestUpdate();
            if (canvas.requestSave) canvas.requestSave();

            log(`[Layout] Toggle: 更新了 ${updatedCount} 个节点`);
        } catch (err) {
            handleError(err, { context: 'Layout', message: 'Toggle 失败', showNotice: false });
        }
    }

    async toggleNodeCollapse(nodeId: string, canvas: CanvasLike) {
        const isCurrentlyCollapsed = this.collapseStateManager.isCollapsed(nodeId);

        if (isCurrentlyCollapsed) {
            this.collapseStateManager.markExpanded(nodeId);
            await this.autoArrangeAfterToggle(nodeId, canvas, false);
        } else {
            this.collapseStateManager.markCollapsed(nodeId);
            await this.autoArrangeAfterToggle(nodeId, canvas, true);
        }
    }

    private getCanvasNodes(canvas: CanvasLike): Map<string, CanvasNodeLike> {
        const nodes = getNodesFromCanvas(canvas);
        return new Map(nodes.filter(n => n.id).map(n => [n.id!, n]));
    }

    private getCanvasEdges(canvas: CanvasLike): CanvasEdgeLike[] {
        return getEdgesFromCanvas(canvas);
    }
}
