import { App, Notice, Plugin, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../settings/types';
import { CollapseStateManager } from '../state/collapse-state';
import { CanvasFileService } from './services/canvas-file-service';
import { log } from '../utils/logger';
import { CONSTANTS } from '../constants';
import { handleError } from '../utils/error-handler';
import { arrangeLayout as originalArrangeLayout } from './layout';
import { FloatingNodeService } from './services/floating-node-service';
import { getCanvasView, getCurrentCanvasFilePath, getNodeIdFromEdgeEndpoint, getNodesFromCanvas, getEdgesFromCanvas, isRecord, parseFloatingNodeInfo } from '../utils/canvas-utils';
import {
    CanvasDataLike,
    CanvasEdgeLike,
    CanvasLike,
    CanvasNodeLike,
    FloatingNodeRecord,
    CanvasManagerLike,
    CanvasArrangerSettings
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

    /**
     * 更新节点位置到Canvas
     * [修复] 同时同步 height 到内存节点，确保边连接点基于正确高度计算
     * @param result 布局结果映射（包含 x, y, width, height）
     * @param allNodes 所有节点映射
     * @param canvas Canvas对象
     * @returns 更新的节点数量
     */
    private async updateNodePositions(
        result: Map<string, { x: number; y: number; width?: number; height?: number }>,
        allNodes: Map<string, CanvasNodeLike>,
        canvas: CanvasLike,
        contextId?: string
    ): Promise<number> {
        let updatedCount = 0;
        let movedCount = 0;
        let missingCount = 0;
        let maxDelta = 0;
        let totalDelta = 0;

        for (const [nodeId, newPosition] of result.entries()) {
            // 保留原始 CanvasNodeLike 引用，用于访问 nodeEl
            const originalNode = allNodes.get(nodeId);
            if (this.canSetData(originalNode)) {
                const currentData = originalNode.getData ? originalNode.getData() : {};
                const prevX = typeof currentData.x === 'number' ? currentData.x : 0;
                const prevY = typeof currentData.y === 'number' ? currentData.y : 0;
                const dx = Math.abs(prevX - newPosition.x);
                const dy = Math.abs(prevY - newPosition.y);
                const delta = Math.hypot(dx, dy);
                if (delta > 0.5) movedCount++;
                if (delta > maxDelta) maxDelta = delta;
                totalDelta += delta;

                // [SSOT原则] Layout只负责位置(x,y)，不修改width/height
                // width/height由adjustAllTextNodeHeights唯一管理，已在文件中
                const currentWidth = typeof currentData.width === 'number' ? currentData.width : 0;
                const currentHeight = typeof currentData.height === 'number' ? currentData.height : 0;

                // 使用 Canvas 引擎原生的 moveAndResize 方法
                // 注意：虽然叫 moveAndResize，但我们保持原有的 width/height 不变
                if (typeof (originalNode as any).moveAndResize === 'function') {
                    (originalNode as any).moveAndResize({
                        x: newPosition.x,
                        y: newPosition.y,
                        width: currentWidth,
                        height: currentHeight
                    });
                } else {
                    // Fallback: 如果没有 moveAndResize，则手动更新
                    const newData: Record<string, unknown> = {
                        ...currentData,
                        x: newPosition.x,
                        y: newPosition.y
                    };
                    originalNode.setData(newData);

                    if ((originalNode as any).bbox) {
                        (originalNode as any).bbox = {
                            minX: newPosition.x,
                            minY: newPosition.y,
                            maxX: newPosition.x + currentWidth,
                            maxY: newPosition.y + currentHeight
                        };
                    }

                    if (typeof (originalNode as any).update === 'function') {
                        (originalNode as any).update();
                    }
                    if (typeof (originalNode as any).render === 'function') {
                        (originalNode as any).render();
                    }
                }

                updatedCount++;
            } else {
                missingCount++;
            }
        }

        const avgDelta = updatedCount > 0 ? totalDelta / updatedCount : 0;
        log(`[Layout] NodePos: updated=${updatedCount}, moved=${movedCount}, missing=${missingCount}, maxDelta=${maxDelta.toFixed(1)}, avgDelta=${avgDelta.toFixed(1)}, ctx=${contextId || 'none'}`);

        if (typeof canvas.requestUpdate === 'function') canvas.requestUpdate();
        if (typeof canvas.requestSave === 'function') canvas.requestSave();
        return updatedCount;
    }

    /**
     * 触发节点高度调整
     * @param skipAdjust 是否跳过调整
     */
    private async triggerHeightAdjustment(skipAdjust: boolean, contextId?: string): Promise<number> {
        if (skipAdjust) return 0;
        if (!this.canvasManager) {
            log(`[Layout] 调整高度失败: 未找到管理器`);
            return 0;
        }
        log(`[Layout] PreAdjustStart: id=${contextId || 'none'}`);
        await new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
        });
        const adjustedCount = await this.canvasManager.adjustAllTextNodeHeights();
        log(`[Layout] PreAdjustWait: id=${contextId || 'none'}`);
        await new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
                window.setTimeout(() => resolve(), CONSTANTS.TIMING.RETRY_DELAY_SHORT);
            });
        });
        log(`[Layout] PreAdjustDone: id=${contextId || 'none'}, adjusted=${adjustedCount}`);
        return adjustedCount;
    }

    /**
     * 执行布局整理
     * @param skipAdjust 是否跳过高度调整
     */
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
            const arrangeId = `arrange-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
            await this.triggerHeightAdjustment(skipAdjust, arrangeId);

            const normalizeFilePath = canvas.file?.path || getCurrentCanvasFilePath(this.app);
            if (normalizeFilePath) {
                const normalized = await this.canvasFileService.normalizeCanvasDataAtomic(normalizeFilePath);
                if (normalized) {
                    log(`[Layout] 数据规范化完成: ${normalizeFilePath}`);
                }
            }

            const layoutData = await this.layoutDataProvider.getLayoutData(canvas);
            if (!layoutData) {
                new Notice("Failed to gather canvas data.");
                return;
            }

            const { visibleNodes, edges, originalEdges, canvasData, allNodes, canvasFilePath } = layoutData;

            log(`[Layout] ArrangeStart: id=${arrangeId}, visible=${visibleNodes.size}, all=${allNodes.size}, edges=${edges.length}, originalEdges=${originalEdges.length}, file=${canvasFilePath || 'unknown'}`);
            log(`[Layout] ArrangeData: id=${arrangeId}, canvasNodes=${canvasData?.nodes?.length || 0}, canvasEdges=${canvasData?.edges?.length || 0}`);

            // === 补充详细诊断日志：布局前的节点和边状态 ===
            if (canvasData?.nodes) {
                const nodeSamples = canvasData.nodes.slice(0, 5).map(n => {
                    const dataStr = n.data ? JSON.stringify(n.data).substring(0, 50) : 'none';
                    return `${n.id}: x=${n.x}, y=${n.y}, w=${n.width}, h=${n.height}, data=${dataStr}`;
                });
                log(`[Layout.Diag] 布局前节点状态(前5个): ${nodeSamples.join(' | ')}`);
            }
            if (canvasData?.edges) {
                const edgeSamples = canvasData.edges.slice(0, 5).map(e => {
                    return `${e.id}: ${e.fromNode}(${e.fromSide})->${e.toNode}(${e.toSide}), fromEnd=${e.fromEnd}, toEnd=${e.toEnd}`;
                });
                log(`[Layout.Diag] 布局前边状态(前5个): ${edgeSamples.join(' | ')}`);
            }
            // ==========================================

            const result = originalArrangeLayout(
                visibleNodes,
                edges,
                this.getLayoutSettings(),
                originalEdges,
                allNodes,
                canvasData || undefined
            );

            let missingInResult = 0;
            for (const nodeId of visibleNodes.keys()) {
                if (!result.has(nodeId)) missingInResult++;
            }
            const extraInResult = Math.max(0, result.size - (visibleNodes.size - missingInResult));
            log(`[Layout] ArrangeResult: id=${arrangeId}, layoutNodes=${result.size}, missing=${missingInResult}, extra=${extraInResult}`);

            if (!canvasFilePath) throw new Error('找不到路径');

            const memoryEdges = this.getCanvasEdges(canvas);
            log(`[Layout] ArrangeMemoryEdges: id=${arrangeId}, count=${memoryEdges.length}`);

            const success = await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (data) => {
                const canvasData = data;
                if (!Array.isArray(canvasData.nodes) || !Array.isArray(canvasData.edges)) return false;
                let changed = false;

                if (this.applyLayoutPositions(canvasData, result, arrangeId)) {
                    changed = true;
                }

                if (this.mergeMemoryEdgesIntoFileData(canvasData, memoryEdges, arrangeId)) {
                    changed = true;
                }

                return changed;
            });

            let updatedCount = 0;
            if (success) {
                updatedCount = await this.updateNodePositions(result, allNodes, canvas, arrangeId);

                // === 补充详细诊断日志：布局后的边状态 ===
                // 延迟一点时间，等待 Canvas 引擎完成 DOM 更新
                setTimeout(() => {
                    const memoryEdgesAfter = this.getCanvasEdges(canvas);
                    const edgeSamplesAfter = memoryEdgesAfter.slice(0, 5).map(e => {
                        const fromId = this.toStringId(e.fromNode) || this.toStringId(getNodeIdFromEdgeEndpoint(e.from));
                        const toId = this.toStringId(e.toNode) || this.toStringId(getNodeIdFromEdgeEndpoint(e.to));
                        const fromSide = this.toStringId(e.fromSide) || (isRecord(e.from) ? this.toStringId(e.from.side) : undefined);
                        const toSide = this.toStringId(e.toSide) || (isRecord(e.to) ? this.toStringId(e.to.side) : undefined);

                        // 尝试获取 SVG path 数据
                        let pathData = 'none';
                        let bboxData = 'none';

                        // Obsidian Canvas 内部的 edge 对象通常有 bbox 属性
                        if ((e as any).bbox) {
                            const b = (e as any).bbox;
                            bboxData = `bbox(${b.minX?.toFixed(1)},${b.minY?.toFixed(1)}->${b.maxX?.toFixed(1)},${b.maxY?.toFixed(1)})`;
                        }

                        if (e.lineGroupEl) {
                            // Obsidian Canvas 的边通常是一个 path 元素
                            const pathEl = e.lineGroupEl.querySelector('path');
                            if (pathEl) {
                                pathData = pathEl.getAttribute('d') || 'empty';
                            }
                        }

                        return `${e.id}: ${fromId}(${fromSide})->${toId}(${toSide}), ${bboxData}, path=${pathData.substring(0, 30)}...`;
                    });
                    log(`[Layout.Diag] 布局后内存边状态(前5个): ${edgeSamplesAfter.join(' | ')}`);

                    // 打印几个节点的实际 DOM 坐标
                    const nodeSamplesAfter = Array.from(allNodes.values()).slice(0, 3).map(n => {
                        let rectStr = 'none';
                        let bboxStr = 'none';

                        if ((n as any).bbox) {
                            const b = (n as any).bbox;
                            bboxStr = `bbox(${b.minX?.toFixed(1)},${b.minY?.toFixed(1)}->${b.maxX?.toFixed(1)},${b.maxY?.toFixed(1)})`;
                        }

                        if (n.nodeEl && n.nodeEl instanceof HTMLElement) {
                            const rect = n.nodeEl.getBoundingClientRect();
                            rectStr = `rect(x=${rect.x.toFixed(1)},y=${rect.y.toFixed(1)},w=${rect.width.toFixed(1)},h=${rect.height.toFixed(1)})`;
                        }
                        return `${n.id}: x=${n.x}, y=${n.y}, w=${n.width}, h=${n.height}, ${bboxStr}, ${rectStr}`;
                    });
                    log(`[Layout.Diag] 布局后节点DOM状态(前3个): ${nodeSamplesAfter.join(' | ')}`);
                }, 350); // 等待最后一次重绘完成
                // ==========================================
            }

            await this.cleanupStaleFloatingNodes(canvas, allNodes);
            await this.reapplyFloatingNodeStyles(canvas);

            new Notice(`布局完成！更新了 ${updatedCount} 个节点`);
            log(`[Layout] 完成: 更新 ${updatedCount}`);

        } catch (err) {
            handleError(err, { context: 'Layout', message: '布局失败，请重试' });
        }
    }

    /**
     * 收集需要隐藏的节点ID
     * @param nodes 节点映射
     * @param edges 边列表
     * @param canvasData Canvas数据
     * @returns 隐藏节点ID集合
     */
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

    /**
     * 应用节点可见性
     * @param nodes 节点映射
     * @param hiddenIds 隐藏节点ID集合
     */
    private applyVisibilityToNodes(nodes: Map<string, CanvasNodeLike>, hiddenIds: Set<string>): void {
        nodes.forEach((node, id) => {
            if (node?.nodeEl) {
                const shouldHide = hiddenIds.has(id);
                node.nodeEl.style.display = shouldHide ? 'none' : '';
            }
        });
    }

    /**
     * 应用边可见性
     * @param edges 边列表
     * @param hiddenIds 隐藏节点ID集合
     */
    private applyVisibilityToEdges(edges: CanvasEdgeLike[], hiddenIds: Set<string>): void {
        for (const edge of edges) {
            const fromId = getNodeIdFromEdgeEndpoint(edge?.from);
            const toId = getNodeIdFromEdgeEndpoint(edge?.to);
            const shouldHide = (fromId && hiddenIds.has(fromId)) || (toId && hiddenIds.has(toId));
            if (edge.lineGroupEl) edge.lineGroupEl.style.display = shouldHide ? 'none' : '';
            if (edge.lineEndGroupEl) edge.lineEndGroupEl.style.display = shouldHide ? 'none' : '';
        }
    }

    /**
     * 计算锚点偏移量
     * @param nodeId 锚点节点ID
     * @param nodes 节点映射
     * @param newLayout 新布局映射
     * @returns 偏移量
     */
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

    /**
     * 带偏移量更新节点位置
     * @param newLayout 新布局映射
     * @param nodes 节点映射
     * @param offsetX X偏移量
     * @param offsetY Y偏移量
     * @returns 更新的节点数量
     */
    private async updateNodePositionsWithOffset(
        newLayout: Map<string, { x: number; y: number }>,
        nodes: Map<string, CanvasNodeLike>,
        offsetX: number,
        offsetY: number
    ): Promise<number> {
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

    /**
     * 应用折叠/展开时的可见性
     * @param nodeId 当前操作的节点ID
     * @param nodes 节点映射
     * @param edges 边列表
     * @param canvasData Canvas数据
     */
    private applyToggleVisibility(
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

            // 检查并删除不存在的浮动节点记录
            for (const nodeId of Object.keys(floatingNodes)) {
                if (!currentNodeIds.has(nodeId)) {
                    delete floatingNodes[nodeId];
                    hasStaleNodes = true;
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
        result: Map<string, { x: number; y: number; width?: number; height?: number }>,
        contextId?: string
    ): boolean {
        let changed = false;
        let changedCount = 0;
        let missingCount = 0;
        let maxDelta = 0;
        let totalDelta = 0;

        for (const node of canvasData.nodes ?? []) {
            if (typeof node.id !== 'string') continue;
            const newPos = result.get(node.id);
            if (!newPos) {
                missingCount++;
                continue;
            }
            const prevX = typeof node.x === 'number' ? node.x : 0;
            const prevY = typeof node.y === 'number' ? node.y : 0;
            const dx = Math.abs(prevX - newPos.x);
            const dy = Math.abs(prevY - newPos.y);
            const delta = Math.hypot(dx, dy);
            if (delta > maxDelta) maxDelta = delta;
            totalDelta += delta;
            if (node.x !== newPos.x || node.y !== newPos.y) {
                node.x = newPos.x;
                node.y = newPos.y;
                changed = true;
                changedCount++;
            }

            // [已移除] FileHeight修正逻辑 - 导致与adjustAllTextNodeHeights产生死循环
            // 问题：Layout用估算值覆盖adjustAllTextNodeHeights刚写的准确minHeight值
            // → adjustAllTextNodeHeights读minHeight写94 → Layout用估算68覆盖 → 重新加载又变94 → 死循环
            // 解决：Layout只负责位置(x,y)，高度由adjustAllTextNodeHeights唯一管理(SSOT原则)
            // 高度在arrangeLayout之前已由adjustAllTextNodeHeights处理完毕，此处不再修改
        }
        const avgDelta = changedCount > 0 ? totalDelta / changedCount : 0;
        log(`[Layout] FilePos: changed=${changedCount}, missing=${missingCount}, maxDelta=${maxDelta.toFixed(1)}, avgDelta=${avgDelta.toFixed(1)}, ctx=${contextId || 'none'}`);
        return changed;
    }

    private mergeMemoryEdgesIntoFileData(
        canvasData: CanvasDataLike,
        memoryEdges: CanvasEdgeLike[],
        contextId?: string
    ): boolean {
        if (!Array.isArray(canvasData.edges)) return false;
        let changed = false;
        let addedCount = 0;
        const fileEdgeIds = new Set(canvasData.edges.map((e) => e.id).filter((id): id is string => typeof id === 'string'));
        for (const memEdge of memoryEdges) {
            if (memEdge.id && !fileEdgeIds.has(memEdge.id)) {
                canvasData.edges.push(this.serializeEdge(memEdge) as CanvasEdgeLike);
                changed = true;
                addedCount++;
            }
        }
        if (addedCount > 0) {
            log(`[Layout] MergeEdges: added=${addedCount}, memory=${memoryEdges.length}, file=${canvasData.edges.length}, ctx=${contextId || 'none'}`);
        }
        return changed;
    }
}
