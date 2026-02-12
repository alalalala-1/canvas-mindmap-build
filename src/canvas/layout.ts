import { log } from '../utils/logger';
import { CanvasNodeLike, CanvasEdgeLike, CanvasDataLike, FloatingNodeRecord, EdgeEndpoint } from './types';
import { CONSTANTS } from '../constants';

interface LayoutNode {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    children: string[];
    _subtreeHeight: number;
    originalParent?: string;
}

interface LayoutEdge {
    fromNode: string;
    toNode: string;
}

interface LayoutContext {
    layoutNodes: Map<string, LayoutNode>;
    layoutParentMap: Map<string, string>;
    completeParentMap: Map<string, string>;
    completeChildrenMap: Map<string, string[]>;
    floatingSubtreeRoots: Set<string>;
    floatingSubtreeOriginalParents: Map<string, string>;
    rootNodes: string[];
    nodeColumn: Map<string, number>;
    columnWidths: Map<number, number>;
    nodeMaxDepth: Map<string, number>;
    maxOverallDepth: number;
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

function getNodeIdFromEndpoint(endpoint: EdgeEndpoint | undefined | null): string | null {
    if (!endpoint) return null;
    if (typeof endpoint === 'string') return endpoint;
    if (typeof endpoint.nodeId === 'string') return endpoint.nodeId;
    if (endpoint.node && typeof endpoint.node.id === 'string') return endpoint.node.id;
    return null;
}

function getFloatingNodesInfo(canvasData: CanvasDataLike | null | undefined): {
    floatingNodes: Set<string>,
    originalParents: Map<string, string>
} {
    const floatingNodes = new Set<string>();
    const originalParents = new Map<string, string>();

    if (canvasData?.metadata?.floatingNodes) {
        for (const [nodeId, info] of Object.entries(canvasData.metadata.floatingNodes)) {
            if (typeof info === 'boolean' && info === true) {
                floatingNodes.add(nodeId);
            } else if (typeof info === 'object' && info !== null) {
                const nodeInfo = info as FloatingNodeRecord;
                if (nodeInfo.isFloating) {
                    floatingNodes.add(nodeId);
                    if (nodeInfo.originalParent) {
                        originalParents.set(nodeId, nodeInfo.originalParent);
                    }
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
    const fontSize = CONSTANTS.TYPOGRAPHY.FONT_SIZE;
    const lineHeight = CONSTANTS.TYPOGRAPHY.LINE_HEIGHT;
    
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

    const calculatedHeight = Math.ceil(totalLines * lineHeight + CONSTANTS.TYPOGRAPHY.SAFETY_PADDING);
    return Math.max(CONSTANTS.TYPOGRAPHY.MIN_NODE_HEIGHT, Math.min(calculatedHeight, maxHeight));
}

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
            nodeHeight = settings.formulaNodeHeight || 80;
        } else {
            const currentWidth = nodeData.width || settings.textNodeWidth;
            const estimatedHeight = estimateTextNodeHeight(nodeText, currentWidth, settings);
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

function buildLayoutParentMap(
    edges: CanvasEdgeLike[],
    layoutNodes: Map<string, LayoutNode>
): Map<string, string> {
    const layoutParentMap = new Map<string, string>();
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
            layoutParentMap.set(toId, fromId);
        }
    }
    
    return layoutParentMap;
}

function buildCompleteParentMap(
    edges: CanvasEdgeLike[],
    nodesToCheck: Map<string, LayoutNode | CanvasNodeLike>
): { completeParentMap: Map<string, string>, completeChildrenMap: Map<string, string[]> } {
    const completeParentMap = new Map<string, string>();
    const completeChildrenMap = new Map<string, string[]>();
    
    for (const edge of edges) {
        let fromId = getNodeIdFromEndpoint(edge.from);
        let toId = getNodeIdFromEndpoint(edge.to);

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
        const nodeA = layoutNodes.get(a)!;
        const nodeB = layoutNodes.get(b)!;
        return nodeA.y - nodeB.y || nodeA.x - nodeB.x;
    });
    
    return rootNodes;
}

function calculateSubtreeHeight(
    nodeId: string,
    layoutNodes: Map<string, LayoutNode>,
    settings: CanvasArrangerSettings
): number {
    const node = layoutNodes.get(nodeId);
    if (!node) return 0;

    if (node.children.length === 0) {
        node._subtreeHeight = node.height;
        return node.height;
    }

    let childrenTotalHeight = 0;
    for (const childId of node.children) {
        childrenTotalHeight += calculateSubtreeHeight(childId, layoutNodes, settings);
    }
    childrenTotalHeight += Math.max(0, node.children.length - 1) * settings.verticalSpacing;

    node._subtreeHeight = Math.max(node.height, childrenTotalHeight);
    return node._subtreeHeight;
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
            const sid = subtreeStack.pop()!;
            const snode = layoutNodes.get(sid)!;
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

export function arrangeLayout(
    nodes: Map<string, CanvasNodeLike>,
    edges: CanvasEdgeLike[],
    settings: CanvasArrangerSettings,
    originalEdges?: CanvasEdgeLike[],
    allNodes?: Map<string, CanvasNodeLike>,
    canvasData?: CanvasDataLike
): Map<string, { x: number; y: number; width: number; height: number }> {
    log(`[Layout] 开始: ${nodes.size} 节点, ${edges.length} 边`);

    let { floatingNodes, originalParents } = getFloatingNodesInfo(canvasData);

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

        let subtreeMinY = Infinity;
        let subtreeMaxY = -Infinity;
        for (const id of subtreeNodes) {
            const node = layoutNodes.get(id)!;
            subtreeMinY = Math.min(subtreeMinY, node.y);
            subtreeMaxY = Math.max(subtreeMaxY, node.y + node.height);
        }
        
        const verticalSpacing = currentGlobalBottomY === -settings.verticalSpacing ? 0 : settings.verticalSpacing;
        const globalOffsetY = (currentGlobalBottomY + verticalSpacing) - subtreeMinY;

        let maxSubtreeBottom = -Infinity;
        for (const id of subtreeNodes) {
            const node = layoutNodes.get(id)!;
            node.y += globalOffsetY;
            maxSubtreeBottom = Math.max(maxSubtreeBottom, node.y + node.height);
        }

        currentGlobalBottomY = maxSubtreeBottom;
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
