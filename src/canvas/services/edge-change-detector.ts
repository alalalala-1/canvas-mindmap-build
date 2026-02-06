import { info, error } from '../../utils/logger';
import { traceEnter, traceExit, traceStep } from '../../utils/function-tracer';

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
        traceEnter('EdgeChangeDetector', 'startDetection', { edgeCount: canvas?.edges?.size || canvas?.edges?.length || 0 });

        traceStep('EdgeChangeDetector', 'startDetection', '停止之前的检测');
        this.stopDetection();

        const interval = options.interval || 500;
        // 增加最大检查次数，或者设置为持续检测
        const maxChecks = options.maxChecks || 120; // 默认 60s (500ms * 120)

        traceStep('EdgeChangeDetector', 'startDetection', '初始化边集合');
        // 初始化边集合
        this.lastEdgeIds = this.getEdgeIds(canvas);
        this.processedEdgeIds = new Set(this.lastEdgeIds); // 初始边都视为已处理
        this.lastEdgeCount = this.lastEdgeIds.size;
        this.onNewEdgesCallback = onNewEdges;

        traceStep('EdgeChangeDetector', 'startDetection', '检测启动', { initialEdgeCount: this.lastEdgeCount, interval, maxChecks });
        info(`[EdgeChangeDetector] 启动检测，初始边数量: ${this.lastEdgeCount}`);

        let checkCount = 0;

        this.edgeChangeInterval = window.setInterval(() => {
            checkCount++;
            // 降低追踪日志频率
            if (checkCount % 10 === 0) {
                traceStep('EdgeChangeDetector', 'startDetection', `第 ${checkCount} 次检查`);
            }

            const currentEdgeIds = this.getEdgeIds(canvas);
            
            // 找出真正的新边：在 currentEdgeIds 中，但不在 processedEdgeIds 中
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
                    this.processedEdgeIds.add(edgeId); // 立即标记为已处理
                }
            }

            if (newEdges.length > 0 && this.onNewEdgesCallback) {
                info(`[EdgeChangeDetector] 检测到 ${newEdges.length} 条新边`);
                info(`[EdgeChangeDetector] 上次边数量: ${this.lastEdgeIds.size}, 当前边数量: ${currentEdgeIds.size}`);
                info(`[EdgeChangeDetector] 新边: ${newEdges.map((e: any) => this.generateEdgeId(e)).join(', ')}`);
                traceStep('EdgeChangeDetector', 'startDetection', '调用回调处理新边', { newEdges: newEdges.map((e: any) => this.generateEdgeId(e)) });
                this.onNewEdgesCallback(newEdges);
            }

            // 更新 lastEdgeIds
            this.lastEdgeIds = new Set(currentEdgeIds);
            this.lastEdgeCount = currentEdgeIds.size;

            // 只有当 maxChecks > 0 时才停止
            if (maxChecks > 0 && checkCount >= maxChecks) {
                info('[EdgeChangeDetector] 达到最大检查次数，停止检测');
                traceStep('EdgeChangeDetector', 'startDetection', '达到最大检查次数，停止检测');
                this.stopDetection();
            }
        }, interval);

        traceExit('EdgeChangeDetector', 'startDetection');
    }

    /**
     * 停止边变化检测
     */
    stopDetection(): void {
        traceEnter('EdgeChangeDetector', 'stopDetection', { hasInterval: !!this.edgeChangeInterval });

        if (this.edgeChangeInterval) {
            window.clearInterval(this.edgeChangeInterval);
            this.edgeChangeInterval = null;
            info('[EdgeChangeDetector] 已停止检测');
            traceStep('EdgeChangeDetector', 'stopDetection', '检测已停止');
        } else {
            traceStep('EdgeChangeDetector', 'stopDetection', '没有运行的检测');
        }

        traceExit('EdgeChangeDetector', 'stopDetection');
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
        const fromId = edge?.from?.node?.id || edge?.fromNode;
        const toId = edge?.to?.node?.id || edge?.toNode;
        if (fromId && toId) {
            return `${fromId}->${toId}`;
        }
        return '';
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
            info(`[EdgeChangeDetector] 手动检测到 ${newEdges.length} 条新边`);
            this.onNewEdgesCallback(newEdges);
        }

        this.lastEdgeIds = this.getEdgeIds(canvas);
        this.lastEdgeCount = this.lastEdgeIds.size;
    }
}
