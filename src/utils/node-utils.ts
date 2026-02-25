/**
 * 节点查询和操作工具函数
 * 用于处理 Canvas 节点的查询、选择和操作
 */

import { CanvasLike, CanvasNodeLike } from '../canvas/types';
import { getEdgeFromNodeId } from './edge-utils';

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
export function getEdgesFromCanvas(canvas: CanvasLike | null | undefined): CanvasNodeLike[] {
    if (!canvas?.edges) return [];
    
    if (canvas.edges instanceof Map) {
        return Array.from(canvas.edges.values());
    }
    
    if (Array.isArray(canvas.edges)) {
        return canvas.edges;
    }
    
    if (typeof canvas.edges === 'object') {
        return Object.values(canvas.edges as Record<string, CanvasNodeLike>);
    }
    
    return [];
}

/**
 * 从 Canvas 或 fileData 获取边数组
 */
export function getEdgesFromCanvasOrFileData(canvas: CanvasLike | null | undefined): CanvasNodeLike[] {
    if (!canvas) return [];
    if (canvas.edges) return getEdgesFromCanvas(canvas);
    if (canvas.fileData?.edges) return canvas.fileData.edges;
    return [];
}

/**
 * 检查节点是否有子节点
 */
export function hasChildNodes(nodeId: string, edges: CanvasNodeLike[]): boolean {
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
 * 检查值是否为 Record 对象
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 生成随机 ID (8位 36进制字符串)
 */
export function generateRandomId(): string {
    return Math.random().toString(36).substring(2, 10);
}

/**
 * 从 Canvas 获取选中的节点
 */
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

/**
 * 通过 DOM 元素获取 Canvas 节点
 */
export function getCanvasNodeByElement(canvas: CanvasLike, nodeEl: HTMLElement): CanvasNodeLike | null {
    const nodes = getNodesFromCanvas(canvas);
    return nodes.find(node => node.nodeEl === nodeEl) || null;
}

/**
 * 临时选中节点执行操作
 */
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
// 私有辅助函数
// ============================================================================

function isCanvasNodeLike(value: unknown): value is CanvasNodeLike {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as CanvasNodeLike;
    return typeof candidate.id === 'string' || !!candidate.nodeEl || typeof candidate.type === 'string';
}