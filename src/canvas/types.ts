/**
 * Canvas 类型定义
 */

import type { TFile } from 'obsidian';
import type { CollapseStateManager } from '../state/collapse-state';

// =========================================================================
// Canvas 内部扩展类型（用于访问未公开的 Obsidian API）
// =========================================================================

/** 节点边界框 */
export interface CanvasNodeBBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

/** 贝塞尔曲线点 */
export interface BezierPoint {
    x: number;
    y: number;
}

/** 边的贝塞尔曲线数据 */
export interface EdgeBezier {
    from: BezierPoint;
    to: BezierPoint;
    cp1?: BezierPoint;
    cp2?: BezierPoint;
}

/** 边端点方向 */
export type EdgeSide = 'top' | 'bottom' | 'left' | 'right';

// =========================================================================
// 类型守卫和辅助函数
// =========================================================================

/** 检查值是否为对象 */
export function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

/** 安全获取节点的 DOM 元素 */
export function getNodeElement(node: unknown): HTMLElement | undefined {
    if (!isObject(node)) return undefined;
    const el = node.nodeEl;
    return el instanceof HTMLElement ? el : undefined;
}

/** 安全获取节点的边界框 */
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

/** 安全获取边的贝塞尔曲线数据 */
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

/** 安全获取 Canvas 缩放比例 */
export function getCanvasZoom(canvas: unknown): number {
    if (!isObject(canvas)) return 1;
    const zoom = canvas.zoom;
    if (typeof zoom !== 'number' || !Number.isFinite(zoom)) return 1;
    return zoom;
}

/** 安全获取 Canvas 容器元素 */
export function getCanvasElement(canvas: unknown): HTMLElement | undefined {
    if (!isObject(canvas)) return undefined;
    const el = canvas.canvasEl;
    return el instanceof HTMLElement ? el : undefined;
}

/** 安全获取边的路径元素 */
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

/** 安全获取边的 lineGroupEl */
export function getEdgeLineGroupElement(edge: unknown): HTMLElement | undefined {
    if (!isObject(edge)) return undefined;
    const el = edge.lineGroupEl;
    return el instanceof HTMLElement ? el : undefined;
}

/** 安全调用对象方法 */
export function safeCall<T>(
    obj: unknown,
    method: string,
    ...args: unknown[]
): T | undefined {
    if (!isObject(obj)) return undefined;
    const fn = obj[method];
    if (typeof fn !== 'function') return undefined;
    try {
        return fn.apply(obj, args) as T;
    } catch {
        return undefined;
    }
}

/** 安全获取字符串属性 */
export function getStringProp(obj: unknown, key: string): string | undefined {
    if (!isObject(obj)) return undefined;
    const val = obj[key];
    return typeof val === 'string' ? val : undefined;
}

/** 安全获取数字属性 */
export function getNumberProp(obj: unknown, key: string): number | undefined {
    if (!isObject(obj)) return undefined;
    const val = obj[key];
    return typeof val === 'number' && Number.isFinite(val) ? val : undefined;
}

/** 安全获取布尔属性 */
export function getBooleanProp(obj: unknown, key: string): boolean | undefined {
    if (!isObject(obj)) return undefined;
    const val = obj[key];
    return typeof val === 'boolean' ? val : undefined;
}

export type CanvasAddNodeSource = 'command' | 'native-insert';

export type AddNodeToCanvasOptions = {
    source?: CanvasAddNodeSource;
    parentNodeIdHint?: string | null;
    suppressSuccessNotice?: boolean;
    skipFromLink?: boolean;
};


export interface ICanvasManager {
    checkAndAddCollapseButtons(): void;
    scheduleNodeHeightAdjustment(nodeId: string, delayMs?: number, reason?: string): void;
    notifyNodeMountedVisible?(nodeId: string, reason?: string): void;
    adjustNodeHeightAfterRender(nodeId: string): Promise<void>;
    measureAndPersistTrustedHeight(nodeId: string, options?: { suppressRequestSave?: boolean }): Promise<void>;
    toggleNodeCollapse(nodeId: string): Promise<void>;
    syncHiddenChildrenOnDrag(node: CanvasNodeLike): Promise<void>;
    calculateTextNodeHeight(content: string, nodeEl?: Element): number;
    readonly collapseStateManager: CollapseStateManager;
    handleSingleDelete(node: CanvasNodeLike, canvas: CanvasLike): Promise<void>;
    handleCascadeDelete(node: CanvasNodeLike, canvas: CanvasLike): Promise<void>;
    validateAndRepairNodeHeights(file: TFile): Promise<void>;
    refreshTrustedHeightsForVisibleTextNodes(limit?: number, options?: { suppressRequestSave?: boolean }): Promise<number>;
    refreshTrustedHeightsForViewportTextNodes(limit?: number, batchSize?: number, options?: { suppressRequestSave?: boolean }): Promise<number>;
    syncScrollableStateForMountedNodes(): number;
    refreshCanvasViewsForFile?(filePath: string, reason?: string): Promise<number>;
    // 删除操作标志控制（防止删边后被误判为新边）
    startDeletingOperation(): void;
    endDeletingOperation(canvas: CanvasLike | null): void;
}

