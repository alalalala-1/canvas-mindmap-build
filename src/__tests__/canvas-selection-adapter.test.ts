import { describe, expect, it } from 'vitest';
import {
    clearAllSelectionState,
    clearEdgeSelectionState,
    clearNodeSelectionState,
    getPrimarySelectedEdgeFromState,
    getSelectedEdgesFromState,
    getSelectedEdgeCountFromState,
    getSelectedNodeCountFromState,
    getSelectedNodesFromState,
    setSingleSelectedEdgeState,
} from '../canvas/adapters/canvas-selection-adapter';
import type { CanvasEdgeLike, CanvasLike, CanvasNodeLike, CanvasSelectionEntry } from '../canvas/types';

describe('canvas-selection-adapter', () => {
    it('should set and query single selected edge state', () => {
        const edge: CanvasEdgeLike = { id: 'edge-1', fromNode: 'node-1', toNode: 'node-2' };
        const canvas: CanvasLike & { selection: Set<CanvasSelectionEntry>; selectedEdges?: CanvasEdgeLike[] } = {
            selection: new Set<CanvasSelectionEntry>()
        };

        setSingleSelectedEdgeState(canvas, edge);

        expect(getPrimarySelectedEdgeFromState(canvas)).toBe(edge);
        expect(getSelectedEdgeCountFromState(canvas)).toBe(1);
        expect(canvas.selection.has(edge)).toBe(true);
        expect(canvas.selectedEdges).toEqual([edge]);
    });

    it('should clear edge selection without touching selected nodes', () => {
        const node: CanvasNodeLike = { id: 'node-1', type: 'text' };
        const edge: CanvasEdgeLike = { id: 'edge-1', fromNode: 'node-1', toNode: 'node-2' };
        const canvas: CanvasLike & {
            selection: Set<CanvasSelectionEntry>;
            selectedNodes: CanvasNodeLike[];
            selectedEdge: CanvasEdgeLike;
            selectedEdges: CanvasEdgeLike[];
        } = {
            selection: new Set<CanvasSelectionEntry>([node, edge]),
            selectedNodes: [node],
            selectedEdge: edge,
            selectedEdges: [edge],
        };

        clearEdgeSelectionState(canvas, edge);

        expect(canvas.selection.has(node)).toBe(true);
        expect(canvas.selection.has(edge)).toBe(false);
        expect(canvas.selectedNodes).toEqual([node]);
        expect(canvas.selectedEdge).toBeUndefined();
        expect(canvas.selectedEdges).toEqual([]);
    });

    it('should clear node selection entries only', () => {
        const node: CanvasNodeLike = { id: 'node-1', type: 'text' };
        const edge: CanvasEdgeLike = { id: 'edge-1', fromNode: 'node-1', toNode: 'node-2' };
        const canvas: CanvasLike & {
            selection: Set<CanvasSelectionEntry>;
            selectedNodes: CanvasNodeLike[];
            selectedEdge: CanvasEdgeLike;
            selectedEdges: CanvasEdgeLike[];
        } = {
            selection: new Set<CanvasSelectionEntry>([node, edge]),
            selectedNodes: [node],
            selectedEdge: edge,
            selectedEdges: [edge],
        };

        clearNodeSelectionState(canvas);

        expect(canvas.selection.has(node)).toBe(false);
        expect(canvas.selection.has(edge)).toBe(true);
        expect(canvas.selectedNodes).toEqual([]);
        expect(canvas.selectedEdge).toBe(edge);
    });

    it('should clear both node and edge selection state together', () => {
        const node: CanvasNodeLike = { id: 'node-1', type: 'text' };
        const edge: CanvasEdgeLike = { id: 'edge-1', fromNode: 'node-1', toNode: 'node-2' };
        const canvas: CanvasLike & {
            selection: Set<CanvasSelectionEntry>;
            selectedNodes: CanvasNodeLike[];
            selectedEdge: CanvasEdgeLike;
            selectedEdges: CanvasEdgeLike[];
        } = {
            selection: new Set<CanvasSelectionEntry>([node, edge]),
            selectedNodes: [node],
            selectedEdge: edge,
            selectedEdges: [edge],
        };

        clearAllSelectionState(canvas);

        expect(canvas.selection.size).toBe(0);
        expect(canvas.selectedNodes).toEqual([]);
        expect(canvas.selectedEdge).toBeUndefined();
        expect(canvas.selectedEdges).toEqual([]);
    });

    it('should collect selected nodes from selection set and selectedNodes without duplicates', () => {
        const nodeA: CanvasNodeLike = { id: 'node-1', type: 'text' };
        const nodeB: CanvasNodeLike = { id: 'node-2', type: 'text' };
        const edge: CanvasEdgeLike = { id: 'edge-1', fromNode: 'node-1', toNode: 'node-2' };
        const canvas: CanvasLike & {
            selection: Set<CanvasSelectionEntry>;
            selectedNodes: CanvasNodeLike[];
            selectedEdges: CanvasEdgeLike[];
        } = {
            selection: new Set<CanvasSelectionEntry>([nodeA, edge]),
            selectedNodes: [nodeA, nodeB],
            selectedEdges: [edge],
        };

        expect(getSelectedNodesFromState(canvas)).toEqual([nodeA, nodeB]);
        expect(getSelectedNodeCountFromState(canvas)).toBe(2);
    });

    it('should collect selected edges from selection state without duplicates', () => {
        const edgeA: CanvasEdgeLike = { id: 'edge-1', fromNode: 'node-1', toNode: 'node-2' };
        const edgeB: CanvasEdgeLike = { fromNode: 'node-2', toNode: 'node-3' };
        const canvas: CanvasLike & {
            selection: Set<CanvasSelectionEntry>;
            selectedEdge: CanvasEdgeLike;
            selectedEdges: CanvasEdgeLike[];
        } = {
            selection: new Set<CanvasSelectionEntry>([edgeA, edgeB]),
            selectedEdge: edgeA,
            selectedEdges: [edgeB],
        };

        expect(getSelectedEdgesFromState(canvas)).toEqual([edgeA, edgeB]);
        expect(getSelectedEdgeCountFromState(canvas)).toBe(2);
        expect(getPrimarySelectedEdgeFromState(canvas)).toBe(edgeA);
    });

    it('should clear previous edge state before setting a single selected edge', () => {
        const previousEdge: CanvasEdgeLike = { id: 'edge-1', fromNode: 'node-1', toNode: 'node-2' };
        const nextEdge: CanvasEdgeLike = { id: 'edge-2', fromNode: 'node-2', toNode: 'node-3' };
        const node: CanvasNodeLike = { id: 'node-1', type: 'text' };
        const canvas: CanvasLike & {
            selection: Set<CanvasSelectionEntry>;
            selectedNodes: CanvasNodeLike[];
            selectedEdge: CanvasEdgeLike;
            selectedEdges: CanvasEdgeLike[];
        } = {
            selection: new Set<CanvasSelectionEntry>([node, previousEdge]),
            selectedNodes: [node],
            selectedEdge: previousEdge,
            selectedEdges: [previousEdge],
        };

        setSingleSelectedEdgeState(canvas, nextEdge);

        expect(canvas.selection.has(node)).toBe(true);
        expect(canvas.selection.has(previousEdge)).toBe(false);
        expect(canvas.selection.has(nextEdge)).toBe(true);
        expect(canvas.selectedNodes).toEqual([node]);
        expect(canvas.selectedEdge).toBe(nextEdge);
        expect(canvas.selectedEdges).toEqual([nextEdge]);
    });
});