import { debug, trace, logTime } from '../utils/logger';

interface LayoutNode {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    children: string[];
    _subtreeHeight: number;
    originalParent?: string; // 记录原父节点
}

interface LayoutEdge {
    fromNode: string;
    toNode: string;
}

export interface CanvasArrangerSettings {
    horizontalSpacing: number;
    verticalSpacing: number;
    textNodeWidth: number;
    textNodeMaxHeight: number;
    imageNodeWidth: number;
    imageNodeHeight: number;
    formulaNodeWidth: number;
    formulaNodeHeight: number;
}

export const DEFAULT_ARRANGER_SETTINGS: CanvasArrangerSettings = {
    horizontalSpacing: 200,
    verticalSpacing: 40,
    textNodeWidth: 400,
    textNodeMaxHeight: 800,
    imageNodeWidth: 400,
    imageNodeHeight: 400,
    formulaNodeWidth: 400,
    formulaNodeHeight: 80,
};

/**
 * 从边端点中提取节点ID
 */
function getNodeIdFromEndpoint(endpoint: any): string | null {
    if (!endpoint) return null;
    if (typeof endpoint === 'string') return endpoint;
    if (typeof endpoint.nodeId === 'string') return endpoint.nodeId;
    if (endpoint.node && typeof endpoint.node.id === 'string') return endpoint.node.id;
    if (endpoint.node && endpoint.node.id && typeof endpoint.node.id === 'string') return endpoint.node.id;
    return null;
}

/**
 * 计算画布节点的自动布局 - 实现子节点树和父节点的垂直居中对齐
 * @param nodes 可见节点Map（用于布局计算）
 * @param edges 当前边数组（用于布局计算）
 * @param settings 布局设置
 * @param originalEdges 原始边数组（包含已删除的边，用于识别孤立节点的原父节点）
 * @param allNodes 所有节点Map（用于判断孤立节点，可选）
 * @returns 新的节点位置Map
 */
