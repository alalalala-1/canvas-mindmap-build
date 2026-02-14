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
export function log(...messages: unknown[]): void {
    if (!isLoggingEnabled) return;

    const now = new Date();
    const timestamp = now.toISOString().split('T')[1]?.slice(0, 12) ?? '00:00:00.000'; // HH:MM:SS.mmm
    const body = messages.map(msg => {
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

    console.debug(`[${timestamp}] ${body}`);
}

/**
 * 关键日志函数 - 始终输出（用于浮动节点等关键诊断）
 * 不受 enableDebugLogging 设置影响
 */
export function logCritical(...messages: unknown[]): void {

    const body = messages.map(msg => {
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

    console.warn(body);
}
