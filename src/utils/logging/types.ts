export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'critical';

export type DiagnosticPhase =
    | 'transient-pre'
    | 'transient-post-reload'
    | 'transient-post-edge-refresh'
    | 'transient-open-pulse'
    | 'final';

export interface DiagnosticClassification {
    phase: DiagnosticPhase;
    isFinal: boolean;
    expectedTransient: boolean;
    severityHint: LogLevel;
}

export type KnownLogSubsystem =
    | 'general'
    | 'lifecycle'
    | 'command'
    | 'manager'
    | 'settings'
    | 'canvas-file'
    | 'event'
    | 'pointer'
    | 'selection'
    | 'layout'
    | 'geometry'
    | 'height'
    | 'floating'
    | 'fromlink'
    | 'delete'
    | 'viewport'
    | 'ui'
    | 'error'
    | 'perf';

export type LogSubsystem = KnownLogSubsystem | (string & {});

export interface LogEntry {
    seq: number;
    time: number;
    deltaMs: number;
    level: LogLevel;
    subsystem: LogSubsystem;
    event: string;
    message: string;
    traceId?: string;
    data?: unknown;
    source?: string;
    phase?: DiagnosticPhase;
    classification?: string;
}

export interface LogTrace {
    traceId: string;
    name: string;
    startedAt: number;
    metadata?: Record<string, unknown>;
}

export interface LogReportSnapshot {
    label: string;
    data: Record<string, unknown>;
}

export interface LogReportOptions {
    title?: string;
    limit?: number;
    traceId?: string;
    snapshots?: LogReportSnapshot[];
}

export interface StructuredLogInput {
    level?: LogLevel;
    subsystem: LogSubsystem;
    event: string;
    message: string;
    traceId?: string;
    data?: unknown;
    source?: string;
    phase?: DiagnosticPhase;
    classification?: string;
}