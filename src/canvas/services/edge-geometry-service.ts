import {
    CanvasDataLike,
    CanvasEdgeLike,
    CanvasLike,
    CanvasNodeLike
} from '../types';
import { log } from '../../utils/logger';
import { getEdgesFromCanvas, getNodeIdFromEdgeEndpoint, isRecord } from '../../utils/canvas-utils';

export interface EdgeGeomDiagnostics {
    edgeErrors: Map<string, { fromErr: number; toErr: number }>;
    timestamp: number;
}

export class EdgeGeometryService {
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
            const pathEl = (edge as any).pathEl;
            if (!pathEl) return 'no-pathEl';
            return pathEl.getAttribute('d') || 'no-d';
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

        await new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
                window.setTimeout(() => resolve(), 50);
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
                const memFromNode = this.toStringId(memEdge.fromNode) || this.toStringId(getNodeIdFromEdgeEndpoint(memEdge.from));
                const memToNode = this.toStringId(memEdge.toNode) || this.toStringId(getNodeIdFromEdgeEndpoint(memEdge.to));
                const memFromSide = this.toStringId(memEdge.fromSide) || (typeof memEdge.from === 'object' ? (memEdge.from as any).side : undefined);
                const memToSide = this.toStringId(memEdge.toSide) || (typeof memEdge.to === 'object' ? (memEdge.to as any).side : undefined);

                const fileFromNode = this.toStringId(fileEdge.fromNode) || this.toStringId(getNodeIdFromEdgeEndpoint(fileEdge.from));
                const fileToNode = this.toStringId(fileEdge.toNode) || this.toStringId(getNodeIdFromEdgeEndpoint(fileEdge.to));
                const fileFromSide = this.toStringId(fileEdge.fromSide) || (typeof fileEdge.from === 'object' ? (fileEdge.from as any).side : undefined);
                const fileToSide = this.toStringId(fileEdge.toSide) || (typeof fileEdge.to === 'object' ? (fileEdge.to as any).side : undefined);

                if (memFromNode !== fileFromNode || memToNode !== fileToNode ||
                    memFromSide !== fileFromSide || memToSide !== fileToSide) {
                    fileEdge.fromNode = memSerialized.fromNode as string;
                    fileEdge.toNode = memSerialized.toNode as string;
                    fileEdge.fromSide = memSerialized.fromSide as string;
                    fileEdge.toSide = memSerialized.toSide as string;
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
}
