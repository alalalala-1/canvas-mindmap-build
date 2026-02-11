import { log } from '../utils/logger';

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
 * 估算文本节点高度（保守估计，防止重叠）
 */
function estimateTextNodeHeight(content: string, width: number, settings: CanvasArrangerSettings): number {
    const maxHeight = settings.textNodeMaxHeight || 800;
    const contentWidth = width - 40;
    const fontSize = 14;
    const lineHeight = 26;
    
    const chineseCharRegex = /[\u4e00-\u9fa5]/;
    let totalLines = 0;
    const textLines = content.split('\n');

    for (const line of textLines) {
        const trimmedLine = line.trim();
        if (trimmedLine === '') {
            totalLines += 0.5;
            continue;
        }

        const cleanLine = trimmedLine
            .replace(/^#{1,6}\s+/, '')
            .replace(/\*\*|\*|__|_|`/g, '');

        let pixelWidth = 0;
        for (const char of cleanLine) {
            if (chineseCharRegex.test(char)) {
                pixelWidth += fontSize * 1.15;
            } else {
                pixelWidth += fontSize * 0.6;
            }
        }

        const linesNeeded = Math.ceil(pixelWidth / contentWidth);
        totalLines += Math.max(1, linesNeeded);
    }

    const safetyPadding = 44;
    const calculatedHeight = Math.ceil(totalLines * lineHeight + safetyPadding);
    return Math.max(60, Math.min(calculatedHeight, maxHeight));
}

/**
 * 计算画布节点的自动布局 - 支持浮动子树和“大行”布局
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
    log(`[Layout] 开始: ${nodes.size} 节点, ${edges.length} 边`);

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
        } else {
            // 如果节点已有高度且不是默认值，保留它；否则重新估算
            const currentWidth = nodeData.width || settings.textNodeWidth;
            if (nodeData.height && nodeData.height > 60) {
                nodeHeight = nodeData.height;
            } else {
                nodeHeight = estimateTextNodeHeight(nodeText, currentWidth, settings);
            }
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
                // 直接使用存储的原父节点信息
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
    floatingSubtreeRoots.forEach(rootId => {
        const parentId = floatingSubtreeOriginalParents.get(rootId);
        if (parentId) {
            // 同时更新布局图
            const parentNode = layoutNodes.get(parentId);
            const childNode = layoutNodes.get(rootId);
            if (parentNode && childNode) {
                // 确保子节点在父节点的children列表中
                if (!parentNode.children.includes(rootId)) {
                    // 关键修复：为了保持浮动节点在原父节点下的相对顺序，
                    // 我们查阅 originalEdges 中该父节点的所有子节点顺序
                    const originalChildren = completeChildrenMap.get(parentId) || [];
                    const rootIndex = originalChildren.indexOf(rootId);
                    
                    if (rootIndex !== -1) {
                        // 寻找已经在 children 中的其他原始兄弟节点
                        let inserted = false;
                        for (let i = 0; i < parentNode.children.length; i++) {
                            const currentChildId = parentNode.children[i];
                            if (!currentChildId) continue;
                            const currentChildOriginalIndex = originalChildren.indexOf(currentChildId);
                            
                            if (currentChildOriginalIndex > rootIndex) {
                                // 插入到第一个原始序号比它大的节点之前
                                parentNode.children.splice(i, 0, rootId);
                                inserted = true;
                                break;
                            }
                        }
                        
                        if (!inserted) {
                            parentNode.children.push(rootId);
                        }
                    } else {
                        parentNode.children.push(rootId);
                    }
                }
                layoutParentMap.set(rootId, parentId);
            }
        }
    });

    // 找到真正的根节点（没有父节点的节点）
    const rootNodes: string[] = [];
    layoutNodes.forEach((_, id) => {
        if (!layoutParentMap.has(id)) {
            rootNodes.push(id);
        }
    });

    // 对根节点进行排序，以便布局时的一致性
    rootNodes.sort((a, b) => {
        const nodeA = layoutNodes.get(a)!;
        const nodeB = layoutNodes.get(b)!;
        return nodeA.y - nodeB.y || nodeA.x - nodeB.x;
    });

    if (rootNodes.length > 0) {
        log(`[Layout] 根: ${rootNodes.length}${floatingSubtreeRoots.size > 0 ? ' (浮动: ' + floatingSubtreeRoots.size + ')' : ''}`);
    }

    // 1. 计算每个节点的子树高度（从右到左/自底向上）
    function calculateSubtreeHeight(nodeId: string): number {
        const node = layoutNodes.get(nodeId);
        if (!node) return 0;

        if (node.children.length === 0) {
            node._subtreeHeight = node.height;
            return node.height;
        }

        let childrenTotalHeight = 0;
        for (const childId of node.children) {
            childrenTotalHeight += calculateSubtreeHeight(childId);
        }
        childrenTotalHeight += Math.max(0, node.children.length - 1) * settings.verticalSpacing;

        node._subtreeHeight = Math.max(node.height, childrenTotalHeight);
        return node._subtreeHeight;
    }

    // 2. 计算节点在层级中的深度 (用于从右到左对齐)
    const nodeLevel = new Map<string, number>();
    const nodeMaxDepth = new Map<string, number>(); // 节点到最远叶子节点的距离

    function calculateMaxDepth(nodeId: string): number {
        const node = layoutNodes.get(nodeId);
        if (!node || node.children.length === 0) {
            nodeMaxDepth.set(nodeId, 0);
            return 0;
        }
        
        let maxChildDepth = -1;
        for (const childId of node.children) {
            maxChildDepth = Math.max(maxChildDepth, calculateMaxDepth(childId));
        }
        const depth = maxChildDepth + 1;
        nodeMaxDepth.set(nodeId, depth);
        return depth;
    }

    // 辅助函数：计算每个节点所在的列（从最深叶子节点向左推导）
    const nodeColumn = new Map<string, number>();
    const columnWidths = new Map<number, number>();

    // 获取所有节点的最大深度，用于对齐
    let maxOverallDepth = 0;
    rootNodes.forEach(rootId => {
        maxOverallDepth = Math.max(maxOverallDepth, calculateMaxDepth(rootId));
    });

    function calculateColumns(nodeId: string, parentColumn: number) {
        const node = layoutNodes.get(nodeId);
        if (!node) return;

        // 如果是根节点，初始列由其最大深度决定
        // 这样可以保证所有叶子节点尽量靠右对齐
        let column: number;
        if (parentColumn === -1) {
            // 根节点的列 = 总最大深度 - 该根节点子树的最大深度
            column = maxOverallDepth - (nodeMaxDepth.get(nodeId) || 0);
        } else {
            column = parentColumn + 1;
        }

        nodeColumn.set(nodeId, column);
        
        // 更新列宽
        const currentWidth = columnWidths.get(column) || 0;
        columnWidths.set(column, Math.max(currentWidth, node.width));

        for (const childId of node.children) {
            calculateColumns(childId, column);
        }
    }

    // 3. 计算节点位置 (从右向左居中对齐)
    /**
     * 从右向左计算节点位置
     * 逻辑：
     * 1. 叶子节点位置固定（在最后一列）
     * 2. 父节点位置 = 其所有子节点 Y 坐标的中心
     * 3. 如果父节点有多个子节点，子节点之间保持垂直间距
     */
    function calculatePositionsRightToLeft(nodeId: string): { minY: number, maxY: number, centerY: number } {
        const node = layoutNodes.get(nodeId);
        if (!node) return { minY: 0, maxY: 0, centerY: 0 };

        if (node.children.length === 0) {
            // 叶子节点：返回其自身的高度范围，初始 Y 设为 0（后续会加上偏移）
            node.y = 0;
            return { minY: 0, maxY: node.height, centerY: node.height / 2 };
        }

        // 有子节点的节点：先计算所有子节点的位置
        let childrenMinY = Infinity;
        let childrenMaxY = -Infinity;
        let currentY = 0;

        const childRanges: { id: string, minY: number, maxY: number, centerY: number }[] = [];

        for (const childId of node.children) {
            const range = calculatePositionsRightToLeft(childId);
            childRanges.push({ id: childId, ...range });
        }

        // 垂直排列子节点
        currentY = 0;
        for (let i = 0; i < childRanges.length; i++) {
            const range = childRanges[i];
            if (!range) continue;
            
            const childNodeId = range.id;
            
            // 移动子树（包括其所有后代）
            const offset = currentY - range.minY;
            const subtreeStack = [childNodeId];
            while (subtreeStack.length > 0) {
                const sid = subtreeStack.pop()!;
                const snode = layoutNodes.get(sid)!;
                snode.y += offset;
                subtreeStack.push(...snode.children);
            }

            childrenMinY = Math.min(childrenMinY, currentY);
            childrenMaxY = Math.max(childrenMaxY, currentY + (range.maxY - range.minY));
            
            currentY += (range.maxY - range.minY) + settings.verticalSpacing;
        }

        // 父节点在子节点中心对齐
        const childrenCenterY = (childrenMinY + childrenMaxY) / 2;
        node.y = childrenCenterY - (node.height / 2);

        // 返回该子树的总范围
        const totalMinY = Math.min(node.y, childrenMinY);
        const totalMaxY = Math.max(node.y + node.height, childrenMaxY);
        
        return { 
            minY: totalMinY, 
            maxY: totalMaxY, 
            centerY: childrenCenterY 
        };
    }

    // 跟踪整个画布当前的全局最大 Y 底部位置（用于实现严格的“大行”块状布局）
    let currentGlobalBottomY = -settings.verticalSpacing;

    // 为每个根节点（即每个“大行”）执行布局
    rootNodes.forEach(rootId => {
        // A. 计算深度和列
        calculateMaxDepth(rootId);
        calculateColumns(rootId, -1);
        
        // B. 从右向左计算该子树的内部相对位置（以根节点 y=0 为起始参考）
        const subtreeRange = calculatePositionsRightToLeft(rootId);

        // C. 收集子树所有节点
        const subtreeNodes: string[] = [];
        const stack = [rootId];
        const visited = new Set<string>(); // 防止循环
        while (stack.length > 0) {
            const id = stack.pop()!;
            if (visited.has(id)) continue;
            visited.add(id);
            
            subtreeNodes.push(id);
            const node = layoutNodes.get(id);
            if (node) {
                // 逆序压栈以保持原有的子节点顺序
                for (let i = node.children.length - 1; i >= 0; i--) {
                    const childId = node.children[i];
                    if (childId) stack.push(childId);
                }
            }
        }

        // D. 计算该“大行”相对于其内部 y=0 的偏移量，使其整体位于上一个“大行”之下
        // 用户要求：以整个“大行”中向下凸起最多的占位作为基准
        
        // 先找到子树在相对坐标系下的最高点（最小 Y）
        let subtreeMinY = Infinity;
        for (const id of subtreeNodes) {
            const node = layoutNodes.get(id)!;
            subtreeMinY = Math.min(subtreeMinY, node.y);
        }

        // 全局偏移量 = 当前全局底部 + 间隔 - 子树最高点
        const globalOffsetY = (currentGlobalBottomY + settings.verticalSpacing) - subtreeMinY;

        // E. 应用偏移量并更新全局底部位置
        let maxSubtreeBottom = -Infinity;
        for (const id of subtreeNodes) {
            const node = layoutNodes.get(id)!;
            node.y += globalOffsetY;
            maxSubtreeBottom = Math.max(maxSubtreeBottom, node.y + node.height);
        }

        // 更新全局底部，确保下一个“大行”完全在当前大行之下
        currentGlobalBottomY = maxSubtreeBottom;
    });

    // 4. 计算层级X坐标 (从左到右)
    const columnX = new Map<number, number>();
    let currentX = 0;
    const sortedColumns = Array.from(columnWidths.keys()).sort((a, b) => a - b);
    for (const col of sortedColumns) {
        columnX.set(col, currentX);
        const width = columnWidths.get(col) || settings.textNodeWidth;
        currentX += width + settings.horizontalSpacing;
    }

    // 更新所有节点的X坐标
    layoutNodes.forEach((node, nodeId) => {
        const col = nodeColumn.get(nodeId) || 0;
        node.x = columnX.get(col) || 0;
    });

    log(`[Layout] 完成: ${layoutNodes.size} 节点`);

    const result = new Map<string, { x: number; y: number; width: number; height: number }>();
    layoutNodes.forEach((node, nodeId) => {
        if (nodes.has(nodeId)) {
            result.set(nodeId, {
                x: node.x,
                y: node.y,
                width: node.width,
                height: node.height
            });
        }
    });

    return result;
}

