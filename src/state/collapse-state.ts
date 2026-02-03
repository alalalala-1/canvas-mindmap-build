import { debug, trace } from '../utils/logger';

/**
 * 折叠状态管理器
 */
export class CollapseStateManager {
    private collapsedNodes: Map<string, boolean> = new Map();
    private nodeChildrenCache: Map<string, string[]> = new Map();

    markCollapsed(nodeId: string) {
        this.collapsedNodes.set(nodeId, true);
        debug(`标记节点为已折叠: ${nodeId}`);
    }

    markExpanded(nodeId: string) {
        this.collapsedNodes.delete(nodeId);
        debug(`标记节点为已展开: ${nodeId}`);
    }

    isCollapsed(nodeId: string): boolean {
        return this.collapsedNodes.get(nodeId) === true;
    }

    getChildNodes(nodeId: string, edges: any[]): string[] {
        const cacheKey = `${nodeId}-${edges.length}`;
        if (this.nodeChildrenCache.has(cacheKey)) {
            return this.nodeChildrenCache.get(cacheKey)!;
        }

        const childIds: string[] = [];
        
        for (const e of edges) {
            const fromId = e.from?.node?.id || e.fromNode;
            const toId = e.to?.node?.id || e.toNode;
            
            if (fromId === nodeId && toId) {
                childIds.push(toId);
            }
        }

        this.nodeChildrenCache.set(cacheKey, childIds);
        trace(`获取节点 ${nodeId} 的子节点:`, childIds);
        return childIds;
    }

    getNodeDirection(nodeId: string, edges: any[]): 'left' | 'right' | 'top' | 'bottom' | 'unknown' {
        const outgoingEdges: any[] = [];
        
        for (const e of edges) {
            const fromId = e.from?.node?.id || e.fromNode;
            if (fromId === nodeId) {
                outgoingEdges.push(e);
            }
        }
        
        if (outgoingEdges.length === 0) return 'unknown';
        
        const firstEdge = outgoingEdges[0];
        const direction = firstEdge.fromLineEnd || firstEdge.from?.side || 'right';
        return direction;
    }

    clearCache() {
        this.nodeChildrenCache.clear();
        trace('清除折叠状态缓存');
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
    addAllDescendantsToSet(nodeId: string, edges: any[], targetSet: Set<string>) {
        const childNodeIds = this.getChildNodes(nodeId, edges);
        for (const childId of childNodeIds) {
            if (!targetSet.has(childId)) {
                targetSet.add(childId);
                this.addAllDescendantsToSet(childId, edges, targetSet);
            }
        }
    }
}
