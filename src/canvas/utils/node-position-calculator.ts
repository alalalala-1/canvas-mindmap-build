import { CanvasMindmapBuildSettings } from '../../settings/types';
import { debug } from '../../utils/logger';

/**
 * 节点位置计算器
 * 负责计算新节点的位置
 */
export class NodePositionCalculator {
    private settings: CanvasMindmapBuildSettings;

    constructor(settings: CanvasMindmapBuildSettings) {
        this.settings = settings;
    }

    /**
     * 计算新节点位置（在父节点右侧，与同级别节点对齐，避免重叠）
     */
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

        debug(`父节点 ${parentNode.id} 已有 ${childNodes.length} 个子节点`);

        // 计算 x 坐标：与同级别节点对齐
        // 如果有已有子节点，使用它们的 x 坐标；否则基于父节点计算
        let baseX: number;
        if (childNodes.length > 0) {
            // 使用已有子节点的 x 坐标（取最小值，确保对齐）
            baseX = Math.min(...childNodes.map((child: any) => child.x));
            debug(`使用已有子节点的 x 坐标: ${baseX}`);
        } else {
            // 没有子节点时，基于父节点计算
            baseX = parentNode.x + (parentNode.width || 250) + horizontalSpacing;
            debug(`使用基础位置 x: ${baseX}，水平间距: ${horizontalSpacing}`);
        }

        // 如果没有子节点，使用基础 y 位置
        if (childNodes.length === 0) {
            debug(`使用基础位置: (${baseX}, ${baseY})`);
            return { x: baseX, y: baseY };
        }

        // 找到最下方的子节点
        let lowestChild = childNodes[0];
        let maxBottom = childNodes[0].y + (childNodes[0].height || 100);

        for (const child of childNodes) {
            const childBottom = child.y + (child.height || 100);
            if (childBottom > maxBottom) {
                maxBottom = childBottom;
                lowestChild = child;
            }
        }

        // 新节点放在最下方子节点的下方
        const newY = maxBottom + verticalSpacing;
        debug(
            `新节点将放在最下方子节点 ${lowestChild.id} 的下方，Y: ${newY}，垂直间距: ${verticalSpacing}`
        );

        return { x: baseX, y: newY };
    }
}
