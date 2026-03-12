import { CanvasEdgeLike, CanvasLike } from '../types';

function getNodeIdFromEdgeEndpoint(endpoint: unknown): string | null {
    if (!endpoint) return null;
    if (typeof endpoint === 'string') return endpoint;
    if (typeof (endpoint as { nodeId?: unknown }).nodeId === 'string') {
        return (endpoint as { nodeId: string }).nodeId;
    }
    const nodeId = (endpoint as { node?: { id?: unknown } }).node?.id;
    return typeof nodeId === 'string' ? nodeId : null;
}

function getEdgeKey(edge: CanvasEdgeLike | null | undefined): string | null {
    if (!edge) return null;
    const fromId = edge.fromNode || getNodeIdFromEdgeEndpoint(edge.from);
    const toId = edge.toNode || getNodeIdFromEdgeEndpoint(edge.to);
    if (fromId && toId) return `${fromId}->${toId}`;
    return edge.id || null;
}

function isEdgeSelectionEntry(value: unknown): value is CanvasEdgeLike {
    if (!value || typeof value !== 'object') return false;

    return (
        'fromNode' in value
        || 'toNode' in value
        || 'from' in value
        || 'to' in value
        || 'lineGroupEl' in value
        || 'lineEndGroupEl' in value
    );
}

function isSameEdge(left: CanvasEdgeLike | null | undefined, right: CanvasEdgeLike | null | undefined): boolean {
    if (!left || !right) return false;
    if (left === right) return true;

    const leftId = getEdgeKey(left);
    const rightId = getEdgeKey(right);
    if (leftId && rightId) {
        return leftId === rightId;
    }

    return left.id === right.id;
}

export function getPrimarySelectedEdgeFromState(canvas: CanvasLike): CanvasEdgeLike | null {
    if (canvas.selectedEdge) return canvas.selectedEdge;
    if (Array.isArray(canvas.selectedEdges) && canvas.selectedEdges.length > 0) {
        return canvas.selectedEdges[0] || null;
    }
    return null;
}

export function getSelectedEdgeCountFromState(canvas: CanvasLike): number {
    if (Array.isArray(canvas.selectedEdges) && canvas.selectedEdges.length > 0) {
        return canvas.selectedEdges.length;
    }
    return canvas.selectedEdge ? 1 : 0;
}

export function clearNodeSelectionState(canvas: CanvasLike): void {
    if (canvas.selection instanceof Set) {
        for (const entry of Array.from(canvas.selection)) {
            if (!isEdgeSelectionEntry(entry)) {
                canvas.selection.delete(entry);
            }
        }
    }

    if (Array.isArray(canvas.selectedNodes)) {
        canvas.selectedNodes = [];
    }
}

export function clearEdgeSelectionState(canvas: CanvasLike, edge?: CanvasEdgeLike | null): void {
    if (canvas.selection instanceof Set) {
        for (const entry of Array.from(canvas.selection)) {
            if (!isEdgeSelectionEntry(entry)) continue;
            if (!edge || isSameEdge(entry, edge)) {
                canvas.selection.delete(entry);
            }
        }
    }

    if (!edge || (canvas.selectedEdge && isSameEdge(canvas.selectedEdge, edge))) {
        delete (canvas as CanvasLike & { selectedEdge?: CanvasEdgeLike | null }).selectedEdge;
    }

    if (Array.isArray(canvas.selectedEdges)) {
        canvas.selectedEdges = edge
            ? canvas.selectedEdges.filter(candidate => !isSameEdge(candidate, edge))
            : [];
    }
}

export function clearAllSelectionState(canvas: CanvasLike): void {
    clearNodeSelectionState(canvas);
    clearEdgeSelectionState(canvas);
}

export function setSingleSelectedEdgeState(canvas: CanvasLike, edge: CanvasEdgeLike, options?: { clearSelection?: boolean }): void {
    if (options?.clearSelection && canvas.selection instanceof Set) {
        canvas.selection.clear();
    }

    if (canvas.selection instanceof Set) {
        canvas.selection.add(edge);
    }

    (canvas as CanvasLike & { selectedEdge?: CanvasEdgeLike | null }).selectedEdge = edge;
    (canvas as CanvasLike & { selectedEdges?: CanvasEdgeLike[] }).selectedEdges = [edge];
}