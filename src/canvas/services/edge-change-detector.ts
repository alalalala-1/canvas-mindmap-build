import { log } from '../../utils/logger';
import { CanvasEdgeLike, CanvasLike } from '../types';

export type NewEdgeCallback = (newEdges: CanvasEdgeLike[]) => void;

export interface DetectionOptions {
    interval?: number;
    maxChecks?: number;
    stableThreshold?: number;
}

export class EdgeChangeDetector {
    private edgeChangeInterval: number | null = null;
    private lastEdgeIds: Set<string> = new Set();
    private processedEdgeIds: Set<string> = new Set();
    private lastEdgeCount: number = 0;
    private onNewEdgesCallback: NewEdgeCallback | null = null;
    
    private lastEdgeSignature: string = '';
    private stableCount: number = 0;
    private stableThreshold: number = 2;
    private pendingNewEdges: Map<string, CanvasEdgeLike> = new Map();

    startDetection(
        canvas: CanvasLike,
        onNewEdges: NewEdgeCallback,
        options: DetectionOptions = {}
    ): void {
        this.stopDetection();

        const interval = options.interval || 500;
        const maxChecks = options.maxChecks || 120;
        this.stableThreshold = options.stableThreshold || 2;

        this.lastEdgeIds = this.getEdgeIds(canvas);
        this.processedEdgeIds = new Set(this.lastEdgeIds);
        this.lastEdgeCount = this.lastEdgeIds.size;
        this.onNewEdgesCallback = onNewEdges;
        this.lastEdgeSignature = this.computeEdgeSignature(canvas);
        this.stableCount = 0;
        this.pendingNewEdges.clear();

        let checkCount = 0;

        this.edgeChangeInterval = window.setInterval(() => {
            checkCount++;

            const currentSignature = this.computeEdgeSignature(canvas);
            
            if (currentSignature === this.lastEdgeSignature) {
                this.stableCount++;
                if (this.stableCount >= this.stableThreshold && this.pendingNewEdges.size > 0) {
                    const stableNewEdges = Array.from(this.pendingNewEdges.values());
                    this.pendingNewEdges.clear();
                    
                    if (this.onNewEdgesCallback) {
                        log(`[Detector] 边数据稳定，处理 ${stableNewEdges.length} 条新边`);
                        this.onNewEdgesCallback(stableNewEdges);
                    }
                }
            } else {
                this.stableCount = 0;
                this.lastEdgeSignature = currentSignature;
                
                const currentEdgeIds = this.getEdgeIds(canvas);
                const edges = this.getEdgesArray(canvas);

                for (const edge of edges) {
                    const edgeId = this.generateEdgeId(edge);
                    if (edgeId && !this.processedEdgeIds.has(edgeId)) {
                        this.pendingNewEdges.set(edgeId, edge);
                        this.processedEdgeIds.add(edgeId);
                        log(`[Detector] 发现新边(待稳定): ${edgeId}`);
                    }
                }

                this.lastEdgeIds = new Set(currentEdgeIds);
                this.lastEdgeCount = currentEdgeIds.size;
            }

            if (maxChecks > 0 && checkCount >= maxChecks) {
                this.stopDetection();
            }
        }, interval);
    }

    stopDetection(): void {
        if (this.edgeChangeInterval) {
            window.clearInterval(this.edgeChangeInterval);
            this.edgeChangeInterval = null;
        }
        this.pendingNewEdges.clear();
        this.stableCount = 0;
    }

    private computeEdgeSignature(canvas: CanvasLike): string {
        const edges = this.getEdgesArray(canvas);
        const signatures: string[] = [];
        
        for (const edge of edges) {
            const edgeId = this.generateEdgeId(edge);
            if (edgeId) {
                signatures.push(edgeId);
            }
        }
        
        signatures.sort();
        return signatures.join('|');
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
        const edges = this.getEdgesArray(canvas);

        for (const edge of edges) {
            const edgeId = this.generateEdgeId(edge);
            if (edgeId) {
                edgeIds.add(edgeId);
            }
        }

        return edgeIds;
    }

    private generateEdgeId(edge: CanvasEdgeLike): string {
        let fromId: string | null = null;
        let toId: string | null = null;
        
        if (typeof edge?.from === 'string') {
            fromId = edge.from;
        } else if (edge?.from?.node?.id) {
            fromId = edge.from.node.id;
        } else if (edge?.fromNode) {
            fromId = edge.fromNode;
        }
        
        if (typeof edge?.to === 'string') {
            toId = edge.to;
        } else if (edge?.to?.node?.id) {
            toId = edge.to.node.id;
        } else if (edge?.toNode) {
            toId = edge.toNode;
        }
        
        if (fromId && toId) {
            return `${fromId}->${toId}`;
        }
        return edge?.id || '';
    }

    forceCheck(canvas: CanvasLike): void {
        if (!this.onNewEdgesCallback) return;

        const edges = this.getEdgesArray(canvas);
        const newEdges: CanvasEdgeLike[] = [];

        for (const edge of edges) {
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

        this.lastEdgeIds = this.getEdgeIds(canvas);
        this.lastEdgeCount = this.lastEdgeIds.size;
    }

    isRunning(): boolean {
        return this.edgeChangeInterval !== null;
    }
}
