import { ItemView } from 'obsidian';
import { getCanvasView, getEdgesFromCanvas, getNodesFromCanvas } from '../../utils/canvas-utils';
import { log, logVerbose } from '../../utils/logger';
import type { CanvasLike } from '../types';
import type { NativeInsertScheduledWorkCleanup } from './native-insert-trace';

export type NativeInsertSession = {
	pointerId: number;
	pointerType: string;
	startReason: string;
	startedAt: number;
	lastSeenAt: number;
	traceId: string;
	targetKind: string;
	anchorNodeId: string | null;
	startTarget: string;
	startChain: string;
	startSelection: string;
	downDefaultPrevented: boolean;
	initialNodeCount: number;
	initialPlaceholderCount: number;
	initialWrapperStyle: string;
	wrapperDragSeen: boolean;
	placeholderSeen: boolean;
	nodeCreateSeen: boolean;
	placeholderAddedCount: number;
	placeholderRemovedCount: number;
	domNodeAddedCount: number;
	domNodeRemovedCount: number;
};

export type NativeInsertPendingCommit = {
	traceId: string;
	pointerType: string;
	startReason: string;
	targetKind: string;
	anchorNodeId: string | null;
	initialNodeCount: number;
	initialPlaceholderCount: number;
	nodeDelta: number;
	placeholderDelta: number;
	endReason: string;
	endedAt: number;
	engineAttempted: boolean;
	lastPointerDetail: number;
	clickDetail?: number;
	clickClassified?: boolean;
	commitEligibleAt?: number;
	awaitingClickClassification?: boolean;
	evidenceFlags?: string[];
	blankCandidate?: boolean;
	queuedSelectionNodeCount?: number;
	queuedSelectionEdgeCount?: number;
	queuedSelectionKey?: string;
};

export type CanvasGraphSnapshot = {
	nodeCount: number;
	edgeCount: number;
};

export interface NativeInsertControllerHost {
	app: unknown;
	canvasManager: {
		addNodeToCanvas: (content: string, sourceFile: null, options?: Record<string, unknown>) => Promise<void>;
	};
	activeNativeInsertSession: NativeInsertSession | null;
	pendingNativeInsertCommit: NativeInsertPendingCommit | null;
	nativeInsertCommitInFlight: boolean;
	lastNativeInsertCommitTraceId: string | null;
	lastNativeInsertCommitAt: number;
	nativeInsertSideEffectsSuppressUntil: number;
	nativeInsertMouseClickClassificationWindowMs: number;
	getCanvasFromView(view: ItemView): CanvasLike | null;
	createNativeInsertTraceId(pointerId: number): string;
	describeNativeInsertTargetKind(target: EventTarget | null): string;
	resolveNativeInsertAnchorNodeId(target: EventTarget | null): string | null;
	installNativeInsertEngineDiagnostics(canvas: CanvasLike | null): void;
	describeCanvasSelection(): string;
	describeEventTarget(target: EventTarget | null): string;
	describeEventTargetChain(target: EventTarget | null, maxDepth?: number): string;
	describePointerEventState(event: MouseEvent | PointerEvent): string;
	getCanvasWrapperElement(target: EventTarget | null): HTMLElement | null;
	describeComputedStyleSnapshot(el: Element | null | undefined): string;
	describeNativeInsertEngineState(): string;
	rememberNativeInsertTraceContext(input: Record<string, unknown> & { traceId: string }): void;
	clearNativeInsertScheduledWork(traceId: string | null | undefined, markSettled?: boolean): NativeInsertScheduledWorkCleanup;
	finalizeNativeInsertTrace(input: {
		traceId: string;
		outcome: 'rejected' | 'accepted' | 'error' | 'dedup-skip';
		trigger: string;
		reason: string;
		detail?: number;
		cleanup?: NativeInsertScheduledWorkCleanup;
		extraFields?: Record<string, unknown>;
	}): void;
	mergeNativeInsertScheduledWorkCleanup(
		left: NativeInsertScheduledWorkCleanup,
		right: NativeInsertScheduledWorkCleanup,
	): NativeInsertScheduledWorkCleanup;
	collectNativeInsertEvidence(input: {
		session: Pick<NativeInsertSession, 'pointerType' | 'startReason' | 'targetKind' | 'placeholderSeen' | 'placeholderAddedCount' | 'wrapperDragSeen'>;
		placeholderDelta: number;
	}): string[];
	shouldCommitNativeInsertSession(input: {
		session: Pick<NativeInsertSession, 'traceId' | 'pointerType' | 'targetKind' | 'startReason' | 'nodeCreateSeen' | 'anchorNodeId' | 'placeholderSeen' | 'placeholderAddedCount' | 'wrapperDragSeen'>;
		nodeDelta: number;
		placeholderDelta: number;
		endReason: string;
		pointerDetail: number;
	}): {
		allow: boolean;
		reason: string;
	};
	getCurrentNativeInsertSelectionSummary(): {
		nodeIds: string[];
		edgeIds: string[];
		activeEdgeId: string | null;
	};
	getNativeInsertSelectionKey(summary: { nodeIds: string[]; edgeIds: string[]; activeEdgeId: string | null }): string;
	logNativeInsertCommitWait(traceId: string, trigger: string, reason: string): void;
	isNativeInsertTraceSettled(traceId: string): boolean;
	registerNativeInsertProbePhase(traceId: string, phase: 'raf' | 'timeout-120'): boolean;
	registerNativeInsertTimeout(traceId: string, timeoutId: number): void;
	registerNativeInsertRaf(traceId: string, rafId: number): void;
	evaluateNativeInsertBlankProtection(
		candidate: NativeInsertPendingCommit,
		canvas: CanvasLike,
	): {
		allow: boolean;
		reason: string;
		blankCandidate: boolean;
		queuedSelectionNodeCount: number;
		queuedSelectionEdgeCount: number;
		selectionNodeCount: number;
		selectionEdgeCount: number;
		selectionStable: boolean;
		anchorSelected: boolean;
		weakEvidenceOnly: boolean;
	};
	scheduleDeferredPostInsertMaintenance(reason: string): void;
}

