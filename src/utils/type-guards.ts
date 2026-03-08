/**
 * 类型守卫工具库
 * 用于安全地收窄 unknown 和 any 类型，避免 unsafe-* ESLint 错误
 */

import type { CanvasEdgeLike, CanvasNodeLike, CanvasLike } from '../canvas/types';

/**
 * 检查值是否为字符串
 */
export function isString(value: unknown): value is string {
    return typeof value === 'string';
}

/**
 * 检查值是否为数字
 */
export function isNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

/**
 * 检查值是否为布尔值
 */
export function isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
}

/**
 * 检查值是否为对象（非 null，非数组）
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 检查值是否为数组
 */
export function isArray<T = unknown>(value: unknown): value is T[] {
    return Array.isArray(value);
}

/**
 * 检查对象是否有指定属性
 */
export function hasProperty<T extends Record<string, unknown>, K extends string>(
    obj: T,
    key: K
): obj is T & { [P in K]: unknown } {
    return key in obj;
}

/**
 * 安全获取对象属性（返回 unknown）
 */
export function getProp<T extends Record<string, unknown>>(
    obj: T,
    key: string
): unknown {
    return obj[key];
}

/**
 * 安全获取字符串属性
 */
export function getStringProp(obj: Record<string, unknown>, key: string): string | undefined {
    const value = obj[key];
    return isString(value) ? value : undefined;
}

/**
 * 安全获取数字属性
 */
export function getNumberProp(obj: Record<string, unknown>, key: string): number | undefined {
    const value = obj[key];
    return isNumber(value) ? value : undefined;
}

/**
 * 安全获取布尔属性
 */
export function getBooleanProp(obj: Record<string, unknown>, key: string): boolean | undefined {
    const value = obj[key];
    return isBoolean(value) ? value : undefined;
}

/**
 * 检查值是否为 Canvas 节点
 */
export function isCanvasNodeLike(value: unknown): value is CanvasNodeLike {
    if (!isRecord(value)) return false;
    return isString(value.id) || isString(value.text) || isString(value.type);
}

/**
 * 检查值是否为 Canvas 边
 */
export function isCanvasEdgeLike(value: unknown): value is CanvasEdgeLike {
    if (!isRecord(value)) return false;
    return isString(value.id);
}

/**
 * 检查值是否为 Canvas
 */
export function isCanvasLike(value: unknown): value is CanvasLike {
    if (!isRecord(value)) return false;
    // Canvas 有 nodes Map 或 edges 数组
    if (value.nodes instanceof Map) return true;
    if (isArray(value.nodes)) return true;
    if (isArray(value.edges)) return true;
    return false;
}

/**
 * 检查值是否为 HTMLElement
 */
export function isHTMLElement(value: unknown): value is HTMLElement {
    return value instanceof HTMLElement;
}

/**
 * 检查值是否为 Element
 */
export function isElement(value: unknown): value is Element {
    return value instanceof Element;
}

/**
 * 检查值是否为 SVGElement
 */
export function isSVGElement(value: unknown): value is SVGElement {
    return value instanceof SVGElement;
}

/**
 * 检查值是否为 SVGPathElement
 */
export function isSVGPathElement(value: unknown): value is SVGPathElement {
    return value instanceof SVGPathElement;
}

/**
 * 检查元素是否有 style 属性
 */
export function hasStyle(value: unknown): value is { style: CSSStyleDeclaration } {
    return isRecord(value) && isRecord(value.style);
}

/**
 * 安全获取元素样式
 */
export function getElementStyle(element: unknown): CSSStyleDeclaration | null {
    if (isHTMLElement(element)) {
        return element.style;
    }
    if (isElement(element) && 'style' in element) {
        return (element as HTMLElement).style;
    }
    return null;
}

/**
 * 检查 Error 对象
 */
export function isError(value: unknown): value is Error {
    return value instanceof Error;
}

/**
 * 检查值是否为 DOMRect
 */
export function isDOMRect(value: unknown): value is DOMRect {
    return value instanceof DOMRect;
}

/**
 * 检查值是否为 Map
 */
export function isMap<T = unknown>(value: unknown): value is Map<string, T> {
    return value instanceof Map;
}

/**
 * 检查值是否为 Set
 */
export function isSet<T = unknown>(value: unknown): value is Set<T> {
    return value instanceof Set;
}

/**
 * 安全获取对象的字符串 ID
 */
export function getStringId(value: unknown): string | undefined {
    if (isString(value)) return value;
    if (isNumber(value)) return String(value);
    return undefined;
}

/**
 * 安全获取对象属性并转换为字符串
 */
export function getPropertyAsString(obj: Record<string, unknown>, key: string): string {
    const value = obj[key];
    if (isString(value)) return value;
    if (isNumber(value)) return String(value);
    if (isBoolean(value)) return String(value);
    return '';
}

/**
 * 安全获取对象的数字属性
 */
export function getPropertyAsNumber(obj: Record<string, unknown>, key: string): number {
    const value = obj[key];
    if (isNumber(value)) return value;
    if (isString(value)) {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

/**
 * 安全执行函数并捕获错误
 */
export function safeCall<T>(fn: () => T, fallback: T): T {
    try {
        return fn();
    } catch {
        return fallback;
    }
}

/**
 * 安全执行异步函数并捕获错误
 */
export async function safeCallAsync<T>(
    fn: () => Promise<T>,
    fallback: T
): Promise<T> {
    try {
        return await fn();
    } catch {
        return fallback;
    }
}

/**
 * 安全获取嵌套属性
 */
export function getNestedValue<T = unknown>(
    obj: unknown,
    path: string,
    separator = '.'
): T | undefined {
    const keys = path.split(separator);
    let current: unknown = obj;

    for (const key of keys) {
        if (!isRecord(current)) return undefined;
        current = current[key];
    }

    return current as T | undefined;
}
