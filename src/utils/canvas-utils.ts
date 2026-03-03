import { App, ItemView, TFile, View } from 'obsidian';
import { log } from './logger';
import { CONSTANTS } from '../constants';
import { CanvasLike, CanvasNodeLike, CanvasEdgeLike, EdgeEndpoint, FloatingNodeRecord } from '../canvas/types';

type CanvasDataNode = {
    id: string;
    data?: Record<string, unknown>;
    type?: string;
};

type CanvasDataEdge = {
    id?: string;
    fromNode?: string;
    toNode?: string;
    from?: EdgeEndpoint;
    to?: EdgeEndpoint;
};

type CanvasData = {
    nodes: CanvasDataNode[];
    edges: CanvasDataEdge[];
    metadata?: {
        floatingNodes?: Record<string, boolean | { isFloating?: boolean; originalParent?: string; timestamp?: number }>;
        collapseState?: Record<string, boolean>;
        [key: string]: unknown;
    };
};

type CanvasViewLike = ItemView & {
    canvas?: { file?: { path?: string } };
    file?: { path?: string };
};

function isCanvasView(view: View | null | undefined): view is CanvasViewLike {
    return !!view && view.getViewType() === 'canvas' && 'contentEl' in view;
}

/**
 * Canvas 工具函数集合
 * 集中处理 Canvas 相关的公共操作，避免代码重复
 */

// ============================================================================
// Canvas 视图获取
// ============================================================================

/**
 * 获取当前活动的 Canvas 视图
 * 尝试多种方式获取，确保兼容性
 */
export function getCanvasView(app: App): ItemView | null {
    // 方法1: 从 activeViewOfType 获取
    const view = app.workspace.getActiveViewOfType(ItemView);
    if (isCanvasView(view)) {
        return view;
    }

    // 方法2: 从所有 leaves 中查找 canvas
    const leaves = app.workspace.getLeavesOfType('canvas');
    for (const leaf of leaves) {
        if (isCanvasView(leaf.view)) {
            return leaf.view;
        }
    }

    return null;
}

export function getActiveCanvasView(app: App): ItemView | null {
    const activeView = app.workspace.getActiveViewOfType(ItemView);
    if (isCanvasView(activeView)) {
        return activeView;
    }
    return null;
}

/**
 * 获取当前打开的 Canvas 文件路径
 * 尝试多种方式获取，确保兼容性
 */
export function getCurrentCanvasFilePath(app: App): string | undefined {
    // 方法1: 从 getActiveViewOfType 获取
    const activeView = app.workspace.getActiveViewOfType(ItemView);
    if (isCanvasView(activeView)) {
        if (activeView.canvas?.file?.path) {
            return activeView.canvas.file.path;
        }
        if (activeView.file?.path) {
            return activeView.file.path;
        }
    }

    // 方法2: 从所有 leaves 中查找 canvas
    const canvasLeaves = app.workspace.getLeavesOfType('canvas');
    for (const leaf of canvasLeaves) {
        if (isCanvasView(leaf.view)) {
            if (leaf.view.canvas?.file?.path) {
                return leaf.view.canvas.file.path;
            }
            if (leaf.view.file?.path) {
                return leaf.view.file.path;
            }
        }
    }

    return undefined;
}

export function findZoomToFitButton(targetEl: HTMLElement): HTMLElement | null {
    const controlItem = targetEl.closest('.canvas-control-item');
    if (!(controlItem instanceof HTMLElement)) return null;

    const ariaLabel = controlItem.getAttribute('aria-label')?.toLowerCase() || '';
    if (ariaLabel.includes('zoom to fit')) return controlItem;

    const hasMaximizeIcon = !!controlItem.querySelector('svg.lucide-maximize');
    return hasMaximizeIcon ? controlItem : null;
}

export function tryZoomToSelection(app: App, canvasView: ItemView, canvas: CanvasLike): boolean {
    const canvasAny = canvas as CanvasLike & { zoomToSelection?: () => void };
    if (typeof canvasAny.zoomToSelection === 'function') {
        canvasAny.zoomToSelection();
        return true;
    }

    const viewAny = canvasView as ItemView & { zoomToSelection?: () => void };
    if (typeof viewAny.zoomToSelection === 'function') {
        viewAny.zoomToSelection();
        return true;
    }

    const appWithCommands = app as App & {
        commands?: { executeCommandById?: (id: string) => boolean | void };
    };
    if (appWithCommands.commands && typeof appWithCommands.commands.executeCommandById === 'function') {
        const result = appWithCommands.commands.executeCommandById('canvas:zoom-to-selection');
        if (result !== false) return true;
    }

    return false;
}