export function getCanvasGraphSnapshot(canvas: CanvasLike | null | undefined): CanvasGraphSnapshot {
	if (!canvas) {
		return {
			nodeCount: 0,
			edgeCount: 0,
		};
	}

	return {
		nodeCount: getNodesFromCanvas(canvas).length,
		edgeCount: getEdgesFromCanvas(canvas).length,
	};
}

export function queueNativeInsertCommitFlush(
	host: NativeInsertControllerHost,
	traceId: string,
	trigger: string,
	delayMs: number,
): void {
	const timeoutId = window.setTimeout(() => {
		if (host.isNativeInsertTraceSettled(traceId)) return;
		if (host.pendingNativeInsertCommit?.traceId !== traceId) return;
		void flushPendingNativeInsertCommit(host, trigger);
	}, Math.max(0, delayMs));
	host.registerNativeInsertTimeout(traceId, timeoutId);
}

export function queueNativeInsertCommitRaf(host: NativeInsertControllerHost, traceId: string, trigger: string): void {
	const rafId = requestAnimationFrame(() => {
		if (host.isNativeInsertTraceSettled(traceId)) return;
		if (host.pendingNativeInsertCommit?.traceId !== traceId) return;
		void flushPendingNativeInsertCommit(host, trigger);
	});
	host.registerNativeInsertRaf(traceId, rafId);
}

export function scheduleNativeInsertSelectionProbe(
	host: NativeInsertControllerHost,
	traceId: string,
	reason: string,
): void {
	if (host.registerNativeInsertProbePhase(traceId, 'raf')) {
		const rafId = requestAnimationFrame(() => {
			if (host.isNativeInsertTraceSettled(traceId)) return;
			logVerbose(`[Event] NativeInsertSelectionProbe: trace=${traceId}, phase=${reason}:raf, selection=${host.describeCanvasSelection()}`);
		});
		host.registerNativeInsertRaf(traceId, rafId);
	}

	if (host.registerNativeInsertProbePhase(traceId, 'timeout-120')) {
		const timeout120 = window.setTimeout(() => {
			if (host.isNativeInsertTraceSettled(traceId)) return;
			if (host.pendingNativeInsertCommit?.traceId !== traceId) return;
			if (host.nativeInsertCommitInFlight) return;
			logVerbose(
				`[Event] NativeInsertSelectionProbe: trace=${traceId}, phase=${reason}:timeout-120, selection=${host.describeCanvasSelection()}`,
			);
		}, 120);
		host.registerNativeInsertTimeout(traceId, timeout120);
	}
}

