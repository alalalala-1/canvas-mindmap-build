import { beforeEach, describe, expect, it } from 'vitest';
import { EdgeGeometryService, type EdgeScreenGapSummary } from '../canvas/services/edge-geometry-service';
import { clearRecentLogs, getRecentLogs, updateLoggerConfig } from '../utils/logger';

const baseGapSummary = (overrides: Partial<EdgeScreenGapSummary> = {}): EdgeScreenGapSummary => ({
	allEdges: 6,
	bothVisibleEdges: 4,
	oneSideVisibleEdges: 1,
	bothVirtualizedEdges: 1,
	sampledEdges: 4,
	badEdges: 0,
	residualBadEdges: 0,
	avgGap: 3,
	maxGap: 3,
	avgResidualGap: 0,
	maxResidualGap: 0,
	badGapThresholdPx: 8,
	stubCompensationPx: 3.5,
	canvasScale: 1,
	topBadSample: 'none',
	topResidualBadSample: 'none',
	topBadDecompose: 'none',
	topDriftNodes: 'none',
	positionBuckets: 'abs=2,rel=0,other=0',
	sample: 'none',
	...overrides,
});

const baseAnomalyStats = {
	visible: 4,
	anomalous: 0,
	topOnly: 0,
	leftOnly: 0,
	topAndLeft: 0,
	insetTopLeft: 0,
	softInsetOnly: 0,
};

