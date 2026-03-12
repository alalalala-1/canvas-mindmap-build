/**
 * 统一日志系统 - 精简版
 * 目的：单一层级，极简输出，直接反映程序执行细节与交互效果
 */

import { CanvasMindmapBuildSettings } from '../settings/types';
import { buildLogReport } from './logging/report';
import { LogStore } from './logging/store';
import type {
    DiagnosticClassification,
    DiagnosticPhase,
    LogEntry,
    LogLevel,
    LogReportOptions,
    LogSubsystem,
    LogTrace,
    StructuredLogInput
} from './logging/types';

let isLoggingEnabled = false;
let isVerboseCanvasDiagnosticsEnabled = false;
let logSequence = 0;
let logStartTime = Date.now();
const logStore = new LogStore();

const LEGACY_SUBSYSTEM_MAP: Record<string, LogSubsystem> = {
    Lifecycle: 'lifecycle',
    Command: 'command',
    Settings: 'settings',
    Manager: 'manager',
    CanvasManager: 'manager',
    Event: 'event',
    Layout: 'layout',
    LayoutData: 'layout',
    LayoutDataProvider: 'layout',
    Node: 'height',
    NodeHeight: 'height',
    File: 'canvas-file',
    Normalize: 'canvas-file',
    Visibility: 'layout',
    EdgeDelete: 'delete',
    FromLinkRepair: 'fromlink',
    State: 'general',
    UI: 'ui',
    ViewportFix: 'viewport',
    FloatingNode: 'floating',
    Style: 'ui',
};

function shouldStore(level: LogLevel): boolean {
    if (level === 'critical' || level === 'error') return true;
    if (level === 'trace') return isVerboseCanvasDiagnosticsLoggingEnabled();
    return isLoggingEnabled;
}

function shouldPrint(level: LogLevel): boolean {
    if (level === 'critical') return true;
    if (level === 'trace') return isVerboseCanvasDiagnosticsLoggingEnabled();
    return isLoggingEnabled;
}

function getConsoleMethod(level: LogLevel): 'debug' | 'info' | 'warn' | 'error' {
    switch (level) {
        case 'critical':
        case 'error':
            return 'error';
        case 'warn':
            return 'warn';
        case 'info':
            return 'info';
        case 'debug':
        case 'trace':
        default:
            return 'debug';
    }
}

function toLogEntry(input: StructuredLogInput): LogEntry {
    const seq = ++logSequence;
    const deltaMs = Date.now() - logStartTime;
    return {
        seq,
        time: Date.now(),
        deltaMs,
        level: input.level ?? 'info',
        subsystem: input.subsystem,
        event: input.event,
        message: input.message,
        traceId: input.traceId,
        data: input.data,
        source: input.source,
        phase: input.phase,
        classification: input.classification,
    };
}

function formatStructuredEntry(entry: LogEntry): string {
    const parts = [
        `[${entry.seq}|${entry.deltaMs}ms|${entry.level}|${entry.subsystem}/${entry.event}]`,
        entry.message,
    ];

    if (entry.traceId) {
        parts.push(`trace=${entry.traceId}`);
    }

    if (entry.phase) {
        parts.push(`phase=${entry.phase}`);
    }

    if (entry.classification) {
        parts.push(`class=${entry.classification}`);
    }

    if (entry.data !== undefined) {
        parts.push(formatMessages([entry.data]));
    }

    return parts.join(' ');
}

function emitEntry(entry: LogEntry): void {
    if (shouldStore(entry.level)) {
        logStore.push(entry);
    }

    if (!shouldPrint(entry.level)) return;
    console[getConsoleMethod(entry.level)](formatStructuredEntry(entry));
}

function parseLegacyPrefix(message: string): { subsystem: LogSubsystem; event: string; source?: string } {
    const match = message.match(/^\[([^\]]+)\]\s*/);
    const source = match?.[1];
    const subsystem = source ? (LEGACY_SUBSYSTEM_MAP[source] || 'general') : 'general';
    return {
        subsystem,
        event: source ? `${source}.legacy` : 'legacy',
        source,
    };
}

/**
 * 更新日志配置
 */
export function updateLoggerConfig(settings: Partial<CanvasMindmapBuildSettings>): void {
    if (settings.enableDebugLogging !== undefined) {
        isLoggingEnabled = settings.enableDebugLogging;
    }
    if (settings.enableVerboseCanvasDiagnostics !== undefined) {
        isVerboseCanvasDiagnosticsEnabled = settings.enableVerboseCanvasDiagnostics;
    }
    if (settings.enableDebugLogging) {
        logSequence = 0;
        logStartTime = Date.now();
        logStore.clear();
    }
}

export function isVerboseCanvasDiagnosticsLoggingEnabled(): boolean {
    return isLoggingEnabled && isVerboseCanvasDiagnosticsEnabled;
}

export function classifyDiagnosticPhase(phase: DiagnosticPhase): DiagnosticClassification {
    const isFinal = phase === 'final';
    return {
        phase,
        isFinal,
        expectedTransient: !isFinal,
        severityHint: isFinal ? 'warn' : 'debug',
    };
}

