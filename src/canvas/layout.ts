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
 * 获取浮动节点集合和原父节点映射
 * 从 metadata 和节点 data 属性中读取
 */
function getFloatingNodesInfo(canvasData: any): {
    floatingNodes: Set<string>,
    originalParents: Map<string, string>
} {
    const floatingNodes = new Set<string>();
    const originalParents = new Map<string, string>();

    // 1. 从 metadata 读取（向后兼容）
    if (canvasData?.metadata?.floatingNodes) {
        for (const [nodeId, info] of Object.entries(canvasData.metadata.floatingNodes)) {
            // 兼容旧格式（boolean）和新格式（object）
            if (typeof info === 'boolean' && info === true) {
                floatingNodes.add(nodeId);
                // 旧格式没有原父节点信息，需要从边数据中推断
            } else if (typeof info === 'object' && info !== null) {
                const nodeInfo = info as any;
                if (nodeInfo.isFloating) {
                    floatingNodes.add(nodeId);
                    if (nodeInfo.originalParent) {
                        originalParents.set(nodeId, nodeInfo.originalParent);
                    }
                }
            }
        }
    }

    // 2. 从节点本身的 data 属性读取（主要方式）
    if (canvasData?.nodes && Array.isArray(canvasData.nodes)) {
        for (const node of canvasData.nodes) {
            if (node.data?.isFloating) {
                floatingNodes.add(node.id);
                if (node.data.originalParent) {
                    originalParents.set(node.id, node.data.originalParent);
                }
            }
        }
    }

    return { floatingNodes, originalParents };
}

/**
 * 递归收集浮动子树的所有节点
 */
function collectFloatingSubtree(nodeId: string, childrenMap: Map<string, string[]>, floatingSubtree: Set<string>) {
    if (floatingSubtree.has(nodeId)) return;
    
    floatingSubtree.add(nodeId);
    const children = childrenMap.get(nodeId) || [];
    for (const childId of children) {
        collectFloatingSubtree(childId, childrenMap, floatingSubtree);
    }
}

/**
 * 计算画布节点的自动布局 - 支持浮动子树
 * @param nodes 可见节点Map（用于布局计算）
 * @param edges 当前边数组（用于布局计算）
 * @param settings 布局设置
 * @param originalEdges 原始边数组（包含已删除的边）
 * @param allNodes 所有节点Map（用于完整布局）
 * @param canvasData Canvas文件数据（用于获取浮动节点信息）
 * @returns 新的节点位置Map
 */
