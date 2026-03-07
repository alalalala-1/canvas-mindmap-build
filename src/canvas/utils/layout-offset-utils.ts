import { CanvasNodeLike, LayoutPosition } from '../types';

/**
 * 布局偏移工具函数
 * 用于在 arrage 过程中计算和应用位置偏移，保持布局稳定性
 */

/**
 * 计算布局偏移量（对齐到当前内存节点位置）
 * 用于当前视图的 anchor offset
 * @param anchorNodeId 锚点节点 ID
 * @param currentNodes 当前节点映射
 * @param layoutResult 布局结果
 * @returns 偏移量 { offsetX, offsetY }
 */
export function calculateLayoutOffset(
    anchorNodeId: string,
    currentNodes: Map<string, CanvasNodeLike>,
    layoutResult: Map<string, LayoutPosition>
): { offsetX: number; offsetY: number } {
    const currentNode = currentNodes.get(anchorNodeId);
    const layoutNode = layoutResult.get(anchorNodeId);

    if (!currentNode || !layoutNode) {
        return { offsetX: 0, offsetY: 0 };
    }

    const currentX = typeof currentNode.x === 'number' ? currentNode.x : 0;
    const currentY = typeof currentNode.y === 'number' ? currentNode.y : 0;

    return {
        offsetX: currentX - layoutNode.x,
        offsetY: currentY - layoutNode.y,
    };
}

/**
 * 计算布局偏移量（对齐到参考结果中的位置）
 * 用于隐藏子树修复时，对齐到 finalResult 中已确定的位置
 * @param anchorNodeId 锚点节点 ID
 * @param referenceResult 参考结果（例如 finalResult）
 * @param layoutResult 布局结果
 * @returns 偏移量 { offsetX, offsetY }
 */
export function calculateLayoutOffsetFromReference(
    anchorNodeId: string,
    referenceResult: Map<string, LayoutPosition>,
    layoutResult: Map<string, LayoutPosition>
): { offsetX: number; offsetY: number } {
    const referenceNode = referenceResult.get(anchorNodeId);
    const layoutNode = layoutResult.get(anchorNodeId);

    if (!referenceNode || !layoutNode) {
        return { offsetX: 0, offsetY: 0 };
    }

    return {
        offsetX: referenceNode.x - layoutNode.x,
        offsetY: referenceNode.y - layoutNode.y,
    };
}

/**
 * 将偏移量应用到布局结果
 * @param layoutResult 原始布局结果
 * @param offsetX X 轴偏移
 * @param offsetY Y 轴偏移
 * @returns 应用偏移后的新布局结果
 */
export function applyOffsetToLayoutResult(
    layoutResult: Map<string, LayoutPosition>,
    offsetX: number,
    offsetY: number
): Map<string, LayoutPosition> {
    const shifted = new Map<string, LayoutPosition>();

    for (const [nodeId, pos] of layoutResult.entries()) {
        shifted.set(nodeId, {
            ...pos,
            x: pos.x + offsetX,
            y: pos.y + offsetY,
        });
    }

    return shifted;
}
