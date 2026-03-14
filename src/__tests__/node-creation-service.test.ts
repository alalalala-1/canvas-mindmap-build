import { describe, expect, it, vi } from 'vitest';
import { TFile } from 'obsidian';
import { NodeCreationService } from '../canvas/services/node-creation-service';

describe('NodeCreationService native insert guard', () => {
	it('should reject unverified empty native insert before writing canvas data', async () => {
		const modifyCanvasDataAtomic = vi.fn(async () => true);
		const service = new NodeCreationService(
			{
				vault: {
					getAbstractFileByPath: vi.fn(),
				},
				workspace: {
					getActiveViewOfType: () => null,
					getLeavesOfType: () => [],
				},
			} as never,
			{} as never,
			{} as never,
			{ modifyCanvasDataAtomic } as never,
		);

		const accepted = await service.addNodeToCanvas('', null, {
			source: 'native-insert',
			parentNodeIdHint: 'parent-1',
		});

		expect(accepted).toBe(false);
		expect(modifyCanvasDataAtomic).not.toHaveBeenCalled();
	});

	it('should reject verified empty native insert without strong blank evidence', async () => {
		const modifyCanvasDataAtomic = vi.fn(async () => true);
		const service = new NodeCreationService(
			{
				vault: {
					getAbstractFileByPath: vi.fn(() => new TFile()),
				},
				workspace: {
					getActiveViewOfType: () => null,
					getLeavesOfType: () => [],
				},
			} as never,
			{} as never,
			{ canvasFilePath: 'test.canvas' } as never,
			{ modifyCanvasDataAtomic } as never,
		);

		const accepted = await service.addNodeToCanvas('', null, {
			source: 'native-insert',
			parentNodeIdHint: 'parent-1',
			verifiedNativeInsert: true,
			suppressSuccessNotice: true,
			skipFromLink: true,
		});

		expect(accepted).toBe(false);
		expect(modifyCanvasDataAtomic).not.toHaveBeenCalled();
	});

	it('should allow verified empty native insert when placeholder evidence is present', async () => {
		const modifyCanvasDataAtomic = vi.fn(async (filePath: string, updater: (data: any) => boolean) => {
			const data = { nodes: [], edges: [], canvasMindmapBuildHistory: [] };
			updater(data);
			return filePath === 'test.canvas';
		});
		const service = new NodeCreationService(
			{
				vault: {
					getAbstractFileByPath: vi.fn(() => new TFile()),
				},
				workspace: {
					getActiveViewOfType: () => null,
					getLeavesOfType: () => [],
				},
			} as never,
			{} as never,
			{ canvasFilePath: 'test.canvas' } as never,
			{ modifyCanvasDataAtomic } as never,
		);

		const accepted = await service.addNodeToCanvas('', null, {
			source: 'native-insert',
			parentNodeIdHint: 'parent-1',
			verifiedNativeInsert: true,
			blankNativeInsertEvidenceKind: 'placeholder',
			suppressSuccessNotice: true,
			skipFromLink: true,
		});

		expect(accepted).toBe(true);
		expect(modifyCanvasDataAtomic).toHaveBeenCalled();
	});

	it('should defer post-create height adjustment scheduling for native insert writes', async () => {
		const modifyCanvasDataAtomic = vi.fn(async (filePath: string, updater: (data: any) => boolean) => {
			const data = { nodes: [], edges: [], canvasMindmapBuildHistory: [] };
			updater(data);
			return filePath === 'test.canvas';
		});
		const refreshCanvasViewsForFile = vi.fn(async () => 1);
		const clearCache = vi.fn();
		const checkAndAddCollapseButtons = vi.fn();
		const scheduleNodeHeightAdjustment = vi.fn();
		const calculateTextNodeHeight = vi.fn(() => 80);
		const service = new NodeCreationService(
			{
				vault: {
					getAbstractFileByPath: vi.fn(() => new TFile()),
				},
				workspace: {
					getActiveViewOfType: () => null,
					getLeavesOfType: () => [],
				},
			} as never,
			{} as never,
			{ canvasFilePath: 'test.canvas' } as never,
			{ modifyCanvasDataAtomic } as never,
			{
				refreshCanvasViewsForFile,
				collapseStateManager: { clearCache },
				checkAndAddCollapseButtons,
				scheduleNodeHeightAdjustment,
				calculateTextNodeHeight,
			} as never,
		);

		const accepted = await service.addNodeToCanvas('', null, {
			source: 'native-insert',
			parentNodeIdHint: 'parent-1',
			verifiedNativeInsert: true,
			blankNativeInsertEvidenceKind: 'placeholder',
			suppressSuccessNotice: true,
			skipFromLink: true,
		});

		expect(accepted).toBe(true);
		expect(refreshCanvasViewsForFile).toHaveBeenCalledTimes(1);
		expect(clearCache).toHaveBeenCalledTimes(1);
		expect(checkAndAddCollapseButtons).toHaveBeenCalledTimes(1);
		expect(scheduleNodeHeightAdjustment).not.toHaveBeenCalled();
	});
});