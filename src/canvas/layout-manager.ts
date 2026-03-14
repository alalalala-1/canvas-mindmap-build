import { App, Notice, Plugin, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../settings/types';
import { CollapseStateManager } from '../state/collapse-state';
import { CanvasFileService } from './services/canvas-file-service';
import { log, logVerbose } from '../utils/logger';
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
import { EdgeGeometryService, EdgeScreenGapSummary, OffsetAnomalyStats, OffsetCleanupOptions } from './services/edge-geometry-service';
import { requestCanvasUpdate } from './adapters/canvas-runtime-adapter';
import {
    type ArrangeNoOpFollowUpDecision,
    type ArrangeNoOpFastPathDecision,
    type ArrangeStateSnapshot,
    type ArrangeRepeatManualSkipDecision,
    type HealthyOpenStabilizeSnapshot,
    type HealthyOpenStabilizeSkipDecision,
    buildArrangeStateSignature,
    getArrangeRepeatManualSkipDecision,
    getArrangeNoOpFollowUpDecision,
    getArrangeNoOpFastPathDecision,
    getOpenStabilizeHealthySkipDecision,
    computeArrangeSigHash,
} from './services/layout-arrange-policy';

// Re-export types for backward compatibility
export type {
    ArrangeNoOpFollowUpDecision,
    ArrangeNoOpFastPathDecision,
    ArrangeStateSnapshot,
    ArrangeRepeatManualSkipDecision,
    HealthyOpenStabilizeSnapshot,
    HealthyOpenStabilizeSkipDecision,
} from './services/layout-arrange-policy';

// Re-export functions for backward compatibility
export {
    buildArrangeStateSignature,
    getArrangeRepeatManualSkipDecision,
    getArrangeNoOpFollowUpDecision,
    getArrangeNoOpFastPathDecision,
    getOpenStabilizeHealthySkipDecision,
} from './services/layout-arrange-policy';

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

    // [2-Cycle 振荡保护] 记录最近几次 arrange 的输入/输出签名，检测 A→B→A→B 循环
    private arrangeInputSignatures: string[] = [];
    private arrangeOutputSignatures: string[] = [];
    private readonly oscillationHistorySize: number = 4;
    private oscillationDetected: boolean = false;
    private lastOscillationTime: number = 0;
    private readonly oscillationCooldownMs: number = 5000; // 5秒内不再重复检测

    // [OpenFix] Canvas 打开后的轻量自愈流程（不改布局文件，仅修复视觉层错位）
    private openStabilizeTimeoutId: number | null = null;
    private isOpenStabilizing: boolean = false;
    private pendingOpenStabilizeSource: string = '';
    private readonly openStabilizePulseDelays: number[] = [0, 160, 380];
    private readonly openStabilizeStableMaxGapPx: number = 4;
    private readonly openStabilizeResumeMax: number = 2;
    private openStabilizeResumeCountByBaseSource: Map<string, number> = new Map();
    private readonly healthyOpenStabilizeWindowMs: number = 4000;
    private recentHealthyOpenStabilizeByFilePath: Map<string, HealthyOpenStabilizeSnapshot> = new Map();
    private recentArrangeStateByFilePath: Map<string, ArrangeStateSnapshot> = new Map();

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
    arrangeCanvas(source: string = 'debounce'): void {
        // [D] 记录触发来源
        this.arrangeTriggerSource = source;
        log(`[Layout] ArrangeTrigger: source=${source}`);
        
        if (this.arrangeTimeoutId !== null) {
            window.clearTimeout(this.arrangeTimeoutId);
        }

        this.arrangeTimeoutId = window.setTimeout(() => {
            this.arrangeTimeoutId = null;
            // [D] 在 performArrange 中使用记录的触发来源
            void this.performArrange(false, source);
        }, CONSTANTS.TIMING.ARRANGE_DEBOUNCE);
    }

    /**
     * [OpenFix] Canvas 打开后执行轻量自愈：
     * cleanup(1) -> edge refresh -> cleanup(2) -> requestUpdate
     *
     * 目标：避免用户“重开 canvas 又错位”的复发问题。
     * 该流程不改动节点 x/y，也不写文件，只收敛视觉层偏移与边端点。
     */
    scheduleOpenStabilization(source: string = 'canvas-open'): void {
        if (this.openStabilizeTimeoutId !== null) {
            window.clearTimeout(this.openStabilizeTimeoutId);
        }

        this.openStabilizeTimeoutId = window.setTimeout(() => {
            this.openStabilizeTimeoutId = null;
            void this.performOpenStabilization(source);
        }, 140);
    }

    private isOpenStabilizeResumeSource(source: string): boolean {
        return source.includes('-resume');
    }

    private getOpenStabilizeBaseSource(source: string): string {
        return source
            .replace(/-resume/g, '')
            .replace(/-arrange-busy/g, '');
    }

    private shouldForceHeavyOnFirstPulse(source: string): boolean {
        return this.isOpenEntryStabilizeSource(source);
    }

    private pruneRecentHealthyOpenStabilizeSnapshots(now: number = Date.now()): void {
        for (const [filePath, snapshot] of this.recentHealthyOpenStabilizeByFilePath.entries()) {
            if (now - snapshot.finishedAt > this.healthyOpenStabilizeWindowMs) {
                this.recentHealthyOpenStabilizeByFilePath.delete(filePath);
            }
        }
    }

    private shouldSkipHealthyOpenStabilize(
        source: string,
        filePath: string | null,
        nodeCount: number,
        edgeCount: number
    ): HealthyOpenStabilizeSkipDecision {
        const now = Date.now();
        this.pruneRecentHealthyOpenStabilizeSnapshots(now);
        return getOpenStabilizeHealthySkipDecision({
            isOpenEntrySource: this.isOpenEntryStabilizeSource(source),
            isResumeSource: this.isOpenStabilizeResumeSource(source),
            now,
            windowMs: this.healthyOpenStabilizeWindowMs,
            snapshot: filePath ? (this.recentHealthyOpenStabilizeByFilePath.get(filePath) ?? null) : null,
            nodeCount,
            edgeCount,
        });
    }

    private rememberHealthyOpenStabilize(
        filePath: string | null,
        nodeCount: number,
        edgeCount: number,
        source: string,
        contextId?: string
    ): void {
        if (!filePath) return;
        this.pruneRecentHealthyOpenStabilizeSnapshots();
        this.recentHealthyOpenStabilizeByFilePath.set(filePath, {
            finishedAt: Date.now(),
            nodeCount,
            edgeCount,
            source,
        });
        logVerbose(
            `[Layout] OpenStabilizeHealthyMark: source=${source}, file=${filePath}, ` +
            `nodes=${nodeCount}, edges=${edgeCount}, ctx=${contextId || 'none'}`
        );
    }

    private forgetHealthyOpenStabilize(filePath: string | null): void {
        if (!filePath) return;
        this.recentHealthyOpenStabilizeByFilePath.delete(filePath);
    }

    private isOpenEntryStabilizeSource(source: string): boolean {
        const baseSource = this.getOpenStabilizeBaseSource(source);
        return baseSource === 'canvas-open'
            || baseSource.startsWith('active-leaf-change')
            || baseSource.startsWith('file-open');
    }

    private isHealthyOpenStabilizeContext(
        anomalyStats: OffsetAnomalyStats,
        gapSummary: EdgeScreenGapSummary
    ): boolean {
        const gapAssessment = this.getOpenStabilizeGapAssessment(gapSummary);
        return anomalyStats.anomalous === 0
            && !gapAssessment.trustedGapIssue;
    }

    private getOpenStabilizeGapAssessment(gapSummary: EdgeScreenGapSummary): {
        rawGapIssue: boolean;
        trustedGapIssue: boolean;
        lowConfidenceGapIssue: boolean;
        confidenceReason: string;
    } {
        const gapConfidence = this.edgeGeometryService.assessGapObservationConfidence(gapSummary);
        const rawGapIssue = gapSummary.residualBadEdges > 0
            || gapSummary.maxResidualGap > this.openStabilizeStableMaxGapPx;
        const trustedGapIssue = rawGapIssue && gapConfidence.trustedForSevereRisk;

        return {
            rawGapIssue,
            trustedGapIssue,
            lowConfidenceGapIssue: rawGapIssue && !gapConfidence.trustedForSevereRisk,
            confidenceReason: gapConfidence.reason,
        };
    }

    private evaluateLateVisibleSignal(
        pulseNo: number,
        lateVisibleNodes: number,
        visibleNodeCount: number,
        anomalyStats: OffsetAnomalyStats,
        gapSummary: EdgeScreenGapSummary
    ): {
        isBootstrapLateVisible: boolean;
        isBootstrapLateVisibleHealthy: boolean;
        shouldEscalateHeavy: boolean;
        reason: string;
    } {
        if (lateVisibleNodes <= 0) {
            return {
                isBootstrapLateVisible: false,
                isBootstrapLateVisibleHealthy: false,
                shouldEscalateHeavy: false,
                reason: 'lateVisible:none'
            };
        }

        const isBootstrapLateVisible = pulseNo === 1
            && visibleNodeCount > 0
            && lateVisibleNodes === visibleNodeCount;
        const healthyContext = this.isHealthyOpenStabilizeContext(anomalyStats, gapSummary);

        if (isBootstrapLateVisible && healthyContext) {
            return {
                isBootstrapLateVisible,
                isBootstrapLateVisibleHealthy: true,
                shouldEscalateHeavy: false,
                reason: 'bootstrap-lateVisible-healthy'
            };
        }

        if (isBootstrapLateVisible) {
            return {
                isBootstrapLateVisible,
                isBootstrapLateVisibleHealthy: false,
                shouldEscalateHeavy: true,
                reason: `bootstrap-lateVisible-risk:lateVisible=${lateVisibleNodes}`
            };
        }

        return {
            isBootstrapLateVisible: false,
            isBootstrapLateVisibleHealthy: false,
            shouldEscalateHeavy: true,
            reason: `lateVisible:${lateVisibleNodes}`
        };
    }

    private shouldSkipForcedHeavyFirstPulse(
        source: string,
        anomalyStats: OffsetAnomalyStats,
        gapSummary: EdgeScreenGapSummary,
        lateVisibleNodes: number,
        visibleNodeCount: number,
        pulseNo: number
    ): { skip: boolean; reason: string } {
        if (!this.isOpenEntryStabilizeSource(source)) {
            return { skip: false, reason: 'non-open-entry-source' };
        }

        const lateVisibleSignal = this.evaluateLateVisibleSignal(
            pulseNo,
            lateVisibleNodes,
            visibleNodeCount,
            anomalyStats,
            gapSummary
        );

        if (lateVisibleSignal.isBootstrapLateVisibleHealthy) {
            return { skip: true, reason: lateVisibleSignal.reason };
        }

        if (anomalyStats.anomalous > 0) {
            return { skip: false, reason: `anomaly:${anomalyStats.anomalous}` };
        }

        const gapAssessment = this.getOpenStabilizeGapAssessment(gapSummary);
        if (gapAssessment.trustedGapIssue) {
            return {
                skip: false,
                reason: `trusted-gap:${gapSummary.residualBadEdges}/${gapSummary.maxResidualGap.toFixed(1)}(${gapAssessment.confidenceReason})`
            };
        }

        if (lateVisibleSignal.shouldEscalateHeavy) {
            return { skip: false, reason: lateVisibleSignal.reason };
        }

        return {
            skip: true,
            reason: `healthy-first-pulse:anomaly=0,resBad=0,maxRes<=${this.openStabilizeStableMaxGapPx.toFixed(1)},lateVisible=0`
        };
    }

    private getOffsetCleanupOptionsForSource(source: string, phase: string): OffsetCleanupOptions {
        const baseSource = this.getOpenStabilizeBaseSource(source);
        const isNodeMountedSource = baseSource.startsWith('node-mounted');
        return {
            releaseFixClass: !isNodeMountedSource,
            sourceTag: `${phase}:${isNodeMountedSource ? 'node-mounted-hold' : 'default-release'}`
        };
    }

    private getOpenStabilizeFirstPulseStrategyLabel(source: string, forceHeavyFirstPulse: boolean): string {
        if (forceHeavyFirstPulse) {
            return 'open-entry-force-first';
        }

        const baseSource = this.getOpenStabilizeBaseSource(source);
        if (baseSource.startsWith('node-mounted')) {
            return 'node-mounted-light-first';
        }

        return 'non-open-light-first';
    }

    private canScheduleOpenStabilizeResume(nextSource: string): boolean {
        const baseSource = this.getOpenStabilizeBaseSource(nextSource);
        const currentCount = this.openStabilizeResumeCountByBaseSource.get(baseSource) ?? 0;
        if (currentCount >= this.openStabilizeResumeMax) {
            log(
                `[Layout] OpenStabilizeResumeCapHit: source=${nextSource}, base=${baseSource}, ` +
                `resumeCount=${currentCount}, cap=${this.openStabilizeResumeMax}`
            );
            return false;
        }

        const nextCount = currentCount + 1;
        this.openStabilizeResumeCountByBaseSource.set(baseSource, nextCount);
        log(`[Layout] OpenStabilizeResumeAccepted: source=${nextSource}, base=${baseSource}, resumeCount=${nextCount}/${this.openStabilizeResumeMax}`);
        return true;
    }

    private async performOpenStabilization(source: string): Promise<void> {
        const baseSource = this.getOpenStabilizeBaseSource(source);
        const isResumeSource = this.isOpenStabilizeResumeSource(source);
        const shouldReplayCollapseOnPulse = this.isOpenEntryStabilizeSource(source);
        if (!isResumeSource) {
            this.openStabilizeResumeCountByBaseSource.set(baseSource, 0);
        }

        if (this.isArranging) {
            log(`[Layout] OpenStabilizeSkip: arrange busy, source=${source}`);
            this.scheduleOpenStabilization(`${source}-arrange-busy`);
            return;
        }

        if (this.isOpenStabilizing) {
            this.pendingOpenStabilizeSource = source;
            log(`[Layout] OpenStabilizePending: source=${source}`);
            return;
        }

        this.isOpenStabilizing = true;
        const stabilizeId = `openfix-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        let finalHealthyFilePath: string | null = null;
        let finalHealthyNodeCount = 0;
        let finalHealthyEdgeCount = 0;
        let finalHealthy = false;

        try {
            const initialView = getCanvasView(this.app);
            if (!initialView || initialView.getViewType() !== 'canvas') {
                log(`[Layout] OpenStabilizeSkip: no active canvas, source=${source}, ctx=${stabilizeId}`);
                return;
            }

            const initialCanvas = this.getCanvasFromView(initialView);
            if (!initialCanvas) {
                log(`[Layout] OpenStabilizeSkip: canvas not ready, source=${source}, ctx=${stabilizeId}`);
                return;
            }

            await this.waitForNextFrame(120);

            let pulseCanvas = initialCanvas;
            let pulseNodes = this.getCanvasNodes(pulseCanvas);
            if (pulseNodes.size === 0) {
                log(`[Layout] OpenStabilizeSkip: nodes=0, source=${source}, ctx=${stabilizeId}`);
                return;
            }

            finalHealthyFilePath = pulseCanvas.file?.path || getCurrentCanvasFilePath(this.app) || null;
            const healthySkipDecision = this.shouldSkipHealthyOpenStabilize(
                source,
                finalHealthyFilePath,
                pulseNodes.size,
                this.getCanvasEdges(pulseCanvas).length
            );
            if (healthySkipDecision.skip) {
                log(
                    `[Layout] OpenStabilizeHealthySkip: source=${source}, file=${finalHealthyFilePath || 'unknown'}, ` +
                    `ageMs=${healthySkipDecision.ageMs}, nodeCount=${pulseNodes.size}, ` +
                    `edgeCount=${this.getCanvasEdges(pulseCanvas).length}, ctx=${stabilizeId}`
                );
                return;
            }

            log(`[Layout] OpenStabilizeStart: source=${source}, pulses=${this.openStabilizePulseDelays.length}, nodes=${pulseNodes.size}, ctx=${stabilizeId}`);
            if (this.shouldLogVerboseCanvasDiagnostics()) {
                this.edgeGeometryService.logNodeStyleTruth(pulseNodes, 'open-pre-style-truth', stabilizeId);
            }

            let prevVisibleNodeCount = 0;
            let stableStreak = 0;
            let latestAnomalyStats = this.edgeGeometryService.countAnomalousVisibleNodesDetailed(pulseNodes);
            let latestGapSummary = this.edgeGeometryService.summarizeVisibleEdgeScreenGaps(pulseCanvas, pulseNodes);

            for (let i = 0; i < this.openStabilizePulseDelays.length; i++) {
                const pulseNo = i + 1;
                const pulseDelay = this.openStabilizePulseDelays[i] ?? 0;

                if (pulseDelay > 0) {
                    await this.waitForNextFrame(pulseDelay);
                }

                const refreshedView = getCanvasView(this.app);
                const refreshedCanvas = refreshedView
                    ? (this.getCanvasFromView(refreshedView) ?? pulseCanvas)
                    : pulseCanvas;
                const refreshedNodes = this.getCanvasNodes(refreshedCanvas);

                if (refreshedNodes.size === 0) {
                    log(`[Layout] OpenStabilizePulse#${pulseNo}Skip: nodes=0, source=${source}, ctx=${stabilizeId}`);
                    continue;
                }

                pulseCanvas = refreshedCanvas;
                pulseNodes = refreshedNodes;

                if (shouldReplayCollapseOnPulse) {
                    const rehiddenOnOpenEntryPulse = this.reapplyCurrentCollapseVisibility(
                        pulseCanvas,
                        `open-entry-pulse#${pulseNo}:${source}`
                    );
                    if (rehiddenOnOpenEntryPulse > 0) {
                        log(
                            `[Layout] OpenEntryCollapseReplay: source=${source}, pulse=${pulseNo}, ` +
                            `hidden=${rehiddenOnOpenEntryPulse}, ctx=${stabilizeId}`
                        );
                        await this.waitForNextFrame(24);
                        pulseNodes = this.getCanvasNodes(pulseCanvas);
                    }
                }

                const visibleNodeCount = this.getVisibleNodeCount(pulseNodes);
                const lateVisibleNodes = Math.max(0, visibleNodeCount - prevVisibleNodeCount);
                prevVisibleNodeCount = Math.max(prevVisibleNodeCount, visibleNodeCount);

                const anomalyBeforeStats = this.edgeGeometryService.countAnomalousVisibleNodesDetailed(pulseNodes);
                const gapBefore = this.edgeGeometryService.summarizeVisibleEdgeScreenGaps(pulseCanvas, pulseNodes);
                this.edgeGeometryService.emitDiagnosticPhaseSummary({
                    phase: 'transient-open-pulse',
                    tag: `open-pulse-${pulseNo}`,
                    anomalyStats: anomalyBeforeStats,
                    gapSummary: gapBefore,
                    contextId: stabilizeId,
                    extra: {
                        source,
                        pulseNo,
                        visibleNodeCount,
                        lateVisibleNodes,
                    }
                });
                const lateVisibleSignal = this.evaluateLateVisibleSignal(
                    pulseNo,
                    lateVisibleNodes,
                    visibleNodeCount,
                    anomalyBeforeStats,
                    gapBefore
                );
                const forceHeavyFirstPulse = this.shouldForceHeavyOnFirstPulse(source);
                const forcedHeavyFirstPulse = pulseNo === 1 && forceHeavyFirstPulse;
                const forceHeavyDecision = forcedHeavyFirstPulse
                    ? this.shouldSkipForcedHeavyFirstPulse(
                        source,
                        anomalyBeforeStats,
                        gapBefore,
                        lateVisibleNodes,
                        visibleNodeCount,
                        pulseNo
                    )
                    : { skip: false, reason: 'not-forced' };
                const gapAssessment = this.getOpenStabilizeGapAssessment(gapBefore);
                const actionableAnomaly = anomalyBeforeStats.anomalous > 0
                    && gapAssessment.trustedGapIssue;
                const heavyEscalated = lateVisibleSignal.shouldEscalateHeavy
                    || gapAssessment.trustedGapIssue
                    || actionableAnomaly;
                const shouldRunHeavy = (forcedHeavyFirstPulse && !forceHeavyDecision.skip) || heavyEscalated;
                const cleanupOptions = this.getOffsetCleanupOptionsForSource(source, `open-p${pulseNo}`);
                const firstPulseStrategyLabel = this.getOpenStabilizeFirstPulseStrategyLabel(source, forceHeavyFirstPulse);
                const firstPulseForceLabel = forcedHeavyFirstPulse
                    ? (forceHeavyDecision.skip
                        ? (forceHeavyDecision.reason === 'bootstrap-lateVisible-healthy'
                            ? 'downgraded-bootstrap-late-visible'
                            : 'downgraded-to-light')
                        : 'forced-heavy')
                    : 'not-applicable';

                const persistentAnomaly = anomalyBeforeStats.anomalous > 0
                    && lateVisibleNodes === 0
                    && !gapAssessment.trustedGapIssue
                    && pulseNo >= 2;
                const shouldRunLightPersistentGuard = persistentAnomaly && !shouldRunHeavy;

                if (pulseNo === 1 && !forceHeavyFirstPulse) {
                    if (heavyEscalated) {
                    logVerbose(
                            `[Layout] OpenStabilizeEscalateHeavy: source=${source}, lateVisible=${lateVisibleNodes}, ` +
                            `lateVisibleSignal=${lateVisibleSignal.reason}, ` +
                            `anomalies={${this.formatAnomalyStats(anomalyBeforeStats)}}, anomalyActionable=${actionableAnomaly}, residualBadEdges=${gapBefore.residualBadEdges}, ` +
                            `maxResidualGap=${gapBefore.maxResidualGap.toFixed(1)}, gapTrust=${gapAssessment.confidenceReason}, topBad=${gapBefore.topResidualBadSample || gapBefore.topBadSample}, ctx=${stabilizeId}`
                        );
                    } else {
                        logVerbose(`[Layout] OpenStabilizeSkipHeavyBySource: source=${source}, pulse=${pulseNo}, ctx=${stabilizeId}`);
                    }
                }

                if (shouldRunLightPersistentGuard) {
                    logVerbose(
                        `[Layout] OpenStabilizePersistentAnomalyGuard: source=${source}, pulse=${pulseNo}, ` +
                        `anomaly=${anomalyBeforeStats.anomalous}, residualBadEdges=${gapBefore.residualBadEdges}, ` +
                        `maxResidualGap=${gapBefore.maxResidualGap.toFixed(1)}, gapTrust=${gapAssessment.confidenceReason}, ctx=${stabilizeId}`
                    );
                }

                logVerbose(
                    `[Layout] OpenStabilizePulse#${pulseNo}: source=${source}, delay=${pulseDelay}, visible=${visibleNodeCount}, ` +
                    `late-visible-nodes=${lateVisibleNodes}, anomalies={${this.formatAnomalyStats(anomalyBeforeStats)}}, ` +
                    `lateVisibleSignal=${lateVisibleSignal.reason}, ` +
                    `pulse-gap-summary=${this.formatGapSummary(gapBefore)}, ` +
                    `runHeavy=${shouldRunHeavy}, sourceAware=${firstPulseStrategyLabel}, ` +
                    `firstPulseForce=${firstPulseForceLabel}, ` +
                    `firstPulseReason=${forceHeavyDecision.reason}, ` +
                    `gapTrusted=${gapAssessment.trustedGapIssue}, gapLowConfidence=${gapAssessment.lowConfidenceGapIssue}, ` +
                    `anomalyActionable=${actionableAnomaly}, persistentGuard=${shouldRunLightPersistentGuard}, cleanupRelease=${cleanupOptions.releaseFixClass ? 'allow' : 'hold'}, ctx=${stabilizeId}`
                );

                let cleanedPass1 = 0;
                let cleanedPass2 = 0;
                let edgePass1 = 0;
                let edgePass2 = 0;

                if (shouldRunHeavy) {
                    cleanedPass1 = this.edgeGeometryService.cleanupAnomalousNodePositioning(
                        pulseCanvas,
                        pulseNodes,
                        `${stabilizeId}-p${pulseNo}`,
                        cleanupOptions
                    );
                    if (cleanedPass1 > 0) {
                        await this.waitForNextFrame();
                    }

                    const refreshResult = await this.edgeGeometryService.refreshEdgeGeometry(pulseCanvas, `${stabilizeId}-p${pulseNo}`);
                    edgePass1 = refreshResult.pass1;
                    edgePass2 = refreshResult.pass2;

                    cleanedPass2 = this.edgeGeometryService.cleanupAnomalousNodePositioning(
                        pulseCanvas,
                        pulseNodes,
                        `${stabilizeId}-p${pulseNo}`,
                        cleanupOptions
                    );
                    if (cleanedPass2 > 0) {
                        await this.waitForNextFrame();
                    }
                } else if (shouldRunLightPersistentGuard) {
                    cleanedPass1 = this.edgeGeometryService.cleanupAnomalousNodePositioning(
                        pulseCanvas,
                        pulseNodes,
                        `${stabilizeId}-p${pulseNo}-guard`,
                        { ...cleanupOptions, releaseFixClass: true, sourceTag: `${cleanupOptions.sourceTag || 'open'}:persistent-guard` }
                    );
                    const refreshResult = await this.edgeGeometryService.refreshEdgeGeometry(pulseCanvas, `${stabilizeId}-p${pulseNo}-guard`);
                    edgePass1 = refreshResult.pass1;
                    edgePass2 = refreshResult.pass2;
                }

                requestCanvasUpdate(pulseCanvas);

                const anomalyAfterStats = this.edgeGeometryService.countAnomalousVisibleNodesDetailed(pulseNodes);
                const gapAfter = this.edgeGeometryService.summarizeVisibleEdgeScreenGaps(pulseCanvas, pulseNodes);
                latestAnomalyStats = anomalyAfterStats;
                latestGapSummary = gapAfter;
                const blockerEval = this.getOpenStabilizeBlockers(
                    anomalyAfterStats,
                    gapAfter,
                    lateVisibleNodes,
                    pulseNo,
                    visibleNodeCount
                );
                const pulseBlockers = blockerEval.blockers;
                const pulseStable = pulseBlockers.length === 0;
                stableStreak = pulseStable ? (stableStreak + 1) : 0;

                logVerbose(
                    `[Layout] OpenStabilizePulse#${pulseNo}Done: source=${source}, cleaned=${cleanedPass1}/${cleanedPass2}, ` +
                    `edgePass=${edgePass1}/${edgePass2}, anomalies={${this.formatAnomalyStats(anomalyAfterStats)}}, ` +
                    `late-visible-nodes=${lateVisibleNodes}, pulse-gap-summary=${this.formatGapSummary(gapAfter)}, ` +
                    `stable=${pulseStable}, blockers=${pulseBlockers.join('|') || 'none'}, ` +
                    `downgraded=${blockerEval.downgraded.join('|') || 'none'}, stableStreak=${stableStreak}, ctx=${stabilizeId}`
                );

                if (this.shouldLogVerboseCanvasDiagnostics() && (pulseNo === 1 || pulseNo === this.openStabilizePulseDelays.length || shouldRunHeavy)) {
                    this.edgeGeometryService.logNodeStyleTruth(pulseNodes, `open-pulse-${pulseNo}-style-truth`, stabilizeId);
                }

                if (stableStreak >= 2 && pulseNo >= 2) {
                    log(`[Layout] OpenStabilizeConverged: source=${source}, pulse=${pulseNo}, ctx=${stabilizeId}`);
                    break;
                }
            }

            if (this.shouldLogVerboseCanvasDiagnostics()) {
                this.edgeGeometryService.logNodeStyleTruth(pulseNodes, 'open-final-style-truth', stabilizeId);
            }

            finalHealthyNodeCount = pulseNodes.size;
            finalHealthyEdgeCount = this.getCanvasEdges(pulseCanvas).length;
            finalHealthy = this.isHealthyOpenStabilizeContext(latestAnomalyStats, latestGapSummary);

            window.setTimeout(() => {
                const finalView = getCanvasView(this.app);
                const finalCanvas = finalView ? (this.getCanvasFromView(finalView) ?? pulseCanvas) : pulseCanvas;
                const finalNodes = this.getCanvasNodes(finalCanvas);
                const finalAnomalyStats = this.edgeGeometryService.countAnomalousVisibleNodesDetailed(finalNodes);
                const finalGapSummary = this.edgeGeometryService.summarizeVisibleEdgeScreenGaps(finalCanvas, finalNodes);
                this.edgeGeometryService.emitDiagnosticPhaseSummary({
                    phase: 'final',
                    tag: 'open-final',
                    anomalyStats: finalAnomalyStats,
                    gapSummary: finalGapSummary,
                    contextId: stabilizeId,
                    extra: { source }
                });
                if (this.shouldLogVerboseCanvasDiagnostics()) {
                    this.edgeGeometryService.logComprehensiveDiag(finalCanvas, finalNodes, 'open-final', stabilizeId);
                }
            }, 260);

            log(`[Layout] OpenStabilizeDone: source=${source}, pulses=${this.openStabilizePulseDelays.length}, ctx=${stabilizeId}`);
        } catch (err) {
            handleError(err, { context: 'OpenStabilize', message: '画布打开后自愈失败', showNotice: false });
        } finally {
            if (finalHealthy) {
                this.rememberHealthyOpenStabilize(
                    finalHealthyFilePath,
                    finalHealthyNodeCount,
                    finalHealthyEdgeCount,
                    source,
                    stabilizeId
                );
            } else {
                this.forgetHealthyOpenStabilize(finalHealthyFilePath);
            }
            this.isOpenStabilizing = false;
            if (this.pendingOpenStabilizeSource) {
                const pending = this.pendingOpenStabilizeSource;
                this.pendingOpenStabilizeSource = '';
                const resumeSource = `${pending}-resume`;
                if (this.canScheduleOpenStabilizeResume(resumeSource)) {
                    this.scheduleOpenStabilization(resumeSource);
                }
            }
        }
    }

    private async waitForNextFrame(delayMs: number = 0): Promise<void> {
        await new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
                if (delayMs > 0) {
                    window.setTimeout(() => resolve(), delayMs);
                    return;
                }
                resolve();
            });
        });
    }

    private getVisibleNodeCount(allNodes: Map<string, CanvasNodeLike>): number {
        let visible = 0;
        for (const [, node] of allNodes) {
            const nodeEl = (node).nodeEl;
            if (nodeEl && nodeEl.offsetHeight > 0) {
                visible++;
            }
        }
        return visible;
    }

    private formatGapSummary(summary: EdgeScreenGapSummary): string {
        const gapConfidence = this.edgeGeometryService.assessGapObservationConfidence(summary);
        return `all=${summary.allEdges},bothVis=${summary.bothVisibleEdges},oneVis=${summary.oneSideVisibleEdges},virt=${summary.bothVirtualizedEdges},` +
            `sampled=${summary.sampledEdges},bad=${summary.badEdges},resBad=${summary.residualBadEdges}(>${summary.badGapThresholdPx.toFixed(1)}px),` +
            `avg=${summary.avgGap.toFixed(1)}/${summary.avgResidualGap.toFixed(1)}(raw/res),` +
            `max=${summary.maxGap.toFixed(1)}/${summary.maxResidualGap.toFixed(1)}(raw/res),stub=${summary.stubCompensationPx.toFixed(1)},scale=${summary.canvasScale.toFixed(3)},` +
            `gapTrust=${gapConfidence.trustedForSevereRisk ? 'trusted' : 'low'},gapReason=${gapConfidence.reason},` +
            `topBad=${summary.topBadSample || 'none'},topResBad=${summary.topResidualBadSample || 'none'},decompose=${summary.topBadDecompose || 'none'},` +
            `driftNodes=${summary.topDriftNodes || 'none'},posBuckets=${summary.positionBuckets || 'none'},` +
            `sample=${summary.sample || 'none'}`;
    }

    private formatAnomalyStats(stats: OffsetAnomalyStats): string {
        return `visible=${stats.visible},anomalous=${stats.anomalous},topOnly=${stats.topOnly},leftOnly=${stats.leftOnly},` +
            `topAndLeft=${stats.topAndLeft},insetTopLeft=${stats.insetTopLeft},softInsetOnly=${stats.softInsetOnly}`;
    }

    private evaluateOpenStabilizeGapConfidence(
        gapSummary: EdgeScreenGapSummary,
        pulseNo: number
    ): { shouldDowngradeGapBlockers: boolean; reason: string } {
        const gapConfidence = this.edgeGeometryService.assessGapObservationConfidence(gapSummary);
        const rawGapIssue = gapSummary.residualBadEdges > 0
            || gapSummary.maxResidualGap > this.openStabilizeStableMaxGapPx;

        const mildResidualCap = this.openStabilizeStableMaxGapPx + 6;
        const mildResidual = gapSummary.residualBadEdges <= 1
            && gapSummary.maxResidualGap <= mildResidualCap;

        const shouldDowngradeGapBlockers = rawGapIssue
            && !gapConfidence.trustedForSevereRisk
            && (gapConfidence.lowConfidence || pulseNo >= 2 || mildResidual);
        const reason = `p${pulseNo},bothVis=${gapSummary.bothVisibleEdges},oneVis=${gapSummary.oneSideVisibleEdges},sampled=${gapSummary.sampledEdges},resBad=${gapSummary.residualBadEdges},maxRes=${gapSummary.maxResidualGap.toFixed(1)},gapReason=${gapConfidence.reason}`;
        return { shouldDowngradeGapBlockers, reason };
    }

    private getOpenStabilizeBlockers(
        anomalyStats: OffsetAnomalyStats,
        gapSummary: EdgeScreenGapSummary,
        lateVisibleNodes: number,
        pulseNo: number,
        visibleNodeCount: number
    ): { blockers: string[]; downgraded: string[] } {
        const blockers: string[] = [];
        const downgraded: string[] = [];

        const gapConfidence = this.evaluateOpenStabilizeGapConfidence(gapSummary, pulseNo);
        const gapAssessment = this.getOpenStabilizeGapAssessment(gapSummary);
        const lateVisibleSignal = this.evaluateLateVisibleSignal(
            pulseNo,
            lateVisibleNodes,
            visibleNodeCount,
            anomalyStats,
            gapSummary
        );

        const actionableAnomaly = anomalyStats.anomalous > 0
            && gapAssessment.trustedGapIssue;
        if (actionableAnomaly) {
            blockers.push(`anomaly:${anomalyStats.anomalous}`);
        }

        if (gapAssessment.rawGapIssue) {
            if (gapConfidence.shouldDowngradeGapBlockers) {
                downgraded.push(`gapRisk:resBad=${gapSummary.residualBadEdges},maxRes=${gapSummary.maxResidualGap.toFixed(1)}(${gapConfidence.reason})`);
            } else {
                if (gapSummary.residualBadEdges > 0) {
                    blockers.push(`resBadEdges:${gapSummary.residualBadEdges}`);
                }
                if (gapSummary.maxResidualGap > this.openStabilizeStableMaxGapPx) {
                    blockers.push(`maxResGap:${gapSummary.maxResidualGap.toFixed(1)}>${this.openStabilizeStableMaxGapPx.toFixed(1)}`);
                }
            }
        }

        if (lateVisibleSignal.isBootstrapLateVisibleHealthy) {
            downgraded.push(`lateVisibleBootstrap:${lateVisibleNodes}`);
        } else if (lateVisibleSignal.shouldEscalateHeavy) {
            blockers.push(`lateVisible:${lateVisibleNodes}`);
        }

        return { blockers, downgraded };
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

    private shouldLogVerboseCanvasDiagnostics(): boolean {
        return !!this.settings.enableDebugLogging && !!this.settings.enableVerboseCanvasDiagnostics;
    }

    private rememberArrangeStateSignature(filePath: string | null, signature: string, source: string): void {
        if (!filePath) return;
        this.recentArrangeStateByFilePath.set(filePath, {
            filePath,
            signature,
            source,
            recordedAt: Date.now(),
        });
        logVerbose(`[Layout] ArrangeStateRemembered: file=${filePath}, source=${source}, signature=${signature}`);
    }

    private buildProjectedArrangeStateSignature(
        canvasData: CanvasDataLike | undefined,
        edges: CanvasEdgeLike[],
        result: Map<string, { x: number; y: number; width?: number; height?: number }>
    ): string {
        const projectedNodes = (canvasData?.nodes ?? []).map((node) => {
            if (typeof node.id !== 'string') return node;
            const next = result.get(node.id);
            if (!next) return node;
            return {
                ...node,
                x: next.x,
                y: next.y,
                width: typeof next.width === 'number' && next.width > 0 ? next.width : node.width,
                height: typeof next.height === 'number' && next.height > 0 ? next.height : node.height,
            };
        });

        return buildArrangeStateSignature({
            ...(canvasData ?? {}),
            nodes: projectedNodes,
            edges,
        }, edges);
    }

    private reorderEdgesToMatchStableSnapshot(
        canvasData: CanvasDataLike,
        stableOriginalEdges: CanvasEdgeLike[],
        contextId?: string
    ): boolean {
        if (!Array.isArray(canvasData.edges) || canvasData.edges.length <= 1 || stableOriginalEdges.length <= 1) {
            return false;
        }

        const stableOrder = new Map<string, number>();
        for (let i = 0; i < stableOriginalEdges.length; i++) {
            const edgeId = stableOriginalEdges[i]?.id;
            if (typeof edgeId === 'string' && !stableOrder.has(edgeId)) {
                stableOrder.set(edgeId, i);
            }
        }

        if (stableOrder.size === 0) return false;

        const beforeIds = canvasData.edges.map((edge) => edge.id || '').join('|');
        const originalIndexes = new Map<CanvasEdgeLike, number>();
        canvasData.edges.forEach((edge, index) => originalIndexes.set(edge, index));

        canvasData.edges.sort((a, b) => {
            const aStable = typeof a.id === 'string' ? stableOrder.get(a.id) : undefined;
            const bStable = typeof b.id === 'string' ? stableOrder.get(b.id) : undefined;

            if (aStable !== undefined && bStable !== undefined) return aStable - bStable;
            if (aStable !== undefined) return -1;
            if (bStable !== undefined) return 1;
            return (originalIndexes.get(a) ?? 0) - (originalIndexes.get(b) ?? 0);
        });

        const afterIds = canvasData.edges.map((edge) => edge.id || '').join('|');
        const changed = beforeIds !== afterIds;
        if (changed) {
            log(`[Layout] StableEdgeOrderApplied: edges=${canvasData.edges.length}, ctx=${contextId || 'none'}`);
        }
        return changed;
    }

    /**
     * [2-Cycle 振荡保护] 生成输入签名：基于节点位置和高度
     * 用于检测 arrange 输入是否相同
     */
    private computeInputSignature(
        canvasData: CanvasDataLike | undefined,
        allNodes: Map<string, CanvasNodeLike>
    ): string {
        if (!canvasData?.nodes) return 'no-data';

        const signature = buildArrangeStateSignature(canvasData, canvasData.edges);
        const samples = canvasData.nodes.slice(0, 5).map(n => {
            const node = allNodes.get(n.id ?? '');
            const domH = (node)?.nodeEl?.offsetHeight ?? 0;
            return `${n.id?.slice(0, 6)}:${n.x?.toFixed(0)},${n.y?.toFixed(0)},${n.height?.toFixed(0)},domH=${domH}`;
        });
        return `in:${signature}:${samples.join('|')}`;
    }

    /**
     * [2-Cycle 振荡保护] 生成输出签名：基于布局结果
     * 用于检测 arrange 输出是否在 A/B 之间摇摆
     */
    private computeOutputSignature(
        result: Map<string, { x: number; y: number; width?: number; height?: number }>
    ): string {
        const allEntries = Array.from(result.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([nodeId, pos]) => (
                `${nodeId}:${pos.x.toFixed(1)}:${pos.y.toFixed(1)}:${(pos.width ?? 0).toFixed(1)}:${(pos.height ?? 0).toFixed(1)}`
            ));
        const samples = allEntries.slice(0, 5).map(entry => entry.slice(0, 48));
        return `out:n${allEntries.length}:h${computeArrangeSigHash(allEntries.join('|'))}:${samples.join('|')}`;
    }

    /**
     * [2-Cycle 振荡保护] 检测 A→B→A→B 振荡模式
     * [方案4] 降级为二级保险丝：只对 auto source 生效，manual 不拦
     * 返回 true 表示检测到振荡，应跳过后续 arrange
     */
    private detectOscillation(inputSig: string, outputSig: string, source: string): boolean {
        // [方案4] manual arrange 不触发振荡检测，让用户操作总是生效
        if (source === 'manual') {
            return false;
        }

        const now = Date.now();
        
        // 冷却期内不重复检测
        if (this.oscillationDetected && (now - this.lastOscillationTime) < this.oscillationCooldownMs) {
            return true;
        }

        // 记录历史签名
        this.arrangeInputSignatures.push(inputSig);
        this.arrangeOutputSignatures.push(outputSig);
        
        // 保持历史大小
        while (this.arrangeInputSignatures.length > this.oscillationHistorySize) {
            this.arrangeInputSignatures.shift();
            this.arrangeOutputSignatures.shift();
        }

        // 检测 2-cycle: A→B→A→B 模式
        // 条件：输入相同，输出在两个值之间摇摆
        if (this.arrangeInputSignatures.length >= 4) {
            const inputs = this.arrangeInputSignatures;
            const outputs = this.arrangeOutputSignatures;
            
            // 检查输入是否相同（或非常相似）
            const inputStable = inputs.every(s => s === inputs[0]);
            
            // 检查输出是否呈现 A→B→A→B 模式
            // outputs[0] === outputs[2] && outputs[1] === outputs[3]
            if (inputStable && 
                outputs[0] === outputs[2] && 
                outputs[1] === outputs[3] &&
                outputs[0] !== outputs[1]) {
                this.oscillationDetected = true;
                this.lastOscillationTime = now;
                log(
                    `[Layout] OscillationDetected: source=${source}, ` +
                    `pattern=A→B→A→B, inputSig=${inputSig.slice(0, 50)}..., ` +
                    `outA=${outputs[0]?.slice(0, 30)}..., outB=${outputs[1]?.slice(0, 30)}...`
                );
                return true;
            }
        }

        this.oscillationDetected = false;
        return false;
    }

    /**
     * [2-Cycle 振荡保护] 重置振荡检测状态
     * 在手动 arrange 或其他用户操作时调用
     */
    private resetOscillationState(): void {
        this.arrangeInputSignatures = [];
        this.arrangeOutputSignatures = [];
        this.oscillationDetected = false;
    }

    /**
     * [C2] 获取节点的安全尺寸（带 fallback 防止 0 宽高）
     */
    private getSafeNodeSize(originalNode: CanvasNodeLike, currentData: Record<string, unknown>): { width: number; height: number } {
        const nodeAny = originalNode;
        
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
     * [彻底修复-V3] 通过 leaf.openFile() 强制重载 Canvas，等效于手动"关闭再打开"。
     *
     * 之前用 canvas.setData()/importData() 的方案失败原因：
     * setData 执行后 Canvas 引擎内部触发自动保存（requestSave），
     * 把内存中的不一致状态写回文件，导致下次打开也是错的。
     *
     * leaf.openFile() 走 Obsidian 的标准 canvas 加载路径，
     * 和用户手动关闭再打开效果完全一样，已知可行。
     */
    private async reloadCanvasViaLeaf(
        canvas: CanvasLike,
        canvasFilePath: string,
        allNodes: Map<string, CanvasNodeLike>,
        view: unknown,
        contextId?: string,
        layoutResult?: Map<string, { x: number; y: number; width?: number; height?: number }>
    ): Promise<boolean> {
        const c = canvas;
        const canvasFile = this.app.vault.getAbstractFileByPath(canvasFilePath);
        if (!(canvasFile instanceof TFile)) {
            log(`[Layout] LeafReload: canvasFile not found, ctx=${contextId || 'none'}`);
            return false;
        }

        // 探测可用的 reload API（仅用于日志，不调用 setData/importData）
        const reloadApis = ['setData', 'importData', 'loadData', 'deserialize'];
        const reloadApiHost = c as Record<string, unknown>;
        const available = reloadApis.filter(m => typeof reloadApiHost[m] === 'function');
        log(`[Layout] CanvasReloadAPIs(detected,unused): available=[${available.join(',')}], ctx=${contextId || 'none'}`);

        // 通过 leaf.openFile() 重新加载 canvas（与手动关闭再打开等效）
        try {
            const leaf = isRecord(view)
                ? (view as { leaf?: { openFile?: (file: TFile, options?: { active?: boolean }) => Promise<void> } }).leaf
                : undefined;
            if (leaf && typeof leaf.openFile === 'function') {
                this.canvasManager?.markProgrammaticCanvasReload?.(canvasFilePath, 1800);
                log(`[Layout] LeafReload: calling leaf.openFile, ctx=${contextId || 'none'}`);
                await leaf.openFile(canvasFile, { active: false });
                log(`[Layout] LeafReload: done, ctx=${contextId || 'none'}`);
                // 等一帧让 Canvas 完成 DOM 初始化
                await new Promise<void>(r => requestAnimationFrame(() => r()));
                // 获取重载后的新 canvas 引用（不再强制 zoomToBbox，保持用户当前视图）
                const newView = getCanvasView(this.app);
                const newCanvas = newView ? this.getCanvasFromView(newView) : null;
                const targetCanvas = newCanvas ?? canvas;
                if (targetCanvas !== canvas) {
                    log(`[Layout] LeafReload: switched to fresh canvas ref, ctx=${contextId || 'none'}`);
                }
                return true;
            }
        } catch (e) {
            log(`[Layout] LeafReload error: ${String(e)}, ctx=${contextId || 'none'}`);
        }

        // 降级：仅记录，不再强制修改视图缩放
        log(`[Layout] LeafReload: fallback(no-zoom), ctx=${contextId || 'none'}`);
        return false;
    }

    public reapplyCurrentCollapseVisibility(canvas: CanvasLike, reason: string = 'runtime'): number {
        const beforeVisible = this.getVisibleNodeCount(this.getCanvasNodes(canvas));
        const result = this.collapseToggleService.reapplyCurrentCollapseVisibility(canvas, {
            requestUpdate: true,
            reason
        });
        const afterVisible = this.getVisibleNodeCount(this.getCanvasNodes(canvas));

        log(
            `[Layout] ReapplyCollapseVisibilityDone: hidden=${result.hiddenNodeCount}, nodes=${result.nodeCount}, ` +
            `edges=${result.edgeCount}, visibleBefore=${beforeVisible}, visibleAfter=${afterVisible}, reason=${reason}`
        );

        return result.hiddenNodeCount;
    }

    /**
     * zoomToBbox 辅助：计算所有节点的包围盒并调用 Canvas 引擎的 zoomToBbox
     */
    private zoomToAllNodes(
        canvas: CanvasLike,
        allNodes: Map<string, CanvasNodeLike>,
        contextId?: string,
        layoutResult?: Map<string, { x: number; y: number; width?: number; height?: number }>
    ): void {
        const c = canvas;
        if (typeof c.zoomToBbox !== 'function') {
            log(`[Layout] ZoomToBbox: API not available, ctx=${contextId || 'none'}`);
            return;
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let count = 0;
        for (const [nodeId, node] of allNodes.entries()) {
            const target = layoutResult?.get(nodeId);
            const x = typeof target?.x === 'number' ? target.x : (typeof node.x === 'number' ? node.x : 0);
            const y = typeof target?.y === 'number' ? target.y : (typeof node.y === 'number' ? node.y : 0);
            const w = typeof target?.width === 'number' && target.width > 0
                ? target.width
                : (typeof node.width === 'number' ? node.width : 0);
            const h = typeof target?.height === 'number' && target.height > 0
                ? target.height
                : (typeof node.height === 'number' ? node.height : 0);
            if (x - 1 < minX) minX = x - 1;
            if (y - 1 < minY) minY = y - 1;
            if (x + w + 1 > maxX) maxX = x + w + 1;
            if (y + h + 1 > maxY) maxY = y + h + 1;
            count++;
        }
        if (count === 0 || minX === Infinity) return;
        try {
            c.zoomToBbox({ minX, minY, maxX, maxY });
            log(`[Layout] ZoomToBbox: bbox=${minX.toFixed(0)},${minY.toFixed(0)}->${maxX.toFixed(0)},${maxY.toFixed(0)}, nodes=${count}, ctx=${contextId || 'none'}`);
        } catch (e) {
            log(`[Layout] ZoomToBbox error: ${String(e)}, ctx=${contextId || 'none'}`);
        }
    }

    /**
     * 更新节点位置到Canvas
     * [修复] 同时同步 height 到内存节点，确保边连接点基于正确高度计算
     * @param result 布局结果映射（包含 x, y, width, height）
     * @param allNodes 所有节点映射
     * @param canvas Canvas对象
     * @returns 更新的节点数量
     */
    private updateNodePositions(
        result: Map<string, { x: number; y: number; width?: number; height?: number }>,
        allNodes: Map<string, CanvasNodeLike>,
        canvas: CanvasLike,
        contextId?: string
    ): number {
        let updatedCount = 0;
        let movedCount = 0;
        let missingCount = 0;
        let maxDelta = 0;
        let totalDelta = 0;
        let virtualizedCount = 0;
        let visibleCount = 0;
        
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
                const nodeAny = originalNode;
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

                // [彻底修复] 对所有节点（含可见节点）只做纯数据层更新，完全不调用 moveAndResize。
                //
                // 根因分析：moveAndResize 内部触发 markMoved → requestFrame，
                // requestFrame 是全局操作，会遍历 Canvas 所有节点（含虚拟化节点）。
                // 虚拟化节点的 isAttached 属性为 undefined → Uncaught TypeError。
                // 该 TypeError 破坏 Canvas 引擎内部渲染状态，导致后续所有渲染（边路径、
                // rerenderViewport、zoomToBbox）均在损坏状态下运行 → 边永远错连。
                //
                // 方案：只用 setData + bbox 更新内存数据，不触发任何 Canvas 引擎内部渲染链。
                // 数据层正确后，由后续的 canvas.setData(fileData) 重加载触发完整干净渲染。
                const nodeEl = (originalNode).nodeEl;
                const isVirtualized = !nodeEl || nodeEl.offsetHeight === 0;
                if (isVirtualized) { virtualizedCount++; } else { visibleCount++; }

                const newData: Record<string, unknown> = {
                    ...currentData,
                    x: newPosition.x,
                    y: newPosition.y,
                    width: currentWidth,
                    height: currentHeight,
                };
                originalNode.setData(newData);

                // 同步 bbox — 边的锚点计算依赖 bbox（setData 不一定自动更新 bbox）
                (originalNode).bbox = {
                    minX: newPosition.x,
                    minY: newPosition.y,
                    maxX: newPosition.x + currentWidth,
                    maxY: newPosition.y + currentHeight
                };

                updatedCount++;
            } else {
                missingCount++;
            }
        }

        const avgDelta = updatedCount > 0 ? totalDelta / updatedCount : 0;
        log(`[Layout] NodePos: updated=${updatedCount}, moved=${movedCount}, missing=${missingCount}, visible=${visibleCount}, virtualized=${virtualizedCount}, maxDelta=${maxDelta.toFixed(1)}, avgDelta=${avgDelta.toFixed(1)}, ctx=${contextId || 'none'}`);
        
        // [C2] 尺寸来源日志
        if (fromNode > 0 || fromLayout > 0 || defaulted > 0) {
            log(`[Layout] NodeSizeFallback: zeroFromData=${zeroFromData}, fromNode=${fromNode}, fromLayout=${fromLayout}, defaulted=${defaulted}, ctx=${contextId || 'none'}`);
        }

        // [移除] requestUpdate/requestSave — 会触发 Canvas 引擎把当前内存状态自动保存到文件，
        // 可能在 modifyCanvasDataAtomic 写入正确位置之前/之后覆盖文件，导致数据污染。
        // 文件写入由 modifyCanvasDataAtomic 统一管理（SSOT原则）。
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
        const adjustedCount = await this.canvasManager.adjustAllTextNodeHeights({ suppressRequestSave: true });
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
            const preflightCanvasFilePath = canvas.file?.path || getCurrentCanvasFilePath(this.app);
            const stableOrderSnapshot = preflightCanvasFilePath
                ? await this.canvasFileService.readCanvasData(preflightCanvasFilePath)
                : null;
            const stableOriginalEdges = Array.isArray(stableOrderSnapshot?.edges) ? stableOrderSnapshot.edges : [];
            if (stableOrderSnapshot) {
                log(`[Layout] ArrangeOrderSnapshot: source=preflight-file, nodes=${stableOrderSnapshot.nodes?.length || 0}, edges=${stableOriginalEdges.length}, ctx=${arrangeId}`);
            } else {
                log(`[Layout] ArrangeOrderSnapshot: source=runtime-fallback, ctx=${arrangeId}`);
            }

            await this.triggerHeightAdjustment(skipAdjust, arrangeId);

            // [方案2] manual arrange 前刷新更多 viewport trusted heights
            // 优先使用 viewport 方法（覆盖视口区域），fallback 到 visible 方法
            if (!skipAdjust) {
                const refreshedTrusted = await this.canvasManager?.refreshTrustedHeightsForViewportTextNodes?.(36, 6, { suppressRequestSave: true })
                    ?? await this.canvasManager?.refreshTrustedHeightsForVisibleTextNodes?.(8, { suppressRequestSave: true })
                    ?? 0;
                log(`[Layout] PreflightTrustedRefresh: refreshed=${refreshedTrusted}, method=${this.canvasManager?.refreshTrustedHeightsForViewportTextNodes ? 'viewport(36,6)' : 'visible(8)'}, ctx=${arrangeId}`);
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
            const canonicalOrderCanvasData = stableOrderSnapshot || canvasData || undefined;
            const canonicalOriginalEdges = stableOriginalEdges.length > 0 ? stableOriginalEdges : originalEdges;
            const preflightStateSignature = buildArrangeStateSignature(canonicalOrderCanvasData, canonicalOriginalEdges);
            const preflightGapSummary = this.edgeGeometryService.summarizeVisibleEdgeScreenGaps(canvas, allNodes);
            const preflightSevereVisualRisk = this.edgeGeometryService.hasSevereVisualGapRisk(preflightGapSummary);
            const repeatManualSkipDecision = getArrangeRepeatManualSkipDecision({
                source,
                filePath: canvasFilePath,
                currentSignature: preflightStateSignature,
                previousSnapshot: canvasFilePath ? (this.recentArrangeStateByFilePath.get(canvasFilePath) ?? null) : null,
                severeVisualRisk: preflightSevereVisualRisk,
            });

            if (repeatManualSkipDecision.skip) {
                log(
                    `[Layout] ArrangeNoOpPreflight: source=${source}, file=${canvasFilePath || 'unknown'}, ` +
                    `reason=${repeatManualSkipDecision.reason}, signature=${preflightStateSignature}, ` +
                    `gapSummary=${this.formatGapSummary(preflightGapSummary)}, ctx=${arrangeId}`
                );
                new Notice('布局完成！无结构变化');
                this.rememberArrangeStateSignature(canvasFilePath, preflightStateSignature, source);
                return;
            }

            // [方案3] 低 DOM 可见率时，auto arrange 降级，不做整树重排
            // 原因：在 domVisibleRate 很低时（如 16.3%），大量节点高度不可信，
            //       此时做整树布局风险很高，容易产生不稳定结果。
            // 策略：
            // - auto source（file-change/debounce/pending-resume）：跳过，只做 open stabilization
            // - manual source：继续执行，但已有 preflight trusted refresh 保证
            const domVisibleRate = layoutData.visibilityStats?.domVisibleRate ?? 1;
            const domVisibleCount = layoutData.visibilityStats?.domVisibleCount ?? 0;
            const AUTO_ARRANGE_MIN_DOM_VISIBLE_RATE = 0.25; // 25%

            if (source !== 'manual' && domVisibleRate < AUTO_ARRANGE_MIN_DOM_VISIBLE_RATE) {
                log(
                    `[Layout] AutoArrangeSkipLowDomVisibility: source=${source}, domVisibleRate=${(domVisibleRate * 100).toFixed(1)}%, ` +
                    `domVisibleCount=${domVisibleCount}, threshold=${(AUTO_ARRANGE_MIN_DOM_VISIBLE_RATE * 100).toFixed(0)}%, ` +
                    `ctx=${arrangeId}`
                );
                // 仅做 open stabilization，不做整树布局
                this.scheduleOpenStabilization(`auto-skip-low-visibility:${source}`);
                new Notice(`跳过自动整理：DOM 可见率过低 (${(domVisibleRate * 100).toFixed(0)}%)。请手动触发整理。`);
                return;
            }

            // [2-Cycle 振荡保护] 生成输入签名
            const inputSig = this.computeInputSignature(canvasData ?? undefined, allNodes);

            // 诊断日志：arrange前的节点/边几何与视觉层快照
            if (this.shouldLogVerboseCanvasDiagnostics()) {
                const preArrangeAnomalyStats = this.edgeGeometryService.countAnomalousVisibleNodesDetailed(allNodes);
                const preArrangeGapSummary = this.edgeGeometryService.summarizeVisibleEdgeScreenGaps(canvas, allNodes);
                this.edgeGeometryService.emitDiagnosticPhaseSummary({
                    phase: 'transient-pre',
                    tag: 'pre-arrange',
                    anomalyStats: preArrangeAnomalyStats,
                    gapSummary: preArrangeGapSummary,
                    contextId: arrangeId,
                    extra: { source }
                });
                this.edgeGeometryService.logFullDiagSnapshot(canvas, allNodes, 'pre-arrange', arrangeId);
                this.edgeGeometryService.logComprehensiveDiag(canvas, allNodes, 'pre-arrange', arrangeId);
            }

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

            // [Canonical Layout] manual arrange 使用 forceResetCoordinates=true
            // 根因：manual arrange 应该是"结构重排"，不应依赖旧坐标作为输入
            // 这样确保同一棵树、同一组高度，多次 manual arrange 输出唯一结果
            const manualCanonical = source === 'manual';

            let result = originalArrangeLayout(
                visibleNodes,
                edges,
                this.getLayoutSettings(),
                canonicalOriginalEdges,
                allNodes,
                canonicalOrderCanvasData,
                {
                    forceResetCoordinates: manualCanonical,
                    forceReason: manualCanonical ? 'manual-canonical' : 'normal'
                }
            );

            let predictedChangedCount = this.countSignificantPositionChanges(
                canvasData?.nodes ?? [],
                result,
                CONSTANTS.LAYOUT.POSITION_WRITE_EPSILON
            );

            let forceResetApplied = false;
            if (predictedChangedCount === 0 && visibleNodes.size > 0) {
                log(`[Layout] ArrangeForceReset: base predictedChanged=0, 尝试结构重排(忽略输入坐标), ctx=${arrangeId}`);
                const forceResult = originalArrangeLayout(
                    visibleNodes,
                    edges,
                    this.getLayoutSettings(),
                    canonicalOriginalEdges,
                    allNodes,
                    canonicalOrderCanvasData,
                    {
                        forceResetCoordinates: true,
                        forceReason: 'predictedChanged=0'
                    }
                );
                const forcePredictedChanged = this.countSignificantPositionChanges(
                    canvasData?.nodes ?? [],
                    forceResult,
                    CONSTANTS.LAYOUT.POSITION_WRITE_EPSILON
                );
                log(`[Layout] ArrangeForceReset: base=0, force=${forcePredictedChanged}, ctx=${arrangeId}`);
                if (forcePredictedChanged > 0) {
                    result = forceResult;
                    predictedChangedCount = forcePredictedChanged;
                    forceResetApplied = true;
                    log(`[Layout] ArrangeForceReset: 使用强制重排结果, predictedChanged=${predictedChangedCount}, ctx=${arrangeId}`);
                } else {
                    log(`[Layout] ArrangeForceReset: 强制重排仍为0，保留原结果（可能结构已稳定/问题不在节点坐标）, ctx=${arrangeId}`);
                }
            }

            let missingInResult = 0;
            for (const nodeId of visibleNodes.keys()) {
                if (!result.has(nodeId)) missingInResult++;
            }
            const extraInResult = Math.max(0, result.size - (visibleNodes.size - missingInResult));
            log(`[Layout] ArrangeResult: id=${arrangeId}, layoutNodes=${result.size}, missing=${missingInResult}, extra=${extraInResult}, predictedChanged=${predictedChangedCount}, forceResetApplied=${forceResetApplied}`);

            // [2-Cycle 振荡保护] 生成输出签名并检测振荡
            const outputSig = this.computeOutputSignature(result);
            log(`[Layout] ArrangeSignature: inputSig=${inputSig.slice(0, 50)}..., outputSig=${outputSig.slice(0, 50)}..., ctx=${arrangeId}`);
            
            if (this.detectOscillation(inputSig, outputSig, source)) {
                log(`[Layout] ArrangeOscillationBlocked: 检测到 A→B→A→B 振荡模式，跳过本次 arrange, ctx=${arrangeId}`);
                new Notice('检测到布局振荡，已暂停自动整理。请手动触发整理或检查节点高度问题。');
                return;
            }

            if (!canvasFilePath) throw new Error('找不到路径');

            const memoryEdges = this.getCanvasEdges(canvas);
            log(`[Layout] ArrangeMemoryEdges: id=${arrangeId}, count=${memoryEdges.length}`);

            // [强制写入] 移除低可见性跳过逻辑。
            // 原因：之前 shouldSkipFileWrite 导致文件不更新，
            // 后续 canvas reload 读回旧文件数据 → 显示旧布局。
            // arrange 结果总是正确的，数据应无条件写入文件。
            const inViewportRate = layoutData.visibilityStats?.inViewportRate ?? 1;
            const inViewportCount = layoutData.visibilityStats?.inViewportCount ?? 0;
            log(`[Layout] FileWriteAlways: domVisibleRate=${(domVisibleRate * 100).toFixed(1)}%, domVisibleCount=${domVisibleCount}, inViewportRate=${(inViewportRate * 100).toFixed(1)}%, inViewportCount=${inViewportCount}, predictedChanged=${predictedChangedCount}, forceResetApplied=${forceResetApplied}, ctx=${arrangeId}`);

            const success = await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (data) => {
                const canvasData = data;
                if (!Array.isArray(canvasData.nodes) || !Array.isArray(canvasData.edges)) return false;
                let changed = false;

                if (this.applyLayoutPositions(canvasData, result, arrangeId)) {
                    changed = true;
                }

                if (this.edgeGeometryService.mergeMemoryEdgesIntoFileData(canvasData, memoryEdges, arrangeId)) {
                    changed = true;
                }

                if (stableOriginalEdges.length > 0 && this.reorderEdgesToMatchStableSnapshot(canvasData, stableOriginalEdges, arrangeId)) {
                    changed = true;
                }

                return changed;
            });

            // [No-Op 快路径] 当 arrange 预测无节点位移且文件层也无任何实际改动时，
            // 直接跳过 leaf.openFile 重载与后续重型链路，避免无意义视觉跳动。
            // 若当前没有严重视觉风险，则直接视为成功终态，不再默认补一次 open stabilization。
            const noOpFastPathDecision = getArrangeNoOpFastPathDecision(
                predictedChangedCount,
                success,
                this.edgeGeometryService.hasSevereVisualGapRisk(
                    this.edgeGeometryService.summarizeVisibleEdgeScreenGaps(canvas, allNodes)
                )
            );

            if (noOpFastPathDecision.useFastPath) {
                const noOpGapSummary = this.edgeGeometryService.summarizeVisibleEdgeScreenGaps(canvas, allNodes);
                log(
                    `[Layout] ArrangeNoOpFastPath: predictedChanged=0, fileChanged=false, ` +
                    `skipLeafReload=true, postArrangeStabilize=${noOpFastPathDecision.followUp.scheduleOpenStabilization}, ` +
                    `reason=${noOpFastPathDecision.reason}, gapSummary=${this.formatGapSummary(noOpGapSummary)}, ctx=${arrangeId}`
                );
                if (noOpFastPathDecision.followUp.scheduleOpenStabilization) {
                    this.scheduleOpenStabilization('arrange-no-op');
                }
                this.rememberArrangeStateSignature(canvasFilePath, preflightStateSignature, source);
                new Notice('布局完成！无节点变化');
                log(`[Layout] 完成: predictedChanged=${predictedChangedCount}, success=${success}, mode=no-op-fast-path, ctx=${arrangeId}`);
                return;
            }

            if (predictedChangedCount === 0 && !success) {
                const noOpGapSummary = this.edgeGeometryService.summarizeVisibleEdgeScreenGaps(canvas, allNodes);
                log(
                    `[Layout] ArrangeNoOpFastPathBlocked: predictedChanged=0, fileChanged=false, ` +
                    `reason=${noOpFastPathDecision.reason}, gapSummary=${this.formatGapSummary(noOpGapSummary)}, ctx=${arrangeId}`
                );
            }

            // 通过 leaf.openFile() 重加载 Canvas 引擎，等效于"关闭再打开"
            // 注意：不再手动 setData/bbox/edge.render，避免与 Canvas 引擎自动渲染冲突
            await this.reloadCanvasViaLeaf(canvas, canvasFilePath, allNodes, activeView, arrangeId, result);

            // 等待 Canvas 引擎完成初始化渲染
            await new Promise<void>((resolve) => {
                requestAnimationFrame(() => {
                    window.setTimeout(() => resolve(), 120);
                });
            });

            // 获取 leaf.openFile 后的 fresh canvas + fresh nodes 引用
            const freshView2 = getCanvasView(this.app);
            const freshCanvas = freshView2 ? (this.getCanvasFromView(freshView2) ?? canvas) : canvas;
            const freshNodes = this.getCanvasNodes(freshCanvas);
            log(`[Layout] FreshRef: same=${freshCanvas === canvas}, nodes=${freshNodes.size}, ctx=${arrangeId}`);

            const rehiddenAfterReload = this.reapplyCurrentCollapseVisibility(freshCanvas, `arrange-post-reload:${arrangeId}`);
            if (rehiddenAfterReload > 0) {
                await this.waitForNextFrame(40);
            }

            const calibratedDomHeights = await this.calibrateNodeHeightsFromDOM(
                freshCanvas,
                freshNodes,
                canvasFilePath,
                arrangeId
            );
            if (calibratedDomHeights > 0) {
                requestCanvasUpdate(freshCanvas);
                await this.waitForNextFrame(60);
            }

            // 诊断日志：reload后的节点/边几何与视觉层快照
            if (this.shouldLogVerboseCanvasDiagnostics()) {
                const postReloadAnomalyStats = this.edgeGeometryService.countAnomalousVisibleNodesDetailed(freshNodes);
                const postReloadGapSummary = this.edgeGeometryService.summarizeVisibleEdgeScreenGaps(freshCanvas, freshNodes);
                this.edgeGeometryService.emitDiagnosticPhaseSummary({
                    phase: 'transient-post-reload',
                    tag: 'post-reload',
                    anomalyStats: postReloadAnomalyStats,
                    gapSummary: postReloadGapSummary,
                    contextId: arrangeId,
                    extra: { source }
                });
                this.edgeGeometryService.logFullDiagSnapshot(freshCanvas, freshNodes, 'post-reload', arrangeId);
                this.edgeGeometryService.logComprehensiveDiag(freshCanvas, freshNodes, 'post-reload', arrangeId);
                this.edgeGeometryService.logNodeStyleTruth(freshNodes, 'post-reload-style-truth', arrangeId);
            }

            // [时序修复] 提前执行第一轮 cleanup，尽快消除用户可见的错位窗口。
            // 之前 cleanup 在 post-reload-watch 之后，可能留下 200~400ms 的可见错位。
            // [振荡修复] arrange 流程中禁止释放 fix class，避免"治好→停药→复发"循环
            const earlyCleanedCount = this.edgeGeometryService.cleanupAnomalousNodePositioning(
                freshCanvas,
                freshNodes,
                arrangeId,
                { sourceTag: 'arrange-early', releaseFixClass: false }
            );
            if (earlyCleanedCount > 0) {
                log(`[Layout] EarlyCleanup: cleaned=${earlyCleanedCount}, wait-dom-settle, ctx=${arrangeId}`);
                await new Promise<void>((resolve) => {
                    requestAnimationFrame(() => {
                        window.setTimeout(() => resolve(), 150);
                    });
                });
            }
            if (this.shouldLogVerboseCanvasDiagnostics()) {
                this.edgeGeometryService.logNodeStyleTruth(freshNodes, 'post-early-cleanup-style-truth', arrangeId);
            }

            // [样式时间线] leaf.openFile 后短窗口观察，捕获引擎初始化阶段对节点 style/class 的写入
            if (this.shouldLogVerboseCanvasDiagnostics()) {
                await this.edgeGeometryService.traceStyleMutationsForVisibleNodes(
                    freshNodes,
                    'post-reload-watch',
                    arrangeId,
                    120
                );
            }

            // 高度诊断：对比文件层高度与DOM高度，确认是否存在系统性放大
            await this.logHeightDriftSnapshot(freshCanvas, freshNodes, canvasFilePath, arrangeId);

            await this.cleanupStaleFloatingNodes(freshCanvas, freshNodes);
            this.reapplyFloatingNodeStyles(freshCanvas);

            // cleanup 前样式真值快照
            if (this.shouldLogVerboseCanvasDiagnostics()) {
                this.edgeGeometryService.logNodeStyleTruth(freshNodes, 'pre-cleanup-style-truth', arrangeId);
            }

            // [样式时间线] 观测 cleanup 过程中的 style/class 改动（含本插件与引擎联动写入）
            const cleanupWatchPromise = this.shouldLogVerboseCanvasDiagnostics()
                ? this.edgeGeometryService.traceStyleMutationsForVisibleNodes(
                    freshNodes,
                    'cleanup-watch',
                    arrangeId,
                    260
                )
                : Promise.resolve();

            // [修复A] 清理外部CSS导致的节点top/left偏移（主题/插件污染）
            // 根因：某些节点computed top≠0（如87px），导致visual位置与transform不一致
            // [振荡修复] arrange 流程中禁止释放 fix class，避免"治好→停药→复发"循环
            const cleanedCount = this.edgeGeometryService.cleanupAnomalousNodePositioning(
                freshCanvas,
                freshNodes,
                arrangeId,
                { sourceTag: 'arrange-main', releaseFixClass: false }
            );
            if (cleanedCount > 0) {
                log(`[Layout] 清理完成，等待DOM稳定后刷新边, cleaned=${cleanedCount}, ctx=${arrangeId}`);
                // 等一帧让浏览器应用清理后的样式
                await new Promise<void>(r => requestAnimationFrame(() => r()));
            }

            await cleanupWatchPromise;
            if (this.shouldLogVerboseCanvasDiagnostics()) {
                this.edgeGeometryService.logNodeStyleTruth(freshNodes, 'post-cleanup-style-truth', arrangeId);
            }

            // [修复B] 双pass引擎级边几何刷新：解决leaf.openFile后部分虚拟化节点边端点未及时更新的问题
            // pass1: edge.render() + requestUpdate() 触发bezier计算
            // pass2: 等Canvas引擎完成虚拟化节点渲染后再刷一次，确保所有边端点收敛
            const edgeRefreshWatchPromise = this.shouldLogVerboseCanvasDiagnostics()
                ? this.edgeGeometryService.traceStyleMutationsForVisibleNodes(
                    freshNodes,
                    'edge-refresh-watch',
                    arrangeId,
                    360
                )
                : Promise.resolve();

            log(`[Layout] 开始双pass边刷新（引擎驱动）, ctx=${arrangeId}`);
            const refreshResult = await this.edgeGeometryService.refreshEdgeGeometry(freshCanvas, arrangeId);
            log(`[Layout] 双pass边刷新完成: pass1=${refreshResult.pass1}, pass2=${refreshResult.pass2}, bezierChanged=${refreshResult.bezierChangedPass1}/${refreshResult.bezierChangedPass2}, pathDChanged=${refreshResult.pathDChangedPass1}/${refreshResult.pathDChangedPass2}, ctx=${arrangeId}`);
            await edgeRefreshWatchPromise;
            if (this.shouldLogVerboseCanvasDiagnostics()) {
                const postEdgeRefreshAnomalyStats = this.edgeGeometryService.countAnomalousVisibleNodesDetailed(freshNodes);
                const postEdgeRefreshGapSummary = this.edgeGeometryService.summarizeVisibleEdgeScreenGaps(freshCanvas, freshNodes);
                this.edgeGeometryService.emitDiagnosticPhaseSummary({
                    phase: 'transient-post-edge-refresh',
                    tag: 'post-edge-refresh',
                    anomalyStats: postEdgeRefreshAnomalyStats,
                    gapSummary: postEdgeRefreshGapSummary,
                    contextId: arrangeId,
                    extra: { source }
                });
                this.edgeGeometryService.logNodeStyleTruth(freshNodes, 'post-edge-refresh-style-truth', arrangeId);
            }

            // [时序修复] 第二轮轻量 cleanup：处理 edge-refresh 等待期间才注入到 DOM 的节点。
            // [振荡修复] arrange 流程中禁止释放 fix class，避免"治好→停药→复发"循环
            const postRefreshCleanedCount = this.edgeGeometryService.cleanupAnomalousNodePositioning(
                freshCanvas,
                freshNodes,
                arrangeId,
                { sourceTag: 'arrange-post-refresh', releaseFixClass: false }
            );
            if (postRefreshCleanedCount > 0) {
                log(`[Layout] PostEdgeRefreshCleanup: cleaned=${postRefreshCleanedCount}, ctx=${arrangeId}`);
                await new Promise<void>((resolve) => {
                    requestAnimationFrame(() => resolve());
                });
                if (this.shouldLogVerboseCanvasDiagnostics()) {
                    this.edgeGeometryService.logNodeStyleTruth(freshNodes, 'post-edge-refresh-cleanup-style-truth', arrangeId);
                }
            }

            // 最终 requestUpdate 让Canvas引擎同步所有变更到DOM（不手工写path）
            const finalRequestUpdateWatchPromise = this.shouldLogVerboseCanvasDiagnostics()
                ? this.edgeGeometryService.traceStyleMutationsForVisibleNodes(
                    freshNodes,
                    'final-request-update-watch',
                    arrangeId,
                    260
                )
                : Promise.resolve();

            requestCanvasUpdate(freshCanvas);

            const rehiddenAfterFinalUpdate = this.reapplyCurrentCollapseVisibility(
                freshCanvas,
                `arrange-post-final-request-update:${arrangeId}`
            );
            if (rehiddenAfterFinalUpdate > 0) {
                await this.waitForNextFrame();
            }

            await finalRequestUpdateWatchPromise;
            if (this.shouldLogVerboseCanvasDiagnostics()) {
                this.edgeGeometryService.logNodeStyleTruth(freshNodes, 'post-final-request-update-style-truth', arrangeId);
            }

            // 最终诊断：给一次延迟采样，便于观察 requestUpdate 后的稳定状态
            window.setTimeout(() => {
                const finalView = getCanvasView(this.app);
                const finalCanvas = finalView ? (this.getCanvasFromView(finalView) ?? freshCanvas) : freshCanvas;
                const finalNodes = this.getCanvasNodes(finalCanvas);
                const finalAnomalyStats = this.edgeGeometryService.countAnomalousVisibleNodesDetailed(finalNodes);
                const finalGapSummary = this.edgeGeometryService.summarizeVisibleEdgeScreenGaps(finalCanvas, finalNodes);
                this.edgeGeometryService.emitDiagnosticPhaseSummary({
                    phase: 'final',
                    tag: 'final',
                    anomalyStats: finalAnomalyStats,
                    gapSummary: finalGapSummary,
                    contextId: arrangeId,
                    extra: { source }
                });
                if (this.shouldLogVerboseCanvasDiagnostics()) {
                    this.edgeGeometryService.logFullDiagSnapshot(finalCanvas, finalNodes, 'final', arrangeId);
                    this.edgeGeometryService.logComprehensiveDiag(finalCanvas, finalNodes, 'final', arrangeId);
                    this.edgeGeometryService.logNodeStyleTruth(finalNodes, 'final-style-truth', arrangeId);
                }
            }, 350);

            if (success) {
                const projectedStateSignature = this.buildProjectedArrangeStateSignature(
                    canonicalOrderCanvasData,
                    canonicalOriginalEdges,
                    result
                );
                this.rememberArrangeStateSignature(canvasFilePath, projectedStateSignature, source);
            }

            new Notice(`布局完成！已写入 ${predictedChangedCount} 个节点位置`);
            log(`[Layout] 完成: predictedChanged=${predictedChangedCount}, success=${success}, mode=engine-driven, ctx=${arrangeId}`);


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
    syncHiddenChildrenOnDrag(node: CanvasNodeLike): void {
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
    private reapplyFloatingNodeStyles(canvas: CanvasLike): void {
        log(`[Layout] reapplyFloatingNodeStyles 被调用, floatingNodeService=${this.floatingNodeService ? 'exists' : 'null'}`);
        try {
            const canvasFilePath = canvas.file?.path || getCurrentCanvasFilePath(this.app);
            if (!canvasFilePath) {
                log('[Layout] 警告: 无法获取 canvas 文件路径，跳过样式应用');
                return;
            }

            log(`[Layout] 开始重新应用浮动节点样式 for ${canvasFilePath}`);
            // 延迟一点时间确保 DOM 已渲染完毕
            setTimeout(() => {
                if (this.floatingNodeService) {
                    log(`[Layout] 调用 floatingNodeService.reapplyAllFloatingStyles...`);
                    void this.floatingNodeService.reapplyAllFloatingStyles(canvas)
                        .then(() => {
                            log(`[Layout] 完成重新应用浮动节点样式 for ${canvasFilePath}`);
                        })
                        .catch((err) => {
                            handleError(err, { context: 'Layout', message: '重新应用样式失败', showNotice: false });
                        });
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

    private canSetData(node: unknown): node is CanvasNodeLike & {
        setData: (data: Record<string, unknown>) => void;
        getData?: () => Record<string, unknown>;
    } {
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

    /**
     * 高度漂移诊断：采样 fileH/memH/domH 及比例，定位“节点高度被系统性放大”问题。
     */
    private async logHeightDriftSnapshot(
        canvas: CanvasLike,
        freshNodes: Map<string, CanvasNodeLike>,
        canvasFilePath: string,
        contextId?: string
    ): Promise<void> {
        try {
            const data = await this.canvasFileService.readCanvasData(canvasFilePath);
            if (!data?.nodes || data.nodes.length === 0) {
                logVerbose(`[Layout] HeightDrift: fileData empty, ctx=${contextId || 'none'}`);
                return;
            }

            const fileMap = new Map<string, number>();
            for (const n of data.nodes) {
                if (typeof n.id === 'string' && typeof n.height === 'number') {
                    fileMap.set(n.id, n.height);
                }
            }

            let sampled = 0;
            let driftCount = 0;
            const lines: string[] = [];
            for (const [nodeId, node] of freshNodes) {
                const nodeEl = (node).nodeEl;
                const domH = nodeEl ? nodeEl.offsetHeight : 0;
                if (domH <= 0) continue;

                const fileH = fileMap.get(nodeId);
                const memH = typeof (node).height === 'number' ? (node).height : -1;
                if (typeof fileH !== 'number' || memH < 0) continue;

                sampled++;
                const ratio = fileH > 0 ? domH / fileH : 0;
                const drift = Math.abs(domH - fileH);
                if (drift > 5) driftCount++;

                if (lines.length < 12 && drift > 5) {
                    lines.push(`${nodeId.slice(0, 8)}: fileH=${fileH}, memH=${memH}, domH=${domH}, ratio=${ratio.toFixed(2)}`);
                }
            }

            logVerbose(`[Layout] HeightDrift: sampled=${sampled}, drift(>5px)=${driftCount}, ctx=${contextId || 'none'}`);
            if (lines.length > 0) {
                logVerbose(`[Layout] HeightDriftSamples:\n${lines.join('\n')}`);
            }
        } catch (err) {
            logVerbose(`[Layout] HeightDrift error: ${String(err)}, ctx=${contextId || 'none'}`);
        }
    }

    /**
     * [高度校准] DOM 高度校准：leaf.openFile 后，对所有 DOM 已渲染（offsetHeight > 0）的节点，
     * 如果其 offsetHeight 与内存中的 node.height 差值 > 5px，则修正内存数据并同步写入文件。
     *
     * 目的：修正因 T13C 墨水屏渲染差异导致的节点高度不一致（如文件记录 151px，T13C 渲染 215px），
     * 确保 edge.render() 用于计算锚点的 bbox 与实际 DOM 渲染高度一致，消除"边悬空"问题。
     */
    private async calibrateNodeHeightsFromDOM(
        canvas: CanvasLike,
        freshNodes: Map<string, CanvasNodeLike>,
        canvasFilePath: string,
        contextId?: string
    ): Promise<number> {
        let calibrated = 0, skipped = 0, virt = 0;
        const corrections: Array<{ id: string; oldH: number; newH: number }> = [];

        for (const [nodeId, node] of freshNodes) {
            const nodeEl = (node).nodeEl;
            if (!nodeEl || nodeEl.offsetHeight === 0) {
                virt++;
                continue;
            }
            const domH = nodeEl.offsetHeight;
            const memH = typeof (node).height === 'number' ? (node).height : -1;
            if (memH < 0 || Math.abs(domH - memH) <= 5) {
                skipped++;
                continue;
            }
            if (!this.canSetData(node)) {
                skipped++;
                continue;
            }
            try {
                const getDataFn = node.getData;
                const currentData: Record<string, unknown> = getDataFn ? getDataFn.call(node) : {};
                node.setData({ ...currentData, height: domH });
                const x = typeof (node).x === 'number' ? (node).x : 0;
                const y = typeof (node).y === 'number' ? (node).y : 0;
                const w = typeof (node).width === 'number' ? (node).width : 0;
                (node).bbox = { minX: x, minY: y, maxX: x + w, maxY: y + domH };
                corrections.push({ id: nodeId, oldH: memH, newH: domH });
                calibrated++;
            } catch {
                // 忽略单个节点校准失败
            }
        }

        const sampleStr = corrections.slice(0, 5).map(c => `${c.id.slice(0, 8)}:${c.oldH}→${c.newH}`).join('|');
        log(`[Layout] CalibrateDOMH: calibrated=${calibrated}, skipped=${skipped}, virt=${virt}, corrections=${sampleStr || 'none'}, ctx=${contextId || 'none'}`);

        if (calibrated > 0) {
            const corrMap = new Map(corrections.map(c => [c.id, c.newH]));
            await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (data) => {
                if (!Array.isArray(data.nodes)) return false;
                let changed = false;
                for (const n of data.nodes) {
                    if (typeof n.id === 'string' && corrMap.has(n.id)) {
                        n.height = corrMap.get(n.id)!;
                        changed = true;
                    }
                }
                return changed;
            });
            log(`[Layout] CalibrateDOMH: file updated with ${calibrated} height corrections, ctx=${contextId || 'none'}`);
        }

        return calibrated;
    }
}
