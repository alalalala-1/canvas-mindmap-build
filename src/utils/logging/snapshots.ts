import type { ItemView } from 'obsidian';
import type { CanvasLike, CanvasNodeLike, CanvasEdgeLike } from '../../canvas/types';
import type { LogReportSnapshot } from './types';

function getNodeId(node: CanvasNodeLike | null | undefined): string | null {
    return typeof node?.id === 'string' ? node.id : null;
}

function getEdgeId(edge: CanvasEdgeLike | null | undefined): string | null {
    if (!edge) return null;
    if (typeof edge.id === 'string' && edge.id.length > 0) return edge.id;
    const fromId = typeof edge.fromNode === 'string'
        ? edge.fromNode
        : typeof edge.from === 'string'
            ? edge.from
            : edge.from?.nodeId || edge.from?.node?.id;
    const toId = typeof edge.toNode === 'string'
        ? edge.toNode
        : typeof edge.to === 'string'
            ? edge.to
            : edge.to?.nodeId || edge.to?.node?.id;
    return fromId && toId ? `${fromId}->${toId}` : null;
}

function getCanvasNodeCount(canvas: CanvasLike | null | undefined): number {
    if (!canvas?.nodes) return 0;
    if (canvas.nodes instanceof Map) return canvas.nodes.size;
    return Object.keys(canvas.nodes).length;
}

function getCanvasEdgeCount(canvas: CanvasLike | null | undefined): number {
    if (!canvas?.edges) return 0;
    if (canvas.edges instanceof Map) return canvas.edges.size;
    return canvas.edges.length;
}

function collectSelectionEntries(canvas: CanvasLike | null | undefined): {
    nodeIds: string[];
    edgeIds: string[];
} {
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();

    if (!canvas) {
        return { nodeIds: [], edgeIds: [] };
    }

    if (canvas.selection instanceof Set) {
        for (const entry of canvas.selection) {
            const nodeId = getNodeId(entry as CanvasNodeLike);
            if (nodeId) {
                nodeIds.add(nodeId);
                continue;
            }

            const edgeId = getEdgeId(entry as CanvasEdgeLike);
            if (edgeId) edgeIds.add(edgeId);
        }
    }

    for (const node of canvas.selectedNodes || []) {
        const nodeId = getNodeId(node);
        if (nodeId) nodeIds.add(nodeId);
    }

    const activeEdgeId = getEdgeId(canvas.selectedEdge);
    if (activeEdgeId) edgeIds.add(activeEdgeId);

    for (const edge of canvas.selectedEdges || []) {
        const edgeId = getEdgeId(edge);
        if (edgeId) edgeIds.add(edgeId);
    }

    return {
        nodeIds: Array.from(nodeIds),
        edgeIds: Array.from(edgeIds)
    };
}

export function snapshotCanvasRuntime(canvas: CanvasLike | null | undefined): Record<string, unknown> {
    const selection = collectSelectionEntries(canvas);
    return {
        available: !!canvas,
        filePath: canvas?.file?.path || 'none',
        nodeCount: getCanvasNodeCount(canvas),
        edgeCount: getCanvasEdgeCount(canvas),
        selectionNodeIds: selection.nodeIds,
        selectionEdgeIds: selection.edgeIds,
        hasRequestUpdate: typeof canvas?.requestUpdate === 'function',
        hasRequestSave: typeof canvas?.requestSave === 'function',
        hasZoomToBbox: typeof canvas?.zoomToBbox === 'function',
        zoom: typeof canvas?.zoom === 'number' ? canvas.zoom : 'na',
        offsetX: typeof canvas?.x === 'number' ? canvas.x : 'na',
        offsetY: typeof canvas?.y === 'number' ? canvas.y : 'na'
    };
}

export function snapshotViewportState(): Record<string, unknown> {
    if (typeof window === 'undefined') {
        return { available: false };
    }

    const vv = window.visualViewport;
    return {
        available: true,
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
        orientation: window.innerHeight >= window.innerWidth ? 'portrait' : 'landscape',
        visualViewport: vv
            ? {
                width: vv.width,
                height: vv.height,
                scale: vv.scale,
                offsetTop: vv.offsetTop,
                offsetLeft: vv.offsetLeft,
            }
            : 'none'
    };
}

export function snapshotViewState(view: ItemView | null | undefined): Record<string, unknown> {
    if (!view) {
        return { available: false };
    }

    const viewRecord = view as ItemView & {
        file?: { path?: string };
        canvas?: CanvasLike;
    };

    return {
        available: true,
        viewType: typeof view.getViewType === 'function' ? view.getViewType() : 'unknown',
        filePath: viewRecord.canvas?.file?.path || viewRecord.file?.path || 'none',
        hasCanvas: !!viewRecord.canvas,
    };
}

export function makeSnapshot(label: string, data: Record<string, unknown>): LogReportSnapshot {
    return { label, data };
}