import { describe, it, expect } from 'vitest';
import {
	clearCanvasEdgeSelection,
	clearCanvasSelection,
	describeCanvasSelectionState,
	getCanvasSelectionSummary,
	getNodeIdFromEdgeEndpoint,
	getEdgeFromNodeId,
	getEdgeToNodeId,
	getSelectedNodeFromCanvas,
	hasChildNodes,
	identifyRootNodes,
} from '../utils/canvas-utils';

function createClassList(initial: string[] = []) {
	const classes = new Set(initial);
	return {
		contains: (name: string) => classes.has(name),
		add: (...names: string[]) => {
			for (const name of names) classes.add(name);
		},
		remove: (...names: string[]) => {
			for (const name of names) classes.delete(name);
		},
	};
}

function createMockElement(initial: string[] = []): HTMLElement {
	return {
		classList: createClassList(initial),
	} as unknown as HTMLElement;
}

describe('canvas-utils', () => {
	describe('getNodeIdFromEdgeEndpoint', () => {
		it('should return string endpoint as-is', () => {
			expect(getNodeIdFromEdgeEndpoint('node-id-123')).toBe('node-id-123');
		});

		it('should return null for null endpoint', () => {
			expect(getNodeIdFromEdgeEndpoint(null)).toBeNull();
		});

		it('should return null for undefined endpoint', () => {
			expect(getNodeIdFromEdgeEndpoint(undefined)).toBeNull();
		});

		it('should extract nodeId from object endpoint', () => {
			const endpoint = { nodeId: 'target-node' };
			expect(getNodeIdFromEdgeEndpoint(endpoint)).toBe('target-node');
		});

		it('should extract id from nested node object', () => {
			const endpoint = { node: { id: 'nested-node-id' } };
			expect(getNodeIdFromEdgeEndpoint(endpoint)).toBe('nested-node-id');
		});

		it('should prioritize nodeId over nested node.id', () => {
			const endpoint = { nodeId: 'primary-id', node: { id: 'secondary-id' } };
			expect(getNodeIdFromEdgeEndpoint(endpoint)).toBe('primary-id');
		});
	});

	describe('getEdgeFromNodeId', () => {
		it('should extract fromNode when present', () => {
			const edge = { id: 'edge-1', fromNode: 'source-node', toNode: 'target-node' };
			expect(getEdgeFromNodeId(edge)).toBe('source-node');
		});

		it('should extract from as string', () => {
			const edge = { id: 'edge-1', from: 'direct-source', to: 'direct-target' };
			expect(getEdgeFromNodeId(edge)).toBe('direct-source');
		});

		it('should return null for null edge', () => {
			expect(getEdgeFromNodeId(null)).toBeNull();
		});

		it('should return null for undefined edge', () => {
			expect(getEdgeFromNodeId(undefined)).toBeNull();
		});
	});

	describe('getEdgeToNodeId', () => {
		it('should extract toNode when present', () => {
			const edge = { id: 'edge-1', fromNode: 'source-node', toNode: 'target-node' };
			expect(getEdgeToNodeId(edge)).toBe('target-node');
		});

		it('should extract to as string', () => {
			const edge = { id: 'edge-1', from: 'direct-source', to: 'direct-target' };
			expect(getEdgeToNodeId(edge)).toBe('direct-target');
		});

		it('should return null for null edge', () => {
			expect(getEdgeToNodeId(null)).toBeNull();
		});
	});

	describe('hasChildNodes', () => {
		const edges = [
			{ id: 'e1', fromNode: 'parent', toNode: 'child1' },
			{ id: 'e2', fromNode: 'parent', toNode: 'child2' },
			{ id: 'e3', fromNode: 'other', toNode: 'orphan' },
		];

		it('should return true when node has children', () => {
			expect(hasChildNodes('parent', edges)).toBe(true);
		});

		it('should return false when node has no children', () => {
			expect(hasChildNodes('orphan', edges)).toBe(false);
		});

		it('should return false for non-existent node', () => {
			expect(hasChildNodes('nonexistent', edges)).toBe(false);
		});
	});

	describe('identifyRootNodes', () => {
		it('should identify nodes without incoming edges as roots', () => {
			const canvasData = {
				nodes: [
					{ id: 'node1' },
					{ id: 'node2' },
					{ id: 'node3' },
				],
				edges: [
					{ id: 'e1', fromNode: 'node1', toNode: 'node2' },
					{ id: 'e2', fromNode: 'node1', toNode: 'node3' },
				],
			};

			const roots = identifyRootNodes(canvasData);
			expect(roots).toContain('node1');
			expect(roots).not.toContain('node2');
			expect(roots).not.toContain('node3');
		});

		it('should return all nodes when no edges exist', () => {
			const canvasData = {
				nodes: [{ id: 'node1' }, { id: 'node2' }],
				edges: [],
			};

			const roots = identifyRootNodes(canvasData);
			expect(roots).toHaveLength(2);
		});

		it('should handle empty canvas data', () => {
			const canvasData = { nodes: [], edges: [] };
			const roots = identifyRootNodes(canvasData);
			expect(roots).toHaveLength(0);
		});
	});

	describe('selection helpers', () => {
		it('should ignore edge entries when resolving selected node from mixed selection', () => {
			const node = { id: 'node-1', type: 'text' as const };
			const edge = { id: 'edge-1', fromNode: 'node-1', toNode: 'node-2' };
			const canvas = {
				nodes: { 'node-1': node, 'node-2': { id: 'node-2', type: 'text' as const } },
				edges: [edge],
				selection: new Set([edge]),
				selectedEdge: edge,
			};

			expect(getSelectedNodeFromCanvas(canvas)).toBeNull();
		});

		it('should separate node and edge ids in selection summary output', () => {
			const node = { id: 'node-1', type: 'text' as const };
			const edge = { id: 'edge-1', fromNode: 'node-1', toNode: 'node-2' };
			const canvas = {
				nodes: {
					'node-1': node,
					'node-2': { id: 'node-2', type: 'text' as const },
				},
				edges: [edge],
				selection: new Set([node, edge]),
				selectedEdge: edge,
			};

			const summary = getCanvasSelectionSummary(canvas);
			expect(summary.nodeIds).toEqual(['node-1']);
			expect(summary.edgeIds).toEqual(['node-1->node-2']);
			expect(summary.activeEdgeId).toBe('node-1->node-2');
			expect(describeCanvasSelectionState(canvas)).toBe('nodes=1[node-1],selectionEdges=1[node-1->node-2],edge=node-1->node-2');
		});

		it('should clear edge selection from canvas.selection and DOM classes', () => {
			const node = { id: 'node-1', type: 'text' as const };
			const edge = {
				id: 'edge-1',
				fromNode: 'node-1',
				toNode: 'node-2',
				lineGroupEl: createMockElement(['is-selected', 'is-focused']),
				lineEndGroupEl: createMockElement(['is-selected']),
			};
			const canvas = {
				nodes: {
					'node-1': node,
					'node-2': { id: 'node-2', type: 'text' as const },
				},
				edges: [edge],
				selection: new Set([node, edge]),
				selectedEdge: edge,
				selectedEdges: [edge],
			};

			const result = clearCanvasEdgeSelection(canvas);

			expect(result.cleared).toBe(true);
			expect(result.clearedEdgeIds).toEqual(['node-1->node-2']);
			expect(result.domClearedCount).toBe(1);
			expect(canvas.selection.has(node)).toBe(true);
			expect(canvas.selection.has(edge)).toBe(false);
			expect(canvas.selectedEdge).toBeUndefined();
			expect(canvas.selectedEdges).toEqual([]);
			expect(edge.lineGroupEl.classList.contains('is-selected')).toBe(false);
			expect(edge.lineGroupEl.classList.contains('is-focused')).toBe(false);
			expect(edge.lineEndGroupEl.classList.contains('is-selected')).toBe(false);
		});

		it('should clear mixed node and edge selection state including DOM classes', () => {
			const node = {
				id: 'node-1',
				type: 'text' as const,
				nodeEl: createMockElement(['is-selected', 'is-focused', 'is-editing']),
			};
			const siblingNode = {
				id: 'node-2',
				type: 'text' as const,
				nodeEl: createMockElement(),
			};
			const edge = {
				id: 'edge-1',
				fromNode: 'node-1',
				toNode: 'node-2',
				lineGroupEl: createMockElement(['is-selected', 'is-focused']),
				lineEndGroupEl: createMockElement(['is-focused']),
			};
			const canvas = {
				nodes: {
					'node-1': node,
					'node-2': siblingNode,
				},
				edges: [edge],
				selection: new Set([node, edge]),
				selectedNodes: [node],
				selectedEdge: edge,
				selectedEdges: [edge],
			};

			const result = clearCanvasSelection(canvas);

			expect(result.cleared).toBe(true);
			expect(result.clearedNodeIds).toEqual(['node-1']);
			expect(result.clearedEdgeIds).toEqual(['node-1->node-2']);
			expect(result.domNodeClearedCount).toBe(1);
			expect(result.domEdgeClearedCount).toBe(1);
			expect(canvas.selection.size).toBe(0);
			expect(canvas.selectedNodes).toEqual([]);
			expect(canvas.selectedEdge).toBeUndefined();
			expect(canvas.selectedEdges).toEqual([]);
			expect(node.nodeEl.classList.contains('is-selected')).toBe(false);
			expect(node.nodeEl.classList.contains('is-focused')).toBe(false);
			expect(node.nodeEl.classList.contains('is-editing')).toBe(false);
			expect(edge.lineGroupEl.classList.contains('is-selected')).toBe(false);
			expect(edge.lineEndGroupEl.classList.contains('is-focused')).toBe(false);
		});
	});
});
