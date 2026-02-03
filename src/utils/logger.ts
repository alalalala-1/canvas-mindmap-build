/**
 * 统一日志系统 - 已禁用
 */

import { CanvasMindmapBuildSettings } from '../settings/types';

export enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
    TRACE = 4
}

interface LoggerConfig {
    enabled: boolean;
    level: LogLevel;
}

const DEFAULT_CONFIG: LoggerConfig = {
    enabled: false,
    level: LogLevel.ERROR
};

let loggerConfig: LoggerConfig = { ...DEFAULT_CONFIG };

export function updateLoggerConfig(settings: Partial<CanvasMindmapBuildSettings>): void {
    // 日志系统已禁用，不响应配置更新
    loggerConfig.enabled = false;
}

function logLevel(level: LogLevel, ...messages: any[]): void {
    // 日志系统已禁用，不输出任何日志
    return;
}

export function error(...messages: any[]): void {
    // 禁用
}

export function warn(...messages: any[]): void {
    // 禁用
}

export function info(...messages: any[]): void {
    // 禁用
}

export function debug(...messages: any[]): void {
    // 禁用
}

export function trace(...messages: any[]): void {
    // 禁用
}

export function logTime(label: string, level: LogLevel = LogLevel.DEBUG): () => void {
    // 禁用，返回空函数
    return () => {};
}

export default function log(...messages: any[]): void {
    // 禁用
}

export { log };
