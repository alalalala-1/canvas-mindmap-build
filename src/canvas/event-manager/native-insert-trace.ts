import { log, logVerbose } from '../../utils/logger';

export type NativeInsertTraceContext = {
	traceId: string;
	pointerType?: string;
	startReason?: string;
	targetKind?: string;
	anchorNodeId?: string | null;
	endReason?: string;
	nodeDelta?: number;
	placeholderDelta?: number;
	lastPointerDetail?: number;
	clickDetail?: number;
	clickClassified?: boolean;
	awaitingClickClassification?: boolean;
	evidenceFlags?: string[];
	blankCandidate?: boolean;
	queuedSelectionNodeCount?: number;
	queuedSelectionEdgeCount?: number;
	selectionNodeCount?: number;
	selectionEdgeCount?: number;
	selectionStable?: boolean;
	fallbackCommitted?: boolean;
	accepted?: boolean;
	nodeCreate?: string;
	updatedAt: number;
};

export type NativeInsertTraceContextInput = Omit<Partial<NativeInsertTraceContext>, 'updatedAt'> & { traceId: string };

export type NativeInsertScheduledWorkCleanup = {
	clearedTimeoutCount: number;
	clearedRafCount: number;
	clearedProbePhaseCount: number;
	markedSettled: boolean;
};

export type NativeInsertTraceOutcome = 'rejected' | 'accepted' | 'error' | 'dedup-skip';
export type NativeInsertPostSessionPhase = 'click-post-session' | 'dblclick-post-session';
export type NativeInsertProbePhase = 'raf' | 'timeout-120';

export type NativeInsertTraceState = {
	nativeInsertTraceTimeouts: Map<string, Set<number>>;
	nativeInsertTraceRafs: Map<string, Set<number>>;
	nativeInsertSettledTraceAt: Map<string, number>;
	nativeInsertProbePhasesByTrace: Map<string, Set<string>>;
	nativeInsertPostSessionPhasesByTrace: Map<string, Set<string>>;
	nativeInsertTraceContextById: Map<string, NativeInsertTraceContext>;
	nativeInsertTraceSummaryLoggedAt: Map<string, number>;
	lastNativeInsertCommitWaitKey: string | null;
};

function formatNativeInsertExtraFields(extraFields?: Record<string, unknown>): string {
	if (!extraFields) return '';

	const fields = Object.entries(extraFields)
		.filter(([, value]) => value !== undefined)
		.map(([key, value]) => `${key}=${value === null ? 'none' : String(value)}`);

	return fields.length > 0 ? `, ${fields.join(', ')}` : '';
}

export function pruneSettledNativeInsertTraces(state: NativeInsertTraceState): void {
	const cutoff = Date.now() - 5000;
	for (const [traceId, settledAt] of state.nativeInsertSettledTraceAt.entries()) {
		if (settledAt < cutoff) {
			state.nativeInsertSettledTraceAt.delete(traceId);
		}
	}
}

export function isNativeInsertTraceSettled(state: NativeInsertTraceState, traceId: string): boolean {
	pruneSettledNativeInsertTraces(state);
	return state.nativeInsertSettledTraceAt.has(traceId);
}

export function markNativeInsertTraceSettled(state: NativeInsertTraceState, traceId: string): void {
	state.nativeInsertSettledTraceAt.set(traceId, Date.now());
	if (state.lastNativeInsertCommitWaitKey?.startsWith(`${traceId}|`)) {
		state.lastNativeInsertCommitWaitKey = null;
	}
	pruneSettledNativeInsertTraces(state);
}

export function pruneNativeInsertTraceDiagnostics(state: NativeInsertTraceState): void {
	const cutoff = Date.now() - 8000;
	for (const [traceId, context] of state.nativeInsertTraceContextById.entries()) {
		if (context.updatedAt < cutoff) {
			state.nativeInsertTraceContextById.delete(traceId);
		}
	}

	for (const [traceId, loggedAt] of state.nativeInsertTraceSummaryLoggedAt.entries()) {
		if (loggedAt < cutoff) {
			state.nativeInsertTraceSummaryLoggedAt.delete(traceId);
		}
	}
}

