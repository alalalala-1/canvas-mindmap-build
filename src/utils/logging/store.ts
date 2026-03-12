import type { LogEntry } from './types';

const DEFAULT_MAX_ENTRIES = 1500;

export class LogStore {
    private entries: LogEntry[] = [];

    constructor(private readonly maxEntries: number = DEFAULT_MAX_ENTRIES) {}

    push(entry: LogEntry): void {
        this.entries.push(entry);
        if (this.entries.length <= this.maxEntries) return;

        this.entries.splice(0, this.entries.length - this.maxEntries);
    }

    clear(): void {
        this.entries = [];
    }

    getRecent(limit?: number): LogEntry[] {
        if (!limit || limit <= 0 || limit >= this.entries.length) {
            return [...this.entries];
        }

        return this.entries.slice(this.entries.length - limit);
    }

    getByTraceId(traceId: string): LogEntry[] {
        return this.entries.filter((entry) => entry.traceId === traceId);
    }
}