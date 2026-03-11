/**
 * Obsidian Canvas 内部 API 类型定义
 * 
 * 这些类型定义覆盖了 Obsidian Canvas 未公开的内部属性。
 * 基于 Obsidian 源码分析和社区类型补充。
 */

// =========================================================================
// Canvas 内部节点类型
// =========================================================================

/**
 * 节点边界框（Canvas 内部坐标空间）
 */
export interface CanvasNodeBBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

/**
 * 贝塞尔曲线控制点
 */
export interface BezierPoint {
    x: number;
    y: number;
}

/**
 * 边的贝塞尔曲线数据
 */
export interface EdgeBezier {
    from: BezierPoint;
    to: BezierPoint;
    cp1?: BezierPoint;
    cp2?: BezierPoint;
}

/**
 * Canvas 内部节点扩展属性
 */
export interface CanvasNodeInternal {
    /** 节点 DOM 元素 */
    nodeEl?: HTMLElement;
    /** 节点边界框（Canvas 坐标空间） */
    bbox?: CanvasNodeBBox;
    /** 节点高度（像素） */
    height?: number;
    /** 节点 X 坐标 */
    x?: number;
    /** 节点 Y 坐标 */
    y?: number;
    /** 节点宽度 */
    width?: number;
    /** 节点数据 */
    data?: Record<string, unknown>;
    /** 节点 ID */
    id?: string;
    /** 节点类型 */
    type?: 'text' | 'file' | 'group';
    /** 文件路径 */
    file?: string;
    /** 文本内容 */
    text?: string;
    /** 颜色 */
    color?: string;
    /** 更新方法 */
    update?: () => void;
    /** 移动并调整大小 */
    moveAndResize?: (rect: { x: number; y: number; width: number; height: number }) => void;
    /** 设置数据 */
    setData?: (data: Record<string, unknown>) => void;
    /** 获取数据 */
    getData?: () => Record<string, unknown>;
}

// =========================================================================
// Canvas 内部边类型
// =========================================================================

/**
 * 边端点（内部表示）
 */
export interface EdgeEndpointInternal {
    nodeId?: string;
    node?: { id?: string };
    side?: 'top' | 'bottom' | 'left' | 'right';
    end?: unknown;
}

/**
 * Canvas 内部边扩展属性
 */
export interface CanvasEdgeInternal {
    /** 边 ID */
    id?: string;
    /** 起始端点 */
    from?: EdgeEndpointInternal | string;
    /** 目标端点 */
    to?: EdgeEndpointInternal | string;
    /** 起始节点 ID */
    fromNode?: string;
    /** 目标节点 ID */
    toNode?: string;
    /** 起始边方向 */
    fromSide?: 'top' | 'bottom' | 'left' | 'right';
    /** 目标边方向 */
    toSide?: 'top' | 'bottom' | 'left' | 'right';
    /** 起始端类型 */
    fromEnd?: unknown;
    /** 目标端类型 */
    toEnd?: unknown;
    /** 颜色 */
    color?: string;
    /** 标签 */
    label?: string;
    /** 边 SVG 组元素 */
    lineGroupEl?: HTMLElement;
    /** 边端点 SVG 组元素 */
    lineEndGroupEl?: HTMLElement;
    /** 贝塞尔曲线数据 */
    bezier?: EdgeBezier;
    /** 路径元素 */
    pathEl?: SVGPathElement;
    /** 交互元素 */
    interactiveEl?: SVGPathElement;
    /** 路径对象（Canvas 内部） */
    path?: {
        update?: () => void;
        render?: () => void;
    };
    /** 渲染方法 */
    render?: () => void;
    /** 请求更新方法 */
    requestUpdate?: () => void;
}

export type CanvasSelectionEntryInternal = CanvasNodeInternal | CanvasEdgeInternal;

// =========================================================================
// Canvas 内部视图类型
// =========================================================================

/**
 * Canvas 内部视图扩展属性
 */
export interface CanvasViewInternal {
    /** Canvas 对象 */
    canvas?: CanvasInternal;
    /** 文件 */
    file?: { path?: string };
    /** 获取视图类型 */
    getViewType?: () => string;
}

/**
 * Canvas 内部画布扩展属性
 */
export interface CanvasInternal {
    /** 缩放级别（对数空间，如 -1.5 表示 scale≈0.3536） */
    zoom?: number;
    /** Canvas 容器元素 */
    canvasEl?: HTMLElement;
    /** 文件数据（内存缓存） */
    data?: CanvasDataInternal;
    /** 文件数据（磁盘持久化格式） */
    fileData?: CanvasDataInternal;
    /** 元数据 */
    metadata?: Record<string, unknown>;
    /** 文件 */
    file?: { path?: string };
    /** 请求更新方法 */
    requestUpdate?: () => void;
    /** 请求保存方法 */
    requestSave?: () => void;
    /** 选中的节点 */
    selection?: Set<CanvasSelectionEntryInternal>;
    /** 选中的节点数组 */
    selectedNodes?: CanvasNodeInternal[];
    /** 选中的边 */
    selectedEdge?: CanvasEdgeInternal;
    /** 选中的边数组 */
    selectedEdges?: CanvasEdgeInternal[];
    /** 视口元素 */
    viewportEl?: HTMLElement;
    /** 平移 X */
    x?: number;
    /** 平移 Y */
    y?: number;
}

