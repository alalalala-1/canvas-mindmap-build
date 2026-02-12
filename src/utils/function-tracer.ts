/**
 * 函数调用跟踪工具
 * 用于跟踪函数调用顺序、参数和返回值
 */

import { log } from './logger';

// 调用栈深度跟踪
let callDepth = 0;
const MAX_DEPTH = 20;

/**
 * 生成缩进字符串
 */
function getIndent(): string {
    return '  '.repeat(Math.min(callDepth, MAX_DEPTH));
}

/**
 * 格式化返回值
 */
function formatResult(result: unknown): string {
    if (result === null) return 'null';
    if (result === undefined) return 'undefined';
    if (typeof result === 'string') return `"${result.substring(0, 50)}${result.length > 50 ? '...' : ''}"`;
    if (typeof result === 'number') return String(result);
    if (typeof result === 'boolean') return String(result);
    if (typeof result === 'bigint') return result.toString();
    if (typeof result === 'symbol') return result.toString();
    if (typeof result === 'function') return '[Function]';
    if (typeof result === 'object') {
        try {
            const str = JSON.stringify(result);
            return str.length > 100 ? str.substring(0, 100) + '...' : str;
        } catch {
            return '[Object]';
        }
    }
    return '[Unknown]';
}

/**
 * 跟踪函数调用
 * @param className 类名
 * @param functionName 函数名
 * @param args 参数列表
 */
export function traceEnter(className: string, functionName: string, ...args: unknown[]): void {
    // 彻底禁用追踪日志，防止大量刷屏
    return;
}

/**
 * 跟踪函数退出
 * @param className 类名
 * @param functionName 函数名
 * @param result 返回值
 */
export function traceExit(className: string, functionName: string, result?: unknown): void {
    // 彻底禁用追踪日志
    return;
}

/**
 * 跟踪函数退出（带错误）
 * @param className 类名
 * @param functionName 函数名
 * @param error 错误对象
 */
export function traceError(className: string, functionName: string, error: unknown): void {
    callDepth = Math.max(0, callDepth - 1);
    const indent = getIndent();
    log(`${indent}✖ ${className}.${functionName} => ERROR: ${formatResult(error)}`);
}

/**
 * 跟踪中间步骤
 * @param className 类名
 * @param functionName 函数名
 * @param step 步骤描述
 * @param data 数据
 */
export function traceStep(className: string, functionName: string, step: string, data?: unknown): void {
    const indent = getIndent();
    if (data !== undefined) {
        log(`${indent}  ${className}.${functionName}: ${step} | ${formatResult(data)}`);
    } else {
        log(`${indent}  ${className}.${functionName}: ${step}`);
    }
}

/**
 * 装饰器：自动跟踪函数调用
 * 使用方法：@traceMethod('ClassName')
 */
export function traceMethod<T extends (...args: unknown[]) => unknown>(className: string) {
    return function (_target: object, propertyKey: string, descriptor: TypedPropertyDescriptor<T>) {
        const originalMethod = descriptor.value;
        if (!originalMethod) return descriptor;

        descriptor.value = (async function (this: unknown, ...args: Parameters<T>): Promise<ReturnType<T>> {
            traceEnter(className, propertyKey, ...args);
            try {
                const result = await originalMethod.apply(this, args) as ReturnType<T>;
                traceExit(className, propertyKey, result);
                return result;
            } catch (error) {
                traceError(className, propertyKey, error);
                throw error;
            }
        }) as T;

        return descriptor;
    };
}

/**
 * 重置调用深度（用于调试）
 */
export function resetCallDepth(): void {
    callDepth = 0;
}

/**
 * 获取当前调用深度
 */
export function getCallDepth(): number {
    return callDepth;
}