export function rejectPendingNativeInsertCommit(
	host: NativeInsertControllerHost,
	trigger: string,
	reason: string,
	detail?: number,
	extraFields?: Record<string, unknown>,
): boolean {
	const candidate = host.pendingNativeInsertCommit;
	if (!candidate) return false;

	host.rememberNativeInsertTraceContext({
		traceId: candidate.traceId,
		pointerType: candidate.pointerType,
		startReason: candidate.startReason,
		targetKind: candidate.targetKind,
		anchorNodeId: candidate.anchorNodeId,
		endReason: candidate.endReason,
		nodeDelta: candidate.nodeDelta,
		placeholderDelta: candidate.placeholderDelta,
		lastPointerDetail: detail ?? candidate.lastPointerDetail,
		clickDetail: candidate.clickDetail,
		clickClassified: candidate.clickClassified,
		awaitingClickClassification: candidate.awaitingClickClassification,
		evidenceFlags: candidate.evidenceFlags,
		blankCandidate: candidate.blankCandidate ?? true,
		queuedSelectionNodeCount: candidate.queuedSelectionNodeCount,
		queuedSelectionEdgeCount: candidate.queuedSelectionEdgeCount,
		accepted: false,
		nodeCreate: 'none',
	});

	log(
		`[Event] NativeInsertCommitRejected: trace=${candidate.traceId}, trigger=${trigger}, ` +
			`reason=${reason}, detail=${detail ?? candidate.lastPointerDetail}, target=${candidate.targetKind}, ` +
			`anchor=${candidate.anchorNodeId || 'none'}, queuedNodeDelta=${candidate.nodeDelta}, ` +
			`queuedPlaceholderDelta=${candidate.placeholderDelta}, endReason=${candidate.endReason}` +
			(extraFields
				? Object.entries(extraFields)
						.filter(([, value]) => value !== undefined)
						.map(([key, value]) => `, ${key}=${value === null ? 'none' : String(value)}`)
						.join('')
				: ''),
	);
	host.pendingNativeInsertCommit = null;
	const cleanup = host.clearNativeInsertScheduledWork(candidate.traceId, true);
	host.finalizeNativeInsertTrace({
		traceId: candidate.traceId,
		outcome: 'rejected',
		trigger,
		reason,
		detail: detail ?? candidate.lastPointerDetail,
		cleanup,
		extraFields,
	});
	return true;
}

export function stageNativeInsertCommit(
	host: NativeInsertControllerHost,
	session: NativeInsertSession,
	nodeDelta: number,
	placeholderDelta: number,
	endReason: string,
	pointerDetail: number,
): boolean {
	const evidenceFlags = host.collectNativeInsertEvidence({
		session,
		placeholderDelta,
	});
	const queuedSelectionSummary = host.getCurrentNativeInsertSelectionSummary();
	const blankCandidate = true;
	host.rememberNativeInsertTraceContext({
		traceId: session.traceId,
		pointerType: session.pointerType,
		startReason: session.startReason,
		targetKind: session.targetKind,
		anchorNodeId: session.anchorNodeId,
		endReason,
		nodeDelta,
		placeholderDelta,
		lastPointerDetail: pointerDetail,
		clickDetail: 0,
		clickClassified: false,
		awaitingClickClassification: session.pointerType === 'mouse',
		evidenceFlags,
		blankCandidate,
		queuedSelectionNodeCount: queuedSelectionSummary.nodeIds.length,
		queuedSelectionEdgeCount: queuedSelectionSummary.edgeIds.length,
		fallbackCommitted: false,
		accepted: false,
		nodeCreate: 'none',
	});

	const decision = host.shouldCommitNativeInsertSession({
		session,
		nodeDelta,
		placeholderDelta,
		endReason,
		pointerDetail,
	});

	if (!decision.allow) {
		logVerbose(
			`[Event] NativeInsertCommitSkipped: trace=${session.traceId}, reason=${decision.reason}, ` +
				`target=${session.targetKind}, anchor=${session.anchorNodeId || 'none'}, ` +
				`nodeDelta=${nodeDelta}, placeholderDelta=${placeholderDelta}, endReason=${endReason}, detail=${pointerDetail}`,
		);
		host.pendingNativeInsertCommit = null;
		const cleanup = host.clearNativeInsertScheduledWork(session.traceId, true);
		host.finalizeNativeInsertTrace({
			traceId: session.traceId,
			outcome: 'rejected',
			trigger: `session-end:${endReason}`,
			reason: decision.reason,
			detail: pointerDetail,
			cleanup,
		});
		return false;
	}

	host.clearNativeInsertScheduledWork(session.traceId, false);
	const awaitingClickClassification = session.pointerType === 'mouse';
	const commitEligibleAt = Date.now() + (awaitingClickClassification ? host.nativeInsertMouseClickClassificationWindowMs : 0);

	host.pendingNativeInsertCommit = {
		traceId: session.traceId,
		pointerType: session.pointerType,
		startReason: session.startReason,
		targetKind: session.targetKind,
		anchorNodeId: session.anchorNodeId,
		initialNodeCount: session.initialNodeCount,
		initialPlaceholderCount: session.initialPlaceholderCount,
		nodeDelta,
		placeholderDelta,
		endReason,
		endedAt: Date.now(),
		engineAttempted: false,
		lastPointerDetail: pointerDetail,
		clickDetail: 0,
		clickClassified: false,
		commitEligibleAt,
		awaitingClickClassification,
		evidenceFlags,
		blankCandidate,
		queuedSelectionNodeCount: queuedSelectionSummary.nodeIds.length,
		queuedSelectionEdgeCount: queuedSelectionSummary.edgeIds.length,
		queuedSelectionKey: host.getNativeInsertSelectionKey(queuedSelectionSummary),
	};

	host.rememberNativeInsertTraceContext({
		traceId: session.traceId,
		clickDetail: 0,
		clickClassified: false,
		awaitingClickClassification,
		evidenceFlags,
		blankCandidate,
		queuedSelectionNodeCount: queuedSelectionSummary.nodeIds.length,
		queuedSelectionEdgeCount: queuedSelectionSummary.edgeIds.length,
		fallbackCommitted: false,
		accepted: false,
		nodeCreate: 'none',
	});

	log(
		`[Event] NativeInsertCommitQueued: trace=${session.traceId}, reason=${decision.reason}, ` +
			`target=${session.targetKind}, anchor=${session.anchorNodeId || 'none'}, ` +
			`nodeDelta=${nodeDelta}, placeholderDelta=${placeholderDelta}, endReason=${endReason}, detail=${pointerDetail}, ` +
			`awaitClick=${awaitingClickClassification}, blankCandidate=${blankCandidate}, ` +
			`queuedSelectionNodes=${queuedSelectionSummary.nodeIds.length}, queuedSelectionEdges=${queuedSelectionSummary.edgeIds.length}, ` +
			`evidence=${evidenceFlags.join('|') || 'none'}`,
	);

	if (awaitingClickClassification) {
		logVerbose(
			`[Event] NativeInsertCommitDeferred: trace=${session.traceId}, reason=await-click-classification, ` +
				`waitMs=${host.nativeInsertMouseClickClassificationWindowMs}, evidence=${evidenceFlags.join('|') || 'none'}`,
		);
		queueNativeInsertCommitFlush(host, session.traceId, 'session-end:mouse-classify-timeout', host.nativeInsertMouseClickClassificationWindowMs);
		return true;
	}

	queueNativeInsertCommitFlush(host, session.traceId, 'session-end:timeout-0', 0);
	queueNativeInsertCommitRaf(host, session.traceId, 'session-end:raf');
	queueNativeInsertCommitFlush(host, session.traceId, 'session-end:timeout-120', 120);
	return true;
}

