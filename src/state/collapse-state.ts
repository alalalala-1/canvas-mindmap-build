import { log } from '../utils/logger';

/**
 * 折叠状态管理器
 */
export class CollapseStateManager {
    private collapsedNodes: Map<string, boolean> = new Map();
    private nodeChildrenCache: Map<string, string[]> = new Map();

    markCollapsed(nodeId: string) {
        this.collapsedNodes.set(nodeId, true);
        log(`[State] 折叠: ${nodeId}`);
    }

    markExpanded(nodeId: string) {
        this.collapsedNodes.delete(nodeId);
        log(`[State] 展开: ${nodeId}`);
    }

    isCollapsed(nodeId: string): boolean {
        return this.collapsedNodes.get(nodeId) === true;
    }

    getChildNodes(nodeId: string, edges: unknown[]): string[] {
        // 不使用缓存，因为边的内容可能变化但数量相同
        // 直接计算子节点
        const childIds: string[] = [];

        for (const e of edges) {
            // 使用与 getNodeIdFromEdgeEndpoint 相同的逻辑
            const fromId = this.getEdgeFromId(e);
            const toId = this.getEdgeToId(e);

            if (fromId === nodeId && toId) {
                childIds.push(toId);
            }
        }

        return childIds;
    }

    // 从边的端点获取节点 ID（与 canvas-utils.ts 中的函数保持一致）
    private getNodeIdFromEdgeEndpoint(endpoint: unknown): string | null {
        if (!endpoint) return null;
        if (typeof endpoint === 'string') return endpoint;
        if (typeof endpoint === 'object') {
            const endpointObj = endpoint as { nodeId?: unknown; node?: { id?: unknown } };
            if (typeof endpointObj.nodeId === 'string') return endpointObj.nodeId;
            if (endpointObj.node && typeof endpointObj.node.id === 'string') return endpointObj.node.id;
        }
        return null;
    }

    private getEdgeFromId(edge: unknown): string | null {
        if (!edge || typeof edge !== 'object') return null;
        const edgeObj = edge as { from?: unknown; fromNode?: unknown };
        const fromId = this.getNodeIdFromEdgeEndpoint(edgeObj.from);
        if (fromId) return fromId;
        if (typeof edgeObj.fromNode === 'string') return edgeObj.fromNode;
        return null;
    }

    private getEdgeToId(edge: unknown): string | null {
        if (!edge || typeof edge !== 'object') return null;
        const edgeObj = edge as { to?: unknown; toNode?: unknown };
        const toId = this.getNodeIdFromEdgeEndpoint(edgeObj.to);
        if (toId) return toId;
        if (typeof edgeObj.toNode === 'string') return edgeObj.toNode;
        return null;
    }

    private isDirection(value: unknown): value is 'left' | 'right' | 'top' | 'bottom' {
        return value === 'left' || value === 'right' || value === 'top' || value === 'bottom';
    }

    getNodeDirection(nodeId: string, edges: unknown[]): 'left' | 'right' | 'top' | 'bottom' | 'unknown' {
        const outgoingEdges: unknown[] = [];
        
        for (const e of edges) {
            const fromId = this.getEdgeFromId(e);
            if (fromId === nodeId) {
                outgoingEdges.push(e);
            }
        }
        
        if (outgoingEdges.length === 0) return 'unknown';
        
        const firstEdge = outgoingEdges[0];
        if (firstEdge && typeof firstEdge === 'object') {
            const edgeObj = firstEdge as { fromLineEnd?: unknown; from?: unknown };
            if (this.isDirection(edgeObj.fromLineEnd)) return edgeObj.fromLineEnd;
            if (edgeObj.from && typeof edgeObj.from === 'object') {
                const fromObj = edgeObj.from as { side?: unknown };
                if (this.isDirection(fromObj.side)) return fromObj.side;
            }
        }
        return 'right';
    }

    clearCache() {
        this.nodeChildrenCache.clear();
        log('[State] 清除缓存');
    }

    getAllCollapsedNodes(): Set<string> {
        const collapsedSet = new Set<string>();
        this.collapsedNodes.forEach((isCollapsed, nodeId) => {
            if (isCollapsed) {
                collapsedSet.add(nodeId);
            }
        });
        return collapsedSet;
    }

    /**
     * 递归添加所有后代节点到集合中
     */
    addAllDescendantsToSet(nodeId: string, edges: unknown[], targetSet: Set<string>) {
        const childNodeIds = this.getChildNodes(nodeId, edges);
        for (const childId of childNodeIds) {
            if (!targetSet.has(childId)) {
                targetSet.add(childId);
                this.addAllDescendantsToSet(childId, edges, targetSet);
            }
        }
    }
}
