/**
 * Native Insert Session Orchestrator
 * 
 * 负责管理 Native Insert 会话的状态、提交和副作用抑制逻辑。
 * 
 * 核心职责：
 * 1. 会话状态管理（activeNativeInsertSession, pendingNativeInsertCommit）
 * 2. 副作用抑制（nativeInsertSideEffectsSuppressUntil）
 * 3. 引擎诊断安装（installNativeInsertEngineDiagnostics）
 * 4. 延迟维护调度（scheduleDeferredPostInsertMaintenance）
 * 5. 引擎恢复管理（nativeInsertEngineRestoreFns）
 */

import { logVerbose, log } from '../../utils/logger';
import type { CanvasLike } from '../types';

export type NativeInsertSessionState = {
    traceId: string;
    pointerId: number;
    pointerType: string;
    targetKind: string;
    startReason: string;
    anchorNodeId: string | null;
    initialNodeCount: number;
    initialEdgeCount: number;
    placeholderSeen: boolean;
    placeholderAddedCount: number;
    placeholderRemovedCount: number;
    domNodeAddedCount: number;
    domNodeRemovedCount: number;
    nodeCreateSeen: boolean;
    wrapperDragSeen: boolean;
    startedAt: number;
};

export type NativeInsertPendingCommitState = {
    traceId: string;
    pointerType: string;
    startReason: string;
    targetKind: string;
    anchorNodeId: string | null;
    endReason: string;
    nodeDelta: number;
    placeholderDelta: number;
    lastPointerDetail: number | null;
    clickDetail: number | null;
    clickClassified: boolean;
    awaitingClickClassification: boolean;
    queuedSelectionNodeIds: string[];
    queuedSelectionEdgeIds: string[];
    queuedSelectionActiveEdgeId: string | null;
    evidenceFlags: string[];
    commitEligibleAt: number | null;
    stagedAt: number;
};

/**
 * Host 接口：主类需要实现的依赖方法
 */
export interface NativeInsertSessionOrchestratorHost {
    // Canvas 管理器访问
    getCanvasManager(): {
        checkAndAddCollapseButtons(): void;
        reapplyCurrentCollapseVisibility(canvas: CanvasLike, reason: string): number;
        syncScrollableStateForMountedNodes(): number;
        measureAndPersistTrustedHeight(nodeId: string): Promise<void>;
        notifyNodeMountedVisible(nodeId: string, reason: string): void;
    };
    
    // 节点交互上下文服务访问
    getNodeInteractionContextService(): {
        getDeferredMeasureNodeIds(): Set<string>;
        clearDeferredMeasureNodeIds(): void;
    };
    
    // Canvas 视图访问
    getCanvasView(): unknown | null;
    getCanvasFromView(view: unknown): CanvasLike | null;
    
    // 事件描述辅助
    describeEventTarget(target: EventTarget | null): string;
    describeCanvasSelection(): string;
    summarizeNativeInsertArg(arg: unknown): string;
}

export class NativeInsertSessionOrchestratorService {
    private host: NativeInsertSessionOrchestratorHost;
    
    // Native Insert 会话状态
    private activeNativeInsertSession: NativeInsertSessionState | null = null;
    private pendingNativeInsertCommit: NativeInsertPendingCommitState | null = null;
    private nativeInsertCommitInFlight: boolean = false;
    private lastNativeInsertCommitTraceId: string | null = null;
    private lastNativeInsertCommitAt: number = 0;
    
    // 副作用抑制
    private nativeInsertSideEffectsSuppressUntil: number = 0;
    
    // 延迟维护
    private deferredPostInsertMaintenanceTimeoutId: number | null = null;
    private deferredAdjustNodeIds: Set<string> = new Set();
    
    // 引擎恢复
    private nativeInsertEngineRestoreFns: Array<() => void> = [];
    
    constructor(host: NativeInsertSessionOrchestratorHost) {
        this.host = host;
    }
    
    // =========================================================================
    // 会话状态访问器
    // =========================================================================
    
    getActiveNativeInsertSession(): NativeInsertSessionState | null {
        return this.activeNativeInsertSession;
    }
    
    setActiveNativeInsertSession(session: NativeInsertSessionState | null): void {
        this.activeNativeInsertSession = session;
    }
    
    getPendingNativeInsertCommit(): NativeInsertPendingCommitState | null {
        return this.pendingNativeInsertCommit;
    }
    
    setPendingNativeInsertCommit(commit: NativeInsertPendingCommitState | null): void {
        this.pendingNativeInsertCommit = commit;
    }
    
    getNativeInsertCommitInFlight(): boolean {
        return this.nativeInsertCommitInFlight;
    }
    
    setNativeInsertCommitInFlight(value: boolean): void {
        this.nativeInsertCommitInFlight = value;
    }
    
    getLastNativeInsertCommitTraceId(): string | null {
        return this.lastNativeInsertCommitTraceId;
    }
    
    setLastNativeInsertCommitTraceId(traceId: string | null): void {
        this.lastNativeInsertCommitTraceId = traceId;
    }
    
    getLastNativeInsertCommitAt(): number {
        return this.lastNativeInsertCommitAt;
    }
    
