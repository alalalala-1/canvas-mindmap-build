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
 * EdgeGeom 诊断数据结构 V2
 * 用于 before/after 边几何对比
 */
interface EdgeGeomDiagnostics {
    edgeErrors: Map<string, { fromErr: number; toErr: number }>;
    timestamp: number;
}

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

                // [SSOT原则] Layout只负责位置(x,y)，不修改width/height
                // width/height由adjustAllTextNodeHeights唯一管理，已在文件中
                // [C2] 使用安全的尺寸获取方法，防止 0 宽高
                const { width: currentWidth, height: currentHeight } = this.getSafeNodeSize(originalNode, currentData);
                
                // 统计尺寸来源
                const nodeAny = originalNode as any;
                if (typeof currentData.width === 'number' && currentData.width > 0) {
                    // 来自 currentData
                } else if (typeof nodeAny.width === 'number' && nodeAny.width > 0) {
                    fromNode++;
                } else if (typeof newPosition.width === 'number' && newPosition.width > 0) {
                    fromLayout++;
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
     * [C1] 双阶段刷新边几何 V3
     * 第一轮让几何跟上节点数据，第二轮吃掉异步 DOM/虚拟化延迟
     * V2: 添加 bezier 变化检测，验证几何是否真的更新了
     * V3: 添加 path d 属性变化检测，区分 bezier 对象变化 vs SVG 路径层变化
     */
    private async refreshEdgeGeometry(
        canvas: CanvasLike,
        contextId?: string
    ): Promise<{ pass1: number; pass2: number; bezierChangedPass1: number; bezierChangedPass2: number; pathDChangedPass1: number; pathDChangedPass2: number }> {
        const edges = this.getCanvasEdges(canvas);
        if (edges.length === 0) {
            log(`[Layout] EdgeRefresh: edges=0, ctx=${contextId || 'none'}`);
            return { pass1: 0, pass2: 0, bezierChangedPass1: 0, bezierChangedPass2: 0, pathDChangedPass1: 0, pathDChangedPass2: 0 };
        }

        // V2: 记录刷新前的 bezier 状态
        const getEdgeBezierSignature = (edge: CanvasEdgeLike): string => {
            const bezier = (edge as any).bezier;
            if (!bezier) return 'no-bezier';
            const from = bezier.from ? `${bezier.from.x?.toFixed(1)},${bezier.from.y?.toFixed(1)}` : 'no-from';
            const to = bezier.to ? `${bezier.to.x?.toFixed(1)},${bezier.to.y?.toFixed(1)}` : 'no-to';
            const cp1 = bezier.cp1 ? `${bezier.cp1.x?.toFixed(1)},${bezier.cp1.y?.toFixed(1)}` : 'no-cp1';
            const cp2 = bezier.cp2 ? `${bezier.cp2.x?.toFixed(1)},${bezier.cp2.y?.toFixed(1)}` : 'no-cp2';
            return `${from}|${to}|${cp1}|${cp2}`;
        };

        // V3: 获取 SVG path 的 d 属性
        const getEdgePathD = (edge: CanvasEdgeLike): string => {
            const pathEl = (edge as any).pathEl;
            if (!pathEl) return 'no-pathEl';
            return pathEl.getAttribute('d') || 'no-d';
        };

        // V3: 获取 lineGroup 的状态
        const getLineGroupState = (edge: CanvasEdgeLike): string => {
            const lineGroupEl = (edge as any).lineGroupEl;
            if (!lineGroupEl) return 'no-lineGroup';
            const display = lineGroupEl.style.display || window.getComputedStyle(lineGroupEl).display;
            const transform = lineGroupEl.style.transform || 'none';
            return `display=${display},transform=${transform.substring(0, 30)}`;
        };

        // 记录边端点签名，用于诊断“端点变化但路径未变化”
        const getEdgeEndpointSignature = (edge: CanvasEdgeLike): string => {
            const fromNode = this.toStringId((edge as any).fromNode) || this.toStringId(getNodeIdFromEdgeEndpoint((edge as any).from)) || 'unknown';
            const toNode = this.toStringId((edge as any).toNode) || this.toStringId(getNodeIdFromEdgeEndpoint((edge as any).to)) || 'unknown';
            const fromSide = this.toStringId((edge as any).fromSide) || (isRecord((edge as any).from) ? this.toStringId(((edge as any).from as Record<string, unknown>).side) : undefined) || 'unknown';
            const toSide = this.toStringId((edge as any).toSide) || (isRecord((edge as any).to) ? this.toStringId(((edge as any).to as Record<string, unknown>).side) : undefined) || 'unknown';
            return `${fromNode}:${fromSide}->${toNode}:${toSide}`;
        };

        // 记录初始 bezier 和 path d 状态
        const beforeRefresh = new Map<string, string>();
        const beforePathD = new Map<string, string>();
        const beforeLineGroup = new Map<string, string>();
        const beforeEndpoint = new Map<string, string>();
        
        for (const edge of edges) {
            if (edge.id) {
                beforeRefresh.set(edge.id, getEdgeBezierSignature(edge));
                beforePathD.set(edge.id, getEdgePathD(edge));
                beforeLineGroup.set(edge.id, getLineGroupState(edge));
                beforeEndpoint.set(edge.id, getEdgeEndpointSignature(edge));
            }
        }

        // 第一轮：立即刷新
        let pass1Rendered = 0;
        let bezierChangedPass1 = 0;
        let pathDChangedPass1 = 0;
        let lineGroupConnected = 0;
        // V3: 新增 lineGroup display/transform 变化统计
        let lineGroupDisplayChangedPass1 = 0;
        let lineGroupTransformChangedPass1 = 0;
        
        for (const edge of edges) {
            if (typeof (edge as any).render === 'function') {
                try {
                    (edge as any).render();
                    pass1Rendered++;
                } catch (e) {
                    // 忽略单个边的渲染错误
                }
            }
            // V3: 统计 lineGroup 连接状态
            if ((edge as any).lineGroupEl) {
                lineGroupConnected++;
            }
        }

        // V2: 检测 pass1 后 bezier 变化
        // V3: 检测 pass1 后 path d 变化和 lineGroup display/transform 变化
        for (const edge of edges) {
            if (edge.id) {
                const before = beforeRefresh.get(edge.id);
                const after = getEdgeBezierSignature(edge);
                if (before !== after) {
                    bezierChangedPass1++;
                }
                
                const beforeD = beforePathD.get(edge.id);
                const afterD = getEdgePathD(edge);
                if (beforeD !== afterD) {
                    pathDChangedPass1++;
                }
                
                // V3: 检测 lineGroup display 和 transform 变化
                const beforeLG = beforeLineGroup.get(edge.id);
                const afterLG = getLineGroupState(edge);
                if (beforeLG && afterLG) {
                    const beforeDisplay = beforeLG.split(',')[0]?.replace('display=', '') || '';
                    const afterDisplay = afterLG.split(',')[0]?.replace('display=', '') || '';
                    if (beforeDisplay !== afterDisplay) {
                        lineGroupDisplayChangedPass1++;
                    }
                    const beforeTransform = beforeLG.split(',')[1]?.replace('transform=', '') || '';
                    const afterTransform = afterLG.split(',')[1]?.replace('transform=', '') || '';
                    if (beforeTransform !== afterTransform) {
                        lineGroupTransformChangedPass1++;
                    }
                }
            }
        }

        // V2: 记录 pass1 后的状态，用于检测 pass2 变化
        const afterPass1 = new Map<string, string>();
        const afterPathDPass1 = new Map<string, string>();
        for (const edge of edges) {
            if (edge.id) {
                afterPass1.set(edge.id, getEdgeBezierSignature(edge));
                afterPathDPass1.set(edge.id, getEdgePathD(edge));
            }
        }

        log(`[Layout] EdgeRefreshV3(pass1): rendered=${pass1Rendered}/${edges.length}, ` +
            `bezierChanged=${bezierChangedPass1}, pathDChanged=${pathDChangedPass1}, ` +
            `lineGroupConnected=${lineGroupConnected}, lineDisplayChanged=${lineGroupDisplayChangedPass1}, lineTransformChanged=${lineGroupTransformChangedPass1}, ` +
            `skipped=${edges.length - pass1Rendered}, ctx=${contextId || 'none'}`);

        // 第二轮：等待动画帧后刷新（吃掉异步延迟）
        await new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
                window.setTimeout(() => resolve(), 50);
            });
        });

        let pass2Rendered = 0;
        let bezierChangedPass2 = 0;
        let pathDChangedPass2 = 0;
        let endpointChangedButPathUnchanged = 0;
        const endpointChangedButPathUnchangedSamples: string[] = [];
        for (const edge of edges) {
            if (typeof (edge as any).render === 'function') {
                try {
                    (edge as any).render();
                    pass2Rendered++;
                } catch (e) {
                    // 忽略单个边的渲染错误
                }
            }
        }

        // V2: 检测 pass2 后 bezier 变化
        // V3: 检测 pass2 后 path d 变化
        for (const edge of edges) {
            if (edge.id) {
                const afterPass1Sig = afterPass1.get(edge.id);
                const afterPass2Sig = getEdgeBezierSignature(edge);
                if (afterPass1Sig !== afterPass2Sig) {
                    bezierChangedPass2++;
                }
                
                const afterPass1D = afterPathDPass1.get(edge.id);
                const afterPass2D = getEdgePathD(edge);
                if (afterPass1D !== afterPass2D) {
                    pathDChangedPass2++;
                }

                const beforeEndpointSig = beforeEndpoint.get(edge.id);
                const afterEndpointSig = getEdgeEndpointSignature(edge);
                const pathNeverChanged = beforePathD.get(edge.id) === afterPass1D && afterPass1D === afterPass2D;
                if (beforeEndpointSig && beforeEndpointSig !== afterEndpointSig && pathNeverChanged) {
                    endpointChangedButPathUnchanged++;
                    if (endpointChangedButPathUnchangedSamples.length < 3) {
                        endpointChangedButPathUnchangedSamples.push(`${edge.id}:${beforeEndpointSig}=>${afterEndpointSig}`);
                    }
                }
            }
        }

        log(`[Layout] EdgeRefreshV3(pass2): rendered=${pass2Rendered}/${edges.length}, ` +
            `bezierChanged=${bezierChangedPass2}, pathDChanged=${pathDChangedPass2}, ` +
            `endpointChangedButPathUnchanged=${endpointChangedButPathUnchanged}, ` +
            `sample=${endpointChangedButPathUnchangedSamples.join('|') || 'none'}, ` +
            `skipped=${edges.length - pass2Rendered}, ctx=${contextId || 'none'}`);

        return { pass1: pass1Rendered, pass2: pass2Rendered, bezierChangedPass1, bezierChangedPass2, pathDChangedPass1, pathDChangedPass2 };
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
            this.logEdgeGeometryDiagnostics(canvas, allNodes, 'before', arrangeId);

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

                if (this.mergeMemoryEdgesIntoFileData(canvasData, memoryEdges, arrangeId)) {
                    changed = true;
                }

                return changed;
            });

            let updatedCount = 0;
            if (success) {
                updatedCount = await this.updateNodePositions(result, allNodes, canvas, arrangeId);

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
            await this.refreshEdgeGeometry(canvas, arrangeId);

            // [诊断] 布局后边几何诊断（pass2后）
            this.logEdgeGeometryDiagnostics(canvas, allNodes, 'after-pass2', arrangeId);

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
            const epsilon = CONSTANTS.LAYOUT.POSITION_WRITE_EPSILON;
            if (Math.abs(prevX - newPos.x) > epsilon || Math.abs(prevY - newPos.y) > epsilon) {
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

    /**
     * 边几何一致性诊断日志 V3
     * 抽样检查边的 bezier 端点是否与节点 bbox 锚点一致
     * 用于诊断"放大后错连恢复正常"问题
     * 
     * V2 增强：
     * - sampleCount：实际抽样数
     * - 端点可见性分桶：dom-dom / dom-virtual / virtual-virtual
     * - 锚点偏移校准：rawErr vs adjErr(扣除7px side offset)
     * - before/after 对比：improvedEdges / worseEdges / unchangedEdges
     * 
     * V3 增强：
     * - 真实DOM状态分桶：visible-visible / visible-zero / zero-zero / missing-*
     * - 新增 confidence（visible-visible 占比）
     * - sample 里带 endpoint DOM 状态
     */
    private logEdgeGeometryDiagnostics(
        canvas: CanvasLike,
        allNodes: Map<string, CanvasNodeLike>,
        tag: string,
        contextId?: string,
        prevDiagnostics?: EdgeGeomDiagnostics
    ): void {
        const edges = this.getCanvasEdges(canvas);
        if (edges.length === 0) {
            log(`[Layout] EdgeGeom(${tag}): edges=0, ctx=${contextId || 'none'}`);
            return;
        }

        const fileEdges = Array.isArray((canvas as any)?.fileData?.edges) ? ((canvas as any).fileData.edges as Array<Record<string, unknown>>) : [];
        const fileEdgeMap = new Map<string, Record<string, unknown>>();
        for (const edge of fileEdges) {
            const edgeId = typeof edge.id === 'string' ? edge.id : undefined;
            if (edgeId) fileEdgeMap.set(edgeId, edge);
        }

        // 抽样前20条边
        const sampleEdges = edges.slice(0, 20);
        let mismatchCount = 0;
        let maxFromErr = 0;
        let maxToErr = 0;
        let totalFromErr = 0;
        let totalToErr = 0;
        
        // V2: 可见性分桶统计（基于视口推断）
        let domDomCount = 0;
        let domVirtualCount = 0;
        let virtualVirtualCount = 0;
        
        // V3: 真实DOM状态分桶
        let domVisibleVisibleCount = 0;
        let domVisibleZeroCount = 0;
        let domZeroZeroCount = 0;
        let domMissingFromCount = 0;
        let domMissingToCount = 0;
        
        // V2: 锚点偏移校准（扣除7px side offset）
        let adjustedMismatchCount = 0;
        let totalAdjFromErr = 0;
        let totalAdjToErr = 0;
        
        // V2: before/after 对比（需要存储当前边的误差用于比较）
        const edgeErrors: Map<string, { fromErr: number; toErr: number }> = new Map();
        
        const samples: string[] = [];
        const endpointTruthSamples: string[] = [];

        // 获取视口信息用于判断虚拟化
        // [修复] 使用 zoomScaleAbs 避免负 zoom 污染 viewport 统计
        const zoomRaw = Number((canvas as any).zoom || 1);
        const zoomScaleAbs = Number.isFinite(zoomRaw) && zoomRaw !== 0 ? Math.abs(zoomRaw) : 1;
        const vpEl = document.querySelector('.canvas-wrapper') || document.querySelector('.canvas-viewport');
        const vpRect = vpEl?.getBoundingClientRect();
        
        // V3: 获取节点真实DOM状态的辅助函数
        const getNodeDomState = (node: CanvasNodeLike): 'visible' | 'zero' | 'missing' => {
            if (!node) return 'missing';
            const nodeEl = (node as any).nodeEl;
            if (!nodeEl || !(nodeEl instanceof HTMLElement)) return 'missing';
            
            const display = window.getComputedStyle(nodeEl).display;
            if (display === 'none') return 'zero'; // 隐藏视为 zero
            
            const rectHeight = nodeEl.getBoundingClientRect().height;
            if (rectHeight > 0) return 'visible';
            return 'zero';
        };
        
        // 判断节点是否在视口内（考虑虚拟化）
        const isNodeInViewport = (node: CanvasNodeLike): boolean => {
            if (!vpRect) return true; // 无视口信息，默认可见
            const nodeBbox = (node as any).bbox;
            if (!nodeBbox) return false;
            // 简单判断：节点中心在视口内
            const centerX = (nodeBbox.minX + nodeBbox.maxX) / 2;
            const centerY = (nodeBbox.minY + nodeBbox.maxY) / 2;
            // 考虑缩放 - 使用 zoomScaleAbs（正值）避免负 zoom 污染
            return centerX * zoomScaleAbs >= vpRect.left && centerX * zoomScaleAbs <= vpRect.right &&
                   centerY * zoomScaleAbs >= vpRect.top && centerY * zoomScaleAbs <= vpRect.bottom;
        };

        for (const edge of sampleEdges) {
            const fromId = getNodeIdFromEdgeEndpoint(edge.from) || this.toStringId(edge.fromNode);
            const toId = getNodeIdFromEdgeEndpoint(edge.to) || this.toStringId(edge.toNode);

            if (!fromId || !toId) continue;

            const fromNode = allNodes.get(fromId);
            const toNode = allNodes.get(toId);

            if (!fromNode || !toNode) continue;

            // V3: 获取真实DOM状态
            const fromDomState = getNodeDomState(fromNode);
            const toDomState = getNodeDomState(toNode);
            
            // V3: 真实DOM状态分桶
            if (fromDomState === 'visible' && toDomState === 'visible') {
                domVisibleVisibleCount++;
            } else if (fromDomState === 'visible' && toDomState === 'zero') {
                domVisibleZeroCount++;
            } else if (fromDomState === 'zero' && toDomState === 'visible') {
                domVisibleZeroCount++;
            } else if (fromDomState === 'zero' && toDomState === 'zero') {
                domZeroZeroCount++;
            } else if (fromDomState === 'missing') {
                domMissingFromCount++;
            } else if (toDomState === 'missing') {
                domMissingToCount++;
            }

            // 获取边的 bezier 端点
            const bezierFrom = (edge as any).bezier?.from;
            const bezierTo = (edge as any).bezier?.to;

            // 计算预期锚点（基于 fromSide/toSide）
            const fromSide = edge.fromSide || (typeof edge.from === 'object' ? (edge.from as any).side : undefined) || 'right';
            const toSide = edge.toSide || (typeof edge.to === 'object' ? (edge.to as any).side : undefined) || 'left';

            const fromBbox = (fromNode as any).bbox;
            const toBbox = (toNode as any).bbox;

            if (!fromBbox || !toBbox) continue;

            const expectedFrom = this.calculateAnchorPoint(fromBbox, fromSide);
            const expectedTo = this.calculateAnchorPoint(toBbox, toSide);

            const fromErr = bezierFrom ? Math.hypot(bezierFrom.x - expectedFrom.x, bezierFrom.y - expectedFrom.y) : 0;
            const toErr = bezierTo ? Math.hypot(bezierTo.x - expectedTo.x, bezierTo.y - expectedTo.y) : 0;

            // V2: 计算调整后的误差（扣除7px的side offset）
            // Obsidian 边锚点有固定的 7px 内缩偏移
            const sideOffset = 7;
            const adjFromErr = Math.max(0, fromErr - sideOffset);
            const adjToErr = Math.max(0, toErr - sideOffset);

            // V2: 可见性分桶（基于视口推断）
            const fromInVp = isNodeInViewport(fromNode);
            const toInVp = isNodeInViewport(toNode);
            if (fromInVp && toInVp) {
                domDomCount++;
            } else if (!fromInVp && !toInVp) {
                virtualVirtualCount++;
            } else {
                domVirtualCount++;
            }

            // V2: 调整后误差统计
            if (adjFromErr > 5 || adjToErr > 5) adjustedMismatchCount++;
            totalAdjFromErr += adjFromErr;
            totalAdjToErr += adjToErr;

            if (fromErr > 5 || toErr > 5) mismatchCount++;
            if (fromErr > maxFromErr) maxFromErr = fromErr;
            if (toErr > maxToErr) maxToErr = toErr;
            totalFromErr += fromErr;
            totalToErr += toErr;

            // V2: 存储误差用于后续比较
            edgeErrors.set(edge.id || `${fromId}-${toId}`, { fromErr, toErr });

            // V3: sample 包含 DOM 状态
            if (samples.length < 3) {
                samples.push(`${fromId?.slice(0, 6)}(${fromDomState})->${toId?.slice(0, 6)}(${toDomState}): err=${fromErr.toFixed(1)}/${toErr.toFixed(1)}`);
            }

            if (endpointTruthSamples.length < 3 && edge.id) {
                const fileEdge = fileEdgeMap.get(edge.id);
                const fileFromId = this.toStringId(fileEdge?.fromNode) || this.toStringId(getNodeIdFromEdgeEndpoint(fileEdge?.from)) || 'unknown';
                const fileToId = this.toStringId(fileEdge?.toNode) || this.toStringId(getNodeIdFromEdgeEndpoint(fileEdge?.to)) || 'unknown';
                const memFromId = this.toStringId(edge.fromNode) || this.toStringId(getNodeIdFromEdgeEndpoint(edge.from)) || 'unknown';
                const memToId = this.toStringId(edge.toNode) || this.toStringId(getNodeIdFromEdgeEndpoint(edge.to)) || 'unknown';
                endpointTruthSamples.push(`${edge.id}:${fileFromId}->${fileToId}|mem=${memFromId}->${memToId}`);
            }
        }

        const sampleCount = sampleEdges.length;
        const avgFromErr = sampleCount > 0 ? totalFromErr / sampleCount : 0;
        const avgToErr = sampleCount > 0 ? totalToErr / sampleCount : 0;
        
        // V2: 调整后的平均值
        const avgAdjFromErr = sampleCount > 0 ? totalAdjFromErr / sampleCount : 0;
        const avgAdjToErr = sampleCount > 0 ? totalAdjToErr / sampleCount : 0;

        // V3: 计算 confidence（visible-visible 占比）
        const confidence = sampleCount > 0 ? (domVisibleVisibleCount / sampleCount * 100).toFixed(1) : '0.0';
        const confidenceNum = Number(confidence);
        const confidenceFlag = confidenceNum < 40 ? 'LOW_CONFIDENCE' : 'OK';
        
        // V2: before/after 对比
        let improvedEdges = 0;
        let worseEdges = 0;
        let unchangedEdges = 0;
        if (prevDiagnostics) {
            for (const [edgeId, currErr] of edgeErrors.entries()) {
                const prevErr = prevDiagnostics.edgeErrors?.get(edgeId);
                if (prevErr) {
                    const currTotal = currErr.fromErr + currErr.toErr;
                    const prevTotal = prevErr.fromErr + prevErr.toErr;
                    if (currTotal < prevTotal - 1) {
                        improvedEdges++;
                    } else if (currTotal > prevTotal + 1) {
                        worseEdges++;
                    } else {
                        unchangedEdges++;
                    }
                }
            }
        }

        log(`[Layout] EdgeGeomV3(${tag}): edges=${edges.length}, sample=${sampleCount}, zoom=${zoomScaleAbs.toFixed(2)}, ` +
            `mismatch=${mismatchCount}(adj=${adjustedMismatchCount}), ` +
            `maxFromErr=${maxFromErr.toFixed(1)}, maxToErr=${maxToErr.toFixed(1)}, ` +
            `avgFromErr=${avgFromErr.toFixed(1)}, avgToErr=${avgToErr.toFixed(1)}, ` +
            `adjAvgFromErr=${avgAdjFromErr.toFixed(1)}, adjAvgToErr=${avgAdjToErr.toFixed(1)}, ` +
            // V2: 视口推断分桶
            `vpBuckets=domDom${domDomCount}/domVir${domVirtualCount}/virVir${virtualVirtualCount}, ` +
            // V3: 真实DOM状态分桶
            `domBuckets=visVis${domVisibleVisibleCount}/visZero${domVisibleZeroCount}/zeroZero${domZeroZeroCount}/missing${domMissingFromCount + domMissingToCount}, ` +
            `confidence=${confidence}%(${confidenceFlag}), ` +
            `delta=improve${improvedEdges}/worse${worseEdges}/unchanged${unchangedEdges}, ` +
            `sample=${samples.join(' | ')}, endpointTruth=${endpointTruthSamples.join(' | ') || 'none'}, ctx=${contextId || 'none'}`);
    }

    /**
     * 根据边侧计算锚点
     */
    private calculateAnchorPoint(bbox: { minX: number; minY: number; maxX: number; maxY: number }, side: string): { x: number; y: number } {
        switch (side) {
            case 'top':
                return { x: (bbox.minX + bbox.maxX) / 2, y: bbox.minY };
            case 'bottom':
                return { x: (bbox.minX + bbox.maxX) / 2, y: bbox.maxY };
            case 'left':
                return { x: bbox.minX, y: (bbox.minY + bbox.maxY) / 2 };
            case 'right':
            default:
                return { x: bbox.maxX, y: (bbox.minY + bbox.maxY) / 2 };
        }
    }

    private mergeMemoryEdgesIntoFileData(
        canvasData: CanvasDataLike,
        memoryEdges: CanvasEdgeLike[],
        contextId?: string
    ): boolean {
        if (!Array.isArray(canvasData.edges)) return false;
        let changed = false;
        let addedCount = 0;
        let updatedCount = 0;
        const fileEdgeIds = new Set(canvasData.edges.map((e) => e.id).filter((id): id is string => typeof id === 'string'));
        
        // 构建文件边索引，用于快速查找
        const fileEdgeMap = new Map<string, CanvasEdgeLike>();
        for (const fileEdge of canvasData.edges) {
            if (fileEdge.id) fileEdgeMap.set(fileEdge.id, fileEdge);
        }

        for (const memEdge of memoryEdges) {
            if (!memEdge.id) continue;
            
            const fileEdge = fileEdgeMap.get(memEdge.id);
            const memSerialized = this.serializeEdge(memEdge);

            if (!fileEdge) {
                // 新增边
                canvasData.edges.push(memSerialized as CanvasEdgeLike);
                changed = true;
                addedCount++;
            } else {
                // 检查是否需要更新（边端点变化）
                const memFromNode = this.toStringId(memEdge.fromNode) || this.toStringId(getNodeIdFromEdgeEndpoint(memEdge.from));
                const memToNode = this.toStringId(memEdge.toNode) || this.toStringId(getNodeIdFromEdgeEndpoint(memEdge.to));
                const memFromSide = this.toStringId(memEdge.fromSide) || (typeof memEdge.from === 'object' ? (memEdge.from as any).side : undefined);
                const memToSide = this.toStringId(memEdge.toSide) || (typeof memEdge.to === 'object' ? (memEdge.to as any).side : undefined);

                const fileFromNode = this.toStringId(fileEdge.fromNode) || this.toStringId(getNodeIdFromEdgeEndpoint(fileEdge.from));
                const fileToNode = this.toStringId(fileEdge.toNode) || this.toStringId(getNodeIdFromEdgeEndpoint(fileEdge.to));
                const fileFromSide = this.toStringId(fileEdge.fromSide) || (typeof fileEdge.from === 'object' ? (fileEdge.from as any).side : undefined);
                const fileToSide = this.toStringId(fileEdge.toSide) || (typeof fileEdge.to === 'object' ? (fileEdge.to as any).side : undefined);

                // 如果任一端点或侧边变化，则更新
                if (memFromNode !== fileFromNode || memToNode !== fileToNode ||
                    memFromSide !== fileFromSide || memToSide !== fileToSide) {
                    // 更新文件边
                    fileEdge.fromNode = memSerialized.fromNode as string;
                    fileEdge.toNode = memSerialized.toNode as string;
                    fileEdge.fromSide = memSerialized.fromSide as string;
                    fileEdge.toSide = memSerialized.toSide as string;
                    fileEdge.fromEnd = memSerialized.fromEnd;
                    fileEdge.toEnd = memSerialized.toEnd;
                    if (memSerialized.color) fileEdge.color = memSerialized.color as string;
                    if (memSerialized.label) fileEdge.label = memSerialized.label as string;
                    changed = true;
                    updatedCount++;
                }
            }
        }

        if (addedCount > 0 || updatedCount > 0) {
            log(`[Layout] MergeEdges: added=${addedCount}, updated=${updatedCount}, unchanged=${memoryEdges.length - addedCount - updatedCount}, memory=${memoryEdges.length}, file=${canvasData.edges.length}, ctx=${contextId || 'none'}`);
        }
        return changed;
    }
}
