import { log } from '../utils/logger';
import { CanvasNodeLike, CanvasEdgeLike, CanvasDataLike, FloatingNodeRecord, LayoutNode, FloatingNodesInfo, SubtreeBounds, CanvasArrangerSettings, LayoutPosition } from './types';
import { CONSTANTS } from '../constants';
import { estimateTextNodeHeight, parseFloatingNodeInfo, getNodeIdFromEdgeEndpoint } from '../utils/canvas-utils';

/**
 * 过滤有效的浮动节点，只保留当前节点集合中存在的浮动节点
 * @param nodes 当前所有节点的映射
 * @param floatingNodes 浮动节点ID集合
 * @param originalParents 浮动节点的原始父节点映射
 * @returns 过滤后的浮动节点信息
 */
function filterValidFloatingNodes(
    nodes: Map<string, CanvasNodeLike>,
    floatingNodes: Set<string>,
    originalParents: Map<string, string>
): FloatingNodesInfo {
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
    
    return { floatingNodes: validFloatingNodes, originalParents: validOriginalParents };
}

/**
 * 计算子树的垂直边界范围
 * @param subtreeNodes 子树节点ID列表
 * @param layoutNodes 布局节点映射
 * @returns 子树的最小Y坐标和最大Y坐标
 */
function calculateSubtreeBounds(
    subtreeNodes: string[],
    layoutNodes: Map<string, LayoutNode>
): SubtreeBounds {
    let minY = Infinity;
    let maxY = -Infinity;
    
    for (const id of subtreeNodes) {
        const node = layoutNodes.get(id);
        if (!node) continue;
        minY = Math.min(minY, node.y);
        maxY = Math.max(maxY, node.y + node.height);
    }
    
    return { minY, maxY };
}

/**
 * 对子树所有节点应用垂直偏移
 * @param subtreeNodes 子树节点ID列表
 * @param layoutNodes 布局节点映射
 * @param offsetY 垂直偏移量
 * @returns 子树底部的最大Y坐标
 */
function applyVerticalOffset(
    subtreeNodes: string[],
    layoutNodes: Map<string, LayoutNode>,
    offsetY: number
): number {
    let maxBottom = -Infinity;
    
    for (const id of subtreeNodes) {
        const node = layoutNodes.get(id);
        if (!node) continue;
        node.y += offsetY;
        maxBottom = Math.max(maxBottom, node.y + node.height);
    }
    
    return maxBottom;
}

export const DEFAULT_ARRANGER_SETTINGS: CanvasArrangerSettings = {
    horizontalSpacing: CONSTANTS.LAYOUT.HORIZONTAL_SPACING,
    verticalSpacing: CONSTANTS.LAYOUT.VERTICAL_SPACING,
    textNodeWidth: CONSTANTS.LAYOUT.TEXT_NODE_WIDTH,
    textNodeMaxHeight: CONSTANTS.LAYOUT.TEXT_NODE_MAX_HEIGHT,
    imageNodeWidth: CONSTANTS.LAYOUT.IMAGE_NODE_WIDTH,
    imageNodeHeight: CONSTANTS.LAYOUT.IMAGE_NODE_HEIGHT,
    formulaNodeWidth: CONSTANTS.LAYOUT.FORMULA_NODE_WIDTH,
    formulaNodeHeight: CONSTANTS.LAYOUT.FORMULA_NODE_HEIGHT,
};

/**
 * 从边的端点获取节点ID
 * @param endpoint 边的端点，可能是字符串或对象
 * @returns 节点ID，如果无法解析则返回null
 */