export function findDeleteButton(targetEl: HTMLElement): HTMLElement | null {
    let deleteBtn = targetEl.closest('[data-type="trash"]');
    if (deleteBtn instanceof HTMLElement) return deleteBtn;

    deleteBtn = targetEl.closest('.clickable-icon');
    if (!(deleteBtn instanceof HTMLElement)) return null;

    const isTrashButton = deleteBtn.getAttribute('data-type') === 'trash' ||
        deleteBtn.classList.contains('trash') ||
        deleteBtn.querySelector('svg')?.outerHTML.toLowerCase().includes('trash') ||
        deleteBtn.title?.toLowerCase().includes('delete') ||
        deleteBtn.title?.toLowerCase().includes('trash') ||
        deleteBtn.getAttribute('aria-label') === 'Remove';

    return isTrashButton ? deleteBtn : null;
}

export function findCanvasNodeElementFromTarget(targetEl: HTMLElement): HTMLElement | null {
    let nodeEl = targetEl.closest('.canvas-node');
    if (!nodeEl && targetEl.classList.contains('canvas-node-content-blocker')) {
        nodeEl = targetEl.parentElement?.closest('.canvas-node') || null;
    }
    return nodeEl instanceof HTMLElement ? nodeEl : null;
}

export function getCanvasNodeByElement(canvas: CanvasLike, nodeEl: HTMLElement): CanvasNodeLike | null {
    const nodes = getNodesFromCanvas(canvas);
    return nodes.find(node => node.nodeEl === nodeEl) || null;
}

export function parseFromLink(text?: string, color?: string): {
    file: string;
    from: { line: number; ch: number };
    to: { line: number; ch: number };
} | null {
    if (text) {
        const match = text.match(/<!-- fromLink:(.*?) -->/);
        if (match?.[1]) {
            try {
                return JSON.parse(match[1]) as {
                    file: string;
                    from: { line: number; ch: number };
                    to: { line: number; ch: number };
                };
            } catch {
                return null;
            }
        }
    }

    if (color?.startsWith('fromLink:')) {
        try {
            const fromLinkJson = color.substring('fromLink:'.length);
            return JSON.parse(fromLinkJson) as {
                file: string;
                from: { line: number; ch: number };
                to: { line: number; ch: number };
            };
        } catch {
            return null;
        }
    }

    return null;
}

/**
 * 剥离节点文本中“不参与可见内容计算”的标记：
 * - HTML 注释（如 fromLink metadata）
 * - HTML 标签（如 mark/span/br 等）
 */
export function stripInvisibleMarkup(text: string): string {
    if (!text) return '';
    return text
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<[^>]+>/g, '');
}

/**
 * 粗略估算文本内容单行像素宽度（用于短文本窄化）
 */
