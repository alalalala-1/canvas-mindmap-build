/**
 * Canvas 数据读写工具函数
 * 用于处理 Canvas 文件数据的读取、写入和操作
 */

import { App, TFile } from 'obsidian';
import { log } from './logger';
import { CanvasEdgeLike, EdgeEndpoint, FloatingNodeRecord } from '../canvas/types';
import { getEdgeFromNodeId, getEdgeToNodeId } from './edge-utils';

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

// ============================================================================
// Canvas 文件读写
// ============================================================================

/**
 * 安全地读取 Canvas 文件数据
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

export type ParsedFloatingInfo = {
    isFloating: boolean;
    originalParent: string;
};

/**
 * 解析浮动节点信息
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

/**
 * 检查节点是否为浮动节点
 */
export function isFloatingNode(canvasData: CanvasData, nodeId: string): boolean {
    if (!canvasData) return false;
    
    const node = getNodeFromCanvasData(canvasData, nodeId);
    if (node?.data?.isFloating) return true;
    
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
    
    const node = getNodeFromCanvasData(canvasData, nodeId);
    const originalParent = node?.data?.originalParent;
    if (typeof originalParent === 'string' && originalParent) return originalParent;
    
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
    
    if (!canvasData.metadata) canvasData.metadata = {};
    if (!canvasData.metadata.floatingNodes) canvasData.metadata.floatingNodes = {};
    
    const node = getNodeFromCanvasData(canvasData, nodeId);
    if (node) {
        if (!node.data) node.data = {};
        
        if (isFloating) {
            node.data.isFloating = true;
            if (originalParent) node.data.originalParent = originalParent;
            
            canvasData.metadata.floatingNodes[nodeId] = {
                isFloating: true,
                originalParent: originalParent,
                timestamp: Date.now()
            };
        } else {
            delete node.data.isFloating;
            delete node.data.originalParent;
            delete node.data.floatingTimestamp;
            
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