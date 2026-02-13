import { App, Notice, Plugin, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../settings/types';
import { CollapseStateManager } from '../state/collapse-state';
import { CanvasFileService } from './services/canvas-file-service';
import { log } from '../utils/logger';
import { CONSTANTS } from '../constants';
import { handleError } from '../utils/error-handler';
import { arrangeLayout as originalArrangeLayout, CanvasArrangerSettings } from './layout';
import { FloatingNodeService } from './services/floating-node-service';
import { getCanvasView, getCurrentCanvasFilePath, getNodeIdFromEdgeEndpoint, getNodesFromCanvas, getEdgesFromCanvas, isRecord, parseFloatingNodeInfo } from '../utils/canvas-utils';
import {
    CanvasDataLike,
    CanvasEdgeLike,
    CanvasLike,
    CanvasNodeLike,
    FloatingNodeMetadata,
    FloatingNodeRecord,
    CanvasManagerLike
} from './types';

import { VisibilityService } from './services/visibility-service';
import { LayoutDataProvider } from './services/layout-data-provider';

/**
 * 布局管理器 - 负责Canvas布局相关的操作
 */
export class LayoutManager {
    private plugin: Plugin;
    private app: App;
    private settings: CanvasMindmapBuildSettings;
    private collapseStateManager: CollapseStateManager;
    private canvasFileService: CanvasFileService;
    private visibilityService: VisibilityService;
    private layoutDataProvider: LayoutDataProvider;
    private floatingNodeService: FloatingNodeService | null = null;
    private canvasManager: CanvasManagerLike | null = null;

    constructor(
        plugin: Plugin,
        app: App,
        settings: CanvasMindmapBuildSettings,
        collapseStateManager: CollapseStateManager,
        canvasFileService: CanvasFileService,
        visibilityService: VisibilityService,
        layoutDataProvider: LayoutDataProvider
    ) {
        this.plugin = plugin;
        this.app = app;
        this.settings = settings;
        this.collapseStateManager = collapseStateManager;
        this.canvasFileService = canvasFileService;
        this.visibilityService = visibilityService;
        this.layoutDataProvider = layoutDataProvider;
    }

    /**
     * 设置 CanvasManager 实例
     */
    setCanvasManager(manager: unknown): void {
        this.canvasManager = this.isCanvasManager(manager) ? manager : null;
    }

    /**
     * 设置 FloatingNodeService 实例
     * 由 CanvasManager 调用，确保使用同一个实例
     */
    setFloatingNodeService(service: FloatingNodeService): void {
        this.floatingNodeService = service;
    }

    /**
     * 自动整理画布布局（带防抖）
     */
    private arrangeTimeoutId: number | null = null;
    async arrangeCanvas() {
        if (this.arrangeTimeoutId !== null) {
            window.clearTimeout(this.arrangeTimeoutId);
        }

        this.arrangeTimeoutId = window.setTimeout(async () => {
            this.arrangeTimeoutId = null;
            await this.performArrange(false);
        }, CONSTANTS.TIMING.ARRANGE_DEBOUNCE);
    }

    private getLayoutSettings(): CanvasArrangerSettings {
        return {
            horizontalSpacing: this.settings.horizontalSpacing,
            verticalSpacing: this.settings.verticalSpacing,
            textNodeWidth: this.settings.textNodeWidth,
            textNodeMaxHeight: this.settings.textNodeMaxHeight,
            imageNodeWidth: this.settings.imageNodeWidth,
            imageNodeHeight: this.settings.imageNodeHeight,
            formulaNodeWidth: this.settings.formulaNodeWidth,
            formulaNodeHeight: this.settings.formulaNodeHeight,
        };
    }

    private async updateNodePositions(
        result: Map<string, { x: number; y: number }>,
        allNodes: Map<string, CanvasNodeLike>,
        canvas: CanvasLike
    ): Promise<number> {
        let updatedCount = 0;
        for (const [nodeId, newPosition] of result.entries()) {
            const node = allNodes.get(nodeId);
            if (this.canSetData(node)) {
                const currentData = node.getData ? node.getData() : {};
                node.setData({
                    ...currentData,
                    x: newPosition.x,
                    y: newPosition.y,
                });
                updatedCount++;
            }
        }

        if (typeof canvas.requestUpdate === 'function') canvas.requestUpdate();
        if (typeof canvas.requestSave === 'function') canvas.requestSave();
        return updatedCount;
    }

    private async triggerHeightAdjustment(skipAdjust: boolean): Promise<void> {
        if (skipAdjust) return;

        let adjustLogged = false;
        let postAdjustScheduled = false;
        const triggerAdjust = async () => {
            if (!this.canvasManager) {
                if (!adjustLogged) {
                    log(`[Layout] 调整高度失败: 未找到管理器`);
                    adjustLogged = true;
                }
                return;
            }
            if (!adjustLogged) {
                log(`[Layout] 调整高度触发`);
                adjustLogged = true;
            }
            await new Promise<void>((resolve) => {
                requestAnimationFrame(() => resolve());
            });
            const adjustedCount = await this.canvasManager.adjustAllTextNodeHeights();
            if (adjustedCount > 0 && !postAdjustScheduled) {
                postAdjustScheduled = true;
                setTimeout(() => {
                    void this.performArrange(true);
                }, 0);
            }
        };

        void triggerAdjust();
        setTimeout(() => void triggerAdjust(), CONSTANTS.TIMING.HEIGHT_ADJUST_DELAY);
        setTimeout(() => void triggerAdjust(), CONSTANTS.TIMING.EDGE_DETECTION_INTERVAL);
    }

    private async performArrange(skipAdjust: boolean = false) {
        const activeView = getCanvasView(this.app);

        if (!activeView || activeView.getViewType() !== 'canvas') {
            new Notice("No active canvas found.");
            return;
        }

        const canvas = this.getCanvasFromView(activeView);

        if (!canvas) {
            new Notice("Canvas view not initialized.");
            return;
        }

        try {
            const layoutData = await this.layoutDataProvider.getLayoutData(canvas);
            if (!layoutData) {
                new Notice("Failed to gather canvas data.");
                return;
            }

            const { visibleNodes, edges, originalEdges, canvasData, allNodes, canvasFilePath } = layoutData;

            log(`[Layout] 整理: ${visibleNodes.size} 节点, ${edges.length} 边`);

            const result = originalArrangeLayout(
                visibleNodes,
                edges,
                this.getLayoutSettings(),
                originalEdges,
                allNodes,
                canvasData || undefined
            );

            if (!canvasFilePath) throw new Error('找不到路径');

            const memoryEdges = this.getCanvasEdges(canvas);

            const success = await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (data) => {
                const canvasData = data as CanvasDataLike;
                if (!Array.isArray(canvasData.nodes) || !Array.isArray(canvasData.edges)) return false;
                let changed = false;

                if (this.applyLayoutPositions(canvasData, result)) {
                    changed = true;
                }

                if (this.mergeMemoryEdgesIntoFileData(canvasData, memoryEdges)) {
                    changed = true;
                }

                return changed;
            });

            let updatedCount = 0;
            if (success) {
                updatedCount = await this.updateNodePositions(result, allNodes, canvas);
            }

            await this.triggerHeightAdjustment(skipAdjust);

            await this.cleanupStaleFloatingNodes(canvas, allNodes);
            await this.reapplyFloatingNodeStyles(canvas);

            new Notice(`布局完成！更新了 ${updatedCount} 个节点`);
            log(`[Layout] 完成: 更新 ${updatedCount}`);
            
        } catch (err) {
            handleError(err, { context: 'Layout', message: '布局失败，请重试' });
        }
    }

    private collectHiddenNodeIds(
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

    private applyVisibilityToNodes(nodes: Map<string, CanvasNodeLike>, hiddenIds: Set<string>): void {
        nodes.forEach((node, id) => {
            if (node?.nodeEl) {
                const shouldHide = hiddenIds.has(id);
                (node.nodeEl as HTMLElement).style.display = shouldHide ? 'none' : '';
            }
        });
    }

    private applyVisibilityToEdges(edges: CanvasEdgeLike[], hiddenIds: Set<string>): void {
        for (const edge of edges) {
            const fromId = getNodeIdFromEdgeEndpoint(edge?.from);
            const toId = getNodeIdFromEdgeEndpoint(edge?.to);
            const shouldHide = (fromId && hiddenIds.has(fromId)) || (toId && hiddenIds.has(toId));
            if (edge.lineGroupEl) (edge.lineGroupEl as HTMLElement).style.display = shouldHide ? 'none' : '';
            if (edge.lineEndGroupEl) (edge.lineEndGroupEl as HTMLElement).style.display = shouldHide ? 'none' : '';
        }
    }

    private calculateAnchorOffset(
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

    private async updateNodePositionsWithOffset(
        newLayout: Map<string, { x: number; y: number }>,
        nodes: Map<string, CanvasNodeLike>,
        offsetX: number,
        offsetY: number
    ): Promise<number> {
        let updatedCount = 0;
        for (const [targetNodeId, newPosition] of newLayout.entries()) {
            const node = nodes.get(targetNodeId);
            if (node) {
                const targetX = isNaN(newPosition.x) ? 0 : newPosition.x + offsetX;
                const targetY = isNaN(newPosition.y) ? 0 : newPosition.y + offsetY;

                const nodeX = typeof node.x === 'number' ? node.x : 0;
                const nodeY = typeof node.y === 'number' ? node.y : 0;
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
            }
        }
        return updatedCount;
    }

    /**
     * 在折叠/展开节点后自动整理布局
     * 修复：考虑所有已折叠的节点，而不仅仅是当前操作的节点
     */
    async autoArrangeAfterToggle(nodeId: string, canvas: CanvasLike, isCollapsing: boolean = true) {
        if (!canvas) return;

        const nodes = this.getCanvasNodes(canvas);
        const edges = canvas.fileData?.edges || this.getCanvasEdges(canvas);

        if (!nodes || nodes.size === 0) return;

        try {
            log(`[Layout] Toggle: 当前操作=${nodeId}, 已折叠=${Array.from(this.collapseStateManager.getAllCollapsedNodes()).join(',')}`);

            const canvasData = (canvas.fileData || canvas) as CanvasDataLike;
            const allHiddenNodeIds = this.collectHiddenNodeIds(nodes, edges, canvasData);
            
            log(`[Layout] Toggle: 需要隐藏 ${allHiddenNodeIds.size} 个节点`);

            this.applyVisibilityToNodes(nodes, allHiddenNodeIds);
            this.applyVisibilityToEdges(edges, allHiddenNodeIds);

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
            // 展开操作
            await this.autoArrangeAfterToggle(nodeId, canvas, false);
        } else {
            this.collapseStateManager.markCollapsed(nodeId);
            // 折叠操作
            await this.autoArrangeAfterToggle(nodeId, canvas, true);
        }
    }

    // =========================================================================
    // 拖拽时同步隐藏的子节点和浮动子树
    // =========================================================================
    async syncHiddenChildrenOnDrag(node: CanvasNodeLike) {
        if (!node?.id) return;

        const canvas = node.canvas;
        if (!canvas) return;

        // 1. 同步由于折叠而隐藏的子节点
        if (this.collapseStateManager.isCollapsed(node.id)) {
            // ... (现有的同步逻辑，如果以后需要的话)
        }

        // 2. 同步浮动子树
        if (this.floatingNodeService) {
            const floatingChildrenIds = this.floatingNodeService.getFloatingChildren(node.id);
            if (floatingChildrenIds.length > 0) {
                const nodeX = typeof node.x === 'number' ? node.x : 0;
                const nodeY = typeof node.y === 'number' ? node.y : 0;
                const dx = nodeX - (node.prevX ?? nodeX);
                const dy = nodeY - (node.prevY ?? nodeY);

                if (dx === 0 && dy === 0) {
                    node.prevX = node.x;
                    node.prevY = node.y;
                    return;
                }

                for (const childId of floatingChildrenIds) {
                    const childNode = this.getCanvasNodes(canvas).get(childId);
                    if (childNode && typeof childNode.moveAndResize === 'function') {
                        const childX = typeof childNode.x === 'number' ? childNode.x : 0;
                        const childY = typeof childNode.y === 'number' ? childNode.y : 0;
                        const childWidth = typeof childNode.width === 'number' ? childNode.width : 0;
                        const childHeight = typeof childNode.height === 'number' ? childNode.height : 0;
                        childNode.moveAndResize({
                            x: childX + dx,
                            y: childY + dy,
                            width: childWidth,
                            height: childHeight
                        });
                        // 递归同步子节点的子节点（虽然浮动节点本身会触发拖拽，但这里是父节点带动）
                        // 注意：moveAndResize 可能会触发 childNode 的 node-drag 事件，导致死循环
                        // 但 moveAndResize 通常不触发事件，除非是通过 UI 拖拽
                    }
                }
                
                node.prevX = nodeX;
                node.prevY = nodeY;
            }
        }
    }

    // =========================================================================
    // 清理残留的浮动节点数据（不存在的节点）
    // =========================================================================
    private async cleanupStaleFloatingNodes(canvas: CanvasLike, currentNodes: Map<string, CanvasNodeLike>): Promise<void> {
        try {
            const canvasFilePath = canvas.file?.path;
            if (!canvasFilePath) return;

            const canvasFile = this.app.vault.getAbstractFileByPath(canvasFilePath);
            if (!(canvasFile instanceof TFile)) return;

            const canvasContent = await this.app.vault.read(canvasFile);
            const canvasData = JSON.parse(canvasContent) as CanvasDataLike;

            if (!canvasData.metadata?.floatingNodes) return;

            const currentNodeIds = new Set<string>();
            currentNodes.forEach((_, id) => {
                currentNodeIds.add(id);
            });

            const floatingNodes = canvasData.metadata.floatingNodes;
            let hasStaleNodes = false;
            let staleCount = 0;

            // 检查并删除不存在的浮动节点记录
            for (const nodeId of Object.keys(floatingNodes)) {
                if (!currentNodeIds.has(nodeId)) {
                    delete floatingNodes[nodeId];
                    hasStaleNodes = true;
                    staleCount++;
                }
            }

            // 如果 floatingNodes 为空，删除整个对象
            if (Object.keys(floatingNodes).length === 0) {
                delete canvasData.metadata.floatingNodes;
            }

            // 如果有残留的节点，保存文件
            if (hasStaleNodes) {
                await this.app.vault.modify(canvasFile, JSON.stringify(canvasData, null, 2));
            }
        } catch (err) {
            handleError(err, { context: 'Layout', message: '清理残留失败', showNotice: false });
        }
    }

    // =========================================================================
    // 重新应用浮动节点的红框样式
    // =========================================================================
    private async reapplyFloatingNodeStyles(canvas: CanvasLike): Promise<void> {
        log(`[Layout] reapplyFloatingNodeStyles 被调用, floatingNodeService=${this.floatingNodeService ? 'exists' : 'null'}`);
        try {
            const canvasFilePath = canvas.file?.path || getCurrentCanvasFilePath(this.app);
            if (!canvasFilePath) {
                log('[Layout] 警告: 无法获取 canvas 文件路径，跳过样式应用');
                return;
            }

            log(`[Layout] 开始重新应用浮动节点样式 for ${canvasFilePath}`);
            // 延迟一点时间确保 DOM 已渲染完毕
            setTimeout(async () => {
                if (this.floatingNodeService) {
                    log(`[Layout] 调用 floatingNodeService.reapplyAllFloatingStyles...`);
                    await this.floatingNodeService.reapplyAllFloatingStyles(canvas);
                    log(`[Layout] 完成重新应用浮动节点样式 for ${canvasFilePath}`);
                } else {
                    log(`[Layout] 警告: floatingNodeService 为 null，无法应用样式`);
                }
            }, CONSTANTS.TIMING.STYLE_APPLY_DELAY);
        } catch (err) {
            handleError(err, { context: 'Layout', message: '重新应用样式失败', showNotice: false });
        }
    }

    private getCanvasFromView(view: unknown): CanvasLike | null {
        if (!isRecord(view)) return null;
        const maybeView = view as { canvas?: CanvasLike };
        return maybeView.canvas || null;
    }

    private getCanvasNodes(canvas: CanvasLike): Map<string, CanvasNodeLike> {
        const nodes = getNodesFromCanvas(canvas);
        return new Map(nodes.filter(n => n.id).map(n => [n.id!, n]));
    }

    private getCanvasEdges(canvas: CanvasLike): CanvasEdgeLike[] {
        return getEdgesFromCanvas(canvas);
    }

    private isCanvasManager(value: unknown): value is CanvasManagerLike {
        return isRecord(value) && typeof value.adjustAllTextNodeHeights === 'function';
    }

    private canSetData(node: unknown): node is { setData: (data: Record<string, unknown>) => void; getData?: () => Record<string, unknown> } {
        return isRecord(node) && typeof node.setData === 'function';
    }

    private toStringId(value: unknown): string | undefined {
        return typeof value === 'string' ? value : undefined;
    }

    private serializeEdge(memEdge: CanvasEdgeLike): Record<string, unknown> {
        return {
            id: memEdge.id,
            fromNode: this.toStringId(memEdge.fromNode) || this.toStringId(getNodeIdFromEdgeEndpoint(memEdge.from)) || this.toStringId(memEdge.from),
            toNode: this.toStringId(memEdge.toNode) || this.toStringId(getNodeIdFromEdgeEndpoint(memEdge.to)) || this.toStringId(memEdge.to),
            fromSide: this.toStringId(memEdge.fromSide) || (isRecord(memEdge.from) ? this.toStringId(memEdge.from.side) : undefined),
            toSide: this.toStringId(memEdge.toSide) || (isRecord(memEdge.to) ? this.toStringId(memEdge.to.side) : undefined),
            fromEnd: memEdge.fromEnd,
            toEnd: memEdge.toEnd,
            color: memEdge.color,
            label: memEdge.label
        };
    }

    private applyLayoutPositions(
        canvasData: CanvasDataLike,
        result: Map<string, { x: number; y: number }>
    ): boolean {
        let changed = false;
        for (const node of canvasData.nodes ?? []) {
            if (typeof node.id !== 'string') continue;
            const newPos = result.get(node.id);
            if (newPos && (node.x !== newPos.x || node.y !== newPos.y)) {
                node.x = newPos.x;
                node.y = newPos.y;
                changed = true;
            }
        }
        return changed;
    }

    private mergeMemoryEdgesIntoFileData(
        canvasData: CanvasDataLike,
        memoryEdges: CanvasEdgeLike[]
    ): boolean {
        if (!Array.isArray(canvasData.edges)) return false;
        let changed = false;
        const fileEdgeIds = new Set(canvasData.edges.map((e) => e.id).filter((id): id is string => typeof id === 'string'));
        for (const memEdge of memoryEdges) {
            if (memEdge.id && !fileEdgeIds.has(memEdge.id)) {
                canvasData.edges.push(this.serializeEdge(memEdge) as CanvasEdgeLike);
                changed = true;
            }
        }
        return changed;
    }
}