export function arrangeLayout(
    nodes: Map<string, any>,
    edges: any[],
    settings: CanvasArrangerSettings,
    originalEdges?: any[],
    allNodes?: Map<string, any>,
    canvasData?: any
): Map<string, { x: number; y: number; width: number; height: number }> {
    const endTimer = logTime('arrangeLayout');

    debug('arrangeLayout 开始');
    debug('输入节点数量:', nodes.size);
    debug('输入边数量:', edges.length);

    // 获取浮动节点信息
    let { floatingNodes, originalParents } = getFloatingNodesInfo(canvasData);

    // 过滤掉不存在的浮动节点（只保留当前nodes中存在的节点）
    const validFloatingNodes = new Set<string>();
    const validOriginalParents = new Map<string, string>();
    nodes.forEach((_, nodeId) => {
        if (floatingNodes.has(nodeId)) {
            validFloatingNodes.add(nodeId);
            if (originalParents.has(nodeId)) {
                validOriginalParents.set(nodeId, originalParents.get(nodeId)!);
            }
        }
    });
    floatingNodes = validFloatingNodes;
    originalParents = validOriginalParents;

    debug('检测到浮动节点数量:', floatingNodes.size);
    trace('浮动节点ID:', Array.from(floatingNodes));

    // 构建布局图
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

    // 构建当前边的父子关系（用于布局计算）
    const processedEdges = new Set<string>();
    const layoutParentMap = new Map<string, string>(); // childId -> parentId
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
            layoutParentMap.set(toId, fromId);
        }
    }

    debug('处理后的边数量:', processedEdges.size);

    // 构建完整的父子关系（包括已删除的边，用于确定浮动子树的原父节点）
    const completeParentMap = new Map<string, string>(); // childId -> parentId
    const completeChildrenMap = new Map<string, string[]>(); // parentId -> childIds[]

    // 使用原始边数据构建完整的父子关系（包括已删除的边）
    const edgesForCompleteMap = originalEdges && originalEdges.length > 0 ? originalEdges : edges;
    for (const edge of edgesForCompleteMap) {
        let fromId = getNodeIdFromEndpoint(edge.from);
        let toId = getNodeIdFromEndpoint(edge.to);

        if (!fromId && edge.fromNode) {
            fromId = edge.fromNode;
        }
        if (!toId && edge.toNode) {
            toId = edge.toNode;
        }

        if (!fromId || !toId) continue;

        const nodesToCheck = allNodes || layoutNodes;
        if (nodesToCheck.has(fromId) && nodesToCheck.has(toId)) {
            completeParentMap.set(toId, fromId);
            
            if (!completeChildrenMap.has(fromId)) {
                completeChildrenMap.set(fromId, []);
            }
            completeChildrenMap.get(fromId)!.push(toId);
        }
    }

    // 识别浮动子树及其原父节点
    const floatingSubtreeRoots = new Set<string>();
    const allFloatingSubtreeNodes = new Set<string>();
    const floatingSubtreeOriginalParents = new Map<string, string>(); // 浮动子树根节点 -> 原父节点

    // 找出所有浮动子树的根节点（浮动节点且没有浮动的父节点）
    floatingNodes.forEach(nodeId => {
        if (!allFloatingSubtreeNodes.has(nodeId)) {
            // 检查是否有浮动的父节点
            let hasFloatingParent = false;
            let currentParent = completeParentMap.get(nodeId);
            while (currentParent) {
                if (floatingNodes.has(currentParent)) {
                    hasFloatingParent = true;
                    break;
                }
                currentParent = completeParentMap.get(currentParent);
            }
            
            if (!hasFloatingParent) {
                floatingSubtreeRoots.add(nodeId);
                // 收集整个浮动子树
                collectFloatingSubtree(nodeId, completeChildrenMap, allFloatingSubtreeNodes);
                // 直接使用存储的原父节点信息（这是关键修复）
                const originalParent = originalParents.get(nodeId);
                if (originalParent) {
                    floatingSubtreeOriginalParents.set(nodeId, originalParent);
                }
                // 如果没有存储的原父节点信息（兼容旧数据），尝试从完整边数据中推断
                else if (completeParentMap.has(nodeId)) {
                    floatingSubtreeOriginalParents.set(nodeId, completeParentMap.get(nodeId)!);
                }
            }
        }
    });

    // 创建虚拟边：为浮动子树添加虚拟连接到原父节点
    const virtualEdges: { fromId: string; toId: string }[] = [];
    floatingSubtreeRoots.forEach(rootId => {
        const originalParentId = floatingSubtreeOriginalParents.get(rootId);
        if (originalParentId) {
            // 添加虚拟边（即使已经有父节点也要添加，确保浮动子树参与布局）
            virtualEdges.push({ fromId: originalParentId, toId: rootId });
            // 同时更新布局图
            const parentNode = layoutNodes.get(originalParentId);
            const childNode = layoutNodes.get(rootId);
            if (parentNode && childNode) {
                // 确保子节点在父节点的children列表中（插入到开头，确保浮动子树排在前面）
                if (!parentNode.children.includes(rootId)) {
                    parentNode.children.unshift(rootId); // 使用 unshift 而不是 push
                }
                layoutParentMap.set(rootId, originalParentId);
            }
        }
    });

    debug('添加虚拟边数量:', virtualEdges.length);

    // 找到真正的根节点（没有父节点的节点）
    const layoutNodeIds = Array.from(layoutNodes.keys());
    const rootNodes: string[] = [];

    layoutNodeIds.forEach(id => {
        const hasParent = layoutParentMap.has(id);
        if (!hasParent) {
            rootNodes.push(id);
        }
    });

    debug('根节点数量:', rootNodes.length);
    debug('浮动子树根节点数量:', floatingSubtreeRoots.size);
    debug('浮动子树总节点数:', allFloatingSubtreeNodes.size);
    trace('根节点ID:', rootNodes);
    trace('浮动子树根节点ID:', Array.from(floatingSubtreeRoots));

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
    // 所有子节点（包括浮动节点）都作为正常子节点处理
    function applyAbsolutePositions(nodeId: string, parentY: number = 0) {
        const node = layoutNodes.get(nodeId);
        if (!node) return;

        // 设置当前节点的Y坐标
        if (parentY === 0 && rootNodes.includes(nodeId)) {
            node.y = 0;
        } else {
            node.y = parentY;
        }

        // 递归处理所有子节点（包括浮动节点，都作为正常子节点）
        if (node.children.length > 0) {
            // 计算所有子节点总高度
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

    // 执行布局计算 - 包含虚拟边的完整布局
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
        const item = queue.shift();
        if (!item) continue;
        const { nodeId, level } = item;
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