export interface FromLink {
    path: string;
    line?: number;
    ch?: number;
}

export type HeightMeta = {
    lastSignature?: string;
    lastWidth?: number;
    lastAutoHeight?: number;
    manualHeight?: boolean;
    
    // === 渐进式可信测量字段 ===
    trustedHeight?: number;         // 可信测量高度（DOM完全可见时测得）
    trustedTimestamp?: number;      // 可信测量时间戳
    trustedSignature?: string;      // 可信测量时的内容指纹（内容+宽度）
    trustedEpoch?: number;          // 可信测量的版本号（用于批量淘汰旧缓存）
    trustedWidth?: number;          // 可信测量时的节点宽度
    trustedEnvHash?: string;        // 可信测量时的渲染环境指纹
    trustedSource?: 'dom-stable' | 'rendered' | 'estimate'; // 可信高度来源
    trustState?: 'valid' | 'suspect' | 'stale'; // 可信状态：可复用/可疑/失效
    suspectReason?: string;         // 可疑原因（用于日志与自愈）
    suspectCount?: number;          // 连续可疑计数
};

export type FloatingNodeMetadata = {
    isFloating?: boolean;
    originalParent?: string;
    floatingTimestamp?: number;
    isSubtreeNode?: boolean;
    heightMeta?: HeightMeta;
    fromLinkRepair?: {
        unmatched?: boolean;
        updatedAt?: number;
    };
};

export type CanvasNodeLike = {
    id?: string;
    text?: string;
    type?: 'text' | 'file' | 'group';
    file?: string;
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
    color?: string;
    unknownData?: Record<string, unknown>;
    // 内部属性
    bbox?: CanvasNodeBBox;
    render?: () => void;
    requestUpdate?: () => void;
};

export type EdgeEndpoint = {
    nodeId?: string;
    node?: { id?: string };
    side?: string;
    end?: unknown;
} | string;

export type CanvasEdgeLike = {
    id?: string;
    from?: EdgeEndpoint;
    to?: EdgeEndpoint;
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
    bezier?: EdgeBezier;
    // 内部属性
    pathEl?: SVGPathElement;
    interactiveEl?: SVGPathElement;
    path?: {
        update?: () => void;
        render?: () => void;
    };
    render?: () => void;
    requestUpdate?: () => void;
};

export type CanvasSelectionEntry = CanvasNodeLike | CanvasEdgeLike;

export type CanvasDataLike = {
    nodes?: CanvasNodeLike[];
    edges?: CanvasEdgeLike[];
    metadata?: {
        floatingNodes?: Record<string, unknown>;
    };
    canvasMindmapBuildHistory?: string[];
};

export type CanvasFileDataLike = {
    nodes?: CanvasNodeLike[];
    edges?: CanvasEdgeLike[];
};

export type FloatingNodeRecord = {
    isFloating: boolean;
    originalParent?: string;
    floatingTimestamp?: number;
    isSubtreeNode?: boolean;
};

export type FloatingNodesMetadata = Record<string, boolean | FloatingNodeRecord>;

export type CanvasDataWithMetadata = CanvasDataLike & {
    metadata?: {
        floatingNodes?: FloatingNodesMetadata;
    };
};

export type CanvasLike = {
    nodes?: Map<string, CanvasNodeLike> | Record<string, CanvasNodeLike>;
    edges?: Map<string, CanvasEdgeLike> | CanvasEdgeLike[];
    fileData?: CanvasFileDataLike;
    metadata?: CanvasDataLike['metadata'];
    file?: { path?: string };
    requestUpdate?: () => void;
    requestSave?: () => void;
    createTextNode?: (payload: Record<string, unknown>) => unknown;
    addNode?: (payload: Record<string, unknown>) => unknown;
    createNode?: (payload: Record<string, unknown>) => unknown;
    insertNode?: (payload: Record<string, unknown>) => unknown;
    selection?: Set<CanvasSelectionEntry>;
    selectedNodes?: CanvasNodeLike[];
    selectedEdge?: CanvasEdgeLike;
    selectedEdges?: CanvasEdgeLike[];
    // 内部属性
    zoom?: number;
    canvasEl?: HTMLElement;
    data?: CanvasDataLike;
    x?: number;
    y?: number;
    viewportEl?: HTMLElement;
    zoomToBbox?: (bbox: CanvasNodeBBox) => void;
};

