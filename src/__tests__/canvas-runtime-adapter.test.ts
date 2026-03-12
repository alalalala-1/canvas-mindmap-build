import { describe, expect, it, vi } from 'vitest';
import {
    createCanvasTextNode,
    getCanvasRuntimeSafety,
    markCanvasRuntimePoisoned,
    requestCanvasSave,
    requestCanvasUpdate,
    setActiveLeafSafe,
} from '../canvas/adapters/canvas-runtime-adapter';

describe('canvas-runtime-adapter', () => {
    it('should request update/save with runtime fallback when only one method exists', () => {
        const requestUpdate = vi.fn();
        const requestSave = vi.fn();
        const canvas = { requestUpdate, requestSave };
        const updateOnlyCanvas = { requestUpdate: vi.fn() };
        const saveOnlyCanvas = { requestSave: vi.fn() };

        expect(requestCanvasUpdate(canvas)).toBe(true);
        expect(requestCanvasSave(canvas)).toBe(true);
        expect(requestUpdate).toHaveBeenCalledTimes(1);
        expect(requestSave).toHaveBeenCalledTimes(1);

        expect(requestCanvasUpdate(saveOnlyCanvas)).toBe(true);
        expect(saveOnlyCanvas.requestSave).toHaveBeenCalledTimes(1);

        expect(requestCanvasSave(updateOnlyCanvas)).toBe(true);
        expect(updateOnlyCanvas.requestUpdate).toHaveBeenCalledTimes(1);

        expect(requestCanvasUpdate({})).toBe(false);
        expect(requestCanvasSave({})).toBe(false);
    });

    it('should create text node via available canvas factory fallback order', () => {
        const createTextNode = vi.fn(() => 'node-from-createTextNode');
        const addNode = vi.fn(() => 'node-from-addNode');

        expect(createCanvasTextNode({ createTextNode, addNode }, { text: '' })).toEqual({
            invoked: true,
            method: 'createTextNode',
            result: 'node-from-createTextNode',
            accepted: true,
            unsafeReason: null,
        });
        expect(createTextNode).toHaveBeenCalledTimes(1);
        expect(addNode).not.toHaveBeenCalled();

        const addNodeOnly = vi.fn(() => 'node-from-addNode');
        expect(createCanvasTextNode({ addNode: addNodeOnly }, { text: '' })).toEqual({
            invoked: true,
            method: 'addNode',
            result: 'node-from-addNode',
            accepted: true,
            unsafeReason: null,
        });

        const createNode = vi.fn(() => 'node-from-createNode');
        const createTextNodeThrows = vi.fn(() => {
            throw new Error('unsupported');
        });
        expect(createCanvasTextNode({ createTextNode: createTextNodeThrows, createNode }, { text: '' })).toEqual({
            invoked: true,
            method: 'createNode',
            result: 'node-from-createNode',
            accepted: true,
            unsafeReason: null,
        });

        expect(createCanvasTextNode({}, { text: '' })).toEqual({
            invoked: false,
            method: null,
            result: null,
            accepted: false,
            unsafeReason: null,
        });
    });

    it('should mark runtime unsafe when factory returns payload-like node and block save update', () => {
        const requestUpdate = vi.fn();
        const requestSave = vi.fn();
        const canvas = {
            requestUpdate,
            requestSave,
            createTextNode: vi.fn(() => ({ type: 'text', text: '', x: 10, y: 20 })),
            nodes: {},
        };

        expect(createCanvasTextNode(canvas, { text: '' })).toEqual({
            invoked: true,
            method: 'createTextNode',
            result: { type: 'text', text: '', x: 10, y: 20 },
            accepted: false,
            unsafeReason: 'payload-like-factory-result:createTextNode',
        });
        expect(getCanvasRuntimeSafety(canvas)).toEqual({
            safe: false,
            reason: 'payload-like-factory-result:createTextNode',
        });
        expect(requestCanvasUpdate(canvas)).toBe(false);
        expect(requestCanvasSave(canvas)).toBe(false);
        expect(requestUpdate).not.toHaveBeenCalled();
        expect(requestSave).not.toHaveBeenCalled();
    });

    it('should mark runtime unsafe when payload-like node already exists in canvas nodes', () => {
        const requestUpdate = vi.fn();
        const canvas = {
            requestUpdate,
            nodes: {
                unsafe1: { type: 'text' as const, text: '', x: 0, y: 0 },
            },
        };

        expect(getCanvasRuntimeSafety(canvas)).toEqual({
            safe: false,
            reason: 'payload-like-runtime-node',
        });
        expect(requestCanvasUpdate(canvas)).toBe(false);
        expect(requestUpdate).not.toHaveBeenCalled();
    });

    it('should block save update when runtime was explicitly poisoned', () => {
        const requestUpdate = vi.fn();
        const requestSave = vi.fn();
        const canvas = { requestUpdate, requestSave, nodes: {} };

        expect(markCanvasRuntimePoisoned(canvas, 'manual-test-poison')).toBe(true);
        expect(getCanvasRuntimeSafety(canvas)).toEqual({
            safe: false,
            reason: 'manual-test-poison',
        });
        expect(requestCanvasUpdate(canvas)).toBe(false);
        expect(requestCanvasSave(canvas)).toBe(false);
        expect(requestUpdate).not.toHaveBeenCalled();
        expect(requestSave).not.toHaveBeenCalled();
    });

    it('should safely proxy workspace.setActiveLeaf', () => {
        const setActiveLeaf = vi.fn();
        const app = { workspace: { setActiveLeaf } } as never;
        const leaf = { id: 'leaf-1' };

        expect(setActiveLeafSafe(app, leaf, { focus: true })).toBe(true);
        expect(setActiveLeaf).toHaveBeenCalledWith(leaf, { focus: true });
    });
});