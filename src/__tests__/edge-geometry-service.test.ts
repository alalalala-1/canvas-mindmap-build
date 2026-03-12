import { beforeEach, describe, expect, it } from 'vitest';
import { EdgeGeometryService } from '../canvas/services/edge-geometry-service';
import { clearRecentLogs, getRecentLogs, updateLoggerConfig } from '../utils/logger';

describe('EdgeGeometryService diagnostics semantics', () => {
	beforeEach(() => {
		updateLoggerConfig({ enableDebugLogging: true, enableVerboseCanvasDiagnostics: false });
		clearRecentLogs();
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