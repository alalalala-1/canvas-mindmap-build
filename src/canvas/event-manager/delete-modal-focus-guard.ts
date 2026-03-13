import { App, ItemView } from 'obsidian';
import { logVerbose } from '../../utils/logger';

export interface DeleteModalFocusGuardHost {
	app: App;
	suppressOpenEntryByFocusNormalizationUntil: number;
	suppressOpenEntryByFocusNormalizationContext: string | null;
	suppressDeleteButtonClickUntil: number;
	suppressDeleteButtonClickReason: string | null;
	deleteModalFocusNormalizationSuppressMs: number;
	describeEventTarget: (target: EventTarget | null) => string;
	getCanvasView: () => ItemView | null;
	setActiveLeafSafe: (leaf: unknown, options: { focus: boolean }) => boolean;
}

export function describeDeleteModalFocusContext(host: DeleteModalFocusGuardHost): string {
	const activeViewType = host.app.workspace.getActiveViewOfType(ItemView)?.getViewType?.() || 'none';
	const activeEditorInfo = host.app.workspace.activeEditor;
	return [
		`activeView=${activeViewType}`,
		`activeEditor=${!!activeEditorInfo}`,
		`editor=${!!activeEditorInfo?.editor}`,
	].join(',');
}

export function hasSuspiciousDeleteModalFocusContext(
	host: DeleteModalFocusGuardHost,
	expectCanvasActive: boolean = false,
): boolean {
	const activeViewType = host.app.workspace.getActiveViewOfType(ItemView)?.getViewType?.() || 'none';
	const activeEditorInfo = host.app.workspace.activeEditor;
	if (expectCanvasActive && activeViewType !== 'canvas') {
		return true;
	}
	return !!activeEditorInfo && !activeEditorInfo.editor;
}

export function markSuppressOpenEntryByFocusNormalization(
	host: DeleteModalFocusGuardHost,
	phase: string,
	kind: 'node' | 'edge',
	targetId: string,
	holdMs: number = host.deleteModalFocusNormalizationSuppressMs,
): void {
	const until = Date.now() + Math.max(0, holdMs);
	if (until > host.suppressOpenEntryByFocusNormalizationUntil) {
		host.suppressOpenEntryByFocusNormalizationUntil = until;
	}
	host.suppressOpenEntryByFocusNormalizationContext = `phase=${phase},kind=${kind},target=${targetId}`;
	logVerbose(
		`[Event] OpenEntrySuppressArmed: reason=delete-modal-focus-normalization, ` +
			`phase=${phase}, kind=${kind}, target=${targetId}, holdMs=${holdMs}`,
	);
}

export function clearSuspiciousDeleteModalFocusContext(
	host: DeleteModalFocusGuardHost,
	reason: string,
	kind: 'node' | 'edge',
	targetId: string,
): boolean {
	const shouldExpectCanvasActive = true;
	const shouldNormalize = hasSuspiciousDeleteModalFocusContext(host, shouldExpectCanvasActive);
	if (!shouldNormalize) return false;

	const before = describeDeleteModalFocusContext(host);
	const activeBefore = host.describeEventTarget(document.activeElement);
	let focusedCanvasLeaf = false;

	const activeCanvasView = host.getCanvasView();
	const activeCanvasLeaf = (activeCanvasView as { leaf?: unknown } | null)?.leaf;
	if (activeCanvasLeaf) {
		focusedCanvasLeaf = host.setActiveLeafSafe(activeCanvasLeaf, { focus: true })
			&& host.app.workspace.getActiveViewOfType(ItemView)?.getViewType?.() === 'canvas';
	}

	const focusAfterLeafSync = describeDeleteModalFocusContext(host);
	let blurred = false;
	try {
		const activeElement = document.activeElement;
		if (activeElement instanceof HTMLElement && activeElement !== document.body) {
			activeElement.blur();
			blurred = document.activeElement !== activeElement;
		}
	} catch {
		// ignore blur failures on platform internals
	}

	const after = describeDeleteModalFocusContext(host);
	const normalized = focusedCanvasLeaf || blurred;
	if (normalized) {
		markSuppressOpenEntryByFocusNormalization(host, reason, kind, targetId);
	}
	logVerbose(
		`[Event] DeleteModalFocusGuard: phase=${reason}, kind=${kind}, target=${targetId}, ` +
			`focusBefore=${before}, focusAfterLeafSync=${focusAfterLeafSync}, focusAfter=${after}, ` +
			`activeBefore=${activeBefore}, activeAfter=${host.describeEventTarget(document.activeElement)}, ` +
			`focusedCanvasLeaf=${focusedCanvasLeaf}, blurred=${blurred}`,
	);
	return normalized;
}

export async function runDeleteModalOnNextFrame<T>(action: () => T | Promise<T>): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		requestAnimationFrame(() => {
			Promise.resolve()
				.then(action)
				.then(resolve)
				.catch(reject);
		});
	});
}

export async function openDeleteModalSafely(
	host: DeleteModalFocusGuardHost,
	modal: { open: () => void },
	kind: 'node' | 'edge',
	targetId: string,
): Promise<void> {
	clearSuspiciousDeleteModalFocusContext(host, 'pre-open', kind, targetId);
	logVerbose(
		`[Event] DeleteModalNormalized: kind=${kind}, target=${targetId}, ` +
			`focusContext=${describeDeleteModalFocusContext(host)}`,
	);
	await runDeleteModalOnNextFrame(() => {
		modal.open();
	});
}

export async function waitForDeleteModalFocusSettle(
	host: DeleteModalFocusGuardHost,
	kind: 'node' | 'edge',
	targetId: string,
): Promise<void> {
	clearSuspiciousDeleteModalFocusContext(host, 'post-close', kind, targetId);
	logVerbose(
		`[Event] DeleteModalPostClose: kind=${kind}, target=${targetId}, ` +
			`focusContext=${describeDeleteModalFocusContext(host)}`,
	);
	await runDeleteModalOnNextFrame(() => undefined);
}

export function markSuppressDeleteButtonClick(
	host: DeleteModalFocusGuardHost,
	holdMs: number,
	reason: string,
): void {
	host.suppressDeleteButtonClickUntil = Date.now() + Math.max(0, holdMs);
	host.suppressDeleteButtonClickReason = reason;
}

export function shouldSuppressDeleteButtonClick(host: DeleteModalFocusGuardHost, reason: string): boolean {
	const now = Date.now();
	if (now >= host.suppressDeleteButtonClickUntil) {
		return false;
	}

	logVerbose(
		`[Event] DeleteButtonClickSuppressed: phase=${reason}, ` +
			`reason=${host.suppressDeleteButtonClickReason || 'unknown'}, ` +
			`remaining=${Math.max(0, host.suppressDeleteButtonClickUntil - now)}ms`,
	);
	return true;
}