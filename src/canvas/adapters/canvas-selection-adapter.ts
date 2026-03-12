import { CanvasEdgeLike, CanvasLike, CanvasNodeLike } from '../types';

function isNodeSelectionEntry(value: unknown): value is CanvasNodeLike {
    if (!value || typeof value !== 'object') return false;
    if (isEdgeSelectionEntry(value)) return false;

    return (
        typeof (value as { id?: unknown }).id === 'string'
        || typeof (value as { type?: unknown }).type === 'string'
        || 'nodeEl' in (value as Record<string, unknown>)
    );
}

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
    return getSelectedEdgesFromState(canvas)[0] || null;
}

export function getSelectedNodesFromState(canvas: CanvasLike): CanvasNodeLike[] {
    const selectedNodes: CanvasNodeLike[] = [];
    const seenNodeRefs = new Set<CanvasNodeLike>();
    const seenNodeIds = new Set<string>();

    const rememberNode = (node: CanvasNodeLike | null | undefined): void => {
        if (!node) return;

        if (typeof node.id === 'string' && node.id.length > 0) {
            if (seenNodeIds.has(node.id)) return;
            seenNodeIds.add(node.id);
            selectedNodes.push(node);
            return;
        }

        if (seenNodeRefs.has(node)) return;
        seenNodeRefs.add(node);
        selectedNodes.push(node);
    };

    if (canvas.selection instanceof Set && canvas.selection.size > 0) {
        for (const entry of Array.from(canvas.selection)) {
            if (isNodeSelectionEntry(entry)) {
                rememberNode(entry);
            }
        }
    }

    if (Array.isArray(canvas.selectedNodes)) {
        for (const node of canvas.selectedNodes) {
            rememberNode(node);
        }
    }

    return selectedNodes;
}

export function getSelectedNodeCountFromState(canvas: CanvasLike): number {
    return getSelectedNodesFromState(canvas).length;
}

export function getSelectedEdgesFromState(canvas: CanvasLike): CanvasEdgeLike[] {
    const selectedEdges: CanvasEdgeLike[] = [];
    const seenEdgeRefs = new Set<CanvasEdgeLike>();
    const seenEdgeKeys = new Set<string>();

    const rememberEdge = (edge: CanvasEdgeLike | null | undefined): void => {
        if (!edge) return;

        const edgeKey = getEdgeKey(edge);
        if (edgeKey) {
            if (seenEdgeKeys.has(edgeKey)) return;
            seenEdgeKeys.add(edgeKey);
            selectedEdges.push(edge);
            return;
        }

        if (seenEdgeRefs.has(edge)) return;
        seenEdgeRefs.add(edge);
        selectedEdges.push(edge);
    };

    if (canvas.selection instanceof Set && canvas.selection.size > 0) {
        for (const entry of Array.from(canvas.selection)) {
            if (isEdgeSelectionEntry(entry)) {
                rememberEdge(entry);
            }
        }
    }

    rememberEdge(canvas.selectedEdge);
    if (Array.isArray(canvas.selectedEdges)) {
        for (const edge of canvas.selectedEdges) {
            rememberEdge(edge);
        }
    }

    return selectedEdges;
}

export function getSelectedEdgeCountFromState(canvas: CanvasLike): number {
    return getSelectedEdgesFromState(canvas).length;
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
    if (options?.clearSelection) {
        clearAllSelectionState(canvas);
    } else {
        clearEdgeSelectionState(canvas);
    }

    if (canvas.selection instanceof Set) {
        canvas.selection.add(edge);
    }

    (canvas as CanvasLike & { selectedEdge?: CanvasEdgeLike | null }).selectedEdge = edge;
    (canvas as CanvasLike & { selectedEdges?: CanvasEdgeLike[] }).selectedEdges = [edge];
}