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

    getChildNodes(nodeId: string, edges: any[]): string[] {
        // 不使用缓存，因为边的内容可能变化但数量相同
        // 直接计算子节点
        const childIds: string[] = [];

        for (const e of edges) {
            // 使用与 getNodeIdFromEdgeEndpoint 相同的逻辑
            const fromId = this.getNodeIdFromEdgeEndpoint(e?.from);
            const toId = this.getNodeIdFromEdgeEndpoint(e?.to);

            if (fromId === nodeId && toId) {
                childIds.push(toId);
            }
        }

        return childIds;
    }

    // 从边的端点获取节点 ID（与 canvas-utils.ts 中的函数保持一致）
    private getNodeIdFromEdgeEndpoint(endpoint: any): string | null {
        if (!endpoint) return null;
        if (typeof endpoint === 'string') return endpoint;
        if (typeof endpoint.nodeId === 'string') return endpoint.nodeId;
        if (endpoint.node && typeof endpoint.node.id === 'string') return endpoint.node.id;
        return null;
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
