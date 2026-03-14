/**
 * Viewport Stabilization Orchestrator
 * 
 * 负责管理 Viewport 变化监听（屏幕旋转/分屏切换）和边几何收敛逻辑。
 * 
 * 核心职责：
 * 1. Viewport 变化检测（resize, orientationchange）
 * 2. 边几何收敛迭代（convergeCanvasEdgesAfterViewportChange）
 * 3. Pending 刷新管理（当 Canvas 临时关闭时延迟刷新）
 * 4. Token 机制防止并发冲突
 * 5. 移动端特殊处理（旋转动画等待）
 */

import { Platform } from 'obsidian';
import { log } from '../../utils/logger';
import { CONSTANTS } from '../../constants';
import type { CanvasLike } from '../types';
import { getEdgesFromCanvas, getNodesFromCanvas } from '../../utils/canvas-utils';
import { requestCanvasUpdate } from '../adapters/canvas-runtime-adapter';

type ViewportState = 'idle' | 'debouncing' | 'pending-canvas' | 'converging' | 'stable';

/**
 * Host 接口：主类需要实现的依赖方法
 */
export interface ViewportStabilizationOrchestratorHost {
    // Canvas 视图访问
    getCanvasView(): unknown | null;
    getCanvasFromView(view: unknown): CanvasLike | null;
    
    // Canvas 管理器访问
    getCanvasManager(): {
        refreshTrustedHeightsForViewportTextNodes(maxNodes: number, maxRetries: number): Promise<number>;
    };
    
    // 边签名捕获
    captureEdgeSignatures(canvas: CanvasLike): Map<string, { bezier: string; pathD: string; endpoint: string }>;
    diffEdgeSignatures(
        before: Map<string, { bezier: string; pathD: string; endpoint: string }>,
        after: Map<string, { bezier: string; pathD: string; endpoint: string }>
    ): { bezierChanged: number; pathChanged: number; endpointChanged: number };
    
    // DOM 辅助
    getCanvasLeafRect(view: unknown | null): DOMRect | null;
    inferSplitMode(leafRect: DOMRect | null): string;
    getOrientationLabel(): string;
    getVisualViewportInfo(): { width: number; height: number; scale: number } | null;
    
    // 异步等待
    waitForEngineFrame(delayMs: number): Promise<void>;
}

export class ViewportStabilizationOrchestratorService {
    private host: ViewportStabilizationOrchestratorHost;
    
    // Viewport 变化监听
    private viewportChangeDebounceId: number | null = null;
    private lastViewportWidth: number = 0;
    private lastViewportHeight: number = 0;
    private isViewportListenerSetup: boolean = false;
    
    // Pending 刷新管理
    private pendingViewportRefresh: boolean = false;
    private lastViewportChangeTrigger: string = '';
    private pendingViewportToken: number = 0;
    private pendingViewportTraceId: string = '';
    
    // Token 和状态
    private viewportTokenCounter: number = 0;
    private activeViewportToken: number = 0;
    private viewportTraceSeq: number = 0;
    private viewportState: ViewportState = 'idle';
    
    // 常量
    private readonly viewportStablePassRequired: number = 2;
    
    constructor(host: ViewportStabilizationOrchestratorHost) {
        this.host = host;
    }
    
    // =========================================================================
    // 访问器
    // =========================================================================
    
    getPendingViewportRefresh(): boolean {
        return this.pendingViewportRefresh;
    }
    
    setPendingViewportRefresh(value: boolean): void {
        this.pendingViewportRefresh = value;
    }
    
    getLastViewportChangeTrigger(): string {
        return this.lastViewportChangeTrigger;
    }
    
    getPendingViewportToken(): number {
        return this.pendingViewportToken;
    }
    
    setPendingViewportToken(value: number): void {
        this.pendingViewportToken = value;
    }
    
    getActiveViewportToken(): number {
        return this.activeViewportToken;
    }
    
    getPendingViewportTraceId(): string {
        return this.pendingViewportTraceId;
    }
    
    getViewportState(): ViewportState {
        return this.viewportState;
    }
    
    // =========================================================================
    // Viewport 变化监听设置
    // =========================================================================
    
    isViewportListenerActive(): boolean {
        return this.isViewportListenerSetup;
    }
    
