import { App } from 'obsidian';
import { CanvasLike } from '../types';

type ActiveLeafOptions = {
    focus?: boolean;
};

export type CanvasTextNodePayload = {
    type?: string;
    text?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    [key: string]: unknown;
};

export type CanvasTextNodeCreateResult = {
    invoked: boolean;
    method: 'createTextNode' | 'addNode' | 'createNode' | 'insertNode' | null;
    result: unknown;
    accepted: boolean;
    unsafeReason: string | null;
};

type CanvasTextNodeMethodName = Exclude<CanvasTextNodeCreateResult['method'], null>;

export type CanvasRuntimeSafety = {
    safe: boolean;
    reason: string | null;
};

type CanvasRuntimePoisonState = {
    reason: string;
    at: number;
};

const CANVAS_RUNTIME_POISON_KEY = '__cmbRuntimePoisonState';

function getCanvasCollectionValues(collection: unknown): unknown[] {
    if (!collection) return [];
    if (collection instanceof Map) {
        return Array.from(collection.values());
    }
    if (Array.isArray(collection)) {
        return collection;
    }
    if (typeof collection === 'object') {
        return Object.values(collection as Record<string, unknown>);
    }
    return [];
}

function isLikelyCanvasPayloadLikeNode(node: unknown): boolean {
    if (!node || typeof node !== 'object') return false;

    const record = node as Record<string, unknown>;
    const hasRuntimeMethods = typeof record.getData === 'function'
        || typeof record.setData === 'function'
        || typeof record.update === 'function'
        || typeof record.requestUpdate === 'function'
        || typeof record.render === 'function';

    if (hasRuntimeMethods) return false;

    const hasDomReference = typeof record.nodeEl === 'object' && record.nodeEl !== null;
    if (hasDomReference) return false;

    return typeof record.type === 'string'
        || typeof record.text === 'string'
        || typeof record.x === 'number'
        || typeof record.y === 'number'
        || typeof record.width === 'number'
        || typeof record.height === 'number';
}

function getCanvasRuntimePoisonState(canvas: CanvasLike | null | undefined): CanvasRuntimePoisonState | null {
    if (!canvas) return null;

    const state = (canvas as Record<string, unknown>)[CANVAS_RUNTIME_POISON_KEY];
    if (!state || typeof state !== 'object') return null;

    const record = state as Record<string, unknown>;
    if (typeof record.reason !== 'string') return null;

    return {
        reason: record.reason,
        at: typeof record.at === 'number' ? record.at : 0,
    };
}

export function markCanvasRuntimePoisoned(canvas: CanvasLike | null | undefined, reason: string): boolean {
    if (!canvas) return false;

    (canvas as Record<string, unknown>)[CANVAS_RUNTIME_POISON_KEY] = {
        reason,
        at: Date.now(),
    } satisfies CanvasRuntimePoisonState;
    return true;
}

export function getCanvasRuntimeSafety(canvas: CanvasLike | null | undefined): CanvasRuntimeSafety {
    if (!canvas) {
        return {
            safe: false,
            reason: 'canvas-missing',
        };
    }

    const poisonedState = getCanvasRuntimePoisonState(canvas);
    if (poisonedState) {
        return {
            safe: false,
            reason: poisonedState.reason,
        };
    }

    const nodes = getCanvasCollectionValues(canvas.nodes);
    for (const node of nodes) {
        if (!isLikelyCanvasPayloadLikeNode(node)) continue;

        const reason = 'payload-like-runtime-node';
        markCanvasRuntimePoisoned(canvas, reason);
        return {
            safe: false,
            reason,
        };
    }

    return {
        safe: true,
        reason: null,
    };
}

export function requestCanvasUpdate(canvas: CanvasLike | null | undefined): boolean {
    if (!canvas) {
        return false;
    }

    const safety = getCanvasRuntimeSafety(canvas);
    if (!safety.safe) {
        return false;
    }

    if (typeof canvas.requestUpdate === 'function') {
        canvas.requestUpdate();
        return true;
    }

    if (typeof canvas.requestSave === 'function') {
        canvas.requestSave();
        return true;
    }

    return false;
}

export function requestCanvasSave(canvas: CanvasLike | null | undefined): boolean {
    if (!canvas) {
        return false;
    }

    const safety = getCanvasRuntimeSafety(canvas);
    if (!safety.safe) {
        return false;
    }

    if (typeof canvas.requestSave === 'function') {
        canvas.requestSave();
        return true;
    }

    if (typeof canvas.requestUpdate === 'function') {
        canvas.requestUpdate();
        return true;
    }

    return false;
}

export function createCanvasTextNode(
    canvas: CanvasLike | null | undefined,
    payload: CanvasTextNodePayload = { type: 'text', text: '' }
): CanvasTextNodeCreateResult {
    if (!canvas) {
        return {
            invoked: false,
            method: null,
            result: null,
            accepted: false,
            unsafeReason: null,
        };
    }

    const canvasRecord = canvas as CanvasLike & Record<string, unknown>;
    const normalizedPayload: CanvasTextNodePayload = {
        type: 'text',
        text: '',
        ...payload,
    };

    const methodOrder: CanvasTextNodeMethodName[] = ['createTextNode', 'addNode', 'createNode', 'insertNode'];
    for (const methodName of methodOrder) {
        const method = canvasRecord[methodName];
        if (typeof method !== 'function') continue;

        try {
            const result = (method as (nodePayload: CanvasTextNodePayload) => unknown).call(canvas, normalizedPayload);
            if (isLikelyCanvasPayloadLikeNode(result)) {
                markCanvasRuntimePoisoned(canvas, `payload-like-factory-result:${methodName}`);
            }

            const safety = getCanvasRuntimeSafety(canvas);
            return {
                invoked: true,
                method: methodName,
                result,
                accepted: safety.safe,
                unsafeReason: safety.reason,
            };
        } catch {
            continue;
        }
    }

    return {
        invoked: false,
        method: null,
        result: null,
        accepted: false,
        unsafeReason: null,
    };
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