export async function flushPendingNativeInsertCommit(host: NativeInsertControllerHost, trigger: string): Promise<void> {
	const candidate = host.pendingNativeInsertCommit;
	if (!candidate) return;

	host.rememberNativeInsertTraceContext({
		traceId: candidate.traceId,
		pointerType: candidate.pointerType,
		startReason: candidate.startReason,
		targetKind: candidate.targetKind,
		anchorNodeId: candidate.anchorNodeId,
		endReason: candidate.endReason,
		nodeDelta: candidate.nodeDelta,
		placeholderDelta: candidate.placeholderDelta,
		lastPointerDetail: candidate.lastPointerDetail,
		clickDetail: candidate.clickDetail,
		clickClassified: candidate.clickClassified,
		awaitingClickClassification: candidate.awaitingClickClassification,
		evidenceFlags: candidate.evidenceFlags,
		blankCandidate: candidate.blankCandidate ?? true,
		queuedSelectionNodeCount: candidate.queuedSelectionNodeCount,
		queuedSelectionEdgeCount: candidate.queuedSelectionEdgeCount,
		fallbackCommitted: false,
		accepted: false,
		nodeCreate: 'none',
	});

	const combinedClickDetail = Math.max(candidate.lastPointerDetail || 0, candidate.clickDetail || 0);
	if ((trigger === 'click-post-session' || trigger === 'dblclick-post-session') && combinedClickDetail >= 2) {
		rejectPendingNativeInsertCommit(host, trigger, 'multi-click', combinedClickDetail);
		return;
	}

	if (candidate.pointerType === 'mouse') {
		const commitEligibleAt = candidate.commitEligibleAt ?? candidate.endedAt;
		if (combinedClickDetail >= 2) {
			rejectPendingNativeInsertCommit(host, trigger, 'multi-click', combinedClickDetail);
			return;
		}

		if (!candidate.clickClassified) {
			if (Date.now() < commitEligibleAt) {
				host.logNativeInsertCommitWait(candidate.traceId, trigger, 'await-click-classification');
				return;
			}

			candidate.clickClassified = true;
			candidate.clickDetail = Math.max(candidate.clickDetail || 0, combinedClickDetail, 1);
			host.rememberNativeInsertTraceContext({
				traceId: candidate.traceId,
				clickDetail: candidate.clickDetail,
				clickClassified: true,
				awaitingClickClassification: candidate.awaitingClickClassification,
				lastPointerDetail: candidate.lastPointerDetail,
			});
			logVerbose(
				`[Event] NativeInsertClickClassified: trace=${candidate.traceId}, trigger=${trigger}, ` +
					`detail=${candidate.clickDetail}, evidence=${candidate.evidenceFlags?.join('|') || 'none'}`,
			);
		}
	}

	if (host.nativeInsertCommitInFlight) {
		host.logNativeInsertCommitWait(candidate.traceId, trigger, 'in-flight');
		return;
	}

	if (host.lastNativeInsertCommitTraceId === candidate.traceId && Date.now() - host.lastNativeInsertCommitAt < 1500) {
		host.pendingNativeInsertCommit = null;
		const cleanup = host.clearNativeInsertScheduledWork(candidate.traceId, true);
		host.finalizeNativeInsertTrace({
			traceId: candidate.traceId,
			outcome: 'dedup-skip',
			trigger,
			reason: 'recent-commit-dedup',
			detail: combinedClickDetail || candidate.lastPointerDetail,
			cleanup,
		});
		return;
	}

	const ageMs = Date.now() - candidate.endedAt;
	const canvasView = getCanvasView(host.app as never);
	const canvas = canvasView ? host.getCanvasFromView(canvasView) : null;

	if (!canvas) {
		if (ageMs > 1200) {
			rejectPendingNativeInsertCommit(host, trigger, 'no-canvas-expired', undefined, {
				age: `${ageMs}ms`,
			});
		}
		return;
	}

	const currentSnapshot = getCanvasGraphSnapshot(canvas);
	if (currentSnapshot.nodeCount > candidate.initialNodeCount) {
		rejectPendingNativeInsertCommit(host, trigger, 'node-count-increased', undefined, {
			initialNodeCount: candidate.initialNodeCount,
			currentNodeCount: currentSnapshot.nodeCount,
			currentEdgeCount: currentSnapshot.edgeCount,
		});
		return;
	}

	const blankProtection = host.evaluateNativeInsertBlankProtection(candidate, canvas);
	host.rememberNativeInsertTraceContext({
		traceId: candidate.traceId,
		blankCandidate: blankProtection.blankCandidate,
		queuedSelectionNodeCount: blankProtection.queuedSelectionNodeCount,
		queuedSelectionEdgeCount: blankProtection.queuedSelectionEdgeCount,
		selectionNodeCount: blankProtection.selectionNodeCount,
		selectionEdgeCount: blankProtection.selectionEdgeCount,
		selectionStable: blankProtection.selectionStable,
		fallbackCommitted: false,
		accepted: false,
		nodeCreate: 'none',
	});
	if (!blankProtection.allow) {
		rejectPendingNativeInsertCommit(host, trigger, blankProtection.reason, undefined, {
			anchorSelected: blankProtection.anchorSelected,
			weakEvidenceOnly: blankProtection.weakEvidenceOnly,
		});
		return;
	}

	host.nativeInsertCommitInFlight = true;
	const preCommitCleanup = host.clearNativeInsertScheduledWork(candidate.traceId, false);
	try {
		log(
			`[Event] NativeInsertCommitStart: trace=${candidate.traceId}, trigger=${trigger}, ` +
				`mode=file-fallback, pointerType=${candidate.pointerType}, startReason=${candidate.startReason}, ` +
				`target=${candidate.targetKind}, anchor=${candidate.anchorNodeId || 'none'}, ` +
				`initialNodeCount=${candidate.initialNodeCount}, currentNodeCount=${currentSnapshot.nodeCount}, ` +
				`currentEdgeCount=${currentSnapshot.edgeCount}, queuedNodeDelta=${candidate.nodeDelta}, ` +
				`queuedPlaceholderDelta=${candidate.placeholderDelta}, endReason=${candidate.endReason}, age=${ageMs}ms`,
		);
		log(
			`[Event] NativeInsertCommitFallback: trace=${candidate.traceId}, trigger=${trigger}, ` +
				`anchor=${candidate.anchorNodeId || 'none'}, engineAttempted=${candidate.engineAttempted}, ` +
				`runtimeCreate=disabled, beforeNodes=${currentSnapshot.nodeCount}, beforeEdges=${currentSnapshot.edgeCount}, age=${ageMs}ms`,
		);

		await host.canvasManager.addNodeToCanvas('', null, {
			source: 'native-insert',
			parentNodeIdHint: candidate.anchorNodeId,
			suppressSuccessNotice: true,
			skipFromLink: true,
			verifiedNativeInsert: true,
		});

		const refreshedCanvasView = getCanvasView(host.app as never);
		const refreshedCanvas = refreshedCanvasView ? host.getCanvasFromView(refreshedCanvasView) : canvas;
		const afterSnapshot = getCanvasGraphSnapshot(refreshedCanvas ?? canvas);
		const observedNodeDelta = afterSnapshot.nodeCount - currentSnapshot.nodeCount;
		const observedEdgeDelta = afterSnapshot.edgeCount - currentSnapshot.edgeCount;
		const nodeCreate = observedNodeDelta > 0 ? 'observed' : 'deferred-or-unobserved';

		host.rememberNativeInsertTraceContext({
			traceId: candidate.traceId,
			selectionNodeCount: blankProtection.selectionNodeCount,
			selectionEdgeCount: blankProtection.selectionEdgeCount,
			selectionStable: blankProtection.selectionStable,
			fallbackCommitted: true,
			accepted: true,
			nodeCreate,
		});

		host.pendingNativeInsertCommit = null;
		host.lastNativeInsertCommitTraceId = candidate.traceId;
		host.lastNativeInsertCommitAt = Date.now();
		const cleanup = host.mergeNativeInsertScheduledWorkCleanup(
			preCommitCleanup,
			host.clearNativeInsertScheduledWork(candidate.traceId, true),
		);
		log(
			`[Event] NativeInsertCommitDone: trace=${candidate.traceId}, trigger=${trigger}, ` +
				`mode=file-fallback, anchor=${candidate.anchorNodeId || 'none'}, accepted=true, ` +
				`nodeCreate=${nodeCreate}, nodeDelta=${observedNodeDelta}, edgeDelta=${observedEdgeDelta}, ` +
				`beforeNodes=${currentSnapshot.nodeCount}, afterNodes=${afterSnapshot.nodeCount}, ` +
				`beforeEdges=${currentSnapshot.edgeCount}, afterEdges=${afterSnapshot.edgeCount}`,
		);
		host.finalizeNativeInsertTrace({
			traceId: candidate.traceId,
			outcome: 'accepted',
			trigger,
			reason: 'file-fallback',
			detail: combinedClickDetail || candidate.lastPointerDetail,
			cleanup,
			extraFields: {
				anchorSelected: blankProtection.anchorSelected,
				weakEvidenceOnly: blankProtection.weakEvidenceOnly,
				observedNodeDelta,
				observedEdgeDelta,
				beforeNodes: currentSnapshot.nodeCount,
				afterNodes: afterSnapshot.nodeCount,
				beforeEdges: currentSnapshot.edgeCount,
				afterEdges: afterSnapshot.edgeCount,
			},
		});
	} catch (error) {
		log(`[Event] NativeInsertCommitError: trace=${candidate.traceId}, trigger=${trigger}, error=${String(error)}`);
		if (trigger === 'click-post-session' || ageMs > 1200) {
			host.pendingNativeInsertCommit = null;
			const cleanup = host.mergeNativeInsertScheduledWorkCleanup(
				preCommitCleanup,
				host.clearNativeInsertScheduledWork(candidate.traceId, true),
			);
			host.finalizeNativeInsertTrace({
				traceId: candidate.traceId,
				outcome: 'error',
				trigger,
				reason: 'commit-error',
				detail: combinedClickDetail || candidate.lastPointerDetail,
				cleanup,
				extraFields: {
					error: String(error),
					age: `${ageMs}ms`,
				},
			});
		} else if (host.pendingNativeInsertCommit?.traceId === candidate.traceId) {
			queueNativeInsertCommitFlush(host, candidate.traceId, `${trigger}:retry-timeout-120`, 120);
		}
	} finally {
		host.nativeInsertCommitInFlight = false;
	}
}

