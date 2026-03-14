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
import { getCanvasRuntimeSafety, requestCanvasSave, requestCanvasUpdate } from '../adapters/canvas-runtime-adapter';

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

    normalizeAnchorOffset(
        offsetX: number,
        offsetY: number,
        maxAbsOffset: number = 240,
    ): { offsetX: number; offsetY: number } {
        const normalizedX = Number.isFinite(offsetX) && Math.abs(offsetX) <= maxAbsOffset ? offsetX : 0;
        const normalizedY = Number.isFinite(offsetY) && Math.abs(offsetY) <= maxAbsOffset ? offsetY : 0;

        if (normalizedX !== offsetX || normalizedY !== offsetY) {
            log(
                `[Layout] ToggleAnchorOffsetSuppressed: requested=(${offsetX.toFixed(1)},${offsetY.toFixed(1)}), ` +
                `applied=(${normalizedX.toFixed(1)},${normalizedY.toFixed(1)}), limit=${maxAbsOffset}`
            );
        }

        return {
            offsetX: normalizedX,
            offsetY: normalizedY,
        };
    }

    private getRuntimeNodeDimension(node: CanvasNodeLike, key: 'width' | 'height'): number {
        const runtimeValue = node[key];
        if (typeof runtimeValue === 'number' && Number.isFinite(runtimeValue) && runtimeValue > 0) {
            return runtimeValue;
        }

        const currentData = typeof node.getData === 'function' ? node.getData() : null;
        const dataValue = currentData?.[key];
        if (typeof dataValue === 'number' && Number.isFinite(dataValue) && dataValue > 0) {
            return dataValue;
        }

        return 1;
    }

    private syncRuntimeNodePosition(node: CanvasNodeLike, targetX: number, targetY: number): void {
        node.x = targetX;
        node.y = targetY;

        const width = this.getRuntimeNodeDimension(node, 'width');
        const height = this.getRuntimeNodeDimension(node, 'height');
        node.bbox = {
            minX: targetX,
            minY: targetY,
            maxX: targetX + width,
            maxY: targetY + height,
        };

        if (typeof node.update === 'function') {
            node.update();
            return;
        }

        if (typeof node.requestUpdate === 'function') {
            node.requestUpdate();
        }
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
        let skippedCount = 0;
        let maxDelta = 0;
        let totalDelta = 0;
        
        log(`[Layout] TogglePos(pre): newLayout.size=${newLayout.size}, nodes.size=${nodes.size}, offset=(${offsetX.toFixed(1)},${offsetY.toFixed(1)})`);
        
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
                    this.syncRuntimeNodePosition(node, targetX, targetY);
                    updatedCount++;
                } else {
                    skippedCount++;
                }
            } else {
                missingCount++;
            }
        }
        const avgDelta = updatedCount > 0 ? totalDelta / updatedCount : 0;
        log(`[Layout] TogglePos: updated=${updatedCount}, moved=${movedCount}, skipped=${skippedCount}, missing=${missingCount}, maxDelta=${maxDelta.toFixed(1)}, avgDelta=${avgDelta.toFixed(1)}, offset=(${offsetX.toFixed(1)},${offsetY.toFixed(1)})`);
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

    reapplyCurrentCollapseVisibility(
        canvas: CanvasLike,
        options?: { requestUpdate?: boolean; reason?: string }
    ): {
        hiddenNodeCount: number;
        nodeCount: number;
        edgeCount: number;
        runtimeSafe: boolean;
        runtimeUnsafeReason: string | null;
        requestUpdateApplied: boolean;
    } {
        const nodes = this.getCanvasNodes(canvas);
        const runtimeEdges = this.getCanvasEdges(canvas);
        const relationEdges = Array.isArray(canvas.fileData?.edges) && canvas.fileData.edges.length > 0
            ? canvas.fileData.edges
            : runtimeEdges;
        const domEdges = runtimeEdges.length > 0 ? runtimeEdges : relationEdges;
        const canvasData = (canvas.fileData || canvas) as CanvasDataLike;
        const hiddenNodeIds = this.collectHiddenNodeIds(nodes, relationEdges, canvasData);
        const runtimeSafety = getCanvasRuntimeSafety(canvas);

        this.applyVisibilityToNodes(nodes, hiddenNodeIds);
        this.applyVisibilityToEdges(domEdges, hiddenNodeIds);

        let requestUpdateApplied = false;
        if (options?.requestUpdate !== false) {
            if (runtimeSafety.safe) {
                requestUpdateApplied = requestCanvasUpdate(canvas);
            } else {
                log(
                    `[Layout] ReapplyCollapseVisibilitySkipUpdate: reason=${runtimeSafety.reason || 'unknown'}, ` +
                    `hidden=${hiddenNodeIds.size}, nodes=${nodes.size}, edges=${domEdges.length}, ` +
                    `reapplyReason=${options?.reason || 'unknown'}`
                );
            }
        }

        log(
            `[Layout] ReapplyCollapseVisibility: hidden=${hiddenNodeIds.size}, nodes=${nodes.size}, ` +
            `edges=${domEdges.length}, reason=${options?.reason || 'unknown'}`
        );

        return {
            hiddenNodeCount: hiddenNodeIds.size,
            nodeCount: nodes.size,
            edgeCount: domEdges.length,
            runtimeSafe: runtimeSafety.safe,
            runtimeUnsafeReason: runtimeSafety.reason,
            requestUpdateApplied
        };
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
                finalCanvasData || canvasData,
                {
                    forceResetCoordinates: true,
                    forceReason: isCollapsing ? 'collapse-toggle' : 'expand-toggle'
                }
            );

            if (!newLayout || newLayout.size === 0) return;

            const anchorOffset = this.calculateAnchorOffset(nodeId, nodes, newLayout);
            const { offsetX, offsetY } = this.normalizeAnchorOffset(anchorOffset.offsetX, anchorOffset.offsetY);

            const visibleRuntimeNodes = new Map<string, CanvasNodeLike>();
            for (const [nodeId] of visibleNodes) {
                const runtimeNode = nodes.get(nodeId);
                if (runtimeNode) {
                    visibleRuntimeNodes.set(nodeId, runtimeNode);
                }
            }
            log(`[Layout] ToggleRuntimeSync: visibleNodes=${visibleNodes.size}, visibleRuntimeNodes=${visibleRuntimeNodes.size}, allRuntimeNodes=${nodes.size}`);

            const updatedCount = this.updateNodePositionsWithOffset(newLayout, visibleRuntimeNodes, offsetX, offsetY);
            const runtimeSafety = getCanvasRuntimeSafety(canvas);
            let updateApplied = false;
            let saveApplied = false;

            if (runtimeSafety.safe) {
                updateApplied = requestCanvasUpdate(canvas);
                saveApplied = requestCanvasSave(canvas);
            } else {
                log(
                    `[Layout] TogglePersistSkipped: node=${nodeId}, collapsing=${isCollapsing}, ` +
                    `reason=${runtimeSafety.reason || 'unknown'}, updated=${updatedCount}`
                );
            }

            log(
                `[Layout] Toggle: 更新了 ${updatedCount} 个节点, ` +
                `updateApplied=${updateApplied}, saveApplied=${saveApplied}, runtimeSafe=${runtimeSafety.safe}`
            );
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
