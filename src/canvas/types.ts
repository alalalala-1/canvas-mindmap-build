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

export type FloatingNodeMetadata = {
    isFloating?: boolean;
    originalParent?: string;
    floatingTimestamp?: number;
    isSubtreeNode?: boolean;
};

export type CanvasNodeLike = {
    id?: string;
    text?: string;
    height?: number;
    nodeEl?: HTMLElement;
    data?: FloatingNodeMetadata;
    x?: number;
    y?: number;
    width?: number;
    canvas?: CanvasLike;
    setData?: (data: Record<string, unknown>) => void;
    getData?: () => Record<string, unknown>;
    update?: () => void;
    moveAndResize?: (rect: { x: number; y: number; width: number; height: number }) => void;
    prevX?: number;
    prevY?: number;
};

export type CanvasEdgeLike = {
    id?: string;
    from?: unknown;
    to?: unknown;
    fromNode?: string;
    toNode?: string;
    fromSide?: string;
    toSide?: string;
    fromEnd?: unknown;
    toEnd?: unknown;
    color?: string;
    label?: string;
    lineGroupEl?: HTMLElement;
    lineEndGroupEl?: HTMLElement;
};

export type CanvasDataLike = {
    nodes?: CanvasNodeLike[];
    edges?: CanvasEdgeLike[];
    metadata?: {
        floatingNodes?: Record<string, unknown>;
    };
};

export type CanvasFileDataLike = {
    nodes?: CanvasNodeLike[];
    edges?: CanvasEdgeLike[];
};

export type CanvasLike = {
    nodes?: Map<string, CanvasNodeLike> | Record<string, CanvasNodeLike>;
    edges?: Map<string, CanvasEdgeLike> | CanvasEdgeLike[];
    fileData?: CanvasFileDataLike;
    metadata?: CanvasDataLike['metadata'];
    file?: { path?: string };
    requestUpdate?: () => void;
    requestSave?: () => void;
};

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