export function evaluateNativeInsertSessionStart(
	host: NativeInsertControllerHost,
	pointerType: string,
	target: EventTarget | null,
): {
	candidate: boolean;
	allow: boolean;
	reason: string;
	targetKind: string;
} {
	if (!(target instanceof Element)) {
		return {
			candidate: false,
			allow: false,
			reason: 'non-element',
			targetKind: 'non-element',
		};
	}

	if (target.closest('.canvas-node-connection-point')) {
		return {
			candidate: true,
			allow: false,
			reason: 'edge-connect',
			targetKind: 'edge-connect',
		};
	}

	const candidate = !!target.closest('.node-insert-event, .canvas-wrapper.node-insert-event, .canvas-node-placeholder');
	const targetKind = host.describeNativeInsertTargetKind(target);
	if (!candidate) {
		return {
			candidate: false,
			allow: false,
			reason: 'not-native-target',
			targetKind,
		};
	}

	if (targetKind === 'placeholder') {
		return {
			candidate: true,
			allow: true,
			reason: 'placeholder',
			targetKind,
		};
	}

	if (targetKind.startsWith('node-content')) {
		return {
			candidate: true,
			allow: true,
			reason: 'node-content',
			targetKind,
		};
	}

	if (targetKind.startsWith('wrapper')) {
		const insertWrapper = target.closest('.canvas-wrapper.node-insert-event');
		const wrapperActive =
			insertWrapper instanceof HTMLElement
			&& (insertWrapper.classList.contains('is-dragging') || insertWrapper.classList.contains('mod-animating'));

		if (wrapperActive) {
			return {
				candidate: true,
				allow: true,
				reason: 'wrapper-active',
				targetKind,
			};
		}

		const hasPlaceholder = !!document.querySelector('.canvas-node-placeholder');
		if (hasPlaceholder) {
			return {
				candidate: true,
				allow: true,
				reason: 'wrapper-placeholder-present',
				targetKind,
			};
		}

		if (pointerType === 'touch' || pointerType === 'pen') {
			return {
				candidate: true,
				allow: true,
				reason: 'wrapper-touch-like',
				targetKind,
			};
		}

		return {
			candidate: true,
			allow: false,
			reason: 'empty-wrapper-idle',
			targetKind,
		};
	}

	return {
		candidate: true,
		allow: false,
		reason: `unsupported-kind:${targetKind}`,
		targetKind,
	};
}

