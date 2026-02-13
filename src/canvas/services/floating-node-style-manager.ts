import { log } from '../../utils/logger';
import { CONSTANTS } from '../../constants';
import { CanvasLike, CanvasNodeLike } from '../types';

export class FloatingNodeStyleManager {
    private readonly FLOATING_CLASS = 'cmb-floating-node';
    private canvas: CanvasLike | null = null;
    private pendingTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();
    private elementCache: Map<string, HTMLElement> = new Map();

    setCanvas(canvas: CanvasLike): void {
        this.canvas = canvas;
        this.elementCache.clear();
    }

    cleanup(): void {
        for (const timeoutId of this.pendingTimeouts) {
            clearTimeout(timeoutId);
        }
        this.pendingTimeouts.clear();
        this.elementCache.clear();
    }

    private scheduleRetry(callback: () => void, delay: number): void {
        const timeoutId = setTimeout(() => {
            this.pendingTimeouts.delete(timeoutId);
            callback();
        }, delay);
        this.pendingTimeouts.add(timeoutId);
    }

    applyFloatingStyle(nodeId: string): boolean {
        try {
            const nodeEl = this.findNodeElement(nodeId);
            if (!nodeEl) {
                log(`[Style] 找不到节点元素: ${nodeId}，将延迟重试`);
                this.scheduleRetry(() => this.applyFloatingStyleRetry(nodeId, 1), CONSTANTS.TIMING.RETRY_DELAY_SHORT);
                this.scheduleRetry(() => this.applyFloatingStyleRetry(nodeId, 2), CONSTANTS.TIMING.RETRY_DELAY_LONG);
                return false;
            }

            nodeEl.classList.add(this.FLOATING_CLASS);

            log(`[Style] 成功应用红框: ${nodeId}`);

            void nodeEl.offsetHeight;

            return true;
        } catch (err) {
            log('[Style] 失败:', err);
            return false;
        }
    }

    private applyFloatingStyleRetry(nodeId: string, retryNum: number): void {
        const nodeEl = this.findNodeElement(nodeId);
        if (nodeEl) {
            log(`[Style] 应用红框 (重试 #${retryNum}): ${nodeId}`);
            this.applyFloatingStyle(nodeId);
        }
    }

    clearFloatingStyle(nodeId: string): boolean {
        try {
            const nodeEl = this.findNodeElement(nodeId);
            if (!nodeEl) {
                log(`[Style] 清除红框时找不到节点元素: ${nodeId}，将延迟重试`);
                this.scheduleRetry(() => this.clearFloatingStyleRetry(nodeId, 1), CONSTANTS.TIMING.RETRY_DELAY_SHORT);
                this.scheduleRetry(() => this.clearFloatingStyleRetry(nodeId, 2), CONSTANTS.TIMING.RETRY_DELAY_MEDIUM);
                this.scheduleRetry(() => this.clearFloatingStyleRetry(nodeId, 3), CONSTANTS.TIMING.RETRY_DELAY_LONG);
                return false;
            }

            log(`[Style] 清除红框: ${nodeId}, hasClass=${nodeEl.classList.contains(this.FLOATING_CLASS)}`);
            if (nodeEl.classList.contains(this.FLOATING_CLASS)) {
                nodeEl.classList.remove(this.FLOATING_CLASS);

                void nodeEl.offsetHeight;
            }
            return true;
        } catch (err) {
            log('[Style] 清除失败:', err);
            return false;
        }
    }

    private clearFloatingStyleRetry(nodeId: string, retryNum: number): void {
        const nodeEl = this.findNodeElement(nodeId);
        if (nodeEl) {
            log(`[Style] 清除红框 (重试 #${retryNum}): ${nodeId}`);
            this.clearFloatingStyle(nodeId);
        }
    }

    // =========================================================================
    // 批量操作
    // =========================================================================

    /**
     * 应用所有浮动节点的样式
     */
    applyAllFloatingStyles(nodeIds: string[]): void {
        for (const nodeId of nodeIds) {
            this.applyFloatingStyle(nodeId);
        }
    }

    /**
     * 清除所有浮动节点的样式
     */
    clearAllFloatingStyles(nodeIds: string[]): void {
        for (const nodeId of nodeIds) {
            this.clearFloatingStyle(nodeId);
        }
    }

    // =========================================================================
    // DOM 操作
    // =========================================================================

    /**
     * 查找节点的 DOM 元素（带缓存）
     */
    private findNodeElement(nodeId: string): HTMLElement | null {
        const cached = this.elementCache.get(nodeId);
        if (cached && document.contains(cached)) {
            return cached;
        }

        let nodeEl: HTMLElement | null = null;

        if (this.canvas?.nodes) {
            if (this.canvas.nodes instanceof Map) {
                const node = this.canvas.nodes.get(nodeId);
                nodeEl = node?.nodeEl || null;
            } else if (typeof this.canvas.nodes === 'object') {
                const node = (this.canvas.nodes as Record<string, CanvasNodeLike>)[nodeId];
                nodeEl = node?.nodeEl || null;
            }
        }

        if (!nodeEl) {
            nodeEl = document.querySelector(`.canvas-node[data-node-id="${nodeId}"]`) as HTMLElement;
        }

        if (nodeEl) {
            this.elementCache.set(nodeId, nodeEl);
        }

        return nodeEl;
    }

    /**
     * 检查节点是否有浮动样式
     */
    hasFloatingStyle(nodeId: string): boolean {
        const nodeEl = this.findNodeElement(nodeId);
        if (!nodeEl) return false;
        return nodeEl.classList.contains(this.FLOATING_CLASS);
    }
}
