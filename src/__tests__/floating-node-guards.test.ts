import { afterEach, describe, expect, it, vi } from 'vitest';
import { FloatingNodeStateManager } from '../canvas/services/floating-node-state-manager';
import { FloatingNodeStyleManager } from '../canvas/services/floating-node-style-manager';
import { FloatingNodeService } from '../canvas/services/floating-node-service';

describe('Floating node stale-state guards', () => {
	it('should batch clear floating state in a single atomic mutation', async () => {
		type TestCanvasData = {
			nodes: Array<{ id: string; data?: Record<string, unknown> }>;
			metadata?: { floatingNodes?: Record<string, unknown> };
		};
		const canvasData: TestCanvasData = {
			nodes: [
				{ id: 'connected', data: { isFloating: true, originalParent: 'parent-1', floatingTimestamp: 100 } },
				{ id: 'missing', data: { isFloating: true, originalParent: 'parent-2', floatingTimestamp: 200 } },
			],
			metadata: {
				floatingNodes: {
					connected: { isFloating: true, originalParent: 'parent-1' },
					missing: { isFloating: true, originalParent: 'parent-2' },
				},
			},
		};

		const modifyCanvasDataAtomic = vi.fn(async (_canvasFilePath: string, updater: (canvasData: TestCanvasData) => boolean) => {
			return updater(canvasData);
		});

		const manager = new FloatingNodeStateManager({} as never, { modifyCanvasDataAtomic } as never) as unknown as {
			updateMemoryCache: (canvasFilePath: string, nodeId: string, data: unknown) => void;
			clearNodesFloatingState: (nodeIds: string[], canvasFilePath: string) => Promise<boolean>;
			floatingNodesCache: Map<string, Map<string, unknown>>;
		};

		manager.updateMemoryCache('test.canvas', 'connected', { isFloating: true, originalParent: 'parent-1' });
		manager.updateMemoryCache('test.canvas', 'missing', { isFloating: true, originalParent: 'parent-2' });

		const result = await manager.clearNodesFloatingState(['connected', 'missing'], 'test.canvas');

		expect(result).toBe(true);
		expect(modifyCanvasDataAtomic).toHaveBeenCalledTimes(1);
		expect(canvasData.metadata?.floatingNodes).toBeUndefined();
		expect(canvasData.nodes[0]?.data?.isFloating).toBeUndefined();
		expect(canvasData.nodes[1]?.data?.isFloating).toBeUndefined();
		expect(manager.floatingNodesCache.get('test.canvas')?.size ?? 0).toBe(0);
	});

	it('should skip mount retry queue when clearing stale floating style for missing node', () => {
		const originalDocument = globalThis.document;
		(globalThis as Record<string, unknown>).document = {
			querySelector: () => null,
			querySelectorAll: () => [],
		} as unknown as Document;

		try {
			const styleManager = new FloatingNodeStyleManager() as unknown as {
				clearFloatingStyle: (nodeId: string, options?: { retryOnMissing?: boolean }) => boolean;
				pendingClearNodeIds: Set<string>;
				pendingTimeouts: Map<string, Set<ReturnType<typeof setTimeout>>>;
			};

			const cleared = styleManager.clearFloatingStyle('missing-node', { retryOnMissing: false });

			expect(cleared).toBe(false);
			expect(styleManager.pendingClearNodeIds.size).toBe(0);
			expect(styleManager.pendingTimeouts.size).toBe(0);
		} finally {
			(globalThis as Record<string, unknown>).document = originalDocument;
		}
	});

	it('should prefilter connected and missing floating nodes before style reapply main chain', async () => {
		const service = new FloatingNodeService({} as never, {} as never, {} as never) as unknown as {
			currentCanvasFilePath: string | null;
			canvas: unknown;
			stateManager: {
				getAllFloatingNodes: ReturnType<typeof vi.fn>;
				clearNodesFloatingState: ReturnType<typeof vi.fn>;
				updateMemoryCache: ReturnType<typeof vi.fn>;
			};
			styleManager: {
				setCanvas: ReturnType<typeof vi.fn>;
				applyFloatingStyle: ReturnType<typeof vi.fn>;
				clearFloatingStyle: ReturnType<typeof vi.fn>;
			};
			reapplyAllFloatingStyles: (canvas?: unknown) => Promise<void>;
		};

		const canvas = {
			nodes: new Map([
				['valid', { id: 'valid', data: { isFloating: true } }],
				['connected', { id: 'connected', data: { isFloating: true } }],
			]),
			edges: [
				{ id: 'edge-1', fromNode: 'root', toNode: 'connected' },
			],
			fileData: {
				edges: [
					{ id: 'edge-1', fromNode: 'root', toNode: 'connected' },
				],
			},
		};

		service.currentCanvasFilePath = 'test.canvas';
		service.canvas = canvas;
		service.stateManager = {
			getAllFloatingNodes: vi.fn(async () => new Map([
				['valid', { isFloating: true, originalParent: 'parent-1' }],
				['connected', { isFloating: true, originalParent: 'parent-2' }],
				['missing', { isFloating: true, originalParent: 'parent-3' }],
			])),
			clearNodesFloatingState: vi.fn(async () => true),
			updateMemoryCache: vi.fn(),
		};
		service.styleManager = {
			setCanvas: vi.fn(),
			applyFloatingStyle: vi.fn(),
			clearFloatingStyle: vi.fn(),
		};

		await service.reapplyAllFloatingStyles(canvas);
		await Promise.resolve();
		await Promise.resolve();

		expect(service.styleManager.applyFloatingStyle).toHaveBeenCalledTimes(1);
		expect(service.styleManager.applyFloatingStyle).toHaveBeenCalledWith('valid');
		expect(service.styleManager.clearFloatingStyle).toHaveBeenCalledWith('connected', { retryOnMissing: false });
		expect(service.styleManager.clearFloatingStyle).toHaveBeenCalledWith('missing', { retryOnMissing: false });
		expect(service.stateManager.clearNodesFloatingState).toHaveBeenCalledTimes(2);
		expect(service.stateManager.clearNodesFloatingState).toHaveBeenNthCalledWith(1, ['connected'], 'test.canvas');
		expect(service.stateManager.clearNodesFloatingState).toHaveBeenNthCalledWith(2, ['missing'], 'test.canvas');
	});
});

afterEach(() => {
	vi.restoreAllMocks();
});