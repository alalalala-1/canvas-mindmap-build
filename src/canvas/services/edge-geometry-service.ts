import {
    CanvasDataLike,
    CanvasEdgeLike,
    CanvasLike,
    CanvasNodeLike
} from '../types';
import { log } from '../../utils/logger';
import { getEdgesFromCanvas, getNodeIdFromEdgeEndpoint, isRecord } from '../../utils/canvas-utils';
import { CONSTANTS } from '../../constants';
import { Platform } from 'obsidian';


export interface EdgeGeomDiagnostics {
    edgeErrors: Map<string, { fromErr: number; toErr: number }>;
    timestamp: number;
}

export interface EdgeScreenGapSummary {
    allEdges: number;
    bothVisibleEdges: number;
    oneSideVisibleEdges: number;
    bothVirtualizedEdges: number;
    sampledEdges: number;
    badEdges: number;
    residualBadEdges: number;
    avgGap: number;
    maxGap: number;
    avgResidualGap: number;
    maxResidualGap: number;
    badGapThresholdPx: number;
    stubCompensationPx: number;
    canvasScale: number;
    topBadSample: string;
    topResidualBadSample: string;
    topBadDecompose: string;
    topDriftNodes: string;
    positionBuckets: string;
    sample: string;
}

export interface OffsetAnomalyStats {
    visible: number;
    anomalous: number;
    topOnly: number;
    leftOnly: number;
    topAndLeft: number;
    insetTopLeft: number;
    softInsetOnly: number;
}

export interface OffsetCleanupOptions {
    releaseFixClass?: boolean;
    applyGapThresholdPx?: number;
    holdGapThresholdPx?: number;
    releaseGapThresholdPx?: number;
    sourceTag?: string;
}