export function rememberNativeInsertTraceContext(state: NativeInsertTraceState, input: NativeInsertTraceContextInput): void {
	const previous = state.nativeInsertTraceContextById.get(input.traceId);
	const next: NativeInsertTraceContext = {
		traceId: input.traceId,
		pointerType: input.pointerType ?? previous?.pointerType,
		startReason: input.startReason ?? previous?.startReason,
		targetKind: input.targetKind ?? previous?.targetKind,
		anchorNodeId: input.anchorNodeId ?? previous?.anchorNodeId,
		endReason: input.endReason ?? previous?.endReason,
		nodeDelta: input.nodeDelta ?? previous?.nodeDelta,
		placeholderDelta: input.placeholderDelta ?? previous?.placeholderDelta,
		lastPointerDetail: input.lastPointerDetail ?? previous?.lastPointerDetail,
		clickDetail: input.clickDetail ?? previous?.clickDetail,
		clickClassified: input.clickClassified ?? previous?.clickClassified,
		awaitingClickClassification: input.awaitingClickClassification ?? previous?.awaitingClickClassification,
		evidenceFlags: input.evidenceFlags ?? previous?.evidenceFlags,
		blankCandidate: input.blankCandidate ?? previous?.blankCandidate,
		queuedSelectionNodeCount: input.queuedSelectionNodeCount ?? previous?.queuedSelectionNodeCount,
		queuedSelectionEdgeCount: input.queuedSelectionEdgeCount ?? previous?.queuedSelectionEdgeCount,
		selectionNodeCount: input.selectionNodeCount ?? previous?.selectionNodeCount,
		selectionEdgeCount: input.selectionEdgeCount ?? previous?.selectionEdgeCount,
		selectionStable: input.selectionStable ?? previous?.selectionStable,
		fallbackCommitted: input.fallbackCommitted ?? previous?.fallbackCommitted,
		accepted: input.accepted ?? previous?.accepted,
		nodeCreate: input.nodeCreate ?? previous?.nodeCreate,
		updatedAt: Date.now(),
	};

	state.nativeInsertTraceContextById.set(input.traceId, next);
	pruneNativeInsertTraceDiagnostics(state);
}

export function registerNativeInsertPostSessionPhase(
	state: NativeInsertTraceState,
	traceId: string,
	phase: NativeInsertPostSessionPhase,
): boolean {
	const phaseSet = state.nativeInsertPostSessionPhasesByTrace.get(traceId) ?? new Set<string>();
	if (phaseSet.has(phase)) {
		return false;
	}
	phaseSet.add(phase);
	state.nativeInsertPostSessionPhasesByTrace.set(traceId, phaseSet);
	return true;
}

export function finalizeNativeInsertTrace(
	state: NativeInsertTraceState,
	input: {
		traceId: string;
		outcome: NativeInsertTraceOutcome;
		trigger: string;
		reason: string;
		detail?: number;
		cleanup?: NativeInsertScheduledWorkCleanup;
		extraFields?: Record<string, unknown>;
	},
): void {
	if (state.nativeInsertTraceSummaryLoggedAt.has(input.traceId)) return;

	const context = state.nativeInsertTraceContextById.get(input.traceId);
	const cleanup = input.cleanup ?? {
		clearedTimeoutCount: 0,
		clearedRafCount: 0,
		clearedProbePhaseCount: 0,
		markedSettled: false,
	};

	log(
		`[Event] NativeInsertTraceSummary: trace=${input.traceId}, outcome=${input.outcome}, ` +
			`trigger=${input.trigger}, reason=${input.reason}, pointerType=${context?.pointerType || 'unknown'}, ` +
			`startReason=${context?.startReason || 'unknown'}, target=${context?.targetKind || 'unknown'}, ` +
			`anchor=${context?.anchorNodeId || 'none'}, endReason=${context?.endReason || 'unknown'}, ` +
			`detail=${input.detail ?? context?.lastPointerDetail ?? 'na'}, clickDetail=${context?.clickDetail ?? 'na'}, ` +
			`clickClassified=${context?.clickClassified ?? false}, awaitClick=${context?.awaitingClickClassification ?? false}, ` +
			`blankCandidate=${context?.blankCandidate ?? false}, queuedSelectionNodes=${context?.queuedSelectionNodeCount ?? 'na'}, ` +
			`queuedSelectionEdges=${context?.queuedSelectionEdgeCount ?? 'na'}, selectionNodes=${context?.selectionNodeCount ?? 'na'}, ` +
			`selectionEdges=${context?.selectionEdgeCount ?? 'na'}, selectionStable=${context?.selectionStable ?? 'na'}, ` +
			`fallbackCommitted=${context?.fallbackCommitted ?? false}, accepted=${context?.accepted ?? (input.outcome === 'accepted')}, ` +
			`nodeCreate=${context?.nodeCreate || 'none'}, ` +
			`queuedNodeDelta=${context?.nodeDelta ?? 'na'}, queuedPlaceholderDelta=${context?.placeholderDelta ?? 'na'}, ` +
			`evidence=${context?.evidenceFlags?.join('|') || 'none'}, clearedTimeouts=${cleanup.clearedTimeoutCount}, ` +
			`clearedRafs=${cleanup.clearedRafCount}, clearedProbePhases=${cleanup.clearedProbePhaseCount}, ` +
			`settled=${cleanup.markedSettled}${formatNativeInsertExtraFields(input.extraFields)}`
	);

	state.nativeInsertTraceSummaryLoggedAt.set(input.traceId, Date.now());
	pruneNativeInsertTraceDiagnostics(state);
}

