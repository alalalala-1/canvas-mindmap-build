import { App, Notice, Plugin, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../settings/types';
import { CollapseStateManager } from '../state/collapse-state';
import { CanvasFileService } from './services/canvas-file-service';
import { log } from '../utils/logger';
import { CONSTANTS } from '../constants';
import { handleError } from '../utils/error-handler';
import { arrangeLayout as originalArrangeLayout } from './layout';
import { FloatingNodeService } from './services/floating-node-service';
import { getCanvasView, getCurrentCanvasFilePath, getNodeIdFromEdgeEndpoint, getNodesFromCanvas, getEdgesFromCanvas, isRecord } from '../utils/canvas-utils';
import {
    CanvasDataLike,
    CanvasEdgeLike,
    CanvasLike,
    CanvasNodeLike,
    CanvasManagerLike,
    CanvasArrangerSettings
} from './types';

import { VisibilityService } from './services/visibility-service';
import { LayoutDataProvider } from './services/layout-data-provider';
import { CollapseToggleService } from './services/collapse-toggle-service';
import { EdgeGeometryService } from './services/edge-geometry-service';

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
    private collapseToggleService: CollapseToggleService;
    private edgeGeometryService: EdgeGeometryService;
    private floatingNodeService: FloatingNodeService | null = null;
    private canvasManager: CanvasManagerLike | null = null;
    
    // [E1] 互斥锁 - 防止多次 arrange 交叠
    private isArranging: boolean = false;
    private pendingArrange: boolean = false;

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
        this.collapseToggleService = new CollapseToggleService(
            collapseStateManager,
            layoutDataProvider,
            () => this.getLayoutSettings()
        );
        this.edgeGeometryService = new EdgeGeometryService();
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

    // [D] Arrange 触发来源跟踪
    private arrangeTriggerSource: string = 'unknown';
    // [D] 待处理的 arrange 请求的触发来源
    private pendingArrangeSource: string = '';
    
    /**
     * 自动整理画布布局（带防抖）
     * @param source 触发来源：manual/file-change/debounce/pending-resume
     */
    private arrangeTimeoutId: number | null = null;
    async arrangeCanvas(source: string = 'debounce') {
        // [D] 记录触发来源
        this.arrangeTriggerSource = source;
        log(`[Layout] ArrangeTrigger: source=${source}`);
        
        if (this.arrangeTimeoutId !== null) {
            window.clearTimeout(this.arrangeTimeoutId);
        }

        this.arrangeTimeoutId = window.setTimeout(async () => {
            this.arrangeTimeoutId = null;
            // [D] 在 performArrange 中使用记录的触发来源
            await this.performArrange(false, source);
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
     * [C2] 获取节点的安全尺寸（带 fallback 防止 0 宽高）
     */
    private getSafeNodeSize(originalNode: CanvasNodeLike, currentData: Record<string, unknown>): { width: number; height: number } {
        const nodeAny = originalNode as any;
        
        // 来源1: currentData (内存中最新)
        let width = typeof currentData.width === 'number' && currentData.width > 0 ? currentData.width : 0;
        let height = typeof currentData.height === 'number' && currentData.height > 0 ? currentData.height : 0;

        // 来源2: originalNode.width/height
        if (width === 0) width = typeof nodeAny.width === 'number' && nodeAny.width > 0 ? nodeAny.width : 0;
        if (height === 0) height = typeof nodeAny.height === 'number' && nodeAny.height > 0 ? nodeAny.height : 0;

        // 来源3: newPosition (布局结果)
        // 注意：这个在调用处传入，这里不处理

        // 来源4: 默认值 (文本节点至少 60 高)
        if (width === 0) width = 150; // 默认宽度
        if (height === 0) height = 60; // 默认最小高度

        return { width, height };
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
        
        // [C2] 尺寸来源统计日志
        let zeroFromData = 0;
        let fromNode = 0;
        let fromLayout = 0;
        let defaulted = 0;

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

                // [修复] 位置更新时优先使用布局结果中的宽高，避免用 getData() 里的旧值把新宽度“弹回去”
                // fallback 仅在布局结果缺失宽高时启用
                const layoutWidth = typeof newPosition.width === 'number' && newPosition.width > 0 ? newPosition.width : 0;
                const layoutHeight = typeof newPosition.height === 'number' && newPosition.height > 0 ? newPosition.height : 0;
                const fallbackSize = (layoutWidth === 0 || layoutHeight === 0)
                    ? this.getSafeNodeSize(originalNode, currentData)
                    : null;
                const currentWidth = layoutWidth || fallbackSize?.width || 150;
                const currentHeight = layoutHeight || fallbackSize?.height || 60;
                
                // 统计尺寸来源
                const nodeAny = originalNode as any;
                const dataWidthOk = typeof currentData.width === 'number' && currentData.width > 0;
                const dataHeightOk = typeof currentData.height === 'number' && currentData.height > 0;
                if (!dataWidthOk || !dataHeightOk) {
                    zeroFromData++;
                }

                if (layoutWidth > 0 || layoutHeight > 0) {
                    fromLayout++;
                } else if (typeof nodeAny.width === 'number' && nodeAny.width > 0) {
                    fromNode++;
                } else {
                    defaulted++;
                }

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
        
        // [C2] 尺寸来源日志
        if (fromNode > 0 || fromLayout > 0 || defaulted > 0) {
            log(`[Layout] NodeSizeFallback: zeroFromData=${zeroFromData}, fromNode=${fromNode}, fromLayout=${fromLayout}, defaulted=${defaulted}, ctx=${contextId || 'none'}`);
        }

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
        log(`[Layout] PreAdjustWait: id=${contextId || 'none'}, adjusted=${adjustedCount}`);
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
     * @param source 触发来源
     */
    private async performArrange(skipAdjust: boolean = false, source: string = 'unknown') {
        // [E1] 互斥锁 - 防止多次 arrange 交叠
        // [D] 记录待处理的 arrange 来源
        if (this.isArranging) {
            log(`[Layout] ArrangeSkipBusy: pending=true, skipAdjust=${skipAdjust}, source=${source}`);
            this.pendingArrange = true;
            this.pendingArrangeSource = source;
            return;
        }
        
        this.isArranging = true;
        
        const activeView = getCanvasView(this.app);

        if (!activeView || activeView.getViewType() !== 'canvas') {
            new Notice("No active canvas found.");
            this.isArranging = false;
            return;
        }

        const canvas = this.getCanvasFromView(activeView);

        if (!canvas) {
            new Notice("Canvas view not initialized.");
            this.isArranging = false;
            return;
        }

        try {
            const arrangeId = `arrange-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
            await this.triggerHeightAdjustment(skipAdjust, arrangeId);

            if (!skipAdjust && this.canvasManager?.refreshTrustedHeightsForVisibleTextNodes) {
                const refreshedTrusted = await this.canvasManager.refreshTrustedHeightsForVisibleTextNodes(8);
                log(`[Layout] ProactiveTrustedRefresh: refreshed=${refreshedTrusted}, ctx=${arrangeId}`);
            }

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

            // [诊断] 布局前边几何诊断
            this.edgeGeometryService.logEdgeGeometryDiagnostics(canvas, allNodes, 'before', arrangeId);

            log(`[Layout] ArrangeStart: id=${arrangeId}, visible=${visibleNodes.size}, all=${allNodes.size}, edges=${edges.length}, originalEdges=${originalEdges.length}, file=${canvasFilePath || 'unknown'}`);
            log(`[Layout] ArrangeData: id=${arrangeId}, canvasNodes=${canvasData?.nodes?.length || 0}, canvasEdges=${canvasData?.edges?.length || 0}`);
            if (canvasData?.nodes?.length) {
                const nodeSamples = canvasData.nodes.slice(0, 3).map(n => `${n.id}:x=${n.x},y=${n.y},w=${n.width},h=${n.height}`);
                log(`[Layout] ArrangeSample(before): ${nodeSamples.join(' | ')}`);
            }
            if (canvasData?.edges?.length) {
                const edgeSamples = canvasData.edges.slice(0, 3).map(e => {
                    const fromId = e.fromNode || this.toStringId(getNodeIdFromEdgeEndpoint(e.from)) || 'unknown';
                    const toId = e.toNode || this.toStringId(getNodeIdFromEdgeEndpoint(e.to)) || 'unknown';
                    return `${e.id || 'edge'}:${fromId}->${toId}`;
                });
                log(`[Layout] ArrangeEdges(before): ${edgeSamples.join(' | ')}`);
            }

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

            const domVisibleRate = layoutData.visibilityStats?.domVisibleRate ?? 1;
            const domVisibleCount = layoutData.visibilityStats?.domVisibleCount ?? 0;
            const inViewportRate = layoutData.visibilityStats?.inViewportRate ?? 1;
            const inViewportCount = layoutData.visibilityStats?.inViewportCount ?? 0;
            const predictedChangedCount = this.countSignificantPositionChanges(canvasData?.nodes ?? [], result, CONSTANTS.LAYOUT.POSITION_WRITE_EPSILON);
            const lowVisibility =
                (domVisibleRate < CONSTANTS.LAYOUT.LOW_VISIBILITY_DOM_RATE && domVisibleCount < CONSTANTS.LAYOUT.LOW_VISIBILITY_MIN_DOM_VISIBLE)
                || inViewportCount <= 0;
            const allowWriteByMovement = predictedChangedCount >= CONSTANTS.LAYOUT.LOW_VISIBILITY_ALLOW_WRITE_MIN_CHANGED;
            const shouldSkipFileWrite = lowVisibility && !allowWriteByMovement;
            if (shouldSkipFileWrite) {
                log(`[Layout] FileWriteSkippedLowVisibility: domVisibleRate=${(domVisibleRate * 100).toFixed(1)}%, domVisibleCount=${domVisibleCount}, inViewportRate=${(inViewportRate * 100).toFixed(1)}%, inViewportCount=${inViewportCount}, predictedChanged=${predictedChangedCount}, threshold=${(CONSTANTS.LAYOUT.LOW_VISIBILITY_DOM_RATE * 100).toFixed(1)}%, minDomVisible=${CONSTANTS.LAYOUT.LOW_VISIBILITY_MIN_DOM_VISIBLE}, minChanged=${CONSTANTS.LAYOUT.LOW_VISIBILITY_ALLOW_WRITE_MIN_CHANGED}, ctx=${arrangeId}`);
            } else if (lowVisibility && allowWriteByMovement) {
                log(`[Layout] FileWriteOverrideLowVisibility: domVisibleRate=${(domVisibleRate * 100).toFixed(1)}%, domVisibleCount=${domVisibleCount}, inViewportRate=${(inViewportRate * 100).toFixed(1)}%, inViewportCount=${inViewportCount}, predictedChanged=${predictedChangedCount}, minChanged=${CONSTANTS.LAYOUT.LOW_VISIBILITY_ALLOW_WRITE_MIN_CHANGED}, ctx=${arrangeId}`);
            }

            const success = shouldSkipFileWrite ? false : await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (data) => {
                const canvasData = data;
                if (!Array.isArray(canvasData.nodes) || !Array.isArray(canvasData.edges)) return false;
                let changed = false;

                if (this.applyLayoutPositions(canvasData, result, arrangeId)) {
                    changed = true;
                }

                if (this.edgeGeometryService.mergeMemoryEdgesIntoFileData(canvasData, memoryEdges, arrangeId)) {
                    changed = true;
                }

                return changed;
            });

            let updatedCount = 0;
            if (success) {
                updatedCount = await this.updateNodePositions(result, allNodes, canvas, arrangeId);

                // [修复] 当本轮主要是尺寸变化（宽高）时，Canvas 引擎可能尚未完成节点几何到边锚点的传播
                // 先让 requestUpdate/requestSave 的异步渲染周期跑一帧，避免 edge.render() 读到旧锚点导致“临时断连”
                await new Promise<void>((resolve) => {
                    requestAnimationFrame(() => {
                        window.setTimeout(() => resolve(), 50);
                    });
                });

                setTimeout(() => {
                    const memoryEdgesAfter = this.getCanvasEdges(canvas);
                    const edgeSamplesAfter = memoryEdgesAfter.slice(0, 3).map(e => {
                        const fromId = this.toStringId(e.fromNode) || this.toStringId(getNodeIdFromEdgeEndpoint(e.from)) || 'unknown';
                        const toId = this.toStringId(e.toNode) || this.toStringId(getNodeIdFromEdgeEndpoint(e.to)) || 'unknown';
                        return `${e.id || 'edge'}:${fromId}->${toId}`;
                    });
                    log(`[Layout] ArrangeEdges(after): ${edgeSamplesAfter.join(' | ')}`);

                    const nodeSamplesAfter = Array.from(allNodes.values()).slice(0, 3).map(n => {
                        const bbox = (n as any).bbox;
                        const bboxStr = bbox ? `bbox(${bbox.minX?.toFixed(1)},${bbox.minY?.toFixed(1)}->${bbox.maxX?.toFixed(1)},${bbox.maxY?.toFixed(1)})` : 'bbox=none';
                        return `${n.id}:x=${n.x},y=${n.y},w=${n.width},h=${n.height},${bboxStr}`;
                    });
                    log(`[Layout] ArrangeSample(after): ${nodeSamplesAfter.join(' | ')}`);
                }, 300);
            }

            await this.cleanupStaleFloatingNodes(canvas, allNodes);
            await this.reapplyFloatingNodeStyles(canvas);

            // [C1] 双阶段刷新边几何
            await this.edgeGeometryService.refreshEdgeGeometry(canvas, arrangeId);

            // [诊断] 布局后边几何诊断（pass2后）
            this.edgeGeometryService.logEdgeGeometryDiagnostics(canvas, allNodes, 'after-pass2', arrangeId);

            new Notice(`布局完成！更新了 ${updatedCount} 个节点`);
            log(`[Layout] 完成: 更新 ${updatedCount}`);

        } catch (err) {
            handleError(err, { context: 'Layout', message: '布局失败，请重试' });
        } finally {
            // [E1] 释放互斥锁并处理待处理请求
            // [D] 使用 pendingArrangeSource 恢复待处理的 arrange 请求
            this.isArranging = false;
            if (this.pendingArrange) {
                const resumeSource = this.pendingArrangeSource || 'pending-resume';
                log(`[Layout] ArrangeResumePending: 执行待处理的 arrange 请求, source=${resumeSource}`);
                this.pendingArrange = false;
                this.pendingArrangeSource = '';
                // 延迟一点时间再执行，避免立即执行导致问题
                setTimeout(() => {
                    void this.performArrange(false, resumeSource);
                }, 100);
            }
        }
    }

    /**
     * 在折叠/展开节点后自动整理布局（代理到 CollapseToggleService）
     */
    async autoArrangeAfterToggle(nodeId: string, canvas: CanvasLike, isCollapsing: boolean = true) {
        await this.collapseToggleService.autoArrangeAfterToggle(nodeId, canvas, isCollapsing);
    }
    async toggleNodeCollapse(nodeId: string, canvas: CanvasLike) {
        await this.collapseToggleService.toggleNodeCollapse(nodeId, canvas);
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

    private applyLayoutPositions(
        canvasData: CanvasDataLike,
        result: Map<string, { x: number; y: number; width?: number; height?: number }>,
        contextId?: string
    ): boolean {
        let changed = false;
        let changedCount = 0;
        let sizeChangedCount = 0;
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
            const epsilon = CONSTANTS.LAYOUT.POSITION_WRITE_EPSILON;

            const posChanged = Math.abs(prevX - newPos.x) > epsilon || Math.abs(prevY - newPos.y) > epsilon;

            const prevW = typeof node.width === 'number' ? node.width : 0;
            const prevH = typeof node.height === 'number' ? node.height : 0;
            const nextW = typeof newPos.width === 'number' && newPos.width > 0 ? newPos.width : prevW;
            const nextH = typeof newPos.height === 'number' && newPos.height > 0 ? newPos.height : prevH;
            const sizeChanged = Math.abs(prevW - nextW) > epsilon || Math.abs(prevH - nextH) > epsilon;

            if (posChanged || sizeChanged) {
                node.x = newPos.x;
                node.y = newPos.y;
                if (nextW > 0) node.width = nextW;
                if (nextH > 0) node.height = nextH;
                changed = true;
                if (posChanged) changedCount++;
                if (sizeChanged) sizeChangedCount++;
            }

            // [已移除] FileHeight修正逻辑 - 导致与adjustAllTextNodeHeights产生死循环
            // 问题：Layout用估算值覆盖adjustAllTextNodeHeights刚写的准确minHeight值
            // → adjustAllTextNodeHeights读minHeight写94 → Layout用估算68覆盖 → 重新加载又变94 → 死循环
            // 解决：Layout只负责位置(x,y)，高度由adjustAllTextNodeHeights唯一管理(SSOT原则)
            // 高度在arrangeLayout之前已由adjustAllTextNodeHeights处理完毕，此处不再修改
        }
        const avgDelta = changedCount > 0 ? totalDelta / changedCount : 0;
        log(`[Layout] FilePos: changed=${changedCount}, sizeChanged=${sizeChangedCount}, missing=${missingCount}, maxDelta=${maxDelta.toFixed(1)}, avgDelta=${avgDelta.toFixed(1)}, ctx=${contextId || 'none'}`);
        return changed;
    }

    private countSignificantPositionChanges(
        nodes: CanvasNodeLike[],
        result: Map<string, { x: number; y: number; width?: number; height?: number }>,
        epsilon: number
    ): number {
        let count = 0;
        for (const node of nodes) {
            if (!node?.id) continue;
            const newPos = result.get(node.id);
            if (!newPos) continue;
            const prevX = typeof node.x === 'number' ? node.x : 0;
            const prevY = typeof node.y === 'number' ? node.y : 0;
            if (Math.abs(prevX - newPos.x) > epsilon || Math.abs(prevY - newPos.y) > epsilon) {
                count++;
            }
        }
        return count;
    }
}
