/**
 * Canvas 类型定义
 */

import type { TFile } from 'obsidian';
import type { CollapseStateManager } from '../state/collapse-state';


export interface ICanvasManager {
    checkAndAddCollapseButtons(): Promise<void>;
    adjustNodeHeightAfterRender(nodeId: string): Promise<void>;
    measureAndPersistTrustedHeight(nodeId: string): Promise<void>;
    toggleNodeCollapse(nodeId: string): Promise<void>;
    syncHiddenChildrenOnDrag(node: CanvasNodeLike): Promise<void>;
    calculateTextNodeHeight(content: string, nodeEl?: Element): number;
    readonly collapseStateManager: CollapseStateManager;
    handleSingleDelete(node: CanvasNodeLike, canvas: CanvasLike): Promise<void>;
    handleCascadeDelete(node: CanvasNodeLike, canvas: CanvasLike): Promise<void>;
    validateAndRepairNodeHeights(file: TFile): Promise<void>;
    refreshTrustedHeightsForVisibleTextNodes(limit?: number): Promise<number>;
    refreshTrustedHeightsForViewportTextNodes(limit?: number, batchSize?: number): Promise<number>;
    syncScrollableStateForMountedNodes(): number;
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
    bezier?: { from: { x: number; y: number }; to: { x: number; y: number } };
};

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
    selection?: Set<CanvasNodeLike>;
    selectedNodes?: CanvasNodeLike[];
    selectedEdge?: CanvasEdgeLike;
    selectedEdges?: CanvasEdgeLike[];
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
    lastClickedNodeId?: string;
};

export type CanvasManagerLike = {
    adjustAllTextNodeHeights: (options?: { skipMountedTextNodes?: boolean }) => Promise<number>;
    refreshTrustedHeightsForVisibleTextNodes?: (limit?: number) => Promise<number>;
    refreshTrustedHeightsForViewportTextNodes?: (limit?: number, batchSize?: number) => Promise<number>;
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