export class EdgeGeometryService {
    private getCanvasScaleAbs(canvas: CanvasLike): number {
        const zoomRaw = Number((canvas as any)?.zoom);
        if (Number.isFinite(zoomRaw)) {
            // Obsidian Canvas 的 zoom 常见为指数空间（例如 -1.5 => scale≈0.3536）
            const expScale = Math.pow(2, zoomRaw);
            if (Number.isFinite(expScale) && expScale > 0) {
                return Math.max(0.05, Math.abs(expScale));
            }
        }

        const canvasEl = (canvas as any)?.canvasEl as HTMLElement | undefined;
        const tf = canvasEl ? window.getComputedStyle(canvasEl).transform : 'none';
        if (tf && tf !== 'none') {
            const match = tf.match(/matrix\(([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),/);
            if (match) {
                const a = Number.parseFloat(match[1] || '1');
                const b = Number.parseFloat(match[2] || '0');
                const scale = Math.hypot(a, b);
                if (Number.isFinite(scale) && scale > 0) {
                    return Math.max(0.05, scale);
                }
            }
        }

        return 1;
    }

    private getZoomAwareBadGapThreshold(canvas: CanvasLike): number {
        const scale = this.getCanvasScaleAbs(canvas);
        // 缩小时降低阈值，放大/常规时回到 8px，避免“缩小可见错连被阈值放过”。
        return Math.min(8, Math.max(2, 8 * scale));
    }

    private getStubCompensationPx(canvas: CanvasLike): number {
        // Canvas 引擎边端点自带约 7px 的 stub，缩放后会投影到屏幕像素。
        // residualGap = rawGap - stubProjection，用于避免把“stub 固有偏差”当成真实错连证据。
        return Math.max(0, 7 * this.getCanvasScaleAbs(canvas));
    }

    private buildNodeStyleSnapshot(nodeEl: HTMLElement): {
        inlineTop: string;
        inlineLeft: string;
        inlineInset: string;
        inlineTransform: string;
        inlineCss: string;
        computedTop: string;
        computedLeft: string;
        computedInset: string;
        computedPosition: string;
        computedTransform: string;
    } {
        const computed = window.getComputedStyle(nodeEl);
        const computedAny = computed as unknown as Record<string, unknown>;
        const computedInset = typeof computedAny.inset === 'string'
            ? computedAny.inset
            : `${computed.top}/${computed.right}/${computed.bottom}/${computed.left}`;

        return {
            inlineTop: nodeEl.style.top || 'none',
            inlineLeft: nodeEl.style.left || 'none',
            inlineInset: nodeEl.style.inset || 'none',
            inlineTransform: nodeEl.style.transform || 'none',
            inlineCss: nodeEl.getAttribute('style') || 'none',
            computedTop: computed.top,
            computedLeft: computed.left,
            computedInset,
            computedPosition: computed.position,
            computedTransform: computed.transform || 'none'
        };
    }

    private parseCssPxValue(value: string): number | null {
        if (!value || value === 'auto') return null;
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    private parseInsetTopLeft(snapshot: { computedInset: string }): { top: number | null; left: number | null; hasSoftInsetOnly: boolean } {
        const inset = snapshot.computedInset;
        if (!inset || inset === 'auto') {
            return { top: null, left: null, hasSoftInsetOnly: false };
        }

        const parts = inset.split(/[\s/]+/).map(part => part.trim()).filter(Boolean);
        if (parts.length === 0) {
            return { top: null, left: null, hasSoftInsetOnly: false };
        }

        const p = (idx: number): string => parts[idx] ?? 'auto';
        const expanded: [string, string, string, string] = (() => {
            if (parts.length === 1) return [p(0), p(0), p(0), p(0)];
            if (parts.length === 2) return [p(0), p(1), p(0), p(1)];
            if (parts.length === 3) return [p(0), p(1), p(2), p(1)];
            return [p(0), p(1), p(2), p(3)];
        })();

        const top = this.parseCssPxValue(expanded[0]);
        const right = this.parseCssPxValue(expanded[1]);
        const bottom = this.parseCssPxValue(expanded[2]);
        const left = this.parseCssPxValue(expanded[3]);

        const softRight = right !== null && Math.abs(right) > 0.1;
        const softBottom = bottom !== null && Math.abs(bottom) > 0.1;
        const hardTop = top !== null && Math.abs(top) > 0.1;
        const hardLeft = left !== null && Math.abs(left) > 0.1;

        return {
            top,
            left,
            hasSoftInsetOnly: (softRight || softBottom) && !hardTop && !hardLeft,
        };
    }

    private getComputedOffsetAnomalyFlags(snapshot: { computedTop: string; computedLeft: string; computedInset: string }): {
        anomalous: boolean;
        top: boolean;
        left: boolean;
        insetTopLeft: boolean;
        softInsetOnly: boolean;
    } {
        const topVal = this.parseCssPxValue(snapshot.computedTop);
        const leftVal = this.parseCssPxValue(snapshot.computedLeft);

        const anomalousTop = topVal !== null && Math.abs(topVal) > 0.1;
        const anomalousLeft = leftVal !== null && Math.abs(leftVal) > 0.1;

        let anomalousInsetTopLeft = false;
        let softInsetOnly = false;

        // 只有 top/left 无法直接提供信息时，才回退到 inset 的 top/left 分量。
        // 不再把 inset 的 right/bottom 非零当作异常（这是 Canvas absolute 布局常态）。
        if (!anomalousTop && !anomalousLeft && (topVal === null || leftVal === null)) {
            const insetTopLeft = this.parseInsetTopLeft(snapshot);
            const insetTop = insetTopLeft.top;
            const insetLeft = insetTopLeft.left;

            anomalousInsetTopLeft = (
                (insetTop !== null && Math.abs(insetTop) > 0.1)
                || (insetLeft !== null && Math.abs(insetLeft) > 0.1)
            );
            softInsetOnly = insetTopLeft.hasSoftInsetOnly && !anomalousInsetTopLeft;
        }

        return {
            anomalous: anomalousTop || anomalousLeft || anomalousInsetTopLeft,
            top: anomalousTop,
            left: anomalousLeft,
            insetTopLeft: anomalousInsetTopLeft,
            softInsetOnly,
        };
    }

    private hasAnomalousComputedOffset(snapshot: { computedTop: string; computedLeft: string; computedInset: string }): boolean {
        return this.getComputedOffsetAnomalyFlags(snapshot).anomalous;
    }

    private describeStyleSheet(sheet: CSSStyleSheet): string {
        const href = typeof sheet.href === 'string' ? sheet.href : '';
        if (href) return href;

        const owner = sheet.ownerNode;
        if (owner instanceof HTMLStyleElement) {
            const id = owner.id ? `#${owner.id}` : '';
            const cls = owner.className ? `.${String(owner.className).trim().replace(/\s+/g, '.')}` : '';
            return `inline-style${id}${cls}`;
        }

        return 'inline-style(unknown-owner)';
    }

    private collectOffsetRelatedMatchedRules(nodeEl: HTMLElement, maxMatches: number = 8): string[] {
        const matched: string[] = [];

        const walkRules = (rules: CSSRuleList | undefined, source: string): void => {
            if (!rules || matched.length >= maxMatches) return;

            for (const rule of Array.from(rules)) {
                if (matched.length >= maxMatches) return;

                if (rule instanceof CSSStyleRule) {
                    const selector = rule.selectorText;
                    if (!selector) continue;

                    let isMatched = false;
                    try {
                        isMatched = nodeEl.matches(selector);
                    } catch {
                        isMatched = false;
                    }
                    if (!isMatched) continue;

                    const style = rule.style;
                    const position = style.getPropertyValue('position').trim();
                    const top = style.getPropertyValue('top').trim();
                    const left = style.getPropertyValue('left').trim();
                    const inset = style.getPropertyValue('inset').trim();

                    if (!position && !top && !left && !inset) continue;

                    matched.push(
                        `${source} :: ${selector} => position=${position || 'n/a'}, top=${top || 'n/a'}, left=${left || 'n/a'}, inset=${inset || 'n/a'}`
                    );
                    continue;
                }

                const maybeGrouping = rule as CSSRule & { cssRules?: CSSRuleList };
                if (maybeGrouping.cssRules) {
                    walkRules(maybeGrouping.cssRules, source);
                }
            }
        };

        for (const sheet of Array.from(document.styleSheets)) {
            if (matched.length >= maxMatches) break;
            try {
                const source = this.describeStyleSheet(sheet as CSSStyleSheet);
                walkRules((sheet as CSSStyleSheet).cssRules, source);
            } catch {
                // 跨域或受限样式表会抛异常，忽略即可。
            }
        }

        return matched;
    }

    private logOffsetRuleOriginsForAnomalousNodes(
        targets: Array<{ nodeId: string; nodeEl: HTMLElement; snapshot: { computedTop: string; computedLeft: string; computedPosition: string } }>,
        contextId?: string,
        sampleLimit: number = 3
    ): void {
        if (targets.length === 0) return;

        const lines: string[] = [];
        for (const target of targets.slice(0, sampleLimit)) {
            const ruleLines = this.collectOffsetRelatedMatchedRules(target.nodeEl, 10);
            lines.push(
                `${target.nodeId.slice(0, 8)}: computed(pos=${target.snapshot.computedPosition},top=${target.snapshot.computedTop},left=${target.snapshot.computedLeft}) ` +
                `rules=${ruleLines.length > 0 ? ruleLines.join(' || ') : 'none-found'}`
            );
        }

        if (lines.length > 0) {
            log(`[Layout] OffsetRuleOrigin: samples=${lines.length}, ctx=${contextId || 'none'}\n${lines.join('\n')}`);
        }
    }

    logNodeStyleTruth(
        allNodes: Map<string, CanvasNodeLike>,
        tag: string,
        contextId?: string,
        sampleLimit: number = 10
    ): void {
        let visible = 0;
        let anomalous = 0;
        const lines: string[] = [];

        for (const [nodeId, node] of allNodes) {
            const nodeEl = (node as any).nodeEl as HTMLElement | undefined;
            if (!nodeEl || nodeEl.offsetHeight === 0) continue;

            visible++;
            const snapshot = this.buildNodeStyleSnapshot(nodeEl);
            const flags = this.getComputedOffsetAnomalyFlags(snapshot);
            const isAnomalous = flags.anomalous;
            if (isAnomalous) anomalous++;

            if (lines.length < sampleLimit && (isAnomalous || visible <= Math.max(3, Math.floor(sampleLimit / 2)))) {
                lines.push(
                    `${nodeId.slice(0, 8)}: ` +
                    `inline(top=${snapshot.inlineTop},left=${snapshot.inlineLeft},inset=${snapshot.inlineInset},tf=${snapshot.inlineTransform.slice(0, 30)}), ` +
                    `computed(pos=${snapshot.computedPosition},top=${snapshot.computedTop},left=${snapshot.computedLeft},inset=${snapshot.computedInset},tf=${snapshot.computedTransform.slice(0, 30)})`
                );
            }
        }

        log(`[StyleTruth-${tag}] visible=${visible}, anomalous=${anomalous}, sample=${lines.length}, ctx=${contextId || 'none'}`);
        if (lines.length > 0) {
            log(`[StyleTruth-${tag}] Samples:\n${lines.join('\n')}`);
        }
    }

    countAnomalousVisibleNodesDetailed(allNodes: Map<string, CanvasNodeLike>): OffsetAnomalyStats {
        const stats: OffsetAnomalyStats = {
            visible: 0,
            anomalous: 0,
            topOnly: 0,
            leftOnly: 0,
            topAndLeft: 0,
            insetTopLeft: 0,
            softInsetOnly: 0,
        };

        for (const [, node] of allNodes) {
            const nodeEl = (node as any).nodeEl as HTMLElement | undefined;
            if (!nodeEl || nodeEl.offsetHeight === 0) continue;

            stats.visible++;
            const snapshot = this.buildNodeStyleSnapshot(nodeEl);
            const flags = this.getComputedOffsetAnomalyFlags(snapshot);

            if (flags.softInsetOnly) {
                stats.softInsetOnly++;
            }

            if (!flags.anomalous) continue;

            stats.anomalous++;
            if (flags.top && flags.left) stats.topAndLeft++;
            else if (flags.top) stats.topOnly++;
            else if (flags.left) stats.leftOnly++;
            else if (flags.insetTopLeft) stats.insetTopLeft++;
        }

        return stats;
    }

    countAnomalousVisibleNodes(allNodes: Map<string, CanvasNodeLike>): number {
        return this.countAnomalousVisibleNodesDetailed(allNodes).anomalous;
    }

    private getNodeBboxAnchor(node: CanvasNodeLike | undefined, side: string): { x: number; y: number } | null {
        if (!node) return null;
        const bbox = (node as any).bbox as { minX: number; minY: number; maxX: number; maxY: number } | undefined;
        if (!bbox) return null;
        return this.calculateAnchorPoint(bbox, side);
    }

    private getAnyCanvasSvgRoot(canvas: CanvasLike): SVGSVGElement | null {
        for (const edge of this.getCanvasEdges(canvas)) {
            const pathEl = this.resolveEdgePathElement(edge);
            if (pathEl instanceof SVGPathElement && pathEl.ownerSVGElement) {
                return pathEl.ownerSVGElement;
            }
        }
        return null;
    }

    private projectCanvasPointToScreenBySvg(
        svgRoot: SVGSVGElement | null,
        point: { x: number; y: number } | null
    ): { x: number; y: number } | null {
        if (!svgRoot || !point) return null;
        try {
            const ctm = svgRoot.getScreenCTM();
            if (!ctm) return null;
            const p = svgRoot.createSVGPoint();
            p.x = point.x;
            p.y = point.y;
            const projected = p.matrixTransform(ctm);
            return { x: projected.x, y: projected.y };
        } catch {
            return null;
        }
    }

    summarizeVisibleEdgeScreenGaps(
        canvas: CanvasLike,
        allNodes: Map<string, CanvasNodeLike>,
        sampleLimit: number = Number.POSITIVE_INFINITY
    ): EdgeScreenGapSummary {
        const allEdges = this.getCanvasEdges(canvas);
        const canvasScale = this.getCanvasScaleAbs(canvas);
        const badGapThresholdPx = this.getZoomAwareBadGapThreshold(canvas);
        const stubCompensationPx = this.getStubCompensationPx(canvas);
        const svgRoot = this.getAnyCanvasSvgRoot(canvas);
        const visibleRectMap = new Map<string, DOMRect>();
        const visiblePositionMap = new Map<string, string>();
        for (const [nodeId, node] of allNodes) {
            const nodeEl = (node as any).nodeEl as HTMLElement | undefined;
            if (!nodeEl || nodeEl.offsetHeight === 0) continue;
            visibleRectMap.set(nodeId, nodeEl.getBoundingClientRect());
            visiblePositionMap.set(nodeId, window.getComputedStyle(nodeEl).position || 'unknown');
        }

        let bothVisibleEdges = 0;
        let oneSideVisibleEdges = 0;
        let bothVirtualizedEdges = 0;

        for (const edge of allEdges) {
            const fromId = getNodeIdFromEdgeEndpoint((edge as any).from) || this.toStringId((edge as any).fromNode) || '';
            const toId = getNodeIdFromEdgeEndpoint((edge as any).to) || this.toStringId((edge as any).toNode) || '';
            if (!fromId || !toId) continue;

            const fromVisible = visibleRectMap.has(fromId);
            const toVisible = visibleRectMap.has(toId);
            if (fromVisible && toVisible) bothVisibleEdges++;
            else if (fromVisible || toVisible) oneSideVisibleEdges++;
            else bothVirtualizedEdges++;
        }

        if (visibleRectMap.size === 0) {
            return {
                allEdges: allEdges.length,
                bothVisibleEdges,
                oneSideVisibleEdges,
                bothVirtualizedEdges,
                sampledEdges: 0,
                badEdges: 0,
                residualBadEdges: 0,
                avgGap: 0,
                maxGap: 0,
                avgResidualGap: 0,
                maxResidualGap: 0,
                badGapThresholdPx,
                stubCompensationPx,
                canvasScale,
                topBadSample: 'none',
                topResidualBadSample: 'none',
                topBadDecompose: 'none',
                topDriftNodes: 'none',
                positionBuckets: 'none',
                sample: 'none'
            };
        }

        const normalizedLimit = Number.isFinite(sampleLimit) && sampleLimit > 0
            ? Math.floor(sampleLimit)
            : Number.POSITIVE_INFINITY;

        const candidateEdges = allEdges.filter((edge) => {
            const fromId = getNodeIdFromEdgeEndpoint((edge as any).from) || this.toStringId((edge as any).fromNode) || '';
            const toId = getNodeIdFromEdgeEndpoint((edge as any).to) || this.toStringId((edge as any).toNode) || '';
            return fromId !== '' && toId !== '' && visibleRectMap.has(fromId) && visibleRectMap.has(toId);
        }).slice(0, normalizedLimit);

        if (candidateEdges.length === 0) {
            return {
                allEdges: allEdges.length,
                bothVisibleEdges,
                oneSideVisibleEdges,
                bothVirtualizedEdges,
                sampledEdges: 0,
                badEdges: 0,
                residualBadEdges: 0,
                avgGap: 0,
                maxGap: 0,
                avgResidualGap: 0,
                maxResidualGap: 0,
                badGapThresholdPx,
                stubCompensationPx,
                canvasScale,
                topBadSample: 'none',
                topResidualBadSample: 'none',
                topBadDecompose: 'none',
                topDriftNodes: 'none',
                positionBuckets: 'none',
                sample: 'none'
            };
        }

        let sampledEdges = 0;
        let badEdges = 0;
        let residualBadEdges = 0;
        let sumGap = 0;
        let maxGap = 0;
        let sumResidualGap = 0;
        let maxResidualGap = 0;
        const sampleLines: string[] = [];
        const edgeGapRows: Array<{
            edgeId: string;
            fromId: string;
            toId: string;
            gap: number;
            residualGap: number;
            fromGap: number;
            toGap: number;
            fromResidualGap: number;
            toResidualGap: number;
            fromDomVsBbox: number;
            toDomVsBbox: number;
            fromPathVsBbox: number;
            toPathVsBbox: number;
        }> = [];
        const nodeEvidence = new Map<string, { domDrift: number; gap: number; residualGap: number; position: string }>();
        const upsertNodeEvidence = (nodeId: string, domDrift: number, gap: number, residualGap: number, position: string) => {
            const prev = nodeEvidence.get(nodeId) ?? { domDrift: 0, gap: 0, residualGap: 0, position: 'unknown' };
            nodeEvidence.set(nodeId, {
                domDrift: Math.max(prev.domDrift, domDrift),
                gap: Math.max(prev.gap, gap),
                residualGap: Math.max(prev.residualGap, residualGap),
                position: prev.position !== 'unknown' ? prev.position : position,
            });
        };

        for (const edge of candidateEdges) {
            const fromId = getNodeIdFromEdgeEndpoint((edge as any).from) || this.toStringId((edge as any).fromNode) || '';
            const toId = getNodeIdFromEdgeEndpoint((edge as any).to) || this.toStringId((edge as any).toNode) || '';
            if (!fromId || !toId) continue;

            const fromRect = visibleRectMap.get(fromId);
            const toRect = visibleRectMap.get(toId);
            if (!fromRect || !toRect) continue;

            const fromSide = this.toStringId((edge as any).fromSide) ?? (isRecord((edge as any).from) ? this.toStringId(((edge as any).from as Record<string, unknown>).side) : undefined) ?? 'right';
            const toSide = this.toStringId((edge as any).toSide) ?? (isRecord((edge as any).to) ? this.toStringId(((edge as any).to as Record<string, unknown>).side) : undefined) ?? 'left';

            const fromAnchor = this.getAnchorPointForRect(fromRect, fromSide);
            const toAnchor = this.getAnchorPointForRect(toRect, toSide);
            const fromNode = allNodes.get(fromId);
            const toNode = allNodes.get(toId);
            const fromBboxAnchor = this.getNodeBboxAnchor(fromNode, fromSide);
            const toBboxAnchor = this.getNodeBboxAnchor(toNode, toSide);
            const fromBboxScreen = this.projectCanvasPointToScreenBySvg(svgRoot, fromBboxAnchor);
            const toBboxScreen = this.projectCanvasPointToScreenBySvg(svgRoot, toBboxAnchor);

            const pathEl = this.resolveEdgePathElement(edge);
            const pathStart = this.getPathEndpointScreen(pathEl, true);
            const pathEnd = this.getPathEndpointScreen(pathEl, false);
            if (!pathStart || !pathEnd) continue;

            const directFrom = Math.hypot(pathStart.x - fromAnchor.x, pathStart.y - fromAnchor.y);
            const directTo = Math.hypot(pathEnd.x - toAnchor.x, pathEnd.y - toAnchor.y);
            const reverseFrom = Math.hypot(pathEnd.x - fromAnchor.x, pathEnd.y - fromAnchor.y);
            const reverseTo = Math.hypot(pathStart.x - toAnchor.x, pathStart.y - toAnchor.y);

            const directScore = directFrom + directTo;
            const reverseScore = reverseFrom + reverseTo;
            const useReverse = reverseScore < directScore;
            const fromGap = useReverse ? reverseFrom : directFrom;
            const toGap = useReverse ? reverseTo : directTo;
            const edgeGap = Math.max(fromGap, toGap);
            const fromResidualGap = Math.max(0, fromGap - stubCompensationPx);
            const toResidualGap = Math.max(0, toGap - stubCompensationPx);
            const residualEdgeGap = Math.max(fromResidualGap, toResidualGap);
            const mappedFrom = useReverse ? pathEnd : pathStart;
            const mappedTo = useReverse ? pathStart : pathEnd;

            const fromDomVsBbox = fromBboxScreen
                ? Math.hypot(fromAnchor.x - fromBboxScreen.x, fromAnchor.y - fromBboxScreen.y)
                : 0;
            const toDomVsBbox = toBboxScreen
                ? Math.hypot(toAnchor.x - toBboxScreen.x, toAnchor.y - toBboxScreen.y)
                : 0;
            const fromPathVsBbox = fromBboxScreen
                ? Math.hypot(mappedFrom.x - fromBboxScreen.x, mappedFrom.y - fromBboxScreen.y)
                : 0;
            const toPathVsBbox = toBboxScreen
                ? Math.hypot(mappedTo.x - toBboxScreen.x, mappedTo.y - toBboxScreen.y)
                : 0;

            sampledEdges++;
            sumGap += edgeGap;
            sumResidualGap += residualEdgeGap;
            if (edgeGap > maxGap) maxGap = edgeGap;
            if (residualEdgeGap > maxResidualGap) maxResidualGap = residualEdgeGap;
            if (edgeGap > badGapThresholdPx) badEdges++;
            if (residualEdgeGap > badGapThresholdPx) residualBadEdges++;

            edgeGapRows.push({
                edgeId: (edge.id || 'edge').slice(0, 8),
                fromId: fromId.slice(0, 6),
                toId: toId.slice(0, 6),
                gap: edgeGap,
                residualGap: residualEdgeGap,
                fromGap,
                toGap,
                fromResidualGap,
                toResidualGap,
                fromDomVsBbox,
                toDomVsBbox,
                fromPathVsBbox,
                toPathVsBbox,
            });
            upsertNodeEvidence(fromId, fromDomVsBbox, fromGap, fromResidualGap, visiblePositionMap.get(fromId) ?? 'unknown');
            upsertNodeEvidence(toId, toDomVsBbox, toGap, toResidualGap, visiblePositionMap.get(toId) ?? 'unknown');

            if (sampleLines.length < 4) {
                sampleLines.push(`${(edge.id || 'edge').slice(0, 8)}:${edgeGap.toFixed(1)}/${residualEdgeGap.toFixed(1)}px(raw/res,${useReverse ? 'rev' : 'dir'})`);
            }
        }

        const avgGap = sampledEdges > 0 ? (sumGap / sampledEdges) : 0;
        const avgResidualGap = sampledEdges > 0 ? (sumResidualGap / sampledEdges) : 0;
        edgeGapRows.sort((a, b) => b.gap - a.gap);
        const topBadSample = edgeGapRows
            .slice(0, 6)
            .map((row) => `${row.edgeId}:${row.fromId}->${row.toId}:${row.gap.toFixed(1)}px`)
            .join('|') || 'none';
        const topResidualBadSample = [...edgeGapRows]
            .sort((a, b) => b.residualGap - a.residualGap)
            .slice(0, 6)
            .map((row) => `${row.edgeId}:${row.fromId}->${row.toId}:${row.residualGap.toFixed(1)}px`)
            .join('|') || 'none';
        const topBadDecompose = edgeGapRows
            .slice(0, 4)
            .map((row) =>
                `${row.edgeId}:${row.fromId}->${row.toId}:gap=${row.gap.toFixed(1)}px` +
                `(res=${row.residualGap.toFixed(1)}px,stub=${stubCompensationPx.toFixed(1)}px)` +
                `{from(dom-bbox=${row.fromDomVsBbox.toFixed(1)},path-bbox=${row.fromPathVsBbox.toFixed(1)},path-dom=${row.fromGap.toFixed(1)}),` +
                `to(dom-bbox=${row.toDomVsBbox.toFixed(1)},path-bbox=${row.toPathVsBbox.toFixed(1)},path-dom=${row.toGap.toFixed(1)})}`
            )
            .join('|') || 'none';

        const positionBucketCounter = { abs: 0, rel: 0, other: 0 };
        for (const [, evidence] of nodeEvidence.entries()) {
            if (evidence.position === 'absolute') positionBucketCounter.abs++;
            else if (evidence.position === 'relative') positionBucketCounter.rel++;
            else positionBucketCounter.other++;
        }
        const positionBuckets = nodeEvidence.size > 0
            ? `abs=${positionBucketCounter.abs},rel=${positionBucketCounter.rel},other=${positionBucketCounter.other}`
            : 'none';

        const topDriftNodes = Array.from(nodeEvidence.entries())
            .sort((a, b) => Math.max(b[1].domDrift, b[1].residualGap) - Math.max(a[1].domDrift, a[1].residualGap))
            .slice(0, 8)
            .map(([nodeId, evidence]) => `${nodeId.slice(0, 6)}:pos=${evidence.position},dom=${evidence.domDrift.toFixed(1)},gap=${evidence.gap.toFixed(1)},res=${evidence.residualGap.toFixed(1)}`)
            .join('|') || 'none';

        return {
            allEdges: allEdges.length,
            bothVisibleEdges,
            oneSideVisibleEdges,
            bothVirtualizedEdges,
            sampledEdges,
            badEdges,
            residualBadEdges,
            avgGap,
            maxGap,
            avgResidualGap,
            maxResidualGap,
            badGapThresholdPx,
            stubCompensationPx,
            canvasScale,
            topBadSample,
            topResidualBadSample,
            topBadDecompose,
            topDriftNodes,
            positionBuckets,
            sample: sampleLines.join('|') || 'none'
        };
    }

    hasSevereVisualGapRisk(summary: EdgeScreenGapSummary): boolean {
        const severeGap = Math.max(12, summary.badGapThresholdPx * 3);
        return summary.residualBadEdges > 0 || summary.maxResidualGap >= severeGap;
    }

    async traceStyleMutationsForVisibleNodes(
        allNodes: Map<string, CanvasNodeLike>,
        phase: string,
        contextId?: string,
        watchMs: number = 600
    ): Promise<void> {
        const targets: Array<{ nodeId: string; nodeEl: HTMLElement }> = [];
        for (const [nodeId, node] of allNodes) {
            const nodeEl = (node as any).nodeEl as HTMLElement | undefined;
            if (!nodeEl || nodeEl.offsetHeight === 0) continue;
            targets.push({ nodeId, nodeEl });
        }

        if (targets.length === 0) {
            log(`[StyleTrace] phase=${phase}, watchMs=${watchMs}, targets=0, ctx=${contextId || 'none'}`);
            return;
        }

        const events: string[] = [];
        let overflow = 0;
        let mutationCount = 0;
        const start = performance.now();
        const maxEventLogs = 60;

        const nodeByElement = new Map<HTMLElement, string>();
        for (const item of targets) {
            nodeByElement.set(item.nodeEl, item.nodeId);
        }

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (!(mutation.target instanceof HTMLElement)) continue;
                const nodeEl = mutation.target;
                const nodeId = nodeByElement.get(nodeEl);
                if (!nodeId) continue;

                mutationCount++;
                const elapsed = (performance.now() - start).toFixed(1);
                const snapshot = this.buildNodeStyleSnapshot(nodeEl);
                const line =
                    `t=${elapsed}ms ${nodeId.slice(0, 8)} attr=${mutation.attributeName || 'unknown'} ` +
                    `inline(top=${snapshot.inlineTop},left=${snapshot.inlineLeft},inset=${snapshot.inlineInset},tf=${snapshot.inlineTransform.slice(0, 24)}) ` +
                    `computed(pos=${snapshot.computedPosition},top=${snapshot.computedTop},left=${snapshot.computedLeft},inset=${snapshot.computedInset})`;

                if (events.length < maxEventLogs) {
                    events.push(line);
                } else {
                    overflow++;
                }
            }
        });

        for (const item of targets) {
            observer.observe(item.nodeEl, {
                attributes: true,
                attributeFilter: ['style', 'class']
            });
        }

        log(`[StyleTrace] phase=${phase}, watchMs=${watchMs}, targets=${targets.length}, ctx=${contextId || 'none'}`);

        await new Promise<void>((resolve) => {
            window.setTimeout(() => {
                observer.disconnect();
                resolve();
            }, watchMs);
        });

        log(`[StyleTrace] phase=${phase}, mutations=${mutationCount}, logged=${events.length}, overflow=${overflow}, ctx=${contextId || 'none'}`);
        if (events.length > 0) {
            log(`[StyleTrace] Events(${phase}):\n${events.join('\n')}`);
        }
    }

