import { CollapseStateManager } from '../../state/collapse-state';
import { log } from '../../utils/logger';

/**
 * 可见性服务 - 负责计算 Canvas 中哪些节点和边是可见的
 * 主要处理折叠状态导致的节点隐藏逻辑
 */
export class VisibilityService {
    private collapseStateManager: CollapseStateManager;

    constructor(collapseStateManager: CollapseStateManager) {
        this.collapseStateManager = collapseStateManager;
    }

    /**
     * 获取所有可见节点的 ID 集合
     * @param nodes Canvas 中的所有节点
     * @param edges Canvas 中的所有边
     * @returns 可见节点 ID 的 Set
     */
    getVisibleNodeIds(nodes: Map<string, any> | any[], edges: any[]): Set<string> {
        const visibleNodeIds = new Set<string>();
        const allNodeIds = new Set<string>();

        if (nodes instanceof Map) {
            nodes.forEach((_, id) => allNodeIds.add(id));
        } else if (Array.isArray(nodes)) {
            nodes.forEach(node => {
                if (node.id) allNodeIds.add(node.id);
            });
        }

        const collapsedNodes = this.collapseStateManager.getAllCollapsedNodes();
        const allHiddenNodeIds = new Set<string>();

        collapsedNodes.forEach(nodeId => {
            // 只有后代节点被隐藏，折叠节点本身是可见的
            this.collapseStateManager.addAllDescendantsToSet(nodeId, edges, allHiddenNodeIds);
        });

        allNodeIds.forEach(id => {
            if (!allHiddenNodeIds.has(id)) {
                visibleNodeIds.add(id);
            }
        });

        if (allHiddenNodeIds.size > 0) {
            log(`[Visibility] 可见: ${visibleNodeIds.size}/${allNodeIds.size} (隐藏: ${allHiddenNodeIds.size})`);
        }
        return visibleNodeIds;
    }

    /**
     * 检查节点是否可见
     * @param nodeId 节点 ID
     * @param edges Canvas 中的所有边
     * @returns 是否可见
     */
    isNodeVisible(nodeId: string, edges: any[]): boolean {
        const collapsedNodes = this.collapseStateManager.getAllCollapsedNodes();
        
        // 检查该节点是否是任何折叠节点的后代
        for (const collapsedId of collapsedNodes) {
            if (collapsedId === nodeId) continue; // 折叠节点本身可见
            
            const descendants = new Set<string>();
            this.collapseStateManager.addAllDescendantsToSet(collapsedId, edges, descendants);
            if (descendants.has(nodeId)) return false;
        }

        return true;
    }
}