export function startNativeInsertSession(
	host: NativeInsertControllerHost,
	pointerId: number,
	pointerType: string,
	target: EventTarget | null,
	event: PointerEvent,
	startReason: string = 'direct',
): void {
	const now = Date.now();
	const placeholderSeen = target instanceof HTMLElement && !!target.closest('.canvas-node-placeholder');
	const traceId = host.createNativeInsertTraceId(pointerId);
	const wrapperEl = host.getCanvasWrapperElement(target);
	const canvasView = getCanvasView(host.app as never);
	const canvas = canvasView ? host.getCanvasFromView(canvasView) : null;
	const anchorNodeId = host.resolveNativeInsertAnchorNodeId(target);
	host.installNativeInsertEngineDiagnostics(canvas);
	const initialNodeCount = canvas ? getNodesFromCanvas(canvas).length : 0;
	const initialPlaceholderCount = document.querySelectorAll('.canvas-node-placeholder').length;
	const startSelection = host.describeCanvasSelection();

	host.activeNativeInsertSession = {
		pointerId,
		pointerType,
		startReason,
		startedAt: now,
		lastSeenAt: now,
		traceId,
		targetKind: host.describeNativeInsertTargetKind(target),
		anchorNodeId,
		startTarget: host.describeEventTarget(target),
		startChain: host.describeEventTargetChain(target),
		startSelection,
		downDefaultPrevented: event.defaultPrevented,
		initialNodeCount,
		initialPlaceholderCount,
		initialWrapperStyle: host.describeComputedStyleSnapshot(wrapperEl),
		wrapperDragSeen: false,
		placeholderSeen,
		nodeCreateSeen: false,
		placeholderAddedCount: placeholderSeen ? 1 : 0,
		placeholderRemovedCount: 0,
		domNodeAddedCount: 0,
		domNodeRemovedCount: 0,
	};

	host.rememberNativeInsertTraceContext({
		traceId,
		pointerType,
		startReason,
		targetKind: host.activeNativeInsertSession.targetKind,
		anchorNodeId,
		clickDetail: 0,
		clickClassified: false,
		awaitingClickClassification: false,
	});
	host.nativeInsertSideEffectsSuppressUntil = Math.max(host.nativeInsertSideEffectsSuppressUntil, now + 1200);
	log(
		`[Event] NativeInsertSessionStart: trace=${traceId}, pointer=${pointerId}, pointerType=${pointerType}, ` +
			`startReason=${startReason}, ` +
			`target=${host.activeNativeInsertSession.targetKind}, anchor=${anchorNodeId || 'none'}, eventTarget=${host.describeEventTarget(target)}, ` +
			`chain=${host.describeEventTargetChain(target)}, flags=${host.describePointerEventState(event)}, ` +
			`wrapperStyle=${host.activeNativeInsertSession.initialWrapperStyle}, selection=${startSelection}, ` +
			`engine=${host.describeNativeInsertEngineState()}`,
	);
	if (placeholderSeen) {
		logVerbose(`[Event] NativeInsertPlaceholderSeen: trace=${traceId}, pointer=${pointerId}, via=session-start`);
	}
}

