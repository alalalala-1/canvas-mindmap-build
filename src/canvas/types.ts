/**
 * Canvas 类型定义
 */

export interface FromLink {
    path: string;
    line?: number;
    ch?: number;
}

export interface CanvasNode {
    id: string;
    nodeEl?: HTMLElement;
    x: number;
    y: number;
    width: number;
    height: number;
    text?: string;
    type?: 'text' | 'file';
    file?: string;
    fromLink?: FromLink;
    isCollapsed?: boolean;
}

export interface CanvasEdge {
    id: string;
    fromNode: string;
    toNode: string;
}

export interface Canvas {
    nodes: Map<string, CanvasNode>;
    edges: Map<string, CanvasEdge>;
    selection: Set<CanvasNode>;
    selectedNodes?: CanvasNode[];
    file?: { path: string };
    fileData?: {
        nodes: CanvasNode[];
        edges: CanvasEdge[];
    };
    reload(): void;
    requestSave(): void;
    requestUpdate(): void;
    on(event: string, callback: (...args: unknown[]) => void): void;
    off?(event: string, callback: (...args: unknown[]) => void): void;
}

export interface CanvasView {
    canvas?: Canvas;
    file?: { path: string };
}

/**
 * 结果类型，用于错误处理
 */
export type Result<T, E = Error> =
    | { success: true; data: T }
    | { success: false; error: E };

/**
 * 创建成功结果
 */
export function ok<T>(data: T): Result<T, never> {
    return { success: true, data };
}

/**
 * 创建失败结果
 */
export function err<E = Error>(error: E): Result<never, E> {
    return { success: false, error };
}