    async refreshEdgeGeometry(
        canvas: CanvasLike,
        contextId?: string
    ): Promise<{ pass1: number; pass2: number; bezierChangedPass1: number; bezierChangedPass2: number; pathDChangedPass1: number; pathDChangedPass2: number }> {
        const edges = this.getCanvasEdges(canvas);
        if (edges.length === 0) {
            log(`[Layout] EdgeRefresh: edges=0, ctx=${contextId || 'none'}`);
            return { pass1: 0, pass2: 0, bezierChangedPass1: 0, bezierChangedPass2: 0, pathDChangedPass1: 0, pathDChangedPass2: 0 };
        }

        const getEdgeBezierSignature = (edge: CanvasEdgeLike): string => {
            const bezier = (edge as any).bezier;
            if (!bezier) return 'no-bezier';
            const from = bezier.from ? `${bezier.from.x?.toFixed(1)},${bezier.from.y?.toFixed(1)}` : 'no-from';
            const to = bezier.to ? `${bezier.to.x?.toFixed(1)},${bezier.to.y?.toFixed(1)}` : 'no-to';
            const cp1 = bezier.cp1 ? `${bezier.cp1.x?.toFixed(1)},${bezier.cp1.y?.toFixed(1)}` : 'no-cp1';
            const cp2 = bezier.cp2 ? `${bezier.cp2.x?.toFixed(1)},${bezier.cp2.y?.toFixed(1)}` : 'no-cp2';
            return `${from}|${to}|${cp1}|${cp2}`;
        };

        const getEdgePathD = (edge: CanvasEdgeLike): string => {
            // [修复A] 优先使用直接属性 pathEl，不存在则通过 lineGroupEl 查找第一个 <path>
            let pathEl: Element | null = (edge as any).pathEl || null;
            if (!pathEl) {
                const lineGroupEl = (edge as any).lineGroupEl as Element | null;
                if (lineGroupEl) {
                    pathEl = lineGroupEl.querySelector('path') ?? null;
                }
            }
            if (!pathEl) return 'no-pathEl';
            return (pathEl as Element).getAttribute('d') || 'no-d';
        };

        const getLineGroupState = (edge: CanvasEdgeLike): string => {
            const lineGroupEl = (edge as any).lineGroupEl;
            if (!lineGroupEl) return 'no-lineGroup';
            const display = lineGroupEl.style.display || window.getComputedStyle(lineGroupEl).display;
            const transform = lineGroupEl.style.transform || 'none';
            return `display=${display},transform=${transform.substring(0, 30)}`;
        };

        const getEdgeEndpointSignature = (edge: CanvasEdgeLike): string => {
            const fromNode = this.toStringId((edge as any).fromNode) || this.toStringId(getNodeIdFromEdgeEndpoint((edge as any).from)) || 'unknown';
            const toNode = this.toStringId((edge as any).toNode) || this.toStringId(getNodeIdFromEdgeEndpoint((edge as any).to)) || 'unknown';
            const fromSide = this.toStringId((edge as any).fromSide) || (isRecord((edge as any).from) ? this.toStringId(((edge as any).from as Record<string, unknown>).side) : undefined) || 'unknown';
            const toSide = this.toStringId((edge as any).toSide) || (isRecord((edge as any).to) ? this.toStringId(((edge as any).to as Record<string, unknown>).side) : undefined) || 'unknown';
            return `${fromNode}:${fromSide}->${toNode}:${toSide}`;
        };

        const beforeRefresh = new Map<string, string>();
        const beforePathD = new Map<string, string>();
        const beforeLineGroup = new Map<string, string>();
        const beforeEndpoint = new Map<string, string>();

        for (const edge of edges) {
            if (edge.id) {
                beforeRefresh.set(edge.id, getEdgeBezierSignature(edge));
                beforePathD.set(edge.id, getEdgePathD(edge));
                beforeLineGroup.set(edge.id, getLineGroupState(edge));
                beforeEndpoint.set(edge.id, getEdgeEndpointSignature(edge));
            }
        }

        let pass1Rendered = 0;
        let bezierChangedPass1 = 0;
        let pathDChangedPass1 = 0;
        let lineGroupConnected = 0;
        let lineGroupDisplayChangedPass1 = 0;
        let lineGroupTransformChangedPass1 = 0;

        for (const edge of edges) {
            if (typeof (edge as any).render === 'function') {
                try {
                    (edge as any).render();
                    pass1Rendered++;
                } catch {
                    // 忽略单条边渲染失败
                }
            }
            if ((edge as any).lineGroupEl) {
                lineGroupConnected++;
            }
        }

        // Canvas 引擎会在 requestUpdate() 后自动刷新 SVG 路径（含7px stub + bezier曲线）
        // forceApplySVGPathFromBezier 已移除：该方法只写bezier部分，缺少stub，是不完整的
        if (typeof (canvas as any).requestUpdate === 'function') {
            (canvas as any).requestUpdate();
        }

        for (const edge of edges) {
            if (edge.id) {
                const before = beforeRefresh.get(edge.id);
                const after = getEdgeBezierSignature(edge);
                if (before !== after) bezierChangedPass1++;

                const beforeD = beforePathD.get(edge.id);
                const afterD = getEdgePathD(edge);
                if (beforeD !== afterD) pathDChangedPass1++;

                const beforeLG = beforeLineGroup.get(edge.id);
                const afterLG = getLineGroupState(edge);
                if (beforeLG && afterLG) {
                    const beforeDisplay = beforeLG.split(',')[0]?.replace('display=', '') || '';
                    const afterDisplay = afterLG.split(',')[0]?.replace('display=', '') || '';
                    if (beforeDisplay !== afterDisplay) lineGroupDisplayChangedPass1++;

                    const beforeTransform = beforeLG.split(',')[1]?.replace('transform=', '') || '';
                    const afterTransform = afterLG.split(',')[1]?.replace('transform=', '') || '';
                    if (beforeTransform !== afterTransform) lineGroupTransformChangedPass1++;
                }
            }
        }

        const afterPass1 = new Map<string, string>();
        const afterPathDPass1 = new Map<string, string>();
        for (const edge of edges) {
            if (edge.id) {
                afterPass1.set(edge.id, getEdgeBezierSignature(edge));
                afterPathDPass1.set(edge.id, getEdgePathD(edge));
            }
        }

        log(`[Layout] EdgeRefreshV3(pass1): rendered=${pass1Rendered}/${edges.length}, ` +
            `bezierChanged=${bezierChangedPass1}, pathDChanged=${pathDChangedPass1}, ` +
            `lineGroupConnected=${lineGroupConnected}, lineDisplayChanged=${lineGroupDisplayChangedPass1}, lineTransformChanged=${lineGroupTransformChangedPass1}, ` +
            `skipped=${edges.length - pass1Rendered}, ctx=${contextId || 'none'}`);

        // [修复] 检测低置信度场景（虚拟化节点多）— 墨水屏横/竖屏切换后，
        // 大量节点 DOM 尚未渲染，需要更长的等待时间让 Canvas 引擎完成虚拟化节点的几何更新
        const domVisibleCount = edges.slice(0, 20).filter(e => {
            const fromId = getNodeIdFromEdgeEndpoint((e as any).from) || this.toStringId((e as any).fromNode);
            const toId = getNodeIdFromEdgeEndpoint((e as any).to) || this.toStringId((e as any).toNode);
            return fromId && toId; // 仅做粗略检测，详情在 logEdgeGeometryDiagnostics
        }).length;
        const allSampleVirtualized = pass1Rendered > 0 && bezierChangedPass1 === 0 && lineGroupConnected === pass1Rendered;
        const isMobile = Platform.isMobile;
        const isLowConfidence = allSampleVirtualized || isMobile;

        // 自适应 pass1→pass2 间隔：低置信度用更长时间
        const passInterval = isLowConfidence
            ? CONSTANTS.TIMING.EDGE_REFRESH_EXTRA_PASS_INTERVAL
            : CONSTANTS.TIMING.EDGE_REFRESH_PASS_INTERVAL;

        if (isLowConfidence) {
            log(`[Layout] EdgeRefreshV3: 低置信度模式，使用延长等待 ${passInterval}ms (mobile=${isMobile}, allVirtualized=${allSampleVirtualized}), ctx=${contextId || 'none'}`);
        }

        await new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
                window.setTimeout(() => resolve(), passInterval);
            });
        });

        let pass2Rendered = 0;
        let bezierChangedPass2 = 0;
        let pathDChangedPass2 = 0;
        let endpointChangedButPathUnchanged = 0;
        const endpointChangedButPathUnchangedSamples: string[] = [];

        for (const edge of edges) {
            if (typeof (edge as any).render === 'function') {
                try {
                    (edge as any).render();
                    pass2Rendered++;
                } catch {
                    // 忽略单条边渲染失败
                }
            }
        }

        // Canvas 引擎在 requestUpdate() 后会自动构造完整 SVG 路径（含7px stub + bezier曲线）
        // 不再手动写 SVG path（forceApplySVGPathFromBezier 已从 pass2 移除）
        if (typeof (canvas as any).requestUpdate === 'function') {
            (canvas as any).requestUpdate();
        }

        for (const edge of edges) {
            if (edge.id) {
                const afterPass1Sig = afterPass1.get(edge.id);
                const afterPass2Sig = getEdgeBezierSignature(edge);
                if (afterPass1Sig !== afterPass2Sig) bezierChangedPass2++;

                const afterPass1D = afterPathDPass1.get(edge.id);
                const afterPass2D = getEdgePathD(edge);
                if (afterPass1D !== afterPass2D) pathDChangedPass2++;

                const beforeEndpointSig = beforeEndpoint.get(edge.id);
                const afterEndpointSig = getEdgeEndpointSignature(edge);
                const pathNeverChanged = beforePathD.get(edge.id) === afterPass1D && afterPass1D === afterPass2D;
                if (beforeEndpointSig && beforeEndpointSig !== afterEndpointSig && pathNeverChanged) {
                    endpointChangedButPathUnchanged++;
                    if (endpointChangedButPathUnchangedSamples.length < 3) {
                        endpointChangedButPathUnchangedSamples.push(`${edge.id}:${beforeEndpointSig}=>${afterEndpointSig}`);
                    }
                }
            }
        }

        log(`[Layout] EdgeRefreshV3(pass2): rendered=${pass2Rendered}/${edges.length}, ` +
            `bezierChanged=${bezierChangedPass2}, pathDChanged=${pathDChangedPass2}, ` +
            `endpointChangedButPathUnchanged=${endpointChangedButPathUnchanged}, ` +
            `sample=${endpointChangedButPathUnchangedSamples.join('|') || 'none'}, ` +
            `skipped=${edges.length - pass2Rendered}, ctx=${contextId || 'none'}`);

        return { pass1: pass1Rendered, pass2: pass2Rendered, bezierChangedPass1, bezierChangedPass2, pathDChangedPass1, pathDChangedPass2 };
    }

    /**
     * 在 arrange 完成后安排一次延迟边刷新（pass3）。
     * 专为墨水屏/移动端设计：arrange 完成时许多节点仍在虚拟化状态，
     * 需要等 Canvas 引擎完成 DOM 渲染后再次刷新边几何。
     */
    schedulePostArrangeEdgeRefresh(canvas: CanvasLike, contextId?: string): void {
        const isMobile = Platform.isMobile;
        const delay = isMobile
            ? CONSTANTS.TIMING.EDGE_REFRESH_DEFERRED_DELAY_MOBILE
            : CONSTANTS.TIMING.EDGE_REFRESH_DEFERRED_DELAY;

        log(`[Layout] EdgeRefreshV3(pass3-scheduled): delay=${delay}ms, mobile=${isMobile}, ctx=${contextId || 'none'}`);

        window.setTimeout(() => {
            const edges = this.getCanvasEdges(canvas);
            if (edges.length === 0) return;

            let pass3Rendered = 0;
            let bezierChanged = 0;

            // 记录 pass3 前的状态
            const beforeSigs = new Map<string, string>();
            for (const edge of edges) {
                if (edge.id) {
                    const bezier = (edge as any).bezier;
                    if (!bezier) {
                        beforeSigs.set(edge.id, 'no-bezier');
                        continue;
                    }
                    const from = bezier.from ? `${bezier.from.x?.toFixed(1)},${bezier.from.y?.toFixed(1)}` : 'no-from';
                    const to = bezier.to ? `${bezier.to.x?.toFixed(1)},${bezier.to.y?.toFixed(1)}` : 'no-to';
                    beforeSigs.set(edge.id, `${from}|${to}`);
                }
            }

            for (const edge of edges) {
                if (typeof (edge as any).render === 'function') {
                    try {
                        (edge as any).render();
                        pass3Rendered++;
                    } catch {
                        // 忽略单条边渲染失败
                    }
                }
            }

            for (const edge of edges) {
                if (!edge.id) continue;
                const bezier = (edge as any).bezier;
                if (!bezier) continue;
                const from = bezier.from ? `${bezier.from.x?.toFixed(1)},${bezier.from.y?.toFixed(1)}` : 'no-from';
                const to = bezier.to ? `${bezier.to.x?.toFixed(1)},${bezier.to.y?.toFixed(1)}` : 'no-to';
                const after = `${from}|${to}`;
                if (beforeSigs.get(edge.id) !== after) bezierChanged++;
            }

            // Canvas 引擎在 requestUpdate() 后自动渲染完整路径，不再手动写 SVG path
            if (typeof (canvas as any).requestUpdate === 'function') {
                (canvas as any).requestUpdate();
            }

            log(`[Layout] EdgeRefreshV3(pass3): rendered=${pass3Rendered}/${edges.length}, bezierChanged=${bezierChanged}, delay=${delay}ms, ctx=${contextId || 'none'}`);
        }, delay);
    }


    /**
     * 精简版全面诊断：一次性输出视口可见节点的四层高度对比 + 边锚点误差
     * 专为"边错连"问题设计，约 15-20 行日志，覆盖所有关键数据层
     */
    logComprehensiveDiag(
        canvas: CanvasLike,
        allNodes: Map<string, CanvasNodeLike>,
        tag: string,
        contextId?: string
    ): void {
        const edges = this.getCanvasEdges(canvas);
        const fileNodes: Map<string, Record<string, unknown>> = new Map();

        // 读取文件层数据
        const fileData = (canvas as any)?.data ?? (canvas as any)?.fileData;
        if (Array.isArray(fileData?.nodes)) {
            for (const fn of fileData.nodes as Array<Record<string, unknown>>) {
                if (typeof fn.id === 'string') fileNodes.set(fn.id, fn);
            }
        }

        // Canvas zoom / transform
        const zoom = Number((canvas as any).zoom ?? 1);
        const canvasEl = (canvas as any).canvasEl as HTMLElement | undefined;
        const canvasTf = canvasEl?.style?.transform ?? 'n/a';
        const vpEl = document.querySelector('.canvas-wrapper') ?? document.querySelector('.canvas-viewport');
        const vpRect = vpEl?.getBoundingClientRect();
        const vpStr = vpRect ? `${vpRect.width.toFixed(0)}x${vpRect.height.toFixed(0)}` : 'n/a';
        log(`[Diag-${tag}] Canvas: zoom=${zoom.toFixed(2)}, vp=${vpStr}, canvasTf="${canvasTf.slice(0, 60)}", ctx=${contextId ?? 'none'}`);

        // 找视口可见节点（DOM offsetHeight > 0）
        const visibleNodes: Array<{ id: string; node: CanvasNodeLike }> = [];
        for (const [id, node] of allNodes) {
            const el = (node as any).nodeEl as HTMLElement | undefined;
            if (el && el.offsetHeight > 0) {
                visibleNodes.push({ id, node });
            }
        }

        // 高度来源统计
        let fNeM = 0, mNeB = 0, bNeD = 0, allMatch = 0, domZero = 0;
        const lines: string[] = [];

        for (const { id, node } of Array.from(allNodes.values()).map((n) => ({ id: n.id ?? '', node: n }))) {
            const el = (node as any).nodeEl as HTMLElement | undefined;
            const dH = el ? el.offsetHeight : 0;
            if (dH === 0) domZero++;

            const fileNode = fileNodes.get(id);
            const fH = typeof fileNode?.height === 'number' ? fileNode.height : -1;
            const mH = typeof (node as any).height === 'number' ? (node as any).height : -1;
            const bbox = (node as any).bbox as { minX: number; minY: number; maxX: number; maxY: number } | undefined;
            const bH = bbox ? Math.round(bbox.maxY - bbox.minY) : -1;

            const hOk = fH === mH && (bH < 0 || Math.abs(bH - mH) <= 1) && (dH === 0 || Math.abs(dH - mH) <= 2);
            if (hOk) { allMatch++; } else {
                if (fH !== mH && fH >= 0 && mH >= 0) fNeM++;
                if (bH >= 0 && mH >= 0 && Math.abs(bH - mH) > 1) mNeB++;
                if (dH > 0 && mH >= 0 && Math.abs(dH - mH) > 2) bNeD++;
            }

            // 只对视口可见且有问题的节点输出详情（最多10个）
            if (lines.length < 10 && dH > 0 && !hOk) {
                const tf = el?.style?.transform ?? 'n/a';
                const bxStr = bbox ? `(${bbox.minX.toFixed(0)},${bbox.minY.toFixed(0)}->${bbox.maxX.toFixed(0)},${bbox.maxY.toFixed(0)})` : 'n/a';
                const domR = el ? el.getBoundingClientRect() : null;
                const domStr = domR ? `(${domR.left.toFixed(0)},${domR.top.toFixed(0)}->${domR.right.toFixed(0)},${domR.bottom.toFixed(0)})` : 'n/a';
                const flags = [fH !== mH ? '✗fH' : '', Math.abs(bH - mH) > 1 ? '✗bH' : '', dH > 0 && Math.abs(dH - mH) > 2 ? '✗dH' : ''].filter(Boolean).join(',');
                lines.push(`  ${id.slice(0, 6)}: fH=${fH},mH=${mH},bH=${bH},dH=${dH}, bx=${bxStr}, dom=${domStr}, tf="${tf.slice(0, 40)}" [${flags}]`);
            }
        }

        log(`[Diag-${tag}] Heights(${allNodes.size}): fH≠mH=${fNeM}, mH≠bH=${mNeB}, dH≠mH=${bNeD}, allMatch=${allMatch}, domZero=${domZero}`);
        if (lines.length > 0) {
            log(`[Diag-${tag}] ProblemNodes(${lines.length}):\n${lines.join('\n')}`);
        }

        // 边锚点误差（只检查连接到视口可见节点的边，最多10条）
        const visibleIds = new Set(visibleNodes.map((v) => v.id));
        const vpEdges = edges.filter((e) => {
            const fId = getNodeIdFromEdgeEndpoint((e as any).from) ?? this.toStringId((e as any).fromNode);
            const tId = getNodeIdFromEdgeEndpoint((e as any).to) ?? this.toStringId((e as any).toNode);
            return (fId && visibleIds.has(fId)) || (tId && visibleIds.has(tId));
        }).slice(0, 10);

        const edgeLines: string[] = [];
        for (const edge of vpEdges) {
            const fromId = getNodeIdFromEdgeEndpoint((edge as any).from) ?? this.toStringId((edge as any).fromNode);
            const toId = getNodeIdFromEdgeEndpoint((edge as any).to) ?? this.toStringId((edge as any).toNode);
            if (!fromId || !toId) continue;
            const fromNode = allNodes.get(fromId);
            const toNode = allNodes.get(toId);
            if (!fromNode || !toNode) continue;

            const fromSide = this.toStringId((edge as any).fromSide) ?? (isRecord((edge as any).from) ? this.toStringId(((edge as any).from as Record<string, unknown>).side) : undefined) ?? 'right';
            const toSide = this.toStringId((edge as any).toSide) ?? (isRecord((edge as any).to) ? this.toStringId(((edge as any).to as Record<string, unknown>).side) : undefined) ?? 'left';

            const fromBbox = (fromNode as any).bbox;
            const toBbox = (toNode as any).bbox;
            if (!fromBbox || !toBbox) continue;

            const expFrom = this.calculateAnchorPoint(fromBbox, fromSide);
            const expTo = this.calculateAnchorPoint(toBbox, toSide);

            const bezier = (edge as any).bezier;
            const bzrFrom = bezier?.from;
            const bzrTo = bezier?.to;

            const errF = bzrFrom ? Math.hypot(bzrFrom.x - expFrom.x, bzrFrom.y - expFrom.y) : -1;
            const errT = bzrTo ? Math.hypot(bzrTo.x - expTo.x, bzrTo.y - expTo.y) : -1;
            const ok = errF >= 0 && errT >= 0 && errF < 8 && errT < 8;

            const bzrFStr = bzrFrom ? `(${bzrFrom.x.toFixed(0)},${bzrFrom.y.toFixed(0)})` : 'n/a';
            const bzrTStr = bzrTo ? `(${bzrTo.x.toFixed(0)},${bzrTo.y.toFixed(0)})` : 'n/a';
            const expFStr = `(${expFrom.x.toFixed(0)},${expFrom.y.toFixed(0)})`;
            const expTStr = `(${expTo.x.toFixed(0)},${expTo.y.toFixed(0)})`;

            edgeLines.push(`  ${(edge.id ?? '?').slice(0, 6)}: ${fromId.slice(0, 6)}->${toId.slice(0, 6)} ${fromSide[0]}->${toSide[0]} bzr=${bzrFStr}->${bzrTStr} exp=${expFStr}->${expTStr} err=${errF.toFixed(1)}/${errT.toFixed(1)} ${ok ? '✓' : '✗'}`);
        }

        if (edgeLines.length > 0) {
            log(`[Diag-${tag}] VpEdges(${vpEdges.length}):\n${edgeLines.join('\n')}`);
        } else {
            log(`[Diag-${tag}] VpEdges: vpVisible=${visibleNodes.length}, connected edges=0 (all virtualized?)`);
        }

        // =====================================================================
        // [DOM 视觉层诊断] —— 最关键的缺失：直接对比节点/边的真实屏幕像素位置
        // 这是"边悬在空中，节点框掉下去了几十个像素"的直接证据层
        // =====================================================================
        this.logVisualLayerDiag(canvas, allNodes, visibleNodes, tag, contextId);
    }

    /**
     * [关键诊断] DOM 视觉层：对比节点真实屏幕像素位置与边 SVG 路径的实际屏幕位置。
     *
     * 输出三段：
     *   [Diag-*-Visual] CanvasTransform: canvas 容器实际屏幕位置 + CSS transform 矩阵分解
     *   [Diag-*-Visual] NodeScreenPos: 节点数据坐标、CSS transform、getBoundingClientRect
     *   [Diag-*-Visual] EdgeScreenPos: 边 SVG path getBoundingClientRect + bezier 端点的
     *                   预期屏幕坐标 vs 实际 SVG 路径端点 → 两者像素差即为"线悬空"的像素数
     */
    private logVisualLayerDiag(
        canvas: CanvasLike,
        allNodes: Map<string, CanvasNodeLike>,
        visibleNodes: Array<{ id: string; node: CanvasNodeLike }>,
        tag: string,
        contextId?: string
    ): void {
        const c = canvas as any;
        const ctxStr = contextId ?? 'none';

        // [真值工具] 从 SVG path 提取“屏幕像素坐标”端点，不依赖手工 transform 推算
        const getPathEndpointScreen = (pathEl: Element | null, atStart: boolean): { x: number; y: number } | null => {
            try {
                if (!(pathEl instanceof SVGPathElement)) return null;
                const total = pathEl.getTotalLength();
                const length = atStart ? 0 : Math.max(0, total);
                const point = pathEl.getPointAtLength(length);

                // 使用临时 circle + getBoundingClientRect 获取“浏览器最终渲染”的屏幕坐标。
                // 比 getScreenCTM 更稳健：可覆盖 HTML/CSS 祖先 transform 链。
                const svgRoot = pathEl.ownerSVGElement;
                const svgParent = pathEl.parentElement;
                if (!svgRoot || !svgParent) return null;

                const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                marker.setAttribute('cx', String(point.x));
                marker.setAttribute('cy', String(point.y));
                marker.setAttribute('r', '0.5');
                marker.setAttribute('fill', 'transparent');
                marker.setAttribute('data-cmb-debug', 'endpoint-marker');

                // 关键：marker 必须挂到与 path 同一父容器，继承完全一致的局部 transform。
                // 若挂到 svgRoot，会丢失 lineGroup 的 transform，导致屏幕坐标系统性偏移。
                svgParent.appendChild(marker);
                const rect = marker.getBoundingClientRect();
                marker.remove();

                return {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                };
            } catch {
                return null;
            }
        };

        const getTransformChain = (el: Element | null, stopAtClass = 'canvas'): string => {
            const segs: string[] = [];
            let cur: Element | null = el;
            let depth = 0;
            while (cur && depth < 8) {
                const htmlEl = cur as HTMLElement;
                const cls = htmlEl.className ? String(htmlEl.className).replace(/\s+/g, '.') : cur.tagName.toLowerCase();
                const styleTf = (htmlEl.style?.transform || '').trim();
                const computedTf = window.getComputedStyle(htmlEl).transform || 'none';
                segs.push(`${cur.tagName.toLowerCase()}.${cls}[styleTf=${styleTf || 'none'}|computedTf=${computedTf}]`);
                if ((htmlEl.classList && htmlEl.classList.contains(stopAtClass)) || cur.tagName.toLowerCase() === 'body') break;
                cur = cur.parentElement;
                depth++;
            }
            return segs.join(' <- ');
        };

        // --- 1. Canvas 容器 transform 分析 ---
        const canvasEl = c.canvasEl as HTMLElement | undefined;
        const canvasContainerEl = canvasEl?.parentElement;
        const containerRect = canvasContainerEl?.getBoundingClientRect();
        const canvasCssTransform = canvasEl?.style?.transform ?? 'n/a';
        const svgRoot = canvasEl?.querySelector('svg');

        // 解析 CSS transform: "translate(Xpx, Ypx) scale(S)" or matrix(a,b,c,d,e,f)
        let parsedScale = 1, parsedTx = 0, parsedTy = 0;
        const matchTranslate = canvasCssTransform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
        const matchScale = canvasCssTransform.match(/scale\(([-\d.]+)\)/);
        if (matchTranslate) { parsedTx = parseFloat(matchTranslate[1] ?? '0'); parsedTy = parseFloat(matchTranslate[2] ?? '0'); }
        if (matchScale) { parsedScale = parseFloat(matchScale[1] ?? '1'); }

        const containerStr = containerRect
            ? `screen(${containerRect.left.toFixed(0)},${containerRect.top.toFixed(0)}->${containerRect.right.toFixed(0)},${containerRect.bottom.toFixed(0)})`
            : 'n/a';
        const projectCanvasPointBySvg = (x: number, y: number): { x: number; y: number } | null => {
            if (!(svgRoot instanceof SVGSVGElement)) return null;
            try {
                const ctm = svgRoot.getScreenCTM();
                if (!ctm) return null;
                const p = svgRoot.createSVGPoint();
                p.x = x;
                p.y = y;
                const projected = p.matrixTransform(ctm);
                return { x: projected.x, y: projected.y };
            } catch {
                return null;
            }
        };

        log(`[Diag-${tag}-Visual] CanvasTransform: containerRect=${containerStr}, ` +
            `cssTf="${canvasCssTransform.slice(0, 80)}", parsedScale=${parsedScale.toFixed(4)}, ` +
            `parsedTx=${parsedTx.toFixed(1)}, parsedTy=${parsedTy.toFixed(1)}, ctx=${ctxStr}`);

        // --- 2. 前3个可见节点：数据坐标 vs 实际屏幕位置 vs 预期屏幕位置 ---
        const nodeLines: string[] = [];
        const sampleNodes = visibleNodes.slice(0, 3);
        for (const { id, node } of sampleNodes) {
            const nodeEl = (node as any).nodeEl as HTMLElement | undefined;
            if (!nodeEl) continue;

            const dataX = typeof (node as any).x === 'number' ? (node as any).x : 0;
            const dataY = typeof (node as any).y === 'number' ? (node as any).y : 0;
            const dataW = typeof (node as any).width === 'number' ? (node as any).width : 0;
            const dataH = typeof (node as any).height === 'number' ? (node as any).height : 0;

            // 实际屏幕位置
            const actualRect = nodeEl.getBoundingClientRect();

            // 节点自身的 CSS transform（相对于 canvasEl 容器）
            const nodeSelfTf = nodeEl.style.transform ?? 'n/a';

            // 预期屏幕位置（用 canvas CSS transform 矩阵推算）：
            // canvasEl 的 transform = translate(tx,ty) scale(s)
            // canvas 内的元素还可能有额外的 translate (innerTx, innerTy)（canvas 自身 pan）
            // 简化公式：screen_x = containerLeft + tx + dataX * s
            const cLeft = containerRect ? containerRect.left : 0;
            const cTop = containerRect ? containerRect.top : 0;
            const expLeft = cLeft + parsedTx + dataX * parsedScale;
            const expTop = cTop + parsedTy + dataY * parsedScale;
            const expBySvg = projectCanvasPointBySvg(dataX, dataY);

            // 实际 vs 预期差值
            const dLeft = actualRect.left - expLeft;
            const dTop = actualRect.top - expTop;
            const dLeftSvg = expBySvg ? (actualRect.left - expBySvg.x) : NaN;
            const dTopSvg = expBySvg ? (actualRect.top - expBySvg.y) : NaN;

            nodeLines.push(
                `  ${id.slice(0, 8)}: data(${dataX},${dataY} ${dataW}x${dataH}) ` +
                `actual=(${actualRect.left.toFixed(1)},${actualRect.top.toFixed(1)}->${actualRect.right.toFixed(1)},${actualRect.bottom.toFixed(1)}) ` +
                `exp=(${expLeft.toFixed(1)},${expTop.toFixed(1)}) ` +
                `delta=(${dLeft.toFixed(1)},${dTop.toFixed(1)}) ` +
                `expSvg=${expBySvg ? `(${expBySvg.x.toFixed(1)},${expBySvg.y.toFixed(1)})` : 'n/a'} ` +
                `deltaSvg=${expBySvg ? `(${dLeftSvg.toFixed(1)},${dTopSvg.toFixed(1)})` : 'n/a'} ` +
                `nodeTf="${nodeSelfTf.slice(0, 50)}"`
            );
        }
        if (nodeLines.length > 0) {
            log(`[Diag-${tag}-Visual] NodeScreenPos:\n${nodeLines.join('\n')}`);
        }

        // --- 3. 前3条可见边：边 SVG 路径真实屏幕端点 vs 节点锚点真实屏幕位置 ---
        const edgeVisualLines: string[] = [];
        const visibleIds = new Set(visibleNodes.map(v => v.id));
        const sampleEdges = getEdgesFromCanvas(canvas).filter(e => {
            const fId = getNodeIdFromEdgeEndpoint((e as any).from) ?? this.toStringId((e as any).fromNode) ?? '';
            const tId = getNodeIdFromEdgeEndpoint((e as any).to) ?? this.toStringId((e as any).toNode) ?? '';
            return fId !== '' && visibleIds.has(fId) && tId !== '' && visibleIds.has(tId);
        }).slice(0, 3);

        for (const edge of sampleEdges) {
            const fromId = getNodeIdFromEdgeEndpoint((edge as any).from) ?? this.toStringId((edge as any).fromNode) ?? '';
            const toId = getNodeIdFromEdgeEndpoint((edge as any).to) ?? this.toStringId((edge as any).toNode) ?? '';
            const fromNode = allNodes.get(fromId);
            const toNode = allNodes.get(toId);

            // Edge SVG 路径实际屏幕 BoundingRect
            const lineGroupEl = (edge as any).lineGroupEl as HTMLElement | undefined;
            const pathEl: Element | null = (edge as any).pathEl || lineGroupEl?.querySelector('path') || null;
            const pathRect = pathEl ? pathEl.getBoundingClientRect() : null;
            const pathCTM = pathEl instanceof SVGGraphicsElement ? pathEl.getScreenCTM() : null;
            const pathCTMStr = pathCTM
                ? `a=${pathCTM.a.toFixed(4)},b=${pathCTM.b.toFixed(4)},c=${pathCTM.c.toFixed(4)},d=${pathCTM.d.toFixed(4)},e=${pathCTM.e.toFixed(1)},f=${pathCTM.f.toFixed(1)}`
                : 'n/a';

            // [真值] 从 path 本身提取首末端点的屏幕坐标（不再依赖手工解析 transform）
            const pathStartScreen = getPathEndpointScreen(pathEl, true);
            const pathEndScreen = getPathEndpointScreen(pathEl, false);

            // 从节点框算出 right edge 的实际屏幕 x/y（中心）
            const fromNodeEl = fromNode ? (fromNode as any).nodeEl as HTMLElement | undefined : undefined;
            const toNodeEl = toNode ? (toNode as any).nodeEl as HTMLElement | undefined : undefined;
            const fromRect = fromNodeEl ? fromNodeEl.getBoundingClientRect() : null;
            const toRect = toNodeEl ? toNodeEl.getBoundingClientRect() : null;

            // 右侧锚点实际屏幕坐标
            const fromSide = this.toStringId((edge as any).fromSide) ?? 'right';
            const toSide = this.toStringId((edge as any).toSide) ?? 'left';
            const fromAnchorX = fromRect ? (fromSide === 'right' ? fromRect.right : fromRect.left) : null;
            const fromAnchorY = fromRect ? (fromRect.top + fromRect.bottom) / 2 : null;
            const toAnchorX = toRect ? (toSide === 'left' ? toRect.left : toRect.right) : null;
            const toAnchorY = toRect ? (toRect.top + toRect.bottom) / 2 : null;

            // 计算 direct / reverse 两种映射，自动选择更合理的一种（防止 path 方向与 from/to 方向相反）
            const directScore = (
                pathStartScreen && pathEndScreen &&
                fromAnchorX !== null && fromAnchorY !== null &&
                toAnchorX !== null && toAnchorY !== null
            )
                ? Math.hypot(pathStartScreen.x - fromAnchorX, pathStartScreen.y - fromAnchorY)
                    + Math.hypot(pathEndScreen.x - toAnchorX, pathEndScreen.y - toAnchorY)
                : Number.POSITIVE_INFINITY;

            const reverseScore = (
                pathStartScreen && pathEndScreen &&
                fromAnchorX !== null && fromAnchorY !== null &&
                toAnchorX !== null && toAnchorY !== null
            )
                ? Math.hypot(pathStartScreen.x - toAnchorX, pathStartScreen.y - toAnchorY)
                    + Math.hypot(pathEndScreen.x - fromAnchorX, pathEndScreen.y - fromAnchorY)
                : Number.POSITIVE_INFINITY;

            const useReverse = reverseScore < directScore;

            const mappedFrom = useReverse ? pathEndScreen : pathStartScreen;
            const mappedTo = useReverse ? pathStartScreen : pathEndScreen;

            const fromGapX = (mappedFrom && fromAnchorX !== null) ? (mappedFrom.x - fromAnchorX) : null;
            const fromGapY = (mappedFrom && fromAnchorY !== null) ? (mappedFrom.y - fromAnchorY) : null;
            const toGapX = (mappedTo && toAnchorX !== null) ? (mappedTo.x - toAnchorX) : null;
            const toGapY = (mappedTo && toAnchorY !== null) ? (mappedTo.y - toAnchorY) : null;
            const fromGapDist = (fromGapX !== null && fromGapY !== null) ? Math.hypot(fromGapX, fromGapY) : null;
            const toGapDist = (toGapX !== null && toGapY !== null) ? Math.hypot(toGapX, toGapY) : null;

            const pathRectStr = pathRect ? `(${pathRect.left.toFixed(0)},${pathRect.top.toFixed(0)}->${pathRect.right.toFixed(0)},${pathRect.bottom.toFixed(0)})` : 'n/a';
            const pathEndsStr = (pathStartScreen && pathEndScreen)
                ? `pathEnds=(${pathStartScreen.x.toFixed(1)},${pathStartScreen.y.toFixed(1)})->(${pathEndScreen.x.toFixed(1)},${pathEndScreen.y.toFixed(1)})`
                : 'pathEnds=n/a';
            const anchorStr = (fromAnchorX !== null && toAnchorX !== null)
                ? `anchors=(${fromAnchorX.toFixed(1)},${fromAnchorY?.toFixed(1)})->(${toAnchorX.toFixed(1)},${toAnchorY?.toFixed(1)})`
                : 'anchors=n/a';
            const gapStr = (fromGapX !== null && toGapX !== null)
                ? `gapFrom=(${fromGapX.toFixed(1)},${fromGapY?.toFixed(1)}|${fromGapDist?.toFixed(1)}px), gapTo=(${toGapX.toFixed(1)},${toGapY?.toFixed(1)}|${toGapDist?.toFixed(1)}px)`
                : 'gap=n/a';

            const pathChain = getTransformChain(pathEl, 'canvas');
            const fromChain = getTransformChain(fromNodeEl ?? null, 'canvas');
            const toChain = getTransformChain(toNodeEl ?? null, 'canvas');

            const toStyle = toNodeEl
                ? `style(left=${toNodeEl.style.left || 'n/a'},top=${toNodeEl.style.top || 'n/a'},tf=${toNodeEl.style.transform || 'n/a'})`
                : 'style(n/a)';
            const toComputed = toNodeEl
                ? (() => {
                    const cs = window.getComputedStyle(toNodeEl);
                    return `computed(left=${cs.left},top=${cs.top},tf=${cs.transform})`;
                })()
                : 'computed(n/a)';

            const toRectCenter = toRect
                ? `toRectCenter=(${((toRect.left + toRect.right) / 2).toFixed(1)},${((toRect.top + toRect.bottom) / 2).toFixed(1)})`
                : 'toRectCenter=n/a';
            const toBboxCenter = toNode
                ? (() => {
                    const b = (toNode as any).bbox as { minX: number; minY: number; maxX: number; maxY: number } | undefined;
                    if (!b) return 'toBboxCenter=n/a';
                    return `toBboxCenter=(${((b.minX + b.maxX) / 2).toFixed(1)},${((b.minY + b.maxY) / 2).toFixed(1)})`;
                })()
                : 'toBboxCenter=n/a';

            edgeVisualLines.push(
                `  ${(edge.id ?? '?').slice(0, 8)} ${fromId.slice(0, 6)}->${toId.slice(0, 6)}: ` +
                `pathRect=${pathRectStr} ${pathEndsStr} ${anchorStr} ${gapStr} map=${useReverse ? 'reverse' : 'direct'} ` +
                `ctm={${pathCTMStr}}\n` +
                `    pathChain=${pathChain}\n` +
                `    fromNodeChain=${fromChain}\n` +
                `    toNodeChain=${toChain}\n` +
                `    ${toStyle}; ${toComputed}; ${toRectCenter}; ${toBboxCenter}`
            );
        }
        if (edgeVisualLines.length > 0) {
            log(`[Diag-${tag}-Visual] EdgeScreenPos(★关键):\n${edgeVisualLines.join('\n')}`);
        } else {
            log(`[Diag-${tag}-Visual] EdgeScreenPos: 无两端均可见的边可采样`);
        }
    }

    /**
     * [全量诊断] 输出全部节点的文件/内存/bbox/DOM 高度对比 + 全部边的 bezier 误差
     * 专为 T13C 墨水屏定位"边错连"根因，能一次性暴露所有高度不匹配的节点
     *
     * 输出格式:
     *   [DiagFull-TAG] NodeSnapshot: 统计摘要
     *   [DiagFull-TAG] NodeMismatch: 全部 |domH-memH|>5px 的节点，按差值降序
     *   [DiagFull-TAG] EdgeSnapshot: 统计摘要
     *   [DiagFull-TAG] EdgeBad: 全部 err>8px 的边（bezier vs expected），按误差降序
     */
    logFullDiagSnapshot(
        canvas: CanvasLike,
        allNodes: Map<string, CanvasNodeLike>,
        tag: string,
        contextId?: string
    ): void {
        const ctxStr = contextId ?? 'none';
        const edges = this.getCanvasEdges(canvas);

        // 读取文件层数据（canvas 内部缓存的文件数据，不同于已写磁盘的数据）
        const fileData = (canvas as any)?.data ?? (canvas as any)?.fileData;
        const fileNodeMap = new Map<string, Record<string, unknown>>();
        if (Array.isArray(fileData?.nodes)) {
            for (const fn of fileData.nodes as Array<Record<string, unknown>>) {
                if (typeof fn.id === 'string') fileNodeMap.set(fn.id, fn);
            }
        }

        // === 节点全量快照 ===
        const nodeRows: Array<{ absDelta: number; line: string }> = [];
        let matchCount = 0, mismatch5 = 0, mismatch20 = 0, virtCount = 0;

        for (const [id, node] of allNodes) {
            const nodeEl = (node as any).nodeEl as HTMLElement | undefined;
            const domH = nodeEl ? nodeEl.offsetHeight : 0;
            const domRectH = nodeEl ? Math.round(nodeEl.getBoundingClientRect().height) : 0;
            const memH = typeof (node as any).height === 'number' ? (node as any).height : -1;
            const bbox = (node as any).bbox as { minX: number; minY: number; maxX: number; maxY: number } | undefined;
            const bboxH = bbox ? Math.round(bbox.maxY - bbox.minY) : -1;
            const fileNode = fileNodeMap.get(id);
            const fileH = typeof fileNode?.height === 'number' ? fileNode.height : -1;
            const isVirt = !nodeEl || domH === 0;
            if (isVirt) virtCount++;
            const absDelta = domH > 0 ? Math.abs(domH - memH) : -1;

            if (absDelta < 0) {
                // virtualized
            } else if (absDelta <= 2) {
                matchCount++;
            } else if (absDelta > 20) {
                mismatch20++;
            } else if (absDelta > 5) {
                mismatch5++;
            } else {
                matchCount++;
            }

            // 节点 DATA 层的 x/y
            const dataX = typeof (node as any).x === 'number' ? (node as any).x : 0;
            const dataY = typeof (node as any).y === 'number' ? (node as any).y : 0;
            const dataW = typeof (node as any).width === 'number' ? (node as any).width : 0;
            const nodeTf = nodeEl?.style?.transform ?? 'n/a';

            const deltaStr = absDelta < 0 ? 'virt' : `${domH > memH ? '+' : ''}${domH - memH}`;
            const line = `  ${id.slice(0, 8)}: fileH=${fileH} memH=${memH} bboxH=${bboxH} domH=${domH}(rect=${domRectH}) pos=(${dataX},${dataY}) w=${dataW} delta=${deltaStr} tf="${nodeTf.slice(0, 35)}"`;
            nodeRows.push({ absDelta: absDelta < 0 ? -1 : absDelta, line });
        }

        // 按 |delta| 降序（最大差异在前，virtualized=-1 放最后）
        nodeRows.sort((a, b) => b.absDelta - a.absDelta);

        log(`[DiagFull-${tag}] NodeSnapshot: total=${allNodes.size}, match(≤2)=${matchCount}, mismatch(5-20)=${mismatch5}, mismatch(>20)=${mismatch20}, virt=${virtCount}, ctx=${ctxStr}`);

        const mismatchRows = nodeRows.filter(r => r.absDelta > 5);
        if (mismatchRows.length > 0) {
            log(`[DiagFull-${tag}] NodeMismatch(${mismatchRows.length} nodes |delta|>5px, desc):\n${mismatchRows.slice(0, 30).map(r => r.line).join('\n')}`);
        } else {
            log(`[DiagFull-${tag}] NodeMismatch: 无节点 |delta| > 5px ✓`);
        }

        // === 边全量快照 ===
        const edgeRows: Array<{ maxErr: number; line: string }> = [];
        let edgeOk = 0, edgeWarn = 0, edgeBad = 0, edgeNoData = 0;

        for (const edge of edges) {
            const fromId = getNodeIdFromEdgeEndpoint((edge as any).from) ?? this.toStringId((edge as any).fromNode) ?? '';
            const toId = getNodeIdFromEdgeEndpoint((edge as any).to) ?? this.toStringId((edge as any).toNode) ?? '';
            const fromNode = allNodes.get(fromId);
            const toNode = allNodes.get(toId);

            const bezier = (edge as any).bezier;
            const bzrFrom = bezier?.from;
            const bzrTo = bezier?.to;

            const fromBbox = fromNode ? (fromNode as any).bbox : undefined;
            const toBbox = toNode ? (toNode as any).bbox : undefined;

            if (!fromBbox || !toBbox || !bzrFrom || !bzrTo) {
                edgeNoData++;
                continue;
            }

            const fromSide = this.toStringId((edge as any).fromSide) ?? (isRecord((edge as any).from) ? this.toStringId(((edge as any).from as Record<string, unknown>).side) : undefined) ?? 'right';
            const toSide = this.toStringId((edge as any).toSide) ?? (isRecord((edge as any).to) ? this.toStringId(((edge as any).to as Record<string, unknown>).side) : undefined) ?? 'left';
            const expFrom = this.calculateAnchorPoint(fromBbox, fromSide);
            const expTo = this.calculateAnchorPoint(toBbox, toSide);
            const errF = Math.hypot(bzrFrom.x - expFrom.x, bzrFrom.y - expFrom.y);
            const errT = Math.hypot(bzrTo.x - expTo.x, bzrTo.y - expTo.y);
            const maxErr = Math.max(errF, errT);

            if (maxErr <= 8) edgeOk++;
            else if (maxErr <= 20) edgeWarn++;
            else edgeBad++;

            // 只记录 err > 8 的边（stub=7px 正常，>8 才异常）
            if (maxErr > 8) {
                const fromMemH = fromNode && typeof (fromNode as any).height === 'number' ? (fromNode as any).height : -1;
                const fromDomH = fromNode ? ((fromNode as any).nodeEl as HTMLElement | undefined)?.offsetHeight ?? 0 : -1;
                const toMemH = toNode && typeof (toNode as any).height === 'number' ? (toNode as any).height : -1;
                const toDomH = toNode ? ((toNode as any).nodeEl as HTMLElement | undefined)?.offsetHeight ?? 0 : -1;
                const bzrFStr = `(${bzrFrom.x.toFixed(0)},${bzrFrom.y.toFixed(0)})`;
                const bzrTStr = `(${bzrTo.x.toFixed(0)},${bzrTo.y.toFixed(0)})`;
                const expFStr = `(${expFrom.x.toFixed(0)},${expFrom.y.toFixed(0)})`;
                const expTStr = `(${expTo.x.toFixed(0)},${expTo.y.toFixed(0)})`;
                const line = `  ${(edge.id ?? '?').slice(0, 8)} ${fromId.slice(0, 8)}(m=${fromMemH},d=${fromDomH})->${toId.slice(0, 8)}(m=${toMemH},d=${toDomH}): bzr=${bzrFStr}->${bzrTStr} exp=${expFStr}->${expTStr} errF=${errF.toFixed(1)} errT=${errT.toFixed(1)}`;
                edgeRows.push({ maxErr, line });
            }
        }

        edgeRows.sort((a, b) => b.maxErr - a.maxErr);

        log(`[DiagFull-${tag}] EdgeSnapshot: total=${edges.length}, ok(≤8)=${edgeOk}, warn(9-20)=${edgeWarn}, bad(>20)=${edgeBad}, noData=${edgeNoData}, ctx=${ctxStr}`);
        if (edgeRows.length > 0) {
            log(`[DiagFull-${tag}] EdgeBad(${edgeRows.length} err>8px, desc):\n${edgeRows.slice(0, 30).map(r => r.line).join('\n')}`);
        } else {
            log(`[DiagFull-${tag}] EdgeBad: 无边 err > 8px ✓`);
        }
    }

    logEdgeGeometryDiagnostics(
        canvas: CanvasLike,
        allNodes: Map<string, CanvasNodeLike>,
        tag: string,
        contextId?: string,
        prevDiagnostics?: EdgeGeomDiagnostics
    ): void {
        const edges = this.getCanvasEdges(canvas);
        if (edges.length === 0) {
            log(`[Layout] EdgeGeom(${tag}): edges=0, ctx=${contextId || 'none'}`);
            return;
        }

        const fileEdges = Array.isArray((canvas as any)?.fileData?.edges) ? ((canvas as any).fileData.edges as Array<Record<string, unknown>>) : [];
        const fileEdgeMap = new Map<string, Record<string, unknown>>();
        for (const edge of fileEdges) {
            const edgeId = typeof edge.id === 'string' ? edge.id : undefined;
            if (edgeId) fileEdgeMap.set(edgeId, edge);
        }

        const sampleEdges = edges.slice(0, 20);
        let mismatchCount = 0;
        let maxFromErr = 0;
        let maxToErr = 0;
        let totalFromErr = 0;
        let totalToErr = 0;

        let domDomCount = 0;
        let domVirtualCount = 0;
        let virtualVirtualCount = 0;

        let domVisibleVisibleCount = 0;
        let domVisibleZeroCount = 0;
        let domZeroZeroCount = 0;
        let domMissingFromCount = 0;
        let domMissingToCount = 0;

        let adjustedMismatchCount = 0;
        let totalAdjFromErr = 0;
        let totalAdjToErr = 0;

        const edgeErrors: Map<string, { fromErr: number; toErr: number }> = new Map();

        const samples: string[] = [];
        const endpointTruthSamples: string[] = [];

        const zoomRaw = Number((canvas as any).zoom || 1);
        const zoomScaleAbs = Number.isFinite(zoomRaw) && zoomRaw !== 0 ? Math.abs(zoomRaw) : 1;
        const vpEl = document.querySelector('.canvas-wrapper') || document.querySelector('.canvas-viewport');
        const vpRect = vpEl?.getBoundingClientRect();

        const getNodeDomState = (node: CanvasNodeLike): 'visible' | 'zero' | 'missing' => {
            if (!node) return 'missing';
            const nodeEl = (node as any).nodeEl;
            if (!nodeEl || !(nodeEl instanceof HTMLElement)) return 'missing';

            const display = window.getComputedStyle(nodeEl).display;
            if (display === 'none') return 'zero';

            const rectHeight = nodeEl.getBoundingClientRect().height;
            if (rectHeight > 0) return 'visible';
            return 'zero';
        };

        const isNodeInViewport = (node: CanvasNodeLike): boolean => {
            if (!vpRect) return true;
            const nodeBbox = (node as any).bbox;
            if (!nodeBbox) return false;
            const centerX = (nodeBbox.minX + nodeBbox.maxX) / 2;
            const centerY = (nodeBbox.minY + nodeBbox.maxY) / 2;
            return centerX * zoomScaleAbs >= vpRect.left && centerX * zoomScaleAbs <= vpRect.right &&
                   centerY * zoomScaleAbs >= vpRect.top && centerY * zoomScaleAbs <= vpRect.bottom;
        };

        for (const edge of sampleEdges) {
            const fromId = getNodeIdFromEdgeEndpoint(edge.from) || this.toStringId(edge.fromNode);
            const toId = getNodeIdFromEdgeEndpoint(edge.to) || this.toStringId(edge.toNode);

            if (!fromId || !toId) continue;

            const fromNode = allNodes.get(fromId);
            const toNode = allNodes.get(toId);

            if (!fromNode || !toNode) continue;

            const fromDomState = getNodeDomState(fromNode);
            const toDomState = getNodeDomState(toNode);

            if (fromDomState === 'visible' && toDomState === 'visible') {
                domVisibleVisibleCount++;
            } else if (fromDomState === 'visible' && toDomState === 'zero') {
                domVisibleZeroCount++;
            } else if (fromDomState === 'zero' && toDomState === 'visible') {
                domVisibleZeroCount++;
            } else if (fromDomState === 'zero' && toDomState === 'zero') {
                domZeroZeroCount++;
            } else if (fromDomState === 'missing') {
                domMissingFromCount++;
            } else if (toDomState === 'missing') {
                domMissingToCount++;
            }

            const bezierFrom = (edge as any).bezier?.from;
            const bezierTo = (edge as any).bezier?.to;

            const fromSide = edge.fromSide || (typeof edge.from === 'object' ? (edge.from as any).side : undefined) || 'right';
            const toSide = edge.toSide || (typeof edge.to === 'object' ? (edge.to as any).side : undefined) || 'left';

            const fromBbox = (fromNode as any).bbox;
            const toBbox = (toNode as any).bbox;

            if (!fromBbox || !toBbox) continue;

            const expectedFrom = this.calculateAnchorPoint(fromBbox, fromSide);
            const expectedTo = this.calculateAnchorPoint(toBbox, toSide);

            const fromErr = bezierFrom ? Math.hypot(bezierFrom.x - expectedFrom.x, bezierFrom.y - expectedFrom.y) : 0;
            const toErr = bezierTo ? Math.hypot(bezierTo.x - expectedTo.x, bezierTo.y - expectedTo.y) : 0;

            const sideOffset = 7;
            const adjFromErr = Math.max(0, fromErr - sideOffset);
            const adjToErr = Math.max(0, toErr - sideOffset);

            const fromInVp = isNodeInViewport(fromNode);
            const toInVp = isNodeInViewport(toNode);
            if (fromInVp && toInVp) {
                domDomCount++;
            } else if (!fromInVp && !toInVp) {
                virtualVirtualCount++;
            } else {
                domVirtualCount++;
            }

            if (adjFromErr > 5 || adjToErr > 5) adjustedMismatchCount++;
            totalAdjFromErr += adjFromErr;
            totalAdjToErr += adjToErr;

            if (fromErr > 5 || toErr > 5) mismatchCount++;
            if (fromErr > maxFromErr) maxFromErr = fromErr;
            if (toErr > maxToErr) maxToErr = toErr;
            totalFromErr += fromErr;
            totalToErr += toErr;

            edgeErrors.set(edge.id || `${fromId}-${toId}`, { fromErr, toErr });

            if (samples.length < 3) {
                samples.push(`${fromId?.slice(0, 6)}(${fromDomState})->${toId?.slice(0, 6)}(${toDomState}): err=${fromErr.toFixed(1)}/${toErr.toFixed(1)}`);
            }

            if (endpointTruthSamples.length < 3 && edge.id) {
                const fileEdge = fileEdgeMap.get(edge.id);
                const fileFromId = this.toStringId(fileEdge?.fromNode) || this.toStringId(getNodeIdFromEdgeEndpoint(fileEdge?.from)) || 'unknown';
                const fileToId = this.toStringId(fileEdge?.toNode) || this.toStringId(getNodeIdFromEdgeEndpoint(fileEdge?.to)) || 'unknown';
                const memFromId = this.toStringId(edge.fromNode) || this.toStringId(getNodeIdFromEdgeEndpoint(edge.from)) || 'unknown';
                const memToId = this.toStringId(edge.toNode) || this.toStringId(getNodeIdFromEdgeEndpoint(edge.to)) || 'unknown';
                endpointTruthSamples.push(`${edge.id}:${fileFromId}->${fileToId}|mem=${memFromId}->${memToId}`);
            }
        }

        const sampleCount = sampleEdges.length;
        const avgFromErr = sampleCount > 0 ? totalFromErr / sampleCount : 0;
        const avgToErr = sampleCount > 0 ? totalToErr / sampleCount : 0;

        const avgAdjFromErr = sampleCount > 0 ? totalAdjFromErr / sampleCount : 0;
        const avgAdjToErr = sampleCount > 0 ? totalAdjToErr / sampleCount : 0;

        const confidence = sampleCount > 0 ? (domVisibleVisibleCount / sampleCount * 100).toFixed(1) : '0.0';
        const confidenceNum = Number(confidence);
        const confidenceFlag = confidenceNum < 40 ? 'LOW_CONFIDENCE' : 'OK';

        let improvedEdges = 0;
        let worseEdges = 0;
        let unchangedEdges = 0;
        if (prevDiagnostics) {
            for (const [edgeId, currErr] of edgeErrors.entries()) {
                const prevErr = prevDiagnostics.edgeErrors?.get(edgeId);
                if (prevErr) {
                    const currTotal = currErr.fromErr + currErr.toErr;
                    const prevTotal = prevErr.fromErr + prevErr.toErr;
                    if (currTotal < prevTotal - 1) {
                        improvedEdges++;
                    } else if (currTotal > prevTotal + 1) {
                        worseEdges++;
                    } else {
                        unchangedEdges++;
                    }
                }
            }
        }

        log(`[Layout] EdgeGeomV3(${tag}): edges=${edges.length}, sample=${sampleCount}, zoom=${zoomScaleAbs.toFixed(2)}, ` +
            `mismatch=${mismatchCount}(adj=${adjustedMismatchCount}), ` +
            `maxFromErr=${maxFromErr.toFixed(1)}, maxToErr=${maxToErr.toFixed(1)}, ` +
            `avgFromErr=${avgFromErr.toFixed(1)}, avgToErr=${avgToErr.toFixed(1)}, ` +
            `adjAvgFromErr=${avgAdjFromErr.toFixed(1)}, adjAvgToErr=${avgAdjToErr.toFixed(1)}, ` +
            `vpBuckets=domDom${domDomCount}/domVir${domVirtualCount}/virVir${virtualVirtualCount}, ` +
            `domBuckets=visVis${domVisibleVisibleCount}/visZero${domVisibleZeroCount}/zeroZero${domZeroZeroCount}/missing${domMissingFromCount + domMissingToCount}, ` +
            `confidence=${confidence}%(${confidenceFlag}), ` +
            `delta=improve${improvedEdges}/worse${worseEdges}/unchanged${unchangedEdges}, ` +
            `sample=${samples.join(' | ')}, endpointTruth=${endpointTruthSamples.join(' | ') || 'none'}, ctx=${contextId || 'none'}`);
    }

    mergeMemoryEdgesIntoFileData(
        canvasData: CanvasDataLike,
        memoryEdges: CanvasEdgeLike[],
        contextId?: string
    ): boolean {
        if (!Array.isArray(canvasData.edges)) return false;
        let changed = false;
        let addedCount = 0;
        let updatedCount = 0;

        const fileEdgeMap = new Map<string, CanvasEdgeLike>();
        for (const fileEdge of canvasData.edges) {
            if (fileEdge.id) fileEdgeMap.set(fileEdge.id, fileEdge);
        }

        for (const memEdge of memoryEdges) {
            if (!memEdge.id) continue;

            const fileEdge = fileEdgeMap.get(memEdge.id);
            const memSerialized = this.serializeEdge(memEdge);

            if (!fileEdge) {
                canvasData.edges.push(memSerialized as CanvasEdgeLike);
                changed = true;
                addedCount++;
            } else {
                // [修复B] 保护 fromSide/toSide 不被内存中可能异常的值覆盖。
                // arrange 算法只移动节点坐标，不改变边连接的方向(side)。
                // 在 viewport 变化（旋转/分屏）后，Canvas 引擎内存中的 side 可能被临时改错，
                // 若将其写入文件，会造成用户关闭再打开也无法消除的"数据层错连"。
                // 策略：对已有边只比较 fromNode/toNode，发现差异时也只更新 fromNode/toNode，
                // 保留文件中 fromSide/toSide 作为权威值，避免因内存临时状态污染持久化数据。
                const memFromNode = this.toStringId(memEdge.fromNode) || this.toStringId(getNodeIdFromEdgeEndpoint(memEdge.from));
                const memToNode = this.toStringId(memEdge.toNode) || this.toStringId(getNodeIdFromEdgeEndpoint(memEdge.to));
                const memFromSide = this.toStringId(memEdge.fromSide) || (typeof memEdge.from === 'object' ? (memEdge.from as any).side : undefined);
                const memToSide = this.toStringId(memEdge.toSide) || (typeof memEdge.to === 'object' ? (memEdge.to as any).side : undefined);

                const fileFromNode = this.toStringId(fileEdge.fromNode) || this.toStringId(getNodeIdFromEdgeEndpoint(fileEdge.from));
                const fileToNode = this.toStringId(fileEdge.toNode) || this.toStringId(getNodeIdFromEdgeEndpoint(fileEdge.to));
                const fileFromSide = this.toStringId(fileEdge.fromSide) || (typeof fileEdge.from === 'object' ? (fileEdge.from as any).side : undefined);
                const fileToSide = this.toStringId(fileEdge.toSide) || (typeof fileEdge.to === 'object' ? (fileEdge.to as any).side : undefined);

                // [修复B] 只在 fromNode/toNode 变化时更新（边的节点连接关系真的变了），Side 始终保留文件中的值
                const nodeChanged = memFromNode !== fileFromNode || memToNode !== fileToNode;
                // [诊断] 如果 Side 不一致，记录日志但不写入
                const sideChanged = memFromSide !== fileFromSide || memToSide !== fileToSide;
                if (sideChanged) {
                    log(`[Layout] MergeEdges(SideProtected): id=${memEdge.id}, ` +
                        `memSide=${memFromSide}/${memToSide}, fileSide=${fileFromSide}/${fileToSide}, ` +
                        `nodeChanged=${nodeChanged}, ctx=${contextId || 'none'}`);
                }

                if (nodeChanged) {
                    fileEdge.fromNode = memSerialized.fromNode as string;
                    fileEdge.toNode = memSerialized.toNode as string;
                    // [修复B] 保留文件中已有的 Side，不覆盖
                    // fileEdge.fromSide 和 fileEdge.toSide 保持不变
                    fileEdge.fromEnd = memSerialized.fromEnd;
                    fileEdge.toEnd = memSerialized.toEnd;
                    if (memSerialized.color) fileEdge.color = memSerialized.color as string;
                    if (memSerialized.label) fileEdge.label = memSerialized.label as string;
                    changed = true;
                    updatedCount++;
                }
            }
        }

        if (addedCount > 0 || updatedCount > 0) {
            log(`[Layout] MergeEdges: added=${addedCount}, updated=${updatedCount}, unchanged=${memoryEdges.length - addedCount - updatedCount}, memory=${memoryEdges.length}, file=${canvasData.edges.length}, ctx=${contextId || 'none'}`);
        }
        return changed;
    }

    /**
     * [修复A] 直接从 edge.bezier 数据构建 SVG path d 字符串并写入 pathEl。
     * 绕过 Canvas 引擎的渲染缓存，解决 edge.render() 更新 bezier 但不更新 SVG 的问题。
     * 
     * Canvas edge SVG 路径使用 canvas 坐标系（与节点 x/y 相同），
     * bezier.from/to/cp1/cp2 也是 canvas 坐标系，可以直接用于构建路径。
     * 
     * [修复A核心] edge.pathEl 在 Obsidian Canvas 中不是 edge 的直接属性，
     * 真实的 <path> 元素是 lineGroupEl（<g>）的子元素，需要通过 querySelector 查找。
     */
    forceApplySVGPathFromBezier(edges: CanvasEdgeLike[]): number {
        let updatedCount = 0;
        // [诊断] 首条边结构诊断（只记录一次）
        let diagLogged = false;

        for (const edge of edges) {
            const bezier = (edge as any).bezier;
            if (!bezier) continue;

            const from = bezier.from;
            const to = bezier.to;
            if (!from || !to) continue;

            // [修复A] 先尝试直接属性 pathEl，不存在则通过 lineGroupEl 查找子 <path>
            let pathEl: Element | null = (edge as any).pathEl || null;
            let interactiveEl: Element | null = (edge as any).interactiveEl || null;

            if (!pathEl) {
                const lineGroupEl = (edge as any).lineGroupEl as Element | null;
                if (lineGroupEl) {
                    // Obsidian Canvas 的 edge SVG 结构：
                    // <g class="canvas-edge-line-group">
                    //   <path class="canvas-display-path" .../>  ← 可见路径
                    //   <path class="canvas-interaction-path" .../>  ← 不可见的宽点击区域
                    // </g>
                    const allPaths = lineGroupEl.querySelectorAll('path');
                    if (allPaths.length >= 1) {
                        pathEl = allPaths[0] ?? null;
                    }
                    if (allPaths.length >= 2 && !interactiveEl) {
                        interactiveEl = allPaths[1] ?? null;
                    }

                    // [诊断] 记录首条边的实际结构和坐标空间
                    if (!diagLogged && edge.id) {
                        diagLogged = true;
                        const edgeKeys = Object.keys(edge).join(',');
                        const lgChildren = Array.from(lineGroupEl.children).map(c => `${c.tagName}.${c.className}`).join(';');
                        // [诊断] lineGroupEl 的 transform（决定坐标空间）
                        const lgTransformAttr = lineGroupEl.getAttribute('transform') || 'none-attr';
                        const lgStyleTransform = (lineGroupEl as any).style?.transform || 'none-style';
                        // [诊断] 实际 path d 值的前80字符
                        const actualD = pathEl ? (pathEl as Element).getAttribute('d')?.slice(0, 80) || 'no-d' : 'no-pathEl';
                        // [诊断] edge.path 的类型和方法
                        const edgePath = (edge as any).path;
                        const edgePathType = typeof edgePath;
                        const edgePathKeys = edgePath && typeof edgePath === 'object' ? Object.keys(edgePath).slice(0, 10).join(',') : 'n/a';
                        const edgePathHasUpdate = edgePath && typeof edgePath.update === 'function';
                        const edgePathHasRender = edgePath && typeof edgePath.render === 'function';
                        log(`[Layout] EdgeStructDiag: id=${edge.id}, ` +
                            `pathElDirect=${!!(edge as any).pathEl}, lineGroupChildren=[${lgChildren}], ` +
                            `lgTransformAttr=${lgTransformAttr}, lgStyleTransform=${lgStyleTransform.slice(0,40)}, ` +
                            `actualD=${actualD}, ` +
                            `edgePathType=${edgePathType}, edgePathKeys=[${edgePathKeys}], ` +
                            `edgePathHasUpdate=${edgePathHasUpdate}, edgePathHasRender=${edgePathHasRender}, ` +
                            `edgeKeys=[${edgeKeys.slice(0,120)}]`);
                        // [诊断] 如果 edge.path 有 render/update 方法，也调用一次看效果
                        if (edgePathHasUpdate) {
                            try { edgePath.update(); } catch { /* ignore */ }
                            log(`[Layout] EdgePathUpdate: called edge.path.update() for id=${edge.id}`);
                        } else if (edgePathHasRender) {
                            try { edgePath.render(); } catch { /* ignore */ }
                            log(`[Layout] EdgePathRender: called edge.path.render() for id=${edge.id}`);
                        }
                    }
                }
            }

            if (!pathEl || typeof (pathEl as any).setAttribute !== 'function') continue;

            // 控制点若无则退化为端点（直线）
            const cp1 = bezier.cp1 || from;
            const cp2 = bezier.cp2 || to;

            const d = `M${from.x.toFixed(2)},${from.y.toFixed(2)} C${cp1.x.toFixed(2)},${cp1.y.toFixed(2)} ${cp2.x.toFixed(2)},${cp2.y.toFixed(2)} ${to.x.toFixed(2)},${to.y.toFixed(2)}`;

            try {
                (pathEl as Element).setAttribute('d', d);
                // 同步更新可能存在的「点击区域」宽路径元素
                if (interactiveEl && typeof (interactiveEl as any).setAttribute === 'function') {
                    (interactiveEl as Element).setAttribute('d', d);
                }
                updatedCount++;
            } catch {
                // 忽略单条边的 SVG 更新失败
            }
        }
        return updatedCount;
    }

    private resolveEdgePathElement(edge: CanvasEdgeLike): Element | null {
        let pathEl: Element | null = (edge as any).pathEl || null;
        if (!pathEl) {
            const lineGroupEl = (edge as any).lineGroupEl as Element | null;
            if (lineGroupEl) {
                pathEl = lineGroupEl.querySelector('path') ?? null;
            }
        }
        return pathEl;
    }

    private getPathEndpointScreen(pathEl: Element | null, atStart: boolean): { x: number; y: number } | null {
        try {
            if (!(pathEl instanceof SVGPathElement)) return null;
            const total = pathEl.getTotalLength();
            const length = atStart ? 0 : Math.max(0, total);
            const point = pathEl.getPointAtLength(length);

            const svgParent = pathEl.parentElement;
            if (!svgParent) return null;

            const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            marker.setAttribute('cx', String(point.x));
            marker.setAttribute('cy', String(point.y));
            marker.setAttribute('r', '0.5');
            marker.setAttribute('fill', 'transparent');
            marker.setAttribute('data-cmb-debug', 'gap-marker');
            svgParent.appendChild(marker);

            const rect = marker.getBoundingClientRect();
            marker.remove();
            return {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
            };
        } catch {
            return null;
        }
    }

    private getAnchorPointForRect(rect: DOMRect, side: string): { x: number; y: number } {
        switch (side) {
            case 'top':
                return { x: (rect.left + rect.right) / 2, y: rect.top };
            case 'bottom':
                return { x: (rect.left + rect.right) / 2, y: rect.bottom };
            case 'left':
                return { x: rect.left, y: (rect.top + rect.bottom) / 2 };
            case 'right':
            default:
                return { x: rect.right, y: (rect.top + rect.bottom) / 2 };
        }
    }

    private calculateAnchorPoint(bbox: { minX: number; minY: number; maxX: number; maxY: number }, side: string): { x: number; y: number } {
        switch (side) {
            case 'top':
                return { x: (bbox.minX + bbox.maxX) / 2, y: bbox.minY };
            case 'bottom':
                return { x: (bbox.minX + bbox.maxX) / 2, y: bbox.maxY };
            case 'left':
                return { x: bbox.minX, y: (bbox.minY + bbox.maxY) / 2 };
            case 'right':
            default:
                return { x: bbox.maxX, y: (bbox.minY + bbox.maxY) / 2 };
        }
    }

    private serializeEdge(memEdge: CanvasEdgeLike): Record<string, unknown> {
        return {
            id: memEdge.id,
            fromNode: this.toStringId(memEdge.fromNode) || this.toStringId(getNodeIdFromEdgeEndpoint(memEdge.from)) || this.toStringId(memEdge.from),
            toNode: this.toStringId(memEdge.toNode) || this.toStringId(getNodeIdFromEdgeEndpoint(memEdge.to)) || this.toStringId(memEdge.to),
            fromSide: this.toStringId(memEdge.fromSide) || (isRecord(memEdge.from) ? this.toStringId(memEdge.from.side) : undefined),
            toSide: this.toStringId(memEdge.toSide) || (isRecord(memEdge.to) ? this.toStringId(memEdge.to.side) : undefined),
            fromEnd: memEdge.fromEnd,
            toEnd: memEdge.toEnd,
            color: memEdge.color,
            label: memEdge.label
        };
    }

    private getCanvasEdges(canvas: CanvasLike): CanvasEdgeLike[] {
        return getEdgesFromCanvas(canvas);
    }

    private toStringId(value: unknown): string | undefined {
        return typeof value === 'string' ? value : undefined;
    }

    /**
     * [已废弃] 清理节点异常的 computed top/left 偏移。
     * 
     * 该方法已不再需要：CSS 永久修复（.canvas-node { inset: auto !important; top: 0 !important; ... }）
     * 已彻底解决错连问题，anomalous=0 贯穿全程，边 err≤7.0px（正常 stub 范围）。
     * 
     * 保留方法签名以兼容现有调用点，但不执行任何操作。
     */
    cleanupAnomalousNodePositioning(
        canvas: CanvasLike,
        allNodes: Map<string, CanvasNodeLike>,
        contextId?: string,
        options: OffsetCleanupOptions = {}
    ): number {
        // CSS 永久修复已生效，无需 JS 动态修复
        // 返回 0 表示无异常节点需要修复
        return 0;
    }
}
