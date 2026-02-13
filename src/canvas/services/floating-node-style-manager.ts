import { log } from '../../utils/logger';
import { CONSTANTS } from '../../constants';
import { CanvasLike, CanvasNodeLike } from '../types';

export class FloatingNodeStyleManager {
    private readonly FLOATING_CLASS = 'cmb-floating-node';
    private canvas: CanvasLike | null = null;
    private pendingTimeouts: Map<string, Set<ReturnType<typeof setTimeout>>> = new Map();
    private elementCache: Map<string, HTMLElement> = new Map();

    setCanvas(canvas: CanvasLike): void {
        this.canvas = canvas;
        this.elementCache.clear();
    }

    cleanup(): void {
        for (const timeoutSet of this.pendingTimeouts.values()) {
            for (const timeoutId of timeoutSet) {
                clearTimeout(timeoutId);
            }
        }
        this.pendingTimeouts.clear();
        this.elementCache.clear();
    }

    private scheduleRetry(nodeId: string, callback: () => void, delay: number): void {
        const timeoutId = setTimeout(() => {
            const timeoutSet = this.pendingTimeouts.get(nodeId);
            if (timeoutSet) {
                timeoutSet.delete(timeoutId);
                if (timeoutSet.size === 0) {
                    this.pendingTimeouts.delete(nodeId);
                }
            }
            callback();
        }, delay);
        let timeoutSet = this.pendingTimeouts.get(nodeId);
        if (!timeoutSet) {
            timeoutSet = new Set();
            this.pendingTimeouts.set(nodeId, timeoutSet);
        }
        timeoutSet.add(timeoutId);
    }

    private clearPendingRetries(nodeId: string): void {
        const timeoutSet = this.pendingTimeouts.get(nodeId);
        if (!timeoutSet) return;
        for (const timeoutId of timeoutSet) {
            clearTimeout(timeoutId);
        }
        this.pendingTimeouts.delete(nodeId);
    }

    applyFloatingStyle(nodeId: string): boolean {
        try {
            this.clearPendingRetries(nodeId);
            const nodeEl = this.findNodeElement(nodeId);
            if (!nodeEl) {
                log(`[Style] 找不到节点元素: ${nodeId}，将延迟重试`);
                this.scheduleRetry(nodeId, () => this.applyFloatingStyleRetry(nodeId, 1), CONSTANTS.TIMING.RETRY_DELAY_SHORT);
                this.scheduleRetry(nodeId, () => this.applyFloatingStyleRetry(nodeId, 2), CONSTANTS.TIMING.RETRY_DELAY_LONG);
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
            this.clearPendingRetries(nodeId);
            const cleared = this.removeFloatingClass(nodeId);
            if (!cleared) {
                log(`[Style] 清除红框时找不到节点元素: ${nodeId}，将延迟重试`);
                let retryIndex = 1;
                for (const delay of CONSTANTS.BUTTON_CHECK_INTERVALS) {
                    this.scheduleRetry(nodeId, () => this.clearFloatingStyleRetry(nodeId, retryIndex), delay);
                    retryIndex += 1;
                }
                return false;
            }
            return true;
        } catch (err) {
            log('[Style] 清除失败:', err);
            return false;
        }
    }

    private clearFloatingStyleRetry(nodeId: string, retryNum: number): void {
        const cleared = this.removeFloatingClass(nodeId);
        if (cleared) {
            log(`[Style] 清除红框 (重试 #${retryNum}): ${nodeId}`);
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
                const node = this.canvas.nodes[nodeId];
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

    private removeFloatingClass(nodeId: string): boolean {
        let cleared = false;
        const nodeEl = this.findNodeElement(nodeId);
        if (nodeEl) {
            const hasClass = nodeEl.classList.contains(this.FLOATING_CLASS);
            log(`[Style] 清除红框: ${nodeId}, hasClass=${hasClass}`);
            if (hasClass) {
                nodeEl.classList.remove(this.FLOATING_CLASS);
                void nodeEl.offsetHeight;
                cleared = true;
            }
        }
        const nodes = document.querySelectorAll(`.canvas-node[data-node-id="${nodeId}"]`);
        if (nodes.length > 1) {
            nodes.forEach((node) => {
                if (node.classList.contains(this.FLOATING_CLASS)) {
                    node.classList.remove(this.FLOATING_CLASS);
                    cleared = true;
                }
            });
        }
        return cleared;
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
