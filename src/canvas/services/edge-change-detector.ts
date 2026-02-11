import { log } from '../../utils/logger';

/**
 * 边变化检测器
 * 负责检测 Canvas 中边的添加和删除
 */
export class EdgeChangeDetector {
    private edgeChangeInterval: number | null = null;
    private lastEdgeIds: Set<string> = new Set();
    private processedEdgeIds: Set<string> = new Set(); // 记录在此次会话中已处理过的新边
    private lastEdgeCount: number = 0;
    private onNewEdgesCallback: ((newEdges: any[]) => void) | null = null;

    /**
     * 启动边变化检测
     */
    startDetection(
        canvas: any,
        onNewEdges: (newEdges: any[]) => void,
        options: { interval?: number; maxChecks?: number } = {}
    ): void {
        this.stopDetection();

        const interval = options.interval || 500;
        const maxChecks = options.maxChecks || 120;

        this.lastEdgeIds = this.getEdgeIds(canvas);
        this.processedEdgeIds = new Set(this.lastEdgeIds);
        this.lastEdgeCount = this.lastEdgeIds.size;
        this.onNewEdgesCallback = onNewEdges;

        let checkCount = 0;

        this.edgeChangeInterval = window.setInterval(() => {
            checkCount++;

            const currentEdgeIds = this.getEdgeIds(canvas);
            
            const newEdges: any[] = [];
            const edges = canvas.edges instanceof Map
                ? Array.from(canvas.edges.values())
                : Array.isArray(canvas.edges)
                    ? canvas.edges
                    : [];

            for (const edge of edges) {
                const edgeId = this.generateEdgeId(edge);
                if (edgeId && !this.processedEdgeIds.has(edgeId)) {
                    newEdges.push(edge);
                    this.processedEdgeIds.add(edgeId);
                }
            }

            if (newEdges.length > 0 && this.onNewEdgesCallback) {
                for (const edge of newEdges) {
                    const fromId = edge?.from?.node?.id || edge?.fromNode || (typeof edge?.from === 'string' ? edge.from : null);
                    const toId = edge?.to?.node?.id || edge?.toNode || (typeof edge?.to === 'string' ? edge.to : null);
                    log(`[Detector] 轮询发现新边: ${edge.id || 'no-id'} (${fromId} -> ${toId})`);
                }
                this.onNewEdgesCallback(newEdges);
            }

            this.lastEdgeIds = new Set(currentEdgeIds);
            this.lastEdgeCount = currentEdgeIds.size;

            if (maxChecks > 0 && checkCount >= maxChecks) {
                this.stopDetection();
            }
        }, interval);
    }

    /**
     * 停止边变化检测
     */
    stopDetection(): void {
        if (this.edgeChangeInterval) {
            window.clearInterval(this.edgeChangeInterval);
            this.edgeChangeInterval = null;
        }
    }

    /**
     * 获取当前所有边的 ID 集合
     */
    private getEdgeIds(canvas: any): Set<string> {
        const edgeIds = new Set<string>();
        if (!canvas?.edges) return edgeIds;

        const edges = canvas.edges instanceof Map
            ? Array.from(canvas.edges.values())
            : Array.isArray(canvas.edges)
                ? canvas.edges
                : [];

        for (const edge of edges) {
            const edgeId = this.generateEdgeId(edge);
            if (edgeId) {
                edgeIds.add(edgeId);
            }
        }

        return edgeIds;
    }

    /**
     * 生成边的唯一 ID
     */
    private generateEdgeId(edge: any): string {
        const fromId = edge?.from?.node?.id || edge?.fromNode || (typeof edge?.from === 'string' ? edge.from : null);
        const toId = edge?.to?.node?.id || edge?.toNode || (typeof edge?.to === 'string' ? edge.to : null);
        if (fromId && toId) {
            return `${fromId}->${toId}`;
        }
        return edge.id || '';
    }

    /**
     * 找出新添加的边
     */
    private findNewEdges(canvas: any, lastEdgeIds: Set<string>): any[] {
        if (!canvas?.edges) return [];

        const edges = canvas.edges instanceof Map
            ? Array.from(canvas.edges.values())
            : Array.isArray(canvas.edges)
                ? canvas.edges
                : [];

        const newEdges: any[] = [];

        for (const edge of edges) {
            const edgeId = this.generateEdgeId(edge);
            if (edgeId && !lastEdgeIds.has(edgeId)) {
                newEdges.push(edge);
            }
        }

        return newEdges;
    }

    /**
     * 手动触发一次检测
     */
    forceCheck(canvas: any): void {
        if (!this.onNewEdgesCallback) return;

        const newEdges = this.findNewEdges(canvas, this.lastEdgeIds);
        if (newEdges.length > 0) {
            log(`[Detector] 手动: ${newEdges.length}`);
            this.onNewEdgesCallback(newEdges);
        }

        this.lastEdgeIds = this.getEdgeIds(canvas);
        this.lastEdgeCount = this.lastEdgeIds.size;
    }
}
