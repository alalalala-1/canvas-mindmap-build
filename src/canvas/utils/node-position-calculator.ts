import { log } from '../../utils/logger';

export class NodePositionCalculator {
    constructor(private settings: any) {}

    calculatePosition(
        newNode: any,
        parentNode: any | null,
        canvasData: any
    ): { x: number; y: number } {
        if (!parentNode) {
            return { x: 0, y: 0 };
        }

        const horizontalSpacing = this.settings.horizontalSpacing || 200;
        const verticalSpacing = this.settings.verticalSpacing || 40;

        const parentCenterY = parentNode.y + (parentNode.height || 100) / 2;
        const newNodeHeight = newNode.height || 100;
        const baseY = parentCenterY - newNodeHeight / 2;

        // 获取父节点的所有子节点
        const edges = canvasData.edges || [];
        const childNodeIds = edges
            .filter((e: any) => (e.fromNode || e.from?.node?.id) === parentNode.id)
            .map((e: any) => e.toNode || e.to?.node?.id);

        const childNodes = (canvasData.nodes || []).filter((n: any) =>
            childNodeIds.includes(n.id)
        );

        log(`[PositionCalculator] 父节点 ${parentNode.id} 已有 ${childNodes.length} 个子节点`);

        if (childNodes.length === 0) {
            return {
                x: parentNode.x + (parentNode.width || 250) + horizontalSpacing,
                y: baseY,
            };
        }

        // 按 y 坐标排序
        childNodes.sort((a: any, b: any) => a.y - b.y);

        // 找到中间位置
        const midIndex = Math.floor(childNodes.length / 2);
        const midNode = childNodes[midIndex];

        // 简单的放置策略：放在最下面一个子节点的下方
        const lastChild = childNodes[childNodes.length - 1];
        const nextY = lastChild.y + (lastChild.height || 100) + verticalSpacing;

        log(`[PositionCalculator] 计算新节点位置: parent.x=${parentNode.x}, nextY=${nextY}`);

        return {
            x: parentNode.x + (parentNode.width || 250) + horizontalSpacing,
            y: nextY,
        };
    }

    calculateFloatingPosition(canvasData: any): { x: number; y: number } {
        const nodes = canvasData.nodes || [];
        if (nodes.length === 0) return { x: 100, y: 100 };

        // 找到最右侧的节点
        let maxX = -Infinity;
        let maxY = -Infinity;

        nodes.forEach((node: any) => {
            maxX = Math.max(maxX, node.x + (node.width || 250));
            maxY = Math.max(maxY, node.y);
        });

        log(`[PositionCalculator] 计算浮动节点位置: maxX=${maxX}, maxY=${maxY}`);

        return {
            x: maxX + 100,
            y: 100,
        };
    }
}