    setLastNativeInsertCommitAt(timestamp: number): void {
        this.lastNativeInsertCommitAt = timestamp;
    }
    
    getNativeInsertSideEffectsSuppressUntil(): number {
        return this.nativeInsertSideEffectsSuppressUntil;
    }
    
    setNativeInsertSideEffectsSuppressUntil(timestamp: number): void {
        this.nativeInsertSideEffectsSuppressUntil = timestamp;
    }
    
    getDeferredAdjustNodeIds(): Set<string> {
        return this.deferredAdjustNodeIds;
    }
    
    // =========================================================================
    // 会话状态查询
    // =========================================================================
    
    isNativeInsertSessionActive(pointerId?: number): boolean {
        const session = this.activeNativeInsertSession;
        if (!session) return false;
        return typeof pointerId === 'number' ? session.pointerId === pointerId : true;
    }
    
    shouldSuppressSideEffectsForNativeInsert(): boolean {
        return this.activeNativeInsertSession !== null || Date.now() < this.nativeInsertSideEffectsSuppressUntil;
    }
    
    // =========================================================================
    // 节点创建记录
    // =========================================================================
    
    noteNativeInsertNodeCreate(nodeId: string | null): void {
        if (!nodeId) return;

        const session = this.activeNativeInsertSession;
        if (session) {
            session.nodeCreateSeen = true;
            this.nativeInsertSideEffectsSuppressUntil = Math.max(
                this.nativeInsertSideEffectsSuppressUntil, 
                Date.now() + 900
            );
            logVerbose(`[Event] NativeInsertNodeCreateSeen: trace=${session.traceId}, pointer=${session.pointerId}, node=${nodeId}`);
            return;
        }

        if (Date.now() < this.nativeInsertSideEffectsSuppressUntil) {
            logVerbose(`[Event] NativeInsertNodeCreateSeenRecent: node=${nodeId}`);
        }
    }
    
    // =========================================================================
    // 引擎诊断安装
    // =========================================================================
    
    installNativeInsertEngineDiagnostics(canvas: CanvasLike | null): void {
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
                    `selection=${this.host.describeCanvasSelection()}, args=${args.map(arg => this.host.summarizeNativeInsertArg(arg)).join(';') || 'none'}`
                );
                try {
                    const result = (original as (...invokeArgs: unknown[]) => unknown).apply(canvasRecord, args);
                    log(
                        `[Event] ${returnEvent}: trace=${traceId}, source=${source}, method=${methodName}, ` +
                        `result=${this.host.summarizeNativeInsertArg(result)}, selection=${this.host.describeCanvasSelection()}`
                    );
                    return result;
                } catch (error) {
                    log(
                        `[Event] ${errorEvent}: trace=${traceId}, source=${source}, method=${methodName}, ` +
                        `error=${String(error)}, selection=${this.host.describeCanvasSelection()}`
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
    
    // =========================================================================
    // 延迟维护调度
    // =========================================================================
    
    scheduleDeferredPostInsertMaintenance(reason: string): void {
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

            const nodeInteractionService = this.host.getNodeInteractionContextService();
            const deferredMeasureIds = Array.from(nodeInteractionService.getDeferredMeasureNodeIds());
            const deferredAdjustIds = Array.from(this.deferredAdjustNodeIds);
            nodeInteractionService.clearDeferredMeasureNodeIds();
            this.deferredAdjustNodeIds.clear();

            log(
                `[Event] NativeInsertPostMaintenance: reason=${reason}, ` +
                `deferredMeasure=${deferredMeasureIds.length}, deferredAdjust=${deferredAdjustIds.length}`
            );

            const canvasManager = this.host.getCanvasManager();
            canvasManager.checkAndAddCollapseButtons();

            const activeCanvasView = this.host.getCanvasView();
            const activeCanvas = activeCanvasView ? this.host.getCanvasFromView(activeCanvasView) : null;
            if (activeCanvas) {
                const hiddenCount = canvasManager.reapplyCurrentCollapseVisibility(activeCanvas, `native-insert-post:${reason}`);
                if (hiddenCount > 0) {
                    logVerbose(`[Event] NativeInsertPostMaintenanceVisibility: hidden=${hiddenCount}, reason=${reason}`);
                }
                const updated = canvasManager.syncScrollableStateForMountedNodes();
                if (updated > 0) {
                    logVerbose(`[Event] NativeInsertPostMaintenanceScrollSync: updated=${updated}, reason=${reason}`);
                }
            }

            for (const nodeId of deferredMeasureIds) {
                void canvasManager.measureAndPersistTrustedHeight(nodeId);
            }

            for (const nodeId of deferredAdjustIds) {
                canvasManager.notifyNodeMountedVisible(
                    nodeId,
                    `native-insert-post:${reason}`
                );
            }
        }, delay);
    }
    
    // =========================================================================
    // 清理方法
    // =========================================================================
    
    clearDeferredPostInsertMaintenance(): void {
        if (this.deferredPostInsertMaintenanceTimeoutId !== null) {
            window.clearTimeout(this.deferredPostInsertMaintenanceTimeoutId);
            this.deferredPostInsertMaintenanceTimeoutId = null;
        }
    }
    
    restoreNativeInsertEngineFunctions(): void {
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
