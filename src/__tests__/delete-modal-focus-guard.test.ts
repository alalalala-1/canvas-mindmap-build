import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	clearSuspiciousDeleteModalFocusContext,
	openDeleteModalSafely,
	type DeleteModalFocusGuardHost,
} from '../canvas/event-manager/delete-modal-focus-guard';

type BlurTarget = { blur: ReturnType<typeof vi.fn> };

function createHost(activeEditor: unknown, setActiveLeafSafe = vi.fn(() => true)): DeleteModalFocusGuardHost {
	return {
		app: {
			workspace: {
				activeEditor,
				getActiveViewOfType: () => ({ getViewType: () => 'canvas' }),
			},
		} as never,
		suppressOpenEntryByFocusNormalizationUntil: 0,
		suppressOpenEntryByFocusNormalizationContext: null,
		suppressDeleteButtonClickUntil: 0,
		suppressDeleteButtonClickReason: null,
		deleteModalFocusNormalizationSuppressMs: 1200,
		describeEventTarget: (target: EventTarget | null) => (target ? 'active' : 'none'),
		getCanvasView: () => ({ leaf: {} } as never),
		setActiveLeafSafe,
	};
}

function installDocument(activeElement: Element | null, body: HTMLElement): void {
	(globalThis as Record<string, unknown>).document = {
		activeElement,
		body,
	} as unknown as Document;
}

describe('delete modal focus guard', () => {
	const originalDocument = globalThis.document;
	const originalRaf = globalThis.requestAnimationFrame;

	beforeEach(() => {
		(globalThis as Record<string, unknown>).requestAnimationFrame = ((cb: FrameRequestCallback) => {
			cb(0);
			return 1;
		}) as unknown as typeof requestAnimationFrame;
	});

	afterEach(() => {
		(globalThis as Record<string, unknown>).document = originalDocument;
		(globalThis as Record<string, unknown>).requestAnimationFrame = originalRaf;
	});

	it('should avoid leaf focus sync when activeEditor is malformed and blur the active element instead', () => {
		const body = {} as HTMLElement;
		const activeElement: BlurTarget = {
			blur: vi.fn(() => {
				installDocument(body as unknown as Element, body);
			}),
		};
		installDocument(activeElement as unknown as Element, body);
		const setActiveLeafSafe = vi.fn(() => true);
		const host = createHost({}, setActiveLeafSafe);

		const normalized = clearSuspiciousDeleteModalFocusContext(host, 'pre-close', 'node', 'node-1');

		expect(normalized).toBe(true);
		expect(setActiveLeafSafe).not.toHaveBeenCalled();
		expect(activeElement.blur).toHaveBeenCalledTimes(1);
		expect(host.suppressOpenEntryByFocusNormalizationContext).toBe('phase=pre-close,kind=node,target=node-1');
	});

	it('should install close guard and keep malformed activeEditor path safe during modal close', async () => {
		const body = {} as HTMLElement;
		const activeElement: BlurTarget = {
			blur: vi.fn(() => {
				installDocument(body as unknown as Element, body);
			}),
		};
		installDocument(activeElement as unknown as Element, body);
		const setActiveLeafSafe = vi.fn(() => true);
		const host = createHost({}, setActiveLeafSafe);
		const originalClose = vi.fn();
		const modal = {
			open: vi.fn(),
			close: originalClose,
		};

		await openDeleteModalSafely(host, modal, 'edge', 'edge-1');

		const closeActiveElement: BlurTarget = {
			blur: vi.fn(() => {
				installDocument(body as unknown as Element, body);
			}),
		};
		installDocument(closeActiveElement as unknown as Element, body);

		modal.close({ action: 'confirm' });

		expect(modal.open).toHaveBeenCalledTimes(1);
		expect(originalClose).toHaveBeenCalledTimes(1);
		expect(originalClose).toHaveBeenCalledWith({ action: 'confirm' });
		expect(setActiveLeafSafe).not.toHaveBeenCalled();
		expect(closeActiveElement.blur).toHaveBeenCalledTimes(1);
		expect(host.suppressOpenEntryByFocusNormalizationContext).toBe('phase=pre-close,kind=edge,target=edge-1');
	});
});
