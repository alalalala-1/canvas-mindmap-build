import { log } from '../../utils/logger';
import { CONSTANTS } from '../../constants';
import { CanvasLike } from '../types';

export class FloatingNodeStyleManager {
    private readonly FLOATING_CLASS = 'cmb-floating-node';
    private canvas: CanvasLike | null = null;
    private pendingTimeouts: Map<string, Set<ReturnType<typeof setTimeout>>> = new Map();
    private elementCache: Map<string, HTMLElement> = new Map();
    private pendingApplyNodeIds: Set<string> = new Set();
    private pendingClearNodeIds: Set<string> = new Set();

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
        this.pendingApplyNodeIds.clear();
        this.pendingClearNodeIds.clear();
    }

    notifyNodeMountedVisible(nodeId: string): void {
        if (!nodeId) return;

        if (this.pendingApplyNodeIds.delete(nodeId)) {
            log(`[Style] 节点已挂载，恢复应用红框: ${nodeId}`);
            this.applyFloatingStyle(nodeId);
            return;
        }

        if (this.pendingClearNodeIds.delete(nodeId)) {
            log(`[Style] 节点已挂载，恢复清除红框: ${nodeId}`);
            this.clearFloatingStyle(nodeId);
        }
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
                this.pendingApplyNodeIds.add(nodeId);
                this.pendingClearNodeIds.delete(nodeId);
                log(`[Style] 找不到节点元素: ${nodeId}，进入等待挂载队列`);
                this.scheduleRetry(nodeId, () => this.applyFloatingStyleRetry(nodeId, 1), CONSTANTS.TIMING.RETRY_DELAY_SHORT);
                return false;
            }

            this.pendingApplyNodeIds.delete(nodeId);

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
        } else {
            this.pendingApplyNodeIds.add(nodeId);
            log(`[Style] 应用红框重试 #${retryNum}: ${nodeId}, 节点元素仍未挂载，等待可见`);
        }
    }

    clearFloatingStyle(nodeId: string, options?: { retryOnMissing?: boolean }): boolean {
        try {
            const retryOnMissing = options?.retryOnMissing !== false;
            this.clearPendingRetries(nodeId);
            const cleared = this.removeFloatingClass(nodeId);
            if (!cleared) {
                this.pendingApplyNodeIds.delete(nodeId);
                if (!retryOnMissing) {
                    this.pendingClearNodeIds.delete(nodeId);
                    this.elementCache.delete(nodeId);
                    log(`[Style] 清除红框时找不到节点元素: ${nodeId}，跳过等待挂载队列`);
                    return false;
                }
                this.pendingClearNodeIds.add(nodeId);
                log(`[Style] 清除红框时找不到节点元素: ${nodeId}，进入等待挂载队列`);
                this.scheduleRetry(nodeId, () => this.clearFloatingStyleRetry(nodeId, 1), CONSTANTS.TIMING.RETRY_DELAY_SHORT);
                return false;
            }
            this.pendingClearNodeIds.delete(nodeId);
            return true;
        } catch (err) {
            log('[Style] 清除失败:', err);
            return false;
        }
    }

    private clearFloatingStyleRetry(nodeId: string, retryNum: number): void {
        // 先检查当前状态，避免无效的 DOM 操作干扰用户交互
        const nodeEl = this.findNodeElement(nodeId);
        if (nodeEl) {
            const hasClass = nodeEl.classList.contains(this.FLOATING_CLASS);
            log(`[Style] 清除红框重试 #${retryNum}: ${nodeId}, hasClass=${hasClass}`);
            
            if (!hasClass) {
                // 样式已清除，取消后续所有重试，避免干扰用户连线操作
                this.clearPendingRetries(nodeId);
                log(`[Style] 样式已清除，取消后续重试: ${nodeId}`);
                return;
            }
            
            // 只有确实有样式时才执行清除
            nodeEl.classList.remove(this.FLOATING_CLASS);
            void nodeEl.offsetHeight;
            log(`[Style] 清除红框 (重试 #${retryNum}): ${nodeId}`);
        } else {
            this.pendingClearNodeIds.add(nodeId);
            log(`[Style] 清除红框重试 #${retryNum}: ${nodeId}, 节点元素未找到，等待可见`);
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
        const nodeEl = this.findNodeElement(nodeId);
        if (nodeEl) {
            const hasClass = nodeEl.classList.contains(this.FLOATING_CLASS);
            log(`[Style] 清除红框: ${nodeId}, hasClass=${hasClass}`);
            if (hasClass) {
                nodeEl.classList.remove(this.FLOATING_CLASS);
                void nodeEl.offsetHeight;
            }
            // 无论 hasClass 是 true 还是 false，只要找到节点元素就返回 true
            // hasClass=false 表示样式已清除，不需要重试
            return true;
        }
        
        // 节点元素未找到，检查是否有重复元素需要清理
        const nodes = document.querySelectorAll(`.canvas-node[data-node-id="${nodeId}"]`);
        if (nodes.length > 0) {
            let cleared = false;
            nodes.forEach((node) => {
                if (node.classList.contains(this.FLOATING_CLASS)) {
                    node.classList.remove(this.FLOATING_CLASS);
                    cleared = true;
                }
            });
            log(`[Style] 清除红框(备用查找): ${nodeId}, 找到 ${nodes.length} 个元素, cleared=${cleared}`);
            // 找到元素就返回 true，避免不必要的重试
            return true;
        }
        
        // 真正找不到节点元素，返回 false 触发重试
        return false;
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