export function resolveDiagnosticLogLevel(input: {
    phase: DiagnosticPhase;
    hasBadEdges: boolean;
    hasAnomaly: boolean;
    residualGap: number;
    severeGapThreshold?: number;
}): LogLevel {
    const hasIssue = input.hasBadEdges || input.hasAnomaly;
    const severeThreshold = input.severeGapThreshold ?? 20;

    if (input.phase !== 'final') {
        return hasIssue ? 'debug' : 'trace';
    }

    if (!hasIssue) return 'info';
    if (input.residualGap >= severeThreshold || (input.hasBadEdges && input.hasAnomaly)) {
        return 'error';
    }
    return 'warn';
}

/**
 * 格式化日志消息数组为字符串
 */
function formatMessages(messages: unknown[]): string {
    return messages.map(msg => {
        if (msg === null) return 'null';
        if (msg === undefined) return 'undefined';
        if (typeof msg === 'object') {
            try {
                if (msg instanceof Error) {
                    return `${msg.name}: ${msg.message}\n${msg.stack}`;
                }
                return JSON.stringify(msg);
            } catch {
                return '[Complex Object]';
            }
        }
        if (typeof msg === 'string') return msg;
        if (typeof msg === 'number') return String(msg);
        if (typeof msg === 'boolean') return String(msg);
        if (typeof msg === 'bigint') return msg.toString();
        if (typeof msg === 'symbol') return msg.toString();
        if (typeof msg === 'function') return '[Function]';
        return '[Unknown]';
    }).join(' ');
}

/**
 * 核心日志函数 - 唯一出口
 * 格式：直接输出内容（代码中已有分类前缀如 [Layout]、[Event] 等）
 */
export function log(...messages: unknown[]): void {
    const message = formatMessages(messages);
    const legacyMeta = parseLegacyPrefix(message);
    const entry = toLogEntry({
        level: 'debug',
        subsystem: legacyMeta.subsystem,
        event: legacyMeta.event,
        message,
        source: legacyMeta.source,
        data: messages.length > 1 ? messages.slice(1) : undefined,
    });

    if (shouldStore(entry.level)) {
        logStore.push(entry);
    }

    if (!isLoggingEnabled) return;
    console.debug(`[${entry.seq}|${entry.deltaMs}ms] ${message}`);
}

/**
 * 超详细诊断日志 - 仅在普通 debug + verbose canvas diagnostics 双开启时输出
 */
export function logVerbose(...messages: unknown[]): void {
    const message = formatMessages(messages);
    const legacyMeta = parseLegacyPrefix(message);
    const entry = toLogEntry({
        level: 'trace',
        subsystem: legacyMeta.subsystem,
        event: legacyMeta.event,
        message,
        source: legacyMeta.source,
        data: messages.length > 1 ? messages.slice(1) : undefined,
    });

    if (shouldStore(entry.level)) {
        logStore.push(entry);
    }

    if (!isVerboseCanvasDiagnosticsLoggingEnabled()) return;
    console.debug(`[${entry.seq}|${entry.deltaMs}ms] ${message}`);
}

/**
 * 关键日志函数 - 始终输出（用于浮动节点等关键诊断）
 * 不受 enableDebugLogging 设置影响
 */
export function logCritical(...messages: unknown[]): void {
    const message = formatMessages(messages);
    const legacyMeta = parseLegacyPrefix(message);
    const entry = toLogEntry({
        level: 'critical',
        subsystem: legacyMeta.subsystem,
        event: legacyMeta.event,
        message,
        source: legacyMeta.source,
        data: messages.length > 1 ? messages.slice(1) : undefined,
    });
    logStore.push(entry);
    console.warn(`[${entry.seq}|${entry.deltaMs}ms] ${message}`);
}

export function logEvent(input: StructuredLogInput): LogEntry {
    const entry = toLogEntry(input);
    emitEntry(entry);
    return entry;
}

export function createLogTrace(name: string, metadata?: Record<string, unknown>): LogTrace {
    const traceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const trace: LogTrace = {
        traceId,
        name,
        startedAt: Date.now(),
        metadata,
    };

    logEvent({
        level: 'info',
        subsystem: 'command',
        event: 'TraceStart',
        message: name,
        traceId,
        data: metadata,
    });

    return trace;
}

export function finishLogTrace(trace: LogTrace, result?: Record<string, unknown>): void {
    const durationMs = Date.now() - trace.startedAt;
    logEvent({
        level: 'info',
        subsystem: 'command',
        event: 'TraceEnd',
        message: trace.name,
        traceId: trace.traceId,
        data: {
            durationMs,
            ...(result || {}),
        },
    });
}

export function clearRecentLogs(): void {
    logStore.clear();
}

export function getRecentLogs(limit?: number): LogEntry[] {
    return logStore.getRecent(limit);
}

export function getLogsByTraceId(traceId: string): LogEntry[] {
    return logStore.getByTraceId(traceId);
}

export function buildDebugReport(options?: LogReportOptions): string {
    const entries = options?.traceId ? getLogsByTraceId(options.traceId) : getRecentLogs(options?.limit);
    return buildLogReport(entries, options);
}
