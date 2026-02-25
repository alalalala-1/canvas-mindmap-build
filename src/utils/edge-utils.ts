/**
 * 边数据解析工具函数
 * 用于处理 Canvas 边的创建、解析和查询
 */

import { CanvasEdgeLike } from '../canvas/types';

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
 * 提取边的源节点和目标节点 ID
 */
export function extractEdgeNodeIds(edge: CanvasEdgeLike): { fromId: string | null; toId: string | null } {
    return {
        fromId: getEdgeFromNodeId(edge),
        toId: getEdgeToNodeId(edge)
    };
}

/**
 * 获取边的唯一标识符
 */
export function getEdgeId(edge: CanvasEdgeLike | null | undefined): string | null {
    if (!edge) return null;
    const fromId = getEdgeFromNodeId(edge);
    const toId = getEdgeToNodeId(edge);
    if (fromId && toId) return `${fromId}->${toId}`;
    return edge.id || null;
}

/**
 * 构建边 ID 集合
 */
export function buildEdgeIdSet(edges: CanvasEdgeLike[]): Set<string> {
    const ids = new Set<string>();
    for (const edge of edges) {
        const edgeId = getEdgeId(edge);
        if (edgeId) ids.add(edgeId);
    }
    return ids;
}

/**
 * 检测新边
 */
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
 * 获取选中的边
 */
export function getSelectedEdge(canvas: { 
    selectedEdge?: CanvasEdgeLike; 
    selectedEdges?: CanvasEdgeLike[];
    edges?: Map<string, CanvasEdgeLike> | CanvasEdgeLike[] | Record<string, CanvasEdgeLike>;
}): CanvasEdgeLike | null {
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
                : Object.values(canvas.edges);
                
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