    setupViewportChangeListener(
        registerDomEvent: <K extends keyof WindowEventMap>(
            target: Window,
            type: K,
            listener: () => void
        ) => void
    ): void {
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

            this.logViewportTrace(traceId, 'detected', viewportToken, {
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
            const extraDelay = Platform.isMobile ? CONSTANTS.TIMING.VIEWPORT_CHANGE_EXTRA_DELAY_MOBILE : 0;

            this.pendingViewportRefresh = true;
            this.lastViewportChangeTrigger = trigger;
            this.pendingViewportToken = viewportToken;
            this.pendingViewportTraceId = traceId;

            this.viewportChangeDebounceId = window.setTimeout(() => {
                this.viewportChangeDebounceId = null;

                if (viewportToken !== this.activeViewportToken) {
                    this.logViewportTrace(traceId, 'canceled', viewportToken, {
                        trigger,
                        reason: 'token-overridden-before-debounce-run',
                        activeToken: this.activeViewportToken
                    });
                    return;
                }

                this.logViewportTrace(traceId, 'debounce-fired', viewportToken, {
                    trigger,
                    debounceDelay,
                    extraDelay
                });

                const canvasView = this.host.getCanvasView();
                if (!canvasView) {
                    this.viewportState = 'pending-canvas';
                    this.logViewportTrace(traceId, 'pending-canvas', viewportToken, {
                        trigger,
                        reason: 'canvas-view-unavailable'
                    });
                    return;
                }

                const canvas = this.host.getCanvasFromView(canvasView);
                if (!canvas) {
                    this.viewportState = 'pending-canvas';
                    this.logViewportTrace(traceId, 'pending-canvas', viewportToken, {
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
                    this.logViewportTrace(traceId, 'skip', viewportToken, {
                        trigger,
                        reason: 'edges-empty'
                    });
                    return;
                }

                this.logViewportTrace(traceId, 'refresh-scheduled', viewportToken, {
                    trigger,
                    edges: edges.length,
                    extraDelay
                });
                this.pendingViewportRefresh = false;
                this.pendingViewportToken = 0;
                this.pendingViewportTraceId = '';

                const doRefresh = () => {
                    void this.convergeCanvasEdgesAfterViewportChange(
                        canvas,
                        `viewport-${trigger}`,
                        traceId,
                        viewportToken
                    );
                };

                if (extraDelay > 0) {
                    window.setTimeout(doRefresh, extraDelay);
                } else {
                    doRefresh();
                }
            }, debounceDelay);
        };

        registerDomEvent(window, 'resize', () => handleViewportChange('resize'));

        if ('onorientationchange' in window) {
            registerDomEvent(window, 'orientationchange', () => {
                requestAnimationFrame(() => handleViewportChange('orientationchange'));
            });
        }

        log(`[ViewportFix] Viewport 变化监听已注册 (mobile=${Platform.isMobile})`);
    }
    
    // =========================================================================
    // Trace ID 生成
    // =========================================================================
    
    createViewportTraceId(trigger: string): string {
        this.viewportTraceSeq += 1;
        return `vp-${Date.now().toString(36)}-${this.viewportTraceSeq.toString(36)}-${trigger}`;
    }
    
    // =========================================================================
    // Viewport 日志追踪
    // =========================================================================
    
    logViewportTrace(
        traceId: string,
        phase: string,
        token: number,
        extra?: Record<string, unknown>
    ): void {
        const canvasView = this.host.getCanvasView();
        const leafRect = this.host.getCanvasLeafRect(canvasView);
        const leafRectStr = leafRect
            ? `${leafRect.left.toFixed(0)},${leafRect.top.toFixed(0)}->${leafRect.right.toFixed(0)},${leafRect.bottom.toFixed(0)} (${leafRect.width.toFixed(0)}x${leafRect.height.toFixed(0)})`
            : 'n/a';

        const splitMode = this.host.inferSplitMode(leafRect);
        const orientation = this.host.getOrientationLabel();
        const vv = this.host.getVisualViewportInfo();
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
    
    // =========================================================================
    // 边几何收敛
    // =========================================================================
    
    async convergeCanvasEdgesAfterViewportChange(
        canvas: CanvasLike,
        reason: string,
        traceId: string,
        token: number
    ): Promise<void> {
        if (token !== this.activeViewportToken) {
            this.logViewportTrace(traceId, 'converge-skip', token, {
                reason,
                stopReason: 'token-mismatch-before-start',
                activeToken: this.activeViewportToken
            });
            return;
        }

        const initialEdges = getEdgesFromCanvas(canvas);
        if (initialEdges.length === 0) {
            this.viewportState = 'stable';
            this.logViewportTrace(traceId, 'converge-skip', token, {
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

        this.logViewportTrace(traceId, 'converge-start', token, {
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
                this.logViewportTrace(traceId, 'converge-stop', token, {
                    reason,
                    stopReason: 'token-canceled-during-pass',
                    pass,
                    activeToken: this.activeViewportToken
                });
                return;
            }

            const edges = getEdgesFromCanvas(canvas);
            const before = this.host.captureEdgeSignatures(canvas);

            let rendered = 0;
            for (const edge of edges) {
                if (typeof (edge as { render?: () => void }).render === 'function') {
                    try {
                        (edge as { render: () => void }).render();
                        rendered++;
                    } catch {
                        // 单边失败不阻断收敛
                    }
                }
            }

            requestCanvasUpdate(canvas);
            await this.host.waitForEngineFrame(passInterval);

            const after = this.host.captureEdgeSignatures(canvas);
            const diff = this.host.diffEdgeSignatures(before, after);
            const converged = diff.bezierChanged === 0 && diff.pathChanged === 0 && diff.endpointChanged === 0;
            stablePasses = converged ? stablePasses + 1 : 0;

            this.logViewportTrace(traceId, 'converge-pass', token, {
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
                this.logViewportTrace(traceId, 'converge-stop', token, {
                    reason,
                    pass,
                    stopReason: 'stable'
                });
                this.scheduleHeightRefreshAfterViewportChange(traceId, token, reason);
                return;
            }
        }

        this.viewportState = 'stable';
        this.logViewportTrace(traceId, 'converge-stop', token, {
            reason,
            stopReason: 'max-pass-reached',
            maxPass
        });
        this.scheduleHeightRefreshAfterViewportChange(traceId, token, reason);
    }
    
    // =========================================================================
    // Viewport 变化后高度刷新
    // =========================================================================
    
    private scheduleHeightRefreshAfterViewportChange(traceId: string, token: number, reason: string): void {
        const delay = Platform.isMobile ? 600 : 300;
        window.setTimeout(() => {
            if (token !== this.activeViewportToken) return;
            void this.host.getCanvasManager().refreshTrustedHeightsForViewportTextNodes(24, 6)
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
    
    // =========================================================================
    // 清理方法
    // =========================================================================
    
    clearViewportChangeDebounce(): void {
        if (this.viewportChangeDebounceId !== null) {
            window.clearTimeout(this.viewportChangeDebounceId);
            this.viewportChangeDebounceId = null;
        }
    }
}
