import { App, ItemView, TFile } from 'obsidian';
import { log } from './logger';

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
    // 方法1: 从 activeLeaf 获取
    const activeLeaf = app.workspace.activeLeaf;
    if (activeLeaf?.view && (activeLeaf.view as any).canvas) {
        return activeLeaf.view as ItemView;
    }

    // 方法2: 从所有 leaves 中查找 canvas
    const leaves = app.workspace.getLeavesOfType('canvas');
    for (const leaf of leaves) {
        if (leaf.view && (leaf.view as any).canvas) {
            return leaf.view as ItemView;
        }
    }

    // 方法3: 从 activeViewOfType 获取
    const view = app.workspace.getActiveViewOfType(ItemView);
    if (view && view.getViewType() === 'canvas') {
        return view;
    }

    return null;
}

/**
 * 获取当前打开的 Canvas 文件路径
 * 尝试多种方式获取，确保兼容性
 */
export function getCurrentCanvasFilePath(app: App): string | undefined {
    // 方法1: 从 activeLeaf 获取
    const activeLeaf = app.workspace.activeLeaf;
    if (activeLeaf?.view?.getViewType() === 'canvas') {
        const canvas = (activeLeaf.view as any).canvas;
        if (canvas?.file?.path) {
            return canvas.file.path;
        }
        if ((activeLeaf.view as any).file?.path) {
            return (activeLeaf.view as any).file.path;
        }
    }

    // 方法2: 从 getActiveViewOfType 获取
    const activeView = app.workspace.getActiveViewOfType(ItemView);
    if (activeView?.getViewType() === 'canvas') {
        const canvas = (activeView as any).canvas;
        if (canvas?.file?.path) {
            return canvas.file.path;
        }
        if ((activeView as any).file?.path) {
            return (activeView as any).file.path;
        }
    }

    // 方法3: 从所有 leaves 中查找 canvas
    const canvasLeaves = app.workspace.getLeavesOfType('canvas');
    for (const leaf of canvasLeaves) {
        if (leaf.view?.getViewType() === 'canvas') {
            const canvas = (leaf.view as any).canvas;
            if (canvas?.file?.path) {
                return canvas.file.path;
            }
            if ((leaf.view as any).file?.path) {
                return (leaf.view as any).file.path;
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
export function getNodeIdFromEdgeEndpoint(endpoint: any): string | null {
    if (!endpoint) return null;
    if (typeof endpoint === 'string') return endpoint;
    if (typeof endpoint.nodeId === 'string') return endpoint.nodeId;
    if (endpoint.node?.id) return endpoint.node.id;
    return null;
}

/**
 * 获取边的源节点 ID
 * 兼容 fileData.edges (fromNode) 和 canvas.edges (from)
 */
export function getEdgeFromNodeId(edge: any): string | null {
    if (!edge) return null;
    if (edge.fromNode) return edge.fromNode;
    return getNodeIdFromEdgeEndpoint(edge.from);
}

/**
 * 获取边的目标节点 ID
 * 兼容 fileData.edges (toNode) 和 canvas.edges (to)
 */
export function getEdgeToNodeId(edge: any): string | null {
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
// Canvas 数据读取
// ============================================================================

/**
 * 安全地读取 Canvas 文件数据
 * 包含错误处理和验证
 */
export async function readCanvasData(app: App, filePath: string): Promise<any | null> {
    try {
        const canvasFile = app.vault.getAbstractFileByPath(filePath);
        if (!(canvasFile instanceof TFile)) {
            log(`[Utils] 文件不存在: ${filePath}`);
            return null;
        }

        const canvasContent = await app.vault.read(canvasFile);
        let canvasData: any;
        try {
            canvasData = JSON.parse(canvasContent);
        } catch (parseError) {
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
export async function writeCanvasData(app: App, filePath: string, data: any): Promise<boolean> {
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
export function getNodeFromCanvasData(canvasData: any, nodeId: string): any | undefined {
    if (!canvasData?.nodes) return undefined;
    return canvasData.nodes.find((n: any) => n.id === nodeId);
}

/**
 * 获取节点的子节点 ID 列表
 */
export function getChildNodeIds(canvasData: any, parentId: string): string[] {
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
export function getParentNodeId(canvasData: any, nodeId: string): string | null {
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
export function isFloatingNode(canvasData: any, nodeId: string): boolean {
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
export function getFloatingNodeOriginalParent(canvasData: any, nodeId: string): string | null {
    if (!canvasData) return null;
    
    // 优先检查 node.data.originalParent
    const node = getNodeFromCanvasData(canvasData, nodeId);
    if (node?.data?.originalParent) return node.data.originalParent;
    
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
    canvasData: any, 
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
export function isNodeCollapsed(canvasData: any, nodeId: string): boolean {
    if (!canvasData?.metadata?.collapseState) return false;
    return canvasData.metadata.collapseState[nodeId] === true;
}

/**
 * 设置节点的折叠状态
 */
export function setNodeCollapseState(canvasData: any, nodeId: string, collapsed: boolean): void {
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
export function identifyRootNodes(canvasData: any): string[] {
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
export function findParentNode(nodeId: string, edges: any[], allNodes: any[]): any | null {
    for (const edge of edges) {
        const fromId = getEdgeFromNodeId(edge);
        const toId = getEdgeToNodeId(edge);

        if (toId === nodeId) {
            const parentNode = allNodes.find((n: any) => n.id === fromId);
            if (parentNode) return parentNode;
        }
    }
    return null;
}

/**
 * 查找节点的所有子节点 ID
 */
export function findChildNodes(nodeId: string, edges: any[]): string[] {
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
    canvasData: any, 
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
                isFloating = (info as any).isFloating;
                originalParent = (info as any).originalParent || '';
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
export function getNodeDomElement(canvas: any, nodeId: string): HTMLElement | null {
    if (!canvas?.nodes) return null;
    const nodeData = canvas.nodes.get(nodeId);
    return nodeData?.nodeEl || null;
}

/**
 * 检查节点是否在视图中可见
 */
export function isNodeVisible(canvas: any, nodeId: string): boolean {
    const nodeEl = getNodeDomElement(canvas, nodeId);
    if (!nodeEl) return false;
    return nodeEl.style.display !== 'none';
}

/**
 * 显示/隐藏节点
 */
export function setNodeVisibility(canvas: any, nodeId: string, visible: boolean): void {
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
export function debounce<T extends (...args: any[]) => void>(
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
export function throttle<T extends (...args: any[]) => void>(
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
export function isTextNode(node: any): boolean {
    return !node.type || node.type === 'text';
}

/**
 * 检测节点是否为文件节点
 */
export function isFileNode(node: any): boolean {
    return node.type === 'file';
}