/**
 * Canvas 数据内部格式
 */
export interface CanvasDataInternal {
    nodes?: CanvasNodeInternal[];
    edges?: CanvasEdgeInternal[];
    metadata?: Record<string, unknown>;
}

// =========================================================================
// 类型守卫和工具函数
// =========================================================================

/**
 * 检查值是否为对象
 */
export function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

/**
 * 安全获取节点的 DOM 元素
 */
export function getNodeElement(node: unknown): HTMLElement | undefined {
    if (!isObject(node)) return undefined;
    const el = node.nodeEl;
    return el instanceof HTMLElement ? el : undefined;
}

/**
 * 安全获取节点的边界框
 */
export function getNodeBBox(node: unknown): CanvasNodeBBox | undefined {
    if (!isObject(node)) return undefined;
    const bbox = node.bbox;
    if (!isObject(bbox)) return undefined;
    const { minX, minY, maxX, maxY } = bbox;
    if (typeof minX !== 'number' || typeof minY !== 'number' || 
        typeof maxX !== 'number' || typeof maxY !== 'number') {
        return undefined;
    }
    return { minX, minY, maxX, maxY };
}

/**
 * 安全获取边的贝塞尔曲线数据
 */
export function getEdgeBezier(edge: unknown): EdgeBezier | undefined {
    if (!isObject(edge)) return undefined;
    const bezier = edge.bezier;
    if (!isObject(bezier)) return undefined;
    const from = bezier.from;
    const to = bezier.to;
    if (!isObject(from) || !isObject(to)) return undefined;
    if (typeof from.x !== 'number' || typeof from.y !== 'number') return undefined;
    if (typeof to.x !== 'number' || typeof to.y !== 'number') return undefined;
    
    const result: EdgeBezier = {
        from: { x: from.x, y: from.y },
        to: { x: to.x, y: to.y }
    };
    
    if (isObject(bezier.cp1) && typeof bezier.cp1.x === 'number' && typeof bezier.cp1.y === 'number') {
        result.cp1 = { x: bezier.cp1.x, y: bezier.cp1.y };
    }
    if (isObject(bezier.cp2) && typeof bezier.cp2.x === 'number' && typeof bezier.cp2.y === 'number') {
        result.cp2 = { x: bezier.cp2.x, y: bezier.cp2.y };
    }
    
    return result;
}

/**
 * 安全获取 Canvas 缩放比例
 */
export function getCanvasZoom(canvas: unknown): number {
    if (!isObject(canvas)) return 1;
    const zoom = canvas.zoom;
    if (typeof zoom !== 'number' || !Number.isFinite(zoom)) return 1;
    return zoom;
}

/**
 * 安全获取 Canvas 容器元素
 */
export function getCanvasElement(canvas: unknown): HTMLElement | undefined {
    if (!isObject(canvas)) return undefined;
    const el = canvas.canvasEl;
    return el instanceof HTMLElement ? el : undefined;
}

/**
 * 安全获取边的路径元素
 */
export function getEdgePathElement(edge: unknown): SVGPathElement | null {
    if (!isObject(edge)) return null;
    
    // 直接属性
    const pathEl = edge.pathEl;
    if (pathEl instanceof SVGPathElement) return pathEl;
    
    // 通过 lineGroupEl 查找
    const lineGroupEl = edge.lineGroupEl;
    if (lineGroupEl instanceof HTMLElement) {
        const path = lineGroupEl.querySelector('path');
        return path instanceof SVGPathElement ? path : null;
    }
    
    return null;
}

/**
 * 安全获取边的 lineGroupEl
 */
export function getEdgeLineGroupElement(edge: unknown): HTMLElement | undefined {
    if (!isObject(edge)) return undefined;
    const el = edge.lineGroupEl;
    return el instanceof HTMLElement ? el : undefined;
}

/**
 * 安全调用对象方法
 */
export function safeCall<T extends (...args: unknown[]) => unknown>(
    obj: unknown,
    method: string,
    ...args: Parameters<T>
): ReturnType<T> | undefined {
    if (!isObject(obj)) return undefined;
    const fn = obj[method];
    if (typeof fn !== 'function') return undefined;
    try {
        return fn.apply(obj, args) as ReturnType<T>;
    } catch {
        return undefined;
    }
}

/**
 * 安全获取字符串属性
 */
export function getStringProp(obj: unknown, key: string): string | undefined {
    if (!isObject(obj)) return undefined;
    const val = obj[key];
    return typeof val === 'string' ? val : undefined;
}

/**
 * 安全获取数字属性
 */
export function getNumberProp(obj: unknown, key: string): number | undefined {
    if (!isObject(obj)) return undefined;
    const val = obj[key];
    return typeof val === 'number' && Number.isFinite(val) ? val : undefined;
}

/**
 * 安全获取布尔属性
 */
export function getBooleanProp(obj: unknown, key: string): boolean | undefined {
    if (!isObject(obj)) return undefined;
    const val = obj[key];
    return typeof val === 'boolean' ? val : undefined;
}