export function arrangeLayout(
    nodes: Map<string, any>,
    edges: any[],
    settings: CanvasArrangerSettings,
    originalEdges?: any[],
    allNodes?: Map<string, any>
): Map<string, { x: number; y: number; width: number; height: number }> {
    const endTimer = logTime('arrangeLayout');

    debug('arrangeLayout 开始');
    debug('输入节点数量:', nodes.size);
    debug('输入边数量:', edges.length);

    // 构建布局图 - 使用所有节点（包括折叠的）来正确识别孤立节点
    const layoutNodes = new Map<string, LayoutNode>();
    const nodesForInit = allNodes || nodes;

    // 初始化所有节点
    let formulaNodeCount = 0;
    nodesForInit.forEach((nodeData, nodeId) => {
        // 检测是否是公式节点（内容以 $$ 开头和结尾，后面可能有 fromLink 注释）
        const nodeText = nodeData.text || '';
        const isFormula = nodeText && /^\$\$[\s\S]*?\$\$\s*(<!-- fromLink:[\s\S]*?-->)?\s*$/.test(nodeText.trim());

        // 根据节点类型确定高度
        let nodeHeight: number;
        if (isFormula) {
            nodeHeight = settings.formulaNodeHeight || 80;
            formulaNodeCount++;
            debug(`布局节点 ${nodeId}: 公式节点, 高度=${nodeHeight}, 内容=${nodeText.substring(0, 30)}...`);
        } else {
            nodeHeight = nodeData.height || 60;
        }

        // 保留原始位置，用于孤立节点
        layoutNodes.set(nodeId, {
            id: nodeId,
            x: nodeData.x || 0,
            y: nodeData.y || 0,
            width: nodeData.width || settings.textNodeWidth,
            height: nodeHeight,
            children: [],
            _subtreeHeight: 0
        });
    });

    debug(`布局节点数量: ${layoutNodes.size}, 其中公式节点: ${formulaNodeCount}`);

    // 构建父子关系映射（用于查找原父节点）- 使用原始边数据
    const parentMap = new Map<string, string>(); // childId -> parentId

    // 首先使用原始边数据构建 parentMap（这样能找到已删除边的父节点）
    const edgesToCheck = originalEdges && originalEdges.length > 0 ? originalEdges : edges;
    for (const edge of edgesToCheck) {
        // 支持两种格式：
        // 1. 内存格式: { from: { node: { id: "..." } }, to: { node: { id: "..." } } }
        // 2. 文件格式: { fromNode: "...", toNode: "..." }
        let fromId = getNodeIdFromEndpoint(edge.from);
        let toId = getNodeIdFromEndpoint(edge.to);

        // 如果上面的方法失败，尝试文件格式
        if (!fromId && edge.fromNode) {
            fromId = edge.fromNode;
        }
        if (!toId && edge.toNode) {
            toId = edge.toNode;
        }

        if (!fromId || !toId) continue;

        // 只记录存在于所有节点中的节点的父子关系（如果有 allNodes 则使用 allNodes，否则使用 layoutNodes）
        const nodesToCheck = allNodes || layoutNodes;
        if (nodesToCheck.has(fromId) && nodesToCheck.has(toId)) {
            parentMap.set(toId, fromId);
        }
    }

    debug('parentMap 构建完成，包含', parentMap.size, '条父子关系');

    // 构建当前边和父子关系（用于布局计算）
    const processedEdges = new Set<string>();
    for (const edge of edges) {
        const fromId = getNodeIdFromEndpoint(edge.from);
        const toId = getNodeIdFromEndpoint(edge.to);

        if (!fromId || !toId) continue;

        const edgeKey = `${fromId}-${toId}`;
        if (processedEdges.has(edgeKey)) continue;
        processedEdges.add(edgeKey);

        const parentNode = layoutNodes.get(fromId);
        const childNode = layoutNodes.get(toId);

        if (parentNode && childNode && parentNode.id !== childNode.id) {
            parentNode.children.push(toId);
        }
    }

    debug('处理后的边数量:', processedEdges.size);

    // 找到根节点（没有父节点的节点）
    const layoutNodeIds = Array.from(layoutNodes.keys());
    const childNodes = new Set<string>();
    layoutNodes.forEach(node => {
        node.children.forEach(childId => {
            childNodes.add(childId);
        });
    });

    // 分离真正的根节点和孤立节点（原父子关系被断开的节点）
    const rootNodes: string[] = [];
    const isolatedNodes: string[] = [];

    layoutNodeIds.forEach(id => {
        if (!childNodes.has(id)) {
            // 检查这个节点是否有子节点（有子节点的是真正的根节点）
            const node = layoutNodes.get(id);
            if (node && node.children.length > 0) {
                rootNodes.push(id);
            } else {
                // 没有父节点也没有子节点 = 孤立节点
                // 记录原父节点信息
                const originalParentId = parentMap.get(id);
                if (originalParentId && layoutNodes.has(originalParentId)) {
                    node!.originalParent = originalParentId;
                }
                isolatedNodes.push(id);
            }
        }
    });

    debug('初始根节点数量:', rootNodes.length);
    debug('孤立节点数量:', isolatedNodes.length);
    trace('初始根节点ID:', rootNodes);
    trace('孤立节点ID:', isolatedNodes);

    // 如果没有找到根节点，使用第一个非孤立节点或第一个节点
    if (rootNodes.length === 0 && layoutNodeIds.length > 0) {
        const firstNode = layoutNodeIds[0];
        if (firstNode !== undefined) {
            rootNodes.push(firstNode);
            debug('使用第一个节点作为根节点:', firstNode);
        }
    }

    // 计算每个节点的子树高度
    function calculateSubtreeHeight(nodeId: string): number {
        const node = layoutNodes.get(nodeId);
        if (!node) return 0;

        if (node.children.length === 0) {
            node._subtreeHeight = node.height;
            return node.height;
        }

        let childrenTotalHeight = 0;
        for (const childId of node.children) {
            const childHeight = calculateSubtreeHeight(childId);
            childrenTotalHeight += childHeight;
        }
        childrenTotalHeight += Math.max(0, node.children.length - 1) * settings.verticalSpacing;

        node._subtreeHeight = Math.max(node.height, childrenTotalHeight);
        return node._subtreeHeight;
    }

    // 应用绝对位置 - 实现垂直居中对齐
    function applyAbsolutePositions(nodeId: string, parentY: number = 0) {
        const node = layoutNodes.get(nodeId);
        if (!node) return;

        // 如果是根节点，Y位置为0
        if (parentY === 0 && rootNodes.includes(nodeId)) {
            node.y = 0;
        } else {
            node.y = parentY;
        }

        // 递归处理子节点
        if (node.children.length > 0) {
            // 计算子节点总高度
            let childrenTotalHeight = 0;
            for (const childId of node.children) {
                const childNode = layoutNodes.get(childId);
                if (childNode) {
                    childrenTotalHeight += childNode._subtreeHeight;
                }
            }
            childrenTotalHeight += Math.max(0, node.children.length - 1) * settings.verticalSpacing;

            // 计算子节点的理想起始Y位置（垂直居中）
            const idealChildrenStartY = node.y + (node.height / 2) - (childrenTotalHeight / 2);
            // 确保子节点不会跑到父节点上方
            const childrenStartY = Math.max(node.y, idealChildrenStartY);

            // 设置每个子节点的位置
            let currentY = childrenStartY;
            for (const childId of node.children) {
                const childNode = layoutNodes.get(childId);
                if (childNode) {
                    applyAbsolutePositions(childId, currentY);
                    currentY += childNode._subtreeHeight + settings.verticalSpacing;
                }
            }
        }
    }

    // 计算层级X坐标
    function calculateLevelX(): Map<number, number> {
        const levelMap = new Map<string, number>();
        const levelX = new Map<number, number>();

        // BFS计算层级
        let queue: { nodeId: string; level: number }[] = [];
        rootNodes.forEach(rootId => {
            queue.push({ nodeId: rootId, level: 0 });
            levelMap.set(rootId, 0);
        });

        while (queue.length > 0) {
            const item = queue.shift();
            if (!item) continue;
            const { nodeId, level } = item;
            const node = layoutNodes.get(nodeId);
            if (node) {
                node.children.forEach(childId => {
                    if (!levelMap.has(childId)) {
                        levelMap.set(childId, level + 1);
                        queue.push({ nodeId: childId, level: level + 1 });
                    }
                });
            }
        }

        // 计算每层的最大宽度
        const levelWidths = new Map<number, number>();
        levelMap.forEach((level, nodeId) => {
            const node = layoutNodes.get(nodeId);
            if (node) {
                const currentWidth = levelWidths.get(level) || 0;
                levelWidths.set(level, Math.max(currentWidth, node.width));
            }
        });

        // 计算每层的X坐标
        let currentX = 0;
        const maxLevel = Math.max(...Array.from(levelWidths.keys()), 0);
        for (let level = 0; level <= maxLevel; level++) {
            levelX.set(level, currentX);
            const width = levelWidths.get(level) || settings.textNodeWidth;
            currentX += width + settings.horizontalSpacing;
        }

        return levelX;
    }

    // 执行布局计算
    for (const rootId of rootNodes) {
        calculateSubtreeHeight(rootId);
        applyAbsolutePositions(rootId);
    }

    const levelX = calculateLevelX();

    // 更新X坐标
    const levelMap = new Map<string, number>();
    let queue: { nodeId: string; level: number }[] = [];
    rootNodes.forEach(rootId => {
        queue.push({ nodeId: rootId, level: 0 });
        levelMap.set(rootId, 0);
    });

    while (queue.length > 0) {
        const { nodeId, level } = queue.shift()!;
        const node = layoutNodes.get(nodeId);
        if (node) {
            node.x = levelX.get(level) || 0;
            node.children.forEach(childId => {
                if (!levelMap.has(childId)) {
                    levelMap.set(childId, level + 1);
                    queue.push({ nodeId: childId, level: level + 1 });
                }
            });
        }
    }

    // 处理孤立节点：完全保持其原始位置（不调整X和Y坐标）
    if (isolatedNodes.length > 0) {
        // 孤立节点保持原位置不变，仅记录日志
        debug('孤立节点保持原位置:', isolatedNodes.length, '个孤立节点');
        trace('孤立节点ID:', isolatedNodes);
    }

    // 生成最终结果
    const result = new Map<string, { x: number; y: number; width: number; height: number }>();
    layoutNodes.forEach((node, nodeId) => {
        result.set(nodeId, {
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height
        });
    });

    debug('最终布局结果数量:', result.size);
    debug('arrangeLayout 完成');

    endTimer();
    return result;
}
