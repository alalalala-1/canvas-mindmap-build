import { App, ItemView, TFile, View } from 'obsidian';
import { log } from './logger';
import { CONSTANTS } from '../constants';
import { Canvas, CanvasEdge, CanvasNode, CanvasLike, CanvasNodeLike, CanvasEdgeLike, EdgeEndpoint } from '../canvas/types';

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

/**
 * 估算文本节点高度
 * 用于布局计算和节点高度调整
 */
export function estimateTextNodeHeight(content: string, width: number, maxHeight: number = 800): number {
    const contentWidth = width - 40;
    const fontSize = CONSTANTS.TYPOGRAPHY.FONT_SIZE;
    const lineHeight = CONSTANTS.TYPOGRAPHY.LINE_HEIGHT;
    
    const chineseCharRegex = /[\u4e00-\u9fa5]/;
    let totalLines = 0;
    const textLines = content.split('\n');

    for (const line of textLines) {
        const trimmedLine = line.trim();
        if (trimmedLine === '') {
            totalLines += 0.5;
            continue;
        }

        const cleanLine = trimmedLine
            .replace(/^#{1,6}\s+/, '')
            .replace(/\*\*|\*|__|_|`/g, '');

        let pixelWidth = 0;
        for (const char of cleanLine) {
            if (chineseCharRegex.test(char)) {
                pixelWidth += fontSize * 1.15;
            } else {
                pixelWidth += fontSize * 0.6;
            }
        }

        const linesNeeded = Math.ceil(pixelWidth / contentWidth);
        totalLines += Math.max(1, linesNeeded);
    }

    const calculatedHeight = Math.ceil(totalLines * lineHeight + CONSTANTS.TYPOGRAPHY.SAFETY_PADDING);
    return Math.max(CONSTANTS.TYPOGRAPHY.MIN_NODE_HEIGHT, Math.min(calculatedHeight, maxHeight));
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
            let isFloating = false;
            let originalParent = '';
            
            if (typeof info === 'boolean') {
                isFloating = info;
            } else if (typeof info === 'object' && info !== null) {
                isFloating = info.isFloating === true;
                originalParent = info.originalParent || '';
            }
            
            if (isFloating && originalParent === parentId && !result.has(nodeId)) {
                result.add(nodeId);
                collectAllDescendants(canvasData, nodeId, result);
            }
        }
    }
    
    return result;
}

// ============================================================================
// DOM 操作辅助
// ============================================================================

/**
 * 安全地获取 Canvas 节点的 DOM 元素
 */
export function getNodeDomElement(canvas: Canvas, nodeId: string): HTMLElement | null {
    if (!canvas?.nodes) return null;
    const nodeData = canvas.nodes.get(nodeId);
    return nodeData?.nodeEl || null;
}

/**
 * 检查节点是否在视图中可见
 */
export function isNodeVisible(canvas: Canvas, nodeId: string): boolean {
    const nodeEl = getNodeDomElement(canvas, nodeId);
    if (!nodeEl) return false;
    return nodeEl.style.display !== 'none';
}

/**
 * 显示/隐藏节点
 */
export function setNodeVisibility(canvas: Canvas, nodeId: string, visible: boolean): void {
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
// 类型检测
// ============================================================================

/**
 * 检测内容是否为公式
 */
export function isFormulaContent(content: string): boolean {
    if (!content) return false;
    const trimmed = content.trim();
    return /^\$\$[\s\S]*?\$\$\s*(<!-- fromLink:[\s\S]*?-->)?\s*$/.test(trimmed);
}

/**
 * 检测内容是否为图片
 */
export function isImageContent(content: string): boolean {
    if (!content) return false;
    const imageRegex = /!?\[\[.*?\]\]|!?\[.*?\]\(.*?\)/;
    return imageRegex.test(content);
}

/**
 * 检测节点是否为文本节点
 */
export function isTextNode(node: CanvasNode | CanvasDataNode | null | undefined): boolean {
    if (!node) return true;
    return !node.type || node.type === 'text';
}

/**
 * 检测节点是否为文件节点
 */
export function isFileNode(node: CanvasNode | CanvasDataNode | null | undefined): boolean {
    return node?.type === 'file';
}
