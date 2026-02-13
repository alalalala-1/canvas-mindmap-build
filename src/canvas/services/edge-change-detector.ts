import { log } from '../../utils/logger';
import { CanvasEdgeLike, CanvasLike } from '../types';
import { getEdgeFromNodeId, getEdgeToNodeId } from '../../utils/canvas-utils';

export type NewEdgeCallback = (newEdges: CanvasEdgeLike[]) => void;

export interface DetectionOptions {
    interval?: number;
    maxChecks?: number;
    continuous?: boolean;
}

export class EdgeChangeDetector {
    private edgeChangeInterval: number | null = null;
    private processedEdgeIds: Set<string> = new Set();
    private onNewEdgesCallback: NewEdgeCallback | null = null;

    startDetection(
        canvas: CanvasLike,
        onNewEdges: NewEdgeCallback,
        options: DetectionOptions = {}
    ): void {
        this.stopDetection();

        const interval = options.interval ?? 500;
        const maxChecks = options.maxChecks ?? 60;
        const continuous = options.continuous === true;

        this.processedEdgeIds = this.getEdgeIds(canvas);
        this.onNewEdgesCallback = onNewEdges;

        let checkCount = 0;
        let stableCount = 0;

        this.edgeChangeInterval = window.setInterval(() => {
            checkCount++;

            const currentEdgeIds = this.getEdgeIds(canvas);
            const newEdges: CanvasEdgeLike[] = [];

            for (const edge of this.getEdgesArray(canvas)) {
                const edgeId = this.generateEdgeId(edge);
                if (edgeId && !this.processedEdgeIds.has(edgeId)) {
                    newEdges.push(edge);
                    this.processedEdgeIds.add(edgeId);
                }
            }

            if (newEdges.length > 0) {
                log(`[Detector] 发现 ${newEdges.length} 条新边`);
                stableCount = 0;
                if (this.onNewEdgesCallback) {
                    this.onNewEdgesCallback(newEdges);
                }
            } else if (!continuous && currentEdgeIds.size === this.processedEdgeIds.size) {
                stableCount++;
                if (stableCount >= 3) {
                    log(`[Detector] 边数据稳定，停止检测`);
                    this.stopDetection();
                    return;
                }
            }

            if (!continuous && maxChecks > 0 && checkCount >= maxChecks) {
                log(`[Detector] 达到最大检测次数，停止检测`);
                this.stopDetection();
            }
        }, interval);
    }

    stopDetection(): void {
        if (this.edgeChangeInterval) {
            window.clearInterval(this.edgeChangeInterval);
            this.edgeChangeInterval = null;
        }
    }

    forceCheck(canvas: CanvasLike): void {
        if (!this.onNewEdgesCallback) return;

        const newEdges: CanvasEdgeLike[] = [];
        for (const edge of this.getEdgesArray(canvas)) {
            const edgeId = this.generateEdgeId(edge);
            if (edgeId && !this.processedEdgeIds.has(edgeId)) {
                newEdges.push(edge);
                this.processedEdgeIds.add(edgeId);
            }
        }

        if (newEdges.length > 0) {
            log(`[Detector] 手动检测: ${newEdges.length} 条新边`);
            this.onNewEdgesCallback(newEdges);
        }
    }

    isRunning(): boolean {
        return this.edgeChangeInterval !== null;
    }

    private getEdgesArray(canvas: CanvasLike): CanvasEdgeLike[] {
        if (!canvas?.edges) return [];
        
        if (canvas.edges instanceof Map) {
            return Array.from(canvas.edges.values());
        }
        
        if (Array.isArray(canvas.edges)) {
            return canvas.edges;
        }
        
        return [];
    }

    private getEdgeIds(canvas: CanvasLike): Set<string> {
        const edgeIds = new Set<string>();
        for (const edge of this.getEdgesArray(canvas)) {
            const edgeId = this.generateEdgeId(edge);
            if (edgeId) edgeIds.add(edgeId);
        }
        return edgeIds;
    }

    private generateEdgeId(edge: CanvasEdgeLike): string {
        const fromId = getEdgeFromNodeId(edge);
        const toId = getEdgeToNodeId(edge);
        if (fromId && toId) {
            return `${fromId}->${toId}`;
        }
        return edge?.id || '';
    }
}
