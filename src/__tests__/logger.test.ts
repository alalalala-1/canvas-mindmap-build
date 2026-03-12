import { beforeEach, describe, expect, it } from 'vitest';
import {
    buildDebugReport,
    classifyDiagnosticPhase,
    clearRecentLogs,
    createLogTrace,
    finishLogTrace,
    getLogsByTraceId,
    getRecentLogs,
    logCritical,
    logEvent,
    resolveDiagnosticLogLevel,
    updateLoggerConfig,
} from '../utils/logger';
import { makeSnapshot } from '../utils/logging/snapshots';

describe('logger', () => {
    beforeEach(() => {
        updateLoggerConfig({ enableDebugLogging: true, enableVerboseCanvasDiagnostics: false });
        clearRecentLogs();
    });

    it('should store structured log entries with trace ids', () => {
        const trace = createLogTrace('test.trace', { source: 'unit-test' });
        logEvent({
            level: 'info',
            subsystem: 'command',
            event: 'UnitStep',
            message: 'step executed',
            traceId: trace.traceId,
            data: { ok: true },
        });
        finishLogTrace(trace, { status: 'done' });

        const traceLogs = getLogsByTraceId(trace.traceId);
        expect(traceLogs.length).toBeGreaterThanOrEqual(3);
        expect(traceLogs.some((entry) => entry.event === 'UnitStep')).toBe(true);
        expect(traceLogs.every((entry) => entry.traceId === trace.traceId)).toBe(true);
    });

    it('should build a readable debug report with snapshots', () => {
        logEvent({
            level: 'info',
            subsystem: 'manager',
            event: 'Refresh',
            message: 'refresh invoked',
            data: { filePath: 'demo.canvas' },
        });

        const report = buildDebugReport({
            title: 'Unit Debug Report',
            snapshots: [makeSnapshot('sample', { a: 1, ok: true })],
        });

        expect(report).toContain('Unit Debug Report');
        expect(report).toContain('Snapshot: sample');
        expect(report).toContain('refresh invoked');
    });

    it('should retain critical logs even when debug logging is disabled', () => {
        updateLoggerConfig({ enableDebugLogging: false, enableVerboseCanvasDiagnostics: false });
        clearRecentLogs();

        logCritical('[Critical] always-on');

        const logs = getRecentLogs();
        expect(logs).toHaveLength(1);
        expect(logs[0]?.level).toBe('critical');
        expect(logs[0]?.message).toContain('always-on');
    });

    it('should classify transient and final diagnostic phases correctly', () => {
        const transient = classifyDiagnosticPhase('transient-post-reload');
        const finalPhase = classifyDiagnosticPhase('final');

        expect(transient.expectedTransient).toBe(true);
        expect(transient.isFinal).toBe(false);
        expect(finalPhase.expectedTransient).toBe(false);
        expect(finalPhase.isFinal).toBe(true);
    });

    it('should downgrade transient diagnostic issues and warn on final issues', () => {
        expect(resolveDiagnosticLogLevel({
            phase: 'transient-post-reload',
            hasBadEdges: true,
            hasAnomaly: false,
            residualGap: 12,
        })).toBe('debug');

        expect(resolveDiagnosticLogLevel({
            phase: 'final',
            hasBadEdges: true,
            hasAnomaly: false,
            residualGap: 12,
        })).toBe('warn');

        expect(resolveDiagnosticLogLevel({
            phase: 'final',
            hasBadEdges: true,
            hasAnomaly: true,
            residualGap: 30,
        })).toBe('error');

        expect(resolveDiagnosticLogLevel({
            phase: 'final',
            hasBadEdges: false,
            hasAnomaly: false,
            residualGap: 0.001,
        })).toBe('info');
    });

    it('should include diagnostic phase metadata in debug report entries', () => {
        logEvent({
            level: 'debug',
            subsystem: 'layout',
            event: 'DiagnosticPhase',
            message: 'post-reload',
            phase: 'transient-post-reload',
            classification: 'transient-post-reload:expected-transient',
            data: { residualBadEdges: 2 },
        });

        const report = buildDebugReport({ title: 'Phase Report' });
        expect(report).toContain('phase=transient-post-reload');
        expect(report).toContain('class=transient-post-reload:expected-transient');
    });
});