/**
 * Canvas 数据提取工具类
 * 统一处理 Canvas 数据的获取逻辑
 */

import { Canvas, CanvasNode, CanvasEdge } from '../canvas/types';
import { CanvasMindmapBuildSettings } from '../settings/types';

export class CanvasDataExtractor {
    /**
     * 从 Canvas 对象获取边列表
     */
    static getEdges(canvas: Canvas | undefined | null): CanvasEdge[] {
        if (!canvas) return [];
        if (canvas.fileData?.edges) return canvas.fileData.edges;
        if (canvas.edges) return Array.from(canvas.edges.values());
        return [];
    }

    /**
     * 从 Canvas 对象获取节点列表
     */
    static getNodes(canvas: Canvas | undefined | null): CanvasNode[] {
        if (!canvas) return [];
        if (canvas.fileData?.nodes) return canvas.fileData.nodes;
        if (canvas.nodes) return Array.from(canvas.nodes.values());
        return [];
    }

    /**
     * 获取 Canvas 文件路径
     */
    static getCanvasFilePath(
        canvas: Canvas | undefined | null,
        settings: CanvasMindmapBuildSettings
    ): string | undefined {
        // 优先从 canvas 对象获取
        if (canvas?.file?.path) {
            return canvas.file.path;
        }

        // 从设置中获取
        if (settings.canvasFilePath) {
            return settings.canvasFilePath;
        }

        return undefined;
    }

    /**
     * 根据 ID 获取节点
     */
    static getNodeById(
        canvas: Canvas | undefined | null,
        nodeId: string
    ): CanvasNode | undefined {
        if (!canvas || !nodeId) return undefined;

        // 优先从 Map 获取
        if (canvas.nodes?.has(nodeId)) {
            return canvas.nodes.get(nodeId);
        }

        // 从数组中查找
        const nodes = this.getNodes(canvas);
        return nodes.find(n => n.id === nodeId);
    }

    /**
     * 根据 ID 获取边
     */
    static getEdgeById(
        canvas: Canvas | undefined | null,
        edgeId: string
    ): CanvasEdge | undefined {
        if (!canvas || !edgeId) return undefined;

        // 优先从 Map 获取
        if (canvas.edges?.has(edgeId)) {
            return canvas.edges.get(edgeId);
        }

        // 从数组中查找
        const edges = this.getEdges(canvas);
        return edges.find(e => e.id === edgeId);
    }

    /**
     * 获取节点的子节点列表
     */
    static getChildNodes(
        canvas: Canvas | undefined | null,
        nodeId: string
    ): CanvasNode[] {
        if (!canvas || !nodeId) return [];

        const edges = this.getEdges(canvas);
        const childEdges = edges.filter(e => e.fromNode === nodeId);
        const childIds = childEdges.map(e => e.toNode);

        const allNodes = this.getNodes(canvas);
        return allNodes.filter(n => childIds.includes(n.id));
    }

    /**
     * 获取节点的父节点列表
     */
    static getParentNodes(
        canvas: Canvas | undefined | null,
        nodeId: string
    ): CanvasNode[] {
        if (!canvas || !nodeId) return [];

        const edges = this.getEdges(canvas);
        const parentEdges = edges.filter(e => e.toNode === nodeId);
        const parentIds = parentEdges.map(e => e.fromNode);

        const allNodes = this.getNodes(canvas);
        return allNodes.filter(n => parentIds.includes(n.id));
    }
}
