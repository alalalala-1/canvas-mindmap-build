import { describe, expect, it, vi, beforeEach } from 'vitest';

const { arrangeLayoutMock } = vi.hoisted(() => ({
	arrangeLayoutMock: vi.fn(),
}));

vi.mock('../canvas/layout', () => ({
	arrangeLayout: arrangeLayoutMock,
}));

vi.mock('../canvas/adapters/canvas-runtime-adapter', () => ({
	getCanvasRuntimeSafety: () => ({ safe: true, reason: null }),
	requestCanvasSave: () => true,
	requestCanvasUpdate: () => true,
}));

import { CollapseToggleService } from '../canvas/services/collapse-toggle-service';

describe('CollapseToggleService canonical toggle layout', () => {
	beforeEach(() => {
		arrangeLayoutMock.mockReset();
		arrangeLayoutMock.mockReturnValue(new Map([
			['parent-1', { x: 10, y: 20 }],
			['child-1', { x: 120, y: 20 }],
		]));
	});

	it('should force canonical layout reset when collapsing', async () => {
		const collapseStateManager = {
			getAllCollapsedNodes: () => new Set<string>(['parent-1']),
			addAllDescendantsToSet: vi.fn(),
			isCollapsed: () => false,
			markCollapsed: vi.fn(),
			markExpanded: vi.fn(),
		};
		const parentNode = { id: 'parent-1', x: 10, y: 20, nodeEl: { style: {} } };
		const childNode = { id: 'child-1', x: 120, y: 140, nodeEl: { style: {} } };
		const canvas = {
			nodes: new Map([
				['parent-1', parentNode],
				['child-1', childNode],
			]),
			edges: [],
			fileData: { edges: [] },
		};
		const layoutDataProvider = {
			getLayoutData: vi.fn(async () => ({
				visibleNodes: new Map([
					['parent-1', parentNode],
					['child-1', childNode],
				]),
				edges: [],
				originalEdges: [],
				allNodes: new Map([
					['parent-1', parentNode],
					['child-1', childNode],
				]),
				canvasData: { nodes: [parentNode, childNode], edges: [] },
			})),
		};
		const service = new CollapseToggleService(
			collapseStateManager as never,
			layoutDataProvider as never,
			() => ({
				horizontalSpacing: 120,
				verticalSpacing: 40,
				textNodeWidth: 260,
				textNodeMaxHeight: 800,
				imageNodeWidth: 260,
				imageNodeHeight: 180,
				formulaNodeWidth: 260,
				formulaNodeHeight: 120,
			}),
		);

		await service.autoArrangeAfterToggle('parent-1', canvas as never, true);

		expect(arrangeLayoutMock).toHaveBeenCalledTimes(1);
		expect(arrangeLayoutMock.mock.calls[0]?.[6]).toEqual({
			forceResetCoordinates: true,
			forceReason: 'collapse-toggle',
		});
	});

	it('should suppress oversized anchor offset reinjection after toggle', async () => {
		const collapseStateManager = {
			getAllCollapsedNodes: () => new Set<string>(['parent-1']),
			addAllDescendantsToSet: vi.fn(),
			isCollapsed: () => false,
			markCollapsed: vi.fn(),
			markExpanded: vi.fn(),
		};
		const parentNode = { id: 'parent-1', x: 10, y: 9000, nodeEl: { style: {} } };
		const childNode = { id: 'child-1', x: 120, y: 9180, nodeEl: { style: {} } };
		const canvas = {
			nodes: new Map([
				['parent-1', parentNode],
				['child-1', childNode],
			]),
			edges: [],
			fileData: { edges: [] },
		};
		const layoutDataProvider = {
			getLayoutData: vi.fn(async () => ({
				visibleNodes: new Map([
					['parent-1', parentNode],
					['child-1', childNode],
				]),
				edges: [],
				originalEdges: [],
				allNodes: new Map([
					['parent-1', parentNode],
					['child-1', childNode],
				]),
				canvasData: { nodes: [parentNode, childNode], edges: [] },
			})),
		};
		const service = new CollapseToggleService(
			collapseStateManager as never,
			layoutDataProvider as never,
			() => ({
				horizontalSpacing: 120,
				verticalSpacing: 40,
				textNodeWidth: 260,
				textNodeMaxHeight: 800,
				imageNodeWidth: 260,
				imageNodeHeight: 180,
				formulaNodeWidth: 260,
				formulaNodeHeight: 120,
			}),
		);

		await service.autoArrangeAfterToggle('parent-1', canvas as never, true);

		expect(parentNode.y).toBe(20);
		expect(childNode.y).toBe(20);
		expect(childNode.x).toBe(120);
	});

	it('should update runtime node position without calling setData during toggle updates', () => {
		const collapseStateManager = {
			getAllCollapsedNodes: () => new Set<string>(['parent-1']),
			addAllDescendantsToSet: vi.fn(),
			isCollapsed: () => false,
			markCollapsed: vi.fn(),
			markExpanded: vi.fn(),
		};
		const parentUpdate = vi.fn();
		const childUpdate = vi.fn();
		const parentSetData = vi.fn();
		const childSetData = vi.fn();
		const parentNodeEl = { style: {} } as unknown as HTMLElement;
		const childNodeEl = { style: {} } as unknown as HTMLElement;
		const parentNode = {
			id: 'parent-1',
			x: 30,
			y: 140,
			nodeEl: parentNodeEl,
			getData: () => ({ width: 260, height: 80 }),
			setData: parentSetData,
			update: parentUpdate,
		};
		const childNode = {
			id: 'child-1',
			x: 180,
			y: 260,
			nodeEl: childNodeEl,
			getData: () => ({ width: 320, height: 96 }),
			setData: childSetData,
			update: childUpdate,
		};
		const canvas = {
			nodes: new Map([
				['parent-1', parentNode],
				['child-1', childNode],
			]),
			edges: [],
			fileData: { edges: [] },
		};
		const layoutDataProvider = {
			getLayoutData: vi.fn(async () => ({
				visibleNodes: new Map([
					['parent-1', parentNode],
					['child-1', childNode],
				]),
				edges: [],
				originalEdges: [],
				allNodes: new Map([
					['parent-1', parentNode],
					['child-1', childNode],
				]),
				canvasData: { nodes: [parentNode, childNode], edges: [] },
			})),
		};
		const service = new CollapseToggleService(
			collapseStateManager as never,
			layoutDataProvider as never,
			() => ({
				horizontalSpacing: 120,
				verticalSpacing: 40,
				textNodeWidth: 260,
				textNodeMaxHeight: 800,
				imageNodeWidth: 260,
				imageNodeHeight: 180,
				formulaNodeWidth: 260,
				formulaNodeHeight: 120,
			}),
		);

		const updatedCount = service.updateNodePositionsWithOffset(new Map([
			['parent-1', { x: 10, y: 20 }],
			['child-1', { x: 120, y: 20 }],
		]), new Map([
			['parent-1', parentNode],
			['child-1', childNode],
		]), 0, 0);

		expect(updatedCount).toBe(2);
		expect(parentSetData).not.toHaveBeenCalled();
		expect(childSetData).not.toHaveBeenCalled();
		expect(parentUpdate).toHaveBeenCalledTimes(1);
		expect(childUpdate).toHaveBeenCalledTimes(1);
		expect(parentNode.x).toBe(10);
		expect(parentNode.y).toBe(20);
		expect((parentNode as { bbox?: unknown }).bbox).toEqual({
			minX: 10,
			minY: 20,
			maxX: 270,
			maxY: 100,
		});
		expect(childNode.x).toBe(120);
		expect(childNode.y).toBe(20);
		expect((childNode as { bbox?: unknown }).bbox).toEqual({
			minX: 120,
			minY: 20,
			maxX: 440,
			maxY: 116,
		});
	});
});