function getFloatingNodesInfo(canvasData: CanvasDataLike | null | undefined): {
    floatingNodes: Set<string>,
    originalParents: Map<string, string>
} {
    const floatingNodes = new Set<string>();
    const originalParents = new Map<string, string>();

    if (canvasData?.metadata?.floatingNodes) {
        for (const [nodeId, info] of Object.entries(canvasData.metadata.floatingNodes)) {
            const { isFloating, originalParent } = parseFloatingNodeInfo(info as boolean | FloatingNodeRecord);
            if (isFloating) {
                floatingNodes.add(nodeId);
                if (originalParent) {
                    originalParents.set(nodeId, originalParent);
                }
            }
        }
    }

    if (canvasData?.nodes && Array.isArray(canvasData.nodes)) {
        for (const node of canvasData.nodes) {
            if (node.data?.isFloating && node.id) {
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
function collectFloatingSubtree(nodeId: string, childrenMap: Map<string, string[]>, floatingSubtree: Set<string>): void {
    if (floatingSubtree.has(nodeId)) return;
    
    floatingSubtree.add(nodeId);
    const children = childrenMap.get(nodeId) || [];
    for (const childId of children) {
        collectFloatingSubtree(childId, childrenMap, floatingSubtree);
    }
}

/**
 * 初始化布局节点，将Canvas节点转换为布局节点
 * @param nodes Canvas节点映射
 * @param settings 布局设置
 * @returns 布局节点映射
 */
function initializeLayoutNodes(
    nodes: Map<string, CanvasNodeLike>,
    settings: CanvasArrangerSettings
): Map<string, LayoutNode> {
    const layoutNodes = new Map<string, LayoutNode>();
    
    nodes.forEach((nodeData, nodeId) => {
        const nodeText = nodeData.text || '';
        const isFormula = nodeText && /^\$\$[\s\S]*?\$\$\s*(<!-- fromLink:[\s\S]*?-->)?\s*$/.test(nodeText.trim());

        let nodeHeight: number;
        if (isFormula) {
            nodeHeight = settings.formulaNodeHeight || CONSTANTS.LAYOUT.FORMULA_NODE_HEIGHT;
        } else {
            const currentWidth = nodeData.width || settings.textNodeWidth;
            const estimatedHeight = estimateTextNodeHeight(nodeText, currentWidth, settings.textNodeMaxHeight || CONSTANTS.LAYOUT.TEXT_NODE_MAX_HEIGHT);
            if (nodeData.height && nodeData.height > 0) {
                nodeHeight = Math.max(nodeData.height, estimatedHeight);
            } else {
                nodeHeight = estimatedHeight;
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
    
    return layoutNodes;
}

/**
 * 构建布局父子关系映射
 * @param edges 边列表
 * @param layoutNodes 布局节点映射
 * @returns 子节点到父节点的映射
 */
function buildLayoutParentMap(
    edges: CanvasEdgeLike[],
    layoutNodes: Map<string, LayoutNode>
): Map<string, string> {
    const layoutParentMap = new Map<string, string>();
    const processedEdges = new Set<string>();
    
    for (const edge of edges) {
        const fromId = getNodeIdFromEdgeEndpoint(edge.from);
        const toId = getNodeIdFromEdgeEndpoint(edge.to);

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
    
    return layoutParentMap;
}

/**
 * 构建完整的父子关系映射（包含所有边，用于浮动节点处理）
 * @param edges 边列表
 * @param nodesToCheck 需要检查的节点映射
 * @returns 完整的父子关系映射和子节点列表映射
 */
function buildCompleteParentMap(
    edges: CanvasEdgeLike[],
    nodesToCheck: Map<string, LayoutNode | CanvasNodeLike>
): { completeParentMap: Map<string, string>, completeChildrenMap: Map<string, string[]> } {
    const completeParentMap = new Map<string, string>();
    const completeChildrenMap = new Map<string, string[]>();
    
    for (const edge of edges) {
        let fromId = getNodeIdFromEdgeEndpoint(edge.from);
        let toId = getNodeIdFromEdgeEndpoint(edge.to);

        if (!fromId && edge.fromNode) fromId = edge.fromNode;
        if (!toId && edge.toNode) toId = edge.toNode;

        if (!fromId || !toId) continue;

        if (nodesToCheck.has(fromId) && nodesToCheck.has(toId)) {
            completeParentMap.set(toId, fromId);
            
            if (!completeChildrenMap.has(fromId)) {
                completeChildrenMap.set(fromId, []);
            }
            completeChildrenMap.get(fromId)!.push(toId);
        }
    }
    
    return { completeParentMap, completeChildrenMap };
}

function identifyFloatingSubtrees(
    floatingNodes: Set<string>,
    originalParents: Map<string, string>,
    completeParentMap: Map<string, string>,
    completeChildrenMap: Map<string, string[]>
): { floatingSubtreeRoots: Set<string>, floatingSubtreeOriginalParents: Map<string, string> } {
    const floatingSubtreeRoots = new Set<string>();
    const allFloatingSubtreeNodes = new Set<string>();
    const floatingSubtreeOriginalParents = new Map<string, string>();

    floatingNodes.forEach(nodeId => {
        if (!allFloatingSubtreeNodes.has(nodeId)) {
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
                collectFloatingSubtree(nodeId, completeChildrenMap, allFloatingSubtreeNodes);
                const originalParent = originalParents.get(nodeId);
                if (originalParent) {
                    floatingSubtreeOriginalParents.set(nodeId, originalParent);
                } else if (completeParentMap.has(nodeId)) {
                    floatingSubtreeOriginalParents.set(nodeId, completeParentMap.get(nodeId)!);
                }
            }
        }
    });
    
    return { floatingSubtreeRoots, floatingSubtreeOriginalParents };
}

function connectFloatingSubtrees(
    floatingSubtreeRoots: Set<string>,
    floatingSubtreeOriginalParents: Map<string, string>,
    layoutNodes: Map<string, LayoutNode>,
    layoutParentMap: Map<string, string>,
    completeChildrenMap: Map<string, string[]>
): void {
    floatingSubtreeRoots.forEach(rootId => {
        const parentId = floatingSubtreeOriginalParents.get(rootId);
        if (parentId) {
            const parentNode = layoutNodes.get(parentId);
            const childNode = layoutNodes.get(rootId);
            if (parentNode && childNode) {
                if (!parentNode.children.includes(rootId)) {
                    const originalChildren = completeChildrenMap.get(parentId) || [];
                    const rootIndex = originalChildren.indexOf(rootId);
                    
                    if (rootIndex !== -1) {
                        let inserted = false;
                        for (let i = 0; i < parentNode.children.length; i++) {
                            const currentChildId = parentNode.children[i];
                            if (!currentChildId) continue;
                            const currentChildOriginalIndex = originalChildren.indexOf(currentChildId);
                            
                            if (currentChildOriginalIndex > rootIndex) {
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
}

function findRootNodes(
    layoutNodes: Map<string, LayoutNode>,
    layoutParentMap: Map<string, string>
): string[] {
    const rootNodes: string[] = [];
    layoutNodes.forEach((_, id) => {
        if (!layoutParentMap.has(id)) {
            rootNodes.push(id);
        }
    });

    rootNodes.sort((a, b) => {
        const nodeA = layoutNodes.get(a);
        const nodeB = layoutNodes.get(b);
        if (!nodeA || !nodeB) return 0;
        return nodeA.y - nodeB.y || nodeA.x - nodeB.x;
    });
    
    return rootNodes;
}

function calculateMaxDepth(
    nodeId: string,
    layoutNodes: Map<string, LayoutNode>,
    nodeMaxDepth: Map<string, number>
): number {
    const node = layoutNodes.get(nodeId);
    if (!node || node.children.length === 0) {
        nodeMaxDepth.set(nodeId, 0);
        return 0;
    }
    
    let maxChildDepth = -1;
    for (const childId of node.children) {
        maxChildDepth = Math.max(maxChildDepth, calculateMaxDepth(childId, layoutNodes, nodeMaxDepth));
    }
    const depth = maxChildDepth + 1;
    nodeMaxDepth.set(nodeId, depth);
    return depth;
}

function calculateColumns(
    nodeId: string,
    parentColumn: number,
    layoutNodes: Map<string, LayoutNode>,
    nodeColumn: Map<string, number>,
    columnWidths: Map<number, number>,
    nodeMaxDepth: Map<string, number>,
    maxOverallDepth: number,
    settings: CanvasArrangerSettings
): void {
    const node = layoutNodes.get(nodeId);
    if (!node) return;

    let column: number;
    if (parentColumn === -1) {
        column = maxOverallDepth - (nodeMaxDepth.get(nodeId) || 0);
    } else {
        column = parentColumn + 1;
    }

    nodeColumn.set(nodeId, column);
    
    const currentWidth = columnWidths.get(column) || 0;
    columnWidths.set(column, Math.max(currentWidth, node.width));

    for (const childId of node.children) {
        calculateColumns(childId, column, layoutNodes, nodeColumn, columnWidths, nodeMaxDepth, maxOverallDepth, settings);
    }
}

function calculatePositionsRightToLeft(
    nodeId: string,
    layoutNodes: Map<string, LayoutNode>,
    settings: CanvasArrangerSettings
): { minY: number, maxY: number, centerY: number } {
    const node = layoutNodes.get(nodeId);
    if (!node) return { minY: 0, maxY: 0, centerY: 0 };

    if (node.children.length === 0) {
        node.y = 0;
        return { minY: 0, maxY: node.height, centerY: node.height / 2 };
    }

    let childrenMinY = Infinity;
    let childrenMaxY = -Infinity;
    let currentY = 0;

    const childRanges: { id: string, minY: number, maxY: number, centerY: number }[] = [];

    for (const childId of node.children) {
        const range = calculatePositionsRightToLeft(childId, layoutNodes, settings);
        childRanges.push({ id: childId, ...range });
    }

    currentY = 0;
    for (let i = 0; i < childRanges.length; i++) {
        const range = childRanges[i];
        if (!range) continue;
        
        const childNodeId = range.id;
        
        const offset = currentY - range.minY;
        const subtreeStack = [childNodeId];
        while (subtreeStack.length > 0) {
            const sid = subtreeStack.pop();
            if (!sid) continue;
            const snode = layoutNodes.get(sid);
            if (!snode) continue;
            snode.y += offset;
            subtreeStack.push(...snode.children);
        }

        childrenMinY = Math.min(childrenMinY, currentY);
        childrenMaxY = Math.max(childrenMaxY, currentY + (range.maxY - range.minY));
        
        currentY += (range.maxY - range.minY) + settings.verticalSpacing;
    }

    let sumCenters = 0;
    let centerCount = 0;
    for (const range of childRanges) {
        const childNode = layoutNodes.get(range.id);
        if (childNode) {
            sumCenters += childNode.y + childNode.height / 2;
            centerCount++;
        }
    }
    const childrenCenterY = centerCount > 0 ? sumCenters / centerCount : (childrenMinY + childrenMaxY) / 2;
    node.y = childrenCenterY - (node.height / 2);

    const totalMinY = Math.min(node.y, childrenMinY);
    const totalMaxY = Math.max(node.y + node.height, childrenMaxY);
    
    return { 
        minY: totalMinY, 
        maxY: totalMaxY, 
        centerY: node.y + node.height / 2
    };
}

function collectSubtreeNodes(
    rootId: string,
    layoutNodes: Map<string, LayoutNode>
): string[] {
    const subtreeNodes: string[] = [];
    const stack = [rootId];
    const visited = new Set<string>();
    
    while (stack.length > 0) {
        const id = stack.pop()!;
        if (visited.has(id)) continue;
        visited.add(id);
        
        subtreeNodes.push(id);
        const node = layoutNodes.get(id);
        if (node) {
            for (let i = node.children.length - 1; i >= 0; i--) {
                const childId = node.children[i];
                if (childId) stack.push(childId);
            }
        }
    }
    
    return subtreeNodes;
}

/**
 * 计算每列的X坐标位置
 * @param columnWidths 每列的宽度映射
 * @param settings 布局设置
 * @returns 每列的X坐标映射
 */
function calculateColumnX(
    columnWidths: Map<number, number>,
    settings: CanvasArrangerSettings
): Map<number, number> {
    const columnX = new Map<number, number>();
    let currentX = 0;
    const sortedColumns = Array.from(columnWidths.keys()).sort((a, b) => a - b);
    
    for (const col of sortedColumns) {
        columnX.set(col, currentX);
        const width = columnWidths.get(col) || settings.textNodeWidth;
        currentX += width + settings.horizontalSpacing;
    }
    
    return columnX;
}

/**
 * 执行Canvas布局算法
 * 从右到左布局节点，处理浮动节点和折叠节点
 * 
 * @param nodes 需要布局的节点映射（通常是可见节点）
 * @param edges 可见边列表
 * @param settings 布局设置参数
 * @param originalEdges 所有边列表（包含隐藏边），用于浮动节点处理
 * @param allNodes 所有节点映射（包含隐藏节点），用于浮动节点处理
 * @param canvasData Canvas数据对象，包含浮动节点元数据
 * @returns 每个节点的布局位置（x, y, width, height）
 */
export function arrangeLayout(
    nodes: Map<string, CanvasNodeLike>,
    edges: CanvasEdgeLike[],
    settings: CanvasArrangerSettings,
    originalEdges?: CanvasEdgeLike[],
    allNodes?: Map<string, CanvasNodeLike>,
    canvasData?: CanvasDataLike
): Map<string, LayoutPosition> {
    log(`[Layout] 开始: ${nodes.size} 节点, ${edges.length} 边`);

    const floatingInfo = getFloatingNodesInfo(canvasData);
    const { floatingNodes, originalParents } = filterValidFloatingNodes(
        nodes, floatingInfo.floatingNodes, floatingInfo.originalParents
    );

    const layoutNodes = initializeLayoutNodes(nodes, settings);
    const layoutParentMap = buildLayoutParentMap(edges, layoutNodes);

    const edgesForCompleteMap = originalEdges && originalEdges.length > 0 ? originalEdges : edges;
    const nodesToCheck = allNodes || layoutNodes;
    const { completeParentMap, completeChildrenMap } = buildCompleteParentMap(edgesForCompleteMap, nodesToCheck as Map<string, LayoutNode | CanvasNodeLike>);

    const { floatingSubtreeRoots, floatingSubtreeOriginalParents } = identifyFloatingSubtrees(
        floatingNodes, originalParents, completeParentMap, completeChildrenMap
    );

    connectFloatingSubtrees(floatingSubtreeRoots, floatingSubtreeOriginalParents, layoutNodes, layoutParentMap, completeChildrenMap);

    const rootNodes = findRootNodes(layoutNodes, layoutParentMap);

    if (rootNodes.length > 0) {
        log(`[Layout] 根: ${rootNodes.length}${floatingSubtreeRoots.size > 0 ? ' (浮动: ' + floatingSubtreeRoots.size + ')' : ''}`);
    }

    const nodeColumn = new Map<string, number>();
    const columnWidths = new Map<number, number>();
    const nodeMaxDepth = new Map<string, number>();

    let maxOverallDepth = 0;
    for (const rootId of rootNodes) {
        maxOverallDepth = Math.max(maxOverallDepth, calculateMaxDepth(rootId, layoutNodes, nodeMaxDepth));
    }

    let currentGlobalBottomY = -settings.verticalSpacing;

    for (const rootId of rootNodes) {
        calculateColumns(rootId, -1, layoutNodes, nodeColumn, columnWidths, nodeMaxDepth, maxOverallDepth, settings);
        
        calculatePositionsRightToLeft(rootId, layoutNodes, settings);

        const subtreeNodes = collectSubtreeNodes(rootId, layoutNodes);
        const { minY: subtreeMinY } = calculateSubtreeBounds(subtreeNodes, layoutNodes);
        
        const verticalSpacing = currentGlobalBottomY === -settings.verticalSpacing ? 0 : settings.verticalSpacing;
        const globalOffsetY = (currentGlobalBottomY + verticalSpacing) - subtreeMinY;

        currentGlobalBottomY = applyVerticalOffset(subtreeNodes, layoutNodes, globalOffsetY);
    }

    const columnX = calculateColumnX(columnWidths, settings);

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
