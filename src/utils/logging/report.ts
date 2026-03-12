import type { LogEntry, LogReportOptions, LogReportSnapshot } from './types';

function formatValue(value: unknown): string {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return '[unserializable]';
    }
}

function formatSnapshot(snapshot: LogReportSnapshot): string {
    return [`## Snapshot: ${snapshot.label}`, '```json', formatValue(snapshot.data), '```'].join('\n');
}

function formatEntry(entry: LogEntry): string {
    const meta: string[] = [
        `${entry.seq}`,
        `+${entry.deltaMs}ms`,
        entry.level,
        `${entry.subsystem}/${entry.event}`,
    ];
    if (entry.traceId) meta.push(`trace=${entry.traceId}`);
    if (entry.phase) meta.push(`phase=${entry.phase}`);
    if (entry.classification) meta.push(`class=${entry.classification}`);
    const head = `- [${meta.join('|')}] ${entry.message}`;
    if (entry.data === undefined) return head;
    return `${head}\n  data=${formatValue(entry.data).replace(/\n/g, '\n  ')}`;
}

export function buildLogReport(entries: LogEntry[], options?: LogReportOptions): string {
    const filtered = options?.traceId
        ? entries.filter((entry) => entry.traceId === options.traceId)
        : entries;
    const limited = options?.limit && options.limit > 0
        ? filtered.slice(Math.max(0, filtered.length - options.limit))
        : filtered;

    const sections: string[] = [];
    sections.push(`# ${options?.title || 'Canvas Mindmap Debug Report'}`);
    sections.push('');
    sections.push(`entries=${limited.length}` + (options?.traceId ? `, traceId=${options.traceId}` : ''));

    if (options?.snapshots && options.snapshots.length > 0) {
        sections.push('');
        sections.push(...options.snapshots.map(formatSnapshot));
    }

    sections.push('');
    sections.push('## Recent Logs');
    if (limited.length <= 0) {
        sections.push('- (empty)');
    } else {
        sections.push(...limited.map(formatEntry));
    }

    return sections.join('\n');
}