import { log } from '../../utils/logger';
import { CanvasMindmapBuildSettings } from '../../settings/types';
import { CanvasDataLike, CanvasEdgeLike, CanvasNodeLike } from '../types';
import { getEdgeFromNodeId, getEdgeToNodeId } from '../../utils/canvas-utils';

export class NodePositionCalculator {
    constructor(private settings: CanvasMindmapBuildSettings) {}

    private getNumber(value: unknown, fallback: number): number {
        return typeof value === 'number' && !Number.isNaN(value) ? value : fallback;
    }

    private getNodes(canvasData: CanvasDataLike): CanvasNodeLike[] {
        return Array.isArray(canvasData.nodes) ? canvasData.nodes : [];
    }

    private getEdges(canvasData: CanvasDataLike): CanvasEdgeLike[] {
        return Array.isArray(canvasData.edges) ? canvasData.edges : [];
    }

    calculatePosition(
        newNode: CanvasNodeLike,
        parentNode: CanvasNodeLike | null,
        canvasData: CanvasDataLike
    ): { x: number; y: number } {
        if (!parentNode) {
            return { x: 0, y: 0 };
        }

        const horizontalSpacing = this.settings.horizontalSpacing || 200;
        const verticalSpacing = this.settings.verticalSpacing || 40;

        const parentY = this.getNumber(parentNode.y, 0);
        const parentHeight = this.getNumber(parentNode.height, 100);
        const parentCenterY = parentY + parentHeight / 2;
        const newNodeHeight = this.getNumber(newNode.height, 100);
        const baseY = parentCenterY - newNodeHeight / 2;

        const parentId = parentNode.id || '';
        const edges = this.getEdges(canvasData);
        const childNodeIds = edges
            .map((edge) => {
                const fromId = getEdgeFromNodeId(edge);
                if (fromId !== parentId) return null;
                return getEdgeToNodeId(edge);
            })
            .filter((id): id is string => typeof id === 'string');

        const childNodes = this.getNodes(canvasData).filter((node) => node.id && childNodeIds.includes(node.id));

        log(`[PositionCalculator] 父节点 ${parentId} 已有 ${childNodes.length} 个子节点`);

        if (childNodes.length === 0) {
            const parentX = this.getNumber(parentNode.x, 0);
            const parentWidth = this.getNumber(parentNode.width, 250);
            return {
                x: parentX + parentWidth + horizontalSpacing,
                y: baseY,
            };
        }

        childNodes.sort((a, b) => this.getNumber(a.y, 0) - this.getNumber(b.y, 0));

        const lastChild = childNodes[childNodes.length - 1];
        const lastChildY = this.getNumber(lastChild?.y, 0);
        const lastChildHeight = this.getNumber(lastChild?.height, 100);
        const nextY = lastChildY + lastChildHeight + verticalSpacing;

        const parentX = this.getNumber(parentNode.x, 0);
        const parentWidth = this.getNumber(parentNode.width, 250);

        log(`[PositionCalculator] 计算新节点位置: parent.x=${parentX}, nextY=${nextY}`);

        return {
            x: parentX + parentWidth + horizontalSpacing,
            y: nextY,
        };
    }

    calculateFloatingPosition(canvasData: CanvasDataLike): { x: number; y: number } {
        const nodes = this.getNodes(canvasData);
        if (nodes.length === 0) return { x: 100, y: 100 };

        let maxX = -Infinity;
        let maxY = -Infinity;

        nodes.forEach((node) => {
            const nodeX = this.getNumber(node.x, 0);
            const nodeWidth = this.getNumber(node.width, 250);
            const nodeY = this.getNumber(node.y, 0);
            maxX = Math.max(maxX, nodeX + nodeWidth);
            maxY = Math.max(maxY, nodeY);
        });

        log(`[PositionCalculator] 计算浮动节点位置: maxX=${maxX}, maxY=${maxY}`);

        return {
            x: maxX + 100,
            y: 100,
        };
    }
}