export type CanvasViewLike = {
    canvas?: CanvasLike;
    file?: { path?: string };
    getViewType?: () => string;
};

export type MarkdownViewLike = {
    file?: { path?: string };
    editor?: {
        focus?: () => void;
        setSelection: (from: { line: number; ch: number }, to: { line: number; ch: number }) => void;
        scrollIntoView: (range: { from: { line: number; ch: number }; to: { line: number; ch: number } }, center?: boolean) => void;
        listSelections?: () => Array<{ anchor: { line: number; ch: number }; head: { line: number; ch: number } }>;
    };
};

export type EditorWithSelection = {
    editor?: {
        listSelections?: () => Array<{ anchor: { line: number; ch: number }; head: { line: number; ch: number } }>;
    };
};

export type PluginWithLastClicked = {
    lastClickedNodeId?: string | null;
    lastClickedCanvasFilePath?: string | null;
    lastNavigationSourceNodeId?: string | null;
};

export type CanvasManagerLike = {
    adjustAllTextNodeHeights: (options?: { skipMountedTextNodes?: boolean; suppressRequestSave?: boolean }) => Promise<number>;
    refreshTrustedHeightsForVisibleTextNodes?: (limit?: number, options?: { suppressRequestSave?: boolean }) => Promise<number>;
    refreshTrustedHeightsForViewportTextNodes?: (limit?: number, batchSize?: number, options?: { suppressRequestSave?: boolean }) => Promise<number>;
    syncScrollableStateForMountedNodes?: () => number;
    markProgrammaticCanvasReload?: (filePath: string, holdMs?: number) => void;
};

export type CanvasEventMap = {
    'canvas:edge-create': CanvasEdgeLike;
    'canvas:edge-delete': CanvasEdgeLike;
    'canvas:node-create': CanvasNodeLike;
    'canvas:node-delete': CanvasNodeLike;
    'canvas:node-move': CanvasNodeLike;
    'canvas:change': void;
};

export type CanvasEventType = keyof CanvasEventMap;

// =========================================================================
// 布局相关类型定义
// =========================================================================

export interface LayoutNode {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    children: string[];
    _subtreeHeight: number;
    originalParent?: string;
}

export interface LayoutEdge {
    fromNode: string;
    toNode: string;
}

export interface FloatingNodesInfo {
    floatingNodes: Set<string>;
    originalParents: Map<string, string>;
}

export interface SubtreeBounds {
    minY: number;
    maxY: number;
}

export interface LayoutContext {
    layoutNodes: Map<string, LayoutNode>;
    layoutParentMap: Map<string, string>;
    completeParentMap: Map<string, string>;
    completeChildrenMap: Map<string, string[]>;
    floatingSubtreeRoots: Set<string>;
    floatingSubtreeOriginalParents: Map<string, string>;
    rootNodes: string[];
    nodeColumn: Map<string, number>;
    columnWidths: Map<number, number>;
    nodeMaxDepth: Map<string, number>;
    maxOverallDepth: number;
}

export interface CanvasArrangerSettings {
    horizontalSpacing: number;
    verticalSpacing: number;
    textNodeWidth: number;
    textNodeMaxHeight: number;
    imageNodeWidth: number;
    imageNodeHeight: number;
    formulaNodeWidth: number;
    formulaNodeHeight: number;
}

export interface LayoutPosition {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface LayoutData {
    visibleNodes: Map<string, CanvasNodeLike>;
    allNodes: Map<string, CanvasNodeLike>;
    mergedAllNodes: Map<string, CanvasNodeLike>; // 新增：全量合并后的节点真值（用于隐藏子树修复）
    edges: CanvasEdgeLike[];
    originalEdges: CanvasEdgeLike[];
    canvasData: CanvasDataLike | null;
    floatingNodes: Set<string>;
    canvasFilePath: string;
    visibilityStats?: {
        visibleCount: number;
        domVisibleCount: number;
        domVisibleRate: number;
        inViewportCount: number;
        inViewportRate: number;
    };
}
