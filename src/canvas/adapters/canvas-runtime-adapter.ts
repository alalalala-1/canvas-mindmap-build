import { App } from 'obsidian';
import { CanvasLike } from '../types';

type ActiveLeafOptions = {
    focus?: boolean;
};

export function requestCanvasUpdate(canvas: CanvasLike | null | undefined): boolean {
    if (!canvas || typeof canvas.requestUpdate !== 'function') {
        return false;
    }

    canvas.requestUpdate();
    return true;
}

export function requestCanvasSave(canvas: CanvasLike | null | undefined): boolean {
    if (!canvas || typeof canvas.requestSave !== 'function') {
        return false;
    }

    canvas.requestSave();
    return true;
}

export function setActiveLeafSafe(app: App, leaf: unknown, options?: ActiveLeafOptions): boolean {
    const workspace = app?.workspace as App['workspace'] & {
        setActiveLeaf?: (targetLeaf: unknown, targetOptions?: ActiveLeafOptions) => unknown;
    };

    if (!workspace || typeof workspace.setActiveLeaf !== 'function' || !leaf) {
        return false;
    }

    try {
        workspace.setActiveLeaf(leaf, options);
        return true;
    } catch {
        return false;
    }
}