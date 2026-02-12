import { log } from '../../utils/logger';
import { CanvasMindmapBuildSettings } from '../../settings/types';

type NodeLike = {
    id?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
};

type EdgeLike = {
    fromNode?: string;
    toNode?: string;
    from?: unknown;
    to?: unknown;
};

type CanvasDataLike = {
    nodes?: unknown;
    edges?: unknown;
};

export class NodePositionCalculator {
    constructor(private settings: CanvasMindmapBuildSettings) {}

    private getNumber(value: unknown, fallback: number): number {
        return typeof value === 'number' && !Number.isNaN(value) ? value : fallback;
    }

    private getNodeIdFromEdgeEndpoint(endpoint: unknown): string | null {
        if (!endpoint) return null;
        if (typeof endpoint === 'string') return endpoint;
        if (typeof endpoint === 'object') {
            const endpointObj = endpoint as { nodeId?: unknown; node?: { id?: unknown } };
            if (typeof endpointObj.nodeId === 'string') return endpointObj.nodeId;
            if (endpointObj.node && typeof endpointObj.node.id === 'string') return endpointObj.node.id;
        }
        return null;
    }

    private getEdgeFromId(edge: EdgeLike): string | null {
        if (edge.fromNode) return edge.fromNode;
        return this.getNodeIdFromEdgeEndpoint(edge.from);
    }

    private getEdgeToId(edge: EdgeLike): string | null {
        if (edge.toNode) return edge.toNode;
        return this.getNodeIdFromEdgeEndpoint(edge.to);
    }

    private getNodes(canvasData: CanvasDataLike): NodeLike[] {
        return Array.isArray(canvasData.nodes) ? (canvasData.nodes as NodeLike[]) : [];
    }

    private getEdges(canvasData: CanvasDataLike): EdgeLike[] {
        return Array.isArray(canvasData.edges) ? (canvasData.edges as EdgeLike[]) : [];
    }

    calculatePosition(
        newNode: NodeLike,
        parentNode: NodeLike | null,
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
                const fromId = this.getEdgeFromId(edge);
                if (fromId !== parentId) return null;
                return this.getEdgeToId(edge);
            })
            .filter((id): id is string => typeof id === 'string');

        const childNodes = this.getNodes(canvasData).filter((node) =>
            node.id && childNodeIds.includes(node.id)
        );

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
