/**
 * 统一日志系统 - 精简版
 * 目的：单一层级，极简输出，直接反映程序执行细节与交互效果
 */

import { CanvasMindmapBuildSettings } from '../settings/types';

let isLoggingEnabled = false;

/**
 * 更新日志配置
 */
export function updateLoggerConfig(settings: Partial<CanvasMindmapBuildSettings>): void {
    if (settings.enableDebugLogging !== undefined) {
        isLoggingEnabled = settings.enableDebugLogging;
    }
}

/**
 * 核心日志函数 - 唯一出口
 * 格式：直接输出内容（代码中已有分类前缀如 [Layout]、[Event] 等）
 */
export function log(...messages: any[]): void {
    if (!isLoggingEnabled) return;

    const body = messages.map(msg => {
        if (msg === null) return 'null';
        if (msg === undefined) return 'undefined';
        if (typeof msg === 'object') {
            try {
                if (msg instanceof Error) {
                    return `${msg.name}: ${msg.message}\n${msg.stack}`;
                }
                return JSON.stringify(msg);
            } catch (e) {
                return '[Complex Object]';
            }
        }
        return String(msg);
    }).join(' ');

    console.log(body);
}

// 为了保持兼容性，暂时保留这些导出，但内部全部指向 log
export const info = log;
export const warn = log;
export const debug = log;
export const error = log;
export const trace = log;
