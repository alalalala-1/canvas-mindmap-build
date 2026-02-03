/**
 * 统一日志系统 - 极简版本
 */

import { CanvasMindmapBuildSettings } from '../settings/types';

export enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
    TRACE = 4
}

const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
    [LogLevel.ERROR]: 'ERR',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.DEBUG]: 'DBG',
    [LogLevel.TRACE]: 'TRC'
};

interface LoggerConfig {
    enabled: boolean;
    level: LogLevel;
}

const DEFAULT_CONFIG: LoggerConfig = {
    enabled: false,
    level: LogLevel.INFO
};

let loggerConfig: LoggerConfig = { ...DEFAULT_CONFIG };

export function updateLoggerConfig(settings: Partial<CanvasMindmapBuildSettings>): void {
    if (settings.enableDebugLogging !== undefined) {
        loggerConfig.enabled = settings.enableDebugLogging;
    }
    if (settings.logLevel !== undefined) {
        loggerConfig.level = parseLogLevel(settings.logLevel);
    }
}

function parseLogLevel(levelStr: string): LogLevel {
    switch (levelStr.toLowerCase()) {
        case 'error': return LogLevel.ERROR;
        case 'warn': return LogLevel.WARN;
        case 'info': return LogLevel.INFO;
        case 'debug': return LogLevel.DEBUG;
        case 'verbose':
        case 'trace': return LogLevel.TRACE;
        default: return LogLevel.INFO;
    }
}

function logLevel(level: LogLevel, ...messages: any[]): void {
    if (!loggerConfig.enabled || level > loggerConfig.level) {
        return;
    }

    const body = messages.map(msg => {
        if (msg === null) return 'null';
        if (msg === undefined) return 'undefined';
        if (typeof msg === 'object') {
            try {
                return JSON.stringify(msg);
            } catch (e) {
                return String(msg);
            }
        }
        return String(msg);
    }).join(' ');

    switch (level) {
        case LogLevel.ERROR:
            console.error(body);
            break;
        case LogLevel.WARN:
            console.warn(body);
            break;
        case LogLevel.INFO:
        case LogLevel.DEBUG:
        case LogLevel.TRACE:
            console.log(body);
            break;
    }
}

export function error(...messages: any[]): void {
    logLevel(LogLevel.ERROR, ...messages);
}

export function warn(...messages: any[]): void {
    logLevel(LogLevel.WARN, ...messages);
}

export function info(...messages: any[]): void {
    logLevel(LogLevel.INFO, ...messages);
}

export function debug(...messages: any[]): void {
    logLevel(LogLevel.DEBUG, ...messages);
}

export function trace(...messages: any[]): void {
    logLevel(LogLevel.TRACE, ...messages);
}

export function logTime(label: string, level: LogLevel = LogLevel.DEBUG): () => void {
    if (!loggerConfig.enabled || level > loggerConfig.level) {
        return () => {};
    }

    const startTime = performance.now();
    logLevel(level, `▶ ${label}`);

    return () => {
        const duration = performance.now() - startTime;
        logLevel(level, `◀ ${label} ${duration.toFixed(1)}ms`);
    };
}

export default function log(...messages: any[]): void {
    logLevel(LogLevel.INFO, ...messages);
}

export { log };
