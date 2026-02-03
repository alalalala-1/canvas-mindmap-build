/**
 * 统一日志系统 - 已完全禁用
 * 所有函数为空操作，生产环境不输出任何日志
 */

import { CanvasMindmapBuildSettings } from '../settings/types';

// 日志级别枚举（保留以兼容现有代码）
export enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
    TRACE = 4
}

// 空配置对象
const loggerConfig = { enabled: false, level: LogLevel.ERROR };

/**
 * 更新日志配置（空实现）
 */
export function updateLoggerConfig(settings: Partial<CanvasMindmapBuildSettings>): void {
    // 日志系统已禁用，不执行任何操作
}

/**
 * 错误日志（空实现）
 */
export function error(...messages: any[]): void {
    // 禁用
}

/**
 * 警告日志（空实现）
 */
export function warn(...messages: any[]): void {
    // 禁用
}

/**
 * 信息日志（空实现）
 */
export function info(...messages: any[]): void {
    // 禁用
}

/**
 * 调试日志（空实现）
 */
export function debug(...messages: any[]): void {
    // 禁用
}

/**
 * 跟踪日志（空实现）
 */
export function trace(...messages: any[]): void {
    // 禁用
}

/**
 * 计时日志（空实现）
 */
export function logTime(label: string, level: LogLevel = LogLevel.DEBUG): () => void {
    // 禁用，返回空函数
    return () => {};
}

/**
 * 默认日志函数（空实现）
 */
export default function log(...messages: any[]): void {
    // 禁用
}

// 导出日志配置（只读）
export { loggerConfig };
