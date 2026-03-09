import { App, ItemView, Notice, Platform, Plugin, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../settings/types';
import { CollapseStateManager } from '../state/collapse-state';
import { DeleteConfirmationModal } from '../ui/delete-modal';
import { DeleteEdgeConfirmationModal } from '../ui/delete-edge-modal';
import { FloatingNodeService } from './services/floating-node-service';
import { CanvasManager } from './canvas-manager';
import { log } from '../utils/logger';
import { CONSTANTS } from '../constants';

import {
    getCanvasView,
    getActiveCanvasView,
    getSelectedEdge,
    extractEdgeNodeIds,
    buildEdgeIdSet,
    detectNewEdges,
    getEdgesFromCanvas,
    getEdgesFromCanvasOrFileData,
    getNodesFromCanvas,
    findZoomToFitButton,
    tryZoomToSelection,
    getSelectedNodeFromCanvas,
    findDeleteButton,
    findCanvasNodeElementFromTarget,
    getCanvasNodeByElement,
    parseFromLink,
    withTemporaryCanvasSelection
} from '../utils/canvas-utils';
import { CanvasLike, CanvasNodeLike, CanvasEdgeLike, CanvasViewLike, MarkdownViewLike } from './types';
import { VisibilityService } from './services/visibility-service';

type FromLinkInfo = {
    file: string;
    from: { line: number; ch: number };
    to: { line: number; ch: number };
};

type PointerGestureSnapshot = {
    pointerId: number;
    pointerType: string;
    nodeId: string | null;
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
    private focusLostDebounceId: number | null = null;
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
    private readonly touchDragArmedClass = 'cmb-touch-drag-armed';
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
            const canvasView = getCanvasView(this.app);
            if (!canvasView) return;

            const targetEl = event.target as HTMLElement;
            
            const zoomToFitBtn = findZoomToFitButton(targetEl);
            if (zoomToFitBtn) {
                const handled = await this.handleZoomToFitVisibleNodes();
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

        const resolveNodeElement = (eventTarget: EventTarget | null): HTMLElement | null => {
            if (!(eventTarget instanceof HTMLElement)) return null;
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
            const nodeEl = resolveNodeElement(event.target);
            const nodeId = resolveNodeId(event.target);
            const pointerType = event.pointerType || 'mouse';
            const wasSelectedBeforeDown = isNodeSelected(event.target);

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
                log(
                    `[Event] DragPointerDown: node=${nodeId || 'unknown'}, pointer=${pointerType}, ` +
                    `selected=${wasSelectedBeforeDown}, blocker=${this.isContentBlockerTarget(event.target)}, ` +
                    `target=${this.describeEventTarget(event.target)}, ` +
                    `chain=${this.describeEventTargetChain(event.target)}, owners=${this.getTouchDragScrollOwners(nodeEl).length}`
                );
            }

            this.activePointerGesture = {
                pointerId: event.pointerId,
                pointerType,
                nodeId,
                startX: event.clientX,
                startY: event.clientY,
                moved: false,
                wasSelectedBeforeDown,
                at: Date.now()
            };
        }, { capture: true, passive: true });

        this.plugin.registerDomEvent(document, 'pointermove', (event: PointerEvent) => {
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
                    log(
                        `[Event] DragPointerMove: node=${gesture.nodeId || 'unknown'}, pointer=${gesture.pointerType}, ` +
                        `dx=${dx.toFixed(1)}, dy=${dy.toFixed(1)}, threshold=${moveThreshold}`
                    );
                }
            }
        }, { capture: true, passive: true });

        const finalizePointer = (event: PointerEvent) => {
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
                    log(
                        `[Event] DragPointerEnd: node=${gesture.nodeId || 'unknown'}, pointer=${gesture.pointerType}, ` +
                        `moved=${gesture.moved}, duration=${duration}ms, nodeMoveSeen=${this.activeTouchDragSawCanvasNodeMove}`
                    );
                    if (gesture.moved && !this.activeTouchDragSawCanvasNodeMove) {
                        log(
                            `[Event] DragPointerNoCanvasMove: node=${gesture.nodeId || 'unknown'}, pointer=${gesture.pointerType}, ` +
                            `reason=no-canvas-node-move, blocker=${this.isContentBlockerTarget(event.target)}, ` +
                            `target=${this.describeEventTarget(event.target)}, ` +
                            `chain=${this.describeEventTargetChain(event.target)}`
                        );
                    }
                }

                this.activePointerGesture = null;
            }

            this.clearPenLongPress(event.pointerId);
            this.clearTouchDragNodeArm(event.pointerId);
            this.activeTouchDragSawCanvasNodeMove = false;
        };

        this.plugin.registerDomEvent(document, 'pointerup', finalizePointer, { capture: true, passive: true });
        this.plugin.registerDomEvent(document, 'pointercancel', finalizePointer, { capture: true, passive: true });
    }

    private shouldSuppressFromLinkClick(targetEl: HTMLElement): boolean {
        const nodeEl = findCanvasNodeElementFromTarget(targetEl);
        if (!nodeEl) return false;

        const nodeId = this.extractNodeIdFromElement(nodeEl);
        const now = Date.now();
        if (
            now < this.suppressFromLinkClickUntil
            && this.suppressFromLinkNodeId
            && this.suppressFromLinkNodeId === nodeId
        ) {
            log(`[Event] fromLink click suppressed: reason=${this.suppressFromLinkClickReason || 'recent-gesture'}, node=${nodeId || 'unknown'}`);
            return true;
        }

        const lastGesture = this.lastCompletedPointerGesture;
        if (!lastGesture) return false;
        if (now - lastGesture.at > CONSTANTS.TOUCH.FROM_LINK_SUPPRESS_MS_TOUCH_PEN) return false;
        if (lastGesture.nodeId !== nodeId) return false;

        const pointerType = lastGesture.pointerType;
        if (pointerType === CONSTANTS.TOUCH.TOUCH_POINTER_TYPE) {
            if (lastGesture.moved) {
                log(`[Event] fromLink click suppressed: reason=touch-moved, node=${nodeId || 'unknown'}`);
                return true;
            }

            if (!lastGesture.wasSelectedBeforeDown) {
                log(`[Event] fromLink click suppressed: reason=touch-first-tap-select, node=${nodeId || 'unknown'}`);
                return true;
            }

            log(`[Event] fromLink click suppressed: reason=touch-tap-reserved-for-drag, node=${nodeId || 'unknown'}`);
            return true;
        }

        if (pointerType === CONSTANTS.TOUCH.PEN_POINTER_TYPE) {
            if (lastGesture.moved) {
                log(`[Event] fromLink click suppressed: reason=pen-moved, node=${nodeId || 'unknown'}`);
                return true;
            }

            log(`[Event] fromLink click suppressed: reason=pen-short-tap-select-only, node=${nodeId || 'unknown'}`);
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
        return target instanceof HTMLElement && target.classList.contains('canvas-node-content-blocker');
    }

    private describeEventTarget(target: EventTarget | null): string {
        if (!(target instanceof HTMLElement)) return 'non-element';
        const className = typeof target.className === 'string' ? target.className.trim().replace(/\s+/g, '.') : '';
        return `${target.tagName.toLowerCase()}${className ? '.' + className : ''}`;
    }

    private describeEventTargetChain(target: EventTarget | null, maxDepth = 5): string {
        if (!(target instanceof HTMLElement)) return 'non-element';

        const parts: string[] = [];
        let current: HTMLElement | null = target;
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
        log(`[Event] OpenStabilizeProtectWindow: reason=${reason}, holdMs=${this.nodeMountedOpenProtectionMs}`);
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

    private async handleZoomToFitVisibleNodes(): Promise<boolean> {
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
            log(`[Event] OpenStabilizeDedup: skip duplicate trigger, source=${source}, file=${filePath || 'unknown'}`);
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

    private async handleDeleteButtonClick(canvasView: ItemView): Promise<void> {
        const canvas = this.getCanvasFromView(canvasView);
        if (!canvas) return;
        
        const selectedEdge = getSelectedEdge(canvas);
        if (selectedEdge) {
            const modal = new DeleteEdgeConfirmationModal(this.app);
            modal.open();
            void modal.waitForResult().then(async (result) => {
                if (result.action === 'confirm') {
                    await this.canvasManager.deleteSelectedEdge();
                }
            });
            return;
        }
        
        const selectedNode = getSelectedNodeFromCanvas(canvas);
        if (selectedNode) {
            void this.executeDeleteOperation(selectedNode, canvas);
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
        modal.open();
        const result = await modal.waitForResult();
        
        if (result.action === 'cancel') return;

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
                this.app.workspace.setActiveLeaf(mdLeaf, { focus: true });
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
        
        log(`[Event] setupCanvasEventListeners(#${this.setupCallCount}): token=${currentToken}, path=${canvasFilePath || 'null'}, duplicate=${isDuplicate}, isSettingUp=${this.isSettingUp}`);
        
        // [B1] 幂等化 - 防止重复 setup
        if (this.isSettingUp) {
            log(`[Event] setupCanvasEventListeners: 跳过（正在设置中）`);
            return;
        }
        
        // 如果是同一路径且已注册过，跳过
        if (isDuplicate && this.workspaceEventsRegistered) {
            log(`[Event] setupCanvasEventListeners: 跳过（同一路径已注册）path=${canvasFilePath}, registered=${this.workspaceEventsRegistered}`);
            return;
        }
        
        this.isSettingUp = true;
        
        try {
            log(`[Event] setupCanvasEventListeners 被调用, canvas=${canvas ? 'exists' : 'null'}`);
            
            if (!canvas) {
                log(`[Event] canvas 不存在，跳过设置`);
                return;
            }

            log(`[Event] canvasFilePath=${canvasFilePath || 'null'}`);
            this.currentCanvasFilePath = canvasFilePath || null;
            
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
                log(`[Event] setupCanvasEventListeners: 工作区事件首次注册, path=${canvasFilePath || 'null'}`);
            } else {
                log(`[Event] setupCanvasEventListeners: 跳过注册（已注册）, path=${this.workspaceEventsPath}`);
            }
        } finally {
            this.isSettingUp = false;
        }
    }

    private async handleCanvasFileModified(filePath: string): Promise<void> {
        log(`[Event] Canvas 文件变更: ${filePath}`);
        
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
            await this.canvasManager.checkAndAddCollapseButtons();
        }

        this.lastEdgeIds = newEdgeIds;
    }

    private registerCanvasWorkspaceEvents(canvas: CanvasLike) {
        this.plugin.registerEvent(
            this.app.workspace.on('canvas:edge-create', (edge: CanvasEdgeLike) => {
                void (async () => {
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
                    await this.canvasManager.checkAndAddCollapseButtons();
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
                    if (nodeId) {
                        const isFloating = await this.floatingNodeService.isNodeFloating(nodeId);
                        if (isFloating) {
                            await this.floatingNodeService.clearNodeFloatingState(nodeId);
                        }
                        log(`[Event] Canvas:NodeCreate 调用 adjustNodeHeightAfterRender: ${nodeId}`);
                        setTimeout(() => {
                            void this.canvasManager.adjustNodeHeightAfterRender(nodeId);
                        }, CONSTANTS.TIMING.SCROLL_DELAY);
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
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (const node of Array.from(mutation.addedNodes)) {
                        if (node instanceof HTMLElement && node.classList.contains('canvas-node')) {
                            shouldCheckButtons = true;
                            mountedNodeCount++;
                        }
                    }
                }
            }

            if (shouldCheckButtons) {
                void this.canvasManager.checkAndAddCollapseButtons();
                const scrollSyncDelay = Platform.isMobile ? 120 : 60;
                window.setTimeout(() => {
                    const updated = this.canvasManager.syncScrollableStateForMountedNodes();
                    if (updated > 0) {
                        log(`[Event] NodeMountedScrollSync: updated=${updated}, mountedNodeCount=${mountedNodeCount}`);
                    }
                }, scrollSyncDelay);
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
            for (const mutation of mutations) {
                if (mutation.type !== 'attributes' || mutation.attributeName !== 'class') continue;

                const target = mutation.target as HTMLElement;
                if (!target?.classList?.contains('canvas-node')) continue;

                const hasFocus = target.classList.contains('is-focused') || target.classList.contains('is-editing');

                if (hasFocus) {
                    this.lastFocusedNodeId = this.extractNodeIdFromElement(target);
                    continue;
                }

                const nodeId = this.extractNodeIdFromElement(target) || this.lastFocusedNodeId;
                if (!nodeId) continue;

                this.lastFocusedNodeId = null;

                if (this.focusLostDebounceId !== null) {
                    window.clearTimeout(this.focusLostDebounceId);
                }

                this.focusLostDebounceId = window.setTimeout(() => {
                    this.focusLostDebounceId = null;
                    void this.canvasManager.measureAndPersistTrustedHeight(nodeId);
                }, 500);
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
        if (canvas) {
            const edges = getEdgesFromCanvas(canvas);
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

            if (typeof (canvas).requestUpdate === 'function') {
                (canvas).requestUpdate();
            }

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

        c.requestUpdate();
        requestAnimationFrame(() => {
            c.requestUpdate?.();
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
