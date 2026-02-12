import { log } from '../utils/logger';
import { getEdgeFromNodeId, getEdgeToNodeId } from '../utils/canvas-utils';

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
            const fromId = getEdgeFromNodeId(e as any);
            const toId = getEdgeToNodeId(e as any);

            if (fromId === nodeId && toId) {
                childIds.push(toId);
            }
        }

        return childIds;
    }

    private isDirection(value: unknown): value is 'left' | 'right' | 'top' | 'bottom' {
        return value === 'left' || value === 'right' || value === 'top' || value === 'bottom';
    }

    getNodeDirection(nodeId: string, edges: unknown[]): 'left' | 'right' | 'top' | 'bottom' | 'unknown' {
        const outgoingEdges: unknown[] = [];
        
        for (const e of edges) {
            const fromId = getEdgeFromNodeId(e as any);
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
