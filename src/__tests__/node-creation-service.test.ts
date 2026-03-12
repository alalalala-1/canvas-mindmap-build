import { describe, expect, it, vi } from 'vitest';
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
				},
			} as never,
			{} as never,
			{} as never,
			{ modifyCanvasDataAtomic } as never,
		);

		await service.addNodeToCanvas('', null, {
			source: 'native-insert',
			parentNodeIdHint: 'parent-1',
		});

		expect(modifyCanvasDataAtomic).not.toHaveBeenCalled();
	});
});