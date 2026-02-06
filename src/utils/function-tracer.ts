/**
 * 函数调用跟踪工具
 * 用于跟踪函数调用顺序、参数和返回值
 */

import { info, debug, LogLevel } from './logger';

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
 * 格式化参数
 */
function formatArgs(args: any[]): string {
    if (args.length === 0) return '';
    return args.map(arg => {
        if (arg === null) return 'null';
        if (arg === undefined) return 'undefined';
        if (typeof arg === 'string') return `"${arg.substring(0, 50)}${arg.length > 50 ? '...' : ''}"`;
        if (typeof arg === 'number') return String(arg);
        if (typeof arg === 'boolean') return String(arg);
        if (typeof arg === 'object') {
            try {
                const str = JSON.stringify(arg);
                return str.length > 100 ? str.substring(0, 100) + '...' : str;
            } catch (e) {
                return '[Object]';
            }
        }
        return String(arg);
    }).join(', ');
}

/**
 * 格式化返回值
 */
function formatResult(result: any): string {
    if (result === null) return 'null';
    if (result === undefined) return 'undefined';
    if (typeof result === 'string') return `"${result.substring(0, 50)}${result.length > 50 ? '...' : ''}"`;
    if (typeof result === 'number') return String(result);
    if (typeof result === 'boolean') return String(result);
    if (typeof result === 'object') {
        try {
            const str = JSON.stringify(result);
            return str.length > 100 ? str.substring(0, 100) + '...' : str;
        } catch (e) {
            return '[Object]';
        }
    }
    return String(result);
}

/**
 * 跟踪函数调用
 * @param className 类名
 * @param functionName 函数名
 * @param args 参数列表
 */
export function traceEnter(className: string, functionName: string, ...args: any[]): void {
    const indent = getIndent();
    info(`${indent}▶ ${className}.${functionName}(${formatArgs(args)})`);
    callDepth++;
}

/**
 * 跟踪函数退出
 * @param className 类名
 * @param functionName 函数名
 * @param result 返回值
 */
export function traceExit(className: string, functionName: string, result?: any): void {
    callDepth = Math.max(0, callDepth - 1);
    const indent = getIndent();
    if (result !== undefined) {
        info(`${indent}◀ ${className}.${functionName} => ${formatResult(result)}`);
    } else {
        info(`${indent}◀ ${className}.${functionName}`);
    }
}

/**
 * 跟踪函数退出（带错误）
 * @param className 类名
 * @param functionName 函数名
 * @param error 错误对象
 */
export function traceError(className: string, functionName: string, error: any): void {
    callDepth = Math.max(0, callDepth - 1);
    const indent = getIndent();
    info(`${indent}✖ ${className}.${functionName} => ERROR: ${error}`);
}

/**
 * 跟踪中间步骤
 * @param className 类名
 * @param functionName 函数名
 * @param step 步骤描述
 * @param data 数据
 */
export function traceStep(className: string, functionName: string, step: string, data?: any): void {
    const indent = getIndent();
    if (data !== undefined) {
        info(`${indent}  ${className}.${functionName}: ${step} | ${formatResult(data)}`);
    } else {
        info(`${indent}  ${className}.${functionName}: ${step}`);
    }
}

/**
 * 装饰器：自动跟踪函数调用
 * 使用方法：@traceMethod('ClassName')
 */
export function traceMethod(className: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            traceEnter(className, propertyKey, ...args);
            try {
                const result = await originalMethod.apply(this, args);
                traceExit(className, propertyKey, result);
                return result;
            } catch (error) {
                traceError(className, propertyKey, error);
                throw error;
            }
        };

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