describe('EdgeGeometryService diagnostics semantics', () => {
	beforeEach(() => {
		updateLoggerConfig({ enableDebugLogging: true, enableVerboseCanvasDiagnostics: false });
		clearRecentLogs();
	});

	it('should suppress refresh-pending edge bad details when only partial-observation rows are bad', () => {
		const service = new EdgeGeometryService() as unknown as {
			getEdgeBadDumpPlan: (
				pendingHint: { refreshPending: boolean; expectedRecovery: string; geometryState: string } | null,
				edgeRows: Array<{
					maxErr: number;
					line: string;
					visibilityBucket: 'both-visible' | 'one-side-visible' | 'virtualized-involved';
					screenRisk: 'high' | 'medium' | 'low';
				}>
			) => {
				mode: 'full' | 'summary-only' | 'focused';
				rowsToLog: Array<{ line: string }>;
				suppressedCount: number;
				actionableCount: number;
				reason: string;
			};
		};

		const plan = service.getEdgeBadDumpPlan(
			{ refreshPending: true, expectedRecovery: 'edge-refresh-pass', geometryState: 'refresh-pending' },
			[
				{ maxErr: 48, line: 'edge-a', visibilityBucket: 'virtualized-involved', screenRisk: 'low' },
				{ maxErr: 16, line: 'edge-b', visibilityBucket: 'one-side-visible', screenRisk: 'medium' },
			],
		);

		expect(plan).toMatchObject({
			mode: 'summary-only',
			rowsToLog: [],
			suppressedCount: 2,
			actionableCount: 0,
			reason: 'refresh-pending-partial-observation-only',
		});
	});

	it('should keep both-visible bad edges actionable during refresh-pending suppression', () => {
		const service = new EdgeGeometryService() as unknown as {
			getEdgeBadDumpPlan: (
				pendingHint: { refreshPending: boolean; expectedRecovery: string; geometryState: string } | null,
				edgeRows: Array<{
					maxErr: number;
					line: string;
					visibilityBucket: 'both-visible' | 'one-side-visible' | 'virtualized-involved';
					screenRisk: 'high' | 'medium' | 'low';
				}>
			) => {
				mode: 'full' | 'summary-only' | 'focused';
				rowsToLog: Array<{ line: string; visibilityBucket: string }>;
				suppressedCount: number;
				actionableCount: number;
				reason: string;
			};
		};

		const plan = service.getEdgeBadDumpPlan(
			{ refreshPending: true, expectedRecovery: 'edge-refresh-pass', geometryState: 'refresh-pending' },
			[
				{ maxErr: 36, line: 'edge-a', visibilityBucket: 'both-visible', screenRisk: 'high' },
				{ maxErr: 18, line: 'edge-b', visibilityBucket: 'one-side-visible', screenRisk: 'medium' },
			],
		);

		expect(plan).toMatchObject({
			mode: 'focused',
			suppressedCount: 1,
			actionableCount: 1,
			reason: 'refresh-pending-partial-observation-suppressed',
		});
		expect(plan.rowsToLog).toHaveLength(1);
		expect(plan.rowsToLog[0]).toMatchObject({
			line: 'edge-a',
			visibilityBucket: 'both-visible',
		});
	});

	it('should suppress transient diagnostic details when refresh-pending has no actionable both-visible bad rows', () => {
		const service = new EdgeGeometryService() as unknown as {
			getDiagnosticDetailDumpPlan: (
				pendingHint: { refreshPending: boolean; expectedRecovery: string; geometryState: string } | null,
				detailRows: Array<{
					line: string;
					visibilityBucket: 'both-visible' | 'one-side-visible' | 'virtualized-involved';
					screenRisk: 'high' | 'medium' | 'low';
					status: 'ok' | 'bad' | 'deferred';
				}>
			) => {
				mode: 'full' | 'summary-only' | 'focused';
				rowsToLog: Array<{ line: string }>;
				suppressedCount: number;
				actionableCount: number;
				reason: string;
			};
		};

		const plan = service.getDiagnosticDetailDumpPlan(
			{ refreshPending: true, expectedRecovery: 'edge-refresh-pass', geometryState: 'refresh-pending' },
			[
				{ line: 'edge-a', visibilityBucket: 'both-visible', screenRisk: 'high', status: 'ok' },
				{ line: 'edge-b', visibilityBucket: 'one-side-visible', screenRisk: 'medium', status: 'bad' },
				{ line: 'edge-c', visibilityBucket: 'virtualized-involved', screenRisk: 'low', status: 'deferred' },
			],
		);

		expect(plan).toMatchObject({
			mode: 'summary-only',
			rowsToLog: [],
			suppressedCount: 3,
			actionableCount: 0,
			reason: 'refresh-pending-no-actionable-both-visible',
		});
	});

	it('should keep only both-visible bad transient details actionable during refresh-pending', () => {
		const service = new EdgeGeometryService() as unknown as {
			getDiagnosticDetailDumpPlan: (
				pendingHint: { refreshPending: boolean; expectedRecovery: string; geometryState: string } | null,
				detailRows: Array<{
					line: string;
					visibilityBucket: 'both-visible' | 'one-side-visible' | 'virtualized-involved';
					screenRisk: 'high' | 'medium' | 'low';
					status: 'ok' | 'bad' | 'deferred';
				}>
			) => {
				mode: 'full' | 'summary-only' | 'focused';
				rowsToLog: Array<{ line: string; visibilityBucket: string; status: string }>;
				suppressedCount: number;
				actionableCount: number;
				reason: string;
			};
		};

		const plan = service.getDiagnosticDetailDumpPlan(
			{ refreshPending: true, expectedRecovery: 'edge-refresh-pass', geometryState: 'refresh-pending' },
			[
				{ line: 'edge-a', visibilityBucket: 'both-visible', screenRisk: 'high', status: 'bad' },
				{ line: 'edge-b', visibilityBucket: 'both-visible', screenRisk: 'high', status: 'ok' },
				{ line: 'edge-c', visibilityBucket: 'one-side-visible', screenRisk: 'medium', status: 'bad' },
			],
		);

		expect(plan).toMatchObject({
			mode: 'focused',
			suppressedCount: 2,
			actionableCount: 1,
			reason: 'refresh-pending-focused-both-visible-bad',
		});
		expect(plan.rowsToLog).toEqual([
			expect.objectContaining({
				line: 'edge-a',
				visibilityBucket: 'both-visible',
				status: 'bad',
			}),
		]);
	});

	it('should suppress final healthy visual-only details when rows are ok or deferred only', () => {
		const service = new EdgeGeometryService() as unknown as {
			getDiagnosticDetailDumpPlan: (
				pendingHint: { refreshPending: boolean; expectedRecovery: string; geometryState: string } | null,
				detailRows: Array<{
					line: string;
					visibilityBucket: 'both-visible' | 'one-side-visible' | 'virtualized-involved';
					screenRisk: 'high' | 'medium' | 'low';
					status: 'ok' | 'bad' | 'deferred';
				}>
			) => {
				mode: 'full' | 'summary-only' | 'focused';
				rowsToLog: Array<{ line: string }>;
				suppressedCount: number;
				actionableCount: number;
				reason: string;
			};
		};

		const plan = service.getDiagnosticDetailDumpPlan(
			null,
			[
				{ line: 'edge-a', visibilityBucket: 'both-visible', screenRisk: 'high', status: 'ok' },
				{ line: 'edge-b', visibilityBucket: 'virtualized-involved', screenRisk: 'low', status: 'deferred' },
			],
		);

		expect(plan).toMatchObject({
			mode: 'summary-only',
			rowsToLog: [],
			suppressedCount: 2,
			actionableCount: 0,
			reason: 'healthy-non-bad-details-only',
		});
	});

	it('should assess gap observation confidence for low-confidence and trusted coverage cases', () => {
		const service = new EdgeGeometryService();

		expect(service.assessGapObservationConfidence(baseGapSummary({ bothVisibleEdges: 0, sampledEdges: 0 }))).toMatchObject({
			coverageRatio: 0,
			lowConfidence: true,
			trustedForFinal: false,
			trustedForSevereRisk: false,
			reason: 'no-both-visible-edges',
		});

		expect(service.assessGapObservationConfidence(baseGapSummary({ bothVisibleEdges: 3, sampledEdges: 0 }))).toMatchObject({
			coverageRatio: 0,
			lowConfidence: true,
			trustedForFinal: false,
			trustedForSevereRisk: false,
			reason: 'no-visible-gap-samples',
		});

		expect(service.assessGapObservationConfidence(baseGapSummary({ bothVisibleEdges: 4, sampledEdges: 1 }))).toMatchObject({
			coverageRatio: 0.25,
			lowConfidence: true,
			trustedForFinal: false,
			trustedForSevereRisk: false,
			reason: 'sparse-samples:1/4',
		});

		expect(service.assessGapObservationConfidence(baseGapSummary({ bothVisibleEdges: 4, sampledEdges: 2 }))).toMatchObject({
			coverageRatio: 0.5,
			lowConfidence: true,
			trustedForFinal: false,
			trustedForSevereRisk: false,
			reason: 'sample-limited:2/4',
		});

		expect(service.assessGapObservationConfidence(baseGapSummary({ bothVisibleEdges: 4, sampledEdges: 3 }))).toMatchObject({
			coverageRatio: 0.75,
			lowConfidence: false,
			trustedForFinal: true,
			trustedForSevereRisk: true,
			reason: 'trusted-visible-coverage:3/4',
		});
	});

	it('should include coverage note for partial observation diagnostic summaries', () => {
		updateLoggerConfig({ enableDebugLogging: true, enableVerboseCanvasDiagnostics: true });
		clearRecentLogs();
		const service = new EdgeGeometryService();

		service.emitDiagnosticPhaseSummary({
			phase: 'transient-post-reload',
			tag: 'post-reload',
			anomalyStats: {
				visible: 8,
				anomalous: 0,
				topOnly: 0,
				leftOnly: 0,
				topAndLeft: 0,
				insetTopLeft: 0,
				softInsetOnly: 0,
			},
			gapSummary: {
				allEdges: 12,
				bothVisibleEdges: 2,
				oneSideVisibleEdges: 3,
				bothVirtualizedEdges: 7,
				sampledEdges: 2,
				badEdges: 0,
				residualBadEdges: 0,
				avgGap: 3.5,
				maxGap: 3.5,
				avgResidualGap: 0,
				maxResidualGap: 0,
				badGapThresholdPx: 4,
				stubCompensationPx: 3.5,
				canvasScale: 0.5,
				topBadSample: 'none',
				topResidualBadSample: 'none',
				topBadDecompose: 'none',
				topDriftNodes: 'none',
				positionBuckets: 'abs=2,rel=0,other=0',
				sample: 'none',
			},
		});

		const latest = getRecentLogs().at(-1);
		expect(latest?.event).toBe('DiagnosticPhase');
		expect(latest?.data).toMatchObject({
			hasPartialObservation: true,
			coverageNote: 'partial-observation:visible-residual-only',
		});
	});

	it('should mark post-reload diagnostic summaries as refresh pending', () => {
		updateLoggerConfig({ enableDebugLogging: true, enableVerboseCanvasDiagnostics: true });
		clearRecentLogs();
		const service = new EdgeGeometryService();

		service.emitDiagnosticPhaseSummary({
			phase: 'transient-post-reload',
			tag: 'post-reload',
			anomalyStats: {
				visible: 4,
				anomalous: 0,
				topOnly: 0,
				leftOnly: 0,
				topAndLeft: 0,
				insetTopLeft: 0,
				softInsetOnly: 0,
			},
			gapSummary: {
				allEdges: 3,
				bothVisibleEdges: 1,
				oneSideVisibleEdges: 1,
				bothVirtualizedEdges: 1,
				sampledEdges: 1,
				badEdges: 1,
				residualBadEdges: 1,
				avgGap: 9,
				maxGap: 9,
				avgResidualGap: 9,
				maxResidualGap: 9,
				badGapThresholdPx: 8,
				stubCompensationPx: 3.5,
				canvasScale: 1,
				topBadSample: 'edge-1',
				topResidualBadSample: 'edge-1',
				topBadDecompose: 'none',
				topDriftNodes: 'none',
				positionBuckets: 'abs=1,rel=0,other=0',
				sample: 'edge-1',
			},
		});

		const latest = getRecentLogs().at(-1);
		expect(latest?.data).toMatchObject({
			refreshPending: true,
			expectedRecovery: 'edge-refresh-pass',
			geometryState: 'refresh-pending',
		});
	});

	it('should downgrade final raw bad gaps to low-confidence monitoring when coverage is untrusted', () => {
		const service = new EdgeGeometryService();

		const result = service.emitDiagnosticPhaseSummary({
			phase: 'final',
			tag: 'final-check',
			anomalyStats: baseAnomalyStats,
			gapSummary: baseGapSummary({
				bothVisibleEdges: 4,
				sampledEdges: 1,
				badEdges: 1,
				residualBadEdges: 1,
				avgGap: 9,
				maxGap: 9,
				avgResidualGap: 9,
				maxResidualGap: 9,
				topBadSample: 'edge-1',
				topResidualBadSample: 'edge-1',
				sample: 'edge-1',
			}),
		});

		const latest = getRecentLogs().at(-1);
		expect(result).toMatchObject({
			level: 'info',
			finalBad: false,
			classification: 'final:low-confidence-gap-monitoring',
		});
		expect(latest?.event).toBe('DiagnosticPhase');
		expect(latest?.classification).toBe('final:low-confidence-gap-monitoring');
		expect(latest?.data).toMatchObject({
			hasBadEdges: false,
			rawHasBadEdges: true,
			gapLowConfidence: true,
			gapTrustedForFinal: false,
			gapTrustedForSevereRisk: false,
			gapConfidenceReason: 'sparse-samples:1/4',
		});
	});

	it('should only treat severe visual gap risk as actionable when observation confidence is trusted', () => {
		const service = new EdgeGeometryService();

		expect(service.hasSevereVisualGapRisk(baseGapSummary({
			bothVisibleEdges: 4,
			sampledEdges: 1,
			residualBadEdges: 1,
			maxResidualGap: 30,
		}))).toBe(false);

		expect(service.hasSevereVisualGapRisk(baseGapSummary({
			bothVisibleEdges: 4,
			sampledEdges: 4,
			residualBadEdges: 1,
			maxResidualGap: 30,
		}))).toBe(true);
	});

	it('should classify visibility buckets into screen risk tiers', () => {
		const service = new EdgeGeometryService() as unknown as {
			classifyEdgeVisibilityBucket: (fromState: 'visible' | 'zero' | 'missing', toState: 'visible' | 'zero' | 'missing') => string;
			deriveEdgeScreenRisk: (bucket: string) => string;
		};

		const bothVisible = service.classifyEdgeVisibilityBucket('visible', 'visible');
		const oneSideVisible = service.classifyEdgeVisibilityBucket('visible', 'zero');
		const virtualized = service.classifyEdgeVisibilityBucket('zero', 'missing');

		expect(bothVisible).toBe('both-visible');
		expect(service.deriveEdgeScreenRisk(bothVisible)).toBe('high');
		expect(oneSideVisible).toBe('one-side-visible');
		expect(service.deriveEdgeScreenRisk(oneSideVisible)).toBe('medium');
		expect(virtualized).toBe('virtualized-involved');
		expect(service.deriveEdgeScreenRisk(virtualized)).toBe('low');
	});
});