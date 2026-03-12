import { App, ItemView, Notice, Platform, Plugin, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../settings/types';
import { CollapseStateManager } from '../state/collapse-state';
import { DeleteConfirmationModal } from '../ui/delete-modal';
import { DeleteEdgeConfirmationModal } from '../ui/delete-edge-modal';
import { FloatingNodeService } from './services/floating-node-service';
import { CanvasManager } from './canvas-manager';
import { isVerboseCanvasDiagnosticsLoggingEnabled, log, logVerbose } from '../utils/logger';
import { CONSTANTS } from '../constants';

import {
    getCanvasView,
    getActiveCanvasView,
    describeCanvasSelectionState,
    getSelectedEdge,
    extractEdgeNodeIds,
    buildEdgeIdSet,
    detectNewEdges,
    getDirectSelectedNodes,
    getCanvasSelectionSummary,
    getEdgesFromCanvas,
    getEdgesFromCanvasOrFileData,
    getNodesFromCanvas,
    findZoomToFitButton,
    tryZoomToSelection,
    getSelectedNodeFromCanvas,
    findDeleteButton,
    findCanvasNodeElementFromTarget,
    isCanvasEdgeConnectGestureTarget,
    isCanvasNativeInsertGestureTarget,
    shouldBypassCanvasNodeGestureTarget,
    clearCanvasEdgeSelection,
    getCanvasNodeByElement,
    parseFromLink,
    withTemporaryCanvasSelection
} from '../utils/canvas-utils';
import { CanvasLike, CanvasNodeLike, CanvasEdgeLike, CanvasViewLike, MarkdownViewLike, PluginWithLastClicked } from './types';
import { VisibilityService } from './services/visibility-service';
import { requestCanvasUpdate, setActiveLeafSafe } from './adapters/canvas-runtime-adapter';
import {
    clearEdgeSelectionState,
    clearNodeSelectionState,
    getPrimarySelectedEdgeFromState,
    getSelectedEdgeCountFromState,
    setSingleSelectedEdgeState,
} from './adapters/canvas-selection-adapter';

type FromLinkInfo = {
    file: string;
    from: { line: number; ch: number };
    to: { line: number; ch: number };
};

type PointerGestureSnapshot = {
    pointerId: number;
    pointerType: string;
    nodeId: string | null;
    targetKind: string;
    startTarget: string;
    startChain: string;
    startSelection: string;
    startX: number;
    startY: number;
    moved: boolean;
    wasSelectedBeforeDown: boolean;
    at: number;
};

type TouchDragScrollOwnerSnapshot = {
    el: HTMLElement;
    overflowY: string;
    overflowYPriority: string;
    webkitOverflowScrolling: string;
    webkitOverflowScrollingPriority: string;
    overscrollBehavior: string;
    overscrollBehaviorPriority: string;
};

type PenLongPressSnapshot = {
    pointerId: number;
    nodeId: string | null;
    startedAt: number;
    timerId: number | null;
    triggered: boolean;
};

type NativeInsertSession = {
    pointerId: number;
    pointerType: string;
    startReason: string;
    startedAt: number;
    lastSeenAt: number;
    traceId: string;
    targetKind: string;
    anchorNodeId: string | null;
    startTarget: string;
    startChain: string;
    startSelection: string;
    downDefaultPrevented: boolean;
    initialNodeCount: number;
    initialPlaceholderCount: number;
    initialWrapperStyle: string;
    wrapperDragSeen: boolean;
    placeholderSeen: boolean;
    nodeCreateSeen: boolean;
    placeholderAddedCount: number;
    placeholderRemovedCount: number;
    domNodeAddedCount: number;
    domNodeRemovedCount: number;
};

type NativeInsertPendingCommit = {
    traceId: string;
    pointerType: string;
    startReason: string;
    targetKind: string;
    anchorNodeId: string | null;
    initialNodeCount: number;
    initialPlaceholderCount: number;
    nodeDelta: number;
    placeholderDelta: number;
    endReason: string;
    endedAt: number;
    engineAttempted: boolean;
};

type CanvasGraphSnapshot = {
    nodeCount: number;
    edgeCount: number;
};

export class CanvasEventManager {
    private plugin: Plugin;
    private app: App;
    private settings: CanvasMindmapBuildSettings;
    private collapseStateManager: CollapseStateManager;
    private floatingNodeService: FloatingNodeService;
    private canvasManager: CanvasManager;
    private mutationObserver: MutationObserver | null = null;
    private focusMutationObserver: MutationObserver | null = null;
    private clickDebounceMap = new Map<string, number>();
    private mutationObserverRetryCount = 0;
    private readonly MAX_MUTATION_OBSERVER_RETRIES = 10;
    private isObserverSetup = false;
    private canvasChangeTimeoutId: number | null = null;
    private currentCanvasFilePath: string | null = null;
    private lastEdgeIds: Set<string> = new Set();
    private canvasFileModifyTimeoutId: number | null = null;
    private focusLostDebounceByNodeId: Map<string, number> = new Map();
    private lastFocusedNodeId: string | null = null;
    private isDeleting: boolean = false;
    private lastFromLinkNavAt: number = 0;
    private lastFromLinkNavKey: string = '';
    private lastOpenStabilizeKickAt: number = 0;
    private lastOpenStabilizeKickKey: string = '';
    private programmaticReloadSuppressUntilByFilePath: Map<string, number> = new Map();
    private readonly programmaticReloadDefaultHoldMs: number = 1800;
    private nodeMountedBatchTimeoutId: number | null = null;
    private nodeMountedPendingCount: number = 0;
    private nodeMountedPendingFilePath: string | null = null;
    private nodeMountedLastFlushAt: number = 0;
    private nodeMountedInteractionActiveUntil: number = 0;
    private nodeMountedOpenProtectionUntil: number = 0;
    private nodeMountedDelayByInteractionCount: number = 0;
    private nodeMountedDelayByCooldownCount: number = 0;
    private hasInteractionTrackerSetup: boolean = false;
    private readonly nodeMountedBatchDebounceMs: number = 180;
    private readonly nodeMountedCooldownMs: number = 900;
    private readonly nodeMountedInteractionIdleMs: number = 280;
    private readonly nodeMountedOpenProtectionMs: number = 1000;
    private hasPointerGestureGuardSetup: boolean = false;
    private activePointerGesture: PointerGestureSnapshot | null = null;
    private lastCompletedPointerGesture: PointerGestureSnapshot | null = null;
    private suppressFromLinkClickUntil: number = 0;
    private suppressFromLinkNodeId: string | null = null;
    private suppressFromLinkClickReason: string | null = null;
    private activeTouchDragSawCanvasNodeMove: boolean = false;
    private activeTouchDragNodeEl: HTMLElement | null = null;
    private activeTouchDragPointerId: number | null = null;
    private activeTouchDragScrollOwnerSnapshots: TouchDragScrollOwnerSnapshot[] = [];
    private activePenLongPress: PenLongPressSnapshot | null = null;
    private activeNativeInsertSession: NativeInsertSession | null = null;
    private pendingNativeInsertCommit: NativeInsertPendingCommit | null = null;
    private nativeInsertCommitInFlight: boolean = false;
    private lastNativeInsertCommitTraceId: string | null = null;
    private lastNativeInsertCommitAt: number = 0;
    private nativeInsertSideEffectsSuppressUntil: number = 0;
    private deferredPostInsertMaintenanceTimeoutId: number | null = null;
    private deferredMeasureNodeIds: Set<string> = new Set();
    private deferredAdjustNodeIds: Set<string> = new Set();
    private nativeInsertEngineRestoreFns: Array<() => void> = [];
    private suppressDeleteButtonClickUntil: number = 0;
    private suppressDeleteButtonClickReason: string | null = null;
    private edgeSelectionFallbackToken: number = 0;
    private lastEdgeSelectionFallbackKey: string = '';
    private lastEdgeSelectionFallbackAt: number = 0;
    private readonly touchDragArmedClass = 'cmb-touch-drag-armed';
    private readonly edgeSelectionFallbackSlowLogThresholdMs: number = 12;
    private readonly edgeSelectionFallbackDedupWindowMs: number = 120;
    private readonly touchDragScrollOwnerSelectors: string[] = [
        '.canvas-node-content',
        '.canvas-node-content .markdown-preview-view',
        '.canvas-node-content .markdown-preview-sizer'
    ];
    
    // [A2] 监听器防重日志
    private workspaceEventsRegistered: boolean = false;
    private workspaceEventsPath: string | null = null;
    private setupTokenCounter: number = 0;
    private isSettingUp: boolean = false;
    private lastSetupPath: string | null = null;
    private setupCallCount: number = 0;

    // [ViewportFix] Viewport 变化监听（屏幕旋转/分屏切换）
    private viewportChangeDebounceId: number | null = null;
    private lastViewportWidth: number = 0;
    private lastViewportHeight: number = 0;
    private isViewportListenerSetup: boolean = false;
    // [ViewportFix] 当 Canvas 在 viewport 变化期间不可用时，记录 pending 刷新
    private pendingViewportRefresh: boolean = false;
    private lastViewportChangeTrigger: string = '';
    private pendingViewportToken: number = 0;
    private pendingViewportTraceId: string = '';
    private viewportTokenCounter: number = 0;
    private activeViewportToken: number = 0;
    private viewportTraceSeq: number = 0;
    private viewportState: 'idle' | 'debouncing' | 'pending-canvas' | 'converging' | 'stable' = 'idle';
    private readonly viewportStablePassRequired: number = 2;


    constructor(
        plugin: Plugin,
        app: App,
        settings: CanvasMindmapBuildSettings,
        collapseStateManager: CollapseStateManager,
        canvasManager: CanvasManager
    ) {
        this.plugin = plugin;
        this.app = app;
        this.settings = settings;
        this.collapseStateManager = collapseStateManager;
        this.canvasManager = canvasManager;
        // 从 CanvasManager 获取 FloatingNodeService
        this.floatingNodeService = canvasManager.getFloatingNodeService();
    }

    /**
     * 初始化事件监听
     */
    async initialize() {
        log(`[Event] CanvasEventManager.initialize() 被调用`);
        this.registerEventListeners();
        this.setupPointerGestureGuard();
        this.setupInteractionTracker();
        // [ViewportFix] 注册 viewport 变化监听（屏幕旋转/分屏切换）
        this.setupViewportChangeListener();
        
        // 如果当前已经有 canvas 打开，立即启动 observer 和事件监听器
        const canvasView = getCanvasView(this.app);
        log(`[Event] getCanvasView() 返回: ${canvasView ? 'exists' : 'null'}`);
        if (canvasView) {
            log(`[Event] 立即设置 canvas 事件监听器`);
            await this.setupCanvasEventListeners(canvasView);
            this.setupMutationObserver();
        } else {
            log(`[Event] 当前没有打开的 canvas，等待 active-leaf-change 事件`);
        }
    }


    private registerEventListeners() {
        this.plugin.registerEvent(
            this.app.vault.on('modify', (file) => {
                if (!this.currentCanvasFilePath) return;
                if (file.path !== this.currentCanvasFilePath) return;
                if (this.canvasFileModifyTimeoutId !== null) {
                    window.clearTimeout(this.canvasFileModifyTimeoutId);
                }
                this.canvasFileModifyTimeoutId = window.setTimeout(() => {
                    this.canvasFileModifyTimeoutId = null;
                    void this.handleCanvasFileModified(file.path);
                }, CONSTANTS.TIMING.BUTTON_CHECK_DEBOUNCE);
            })
        );

        // 监听 Canvas 视图打开
        this.plugin.registerEvent(
            this.app.workspace.on('active-leaf-change', (leaf) => {
                void (async () => {
                    log(`[Event] active-leaf-change 触发, leaf=${leaf ? 'exists' : 'null'}, viewType=${leaf?.view?.getViewType() || 'null'}`);
                    if (leaf?.view?.getViewType() === 'canvas') {
                        log(`[Event] Canvas 视图打开，开始设置事件监听`);
                        
                        // [已移除] 健康检查会用估算值覆盖文件中Obsidian设置的准确minHeight值
                        // 导致与批量调整产生死循环：健康检查改成估算值 → 批量调整改回minHeight → 重新加载又被改成估算值
                        // 文件中的值本身就是历史准确值，应该保持不变，只通过批量调整和minHeight来更新
                        const canvasView = leaf.view as ItemView;

                        // 启动 MutationObserver
                        this.setupMutationObserver();
                        
                        if (canvasView) {
                            await this.setupCanvasEventListeners(canvasView);
                            // Canvas打开时立即检查并添加所有必要的DOM属性和按钮
                            setTimeout(() => {
                                void this.canvasManager.checkAndAddCollapseButtons();
                            }, CONSTANTS.TIMING.RENDER_DELAY);

                            // [OpenFix] Canvas 打开后触发轻量自愈，覆盖“重开后连线再次错位”的复发场景。
                            // 该流程仅修复视觉层 offset/edge，不写布局坐标。
                            const canvasFilePath = this.getCanvasFromView(canvasView)?.file?.path
                                || (canvasView as CanvasViewLike).file?.path
                                || null;
                            if (this.shouldSuppressOpenStabilization('active-leaf-change', canvasFilePath)) {
                                return;
                            }
                            this.markOpenProtectionWindow('active-leaf-change');
                            this.scheduleOpenStabilizationWithDedup('active-leaf-change', canvasFilePath);

                            // [ViewportFix] Canvas 重新激活时，检查是否有待处理的 viewport 刷新
                            // 场景：屏幕旋转时 Canvas 临时关闭，debounce 触发时 canvas 不可用，需要在重新激活后补充刷新
                            if (this.pendingViewportRefresh) {
                                const pendingTrigger = this.lastViewportChangeTrigger;
                                const pendingToken = this.pendingViewportToken || this.activeViewportToken;
                                const pendingTraceId = this.pendingViewportTraceId || this.createViewportTraceId('pending');
                                this.logViewportTrace(pendingTraceId, 'pending-resume', pendingToken, canvasView, {
                                    trigger: pendingTrigger,
                                    reason: 'canvas-reactivated'
                                });
                                this.pendingViewportRefresh = false;
                                // 额外等待 Canvas 完成自身初始化渲染后再刷新
                                const pendingDelay = Platform.isMobile
                                    ? CONSTANTS.TIMING.VIEWPORT_CHANGE_EXTRA_DELAY_MOBILE + 200
                                    : 300;
                                window.setTimeout(() => {
                                    const activeCanvas = this.getCanvasFromView(canvasView);
                                    if (!activeCanvas) {
                                        this.logViewportTrace(pendingTraceId, 'pending-skip', pendingToken, canvasView, {
                                            trigger: pendingTrigger,
                                            reason: 'canvas-unavailable-after-delay'
                                        });
                                        return;
                                    }
                                    const edges = getEdgesFromCanvas(activeCanvas);
                                    if (edges.length === 0) {
                                        this.logViewportTrace(pendingTraceId, 'pending-skip', pendingToken, canvasView, {
                                            trigger: pendingTrigger,
                                            reason: 'edges-empty'
                                        });
                                        return;
                                    }
                                    void this.convergeCanvasEdgesAfterViewportChange(
                                        activeCanvas,
                                        `viewport-pending-${pendingTrigger}`,
                                        pendingTraceId,
                                        pendingToken,
                                        canvasView
                                    );
                                }, pendingDelay);
                            }
                        }
                    }
                })();
            })
        );

        // [OpenFix-2] file-open 兜底触发：覆盖部分设备/路径下 active-leaf-change 未可靠触发的重开场景。
        this.plugin.registerEvent(
            this.app.workspace.on('file-open', (file) => {
                const filePath = file instanceof TFile ? file.path : 'null';
                const isCanvasFile = file instanceof TFile && (file.extension === 'canvas' || file.path.endsWith('.canvas'));
                log(`[Event] file-open 触发, file=${filePath}, isCanvas=${isCanvasFile}`);

                if (!isCanvasFile) return;

                window.setTimeout(() => {
                    const canvasView = getCanvasView(this.app);
                    if (!canvasView || canvasView.getViewType() !== 'canvas') {
                        log(`[Event] file-open skip: canvas view not ready, file=${filePath}`);
                        return;
                    }

                    this.setupMutationObserver();
                    void this.setupCanvasEventListeners(canvasView);
                    if (this.shouldSuppressOpenStabilization('file-open', filePath)) {
                        return;
                    }
                    this.markOpenProtectionWindow('file-open');
                    this.scheduleOpenStabilizationWithDedup('file-open', filePath);
                }, 120);
            })
        );

        // 节点点击处理
        const handleNodeClick = async (event: MouseEvent) => {
            const targetEl = event.target as HTMLElement;
            if (this.isDeleteOverlayInteractionTarget(targetEl)) {
                return;
            }

            const canvasView = getCanvasView(this.app);
            if (!canvasView) return;

            if (isCanvasNativeInsertGestureTarget(targetEl)) {
                const clickNativeInsertEvaluation = this.evaluateNativeInsertSessionStart('mouse', targetEl);
                if (!this.isNativeInsertSessionActive() && !clickNativeInsertEvaluation.allow) {
                    logVerbose(
                        `[Event] NativeInsertClickIgnored: reason=${clickNativeInsertEvaluation.reason}, ` +
                        `target=${this.describeEventTarget(targetEl)}, chain=${this.describeEventTargetChain(targetEl)}`
                    );
                    return;
                }

                if (this.isNativeInsertSessionActive()) {
                    this.touchNativeInsertSession(targetEl);
                    logVerbose(
                        `[Event] NativeInsertClickObserved: trace=${this.activeNativeInsertSession?.traceId || 'none'}, ` +
                        `target=${this.describeEventTarget(targetEl)}, chain=${this.describeEventTargetChain(targetEl)}, ` +
                        `flags=${this.describePointerEventState(event)}, selection=${this.describeCanvasSelection()}`
                    );
                } else {
                    logVerbose(
                        `[Event] NativeInsertClickPostSession: target=${this.describeEventTarget(targetEl)}, ` +
                        `chain=${this.describeEventTargetChain(targetEl)}, flags=${this.describePointerEventState(event)}, ` +
                        `selection=${this.describeCanvasSelection()}`
                    );
                    void this.flushPendingNativeInsertCommit('click-post-session');
                    this.scheduleNativeInsertSelectionProbe('click-post-session', 'click');
                }
                return;
            }

            if (this.isNativeInsertSessionActive()) {
                logVerbose(
                    `[Event] NativeInsertClickIgnored: target=${this.describeEventTarget(targetEl)}, ` +
                    `chain=${this.describeEventTargetChain(targetEl)}`
                );
                return;
            }
            
            const zoomToFitBtn = findZoomToFitButton(targetEl);
            if (zoomToFitBtn) {
                const handled = this.handleZoomToFitVisibleNodes();
                if (handled) {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                }
                return;
            }

            // 检查是否点击了删除按钮
            const deleteBtn = findDeleteButton(targetEl);
            if (deleteBtn) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();

                if (this.shouldSuppressDeleteButtonClick('click-capture')) {
                    return;
                }
                
                setTimeout(() => {
                    void this.handleDeleteButtonClick(canvasView);
                }, 0);
                return;
            }
            
            // 检查是否点击了折叠按钮
            const collapseBtn = targetEl.closest('.cmb-collapse-button');
            if (collapseBtn) {
                const nodeId = collapseBtn.getAttribute('data-node-id');
                if (nodeId) {
                    const isDirectButtonClick = targetEl.closest('.cmb-collapse-button') === collapseBtn;
                    if (isDirectButtonClick) {
                        await this.handleCollapseButtonClick(nodeId, event, canvasView);
                    }
                }
                return;
            }

            // 处理 fromLink 点击
            if (this.shouldSuppressFromLinkClick(targetEl)) {
                return;
            }
            await this.handleFromLinkClick(targetEl, canvasView);
        };

        this.plugin.registerDomEvent(document, 'click', handleNodeClick, { capture: true });
    }

    private setupInteractionTracker(): void {
        if (this.hasInteractionTrackerSetup) return;
        this.hasInteractionTrackerSetup = true;

        const markActive = (reason: string) => {
            const now = Date.now();
            const nextUntil = now + this.nodeMountedInteractionIdleMs;
            if (nextUntil > this.nodeMountedInteractionActiveUntil) {
                this.nodeMountedInteractionActiveUntil = nextUntil;
            }
            if (this.nodeMountedPendingCount > 0 && this.nodeMountedBatchTimeoutId === null) {
                this.scheduleNodeMountedBatchFlush(this.nodeMountedBatchDebounceMs, `interaction-${reason}`);
            }
        };

        this.plugin.registerDomEvent(document, 'pointerdown', () => markActive('pointerdown'), { capture: true, passive: true });
        this.plugin.registerDomEvent(document, 'pointermove', () => markActive('pointermove'), { capture: true, passive: true });
        this.plugin.registerDomEvent(document, 'wheel', () => markActive('wheel'), { capture: true, passive: true });
        this.plugin.registerDomEvent(document, 'touchmove', () => markActive('touchmove'), { capture: true, passive: true });
        this.plugin.registerDomEvent(window, 'scroll', () => markActive('scroll'), { capture: true, passive: true });
    }

    private setupPointerGestureGuard(): void {
        if (this.hasPointerGestureGuardSetup) return;
        this.hasPointerGestureGuardSetup = true;

        const shouldBypassNodeGesture = (eventTarget: EventTarget | null): boolean => {
            return eventTarget instanceof Element
                ? shouldBypassCanvasNodeGestureTarget(eventTarget)
                : false;
        };

        const resolveNodeElement = (eventTarget: EventTarget | null): HTMLElement | null => {
            if (!(eventTarget instanceof Element)) return null;
            if (shouldBypassNodeGesture(eventTarget)) return null;
            return findCanvasNodeElementFromTarget(eventTarget);
        };

        const resolveNodeId = (eventTarget: EventTarget | null): string | null => {
            const nodeEl = resolveNodeElement(eventTarget);
            if (!nodeEl) return null;
            return this.extractNodeIdFromElement(nodeEl);
        };

        const isNodeSelected = (eventTarget: EventTarget | null): boolean => {
            const nodeEl = resolveNodeElement(eventTarget);
            if (!nodeEl) return false;
            return nodeEl.classList.contains('is-selected') || nodeEl.classList.contains('is-focused');
        };

        this.plugin.registerDomEvent(document, 'pointerdown', (event: PointerEvent) => {
            const pointerType = event.pointerType || 'mouse';
            const pointerTargetKind = this.describeCanvasPointerTargetKind(event.target);
            if (this.isDeleteOverlayInteractionTarget(event.target)) {
                this.activePointerGesture = null;
                this.clearTouchDragNodeArm(event.pointerId);
                this.clearPenLongPress(event.pointerId);
                return;
            }

            if (shouldBypassNodeGesture(event.target)) {
                this.activePointerGesture = null;
                this.clearTouchDragNodeArm();
                this.clearPenLongPress();
                const isEdgeConnectTarget = event.target instanceof Element && isCanvasEdgeConnectGestureTarget(event.target);
                const nativeInsertEvaluation = this.evaluateNativeInsertSessionStart(pointerType, event.target);
                if (nativeInsertEvaluation.allow && event.target instanceof Element) {
                    this.startNativeInsertSession(
                        event.pointerId,
                        pointerType,
                        event.target,
                        event,
                        nativeInsertEvaluation.reason
                    );
                } else if (isEdgeConnectTarget) {
                    logVerbose(
                        `[Event] EdgeConnectGestureObserved: pointer=${pointerType}, target=${this.describeEventTarget(event.target)}, ` +
                        `chain=${this.describeEventTargetChain(event.target)}, flags=${this.describePointerEventState(event)}, ` +
                        `selection=${this.describeCanvasSelection()}`
                    );
                } else if (nativeInsertEvaluation.candidate) {
                    logVerbose(
                        `[Event] NativeInsertCandidateRejected: pointer=${pointerType}, reason=${nativeInsertEvaluation.reason}, ` +
                        `targetKind=${nativeInsertEvaluation.targetKind}, target=${this.describeEventTarget(event.target)}, ` +
                        `chain=${this.describeEventTargetChain(event.target)}, flags=${this.describePointerEventState(event)}, ` +
                        `selection=${this.describeCanvasSelection()}`
                    );
                }
                if (this.isTouchLikePointer(pointerType)) {
                    let bypassReason = 'other';
                    if (isEdgeConnectTarget) {
                        bypassReason = 'edge-connect';
                    } else if (nativeInsertEvaluation.allow) {
                        bypassReason = 'native-insert';
                    } else if (nativeInsertEvaluation.candidate) {
                        bypassReason = `native-insert-rejected:${nativeInsertEvaluation.reason}`;
                    }
                    logVerbose(
                        `[Event] DragPointerBypass: pointer=${pointerType}, reason=${bypassReason}, target=${this.describeEventTarget(event.target)}, ` +
                        `chain=${this.describeEventTargetChain(event.target)}, flags=${this.describePointerEventState(event)}`
                    );
                }
                return;
            }

            const deleteBtn = event.target instanceof Element ? findDeleteButton(event.target) : null;
            if (deleteBtn) {
                this.activePointerGesture = null;
                this.clearTouchDragNodeArm();
                this.clearPenLongPress();
                this.markSuppressDeleteButtonClick(320, `pointerdown:${pointerType}`);
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                return;
            }

            const nodeEl = resolveNodeElement(event.target);
            const nodeId = resolveNodeId(event.target);
            const wasSelectedBeforeDown = isNodeSelected(event.target);
            const startSelection = this.describeCanvasSelection();

            if (nodeId) {
                this.clearStaleEdgeSelectionForNodeInteraction(`pointerdown:${pointerType}`);
                this.rememberNodeInteractionContext(nodeId, `pointerdown:${pointerType}`);
            }

            if (this.isCanvasSurfaceInteractionTarget(event.target)) {
                this.ensureNativeInsertDiagnosticsInstalled();
            }

            if (this.isTouchPointer(pointerType) && nodeEl) {
                this.armTouchDragNode(nodeEl, event.pointerId);
                this.activeTouchDragSawCanvasNodeMove = false;
            } else {
                this.clearTouchDragNodeArm();
            }

            if (this.isPenPointer(pointerType)) {
                this.armPenLongPress(event.pointerId, nodeId);
            } else {
                this.clearPenLongPress();
            }

            if (this.isTouchLikePointer(pointerType) && nodeEl) {
                logVerbose(
                    `[Event] DragPointerDown: node=${nodeId || 'unknown'}, pointer=${pointerType}, ` +
                    `selected=${wasSelectedBeforeDown}, blocker=${this.isContentBlockerTarget(event.target)}, ` +
                    `target=${this.describeEventTarget(event.target)}, ` +
                    `chain=${this.describeEventTargetChain(event.target)}, owners=${this.getTouchDragScrollOwners(nodeEl).length}`
                );
            } else if (this.isTouchLikePointer(pointerType) && this.isCanvasSurfaceInteractionTarget(event.target)) {
                logVerbose(
                    `[Event] CanvasSurfacePointerDown: pointer=${pointerType}, kind=${pointerTargetKind}, ` +
                    `nativeInsertCandidate=${event.target instanceof Element && isCanvasNativeInsertGestureTarget(event.target)}, ` +
                    `selection=${startSelection}, target=${this.describeEventTarget(event.target)}, ` +
                    `chain=${this.describeEventTargetChain(event.target)}, flags=${this.describePointerEventState(event)}`
                );
            }

            this.activePointerGesture = {
                pointerId: event.pointerId,
                pointerType,
                nodeId,
                targetKind: pointerTargetKind,
                startTarget: this.describeEventTarget(event.target),
                startChain: this.describeEventTargetChain(event.target),
                startSelection,
                startX: event.clientX,
                startY: event.clientY,
                moved: false,
                wasSelectedBeforeDown,
                at: Date.now()
            };
        }, { capture: true, passive: false });

        this.plugin.registerDomEvent(document, 'pointermove', (event: PointerEvent) => {
            if (this.isDeleteOverlayInteractionTarget(event.target)) {
                return;
            }

            if (this.isNativeInsertSessionActive(event.pointerId)) {
                this.touchNativeInsertSession(event.target);
                return;
            }

            const gesture = this.activePointerGesture;
            if (!gesture || gesture.pointerId !== event.pointerId) return;

            if (gesture.moved) return;
            const dx = Math.abs(event.clientX - gesture.startX);
            const dy = Math.abs(event.clientY - gesture.startY);
            const moveThreshold = this.getMoveThresholdForPointer(gesture.pointerType);
            if (Math.max(dx, dy) >= moveThreshold) {
                gesture.moved = true;
                this.markSuppressFromLinkClick(
                    gesture.nodeId,
                    800,
                    this.isPenPointer(gesture.pointerType) ? 'pen-moved' : 'recent-drag'
                );
                this.clearPenLongPress(event.pointerId);
                if (this.isTouchLikePointer(gesture.pointerType)) {
                    if (gesture.nodeId) {
                        logVerbose(
                            `[Event] DragPointerMove: node=${gesture.nodeId || 'unknown'}, pointer=${gesture.pointerType}, ` +
                            `dx=${dx.toFixed(1)}, dy=${dy.toFixed(1)}, threshold=${moveThreshold}`
                        );
                    } else if (this.isCanvasSurfaceInteractionTarget(event.target)) {
                        logVerbose(
                            `[Event] CanvasSurfacePointerMove: pointer=${gesture.pointerType}, kind=${gesture.targetKind}, ` +
                            `dx=${dx.toFixed(1)}, dy=${dy.toFixed(1)}, threshold=${moveThreshold}, ` +
                            `selection=${this.describeCanvasSelection()}, target=${this.describeEventTarget(event.target)}, ` +
                            `chain=${this.describeEventTargetChain(event.target)}`
                        );
                    }
                }
            }
        }, { capture: true, passive: true });

        const finalizePointer = (event: PointerEvent) => {
            if (this.isDeleteOverlayInteractionTarget(event.target)) {
                this.activePointerGesture = null;
                this.clearPenLongPress(event.pointerId);
                this.clearTouchDragNodeArm(event.pointerId);
                this.activeTouchDragSawCanvasNodeMove = false;
                return;
            }

            const deleteBtn = event.target instanceof Element ? findDeleteButton(event.target) : null;
            if (deleteBtn) {
                this.activePointerGesture = null;
                this.clearPenLongPress(event.pointerId);
                this.clearTouchDragNodeArm(event.pointerId);
                this.activeTouchDragSawCanvasNodeMove = false;
                this.markSuppressDeleteButtonClick(400, `pointerup:${event.pointerType || 'mouse'}`);
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();

                const canvasView = getCanvasView(this.app);
                if (canvasView) {
                    window.setTimeout(() => {
                        this.handleDeleteButtonClick(canvasView);
                    }, 0);
                }
                return;
            }

            if (this.isNativeInsertSessionActive(event.pointerId)) {
                this.endNativeInsertSession(event.pointerId, event.type, event.target, event);
                this.clearPenLongPress(event.pointerId);
                this.clearTouchDragNodeArm(event.pointerId);
                this.activeTouchDragSawCanvasNodeMove = false;
                return;
            }

            const gesture = this.activePointerGesture;
            if (gesture && gesture.pointerId === event.pointerId) {
                const finishedAt = Date.now();
                this.lastCompletedPointerGesture = {
                    ...gesture,
                    at: finishedAt
                };

                if (gesture.moved) {
                    this.markSuppressFromLinkClick(
                        gesture.nodeId,
                        800,
                        this.isPenPointer(gesture.pointerType) ? 'pen-moved' : 'recent-drag'
                    );
                }

                if (this.isTouchLikePointer(gesture.pointerType)) {
                    const duration = finishedAt - gesture.at;
                    if (gesture.nodeId) {
                        logVerbose(
                            `[Event] DragPointerEnd: node=${gesture.nodeId || 'unknown'}, pointer=${gesture.pointerType}, ` +
                            `moved=${gesture.moved}, duration=${duration}ms, nodeMoveSeen=${this.activeTouchDragSawCanvasNodeMove}`
                        );
                        if (gesture.moved && !this.activeTouchDragSawCanvasNodeMove) {
                            logVerbose(
                                `[Event] DragPointerNoCanvasMove: node=${gesture.nodeId || 'unknown'}, pointer=${gesture.pointerType}, ` +
                                `reason=no-canvas-node-move, blocker=${this.isContentBlockerTarget(event.target)}, ` +
                                `target=${this.describeEventTarget(event.target)}, ` +
                                `chain=${this.describeEventTargetChain(event.target)}`
                            );
                        }
                    } else if (this.isCanvasSurfaceInteractionTarget(event.target)) {
                        logVerbose(
                            `[Event] CanvasSurfacePointerEnd: pointer=${gesture.pointerType}, kind=${gesture.targetKind}, ` +
                            `moved=${gesture.moved}, duration=${duration}ms, selectionStart=${gesture.startSelection}, ` +
                            `selectionEnd=${this.describeCanvasSelection()}, startTarget=${gesture.startTarget}, ` +
                            `endTarget=${this.describeEventTarget(event.target)}, startChain=${gesture.startChain}, ` +
                            `endChain=${this.describeEventTargetChain(event.target)}, flags=${this.describePointerEventState(event)}`
                        );

                        if (!gesture.moved && this.isCanvasEdgeSelectionTarget(event.target)) {
                            this.scheduleEdgeSelectionFallback(event.target, `pointerup:${gesture.pointerType}`);
                        }
                    }
                }

                this.activePointerGesture = null;
            }

            this.clearPenLongPress(event.pointerId);
            this.clearTouchDragNodeArm(event.pointerId);
            this.activeTouchDragSawCanvasNodeMove = false;
        };

        this.plugin.registerDomEvent(document, 'pointerup', finalizePointer, { capture: true, passive: false });
        this.plugin.registerDomEvent(document, 'pointercancel', finalizePointer, { capture: true, passive: false });
    }

    private shouldSuppressFromLinkClick(targetEl: HTMLElement): boolean {
        if (this.isNativeInsertSessionActive()) return false;
        if (shouldBypassCanvasNodeGestureTarget(targetEl)) return false;

        const nodeEl = findCanvasNodeElementFromTarget(targetEl);
        if (!nodeEl) return false;

        const nodeId = this.extractNodeIdFromElement(nodeEl);
        const now = Date.now();
        if (
            now < this.suppressFromLinkClickUntil
            && this.suppressFromLinkNodeId
            && this.suppressFromLinkNodeId === nodeId
        ) {
            logVerbose(`[Event] fromLink click suppressed: reason=${this.suppressFromLinkClickReason || 'recent-gesture'}, node=${nodeId || 'unknown'}`);
            return true;
        }

        const lastGesture = this.lastCompletedPointerGesture;
        if (!lastGesture) return false;
        if (now - lastGesture.at > CONSTANTS.TOUCH.FROM_LINK_SUPPRESS_MS_TOUCH_PEN) return false;
        if (lastGesture.nodeId !== nodeId) return false;

        const pointerType = lastGesture.pointerType;
        if (pointerType === CONSTANTS.TOUCH.TOUCH_POINTER_TYPE) {
            if (lastGesture.moved) {
                logVerbose(`[Event] fromLink click suppressed: reason=touch-moved, node=${nodeId || 'unknown'}`);
                return true;
            }

            if (!lastGesture.wasSelectedBeforeDown) {
                logVerbose(`[Event] fromLink click suppressed: reason=touch-first-tap-select, node=${nodeId || 'unknown'}`);
                return true;
            }

            logVerbose(`[Event] fromLink click suppressed: reason=touch-tap-reserved-for-drag, node=${nodeId || 'unknown'}`);
            return true;
        }

        if (pointerType === CONSTANTS.TOUCH.PEN_POINTER_TYPE) {
            if (lastGesture.moved) {
                logVerbose(`[Event] fromLink click suppressed: reason=pen-moved, node=${nodeId || 'unknown'}`);
                return true;
            }

            logVerbose(`[Event] fromLink click suppressed: reason=pen-short-tap-select-only, node=${nodeId || 'unknown'}`);
            return true;
        }

        return false;
    }

    private isTouchPointer(pointerType: string | null | undefined): boolean {
        return pointerType === CONSTANTS.TOUCH.TOUCH_POINTER_TYPE;
    }

    private isPenPointer(pointerType: string | null | undefined): boolean {
        return pointerType === CONSTANTS.TOUCH.PEN_POINTER_TYPE;
    }

    private isTouchLikePointer(pointerType: string | null | undefined): boolean {
        return this.isTouchPointer(pointerType) || this.isPenPointer(pointerType);
    }

    private isContentBlockerTarget(target: EventTarget | null): boolean {
        return target instanceof Element && target.classList.contains('canvas-node-content-blocker');
    }

    private describeEventTarget(target: EventTarget | null): string {
        if (!(target instanceof Element)) return 'non-element';
        const className = (target.getAttribute('class') || '').trim().replace(/\s+/g, '.');
        return `${target.tagName.toLowerCase()}${className ? '.' + className : ''}`;
    }

    private describeEventTargetChain(target: EventTarget | null, maxDepth = 5): string {
        if (!(target instanceof Element)) return 'non-element';

        const parts: string[] = [];
        let current: Element | null = target;
        let depth = 0;

        while (current && depth < maxDepth) {
            parts.push(this.describeEventTarget(current));
            current = current.parentElement;
            depth++;
        }

        return parts.join(' <- ');
    }

    private getMoveThresholdForPointer(pointerType: string | null | undefined): number {
        if (this.isPenPointer(pointerType)) {
            return CONSTANTS.TOUCH.MOVE_THRESHOLD_PEN;
        }
        if (this.isTouchPointer(pointerType)) {
            return CONSTANTS.TOUCH.MOVE_THRESHOLD_TOUCH;
        }
        return CONSTANTS.TOUCH.MOVE_THRESHOLD;
    }

    private markSuppressFromLinkClick(nodeId: string | null, holdMs: number, reason: string): void {
        this.suppressFromLinkClickUntil = Date.now() + Math.max(0, holdMs);
        this.suppressFromLinkNodeId = nodeId;
        this.suppressFromLinkClickReason = reason;
    }

    private armPenLongPress(pointerId: number, nodeId: string | null): void {
        this.clearPenLongPress();
        if (!nodeId) return;

        const startedAt = Date.now();
        const timerId = window.setTimeout(() => {
            void this.triggerPenLongPressNavigation(pointerId, nodeId, startedAt);
        }, CONSTANTS.TOUCH.PEN_LONG_PRESS_MS);

        this.activePenLongPress = {
            pointerId,
            nodeId,
            startedAt,
            timerId,
            triggered: false
        };
    }

    private clearPenLongPress(pointerId?: number): void {
        if (
            typeof pointerId === 'number'
            && this.activePenLongPress
            && this.activePenLongPress.pointerId !== pointerId
        ) {
            return;
        }

        const activePenLongPress = this.activePenLongPress;
        if (activePenLongPress?.timerId !== null && activePenLongPress?.timerId !== undefined) {
            window.clearTimeout(activePenLongPress.timerId);
        }

        this.activePenLongPress = null;
    }

    private rememberNodeInteractionContext(nodeId: string | null, reason: string, canvasView?: ItemView | null): void {
        if (!nodeId) return;

        const pluginWithContext = this.plugin as PluginWithLastClicked;
        const targetCanvasView = canvasView ?? getCanvasView(this.app);
        const canvasFilePath = targetCanvasView
            ? this.getCanvasFromView(targetCanvasView)?.file?.path || (targetCanvasView as CanvasViewLike).file?.path || null
            : null;

        const previousNodeId = pluginWithContext.lastClickedNodeId || null;
        const previousCanvasFilePath = pluginWithContext.lastClickedCanvasFilePath || null;

        pluginWithContext.lastClickedNodeId = nodeId;
        pluginWithContext.lastNavigationSourceNodeId = nodeId;
        if (canvasFilePath) {
            pluginWithContext.lastClickedCanvasFilePath = canvasFilePath;
        }

        if (previousNodeId !== nodeId || previousCanvasFilePath !== canvasFilePath) {
            logVerbose(
                `[Event] RememberNodeContext: reason=${reason}, node=${nodeId}, ` +
                `canvasFile=${canvasFilePath || 'none'}, prevNode=${previousNodeId || 'none'}, ` +
                `prevCanvasFile=${previousCanvasFilePath || 'none'}`
            );
        }
    }

    private clearStaleEdgeSelectionForNodeInteraction(reason: string, canvasView?: ItemView | null): void {
        const targetCanvasView = canvasView ?? getCanvasView(this.app);
        const canvas = targetCanvasView ? this.getCanvasFromView(targetCanvasView) : null;
        if (!canvas) return;

        const clearedState = clearCanvasEdgeSelection(canvas);
        if (!clearedState.cleared) return;

        logVerbose(
            `[Event] ClearStaleEdgeSelection: reason=${reason}, ` +
            `edges=${clearedState.clearedEdgeIds.join('|') || 'none'}, domCleared=${clearedState.domClearedCount}, ` +
            `selection=${this.describeCanvasSelection()}`
        );
    }

    private getCurrentCanvasInteractionNode(canvasView?: ItemView | null): CanvasNodeLike | null {
        const targetCanvasView = canvasView ?? getCanvasView(this.app);
        const canvas = targetCanvasView ? this.getCanvasFromView(targetCanvasView) : null;
        if (!canvas) return null;
        return getSelectedNodeFromCanvas(canvas);
    }

    private cancelFocusLostMeasurement(nodeId?: string | null): void {
        if (!nodeId) return;
        const timerId = this.focusLostDebounceByNodeId.get(nodeId);
        if (timerId === undefined) return;
        window.clearTimeout(timerId);
        this.focusLostDebounceByNodeId.delete(nodeId);
    }

    private scheduleFocusLostMeasurement(nodeId: string, reason: string): void {
        this.cancelFocusLostMeasurement(nodeId);

        if (this.shouldSuppressSideEffectsForNativeInsert()) {
            this.deferredMeasureNodeIds.add(nodeId);
            this.scheduleDeferredPostInsertMaintenance(`${reason}:${nodeId}`);
            logVerbose(`[Event] NativeInsertDeferredTrustedHeight: node=${nodeId}, reason=${reason}`);
            return;
        }

        const timerId = window.setTimeout(() => {
            this.focusLostDebounceByNodeId.delete(nodeId);
            void this.canvasManager.measureAndPersistTrustedHeight(nodeId);
        }, 500);

        this.focusLostDebounceByNodeId.set(nodeId, timerId);
    }

    private reconcileFocusedNodeContext(reason: string, canvasView?: ItemView | null): string | null {
        const targetCanvasView = canvasView ?? getCanvasView(this.app);
        const currentNode = this.getCurrentCanvasInteractionNode(targetCanvasView);
        const currentNodeId = currentNode?.id || null;
        if (!currentNodeId) return null;

        this.lastFocusedNodeId = currentNodeId;
        this.cancelFocusLostMeasurement(currentNodeId);
        this.clearStaleEdgeSelectionForNodeInteraction(reason, targetCanvasView);
        this.rememberNodeInteractionContext(currentNodeId, reason, targetCanvasView);
        return currentNodeId;
    }

    private isCanvasEdgeSelectionTarget(target: EventTarget | null): boolean {
        return target instanceof Element && !!target.closest(
            '.canvas-edge, .canvas-edge-line-group, .canvas-edge-label, .canvas-edges, .canvas-interaction-path, .canvas-display-path'
        );
    }

    private resolveEdgeFromTarget(target: EventTarget | null): CanvasEdgeLike | null {
        if (!(target instanceof Element)) return null;

        const canvasView = getCanvasView(this.app);
        const canvas = canvasView ? this.getCanvasFromView(canvasView) : null;
        if (!canvas) return null;

        const targetGroup = target.closest('g');
        for (const edge of getEdgesFromCanvas(canvas)) {
            const edgeRecord = edge as CanvasEdgeLike & {
                pathEl?: Element;
                interactiveEl?: Element;
            };
            const lineGroupEl = edge.lineGroupEl as Element | undefined;
            const lineEndGroupEl = edge.lineEndGroupEl as Element | undefined;
            const pathEl = edgeRecord.pathEl;
            const interactiveEl = edgeRecord.interactiveEl;

            if (
                target === lineGroupEl
                || target === lineEndGroupEl
                || target === pathEl
                || target === interactiveEl
            ) {
                return edge;
            }

            if (lineGroupEl?.contains(target) || lineEndGroupEl?.contains(target)) {
                return edge;
            }

            if (targetGroup && (targetGroup === lineGroupEl || targetGroup === lineEndGroupEl)) {
                return edge;
            }
        }

        return null;
    }

    private scheduleEdgeSelectionFallback(target: EventTarget | null, reason: string): void {
        if (!(target instanceof Element)) return;
        const targetEl = target;
        const canvasView = getCanvasView(this.app);
        const canvas = canvasView ? this.getCanvasFromView(canvasView) : null;
        const targetEdge = canvas ? this.resolveEdgeFromTarget(targetEl) : null;
        const edgeKey = targetEdge ? this.getEdgeSelectionFallbackKey(targetEdge) : this.describeEventTarget(targetEl);
        const dedupKey = `${reason}|${edgeKey}`;
        const now = Date.now();
        if (
            this.lastEdgeSelectionFallbackKey === dedupKey
            && now - this.lastEdgeSelectionFallbackAt < this.edgeSelectionFallbackDedupWindowMs
        ) {
            logVerbose(`[Event] EdgeSelectionFallbackDedup: reason=${reason}, status=skip-schedule-duplicate, edge=${edgeKey}`);
            return;
        }

        this.lastEdgeSelectionFallbackKey = dedupKey;
        this.lastEdgeSelectionFallbackAt = now;
        const scheduleToken = ++this.edgeSelectionFallbackToken;
        logVerbose(`[Event] EdgeSelectionFallbackDedup: reason=${reason}, status=scheduled, edge=${edgeKey}, token=${scheduleToken}`);

        requestAnimationFrame(() => {
            if (scheduleToken !== this.edgeSelectionFallbackToken) {
                logVerbose(`[Event] EdgeSelectionFallbackDedup: reason=${reason}, status=skip-stale-token, edge=${edgeKey}, token=${scheduleToken}`);
                return;
            }
            this.applyEdgeSelectionFallback(targetEl, `${reason}:raf`, scheduleToken);
        });
    }

    private applyEdgeSelectionFallback(targetEl: Element, reason: string, scheduleToken?: number): void {
        const startedAt = performance.now();
        if (!this.isCanvasEdgeSelectionTarget(targetEl)) return;

        const canvasView = getCanvasView(this.app);
        const canvas = canvasView ? this.getCanvasFromView(canvasView) : null;
        if (!canvas) return;
        if (!canvasView) return;

        const resolveStartedAt = performance.now();
        const edge = this.resolveEdgeFromTarget(targetEl);
        const resolveEdgeMs = performance.now() - resolveStartedAt;
        if (!edge) {
            log(
                `[Event] EdgeSelectionFallbackMiss: reason=${reason}, target=${this.describeEventTarget(targetEl)}, ` +
                `chain=${this.describeEventTargetChain(targetEl)}, selection=${this.describeCanvasSelection()}`
            );
            return;
        }

        const targetEdgeKey = this.getEdgeSelectionFallbackKey(edge);
        const selectedEdge = this.getDirectSelectedEdge(canvas);
        if (selectedEdge && this.isSameEdgeForFallback(selectedEdge, edge)) {
            this.ensureEdgeSelectionFallbackClasses(edge);
            this.syncSelectedEdgeState(canvas, edge);
            logVerbose(`[Event] EdgeSelectionFallbackDedup: reason=${reason}, status=skip-target-already-selected, edge=${targetEdgeKey}, token=${scheduleToken ?? 'na'}`);
            this.maybeLogEdgeSelectionFallbackPerf({
                reason,
                edgeKey: targetEdgeKey,
                scheduleToken,
                resolveEdgeMs,
                clearSelectionMs: 0,
                applySelectionMs: 0,
                totalMs: performance.now() - startedAt,
                nodeSelectionCount: this.getDirectSelectedNodeCount(canvas),
                edgeSelectionCount: this.getDirectSelectedEdgeCount(canvas),
                domNodeCleared: 0,
                domEdgeCleared: 0,
                status: 'already-selected'
            });
            return;
        }

        if (!selectedEdge && this.isEdgeSelectionFallbackDomSelected(edge)) {
            this.syncSelectedEdgeState(canvas, edge);
            logVerbose(`[Event] EdgeSelectionFallbackDedup: reason=${reason}, status=sync-dom-selected, edge=${targetEdgeKey}, token=${scheduleToken ?? 'na'}`);
            this.maybeLogEdgeSelectionFallbackPerf({
                reason,
                edgeKey: targetEdgeKey,
                scheduleToken,
                resolveEdgeMs,
                clearSelectionMs: 0,
                applySelectionMs: 0,
                totalMs: performance.now() - startedAt,
                nodeSelectionCount: this.getDirectSelectedNodeCount(canvas),
                edgeSelectionCount: 1,
                domNodeCleared: 0,
                domEdgeCleared: 0,
                status: 'sync-dom-selected'
            });
            return;
        }

        const nodeSelectionCount = this.getDirectSelectedNodeCount(canvas);
        const edgeSelectionCount = this.getDirectSelectedEdgeCount(canvas);

        const clearStartedAt = performance.now();
        this.clearDirectNodeSelectionState(canvas);
        const domNodeCleared = this.clearSelectionFallbackDomClasses(
            canvasView.contentEl,
            '.canvas-node.is-selected, .canvas-node.is-focused'
        );
        this.clearDirectEdgeSelectionState(canvas);
        const domEdgeCleared = this.clearSelectionFallbackDomClasses(
            canvasView.contentEl,
            '.canvas-edge-line-group.is-selected, .canvas-edge-line-group.is-focused, .canvas-edge.is-selected, .canvas-edge.is-focused'
        );
        const clearSelectionMs = performance.now() - clearStartedAt;

        const applyStartedAt = performance.now();
        this.syncSelectedEdgeState(canvas, edge);
        this.ensureEdgeSelectionFallbackClasses(edge);
        const applySelectionMs = performance.now() - applyStartedAt;
        const totalMs = performance.now() - startedAt;

        if (selectedEdge && !this.isSameEdgeForFallback(selectedEdge, edge)) {
            logVerbose(
                `[Event] EdgeSelectionFallbackDedup: reason=${reason}, status=replaced-selection, ` +
                `from=${this.getEdgeSelectionFallbackKey(selectedEdge)}, to=${targetEdgeKey}, token=${scheduleToken ?? 'na'}`
            );
        }

        const { fromId, toId } = extractEdgeNodeIds(edge);
        log(
            `[Event] EdgeSelectionFallbackApplied: reason=${reason}, edge=${edge.id || 'unknown'}, ` +
            `from=${fromId || 'unknown'}, to=${toId || 'unknown'}, clearedNodes=${nodeSelectionCount}, ` +
            `selection=${this.describeCanvasSelection()}`
        );
        this.maybeLogEdgeSelectionFallbackPerf({
            reason,
            edgeKey: targetEdgeKey,
            scheduleToken,
            resolveEdgeMs,
            clearSelectionMs,
            applySelectionMs,
            totalMs,
            nodeSelectionCount,
            edgeSelectionCount,
            domNodeCleared,
            domEdgeCleared,
            status: 'applied'
        });
    }

    private getDirectSelectedEdge(canvas: CanvasLike): CanvasEdgeLike | null {
        return getPrimarySelectedEdgeFromState(canvas);
    }

    private getDirectSelectedEdgeCount(canvas: CanvasLike): number {
        return getSelectedEdgeCountFromState(canvas);
    }

    private getDirectSelectedNodeCount(canvas: CanvasLike): number {
        return getDirectSelectedNodes(canvas).length;
    }

    private clearDirectNodeSelectionState(canvas: CanvasLike): void {
        clearNodeSelectionState(canvas);
    }

    private clearDirectEdgeSelectionState(canvas: CanvasLike): void {
        clearEdgeSelectionState(canvas);
    }

    private syncSelectedEdgeState(canvas: CanvasLike, edge: CanvasEdgeLike): void {
        setSingleSelectedEdgeState(canvas, edge);
    }

    private clearSelectionFallbackDomClasses(root: ParentNode | null | undefined, selector: string): number {
        if (!root) return 0;
        const elements = root.querySelectorAll(selector);
        let cleared = 0;
        for (const el of Array.from(elements)) {
            if (!(el instanceof Element)) continue;
            const hadSelected = el.classList.contains('is-selected') || el.classList.contains('is-focused');
            el.classList.remove('is-selected', 'is-focused');
            if (hadSelected) cleared++;
        }
        return cleared;
    }

    private isEdgeSelectionFallbackDomSelected(edge: CanvasEdgeLike): boolean {
        return !!(
            edge.lineGroupEl?.classList.contains('is-selected')
            || edge.lineGroupEl?.classList.contains('is-focused')
            || edge.lineEndGroupEl?.classList.contains('is-selected')
            || edge.lineEndGroupEl?.classList.contains('is-focused')
        );
    }

    private ensureEdgeSelectionFallbackClasses(edge: CanvasEdgeLike): void {
        edge.lineGroupEl?.classList.add('is-selected', 'is-focused');
        edge.lineEndGroupEl?.classList.add('is-selected');
        edge.lineEndGroupEl?.classList.remove('is-focused');
    }

    private getEdgeSelectionFallbackKey(edge: CanvasEdgeLike): string {
        const edgeId = edge.id;
        if (edgeId) return edgeId;
        const { fromId, toId } = extractEdgeNodeIds(edge);
        return `${fromId || 'unknown'}->${toId || 'unknown'}`;
    }

    private isSameEdgeForFallback(left: CanvasEdgeLike | null | undefined, right: CanvasEdgeLike | null | undefined): boolean {
        if (!left || !right) return false;
        if (left === right) return true;
        return this.getEdgeSelectionFallbackKey(left) === this.getEdgeSelectionFallbackKey(right);
    }

    private maybeLogEdgeSelectionFallbackPerf(params: {
        reason: string;
        edgeKey: string;
        scheduleToken?: number;
        resolveEdgeMs: number;
        clearSelectionMs: number;
        applySelectionMs: number;
        totalMs: number;
        nodeSelectionCount: number;
        edgeSelectionCount: number;
        domNodeCleared: number;
        domEdgeCleared: number;
        status: 'applied' | 'already-selected' | 'sync-dom-selected';
    }): void {
        const shouldLogSlow = params.totalMs >= this.edgeSelectionFallbackSlowLogThresholdMs;
        const shouldLogVerbose = isVerboseCanvasDiagnosticsLoggingEnabled();
        if (!shouldLogSlow && !shouldLogVerbose) return;

        const message =
            `[Event] EdgeFallbackPerf: reason=${params.reason}, status=${params.status}, edge=${params.edgeKey}, ` +
            `token=${params.scheduleToken ?? 'na'}, selectedNodes=${params.nodeSelectionCount}, ` +
            `selectedEdges=${params.edgeSelectionCount}, domNodeCleared=${params.domNodeCleared}, ` +
            `domEdgeCleared=${params.domEdgeCleared}, resolve=${params.resolveEdgeMs.toFixed(2)}ms, ` +
            `clear=${params.clearSelectionMs.toFixed(2)}ms, apply=${params.applySelectionMs.toFixed(2)}ms, ` +
            `total=${params.totalMs.toFixed(2)}ms`;

        if (shouldLogSlow) {
            log(message);
            return;
        }

        logVerbose(message);
    }

    private async triggerPenLongPressNavigation(pointerId: number, nodeId: string | null, startedAt: number): Promise<void> {
        const activePenLongPress = this.activePenLongPress;
        const activeGesture = this.activePointerGesture;
        if (!activePenLongPress || activePenLongPress.pointerId !== pointerId || activePenLongPress.nodeId !== nodeId) {
            return;
        }
        if (!activeGesture || activeGesture.pointerId !== pointerId || activeGesture.nodeId !== nodeId || activeGesture.moved) {
            return;
        }

        activePenLongPress.triggered = true;
        activePenLongPress.timerId = null;
        this.markSuppressFromLinkClick(nodeId, CONSTANTS.TOUCH.PEN_LONG_PRESS_CLICK_SUPPRESS_MS, 'pen-long-press');
        log(`[Event] PenLongPressNavigate: node=${nodeId || 'unknown'}, duration=${Date.now() - startedAt}ms`);
        await this.handleFromLinkNavigationByNodeId(nodeId);
    }

    private armTouchDragNode(nodeEl: HTMLElement, pointerId: number): void {
        if (this.activeTouchDragNodeEl === nodeEl && this.activeTouchDragPointerId === pointerId) {
            return;
        }

        this.clearTouchDragNodeArm();

        this.activeTouchDragNodeEl = nodeEl;
        this.activeTouchDragPointerId = pointerId;
        nodeEl.classList.add(this.touchDragArmedClass);

        const owners = this.getTouchDragScrollOwners(nodeEl);
        this.activeTouchDragScrollOwnerSnapshots = owners.map((el) => ({
            el,
            overflowY: el.style.getPropertyValue('overflow-y'),
            overflowYPriority: el.style.getPropertyPriority('overflow-y'),
            webkitOverflowScrolling: el.style.getPropertyValue('-webkit-overflow-scrolling'),
            webkitOverflowScrollingPriority: el.style.getPropertyPriority('-webkit-overflow-scrolling'),
            overscrollBehavior: el.style.getPropertyValue('overscroll-behavior'),
            overscrollBehaviorPriority: el.style.getPropertyPriority('overscroll-behavior')
        }));

        for (const el of owners) {
            el.setCssProps({
                'overflow-y': 'hidden',
                '-webkit-overflow-scrolling': 'auto',
                'overscroll-behavior': 'none'
            });
        }
    }

    private clearTouchDragNodeArm(pointerId?: number): void {
        if (
            typeof pointerId === 'number'
            && this.activeTouchDragPointerId !== null
            && pointerId !== this.activeTouchDragPointerId
        ) {
            return;
        }

        if (this.activeTouchDragNodeEl) {
            this.activeTouchDragNodeEl.classList.remove(this.touchDragArmedClass);
        }

        for (const snapshot of this.activeTouchDragScrollOwnerSnapshots) {
            this.restoreInlineStyle(snapshot.el, 'overflow-y', snapshot.overflowY, snapshot.overflowYPriority);
            this.restoreInlineStyle(
                snapshot.el,
                '-webkit-overflow-scrolling',
                snapshot.webkitOverflowScrolling,
                snapshot.webkitOverflowScrollingPriority
            );
            this.restoreInlineStyle(
                snapshot.el,
                'overscroll-behavior',
                snapshot.overscrollBehavior,
                snapshot.overscrollBehaviorPriority
            );
        }

        this.activeTouchDragNodeEl = null;
        this.activeTouchDragPointerId = null;
        this.activeTouchDragScrollOwnerSnapshots = [];
    }

    private restoreInlineStyle(el: HTMLElement, property: string, value: string, priority: string): void {
        if (value) {
            el.style.setProperty(property, value, priority || '');
            return;
        }
        el.style.removeProperty(property);
    }

    private createNativeInsertTraceId(pointerId: number): string {
        return `ni-${Date.now().toString(36)}-${pointerId.toString(36)}`;
    }

    private resolveNativeInsertAnchorNodeId(target: EventTarget | null): string | null {
        if (target instanceof Element) {
            const nodeEl = findCanvasNodeElementFromTarget(target);
            if (nodeEl) {
                const nodeId = this.extractNodeIdFromElement(nodeEl);
                if (nodeId) return nodeId;
            }
        }

        const canvasView = getCanvasView(this.app);
        const canvas = canvasView ? this.getCanvasFromView(canvasView) : null;
        const selectedNodeId = canvas ? getSelectedNodeFromCanvas(canvas)?.id || null : null;
        if (selectedNodeId) return selectedNodeId;

        const pluginContext = this.plugin as PluginWithLastClicked;
        return pluginContext.lastClickedNodeId || null;
    }

    private describePointerEventState(event: MouseEvent | PointerEvent): string {
        const detail = typeof event.detail === 'number' ? event.detail : 'n/a';
        const button = typeof event.button === 'number' ? event.button : 'n/a';
        const buttons = typeof event.buttons === 'number' ? event.buttons : 'n/a';
        return [
            `defaultPrevented=${event.defaultPrevented}`,
            `cancelable=${event.cancelable}`,
            `button=${button}`,
            `buttons=${buttons}`,
            `detail=${detail}`,
            `trusted=${event.isTrusted}`
        ].join(',');
    }

    private getCanvasWrapperElement(target: EventTarget | null): HTMLElement | null {
        if (target instanceof Element) {
            const wrapper = target.closest('.canvas-wrapper');
            if (wrapper instanceof HTMLElement) {
                return wrapper;
            }
        }

        const activeWrapper = document.querySelector('.canvas-wrapper.node-insert-event, .canvas-wrapper');
        return activeWrapper instanceof HTMLElement ? activeWrapper : null;
    }

    private describeComputedStyleSnapshot(el: Element | null | undefined): string {
        if (!el) return 'none';

        const computed = window.getComputedStyle(el);
        const webkitOverflowScrolling = computed.getPropertyValue('-webkit-overflow-scrolling') || 'na';
        return `${this.describeEventTarget(el)}{` +
            `pe=${computed.pointerEvents},ta=${computed.touchAction},us=${computed.userSelect},` +
            `ovY=${computed.overflowY},wk=${webkitOverflowScrolling}` +
            `}`;
    }

    private describeNativeInsertEngineState(): string {
        const canvasView = getCanvasView(this.app);
        const canvas = canvasView ? this.getCanvasFromView(canvasView) : null;
        const canvasRecord = canvas as Record<string, unknown> | null;
        const methodNames = ['createTextNode', 'createNode', 'addNode', 'insertNode', 'requestUpdate', 'requestSave'];
        const methods = methodNames.map((name) => `${name}=${typeof canvasRecord?.[name] === 'function'}`).join(',');
        const nodeCount = canvas ? getNodesFromCanvas(canvas).length : 'na';
        const edgeCount = canvas ? getEdgesFromCanvas(canvas).length : 'na';
        const selectionSummary = getCanvasSelectionSummary(canvas);

        return `canvas=${canvas ? 'yes' : 'no'},nodes=${nodeCount},edges=${edgeCount},selectionNodes=${selectionSummary.nodeIds.length},selectionEdges=${selectionSummary.edgeIds.length},methods={${methods}}`;
    }

    private describeCanvasSelection(): string {
        const canvasView = getCanvasView(this.app);
        const canvas = canvasView ? this.getCanvasFromView(canvasView) : null;
        return describeCanvasSelectionState(canvas);
    }

    private summarizeNativeInsertArg(arg: unknown): string {
        if (arg === null) return 'null';
        if (arg === undefined) return 'undefined';
        if (typeof arg === 'string') return `str:${arg.slice(0, 40)}`;
        if (typeof arg === 'number' || typeof arg === 'boolean') return `${typeof arg}:${String(arg)}`;
        if (arg instanceof Element) return this.describeEventTarget(arg);
        if (Array.isArray(arg)) return `array(len=${arg.length})`;
        if (typeof arg === 'object') {
            const record = arg as Record<string, unknown>;
            const keys = Object.keys(record).slice(0, 6).join('|');
            const id = typeof record.id === 'string' ? `,id=${record.id}` : '';
            const type = typeof record.type === 'string' ? `,type=${record.type}` : '';
            return `obj(keys=${keys || 'none'}${id}${type})`;
        }
        return typeof arg;
    }

    private installNativeInsertEngineDiagnostics(canvas: CanvasLike | null): void {
        if (!canvas) return;

        const canvasRecord = canvas as Record<string, unknown> & {
            __cmbNativeInsertDiagInstalled?: boolean;
        };
        if (canvasRecord.__cmbNativeInsertDiagInstalled) return;
        canvasRecord.__cmbNativeInsertDiagInstalled = true;

        const methodNames = ['createTextNode', 'addNode'];
        for (const methodName of methodNames) {
            const original = canvasRecord[methodName];
            if (typeof original !== 'function') continue;

            const wrapped = (...args: unknown[]) => {
                const traceId = this.activeNativeInsertSession?.traceId || 'none';
                const source = this.activeNativeInsertSession ? 'native-insert-session' : 'command-or-external';
                const callEvent = this.activeNativeInsertSession ? 'NativeInsertEngineCall' : 'CanvasEngineCall';
                const returnEvent = this.activeNativeInsertSession ? 'NativeInsertEngineReturn' : 'CanvasEngineReturn';
                const errorEvent = this.activeNativeInsertSession ? 'NativeInsertEngineError' : 'CanvasEngineError';
                log(
                    `[Event] ${callEvent}: trace=${traceId}, source=${source}, method=${methodName}, ` +
                    `selection=${this.describeCanvasSelection()}, args=${args.map(arg => this.summarizeNativeInsertArg(arg)).join(';') || 'none'}`
                );
                try {
                    const result = (original as (...invokeArgs: unknown[]) => unknown).apply(canvasRecord, args);
                    log(
                        `[Event] ${returnEvent}: trace=${traceId}, source=${source}, method=${methodName}, ` +
                        `result=${this.summarizeNativeInsertArg(result)}, selection=${this.describeCanvasSelection()}`
                    );
                    return result;
                } catch (error) {
                    log(
                        `[Event] ${errorEvent}: trace=${traceId}, source=${source}, method=${methodName}, ` +
                        `error=${String(error)}, selection=${this.describeCanvasSelection()}`
                    );
                    throw error;
                }
            };

            canvasRecord[methodName] = wrapped;
            this.nativeInsertEngineRestoreFns.push(() => {
                canvasRecord[methodName] = original;
            });
        }
    }

    private scheduleNativeInsertSelectionProbe(traceId: string, reason: string): void {
        window.setTimeout(() => {
            logVerbose(`[Event] NativeInsertSelectionProbe: trace=${traceId}, phase=${reason}:timeout-0, selection=${this.describeCanvasSelection()}`);
        }, 0);

        requestAnimationFrame(() => {
            logVerbose(`[Event] NativeInsertSelectionProbe: trace=${traceId}, phase=${reason}:raf, selection=${this.describeCanvasSelection()}`);
        });

        window.setTimeout(() => {
            logVerbose(`[Event] NativeInsertSelectionProbe: trace=${traceId}, phase=${reason}:timeout-120, selection=${this.describeCanvasSelection()}`);
        }, 120);
    }

    private collectMutationElementsByClass(node: Node, className: string): HTMLElement[] {
        const matches: HTMLElement[] = [];
        if (!(node instanceof HTMLElement)) return matches;

        if (node.classList.contains(className)) {
            matches.push(node);
        }

        const descendants = node.querySelectorAll(`.${className}`);
        for (const descendant of Array.from(descendants)) {
            if (descendant instanceof HTMLElement) {
                matches.push(descendant);
            }
        }

        return matches;
    }

    private describeMutationSamples(elements: HTMLElement[], limit = 2): string {
        if (elements.length === 0) return 'none';

        return elements.slice(0, limit).map((el) => {
            const nodeId = this.extractNodeIdFromElement(el);
            return `${nodeId || 'unknown'}:${this.describeEventTarget(el)}`;
        }).join(',');
    }

    private describeNativeInsertTargetKind(target: EventTarget | null): string {
        if (!(target instanceof Element)) return 'non-element';
        if (target.closest('.canvas-node-placeholder')) return 'placeholder';

        const nodeInsertEventEl = target.closest('.node-insert-event');
        if (nodeInsertEventEl instanceof HTMLElement && nodeInsertEventEl.closest('.canvas-node')) {
            const selected = !!target.closest('.canvas-node.is-selected, .canvas-node.is-focused');
            return selected ? 'node-content:selected' : 'node-content';
        }

        const insertWrapper = target.closest('.canvas-wrapper.node-insert-event');
        if (insertWrapper instanceof HTMLElement) {
            const states = ['is-dragging', 'mod-animating', 'mod-zoomed-out']
                .filter((className) => insertWrapper.classList.contains(className));
            return states.length > 0 ? `wrapper:${states.join('+')}` : 'wrapper';
        }

        return 'other';
    }

    private isCanvasSurfaceInteractionTarget(target: EventTarget | null): boolean {
        if (!(target instanceof Element)) return false;
        return !!target.closest('.canvas-wrapper, .canvas');
    }

    private describeCanvasPointerTargetKind(target: EventTarget | null): string {
        if (!(target instanceof Element)) return 'non-element';
        if (isCanvasEdgeConnectGestureTarget(target)) return 'edge-connect';
        if (isCanvasNativeInsertGestureTarget(target)) return `native-insert:${this.describeNativeInsertTargetKind(target)}`;
        if (findCanvasNodeElementFromTarget(target)) return 'node';
        if (target.closest('.cmb-collapse-button')) return 'collapse-button';
        if (findDeleteButton(target)) return 'delete-button';
        if (findZoomToFitButton(target)) return 'zoom-to-fit';
        if (target.closest('.canvas-control-item')) return 'canvas-control';
        if (target.closest('.canvas-edge-label')) return 'canvas-edge-label';
        if (target.closest('.canvas-edge-line-group, .canvas-edge')) return 'canvas-edge';
        if (target instanceof SVGElement && target.closest('svg')) return 'canvas-svg';
        if (target.closest('.canvas-wrapper, .canvas')) return 'canvas-surface';
        return 'other';
    }

    private ensureNativeInsertDiagnosticsInstalled(): void {
        const canvasView = getCanvasView(this.app);
        const canvas = canvasView ? this.getCanvasFromView(canvasView) : null;
        this.installNativeInsertEngineDiagnostics(canvas);
    }

    private isNativeInsertSessionActive(pointerId?: number): boolean {
        const session = this.activeNativeInsertSession;
        if (!session) return false;
        return typeof pointerId === 'number' ? session.pointerId === pointerId : true;
    }

    private shouldCommitNativeInsertSession(input: {
        session: Pick<NativeInsertSession, 'traceId' | 'targetKind' | 'startReason' | 'nodeCreateSeen' | 'anchorNodeId'>;
        nodeDelta: number;
        placeholderDelta: number;
        endReason: string;
    }): {
        allow: boolean;
        reason: string;
    } {
        if (input.endReason === 'pointercancel') {
            return {
                allow: false,
                reason: 'pointer-cancelled'
            };
        }

        if (input.session.nodeCreateSeen) {
            return {
                allow: false,
                reason: 'node-create-observed'
            };
        }

        if (input.nodeDelta > 0) {
            return {
                allow: false,
                reason: `node-delta:${input.nodeDelta}`
            };
        }

        const actionableTarget = input.session.targetKind === 'placeholder'
            || input.session.targetKind.startsWith('node-content')
            || input.session.targetKind.startsWith('wrapper');

        if (!actionableTarget) {
            return {
                allow: false,
                reason: `unsupported-target:${input.session.targetKind}`
            };
        }

        return {
            allow: true,
            reason: input.session.anchorNodeId
                ? 'missing-native-create-with-anchor'
                : 'missing-native-create-no-anchor'
        };
    }

    private queueNativeInsertCommitFlush(trigger: string, delayMs: number): void {
        window.setTimeout(() => {
            void this.flushPendingNativeInsertCommit(trigger);
        }, Math.max(0, delayMs));
    }

    private queueNativeInsertCommitRaf(trigger: string): void {
        requestAnimationFrame(() => {
            void this.flushPendingNativeInsertCommit(trigger);
        });
    }

    private getCanvasGraphSnapshot(canvas: CanvasLike | null | undefined): CanvasGraphSnapshot {
        if (!canvas) {
            return {
                nodeCount: 0,
                edgeCount: 0,
            };
        }

        return {
            nodeCount: getNodesFromCanvas(canvas).length,
            edgeCount: getEdgesFromCanvas(canvas).length,
        };
    }

    private stageNativeInsertCommit(
        session: NativeInsertSession,
        nodeDelta: number,
        placeholderDelta: number,
        endReason: string
    ): void {
        const decision = this.shouldCommitNativeInsertSession({
            session,
            nodeDelta,
            placeholderDelta,
            endReason,
        });

        if (!decision.allow) {
            logVerbose(
                `[Event] NativeInsertCommitSkipped: trace=${session.traceId}, reason=${decision.reason}, ` +
                `target=${session.targetKind}, anchor=${session.anchorNodeId || 'none'}, ` +
                `nodeDelta=${nodeDelta}, placeholderDelta=${placeholderDelta}, endReason=${endReason}`
            );
            this.pendingNativeInsertCommit = null;
            return;
        }

        this.pendingNativeInsertCommit = {
            traceId: session.traceId,
            pointerType: session.pointerType,
            startReason: session.startReason,
            targetKind: session.targetKind,
            anchorNodeId: session.anchorNodeId,
            initialNodeCount: session.initialNodeCount,
            initialPlaceholderCount: session.initialPlaceholderCount,
            nodeDelta,
            placeholderDelta,
            endReason,
            endedAt: Date.now(),
            engineAttempted: false,
        };

        log(
            `[Event] NativeInsertCommitQueued: trace=${session.traceId}, reason=${decision.reason}, ` +
            `target=${session.targetKind}, anchor=${session.anchorNodeId || 'none'}, ` +
            `nodeDelta=${nodeDelta}, placeholderDelta=${placeholderDelta}, endReason=${endReason}`
        );

        this.queueNativeInsertCommitFlush('session-end:timeout-0', 0);
        this.queueNativeInsertCommitRaf('session-end:raf');
        this.queueNativeInsertCommitFlush('session-end:timeout-120', 120);
    }

    private async flushPendingNativeInsertCommit(trigger: string): Promise<void> {
        const candidate = this.pendingNativeInsertCommit;
        if (!candidate) return;

        if (this.nativeInsertCommitInFlight) {
            logVerbose(`[Event] NativeInsertCommitWait: trace=${candidate.traceId}, trigger=${trigger}, reason=in-flight`);
            return;
        }

        if (
            this.lastNativeInsertCommitTraceId === candidate.traceId
            && Date.now() - this.lastNativeInsertCommitAt < 1500
        ) {
            this.pendingNativeInsertCommit = null;
            return;
        }

        const ageMs = Date.now() - candidate.endedAt;
        const canvasView = getCanvasView(this.app);
        const canvas = canvasView ? this.getCanvasFromView(canvasView) : null;

        if (!canvas) {
            if (ageMs > 1200) {
                log(
                    `[Event] NativeInsertCommitRejected: trace=${candidate.traceId}, trigger=${trigger}, ` +
                    `reason=no-canvas-expired, age=${ageMs}ms, target=${candidate.targetKind}, ` +
                    `anchor=${candidate.anchorNodeId || 'none'}, queuedNodeDelta=${candidate.nodeDelta}, ` +
                    `queuedPlaceholderDelta=${candidate.placeholderDelta}, endReason=${candidate.endReason}`
                );
                this.pendingNativeInsertCommit = null;
            }
            return;
        }

        const currentSnapshot = this.getCanvasGraphSnapshot(canvas);
        if (currentSnapshot.nodeCount > candidate.initialNodeCount) {
            log(
                `[Event] NativeInsertCommitRejected: trace=${candidate.traceId}, trigger=${trigger}, ` +
                `reason=node-count-increased, initialNodeCount=${candidate.initialNodeCount}, ` +
                `currentNodeCount=${currentSnapshot.nodeCount}, currentEdgeCount=${currentSnapshot.edgeCount}, ` +
                `queuedNodeDelta=${candidate.nodeDelta}, queuedPlaceholderDelta=${candidate.placeholderDelta}, ` +
                `endReason=${candidate.endReason}`
            );
            this.pendingNativeInsertCommit = null;
            return;
        }

        this.nativeInsertCommitInFlight = true;
        try {
            log(
                `[Event] NativeInsertCommitStart: trace=${candidate.traceId}, trigger=${trigger}, ` +
                `mode=file-fallback, pointerType=${candidate.pointerType}, startReason=${candidate.startReason}, ` +
                `target=${candidate.targetKind}, anchor=${candidate.anchorNodeId || 'none'}, ` +
                `initialNodeCount=${candidate.initialNodeCount}, currentNodeCount=${currentSnapshot.nodeCount}, ` +
                `currentEdgeCount=${currentSnapshot.edgeCount}, queuedNodeDelta=${candidate.nodeDelta}, ` +
                `queuedPlaceholderDelta=${candidate.placeholderDelta}, endReason=${candidate.endReason}, age=${ageMs}ms`
            );
            log(
                `[Event] NativeInsertCommitFallback: trace=${candidate.traceId}, trigger=${trigger}, ` +
                `anchor=${candidate.anchorNodeId || 'none'}, engineAttempted=${candidate.engineAttempted}, ` +
                `runtimeCreate=disabled, beforeNodes=${currentSnapshot.nodeCount}, beforeEdges=${currentSnapshot.edgeCount}, age=${ageMs}ms`
            );
            await this.canvasManager.addNodeToCanvas('', null, {
                source: 'native-insert',
                parentNodeIdHint: candidate.anchorNodeId,
                suppressSuccessNotice: true,
                skipFromLink: true,
            });

            const refreshedCanvasView = getCanvasView(this.app);
            const refreshedCanvas = refreshedCanvasView ? this.getCanvasFromView(refreshedCanvasView) : canvas;
            const afterSnapshot = this.getCanvasGraphSnapshot(refreshedCanvas ?? canvas);
            const observedNodeDelta = afterSnapshot.nodeCount - currentSnapshot.nodeCount;
            const observedEdgeDelta = afterSnapshot.edgeCount - currentSnapshot.edgeCount;
            const nodeCreate = observedNodeDelta > 0 ? 'observed' : 'deferred-or-unobserved';

            this.pendingNativeInsertCommit = null;
            this.lastNativeInsertCommitTraceId = candidate.traceId;
            this.lastNativeInsertCommitAt = Date.now();
            log(
                `[Event] NativeInsertCommitDone: trace=${candidate.traceId}, trigger=${trigger}, ` +
                `mode=file-fallback, anchor=${candidate.anchorNodeId || 'none'}, accepted=true, ` +
                `nodeCreate=${nodeCreate}, nodeDelta=${observedNodeDelta}, edgeDelta=${observedEdgeDelta}, ` +
                `beforeNodes=${currentSnapshot.nodeCount}, afterNodes=${afterSnapshot.nodeCount}, ` +
                `beforeEdges=${currentSnapshot.edgeCount}, afterEdges=${afterSnapshot.edgeCount}`
            );
        } catch (error) {
            log(`[Event] NativeInsertCommitError: trace=${candidate.traceId}, trigger=${trigger}, error=${String(error)}`);
            if (trigger === 'click-post-session' || ageMs > 1200) {
                this.pendingNativeInsertCommit = null;
            }
        } finally {
            this.nativeInsertCommitInFlight = false;
        }
    }

    private evaluateNativeInsertSessionStart(pointerType: string, target: EventTarget | null): {
        candidate: boolean;
        allow: boolean;
        reason: string;
        targetKind: string;
    } {
        if (!(target instanceof Element)) {
            return {
                candidate: false,
                allow: false,
                reason: 'non-element',
                targetKind: 'non-element'
            };
        }

        if (isCanvasEdgeConnectGestureTarget(target)) {
            return {
                candidate: true,
                allow: false,
                reason: 'edge-connect',
                targetKind: 'edge-connect'
            };
        }

        const candidate = isCanvasNativeInsertGestureTarget(target);
        const targetKind = this.describeNativeInsertTargetKind(target);
        if (!candidate) {
            return {
                candidate: false,
                allow: false,
                reason: 'not-native-target',
                targetKind
            };
        }

        if (targetKind === 'placeholder') {
            return {
                candidate: true,
                allow: true,
                reason: 'placeholder',
                targetKind
            };
        }

        if (targetKind.startsWith('node-content')) {
            return {
                candidate: true,
                allow: true,
                reason: 'node-content',
                targetKind
            };
        }

        if (targetKind.startsWith('wrapper')) {
            const insertWrapper = target.closest('.canvas-wrapper.node-insert-event');
            const wrapperActive = insertWrapper instanceof HTMLElement
                && (insertWrapper.classList.contains('is-dragging') || insertWrapper.classList.contains('mod-animating'));

            if (wrapperActive) {
                return {
                    candidate: true,
                    allow: true,
                    reason: 'wrapper-active',
                    targetKind
                };
            }

            const hasPlaceholder = !!document.querySelector('.canvas-node-placeholder');
            if (hasPlaceholder) {
                return {
                    candidate: true,
                    allow: true,
                    reason: 'wrapper-placeholder-present',
                    targetKind
                };
            }

            if (this.isTouchLikePointer(pointerType)) {
                return {
                    candidate: true,
                    allow: true,
                    reason: 'wrapper-touch-like',
                    targetKind
                };
            }

            return {
                candidate: true,
                allow: false,
                reason: 'empty-wrapper-idle',
                targetKind
            };
        }

        return {
            candidate: true,
            allow: false,
            reason: `unsupported-kind:${targetKind}`,
            targetKind
        };
    }

    private shouldSuppressSideEffectsForNativeInsert(): boolean {
        return this.activeNativeInsertSession !== null || Date.now() < this.nativeInsertSideEffectsSuppressUntil;
    }

    private startNativeInsertSession(
        pointerId: number,
        pointerType: string,
        target: EventTarget | null,
        event: PointerEvent,
        startReason: string = 'direct'
    ): void {
        const now = Date.now();
        const placeholderSeen = target instanceof HTMLElement && !!target.closest('.canvas-node-placeholder');
        const traceId = this.createNativeInsertTraceId(pointerId);
        const wrapperEl = this.getCanvasWrapperElement(target);
        const canvasView = getCanvasView(this.app);
        const canvas = canvasView ? this.getCanvasFromView(canvasView) : null;
        const anchorNodeId = this.resolveNativeInsertAnchorNodeId(target);
        this.installNativeInsertEngineDiagnostics(canvas);
        const initialNodeCount = canvas ? getNodesFromCanvas(canvas).length : 0;
        const initialPlaceholderCount = document.querySelectorAll('.canvas-node-placeholder').length;
        const startSelection = this.describeCanvasSelection();
        this.activeNativeInsertSession = {
            pointerId,
            pointerType,
            startReason,
            startedAt: now,
            lastSeenAt: now,
            traceId,
            targetKind: this.describeNativeInsertTargetKind(target),
            anchorNodeId,
            startTarget: this.describeEventTarget(target),
            startChain: this.describeEventTargetChain(target),
            startSelection,
            downDefaultPrevented: event.defaultPrevented,
            initialNodeCount,
            initialPlaceholderCount,
            initialWrapperStyle: this.describeComputedStyleSnapshot(wrapperEl),
            wrapperDragSeen: false,
            placeholderSeen,
            nodeCreateSeen: false,
            placeholderAddedCount: placeholderSeen ? 1 : 0,
            placeholderRemovedCount: 0,
            domNodeAddedCount: 0,
            domNodeRemovedCount: 0
        };
        if (anchorNodeId && canvasView) {
            this.rememberNodeInteractionContext(anchorNodeId, 'native-insert-start', canvasView);
        }
        this.nativeInsertSideEffectsSuppressUntil = Math.max(this.nativeInsertSideEffectsSuppressUntil, now + 1200);
        log(
            `[Event] NativeInsertSessionStart: trace=${traceId}, pointer=${pointerId}, pointerType=${pointerType}, ` +
            `startReason=${startReason}, ` +
            `target=${this.activeNativeInsertSession.targetKind}, anchor=${anchorNodeId || 'none'}, eventTarget=${this.describeEventTarget(target)}, ` +
            `chain=${this.describeEventTargetChain(target)}, flags=${this.describePointerEventState(event)}, ` +
            `wrapperStyle=${this.activeNativeInsertSession.initialWrapperStyle}, selection=${startSelection}, ` +
            `engine=${this.describeNativeInsertEngineState()}`
        );
        if (placeholderSeen) {
            logVerbose(`[Event] NativeInsertPlaceholderSeen: trace=${traceId}, pointer=${pointerId}, via=session-start`);
        }
    }

    private touchNativeInsertSession(target: EventTarget | null): void {
        const session = this.activeNativeInsertSession;
        if (!session) return;

        session.lastSeenAt = Date.now();
        this.nativeInsertSideEffectsSuppressUntil = Math.max(this.nativeInsertSideEffectsSuppressUntil, session.lastSeenAt + 900);

        if (!(target instanceof Element)) return;

        if (!session.placeholderSeen && target.closest('.canvas-node-placeholder')) {
            session.placeholderSeen = true;
            session.placeholderAddedCount += 1;
            logVerbose(
                `[Event] NativeInsertPlaceholderSeen: trace=${session.traceId}, pointer=${session.pointerId}, ` +
                `target=${this.describeEventTarget(target)}, chain=${this.describeEventTargetChain(target)}, ` +
                `targetStyle=${this.describeComputedStyleSnapshot(target)}`
            );
        }

        const insertWrapper = target.closest('.canvas-wrapper.node-insert-event');
        const wrapperDragging = insertWrapper instanceof HTMLElement
            && (insertWrapper.classList.contains('is-dragging') || insertWrapper.classList.contains('mod-animating'));
        if (wrapperDragging && !session.wrapperDragSeen) {
            session.wrapperDragSeen = true;
            log(
                `[Event] NativeInsertWrapperDragSeen: trace=${session.traceId}, pointer=${session.pointerId}, ` +
                `target=${this.describeEventTarget(target)}, chain=${this.describeEventTargetChain(target)}, ` +
                `wrapperStyle=${this.describeComputedStyleSnapshot(insertWrapper)}`
            );
        }
    }

    private noteNativeInsertNodeCreate(nodeId: string | null): void {
        if (!nodeId) return;

        const session = this.activeNativeInsertSession;
        if (session) {
            session.nodeCreateSeen = true;
            this.nativeInsertSideEffectsSuppressUntil = Math.max(this.nativeInsertSideEffectsSuppressUntil, Date.now() + 900);
            logVerbose(`[Event] NativeInsertNodeCreateSeen: trace=${session.traceId}, pointer=${session.pointerId}, node=${nodeId}`);
            return;
        }

        if (Date.now() < this.nativeInsertSideEffectsSuppressUntil) {
            logVerbose(`[Event] NativeInsertNodeCreateSeenRecent: node=${nodeId}`);
        }
    }

    private endNativeInsertSession(pointerId: number, reason: string, target: EventTarget | null, event?: PointerEvent): void {
        const session = this.activeNativeInsertSession;
        if (!session || session.pointerId !== pointerId) return;

        this.touchNativeInsertSession(target);
        const duration = Date.now() - session.startedAt;
        const wrapperEl = this.getCanvasWrapperElement(target);
        const canvasView = getCanvasView(this.app);
        const canvas = canvasView ? this.getCanvasFromView(canvasView) : null;
        const finalNodeCount = canvas ? getNodesFromCanvas(canvas).length : 0;
        const finalPlaceholderCount = document.querySelectorAll('.canvas-node-placeholder').length;
        const nodeDelta = finalNodeCount - session.initialNodeCount;
        const placeholderDelta = finalPlaceholderCount - session.initialPlaceholderCount;
        const endSelection = this.describeCanvasSelection();
        log(
            `[Event] NativeInsertSessionEnd: trace=${session.traceId}, pointer=${pointerId}, pointerType=${session.pointerType}, ` +
            `duration=${duration}ms, startReason=${session.startReason}, target=${session.targetKind}, wrapperDrag=${session.wrapperDragSeen}, ` +
            `anchor=${session.anchorNodeId || 'none'}, ` +
            `placeholder=${session.placeholderSeen}, nodeCreate=${session.nodeCreateSeen}, ` +
            `placeholderAdds=${session.placeholderAddedCount}, placeholderRemoves=${session.placeholderRemovedCount}, ` +
            `domNodeAdds=${session.domNodeAddedCount}, domNodeRemoves=${session.domNodeRemovedCount}, ` +
            `nodeDelta=${nodeDelta}, placeholderDelta=${placeholderDelta}, reason=${reason}, ` +
            `flags=${event ? this.describePointerEventState(event) : 'none'}, ` +
            `selectionStart=${session.startSelection}, selectionEnd=${endSelection}`
        );

        if (!session.nodeCreateSeen) {
            logVerbose(
                `[Event] NativeInsertDiagnostics: trace=${session.traceId}, downDefaultPrevented=${session.downDefaultPrevented}, ` +
                `startTarget=${session.startTarget}, startChain=${session.startChain}, ` +
                `startWrapperStyle=${session.initialWrapperStyle}, endTarget=${this.describeEventTarget(target)}, ` +
                `anchor=${session.anchorNodeId || 'none'}, ` +
                `endChain=${this.describeEventTargetChain(target)}, endTargetStyle=${this.describeComputedStyleSnapshot(target instanceof Element ? target : null)}, ` +
                `endWrapperStyle=${this.describeComputedStyleSnapshot(wrapperEl)}, placeholdersNow=${finalPlaceholderCount}, ` +
                `activeElement=${this.describeEventTarget(document.activeElement)}, selection=${endSelection}, ` +
                `engine=${this.describeNativeInsertEngineState()}`
            );
        }

        this.stageNativeInsertCommit(session, nodeDelta, placeholderDelta, reason);

        this.scheduleNativeInsertSelectionProbe(session.traceId, reason);

        this.activeNativeInsertSession = null;
        this.nativeInsertSideEffectsSuppressUntil = Math.max(this.nativeInsertSideEffectsSuppressUntil, Date.now() + 700);
        this.scheduleDeferredPostInsertMaintenance(`native-insert-end:${reason}`);
    }

    private scheduleDeferredPostInsertMaintenance(reason: string): void {
        if (this.deferredPostInsertMaintenanceTimeoutId !== null) {
            window.clearTimeout(this.deferredPostInsertMaintenanceTimeoutId);
        }

        const delay = Math.max(80, this.nativeInsertSideEffectsSuppressUntil - Date.now() + 40);
        this.deferredPostInsertMaintenanceTimeoutId = window.setTimeout(() => {
            this.deferredPostInsertMaintenanceTimeoutId = null;

            if (this.shouldSuppressSideEffectsForNativeInsert()) {
                this.scheduleDeferredPostInsertMaintenance(`${reason}-retry`);
                return;
            }

            const deferredMeasureIds = Array.from(this.deferredMeasureNodeIds);
            const deferredAdjustIds = Array.from(this.deferredAdjustNodeIds);
            this.deferredMeasureNodeIds.clear();
            this.deferredAdjustNodeIds.clear();

            log(
                `[Event] NativeInsertPostMaintenance: reason=${reason}, ` +
                `deferredMeasure=${deferredMeasureIds.length}, deferredAdjust=${deferredAdjustIds.length}`
            );

            void this.canvasManager.checkAndAddCollapseButtons();

            const activeCanvasView = getCanvasView(this.app);
            const activeCanvas = activeCanvasView ? this.getCanvasFromView(activeCanvasView) : null;
            if (activeCanvas) {
                const hiddenCount = this.canvasManager.reapplyCurrentCollapseVisibility(activeCanvas, `native-insert-post:${reason}`);
                if (hiddenCount > 0) {
                    logVerbose(`[Event] NativeInsertPostMaintenanceVisibility: hidden=${hiddenCount}, reason=${reason}`);
                }
                const updated = this.canvasManager.syncScrollableStateForMountedNodes();
                if (updated > 0) {
                    logVerbose(`[Event] NativeInsertPostMaintenanceScrollSync: updated=${updated}, reason=${reason}`);
                }
            }

            for (const nodeId of deferredMeasureIds) {
                void this.canvasManager.measureAndPersistTrustedHeight(nodeId);
            }

            for (const nodeId of deferredAdjustIds) {
                this.canvasManager.scheduleNodeHeightAdjustment(
                    nodeId,
                    CONSTANTS.TIMING.SCROLL_DELAY,
                    `native-insert-post:${reason}`
                );
            }
        }, delay);
    }

    private getTouchDragScrollOwners(nodeEl: HTMLElement): HTMLElement[] {
        const owners: HTMLElement[] = [];
        const seen = new Set<HTMLElement>();

        for (const selector of this.touchDragScrollOwnerSelectors) {
            const elements = nodeEl.querySelectorAll(selector);
            for (const el of Array.from(elements)) {
                if (!(el instanceof HTMLElement)) continue;
                if (seen.has(el)) continue;
                seen.add(el);
                owners.push(el);
            }
        }

        return owners;
    }

    private markOpenProtectionWindow(reason: string): void {
        this.nodeMountedOpenProtectionUntil = Date.now() + this.nodeMountedOpenProtectionMs;
        logVerbose(`[Event] OpenStabilizeProtectWindow: reason=${reason}, holdMs=${this.nodeMountedOpenProtectionMs}`);
    }

    private scheduleNodeMountedBatchFlush(delayMs: number, reason: string): void {
        if (this.nodeMountedBatchTimeoutId !== null) {
            window.clearTimeout(this.nodeMountedBatchTimeoutId);
        }

        this.nodeMountedBatchTimeoutId = window.setTimeout(() => {
            this.nodeMountedBatchTimeoutId = null;
            this.flushNodeMountedBatch(reason);
        }, Math.max(0, delayMs));
    }

    private queueNodeMountedStabilization(filePath: string | null, mountedCount: number): void {
        this.nodeMountedPendingCount += Math.max(1, mountedCount);
        if (!this.nodeMountedPendingFilePath && filePath) {
            this.nodeMountedPendingFilePath = filePath;
        }
        this.scheduleNodeMountedBatchFlush(this.nodeMountedBatchDebounceMs, 'debounce');
    }

    private flushNodeMountedBatch(reason: string): void {
        if (this.nodeMountedPendingCount <= 0) return;

        const now = Date.now();
        const cooldownRemaining = Math.max(0, this.nodeMountedCooldownMs - (now - this.nodeMountedLastFlushAt));
        const interactionRemaining = Math.max(0, this.nodeMountedInteractionActiveUntil - now);
        const protectionRemaining = Math.max(0, this.nodeMountedOpenProtectionUntil - now);

        const deferBy = Math.max(cooldownRemaining, interactionRemaining, protectionRemaining);
        if (deferBy > 0) {
            if (interactionRemaining >= cooldownRemaining && interactionRemaining >= protectionRemaining) {
                this.nodeMountedDelayByInteractionCount++;
            } else {
                this.nodeMountedDelayByCooldownCount++;
            }
            this.scheduleNodeMountedBatchFlush(deferBy + 30, `defer-${reason}`);
            return;
        }

        const batchSize = this.nodeMountedPendingCount;
        const filePath = this.nodeMountedPendingFilePath || this.currentCanvasFilePath;
        const delayedByInteraction = this.nodeMountedDelayByInteractionCount;
        const delayedByCooldown = this.nodeMountedDelayByCooldownCount;

        this.nodeMountedPendingCount = 0;
        this.nodeMountedPendingFilePath = null;
        this.nodeMountedDelayByInteractionCount = 0;
        this.nodeMountedDelayByCooldownCount = 0;
        this.nodeMountedLastFlushAt = now;

        log(
            `[Event] OpenStabilizeNodeMountedBatch: source=node-mounted-idle-batch, batchSize=${batchSize}, ` +
            `delayedByInteraction=${delayedByInteraction}, delayedByCooldown=${delayedByCooldown}, reason=${reason}, file=${filePath || 'unknown'}`
        );

        if (this.shouldSuppressOpenStabilization('node-mounted-idle-batch', filePath || null)) {
            log(
                `[Event] OpenStabilizeNodeMountedBatchSuppressed: source=node-mounted-idle-batch, batchSize=${batchSize}, ` +
                `reason=${reason}, file=${filePath || 'unknown'}, by=programmatic-reload-window`
            );
            return;
        }

        this.scheduleOpenStabilizationWithDedup('node-mounted-idle-batch', filePath || null);
    }

    private handleZoomToFitVisibleNodes(): boolean {
        const canvasView = getCanvasView(this.app);
        if (!canvasView) return false;

        const canvas = this.getCanvasFromView(canvasView);
        if (!canvas) return false;

        const nodes = getNodesFromCanvas(canvas);
        const edges = getEdgesFromCanvas(canvas);
        if (nodes.length === 0) return false;

        const visibilityService = new VisibilityService(this.collapseStateManager);
        const visibleNodeIds = visibilityService.getVisibleNodeIds(nodes, edges);
        const visibleNodes = nodes.filter(node => node.id && visibleNodeIds.has(node.id));
        if (visibleNodes.length === 0) return false;

        return withTemporaryCanvasSelection(canvas, visibleNodes, () => {
            return tryZoomToSelection(this.app, canvasView, canvas);
        });
    }

    private scheduleOpenStabilizationWithDedup(source: string, filePath: string | null): void {
        const dedupScope = (source === 'active-leaf-change' || source === 'file-open')
            ? 'open-entry'
            : source;
        const key = `${dedupScope}:${filePath || 'unknown'}`;
        const now = Date.now();
        if (this.lastOpenStabilizeKickKey === key && now - this.lastOpenStabilizeKickAt < 600) {
            logVerbose(`[Event] OpenStabilizeDedup: skip duplicate trigger, source=${source}, file=${filePath || 'unknown'}`);
            return;
        }

        this.lastOpenStabilizeKickKey = key;
        this.lastOpenStabilizeKickAt = now;
        this.canvasManager.scheduleOpenStabilization(source);
    }

    public markProgrammaticCanvasReload(filePath: string, holdMs: number = this.programmaticReloadDefaultHoldMs): void {
        if (!filePath) return;
        const until = Date.now() + Math.max(0, holdMs);
        this.programmaticReloadSuppressUntilByFilePath.set(filePath, until);
        log(`[Event] MarkProgrammaticReload: file=${filePath}, holdMs=${holdMs}`);
    }

    private shouldSuppressOpenStabilization(source: string, filePath: string | null): boolean {
        if (!filePath) return false;

        const now = Date.now();
        const until = this.programmaticReloadSuppressUntilByFilePath.get(filePath) || 0;
        if (until > now) {
            log(`[Event] OpenStabilizeSuppressed: source=${source}, file=${filePath}, remaining=${until - now}ms`);
            return true;
        }

        if (until > 0) {
            this.programmaticReloadSuppressUntilByFilePath.delete(filePath);
        }

        return false;
    }

    private describeDeleteModalFocusContext(): string {
        const activeViewType = this.app.workspace.getActiveViewOfType(ItemView)?.getViewType?.() || 'none';
        const activeEditorInfo = this.app.workspace.activeEditor;
        return [
            `activeView=${activeViewType}`,
            `activeEditor=${!!activeEditorInfo}`,
            `editor=${!!activeEditorInfo?.editor}`
        ].join(',');
    }

    private hasSuspiciousDeleteModalFocusContext(expectCanvasActive: boolean = false): boolean {
        const activeViewType = this.app.workspace.getActiveViewOfType(ItemView)?.getViewType?.() || 'none';
        const activeEditorInfo = this.app.workspace.activeEditor;
        if (expectCanvasActive && activeViewType !== 'canvas') {
            return true;
        }
        return !!activeEditorInfo && !activeEditorInfo.editor;
    }

    private isDeleteOverlayInteractionTarget(target: EventTarget | null): boolean {
        return target instanceof Element && !!target.closest(
            '.canvas-mindmap-delete-overlay, .canvas-mindmap-delete-panel, .canvas-mindmap-delete-edge-overlay, .canvas-mindmap-delete-edge-panel'
        );
    }

    private clearSuspiciousDeleteModalFocusContext(reason: string, kind: 'node' | 'edge', targetId: string): boolean {
        const shouldExpectCanvasActive = true;
        const shouldNormalize = this.hasSuspiciousDeleteModalFocusContext(shouldExpectCanvasActive);
        if (!shouldNormalize) return false;

        const before = this.describeDeleteModalFocusContext();
        const activeBefore = this.describeEventTarget(document.activeElement);
        let focusedCanvasLeaf = false;

        const activeCanvasView = getCanvasView(this.app);
        const activeCanvasLeaf = (activeCanvasView as { leaf?: unknown } | null)?.leaf;
        if (activeCanvasLeaf) {
            focusedCanvasLeaf = setActiveLeafSafe(this.app, activeCanvasLeaf, { focus: true })
                && this.app.workspace.getActiveViewOfType(ItemView)?.getViewType?.() === 'canvas';
        }

        const focusAfterLeafSync = this.describeDeleteModalFocusContext();
        let blurred = false;
        try {
            const activeElement = document.activeElement;
            if (activeElement instanceof HTMLElement && activeElement !== document.body) {
                activeElement.blur();
                blurred = document.activeElement !== activeElement;
            }
        } catch {
            // ignore blur failures on platform internals
        }

        const after = this.describeDeleteModalFocusContext();
        logVerbose(
            `[Event] DeleteModalFocusGuard: phase=${reason}, kind=${kind}, target=${targetId}, ` +
            `focusBefore=${before}, focusAfterLeafSync=${focusAfterLeafSync}, focusAfter=${after}, ` +
            `activeBefore=${activeBefore}, activeAfter=${this.describeEventTarget(document.activeElement)}, ` +
            `focusedCanvasLeaf=${focusedCanvasLeaf}, blurred=${blurred}`
        );
        return focusedCanvasLeaf || blurred;
    }

    private async runDeleteModalOnNextFrame<T>(action: () => T | Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            requestAnimationFrame(() => {
                Promise.resolve()
                    .then(action)
                    .then(resolve)
                    .catch(reject);
            });
        });
    }

    private async openDeleteModalSafely(modal: { open: () => void }, kind: 'node' | 'edge', targetId: string): Promise<void> {
        this.clearSuspiciousDeleteModalFocusContext('pre-open', kind, targetId);
        logVerbose(
            `[Event] DeleteModalNormalized: kind=${kind}, target=${targetId}, ` +
            `focusContext=${this.describeDeleteModalFocusContext()}`
        );
        await this.runDeleteModalOnNextFrame(() => {
            modal.open();
        });
    }

    private async waitForDeleteModalFocusSettle(kind: 'node' | 'edge', targetId: string): Promise<void> {
        this.clearSuspiciousDeleteModalFocusContext('post-close', kind, targetId);
        logVerbose(
            `[Event] DeleteModalPostClose: kind=${kind}, target=${targetId}, ` +
            `focusContext=${this.describeDeleteModalFocusContext()}`
        );
        await this.runDeleteModalOnNextFrame(() => undefined);
    }

    private markSuppressDeleteButtonClick(holdMs: number, reason: string): void {
        this.suppressDeleteButtonClickUntil = Date.now() + Math.max(0, holdMs);
        this.suppressDeleteButtonClickReason = reason;
    }

    private shouldSuppressDeleteButtonClick(reason: string): boolean {
        const now = Date.now();
        if (now >= this.suppressDeleteButtonClickUntil) {
            return false;
        }

        logVerbose(
            `[Event] DeleteButtonClickSuppressed: phase=${reason}, ` +
            `reason=${this.suppressDeleteButtonClickReason || 'unknown'}, ` +
            `remaining=${Math.max(0, this.suppressDeleteButtonClickUntil - now)}ms`
        );
        return true;
    }

    private async executeDeleteEdgeOperation(selectedEdge: CanvasEdgeLike, canvas: CanvasLike): Promise<void> {
        const edgeKey = this.getEdgeSelectionFallbackKey(selectedEdge);
        const modal = new DeleteEdgeConfirmationModal(this.app);
        const resultPromise = modal.waitForResult();
        log(
            `[Event] DeleteEdgeModalOpenRaw: edge=${edgeKey}, ` +
            `focusContext=${this.describeDeleteModalFocusContext()}`
        );
        try {
            await this.openDeleteModalSafely(modal, 'edge', edgeKey);
        } catch (error) {
            log(`[Event] DeleteEdgeModalOpenError: ${String(error)}`);
            new Notice('删除连线确认框打开失败');
            return;
        }

        const result = await resultPromise;
        log(`[Event] DeleteEdgeModalResult: edge=${edgeKey}, action=${result.action}`);
        if (result.action !== 'confirm') return;

        await this.waitForDeleteModalFocusSettle('edge', edgeKey);
        this.syncSelectedEdgeState(canvas, selectedEdge);
        this.ensureEdgeSelectionFallbackClasses(selectedEdge);
        await this.canvasManager.deleteSelectedEdge();
    }

    private handleDeleteButtonClick(canvasView: ItemView): void {
        const canvas = this.getCanvasFromView(canvasView);
        if (!canvas) return;

        const selectedNode = getSelectedNodeFromCanvas(canvas);
        if (selectedNode) {
            const clearedState = clearCanvasEdgeSelection(canvas);
            if (clearedState.cleared) {
                log(
                    `[Event] DeleteButtonPreferNode: node=${selectedNode.id || 'unknown'}, ` +
                    `clearedEdges=${clearedState.clearedEdgeIds.join('|') || 'none'}, domCleared=${clearedState.domClearedCount}`
                );
            }
            void this.executeDeleteOperation(selectedNode, canvas);
            return;
        }
        
        const selectedEdge = getSelectedEdge(canvas);
        if (selectedEdge) {
            void this.executeDeleteEdgeOperation(selectedEdge, canvas);
            return;
        }
    }

    // =========================================================================
    // 删除按钮相关
    // =========================================================================
    private async executeDeleteOperation(selectedNode: CanvasNodeLike, canvas: CanvasLike) {
        const edges = getEdgesFromCanvasOrFileData(canvas);
        
        const nodeId = selectedNode.id!;
        const hasChildren = this.collapseStateManager.getChildNodes(nodeId, edges).length > 0;
        
        const modal = new DeleteConfirmationModal(this.app, hasChildren);
        const resultPromise = modal.waitForResult();
        log(
            `[Event] DeleteNodeModalOpenRaw: node=${nodeId}, hasChildren=${hasChildren}, ` +
            `focusContext=${this.describeDeleteModalFocusContext()}`
        );
        try {
            await this.openDeleteModalSafely(modal, 'node', nodeId);
        } catch (error) {
            log(`[Event] DeleteNodeModalOpenError: node=${nodeId}, error=${String(error)}`);
            new Notice('删除节点确认框打开失败');
            return;
        }
        const result = await resultPromise;
        log(`[Event] DeleteNodeModalResult: node=${nodeId}, action=${result.action}`);
        
        if (result.action === 'cancel') return;

        await this.waitForDeleteModalFocusSettle('node', nodeId);
        this.collapseStateManager.clearCache();
        log(`[Event] UI: 删除 ${nodeId} (${result.action})`);
        if (result.action === 'confirm' || result.action === 'single') {
            await this.canvasManager.handleSingleDelete(selectedNode, canvas);
        } else if (result.action === 'cascade') {
            await this.canvasManager.handleCascadeDelete(selectedNode, canvas);
        }
    }

    // =========================================================================
    // 折叠按钮点击处理
    // =========================================================================
    private async handleCollapseButtonClick(nodeId: string, event: MouseEvent, canvasView: ItemView) {
        const currentTime = Date.now();
        const lastClickTime = this.clickDebounceMap.get(nodeId) || 0;
        
        if (currentTime - lastClickTime < CONSTANTS.TIMING.CLICK_DEBOUNCE) return;
        
        this.clickDebounceMap.set(nodeId, currentTime);
        event.preventDefault();
        event.stopPropagation();
        
        log(`[Event] UI: ${this.collapseStateManager.isCollapsed(nodeId) ? '展开' : '折叠'}: ${nodeId}`);
        
        try {
            await this.canvasManager.toggleNodeCollapse(nodeId);
        } finally {
            setTimeout(() => {
                if (this.clickDebounceMap.get(nodeId) === currentTime) {
                    this.clickDebounceMap.delete(nodeId);
                }
            }, CONSTANTS.TIMING.RETRY_DELAY);
        }
    }

    // =========================================================================
    // fromLink 点击处理
    // =========================================================================
    private async handleFromLinkClick(targetEl: HTMLElement, canvasView: ItemView) {
        if (this.isNativeInsertSessionActive()) return;
        if (shouldBypassCanvasNodeGestureTarget(targetEl)) return;

        const nodeEl = findCanvasNodeElementFromTarget(targetEl);
        if (!nodeEl) return;

        const canvas = this.getCanvasFromView(canvasView);
        if (!canvas?.nodes) return;

        const clickedNode = getCanvasNodeByElement(canvas, nodeEl);
        if (!clickedNode) return;

        await this.navigateToFromLink(clickedNode);
    }

    private async handleFromLinkNavigationByNodeId(nodeId: string | null): Promise<void> {
        if (!nodeId) return;

        const canvasView = getCanvasView(this.app);
        if (!canvasView) return;

        const canvas = this.getCanvasFromView(canvasView);
        if (!canvas?.nodes) return;

        const clickedNode = getNodesFromCanvas(canvas).find(node => node.id === nodeId) || null;
        if (!clickedNode) {
            log(`[Event] fromLink 跳转失败: 找不到节点 ${nodeId}`);
            return;
        }

        await this.navigateToFromLink(clickedNode);
    }

    private async navigateToFromLink(clickedNode: CanvasNodeLike): Promise<void> {
        const canvasView = getCanvasView(this.app);
        if (!canvasView) return;

        this.rememberNodeInteractionContext(clickedNode.id || null, 'fromlink-navigate', canvasView);

        const fromLink = parseFromLink(clickedNode.text, clickedNode.color) as FromLinkInfo | null;
        if (!fromLink) {
            if (clickedNode.text?.includes('fromLink:')) {
                log(`[Event] fromLink 解析失败: text`);
            } else if (clickedNode.color?.startsWith('fromLink:')) {
                log(`[Event] fromLink (color) 解析失败`);
            }
            return;
        }

        const now = Date.now();
        const navKey = `${clickedNode.id || 'unknown'}|${fromLink.file}|${fromLink.from.line}:${fromLink.from.ch}-${fromLink.to.line}:${fromLink.to.ch}`;
        if (
            this.lastFromLinkNavKey === navKey
            && now - this.lastFromLinkNavAt < CONSTANTS.TIMING.FROM_LINK_NAV_DEBOUNCE
        ) {
            log(`[Event] fromLink 跳转防抖: skip duplicate within ${CONSTANTS.TIMING.FROM_LINK_NAV_DEBOUNCE}ms -> ${fromLink.file}`);
            return;
        }

        this.lastFromLinkNavKey = navKey;
        this.lastFromLinkNavAt = now;
        
        log(`[Event] UI: 跳转 fromLink -> ${fromLink.file}`);
        try {
            let sourceFile = this.app.vault.getAbstractFileByPath(fromLink.file);

            // 精确路径失败时，尝试按末级文件名回退查找（兼容文件被移动/重命名目录）
            if (!(sourceFile instanceof TFile)) {
                const fileName = fromLink.file.split('/').pop();
                if (fileName) {
                    const allFiles = this.app.vault.getFiles();
                    sourceFile = allFiles.find(file => file.path.endsWith(`/${fromLink.file}`))
                        ?? allFiles.find(file => file.name === fileName)
                        ?? sourceFile;
                }
            }

            if (!(sourceFile instanceof TFile)) {
                log(`[Event] fromLink 找不到源文件: ${fromLink.file}`);
                new Notice(`找不到源文件: ${fromLink.file}`);
                return;
            }

            let mdLeaf = this.app.workspace.getLeavesOfType('markdown').find(
                leaf => (leaf.view as MarkdownViewLike).file?.path === sourceFile.path
            );
            if (!mdLeaf) {
                mdLeaf = this.app.workspace.getLeaf('split', 'vertical');
                await mdLeaf.openFile(sourceFile);
            } else {
                setActiveLeafSafe(this.app, mdLeaf, { focus: true });
            }

            const view = mdLeaf.view as MarkdownViewLike;

            // 移动端（尤其是墨水屏）渲染较慢，需要更长的初始延迟才能让编辑器就绪
            const initialDelay = Platform.isMobile
                ? CONSTANTS.TIMING.MOBILE_SELECTION_DELAY
                : CONSTANTS.TIMING.SCROLL_DELAY;

            const applySelection = () => {
                const editor = view.editor;
                if (!editor) return;
                // 强制聚焦编辑器，确保选区能被接受
                editor.focus?.();
                editor.setSelection(fromLink.from, fromLink.to);
                editor.scrollIntoView({ from: fromLink.from, to: fromLink.to }, true);
                log(`[Event] fromLink 选区已应用: L${fromLink.from.line}:${fromLink.from.ch}-${fromLink.to.ch}`);
            };

            setTimeout(() => {
                applySelection();
                // 移动端额外重试一次，防止视图切换动画完成后选区被重置
                if (Platform.isMobile) {
                    setTimeout(applySelection, CONSTANTS.TIMING.MOBILE_SELECTION_RETRY_DELAY);
                }
            }, initialDelay);
        } catch (err) {
            log(`[Event] UI: 跳转失败: ${String(err)}`);
        }
    }

    // =========================================================================
    // Canvas 事件监听（使用 Obsidian 官方事件系统）
    // =========================================================================
    async setupCanvasEventListeners(canvasView: ItemView) {
        const canvas = this.getCanvasFromView(canvasView);
        const canvasFilePath = canvas?.file?.path || (canvasView as CanvasViewLike).file?.path;
        
        // [A2] 监听器防重日志 - 记录调用次数和路径
        this.setupCallCount++;
        const currentToken = ++this.setupTokenCounter;
        const isDuplicate = this.lastSetupPath === canvasFilePath && canvasFilePath !== null;
        
        logVerbose(`[Event] setupCanvasEventListeners(#${this.setupCallCount}): token=${currentToken}, path=${canvasFilePath || 'null'}, duplicate=${isDuplicate}, isSettingUp=${this.isSettingUp}`);
        
        // [B1] 幂等化 - 防止重复 setup
        if (this.isSettingUp) {
            logVerbose(`[Event] setupCanvasEventListeners: 跳过（正在设置中）`);
            return;
        }
        
        // 如果是同一路径且已注册过，跳过
        if (isDuplicate && this.workspaceEventsRegistered) {
            logVerbose(`[Event] setupCanvasEventListeners: 跳过（同一路径已注册）path=${canvasFilePath}, registered=${this.workspaceEventsRegistered}`);
            return;
        }
        
        this.isSettingUp = true;
        
        try {
            logVerbose(`[Event] setupCanvasEventListeners 被调用, canvas=${canvas ? 'exists' : 'null'}`);
            
            if (!canvas) {
                log(`[Event] canvas 不存在，跳过设置`);
                return;
            }

            log(`[Event] canvasFilePath=${canvasFilePath || 'null'}`);
            this.currentCanvasFilePath = canvasFilePath || null;
            this.installNativeInsertEngineDiagnostics(canvas);
            
            // 更新路径记录
            this.lastSetupPath = canvasFilePath || null;
            
            if (canvas) {
                const edges = getEdgesFromCanvas(canvas);
                this.lastEdgeIds = buildEdgeIdSet(edges);
                log(`[Event] 初始化边快照: edges=${edges.length}`);
            }
            
            if (canvasFilePath) {
                log(`[Event] 正在初始化 FloatingNodeService...`);
                await this.floatingNodeService.initialize(canvasFilePath, canvas);
                log(`[Event] FloatingNodeService 初始化完成`);
            } else {
                log(`[Event] 警告: 无法获取 canvas 文件路径，跳过 FloatingNodeService 初始化`);
            }

            // [B1] 只有在工作区事件未注册时才注册
            if (!this.workspaceEventsRegistered) {
                this.registerCanvasWorkspaceEvents(canvas);
                this.workspaceEventsRegistered = true;
                this.workspaceEventsPath = canvasFilePath || null;
                logVerbose(`[Event] setupCanvasEventListeners: 工作区事件首次注册, path=${canvasFilePath || 'null'}`);
            } else {
                logVerbose(`[Event] setupCanvasEventListeners: 跳过注册（已注册）, path=${this.workspaceEventsPath}`);
            }
        } finally {
            this.isSettingUp = false;
        }
    }

    private async handleCanvasFileModified(filePath: string): Promise<void> {
        logVerbose(`[Event] Canvas 文件变更: ${filePath}`);
        
        // 如果正在执行删除操作，跳过新边检测（防止删边后被误判为新边）
        if (this.isDeleting) {
            log(`[Event] 跳过新边检测（正在删除操作中）`);
            return;
        }
        
        const data = await this.canvasManager.getCanvasFileService().readCanvasData(filePath);
        if (!data) {
            log(`[Event] Canvas 文件读取失败: ${filePath}`);
            return;
        }
        const edges = data.edges || [];
        const { newEdges, edgeIds: newEdgeIds } = detectNewEdges(edges, this.lastEdgeIds);

        if (newEdges.length > 0) {
            log(`[Event] Canvas 文件检测到新边: ${newEdges.length}`);
            for (const edge of newEdges) {
                await this.floatingNodeService.handleNewEdge(edge, true);
            }
            this.canvasManager.checkAndAddCollapseButtons();
        }

        this.lastEdgeIds = newEdgeIds;
    }

    private registerCanvasWorkspaceEvents(canvas: CanvasLike) {
        this.plugin.registerEvent(
            this.app.workspace.on('canvas:edge-create', (edge: CanvasEdgeLike) => {
                void (async () => {
                    if (this.isDeleting) {
                        const { fromId, toId } = extractEdgeNodeIds(edge);
                        log(`[Event] Canvas:EdgeCreate 忽略（删除操作中）: ${edge.id} (${fromId} -> ${toId})`);
                        return;
                    }

                    const { fromId, toId } = extractEdgeNodeIds(edge);
                    log(`[Event] Canvas:EdgeCreate: ${edge.id} (${fromId} -> ${toId})`);

                    this.collapseStateManager.clearCache();
                    const activeCanvasView = getActiveCanvasView(this.app);
                    if (activeCanvasView) {
                        const activeCanvas = (activeCanvasView as CanvasViewLike).canvas;
                        if (activeCanvas && activeCanvas === canvas) {
                            this.floatingNodeService.startEdgeDetectionWindow(activeCanvas);
                        }
                    }
                    requestAnimationFrame(() => {
                        void (async () => {
                            try {
                                await this.floatingNodeService.handleNewEdge(edge, false);
                            } catch (err) {
                                log(`[EdgeCreate] 异常: ${String(err)}`);
                            }
                        })();
                    });
                    this.canvasManager.checkAndAddCollapseButtons();
                    for (const delay of CONSTANTS.BUTTON_CHECK_INTERVALS) {
                        setTimeout(() => {
                            void this.canvasManager.checkAndAddCollapseButtons();
                            void this.canvasManager.checkAndClearFloatingStateForNewEdges();
                        }, delay);
                    }
                })();
            })
        );

        this.plugin.registerEvent(
            this.app.workspace.on('canvas:edge-delete', (edge: CanvasEdgeLike) => {
                const { fromId, toId } = extractEdgeNodeIds(edge);
                log(`[Event] Canvas:EdgeDelete: ${edge.id} (${fromId} -> ${toId})`);

                this.collapseStateManager.clearCache();
                void this.canvasManager.checkAndAddCollapseButtons();
            })
        );

        this.plugin.registerEvent(
            this.app.workspace.on('canvas:change', () => {
                if (this.isDeleting) {
                    log(`[Event] Canvas:Change 忽略（删除操作中）`);
                    return;
                }

                // [诊断] 添加 invocationId 区分不同触发
                const invocationId = `chg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                log(`[Event] Canvas:Change start id=${invocationId}, trigger=file-change`);
                if (this.canvasChangeTimeoutId !== null) {
                    log(`[Event] Canvas:Change 清理上一次防抖任务, id=${invocationId}`);
                    window.clearTimeout(this.canvasChangeTimeoutId);
                }
                this.canvasChangeTimeoutId = window.setTimeout(() => {
                    this.canvasChangeTimeoutId = null;
                    log(`[Event] Canvas:Change run id=${invocationId}, trigger=file-change`);
                    void this.canvasManager.checkAndClearFloatingStateForNewEdges();
                    void this.canvasManager.checkAndAddCollapseButtons();
                }, CONSTANTS.TIMING.BUTTON_CHECK_DEBOUNCE);
            })
        );

        this.plugin.registerEvent(
            this.app.workspace.on('canvas:node-create', (node: CanvasNodeLike) => {
                void (async () => {
                    const nodeId = node?.id;
                    log(`[Event] Canvas:NodeCreate 触发, node=${JSON.stringify(nodeId || node)}`);
                    this.noteNativeInsertNodeCreate(nodeId || null);
                    if (nodeId) {
                        const isFloating = await this.floatingNodeService.isNodeFloating(nodeId);
                        if (isFloating) {
                            await this.floatingNodeService.clearNodeFloatingState(nodeId);
                        }
                        if (this.shouldSuppressSideEffectsForNativeInsert()) {
                            this.deferredAdjustNodeIds.add(nodeId);
                            this.scheduleDeferredPostInsertMaintenance(`node-create:${nodeId}`);
                            logVerbose(`[Event] NativeInsertDeferredAdjustNodeHeight: node=${nodeId}`);
                        } else {
                            log(`[Event] Canvas:NodeCreate 调用 scheduleNodeHeightAdjustment: ${nodeId}`);
                            this.canvasManager.scheduleNodeHeightAdjustment(
                                nodeId,
                                CONSTANTS.TIMING.SCROLL_DELAY,
                                'workspace:node-create'
                            );
                        }
                    } else {
                        log(`[Event] Canvas:NodeCreate 警告: node.id 为空`);
                    }
                })();
            })
        );

        this.plugin.registerEvent(
            this.app.workspace.on('canvas:node-delete', (node: CanvasNodeLike) => {
                log(`[Event] Canvas:NodeDelete: ${node.id}`);
                void this.floatingNodeService.clearFloatingMarks(node);
                void this.canvasManager.checkAndAddCollapseButtons();
            })
        );

        this.plugin.registerEvent(
            this.app.workspace.on('canvas:node-move', (node: CanvasNodeLike) => {
                this.nodeMountedInteractionActiveUntil = Date.now() + this.nodeMountedInteractionIdleMs;
                this.markSuppressFromLinkClick(node?.id || null, 900, 'canvas-node-move');
                const activeGesture = this.activePointerGesture;
                if (activeGesture && node?.id && activeGesture.nodeId === node.id) {
                    this.activeTouchDragSawCanvasNodeMove = true;
                    if (this.isTouchLikePointer(activeGesture.pointerType)) {
                        log(`[Event] DragCanvasNodeMove: node=${node.id}, pointer=${activeGesture.pointerType}, matchedActiveGesture=true`);
                    }
                }
                void this.canvasManager.syncHiddenChildrenOnDrag(node);
            })
        );

        log(`[Event] Canvas 工作区事件已注册`);
    }

    // =========================================================================
    // MutationObserver
    // =========================================================================
    private setupMutationObserver() {
        if (this.isObserverSetup) return;

        const canvasView = getCanvasView(this.app);
        if (!canvasView) return;

        const canvasWrapper = document.querySelector('.canvas-wrapper') || 
                             document.querySelector('.canvas-node-container') ||
                             document.querySelector('.canvas');
        
        if (!canvasWrapper) {
            this.mutationObserverRetryCount++;
            if (this.mutationObserverRetryCount <= this.MAX_MUTATION_OBSERVER_RETRIES) {
                setTimeout(() => this.setupMutationObserver(), CONSTANTS.TIMING.SCROLL_DELAY);
            } else {
                this.isObserverSetup = true;
            }
            return;
        }

        this.mutationObserver = new MutationObserver((mutations) => {
            let shouldCheckButtons = false;
            let mountedNodeCount = 0;
            const mountedNodeIds = new Set<string>();
            const nativeInsertSession = this.activeNativeInsertSession;
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    if (nativeInsertSession) {
                        for (const addedNode of Array.from(mutation.addedNodes)) {
                            const addedPlaceholders = this.collectMutationElementsByClass(addedNode, 'canvas-node-placeholder');
                            if (addedPlaceholders.length > 0) {
                                nativeInsertSession.placeholderSeen = true;
                                nativeInsertSession.placeholderAddedCount += addedPlaceholders.length;
                                logVerbose(
                                    `[Event] NativeInsertPlaceholderMutation: trace=${nativeInsertSession.traceId}, action=added, ` +
                                    `count=${addedPlaceholders.length}, samples=${this.describeMutationSamples(addedPlaceholders)}`
                                );
                            }

                            const addedCanvasNodes = this.collectMutationElementsByClass(addedNode, 'canvas-node');
                            if (addedCanvasNodes.length > 0) {
                                nativeInsertSession.domNodeAddedCount += addedCanvasNodes.length;
                                logVerbose(
                                    `[Event] NativeInsertDomNodeMutation: trace=${nativeInsertSession.traceId}, action=added, ` +
                                    `count=${addedCanvasNodes.length}, samples=${this.describeMutationSamples(addedCanvasNodes)}`
                                );
                            }
                        }

                        for (const removedNode of Array.from(mutation.removedNodes)) {
                            const removedPlaceholders = this.collectMutationElementsByClass(removedNode, 'canvas-node-placeholder');
                            if (removedPlaceholders.length > 0) {
                                nativeInsertSession.placeholderRemovedCount += removedPlaceholders.length;
                                logVerbose(
                                    `[Event] NativeInsertPlaceholderMutation: trace=${nativeInsertSession.traceId}, action=removed, ` +
                                    `count=${removedPlaceholders.length}, samples=${this.describeMutationSamples(removedPlaceholders)}`
                                );
                            }

                            const removedCanvasNodes = this.collectMutationElementsByClass(removedNode, 'canvas-node');
                            if (removedCanvasNodes.length > 0) {
                                nativeInsertSession.domNodeRemovedCount += removedCanvasNodes.length;
                                logVerbose(
                                    `[Event] NativeInsertDomNodeMutation: trace=${nativeInsertSession.traceId}, action=removed, ` +
                                    `count=${removedCanvasNodes.length}, samples=${this.describeMutationSamples(removedCanvasNodes)}`
                                );
                            }
                        }
                    }

                    for (const node of Array.from(mutation.addedNodes)) {
                        if (node instanceof HTMLElement && node.classList.contains('canvas-node')) {
                            shouldCheckButtons = true;
                            mountedNodeCount++;
                            const mountedNodeId = this.extractNodeIdFromElement(node);
                            if (mountedNodeId) {
                                mountedNodeIds.add(mountedNodeId);
                            }
                        }
                    }
                }
            }

            if (shouldCheckButtons) {
                if (this.shouldSuppressSideEffectsForNativeInsert()) {
                    for (const mountedNodeId of mountedNodeIds) {
                        this.deferredAdjustNodeIds.add(mountedNodeId);
                    }
                    logVerbose(`[Event] NativeInsertSuppressedSideEffects: reason=node-mounted, mountedNodeCount=${mountedNodeCount}`);
                    this.scheduleDeferredPostInsertMaintenance(`node-mounted:${mountedNodeCount}`);
                } else {
                    void this.canvasManager.checkAndAddCollapseButtons();
                    for (const mountedNodeId of mountedNodeIds) {
                        this.canvasManager.notifyNodeMountedVisible?.(
                            mountedNodeId,
                            'node-mounted-visible'
                        );
                    }
                    const activeCanvasView = getCanvasView(this.app);
                    const activeCanvas = activeCanvasView ? this.getCanvasFromView(activeCanvasView) : null;
                    if (activeCanvas) {
                        const hiddenCount = this.canvasManager.reapplyCurrentCollapseVisibility(
                            activeCanvas,
                            `node-mounted:${mountedNodeCount}`
                        );
                        if (hiddenCount > 0) {
                            log(`[Event] NodeMountedReapplyCollapseVisibility: hidden=${hiddenCount}, mountedNodeCount=${mountedNodeCount}`);
                        }
                    }
                    const scrollSyncDelay = Platform.isMobile ? 120 : 60;
                    window.setTimeout(() => {
                        const updated = this.canvasManager.syncScrollableStateForMountedNodes();
                        if (updated > 0) {
                            log(`[Event] NodeMountedScrollSync: updated=${updated}, mountedNodeCount=${mountedNodeCount}`);
                        }
                    }, scrollSyncDelay);
                }
            }

            // [OpenFix-3] 节点晚到挂载兜底：虚拟化节点在 reopen 后分批进入 DOM，
            // 这里去重触发一次 open stabilization，收敛边端点与样式层。
            if (mountedNodeCount > 0) {
                const canvasView = getCanvasView(this.app);
                const filePath = (canvasView ? this.getCanvasFromView(canvasView)?.file?.path : null)
                    || this.currentCanvasFilePath;
                this.queueNodeMountedStabilization(filePath || null, mountedNodeCount);
            }
        });

        this.mutationObserver.observe(canvasWrapper, { childList: true, subtree: true });
        this.isObserverSetup = true;
        this.plugin.register(() => this.mutationObserver?.disconnect());

        this.setupFocusMutationObserver(canvasWrapper);
    }

    private setupFocusMutationObserver(canvasWrapper: Element): void {
        if (this.focusMutationObserver) return;

        this.focusMutationObserver = new MutationObserver((mutations) => {
            const gainedNodeIds = new Set<string>();
            const lostNodeIds = new Set<string>();

            for (const mutation of mutations) {
                if (mutation.type !== 'attributes' || mutation.attributeName !== 'class') continue;

                const target = mutation.target as HTMLElement;
                if (!target?.classList?.contains('canvas-node')) continue;

                const hasFocus = target.classList.contains('is-focused') || target.classList.contains('is-editing');
                const hasSelection = target.classList.contains('is-selected');
                const nodeIdFromTarget = this.extractNodeIdFromElement(target);
                if (!nodeIdFromTarget) continue;

                if (hasFocus || hasSelection) {
                    gainedNodeIds.add(nodeIdFromTarget);
                    continue;
                }

                lostNodeIds.add(nodeIdFromTarget);
            }

            const reason = gainedNodeIds.size > 0 ? 'focus-gained' : 'focus-reconciled';
            const activeNodeId = this.reconcileFocusedNodeContext(reason);

            if (!activeNodeId && lostNodeIds.size > 0) {
                this.lastFocusedNodeId = null;
            }

            for (const nodeId of lostNodeIds) {
                if (nodeId === activeNodeId || gainedNodeIds.has(nodeId)) {
                    this.cancelFocusLostMeasurement(nodeId);
                    continue;
                }
                this.scheduleFocusLostMeasurement(nodeId, 'focus-lost');
            }
        });

        this.focusMutationObserver.observe(canvasWrapper, {
            attributes: true,
            attributeFilter: ['class'],
            subtree: true
        });

        this.plugin.register(() => this.focusMutationObserver?.disconnect());
    }

    private extractNodeIdFromElement(nodeEl: HTMLElement): string | null {
        const nodeIdAttr = nodeEl.getAttribute('data-node-id') || nodeEl.getAttribute('data-id');
        if (nodeIdAttr) return nodeIdAttr;

        const match = nodeEl.id?.match(/node-(.+)/);
        if (match?.[1]) return match[1];

        const canvasView = getCanvasView(this.app);
        const canvas = canvasView ? (canvasView as CanvasViewLike).canvas : null;
        if (!canvas) return null;
        const matchedNode = getCanvasNodeByElement(canvas, nodeEl);
        return matchedNode?.id || null;
    }
    
    // =========================================================================
    // 删除操作标志控制（防止删边后被误判为新边）
    // =========================================================================
    
    /**
     * 开始删除操作，暂停新边检测
     */
    startDeletingOperation(): void {
        this.isDeleting = true;
        log(`[Event] 开始删除操作，暂停新边检测`);
    }

    /**
     * 结束删除操作，恢复新边检测并更新边快照
     */
    endDeletingOperation(canvas: CanvasLike | null): void {
        this.isDeleting = false;
        const activeCanvasView = getCanvasView(this.app);
        const effectiveCanvas = canvas ?? (activeCanvasView ? this.getCanvasFromView(activeCanvasView) : null);
        if (effectiveCanvas) {
            const edges = getEdgesFromCanvas(effectiveCanvas);
            this.lastEdgeIds = buildEdgeIdSet(edges);
            log(`[Event] 结束删除操作，更新边快照: edges=${edges.length}`);
        } else {
            log(`[Event] 结束删除操作，canvas为空无法更新快照`);
        }
    }

    // =========================================================================
    // [ViewportFix] Viewport 变化监听（屏幕旋转/分屏切换）
    // =========================================================================
    /**
     * 注册 resize 和 orientationchange 事件监听。
     * 当设备旋转或分屏切换时，Canvas 内大量节点会被虚拟化，
     * 需要在 Canvas 引擎重新渲染节点后刷新所有边的几何位置。
     */
    private setupViewportChangeListener(): void {
        if (this.isViewportListenerSetup) return;
        this.isViewportListenerSetup = true;

        // 记录初始尺寸
        this.lastViewportWidth = window.innerWidth;
        this.lastViewportHeight = window.innerHeight;

        const handleViewportChange = (trigger: string) => {
            const newWidth = window.innerWidth;
            const newHeight = window.innerHeight;
            const widthDelta = Math.abs(newWidth - this.lastViewportWidth);
            const heightDelta = Math.abs(newHeight - this.lastViewportHeight);

            // 忽略微小变化（例如键盘弹出等），只响应显著的尺寸变化
            const minChangeThreshold = 50;
            if (widthDelta < minChangeThreshold && heightDelta < minChangeThreshold) return;

            const viewportToken = ++this.viewportTokenCounter;
            this.activeViewportToken = viewportToken;
            const traceId = this.createViewportTraceId(trigger);
            this.viewportState = 'debouncing';

            this.logViewportTrace(traceId, 'detected', viewportToken, getCanvasView(this.app), {
                trigger,
                prev: `${this.lastViewportWidth}x${this.lastViewportHeight}`,
                next: `${newWidth}x${newHeight}`,
                widthDelta,
                heightDelta
            });
            this.lastViewportWidth = newWidth;
            this.lastViewportHeight = newHeight;

            // 防抖处理
            if (this.viewportChangeDebounceId !== null) {
                window.clearTimeout(this.viewportChangeDebounceId);
            }

            const debounceDelay = CONSTANTS.TIMING.VIEWPORT_CHANGE_DEBOUNCE;
            // 移动端额外增加等待时间（等待旋转动画完成）
            const extraDelay = Platform.isMobile ? CONSTANTS.TIMING.VIEWPORT_CHANGE_EXTRA_DELAY_MOBILE : 0;

            // [修复] 设置 pending 标记：如果 debounce 触发时 canvas 不可用，
            // canvas 重新激活时会补充执行刷新（解决旋转时 canvas 临时关闭导致刷新错过的问题）
            this.pendingViewportRefresh = true;
            this.lastViewportChangeTrigger = trigger;
            this.pendingViewportToken = viewportToken;
            this.pendingViewportTraceId = traceId;

            this.viewportChangeDebounceId = window.setTimeout(() => {
                this.viewportChangeDebounceId = null;

                if (viewportToken !== this.activeViewportToken) {
                    this.logViewportTrace(traceId, 'canceled', viewportToken, getCanvasView(this.app), {
                        trigger,
                        reason: 'token-overridden-before-debounce-run',
                        activeToken: this.activeViewportToken
                    });
                    return;
                }

                this.logViewportTrace(traceId, 'debounce-fired', viewportToken, getCanvasView(this.app), {
                    trigger,
                    debounceDelay,
                    extraDelay
                });

                // 获取当前活跃的 canvas
                const canvasView = getCanvasView(this.app);
                if (!canvasView) {
                    // Canvas 不可用，保留 pendingViewportRefresh=true，等 canvas 重新激活时处理
                    this.viewportState = 'pending-canvas';
                    this.logViewportTrace(traceId, 'pending-canvas', viewportToken, null, {
                        trigger,
                        reason: 'canvas-view-unavailable'
                    });
                    return;
                }

                const canvas = (canvasView as CanvasViewLike).canvas;
                if (!canvas) {
                    this.viewportState = 'pending-canvas';
                    this.logViewportTrace(traceId, 'pending-canvas', viewportToken, canvasView, {
                        trigger,
                        reason: 'canvas-instance-unavailable'
                    });
                    return;
                }

                const edges = getEdgesFromCanvas(canvas);
                if (edges.length === 0) {
                    this.pendingViewportRefresh = false;
                    this.pendingViewportToken = 0;
                    this.pendingViewportTraceId = '';
                    this.viewportState = 'stable';
                    this.logViewportTrace(traceId, 'skip', viewportToken, canvasView, {
                        trigger,
                        reason: 'edges-empty'
                    });
                    return;
                }

                this.logViewportTrace(traceId, 'refresh-scheduled', viewportToken, canvasView, {
                    trigger,
                    edges: edges.length,
                    extraDelay
                });
                this.pendingViewportRefresh = false; // 即将执行刷新，清除 pending 标记
                this.pendingViewportToken = 0;
                this.pendingViewportTraceId = '';

                // 若有额外延迟（移动端旋转动画），先等待
                const doRefresh = () => {
                    void this.convergeCanvasEdgesAfterViewportChange(
                        canvas,
                        `viewport-${trigger}`,
                        traceId,
                        viewportToken,
                        canvasView
                    );
                };

                if (extraDelay > 0) {
                    window.setTimeout(doRefresh, extraDelay);
                } else {
                    doRefresh();
                }
            }, debounceDelay);
        };

        // 监听 resize 事件（分屏切换/窗口大小变化）
        this.plugin.registerDomEvent(window, 'resize', () => handleViewportChange('resize'));

        // 监听 orientationchange 事件（设备旋转）
        if ('onorientationchange' in window) {
            this.plugin.registerDomEvent(window, 'orientationchange', () => {
                // orientationchange 触发时 innerWidth/Height 尚未更新，等一帧再读
                requestAnimationFrame(() => handleViewportChange('orientationchange'));
            });
        }

        log(`[ViewportFix] Viewport 变化监听已注册 (mobile=${Platform.isMobile})`);
    }

    private createViewportTraceId(trigger: string): string {
        this.viewportTraceSeq += 1;
        return `vp-${Date.now().toString(36)}-${this.viewportTraceSeq.toString(36)}-${trigger}`;
    }

    private getCanvasLeafRect(view: ItemView | null): DOMRect | null {
        const leaf = (view as { leaf?: { containerEl?: HTMLElement } })?.leaf;
        const containerEl = leaf?.containerEl;
        if (!containerEl) return null;
        return containerEl.getBoundingClientRect();
    }

    private inferSplitMode(leafRect: DOMRect | null): string {
        if (!leafRect) return 'unknown';
        const ww = Math.max(window.innerWidth, 1);
        const wh = Math.max(window.innerHeight, 1);
        const wr = leafRect.width / ww;
        const hr = leafRect.height / wh;

        if (wr >= 0.75 && hr >= 0.75) return 'full';
        if (wr < 0.75 && hr >= 0.75) return 'split-left-right';
        if (wr >= 0.75 && hr < 0.75) return 'split-top-bottom';
        return 'split-grid';
    }

    private getOrientationLabel(): string {
        const orientationType = (window.screen as Screen & { orientation?: { type?: string } }).orientation?.type;
        if (orientationType) {
            return orientationType.includes('portrait') ? 'portrait' : 'landscape';
        }
        return window.innerHeight >= window.innerWidth ? 'portrait' : 'landscape';
    }

    private getVisualViewportInfo(): { width: number; height: number; scale: number } | null {
        const vv = window.visualViewport;
        if (!vv) return null;
        return {
            width: Math.round(vv.width),
            height: Math.round(vv.height),
            scale: Number(vv.scale.toFixed(3))
        };
    }

    private logViewportTrace(
        traceId: string,
        phase: string,
        token: number,
        canvasView: ItemView | null,
        extra?: Record<string, unknown>
    ): void {
        const leafRect = this.getCanvasLeafRect(canvasView);
        const leafRectStr = leafRect
            ? `${leafRect.left.toFixed(0)},${leafRect.top.toFixed(0)}->${leafRect.right.toFixed(0)},${leafRect.bottom.toFixed(0)} (${leafRect.width.toFixed(0)}x${leafRect.height.toFixed(0)})`
            : 'n/a';

        const splitMode = this.inferSplitMode(leafRect);
        const orientation = this.getOrientationLabel();
        const vv = this.getVisualViewportInfo();
        const vvStr = vv ? `${vv.width}x${vv.height}@${vv.scale}` : 'n/a';

        const payload = {
            traceId,
            phase,
            token,
            state: this.viewportState,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            orientation,
            dpr: Number(window.devicePixelRatio.toFixed(2)),
            visualViewport: vvStr,
            splitMode,
            leafRect: leafRectStr,
            pending: this.pendingViewportRefresh,
            activeToken: this.activeViewportToken,
            ...extra
        };

        log(`[ViewportTrace] ${JSON.stringify(payload)}`);
    }

    private captureEdgeSignatures(canvas: CanvasLike): Map<string, { bezier: string; pathD: string; endpoint: string }> {
        const map = new Map<string, { bezier: string; pathD: string; endpoint: string }>();
        const edges = getEdgesFromCanvas(canvas);

        for (const edge of edges) {
            const edgeId = edge.id || `${edge.fromNode || 'from'}->${edge.toNode || 'to'}`;
            const bezier = (edge).bezier;
            const bezierSig = bezier
                ? `${bezier.from?.x?.toFixed?.(1) || 'na'},${bezier.from?.y?.toFixed?.(1) || 'na'}->${bezier.to?.x?.toFixed?.(1) || 'na'},${bezier.to?.y?.toFixed?.(1) || 'na'}`
                : 'no-bezier';

            let pathEl: Element | null = (edge).pathEl || null;
            if (!pathEl) {
                const lineGroupEl = (edge).lineGroupEl as Element | null;
                if (lineGroupEl) {
                    pathEl = lineGroupEl.querySelector('path');
                }
            }
            const pathD = pathEl ? pathEl.getAttribute('d') || 'no-d' : 'no-path';

            const fromNode = edge.fromNode || extractNodeId(edge.from);
            const toNode = edge.toNode || extractNodeId(edge.to);
            const fromSide = edge.fromSide || (typeof edge.from === 'object' ? (edge.from)?.side : undefined) || 'unknown';
            const toSide = edge.toSide || (typeof edge.to === 'object' ? (edge.to)?.side : undefined) || 'unknown';
            const endpoint = `${fromNode || 'unknown'}:${fromSide}->${toNode || 'unknown'}:${toSide}`;

            map.set(edgeId, { bezier: bezierSig, pathD, endpoint });
        }

        return map;
    }

    private diffEdgeSignatures(
        before: Map<string, { bezier: string; pathD: string; endpoint: string }>,
        after: Map<string, { bezier: string; pathD: string; endpoint: string }>
    ): { bezierChanged: number; pathChanged: number; endpointChanged: number } {
        let bezierChanged = 0;
        let pathChanged = 0;
        let endpointChanged = 0;

        for (const [edgeId, beforeSig] of before.entries()) {
            const afterSig = after.get(edgeId);
            if (!afterSig) continue;
            if (beforeSig.bezier !== afterSig.bezier) bezierChanged++;
            if (beforeSig.pathD !== afterSig.pathD) pathChanged++;
            if (beforeSig.endpoint !== afterSig.endpoint) endpointChanged++;
        }

        return { bezierChanged, pathChanged, endpointChanged };
    }

    private async waitForEngineFrame(delayMs: number): Promise<void> {
        await new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
                window.setTimeout(() => resolve(), delayMs);
            });
        });
    }

    private async convergeCanvasEdgesAfterViewportChange(
        canvas: CanvasLike,
        reason: string,
        traceId: string,
        token: number,
        canvasView: ItemView | null
    ): Promise<void> {
        if (token !== this.activeViewportToken) {
            this.logViewportTrace(traceId, 'converge-skip', token, canvasView, {
                reason,
                stopReason: 'token-mismatch-before-start',
                activeToken: this.activeViewportToken
            });
            return;
        }

        const initialEdges = getEdgesFromCanvas(canvas);
        if (initialEdges.length === 0) {
            this.viewportState = 'stable';
            this.logViewportTrace(traceId, 'converge-skip', token, canvasView, {
                reason,
                stopReason: 'edges-empty-before-start'
            });
            return;
        }

        this.viewportState = 'converging';
        const maxPass = Platform.isMobile ? 5 : 3;
        const passInterval = Platform.isMobile
            ? CONSTANTS.TIMING.EDGE_REFRESH_EXTRA_PASS_INTERVAL
            : Math.max(80, CONSTANTS.TIMING.EDGE_REFRESH_PASS_INTERVAL);

        this.logViewportTrace(traceId, 'converge-start', token, canvasView, {
            reason,
            edges: initialEdges.length,
            maxPass,
            passInterval,
            stablePassRequired: this.viewportStablePassRequired
        });

        let stablePasses = 0;
        for (let pass = 1; pass <= maxPass; pass++) {
            if (token !== this.activeViewportToken) {
                this.viewportState = 'idle';
                this.logViewportTrace(traceId, 'converge-stop', token, canvasView, {
                    reason,
                    stopReason: 'token-canceled-during-pass',
                    pass,
                    activeToken: this.activeViewportToken
                });
                return;
            }

            const edges = getEdgesFromCanvas(canvas);
            const before = this.captureEdgeSignatures(canvas);

            let rendered = 0;
            for (const edge of edges) {
                if (typeof (edge).render === 'function') {
                    try {
                        (edge).render();
                        rendered++;
                    } catch {
                        // 单边失败不阻断收敛
                    }
                }
            }

            requestCanvasUpdate(canvas);

            await this.waitForEngineFrame(passInterval);

            const after = this.captureEdgeSignatures(canvas);
            const diff = this.diffEdgeSignatures(before, after);
            const converged = diff.bezierChanged === 0 && diff.pathChanged === 0 && diff.endpointChanged === 0;
            stablePasses = converged ? stablePasses + 1 : 0;

            this.logViewportTrace(traceId, 'converge-pass', token, canvasView, {
                reason,
                pass,
                rendered,
                edges: edges.length,
                bezierChanged: diff.bezierChanged,
                pathChanged: diff.pathChanged,
                endpointChanged: diff.endpointChanged,
                stablePasses,
                converged
            });

            if (stablePasses >= this.viewportStablePassRequired) {
                this.viewportState = 'stable';
                this.logViewportTrace(traceId, 'converge-stop', token, canvasView, {
                    reason,
                    pass,
                    stopReason: 'stable'
                });
                // [Fix D] 边收敛后刷新可见节点高度，适配 T13C 的新 DPI/字体环境
                this.scheduleHeightRefreshAfterViewportChange(traceId, token, reason);
                return;
            }
        }

        this.viewportState = 'stable';
        this.logViewportTrace(traceId, 'converge-stop', token, canvasView, {
            reason,
            stopReason: 'max-pass-reached',
            maxPass
        });
        // 收敛后仍触发一次高度刷新（max-pass 未完全收敛时的兜底）
        this.scheduleHeightRefreshAfterViewportChange(traceId, token, reason);
    }

    /**
     * [Fix D] Viewport 变化后，延迟刷新可见节点高度
     * 场景：T13C 墨水屏旋转/分屏后，DPI 或字体环境可能变化，
     * 导致 trusted-env-mismatch 失效，需要重新测量 DOM 高度。
     * 延迟执行是为了等待 Canvas 引擎完成节点布局稳定。
     */
    private scheduleHeightRefreshAfterViewportChange(traceId: string, token: number, reason: string): void {
        const delay = Platform.isMobile ? 600 : 300;
        window.setTimeout(() => {
            // token 未被覆盖时才执行
            if (token !== this.activeViewportToken) return;
            void this.canvasManager.refreshTrustedHeightsForViewportTextNodes(24, 6)
                .then(count => {
                    if (count > 0) {
                        log(`[ViewportFix] HeightRefreshAfterViewportChange: traceId=${traceId}, reason=${reason}, refreshed=${count}`);
                    }
                })
                .catch(err => {
                    log(`[ViewportFix] HeightRefreshAfterViewportChange error: ${err}`);
                });
        }, delay);
    }

    /**
     * 仅触发 Canvas 引擎自身刷新，不手动 render 边，避免与引擎内部状态冲突。
     */
    private triggerCanvasEngineEdgeRefresh(canvas: CanvasLike, reason: string): void {
        const c = canvas;
        if (typeof c.requestUpdate !== 'function') return;

        requestCanvasUpdate(c);
        requestAnimationFrame(() => {
            requestCanvasUpdate(c);
            log(`[ViewportFix] EngineRefresh: reason=${reason}`);
        });
    }

    // =========================================================================
    // 辅助方法
    // =========================================================================

    private getCanvasFromView(view: ItemView): CanvasLike | null {
        return (view as CanvasViewLike).canvas || null;
    }

    // =========================================================================
    // 卸载
    // =========================================================================
    unload() {
        this.clearPenLongPress();
        this.clearTouchDragNodeArm();
        for (const timerId of this.focusLostDebounceByNodeId.values()) {
            window.clearTimeout(timerId);
        }
        this.focusLostDebounceByNodeId.clear();
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }
        if (this.nodeMountedBatchTimeoutId !== null) {
            window.clearTimeout(this.nodeMountedBatchTimeoutId);
            this.nodeMountedBatchTimeoutId = null;
        }
        if (this.viewportChangeDebounceId !== null) {
            window.clearTimeout(this.viewportChangeDebounceId);
            this.viewportChangeDebounceId = null;
        }
        if (this.deferredPostInsertMaintenanceTimeoutId !== null) {
            window.clearTimeout(this.deferredPostInsertMaintenanceTimeoutId);
            this.deferredPostInsertMaintenanceTimeoutId = null;
        }
        while (this.nativeInsertEngineRestoreFns.length > 0) {
            const restore = this.nativeInsertEngineRestoreFns.pop();
            try {
                restore?.();
            } catch {
                // ignore restore errors during unload
            }
        }
    }

}

function extractNodeId(endpoint: unknown): string | undefined {
    if (typeof endpoint === 'string') return endpoint;
    if (endpoint && typeof endpoint === 'object') {
        const endpointRecord = endpoint as Record<string, unknown>;
        if (typeof endpointRecord.nodeId === 'string') return endpointRecord.nodeId;
        const node = endpointRecord.node;
        if (node && typeof node === 'object') {
            const nodeRecord = node as Record<string, unknown>;
            if (typeof nodeRecord.id === 'string') return nodeRecord.id;
        }
    }
    return undefined;
}
