import { App, ItemView } from 'obsidian';
import { logVerbose } from '../../utils/logger';

const DELETE_MODAL_CLOSE_GUARD_KEY = '__cmbDeleteModalCloseGuardInstalled';

type DeleteModalLike = {
	open: () => void;
	close?: (...args: unknown[]) => void;
};

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
	const hasMalformedActiveEditor = !!host.app.workspace.activeEditor && !host.app.workspace.activeEditor.editor;

	const activeCanvasView = host.getCanvasView();
	const activeCanvasLeaf = (activeCanvasView as { leaf?: unknown } | null)?.leaf;
	if (activeCanvasLeaf && !hasMalformedActiveEditor) {
		focusedCanvasLeaf = host.setActiveLeafSafe(activeCanvasLeaf, { focus: false })
			&& host.app.workspace.getActiveViewOfType(ItemView)?.getViewType?.() === 'canvas';
	}

	const focusAfterLeafSync = describeDeleteModalFocusContext(host);
	let blurred = false;
	try {
		const activeElement = document.activeElement;
		if (activeElement && activeElement !== document.body && typeof (activeElement as { blur?: () => void }).blur === 'function') {
			const blurTarget = activeElement as unknown as { blur: () => void };
			blurTarget.blur();
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
			`focusedCanvasLeaf=${focusedCanvasLeaf}, avoidedLeafFocusSync=${hasMalformedActiveEditor}, blurred=${blurred}`,
	);
	return normalized;
}

function installDeleteModalCloseGuard(
	host: DeleteModalFocusGuardHost,
	modal: DeleteModalLike,
	kind: 'node' | 'edge',
	targetId: string,
): void {
	const modalRecord = modal as DeleteModalLike & { [DELETE_MODAL_CLOSE_GUARD_KEY]?: boolean };
	if (modalRecord[DELETE_MODAL_CLOSE_GUARD_KEY]) return;
	if (typeof modalRecord.close !== 'function') return;

	const originalClose = modalRecord.close.bind(modal) as (...args: unknown[]) => void;
	modalRecord.close = (...args: unknown[]) => {
		clearSuspiciousDeleteModalFocusContext(host, 'pre-close', kind, targetId);
		originalClose(...args);
	};
	modalRecord[DELETE_MODAL_CLOSE_GUARD_KEY] = true;
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
	modal: DeleteModalLike,
	kind: 'node' | 'edge',
	targetId: string,
): Promise<void> {
	installDeleteModalCloseGuard(host, modal, kind, targetId);
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