export function mergeNativeInsertScheduledWorkCleanup(
	left: NativeInsertScheduledWorkCleanup,
	right: NativeInsertScheduledWorkCleanup,
): NativeInsertScheduledWorkCleanup {
	return {
		clearedTimeoutCount: left.clearedTimeoutCount + right.clearedTimeoutCount,
		clearedRafCount: left.clearedRafCount + right.clearedRafCount,
		clearedProbePhaseCount: left.clearedProbePhaseCount + right.clearedProbePhaseCount,
		markedSettled: left.markedSettled || right.markedSettled,
	};
}

export function logNativeInsertCommitWait(
	state: NativeInsertTraceState,
	traceId: string,
	trigger: string,
	reason: string,
): void {
	const waitKey = `${traceId}|${reason}`;
	if (state.lastNativeInsertCommitWaitKey === waitKey) return;
	logVerbose(`[Event] NativeInsertCommitWait: trace=${traceId}, trigger=${trigger}, reason=${reason}`);
	state.lastNativeInsertCommitWaitKey = waitKey;
}

export function registerNativeInsertProbePhase(
	state: NativeInsertTraceState,
	traceId: string,
	phase: NativeInsertProbePhase,
): boolean {
	const phaseSet = state.nativeInsertProbePhasesByTrace.get(traceId) ?? new Set<string>();
	if (phaseSet.has(phase)) {
		return false;
	}
	phaseSet.add(phase);
	state.nativeInsertProbePhasesByTrace.set(traceId, phaseSet);
	return true;
}

export function registerNativeInsertTimeout(state: NativeInsertTraceState, traceId: string, timeoutId: number): void {
	const timeoutSet = state.nativeInsertTraceTimeouts.get(traceId) ?? new Set<number>();
	timeoutSet.add(timeoutId);
	state.nativeInsertTraceTimeouts.set(traceId, timeoutSet);
}

export function registerNativeInsertRaf(state: NativeInsertTraceState, traceId: string, rafId: number): void {
	const rafSet = state.nativeInsertTraceRafs.get(traceId) ?? new Set<number>();
	rafSet.add(rafId);
	state.nativeInsertTraceRafs.set(traceId, rafSet);
}

export function clearNativeInsertScheduledWork(
	state: NativeInsertTraceState,
	traceId: string | null | undefined,
	markSettled: boolean = false,
): NativeInsertScheduledWorkCleanup {
	if (!traceId) {
		return {
			clearedTimeoutCount: 0,
			clearedRafCount: 0,
			clearedProbePhaseCount: 0,
			markedSettled: false,
		};
	}

	const cleanup: NativeInsertScheduledWorkCleanup = {
		clearedTimeoutCount: 0,
		clearedRafCount: 0,
		clearedProbePhaseCount: state.nativeInsertProbePhasesByTrace.get(traceId)?.size || 0,
		markedSettled: markSettled,
	};

	const timeoutSet = state.nativeInsertTraceTimeouts.get(traceId);
	if (timeoutSet) {
		cleanup.clearedTimeoutCount = timeoutSet.size;
		for (const timeoutId of timeoutSet) {
			window.clearTimeout(timeoutId);
		}
		state.nativeInsertTraceTimeouts.delete(traceId);
	}

	const rafSet = state.nativeInsertTraceRafs.get(traceId);
	if (rafSet) {
		cleanup.clearedRafCount = rafSet.size;
		for (const rafId of rafSet) {
			cancelAnimationFrame(rafId);
		}
		state.nativeInsertTraceRafs.delete(traceId);
	}

	state.nativeInsertProbePhasesByTrace.delete(traceId);

	if (markSettled) {
		markNativeInsertTraceSettled(state, traceId);
		state.nativeInsertPostSessionPhasesByTrace.delete(traceId);
	}

	return cleanup;
}

export function clearAllNativeInsertTraceState(state: NativeInsertTraceState): void {
	for (const timeoutSet of state.nativeInsertTraceTimeouts.values()) {
		for (const timeoutId of timeoutSet) {
			window.clearTimeout(timeoutId);
		}
	}
	state.nativeInsertTraceTimeouts.clear();

	for (const rafSet of state.nativeInsertTraceRafs.values()) {
		for (const rafId of rafSet) {
			cancelAnimationFrame(rafId);
		}
	}
	state.nativeInsertTraceRafs.clear();
	state.nativeInsertSettledTraceAt.clear();
	state.nativeInsertProbePhasesByTrace.clear();
	state.nativeInsertPostSessionPhasesByTrace.clear();
	state.nativeInsertTraceContextById.clear();
	state.nativeInsertTraceSummaryLoggedAt.clear();
	state.lastNativeInsertCommitWaitKey = null;
}