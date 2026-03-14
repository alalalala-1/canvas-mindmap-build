import { type CanvasLike } from '../types';
import { getCanvasSelectionSummary } from '../../utils/canvas-utils';

export type NativeInsertEvidenceSession = {
	pointerType?: string;
	startReason: string;
	targetKind: string;
	placeholderSeen?: boolean;
	placeholderAddedCount?: number;
	wrapperDragSeen?: boolean;
};

export type NativeInsertCommitSession = NativeInsertEvidenceSession & {
	traceId: string;
	nodeCreateSeen: boolean;
	anchorNodeId: string | null;
};

export type NativeInsertPendingCommitLike = {
	anchorNodeId: string | null;
	targetKind?: string;
	evidenceFlags?: string[];
	blankCandidate?: boolean;
	queuedSelectionNodeCount?: number;
	queuedSelectionEdgeCount?: number;
	queuedSelectionKey?: string;
};

export type NativeInsertSelectionSummary = {
	nodeIds: string[];
	edgeIds: string[];
	activeEdgeId: string | null;
};

function hasPlaceholderEvidence(evidenceFlags?: string[]): boolean {
	return (evidenceFlags ?? []).some(flag => (
		flag === 'placeholder-target'
		|| flag === 'placeholder-seen'
		|| flag === 'placeholder-mutation'
		|| flag === 'placeholder-delta'
	));
}

function hasStrongBlankIntent(targetKind: string | undefined, evidenceFlags?: string[]): boolean {
	return targetKind === 'placeholder'
		|| hasPlaceholderEvidence(evidenceFlags);
}

function hasOnlyWeakWrapperEvidence(evidenceFlags?: string[]): boolean {
	const flags = evidenceFlags ?? [];
	if (flags.length === 0) return false;

	return flags.every(flag => (
		flag === 'touch-like-wrapper'
		|| flag === 'wrapper-drag'
		|| flag === 'wrapper-active'
		|| flag === 'wrapper-placeholder-present'
	));
}

export function collectNativeInsertEvidence(input: {
	session: NativeInsertEvidenceSession;
	placeholderDelta: number;
	isTouchLikePointer: (pointerType: string | null | undefined) => boolean;
}): string[] {
	const flags = new Set<string>();
	const { session, placeholderDelta, isTouchLikePointer } = input;

	if (session.targetKind === 'placeholder') flags.add('placeholder-target');
	if (session.placeholderSeen) flags.add('placeholder-seen');
	if ((session.placeholderAddedCount || 0) > 0) flags.add('placeholder-mutation');
	if (placeholderDelta > 0) flags.add('placeholder-delta');
	if (session.wrapperDragSeen) flags.add('wrapper-drag');
	if (session.startReason === 'wrapper-active') flags.add('wrapper-active');
	if (session.startReason === 'wrapper-placeholder-present') flags.add('wrapper-placeholder-present');
	if (isTouchLikePointer(session.pointerType) && session.startReason === 'wrapper-touch-like') {
		flags.add('touch-like-wrapper');
	}

	return Array.from(flags);
}

export function shouldCommitNativeInsertSession(input: {
	session: NativeInsertCommitSession;
	nodeDelta: number;
	placeholderDelta: number;
	endReason: string;
	pointerDetail: number;
	isTouchLikePointer: (pointerType: string | null | undefined) => boolean;
}): {
	allow: boolean;
	reason: string;
} {
	if (input.endReason === 'pointercancel') {
		return {
			allow: false,
			reason: 'pointer-cancelled'
		};
	}

	if (input.pointerDetail >= 2) {
		return {
			allow: false,
			reason: 'multi-click'
		};
	}

	if (input.session.nodeCreateSeen) {
		return {
			allow: false,
			reason: 'node-create-observed'
		};
	}

	if (input.nodeDelta > 0) {
		return {
			allow: false,
			reason: `node-delta:${input.nodeDelta}`
		};
	}

	const actionableTarget = input.session.targetKind === 'placeholder'
		|| input.session.targetKind.startsWith('node-content')
		|| input.session.targetKind.startsWith('wrapper');

	if (!actionableTarget) {
		return {
			allow: false,
			reason: `unsupported-target:${input.session.targetKind}`
		};
	}

	const evidenceFlags = collectNativeInsertEvidence({
		session: input.session,
		placeholderDelta: input.placeholderDelta,
		isTouchLikePointer: input.isTouchLikePointer,
	});

	// [修复 P0-2] 优化证据链判定：
	// 1. 有 anchor + wrapper-drag 证据时，允许提交（用户明确的拖动意图）
	// 2. 完全无证据时才拒绝
	if (evidenceFlags.length === 0) {
		return {
			allow: false,
			reason: 'insufficient-evidence'
		};
	}

	// [P0-2] 如果有明确的 anchor 节点，且有 wrapper-drag 证据，降低其他证据要求
	const hasAnchor = !!input.session.anchorNodeId;
	const hasWrapperDrag = evidenceFlags.includes('wrapper-drag');
	if (hasAnchor && hasWrapperDrag && input.session.targetKind.startsWith('wrapper')) {
		// wrapper drag with anchor 是明确的插入意图，允许提交
		return {
			allow: true,
			reason: 'wrapper-drag-with-anchor'
		};
	}

	if (input.session.targetKind.startsWith('wrapper') && !hasPlaceholderEvidence(evidenceFlags)) {
		return {
			allow: false,
			reason: 'wrapper-without-placeholder-evidence'
		};
	}

	if (input.session.targetKind.startsWith('node-content') && !hasPlaceholderEvidence(evidenceFlags)) {
		return {
			allow: false,
			reason: 'node-content-without-placeholder-evidence'
		};
	}

	return {
		allow: true,
		reason: input.session.anchorNodeId
			? 'missing-native-create-with-anchor'
			: 'missing-native-create-no-anchor'
	};
}

