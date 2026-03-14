/**
 * Layout Arrange Policy
 * 
 * 纯策略函数：布局排列的决策逻辑
 * 从 layout-manager.ts 抽离以减少文件大小并提高可测试性
 */

import { type CanvasDataLike, type CanvasEdgeLike } from '../types';
import { getNodeIdFromEdgeEndpoint } from '../../utils/canvas-utils';

// ============================================================================
// Types
// ============================================================================

export type ArrangeNoOpFollowUpDecision = {
    finishImmediately: boolean;
    scheduleOpenStabilization: boolean;
    reason: 'stable-no-op' | 'severe-visual-gap-risk';
};

export type ArrangeNoOpFastPathDecision = {
    useFastPath: boolean;
    followUp: ArrangeNoOpFollowUpDecision;
    reason: 'predicted-changed' | 'file-changed' | 'stable-no-op' | 'severe-visual-gap-risk';
};

export type ArrangeStateSnapshot = {
    filePath: string;
    signature: string;
    source: string;
    recordedAt: number;
};

export type ArrangeRepeatManualSkipDecision = {
    skip: boolean;
    reason:
        | 'non-manual-source'
        | 'no-history'
        | 'file-changed'
        | 'state-changed'
        | 'severe-visual-gap-risk'
        | 'repeat-manual-state';
};

export type HealthyOpenStabilizeSnapshot = {
    finishedAt: number;
    nodeCount: number;
    edgeCount: number;
    source: string;
};

export type HealthyOpenStabilizeSkipDecision = {
    skip: boolean;
    reason:
        | 'not-open-entry-source'
        | 'resume-source'
        | 'no-history'
        | 'expired'
        | 'graph-changed'
        | 'healthy-cache-hit';
    ageMs: number;
};

// ============================================================================
// Helper Functions
// ============================================================================

function toArrangeSigNumber(value: unknown): string {
    return typeof value === 'number' && Number.isFinite(value)
        ? value.toFixed(1)
        : 'na';
}

export function computeArrangeSigHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        hash = ((hash << 5) - hash) + input.charCodeAt(i);
        hash |= 0;
    }
    return `${hash}`;
}

// ============================================================================
// Public Policy Functions
// ============================================================================

export function buildArrangeStateSignature(
    canvasData: CanvasDataLike | null | undefined,
    edges?: CanvasEdgeLike[]
): string {
    const nodes = Array.isArray(canvasData?.nodes) ? canvasData.nodes : [];
    const edgeList = edges ?? (Array.isArray(canvasData?.edges) ? canvasData.edges : []);

    const nodeEntries = nodes.map((node, index) => (
        `${index}:${node.id || 'unknown'}:${toArrangeSigNumber(node.x)}:${toArrangeSigNumber(node.y)}:` +
        `${toArrangeSigNumber(node.width)}:${toArrangeSigNumber(node.height)}`
    ));

    const edgeEntries = edgeList.map((edge, index) => {
        const fromId = getNodeIdFromEdgeEndpoint(edge.from) || edge.fromNode || 'unknown';
        const toId = getNodeIdFromEdgeEndpoint(edge.to) || edge.toNode || 'unknown';
        return `${index}:${edge.id || 'edge'}:${fromId}->${toId}`;
    });

    const raw = `nodes=${nodeEntries.join('|')}::edges=${edgeEntries.join('|')}`;
    return `n${nodeEntries.length}:e${edgeEntries.length}:h${computeArrangeSigHash(raw)}`;
}

export function getArrangeRepeatManualSkipDecision(input: {
    source: string;
    filePath: string | null;
    currentSignature: string;
    previousSnapshot?: ArrangeStateSnapshot | null;
    severeVisualRisk: boolean;
}): ArrangeRepeatManualSkipDecision {
    if (input.source !== 'manual') {
        return { skip: false, reason: 'non-manual-source' };
    }

    if (input.severeVisualRisk) {
        return { skip: false, reason: 'severe-visual-gap-risk' };
    }

    if (!input.previousSnapshot) {
        return { skip: false, reason: 'no-history' };
    }

    if (!input.filePath || input.previousSnapshot.filePath !== input.filePath) {
        return { skip: false, reason: 'file-changed' };
    }

    if (input.previousSnapshot.signature !== input.currentSignature) {
        return { skip: false, reason: 'state-changed' };
    }

    return { skip: true, reason: 'repeat-manual-state' };
}

export function getArrangeNoOpFollowUpDecision(severeVisualRisk: boolean): ArrangeNoOpFollowUpDecision {
    if (severeVisualRisk) {
        return {
            finishImmediately: false,
            scheduleOpenStabilization: false,
            reason: 'severe-visual-gap-risk'
        };
    }

    return {
        finishImmediately: true,
        scheduleOpenStabilization: false,
        reason: 'stable-no-op'
    };
}

export function getArrangeNoOpFastPathDecision(
    predictedChangedCount: number,
    fileChanged: boolean,
    severeVisualRisk: boolean
): ArrangeNoOpFastPathDecision {
    const followUp = getArrangeNoOpFollowUpDecision(severeVisualRisk);
    if (predictedChangedCount !== 0) {
        return {
            useFastPath: false,
            followUp,
            reason: 'predicted-changed'
        };
    }

    if (fileChanged) {
        return {
            useFastPath: false,
            followUp,
            reason: 'file-changed'
        };
    }

    return {
        useFastPath: followUp.finishImmediately,
        followUp,
        reason: followUp.reason
    };
}

export function getOpenStabilizeHealthySkipDecision(input: {
    isOpenEntrySource: boolean;
    isResumeSource: boolean;
    now: number;
    windowMs: number;
    snapshot?: HealthyOpenStabilizeSnapshot | null;
    nodeCount: number;
    edgeCount: number;
}): HealthyOpenStabilizeSkipDecision {
    if (!input.isOpenEntrySource) {
        return { skip: false, reason: 'not-open-entry-source', ageMs: 0 };
    }

    if (input.isResumeSource) {
        return { skip: false, reason: 'resume-source', ageMs: 0 };
    }

    if (!input.snapshot) {
        return { skip: false, reason: 'no-history', ageMs: 0 };
    }

    const ageMs = Math.max(0, input.now - input.snapshot.finishedAt);
    if (ageMs > input.windowMs) {
        return { skip: false, reason: 'expired', ageMs };
    }

    if (input.snapshot.nodeCount !== input.nodeCount || input.snapshot.edgeCount !== input.edgeCount) {
        return { skip: false, reason: 'graph-changed', ageMs };
    }

    return { skip: true, reason: 'healthy-cache-hit', ageMs };
}
