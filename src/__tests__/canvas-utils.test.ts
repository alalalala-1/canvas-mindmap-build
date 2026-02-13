import { describe, it, expect, beforeEach } from 'vitest';
import {
	getNodeIdFromEdgeEndpoint,
	getEdgeFromNodeId,
	getEdgeToNodeId,
	hasChildNodes,
	identifyRootNodes,
} from '../utils/canvas-utils';

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
			const edge = { id: 'edge-1', fromNode: 'source-node', toNode: 'target-node' } as any;
			expect(getEdgeFromNodeId(edge)).toBe('source-node');
		});

		it('should extract from as string', () => {
			const edge = { id: 'edge-1', from: 'direct-source', to: 'direct-target' } as any;
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
			const edge = { id: 'edge-1', fromNode: 'source-node', toNode: 'target-node' } as any;
			expect(getEdgeToNodeId(edge)).toBe('target-node');
		});

		it('should extract to as string', () => {
			const edge = { id: 'edge-1', from: 'direct-source', to: 'direct-target' } as any;
			expect(getEdgeToNodeId(edge)).toBe('direct-target');
		});

		it('should return null for null edge', () => {
			expect(getEdgeToNodeId(null)).toBeNull();
		});
	});

	describe('hasChildNodes', () => {
		const edges = [
			{ id: 'e1', fromNode: 'parent', toNode: 'child1' } as any,
			{ id: 'e2', fromNode: 'parent', toNode: 'child2' } as any,
			{ id: 'e3', fromNode: 'other', toNode: 'orphan' } as any,
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
			} as any;

			const roots = identifyRootNodes(canvasData);
			expect(roots).toContain('node1');
			expect(roots).not.toContain('node2');
			expect(roots).not.toContain('node3');
		});

		it('should return all nodes when no edges exist', () => {
			const canvasData = {
				nodes: [{ id: 'node1' }, { id: 'node2' }],
				edges: [],
			} as any;

			const roots = identifyRootNodes(canvasData);
			expect(roots).toHaveLength(2);
		});

		it('should handle empty canvas data', () => {
			const canvasData = { nodes: [], edges: [] } as any;
			const roots = identifyRootNodes(canvasData);
			expect(roots).toHaveLength(0);
		});
	});
});