export function touchNativeInsertSession(host: NativeInsertControllerHost, target: EventTarget | null): void {
	const session = host.activeNativeInsertSession;
	if (!session) return;

	session.lastSeenAt = Date.now();
	host.nativeInsertSideEffectsSuppressUntil = Math.max(host.nativeInsertSideEffectsSuppressUntil, session.lastSeenAt + 900);

	if (!(target instanceof Element)) return;

	if (!session.placeholderSeen && target.closest('.canvas-node-placeholder')) {
		session.placeholderSeen = true;
		session.placeholderAddedCount += 1;
		logVerbose(
			`[Event] NativeInsertPlaceholderSeen: trace=${session.traceId}, pointer=${session.pointerId}, ` +
				`target=${host.describeEventTarget(target)}, chain=${host.describeEventTargetChain(target)}, ` +
				`targetStyle=${host.describeComputedStyleSnapshot(target)}`,
		);
	}

	const insertWrapper = target.closest('.canvas-wrapper.node-insert-event');
	const wrapperDragging =
		insertWrapper instanceof HTMLElement
		&& (insertWrapper.classList.contains('is-dragging') || insertWrapper.classList.contains('mod-animating'));
	if (wrapperDragging && !session.wrapperDragSeen) {
		session.wrapperDragSeen = true;
		log(
			`[Event] NativeInsertWrapperDragSeen: trace=${session.traceId}, pointer=${session.pointerId}, ` +
				`target=${host.describeEventTarget(target)}, chain=${host.describeEventTargetChain(target)}, ` +
				`wrapperStyle=${host.describeComputedStyleSnapshot(insertWrapper)}`,
		);
	}
}

