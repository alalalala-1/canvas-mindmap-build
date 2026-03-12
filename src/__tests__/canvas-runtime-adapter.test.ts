import { describe, expect, it, vi } from 'vitest';
import { requestCanvasSave, requestCanvasUpdate, setActiveLeafSafe } from '../canvas/adapters/canvas-runtime-adapter';

describe('canvas-runtime-adapter', () => {
    it('should request update/save only when method exists', () => {
        const requestUpdate = vi.fn();
        const requestSave = vi.fn();
        const canvas = { requestUpdate, requestSave };

        expect(requestCanvasUpdate(canvas)).toBe(true);
        expect(requestCanvasSave(canvas)).toBe(true);
        expect(requestUpdate).toHaveBeenCalledTimes(1);
        expect(requestSave).toHaveBeenCalledTimes(1);
        expect(requestCanvasUpdate({})).toBe(false);
        expect(requestCanvasSave({})).toBe(false);
    });

    it('should safely proxy workspace.setActiveLeaf', () => {
        const setActiveLeaf = vi.fn();
        const app = { workspace: { setActiveLeaf } } as never;
        const leaf = { id: 'leaf-1' };

        expect(setActiveLeafSafe(app, leaf, { focus: true })).toBe(true);
        expect(setActiveLeaf).toHaveBeenCalledWith(leaf, { focus: true });
    });
});