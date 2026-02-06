import { CollapseStateManager } from '../../state/collapse-state';
import { debug, info } from '../../utils/logger';

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

        // 1. 收集所有节点 ID
        if (nodes instanceof Map) {
            nodes.forEach((_, id) => allNodeIds.add(id));
        } else if (Array.isArray(nodes)) {
            nodes.forEach(node => {
                if (node.id) allNodeIds.add(node.id);
            });
        }

        // 2. 获取所有被折叠的节点及其后代
        const collapsedNodes = this.collapseStateManager.getAllCollapsedNodes();
        const allCollapsedNodes = new Set<string>(collapsedNodes);

        // 递归添加所有后代节点到折叠集合中
        collapsedNodes.forEach(nodeId => {
            this.collapseStateManager.addAllDescendantsToSet(nodeId, edges, allCollapsedNodes);
        });

        debug(`[VisibilityService] 折叠节点数量: ${collapsedNodes.length}, 总计隐藏节点数量: ${allCollapsedNodes.size}`);

        // 3. 计算可见节点（所有节点 - 隐藏节点）
        allNodeIds.forEach(id => {
            if (!allCollapsedNodes.has(id)) {
                visibleNodeIds.add(id);
            }
        });

        info(`[VisibilityService] 计算完成: 可见节点 ${visibleNodeIds.size} / 总节点 ${allNodeIds.size}`);
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
        if (collapsedNodes.includes(nodeId)) return false;

        // 检查该节点是否是任何折叠节点的后代
        for (const collapsedId of collapsedNodes) {
            const descendants = new Set<string>();
            this.collapseStateManager.addAllDescendantsToSet(collapsedId, edges, descendants);
            if (descendants.has(nodeId)) return false;
        }

        return true;
    }
}
