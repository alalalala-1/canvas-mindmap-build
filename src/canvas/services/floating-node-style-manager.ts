import { log } from '../../utils/logger';
import { CanvasLike } from '../types';

export class FloatingNodeStyleManager {
    private readonly FLOATING_CLASS = 'cmb-floating-node';
    private canvas: CanvasLike | null = null;

    setCanvas(canvas: CanvasLike): void {
        this.canvas = canvas;
    }

    // =========================================================================
    // 样式应用
    // =========================================================================

    /**
     * 应用浮动节点样式（红框）
     */
    applyFloatingStyle(nodeId: string): boolean {
        try {
            const nodeEl = this.findNodeElement(nodeId);
            if (!nodeEl) {
                log(`[Style] 找不到节点元素: ${nodeId}，将延迟重试`);
                setTimeout(() => this.applyFloatingStyleRetry(nodeId, 1), 300);
                setTimeout(() => this.applyFloatingStyleRetry(nodeId, 2), 1000);
                return false;
            }

            nodeEl.classList.add(this.FLOATING_CLASS);

            log(`[Style] 成功应用红框: ${nodeId}`);

            // 强制重绘
            void nodeEl.offsetHeight;

            return true;
        } catch (err) {
            log('[Style] 失败:', err);
            return false;
        }
    }

    /**
     * 延迟重试应用样式
     */
    private applyFloatingStyleRetry(nodeId: string, retryNum: number): void {
        const nodeEl = this.findNodeElement(nodeId);
        if (nodeEl) {
            log(`[Style] 应用红框 (重试 #${retryNum}): ${nodeId}`);
            this.applyFloatingStyle(nodeId);
        } else {
            // 降低找不到节点的日志级别或频率，避免日志爆炸
            // log(`[Style] 找不到节点元素 (重试 #${retryNum}): ${nodeId}`);
        }
    }

    // =========================================================================
    // 样式清除
    // =========================================================================

    /**
     * 清除浮动节点样式
     */
    clearFloatingStyle(nodeId: string): boolean {
        try {
            const nodeEl = this.findNodeElement(nodeId);
            if (!nodeEl) {
                log(`[Style] 清除红框时找不到节点元素: ${nodeId}，将延迟重试`);
                setTimeout(() => this.clearFloatingStyleRetry(nodeId, 1), 300);
                setTimeout(() => this.clearFloatingStyleRetry(nodeId, 2), 600);
                setTimeout(() => this.clearFloatingStyleRetry(nodeId, 3), 1000);
                return false;
            }

            log(`[Style] 清除红框: ${nodeId}, hasClass=${nodeEl.classList.contains(this.FLOATING_CLASS)}`);
            if (nodeEl.classList.contains(this.FLOATING_CLASS)) {
                nodeEl.classList.remove(this.FLOATING_CLASS);

                // 强制重绘
                void nodeEl.offsetHeight;
            }
            return true;
        } catch (err) {
            log('[Style] 清除失败:', err);
            return false;
        }
    }

    /**
     * 延迟重试清除样式
     */
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
     * 查找节点的 DOM 元素
     */
    private findNodeElement(nodeId: string): HTMLElement | null {
        const nodeEl = document.querySelector(`.canvas-node[data-node-id="${nodeId}"]`) as HTMLElement;
        if (nodeEl) {
            return nodeEl;
        }

        if (this.canvas?.nodes) {
            if (this.canvas.nodes instanceof Map) {
                const node = this.canvas.nodes.get(nodeId);
                if (node?.nodeEl) {
                    return node.nodeEl;
                }
            } else if (typeof this.canvas.nodes === 'object') {
                const node = (this.canvas.nodes as Record<string, any>)[nodeId];
                if (node?.nodeEl) {
                    return node.nodeEl;
                }
            }
        }

        if (this.canvas?.nodes) {
            const allNodeEls = document.querySelectorAll('.canvas-node');
            for (const el of Array.from(allNodeEls)) {
                const dataNodeId = el.getAttribute('data-node-id');
                if (dataNodeId === nodeId) {
                    return el as HTMLElement;
                }
                
                let nodes: any[];
                if (this.canvas.nodes instanceof Map) {
                    nodes = Array.from(this.canvas.nodes.values());
                } else {
                    nodes = Object.values(this.canvas.nodes);
                }
                
                for (const node of nodes) {
                    if (node.nodeEl === el || (node.nodeEl && el.contains(node.nodeEl))) {
                        if (node.id === nodeId) {
                            return el as HTMLElement;
                        }
                    }
                }
            }
        }

        return null;
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