export function endNativeInsertSession(
	host: NativeInsertControllerHost,
	pointerId: number,
	reason: string,
	target: EventTarget | null,
	event?: PointerEvent,
): void {
	const session = host.activeNativeInsertSession;
	if (!session || session.pointerId !== pointerId) return;

	touchNativeInsertSession(host, target);
	const duration = Date.now() - session.startedAt;
	const wrapperEl = host.getCanvasWrapperElement(target);
	const canvasView = getCanvasView(host.app as never);
	const canvas = canvasView ? host.getCanvasFromView(canvasView) : null;
	const finalNodeCount = canvas ? getNodesFromCanvas(canvas).length : 0;
	const finalPlaceholderCount = document.querySelectorAll('.canvas-node-placeholder').length;
	const nodeDelta = finalNodeCount - session.initialNodeCount;
	const placeholderDelta = finalPlaceholderCount - session.initialPlaceholderCount;
	const pointerDetail = typeof event?.detail === 'number' ? event.detail : 0;
	const endSelection = host.describeCanvasSelection();

	log(
		`[Event] NativeInsertSessionEnd: trace=${session.traceId}, pointer=${pointerId}, pointerType=${session.pointerType}, ` +
			`duration=${duration}ms, startReason=${session.startReason}, target=${session.targetKind}, wrapperDrag=${session.wrapperDragSeen}, ` +
			`anchor=${session.anchorNodeId || 'none'}, ` +
			`placeholder=${session.placeholderSeen}, nodeCreate=${session.nodeCreateSeen}, ` +
			`placeholderAdds=${session.placeholderAddedCount}, placeholderRemoves=${session.placeholderRemovedCount}, ` +
			`domNodeAdds=${session.domNodeAddedCount}, domNodeRemoves=${session.domNodeRemovedCount}, ` +
			`nodeDelta=${nodeDelta}, placeholderDelta=${placeholderDelta}, reason=${reason}, ` +
			`flags=${event ? host.describePointerEventState(event) : 'none'}, ` +
			`selectionStart=${session.startSelection}, selectionEnd=${endSelection}`,
	);

	if (!session.nodeCreateSeen) {
		logVerbose(
			`[Event] NativeInsertDiagnostics: trace=${session.traceId}, downDefaultPrevented=${session.downDefaultPrevented}, ` +
				`startTarget=${session.startTarget}, startChain=${session.startChain}, ` +
				`startWrapperStyle=${session.initialWrapperStyle}, endTarget=${host.describeEventTarget(target)}, ` +
				`anchor=${session.anchorNodeId || 'none'}, ` +
				`endChain=${host.describeEventTargetChain(target)}, endTargetStyle=${host.describeComputedStyleSnapshot(target instanceof Element ? target : null)}, ` +
				`endWrapperStyle=${host.describeComputedStyleSnapshot(wrapperEl)}, placeholdersNow=${finalPlaceholderCount}, ` +
				`activeElement=${host.describeEventTarget(document.activeElement)}, selection=${endSelection}, ` +
				`engine=${host.describeNativeInsertEngineState()}`,
		);
	}

	const commitQueued = stageNativeInsertCommit(host, session, nodeDelta, placeholderDelta, reason, pointerDetail);
	if (commitQueued) {
		const pendingCommit = host.pendingNativeInsertCommit;
		if (!pendingCommit?.awaitingClickClassification) {
			scheduleNativeInsertSelectionProbe(host, session.traceId, reason);
		}
	}

	host.activeNativeInsertSession = null;
	host.nativeInsertSideEffectsSuppressUntil = Math.max(host.nativeInsertSideEffectsSuppressUntil, Date.now() + 700);
	host.scheduleDeferredPostInsertMaintenance(`native-insert-end:${reason}`);
}