export function estimateContentWidth(text: string): number {
    const lines = stripInvisibleMarkup(text || '').split('\n').map(line => line.trim());
    let maxWidth = 0;

    for (const line of lines) {
        if (!line) continue;

        const plain = line
            .replace(/^#{1,6}\s+/, '')
            .replace(/\*\*|\*|__|_|`/g, '');

        let lineWidth = 0;
        for (const ch of plain) {
            if (/[\u4e00-\u9fa5]/.test(ch)) lineWidth += 14;
            else if (ch === ' ') lineWidth += 4;
            else lineWidth += 8;
        }

        if (lineWidth > maxWidth) maxWidth = lineWidth;
    }

    return maxWidth;
}

export type ArrangedTextWidthDecisionReason =
    | 'empty'
    | 'guard-lines'
    | 'guard-total-chars'
    | 'guard-two-lines'
    | 'shrink-50'
    | 'full-width';

export type ArrangedTextWidthDecision = {
    width: number;
    baseWidth: number;
    minWidth: number;
    shrinkThreshold: number;
    estimatedContentWidth: number;
    linesCount: number;
    totalChars: number;
    reason: ArrangedTextWidthDecisionReason;
    snippet: string;
};

/**
 * 解释 Arrange 文本宽度决策（用于调试日志）
 */
export function getArrangedTextWidthDecision(
    text: string | undefined,
    configuredWidth: number
): ArrangedTextWidthDecision {
    const baseWidth = Math.max(120, configuredWidth || CONSTANTS.LAYOUT.TEXT_NODE_WIDTH);
    const minWidth = Math.max(80, Math.round(baseWidth * 0.5));
    const raw = stripInvisibleMarkup(text || '').trim();
    const snippet = raw.replace(/\s+/g, ' ').slice(0, 60);

    if (!raw) {
        return {
            width: minWidth,
            baseWidth,
            minWidth,
            shrinkThreshold: 0,
            estimatedContentWidth: 0,
            linesCount: 0,
            totalChars: 0,
            reason: 'empty',
            snippet
        };
    }

    const lines = raw.split('\n').map(line => line.trim()).filter(Boolean);
    const plainLines = lines.map(line => line.replace(/^#{1,6}\s+/, '').replace(/\*\*|\*|__|_|`/g, ''));
    const totalChars = plainLines.reduce((sum, line) => sum + line.length, 0);

    if (lines.length >= 3) {
        return {
            width: baseWidth,
            baseWidth,
            minWidth,
            shrinkThreshold: 0,
            estimatedContentWidth: 0,
            linesCount: lines.length,
            totalChars,
            reason: 'guard-lines',
            snippet
        };
    }

    if (totalChars >= 48) {
        return {
            width: baseWidth,
            baseWidth,
            minWidth,
            shrinkThreshold: 0,
            estimatedContentWidth: 0,
            linesCount: lines.length,
            totalChars,
            reason: 'guard-total-chars',
            snippet
        };
    }

    if (lines.length === 2 && totalChars >= 24) {
        return {
            width: baseWidth,
            baseWidth,
            minWidth,
            shrinkThreshold: 0,
            estimatedContentWidth: 0,
            linesCount: lines.length,
            totalChars,
            reason: 'guard-two-lines',
            snippet
        };
    }

    const estimatedContentWidth = estimateContentWidth(raw);

    // minWidth 包含左右 padding（约 16px），再额外留出安全系数，
    // 仅“非常短”的文本才缩窄，避免粗体/中英混排被误判后换行。
    const contentAreaWidth = Math.max(0, minWidth - 16);
    const shrinkThreshold = Math.max(72, Math.round(contentAreaWidth * 0.6));
    const shouldShrink = estimatedContentWidth <= shrinkThreshold;

    return {
        width: shouldShrink ? minWidth : baseWidth,
        baseWidth,
        minWidth,
        shrinkThreshold,
        estimatedContentWidth,
        linesCount: lines.length,
        totalChars,
        reason: shouldShrink ? 'shrink-50' : 'full-width',
        snippet
    };
}

/**
 * Arrange 宽度策略：默认使用设置页宽度；内容过短时使用 50% 宽度
 */
export function resolveArrangedTextWidth(text: string | undefined, configuredWidth: number): number {
    return getArrangedTextWidthDecision(text, configuredWidth).width;
}

function isCanvasNodeLike(value: unknown): value is CanvasNodeLike {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as CanvasNodeLike;
    return typeof candidate.id === 'string' || !!candidate.nodeEl || typeof candidate.type === 'string';
}

export function getSelectedNodeFromCanvas(canvas: CanvasLike): CanvasNodeLike | null {
    if (!canvas?.nodes) return null;

    const selection = canvas.selection;
    if (selection instanceof Set && selection.size > 0) {
        for (const value of selection.values()) {
            if (isCanvasNodeLike(value) && (value.nodeEl || value.type)) {
                return value;
            }
            break;
        }
    }

    if (canvas.selectedNodes && canvas.selectedNodes.length > 0) {
        return canvas.selectedNodes[0] || null;
    }

    const allNodes = getNodesFromCanvas(canvas);

    for (const node of allNodes) {
        if (node.nodeEl) {
            const hasFocused = node.nodeEl.classList.contains('is-focused');
            const hasSelected = node.nodeEl.classList.contains('is-selected');
            if (hasFocused || hasSelected) {
                return node;
            }
        }
    }

    return null;
}

export function withTemporaryCanvasSelection(
    canvas: CanvasLike,
    nodes: CanvasNodeLike[],
    action: () => boolean
): boolean {
    const canvasWithSelection = canvas as CanvasLike & {
        selection?: Set<CanvasNodeLike>;
        selectedNodes?: CanvasNodeLike[];
    };

    const prevSelection = canvasWithSelection.selection ? new Set(canvasWithSelection.selection) : null;
    const prevSelectedNodes = canvasWithSelection.selectedNodes ? [...canvasWithSelection.selectedNodes] : null;

    canvasWithSelection.selection = new Set(nodes);
    canvasWithSelection.selectedNodes = nodes;

    const handled = action();

    window.setTimeout(() => {
        if (prevSelection) {
            canvasWithSelection.selection = prevSelection;
        } else if (canvasWithSelection.selection) {
            canvasWithSelection.selection.clear();
        }

        if (prevSelectedNodes) {
            canvasWithSelection.selectedNodes = prevSelectedNodes;
        } else if (canvasWithSelection.selectedNodes) {
            canvasWithSelection.selectedNodes = [];
        }
    }, 60);

    return handled;
}

// ============================================================================
// 边数据解析
// ============================================================================

/**
 * 从边的端点获取节点 ID
 * 支持多种数据格式
 */
export function getNodeIdFromEdgeEndpoint(endpoint: unknown): string | null {
    if (!endpoint) return null;
    if (typeof endpoint === 'string') return endpoint;
    if (typeof (endpoint as { nodeId?: unknown }).nodeId === 'string') return (endpoint as { nodeId: string }).nodeId;
    const nodeId = (endpoint as { node?: { id?: unknown } }).node?.id;
    if (typeof nodeId === 'string') return nodeId;
    return null;
}

/**
 * 获取边的源节点 ID
 * 兼容 fileData.edges (fromNode) 和 canvas.edges (from)
 */
export function getEdgeFromNodeId(edge: CanvasEdgeLike | null | undefined): string | null {
    if (!edge) return null;
    if (edge.fromNode) return edge.fromNode;
    return getNodeIdFromEdgeEndpoint(edge.from);
}

/**
 * 获取边的目标节点 ID
 * 兼容 fileData.edges (toNode) 和 canvas.edges (to)
 */
export function getEdgeToNodeId(edge: CanvasEdgeLike | null | undefined): string | null {
    if (!edge) return null;
    if (edge.toNode) return edge.toNode;
    return getNodeIdFromEdgeEndpoint(edge.to);
}

export function extractEdgeNodeIds(edge: CanvasEdgeLike): { fromId: string | null; toId: string | null } {
    return {
        fromId: getEdgeFromNodeId(edge),
        toId: getEdgeToNodeId(edge)
    };
}

export function getEdgeId(edge: CanvasEdgeLike | null | undefined): string | null {
    if (!edge) return null;
    const fromId = getEdgeFromNodeId(edge);
    const toId = getEdgeToNodeId(edge);
    if (fromId && toId) return `${fromId}->${toId}`;
    return edge.id || null;
}

export function buildEdgeIdSet(edges: CanvasEdgeLike[]): Set<string> {
    const ids = new Set<string>();
    for (const edge of edges) {
        const edgeId = getEdgeId(edge);
        if (edgeId) ids.add(edgeId);
    }
    return ids;
}

export function detectNewEdges(
    edges: CanvasEdgeLike[],
    previousEdgeIds: Set<string>
): { newEdges: CanvasEdgeLike[]; edgeIds: Set<string> } {
    const edgeIds = buildEdgeIdSet(edges);
    const newEdges = edges.filter(edge => {
        const edgeId = getEdgeId(edge);
        return edgeId ? !previousEdgeIds.has(edgeId) : false;
    });
    return { newEdges, edgeIds };
}

/**
 * 生成随机 ID (8位 36进制字符串)
 */
export function generateRandomId(): string {
    return Math.random().toString(36).substring(2, 10);
}

// ============================================================================
// Canvas 数据获取辅助函数
// ============================================================================

/**
 * 从 Canvas 对象获取节点
 * 兼容 Map 和普通对象两种存储方式
 */
export function getNodeFromCanvas(canvas: CanvasLike | null | undefined, nodeId: string): CanvasNodeLike | null {
    if (!canvas?.nodes) return null;
    
    if (canvas.nodes instanceof Map) {
        return canvas.nodes.get(nodeId) || null;
    }
    
    if (typeof canvas.nodes === 'object') {
        return (canvas.nodes as Record<string, CanvasNodeLike>)[nodeId] || null;
    }
    
    return null;
}

/**
 * 从 Canvas 对象获取所有节点数组
 * 兼容 Map 和数组两种存储方式
 */
export function getNodesFromCanvas(canvas: CanvasLike | null | undefined): CanvasNodeLike[] {
    if (!canvas?.nodes) return [];
    
    if (canvas.nodes instanceof Map) {
        return Array.from(canvas.nodes.values());
    }
    
    if (Array.isArray(canvas.nodes)) {
        return canvas.nodes;
    }
    
    if (typeof canvas.nodes === 'object') {
        return Object.values(canvas.nodes as Record<string, CanvasNodeLike>);
    }
    
    return [];
}

/**
 * 从 Canvas 对象获取所有边数组
 * 兼容 Map 和数组两种存储方式
 */
export function getEdgesFromCanvas(canvas: CanvasLike | null | undefined): CanvasEdgeLike[] {
    if (!canvas?.edges) return [];
    
    if (canvas.edges instanceof Map) {
        return Array.from(canvas.edges.values());
    }
    
    if (Array.isArray(canvas.edges)) {
        return canvas.edges;
    }
    
    if (typeof canvas.edges === 'object') {
        return Object.values(canvas.edges as Record<string, CanvasEdgeLike>);
    }
    
    return [];
}

export function getEdgesFromCanvasOrFileData(canvas: CanvasLike | null | undefined): CanvasEdgeLike[] {
    if (!canvas) return [];
    if (canvas.edges) return getEdgesFromCanvas(canvas);
    if (canvas.fileData?.edges) return canvas.fileData.edges;
    return [];
}

/**
 * 检查节点是否有子节点
 */
export function hasChildNodes(nodeId: string, edges: CanvasEdgeLike[]): boolean {
    return edges.some((edge) => {
        return getEdgeFromNodeId(edge) === nodeId;
    });
}

/**
 * 刷新 Canvas 视图
 * 尝试调用 reload、requestUpdate 或 requestSave 方法
 */
export function reloadCanvas(canvas: CanvasLike): void {
    const canvasWithReload = canvas as CanvasLike & { reload?: () => void };
    if (typeof canvasWithReload.reload === 'function') {
        canvasWithReload.reload();
    } else if (typeof canvas.requestUpdate === 'function') {
        canvas.requestUpdate();
    } else if (canvas.requestSave) {
        canvas.requestSave();
    }
}

/**
 * 从 Canvas 获取选中的边
 * 兼容 selectedEdge 和 selectedEdges 两种属性
 */
export function getSelectedEdge(canvas: CanvasLike): CanvasEdgeLike | null {
    if (canvas.selectedEdge) {
        return canvas.selectedEdge;
    }
    
    if (canvas.selectedEdges && canvas.selectedEdges.length > 0) {
        return canvas.selectedEdges[0] || null;
    }
    
    if (canvas.edges) {
        const edgesArray = canvas.edges instanceof Map
            ? Array.from(canvas.edges.values())
            : Array.isArray(canvas.edges)
                ? canvas.edges
                : [];
                
        for (const edge of edgesArray) {
            const isFocused = edge.lineGroupEl?.classList.contains('is-focused');
            const isSelected = edge.lineGroupEl?.classList.contains('is-selected');
            
            if (isFocused || isSelected) {
                return edge;
            }
        }
    }
    
    return null;
}

/**
 * 检查值是否为 Record 对象
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const heightCache = new Map<string, number>();
const HEIGHT_CACHE_MAX_SIZE = 100;

/**
 * 估算文本节点高度（带缓存）
 * 用于布局计算和节点高度调整
 * 
 * [修复v3] 精确估算标题和格式化文本的高度
 */
export function estimateTextNodeHeight(content: string, width: number, maxHeight: number = 800): number {
    const cacheKey = `${width}:${maxHeight}:${content}`;
    const cached = heightCache.get(cacheKey);
    if (cached !== undefined) {
        return cached;
    }

    // 基础参数
    const contentWidth = width - 16;  // 左右各8px padding
    const baseFontSize = 14;  // Obsidian Canvas默认字体大小
    const normalLineHeight = 20;  // 普通文本行高
    
    const chineseCharRegex = /[\u4e00-\u9fa5]/;
    let totalHeight = 0;
    const visibleContent = stripInvisibleMarkup(content);
    const textLines = visibleContent.split('\n');

    for (const line of textLines) {
        const trimmedLine = line.trim();
        if (trimmedLine === '') {
            totalHeight += normalLineHeight;  // 空行
            continue;
        }

        // 检测标题级别
        const headingMatch = trimmedLine.match(/^(#{1,6})\s+/);
        let currentFontSize = baseFontSize;
        let currentLineHeight = normalLineHeight;
        let marginTop = 0;
        let marginBottom = 0;
        
        if (headingMatch && headingMatch[1]) {
            const level = headingMatch[1].length;
            // 根据标题级别设置不同的字体大小和间距
            switch (level) {
                case 1: // H1
                    currentFontSize = baseFontSize * 1.8;  // ~25px
                    currentLineHeight = currentFontSize * 1.4;  // ~35px
                    marginTop = 20;
                    marginBottom = 12;
                    break;
                case 2: // H2
                    currentFontSize = baseFontSize * 1.6;  // ~22px
                    currentLineHeight = currentFontSize * 1.35;  // ~30px
                    marginTop = 16;
                    marginBottom = 10;
                    break;
                case 3: // H3
                    currentFontSize = baseFontSize * 1.4;  // ~20px
                    currentLineHeight = currentFontSize * 1.3;  // ~26px
                    marginTop = 12;
                    marginBottom = 8;
                    break;
                case 4: // H4
                    currentFontSize = baseFontSize * 1.25;  // ~18px
                    currentLineHeight = currentFontSize * 1.25;  // ~22px
                    marginTop = 10;
                    marginBottom = 6;
                    break;
                case 5: // H5
                case 6: // H6
                    currentFontSize = baseFontSize * 1.15;  // ~16px
                    currentLineHeight = currentFontSize * 1.2;  // ~19px
                    marginTop = 8;
                    marginBottom = 4;
                    break;
            }
        } else {
            // 非标题的格式化文本
            const hasBold = /\*\*|__/.test(trimmedLine);
            const hasCode = /`/.test(trimmedLine);
            if (hasBold || hasCode) {
                currentLineHeight = 24;  // 格式化文本稍高
            }
        }

        // 清理Markdown标记计算实际文本宽度
        const cleanLine = trimmedLine
            .replace(/^#{1,6}\s+/, '')
            .replace(/\*\*|\*|__|_|`/g, '');

        let pixelWidth = 0;
        for (const char of cleanLine) {
            if (chineseCharRegex.test(char)) {
                pixelWidth += currentFontSize;
            } else if (char === ' ') {
                pixelWidth += currentFontSize * 0.3;
            } else {
                pixelWidth += currentFontSize * 0.55;
            }
        }

        const linesNeeded = Math.max(1, Math.ceil(pixelWidth / contentWidth));
        totalHeight += marginTop + (linesNeeded * currentLineHeight) + marginBottom;
    }

    // 上下padding: 16px
    const actualPadding = 16;
    const calculatedHeight = Math.ceil(totalHeight + actualPadding);
    const result = Math.max(60, Math.min(calculatedHeight, maxHeight));
    
    if (heightCache.size >= HEIGHT_CACHE_MAX_SIZE) {
        const firstKey = heightCache.keys().next().value;
        if (firstKey) heightCache.delete(firstKey);
    }
    heightCache.set(cacheKey, result);
    
    return result;
}

/**
 * 清除高度缓存
 */
export function clearHeightCache(): void {
    heightCache.clear();
}

// ============================================================================
// Canvas 数据读取
// ============================================================================

/**
 * 安全地读取 Canvas 文件数据
 * 包含错误处理和验证
 */
export async function readCanvasData(app: App, filePath: string): Promise<CanvasData | null> {
    try {
        const canvasFile = app.vault.getAbstractFileByPath(filePath);
        if (!(canvasFile instanceof TFile)) {
            log(`[Utils] 文件不存在: ${filePath}`);
            return null;
        }

        const canvasContent = await app.vault.read(canvasFile);
        let canvasData: CanvasData;
        try {
            canvasData = JSON.parse(canvasContent) as CanvasData;
        } catch {
            log(`[Utils] 解析失败: ${filePath}`);
            return null;
        }

        // 确保基本结构存在
        if (!canvasData.nodes) canvasData.nodes = [];
        if (!canvasData.edges) canvasData.edges = [];
        if (!canvasData.metadata) canvasData.metadata = {};

        return canvasData;
    } catch (err) {
        log(`[Utils] 读取失败: ${filePath}`, err);
        return null;
    }
}

/**
 * 安全地写入 Canvas 文件数据
 */
export async function writeCanvasData(app: App, filePath: string, data: CanvasData): Promise<boolean> {
    try {
        const canvasFile = app.vault.getAbstractFileByPath(filePath);
        if (!(canvasFile instanceof TFile)) {
            log(`[Utils] 文件不存在: ${filePath}`);
            return false;
        }

        await app.vault.modify(canvasFile, JSON.stringify(data, null, 2));
        return true;
    } catch (err) {
        log(`[Utils] 写入失败: ${filePath}`, err);
        return false;
    }
}

// ============================================================================
// 节点操作
// ============================================================================

/**
 * 从 Canvas 数据中获取节点
 */
export function getNodeFromCanvasData(canvasData: CanvasData, nodeId: string): CanvasDataNode | undefined {
    if (!canvasData?.nodes) return undefined;
    return canvasData.nodes.find((n) => n.id === nodeId);
}

/**
 * 获取节点的子节点 ID 列表
 */
export function getChildNodeIds(canvasData: CanvasData, parentId: string): string[] {
    if (!canvasData?.edges) return [];
    
    const childIds: string[] = [];
    for (const edge of canvasData.edges) {
        const fromId = getEdgeFromNodeId(edge);
        if (fromId === parentId) {
            const toId = getEdgeToNodeId(edge);
            if (toId) childIds.push(toId);
        }
    }
    return childIds;
}

/**
 * 获取节点的父节点 ID
 */
export function getParentNodeId(canvasData: CanvasData, nodeId: string): string | null {
    if (!canvasData?.edges) return null;
    
    for (const edge of canvasData.edges) {
        const toId = getEdgeToNodeId(edge);
        if (toId === nodeId) {
            return getEdgeFromNodeId(edge);
        }
    }
    return null;
}

// ============================================================================
// 浮动节点操作
// ============================================================================

/**
 * 检查节点是否为浮动节点
 */
export function isFloatingNode(canvasData: CanvasData, nodeId: string): boolean {
    if (!canvasData) return false;
    
    // 优先检查 node.data.isFloating
    const node = getNodeFromCanvasData(canvasData, nodeId);
    if (node?.data?.isFloating) return true;
    
    // 向后兼容：检查 metadata.floatingNodes
    const floatingInfo = canvasData.metadata?.floatingNodes?.[nodeId];
    if (typeof floatingInfo === 'boolean') return floatingInfo;
    if (typeof floatingInfo === 'object' && floatingInfo !== null) {
        return floatingInfo.isFloating === true;
    }
    
    return false;
}

/**
 * 获取浮动节点的原父节点 ID
 */
export function getFloatingNodeOriginalParent(canvasData: CanvasData, nodeId: string): string | null {
    if (!canvasData) return null;
    
    // 优先检查 node.data.originalParent
    const node = getNodeFromCanvasData(canvasData, nodeId);
    const originalParent = node?.data?.originalParent;
    if (typeof originalParent === 'string' && originalParent) return originalParent;
    
    // 向后兼容：检查 metadata.floatingNodes
    const floatingInfo = canvasData.metadata?.floatingNodes?.[nodeId];
    if (typeof floatingInfo === 'object' && floatingInfo !== null) {
        return floatingInfo.originalParent || null;
    }
    
    return null;
}

/**
 * 设置节点为浮动状态
 */
export function setNodeFloatingState(
    canvasData: CanvasData, 
    nodeId: string, 
    isFloating: boolean, 
    originalParent?: string
): void {
    if (!canvasData) return;
    
    // 确保 metadata 结构存在
    if (!canvasData.metadata) canvasData.metadata = {};
    if (!canvasData.metadata.floatingNodes) canvasData.metadata.floatingNodes = {};
    
    // 确保 node.data 结构存在
    const node = getNodeFromCanvasData(canvasData, nodeId);
    if (node) {
        if (!node.data) node.data = {};
        
        if (isFloating) {
            node.data.isFloating = true;
            if (originalParent) node.data.originalParent = originalParent;
            
            // 同时写入 metadata（向后兼容）
            canvasData.metadata.floatingNodes[nodeId] = {
                isFloating: true,
                originalParent: originalParent,
                timestamp: Date.now()
            };
        } else {
            delete node.data.isFloating;
            delete node.data.originalParent;
            delete node.data.floatingTimestamp;
            
            // 清除 metadata
            delete canvasData.metadata.floatingNodes[nodeId];
        }
    }
}

// ============================================================================
// 折叠状态操作
// ============================================================================

/**
 * 检查节点是否已折叠
 */
export function isNodeCollapsed(canvasData: CanvasData, nodeId: string): boolean {
    if (!canvasData?.metadata?.collapseState) return false;
    return canvasData.metadata.collapseState[nodeId] === true;
}

/**
 * 设置节点的折叠状态
 */
export function setNodeCollapseState(canvasData: CanvasData, nodeId: string, collapsed: boolean): void {
    if (!canvasData) return;
    if (!canvasData.metadata) canvasData.metadata = {};
    if (!canvasData.metadata.collapseState) canvasData.metadata.collapseState = {};
    
    if (collapsed) {
        canvasData.metadata.collapseState[nodeId] = true;
    } else {
        delete canvasData.metadata.collapseState[nodeId];
    }
}

// ============================================================================
// 布局相关
// ============================================================================

/**
 * 识别根节点（没有父节点的节点）
 */
export function identifyRootNodes(canvasData: CanvasData): string[] {
    if (!canvasData?.nodes || !canvasData?.edges) return [];
    
    const childNodeIds = new Set<string>();
    for (const edge of canvasData.edges) {
        const toId = getEdgeToNodeId(edge);
        if (toId) childNodeIds.add(toId);
    }
    
    const rootNodes: string[] = [];
    for (const node of canvasData.nodes) {
        if (!childNodeIds.has(node.id)) {
            rootNodes.push(node.id);
        }
    }
    
    return rootNodes;
}

/**
 * 查找节点的父节点对象
 */
export function findParentNode(nodeId: string, edges: CanvasDataEdge[], allNodes: CanvasDataNode[]): CanvasDataNode | null {
    for (const edge of edges) {
        const fromId = getEdgeFromNodeId(edge);
        const toId = getEdgeToNodeId(edge);

        if (toId === nodeId) {
            const parentNode = allNodes.find((n) => n.id === fromId);
            if (parentNode) return parentNode;
        }
    }
    return null;
}

/**
 * 查找节点的所有子节点 ID
 */
export function findChildNodes(nodeId: string, edges: CanvasDataEdge[]): string[] {
    const childIds: string[] = [];
    
    for (const edge of edges) {
        const fromId = getEdgeFromNodeId(edge);
        const toId = getEdgeToNodeId(edge);

        if (fromId === nodeId && toId) {
            childIds.push(toId);
        }
    }
    
    return childIds;
}

/**
 * 递归收集所有后代节点
 */
export function collectAllDescendants(
    canvasData: CanvasData, 
    parentId: string, 
    result: Set<string> = new Set()
): Set<string> {
    const childIds = getChildNodeIds(canvasData, parentId);
    
    for (const childId of childIds) {
        if (!result.has(childId)) {
            result.add(childId);
            collectAllDescendants(canvasData, childId, result);
        }
    }
    
    // 同时检查浮动子节点
    if (canvasData?.metadata?.floatingNodes) {
        for (const [nodeId, info] of Object.entries(canvasData.metadata.floatingNodes)) {
            const { isFloating, originalParent } = parseFloatingNodeInfo(info as boolean | FloatingNodeRecord);
            
            if (isFloating && originalParent === parentId && !result.has(nodeId)) {
                result.add(nodeId);
                collectAllDescendants(canvasData, nodeId, result);
            }
        }
    }
    
    return result;
}

// ============================================================================
// 浮动节点辅助函数
// ============================================================================

export type ParsedFloatingInfo = {
    isFloating: boolean;
    originalParent: string;
};

/**
 * 解析浮动节点信息
 * @param info 浮动节点信息，可能是布尔值或对象
 * @returns 解析后的浮动节点信息
 */
export function parseFloatingNodeInfo(info: boolean | FloatingNodeRecord | undefined): ParsedFloatingInfo {
    if (typeof info === 'boolean') {
        return { isFloating: info, originalParent: '' };
    }
    if (typeof info === 'object' && info !== null) {
        return {
            isFloating: info.isFloating === true,
            originalParent: info.originalParent || ''
        };
    }
    return { isFloating: false, originalParent: '' };
}

// ============================================================================
// DOM 操作辅助
// ============================================================================

/**
 * 安全地获取 Canvas 节点的 DOM 元素
 */
export function getNodeDomElement(canvas: CanvasLike, nodeId: string): HTMLElement | null {
    if (!canvas?.nodes) return null;
    if (canvas.nodes instanceof Map) {
        const nodeData = canvas.nodes.get(nodeId);
        return nodeData?.nodeEl || null;
    }
    return null;
}

/**
 * 检查节点是否在视图中可见
 */
export function isNodeVisible(canvas: CanvasLike, nodeId: string): boolean {
    const nodeEl = getNodeDomElement(canvas, nodeId);
    if (!nodeEl) return false;
    return nodeEl.style.display !== 'none';
}

/**
 * 显示/隐藏节点
 */
export function setNodeVisibility(canvas: CanvasLike, nodeId: string, visible: boolean): void {
    const nodeEl = getNodeDomElement(canvas, nodeId);
    if (nodeEl) {
        nodeEl.style.display = visible ? '' : 'none';
    }
}

// ============================================================================
// 防抖和节流
// ============================================================================

/**
 * 创建防抖函数
 */
export function debounce<T extends (...args: unknown[]) => void>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timer: number | null = null;
    return (...args: Parameters<T>) => {
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(() => fn(...args), delay);
    };
}

/**
 * 创建节流函数
 */
export function throttle<T extends (...args: unknown[]) => void>(
    fn: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle = false;
    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            fn(...args);
            inThrottle = true;
            window.setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ============================================================================
// 类型检测 - 重导出自 content-type-utils.ts
// ============================================================================

export { isFormulaContent, isImageContent, isTextNode, isFileNode } from './content-type-utils';