export function getNativeInsertSelectionKey(summary: NativeInsertSelectionSummary): string {
	return [
		`nodes=${summary.nodeIds.join('|') || 'none'}`,
		`edges=${summary.edgeIds.join('|') || 'none'}`,
		`active=${summary.activeEdgeId || 'none'}`,
	].join(';');
}

export function getCurrentNativeInsertSelectionSummary(canvas: CanvasLike | null | undefined): NativeInsertSelectionSummary {
	return getCanvasSelectionSummary(canvas);
}

export function evaluateNativeInsertBlankProtection(
	candidate: NativeInsertPendingCommitLike,
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
} {
	const blankCandidate = candidate.blankCandidate ?? true;
	const queuedSelectionNodeCount = candidate.queuedSelectionNodeCount ?? 0;
	const queuedSelectionEdgeCount = candidate.queuedSelectionEdgeCount ?? 0;
	const emptySelectionKey = getNativeInsertSelectionKey({
		nodeIds: [],
		edgeIds: [],
		activeEdgeId: null,
	});
	const queuedSelectionKey = candidate.queuedSelectionKey ?? emptySelectionKey;
	const currentSelection = getCanvasSelectionSummary(canvas);
	const currentSelectionKey = getNativeInsertSelectionKey(currentSelection);
	const selectionNodeCount = currentSelection.nodeIds.length;
	const selectionEdgeCount = currentSelection.edgeIds.length;
	const selectionStable = queuedSelectionKey === currentSelectionKey;
	const anchorSelected = !!candidate.anchorNodeId && currentSelection.nodeIds.includes(candidate.anchorNodeId);
	const strongBlankIntent = hasStrongBlankIntent(candidate.targetKind, candidate.evidenceFlags);
	const weakEvidenceOnly = hasOnlyWeakWrapperEvidence(candidate.evidenceFlags);

	if (!blankCandidate) {
		return {
			allow: true,
			reason: 'not-blank-candidate',
			blankCandidate,
			queuedSelectionNodeCount,
			queuedSelectionEdgeCount,
			selectionNodeCount,
			selectionEdgeCount,
			selectionStable,
			anchorSelected,
			weakEvidenceOnly,
		};
	}

	if (!strongBlankIntent) {
		return {
			allow: false,
			reason: 'blank-protection-wrapper-only-evidence',
			blankCandidate,
			queuedSelectionNodeCount,
			queuedSelectionEdgeCount,
			selectionNodeCount,
			selectionEdgeCount,
			selectionStable,
			anchorSelected,
			weakEvidenceOnly,
		};
	}

	if (selectionEdgeCount > 0) {
		return {
			allow: false,
			reason: 'blank-protection-edge-selection',
			blankCandidate,
			queuedSelectionNodeCount,
			queuedSelectionEdgeCount,
			selectionNodeCount,
			selectionEdgeCount,
			selectionStable,
			anchorSelected,
			weakEvidenceOnly,
		};
	}

	if (selectionNodeCount > 1) {
		return {
			allow: false,
			reason: 'blank-protection-multi-node-selection',
			blankCandidate,
			queuedSelectionNodeCount,
			queuedSelectionEdgeCount,
			selectionNodeCount,
			selectionEdgeCount,
			selectionStable,
			anchorSelected,
			weakEvidenceOnly,
		};
	}

	if (weakEvidenceOnly && !candidate.anchorNodeId) {
		return {
			allow: false,
			reason: 'blank-protection-weak-evidence-only',
			blankCandidate,
			queuedSelectionNodeCount,
			queuedSelectionEdgeCount,
			selectionNodeCount,
			selectionEdgeCount,
			selectionStable,
			anchorSelected,
			weakEvidenceOnly,
		};
	}

	if (candidate.anchorNodeId && selectionNodeCount > 0 && !anchorSelected && !selectionStable) {
		return {
			allow: false,
			reason: 'blank-protection-selection-mismatch',
			blankCandidate,
			queuedSelectionNodeCount,
			queuedSelectionEdgeCount,
			selectionNodeCount,
			selectionEdgeCount,
			selectionStable,
			anchorSelected,
			weakEvidenceOnly,
		};
	}

	return {
		allow: true,
		reason: 'blank-protection-passed',
		blankCandidate,
		queuedSelectionNodeCount,
		queuedSelectionEdgeCount,
		selectionNodeCount,
		selectionEdgeCount,
		selectionStable,
		anchorSelected,
		weakEvidenceOnly,
	};
}