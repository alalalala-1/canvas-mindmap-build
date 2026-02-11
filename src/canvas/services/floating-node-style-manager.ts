import { log } from '../../utils/logger';

/**
 * 浮动节点视觉样式管理器
 * 负责浮动节点的视觉呈现（红框样式）
 * 单一职责：视觉样式，不涉及状态管理
 */
export class FloatingNodeStyleManager {
    private readonly FLOATING_CLASS = 'cmb-floating-node';
    private canvas: any = null;

    /**
     * 设置当前 Canvas 对象（用于 DOM 元素查找）
     */
    setCanvas(canvas: any): void {
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

            nodeEl.style.setProperty('border', '4px solid #ff4444', 'important');
            nodeEl.style.setProperty('border-radius', '8px', 'important');
            nodeEl.style.setProperty('box-shadow', '0 0 15px rgba(255, 68, 68, 0.4)', 'important');
            nodeEl.style.setProperty('outline', '0px solid transparent', 'important');

            log(`[Style] 成功应用红框: ${nodeId}`);

            // 强制重绘
            void nodeEl.offsetHeight;
            
            // 额外的一步：确保子元素不会覆盖边框
            const contentEl = nodeEl.querySelector('.canvas-node-content') as HTMLElement;
            if (contentEl) {
                contentEl.style.setProperty('border-radius', '4px', 'important');
            }
            
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
                
                nodeEl.style.removeProperty('border');
                nodeEl.style.removeProperty('border-radius');
                nodeEl.style.removeProperty('box-shadow');
                nodeEl.style.removeProperty('outline');
                
                const contentEl = nodeEl.querySelector('.canvas-node-content') as HTMLElement;
                if (contentEl) {
                    contentEl.style.removeProperty('border-radius');
                }

                // 强制重绘
                void nodeEl.offsetHeight;
            } else {
                // 即使没有类名，也检查并清除可能的内联样式
                const border = nodeEl.style.getPropertyValue('border');
                if (border && border.includes('#ff4444')) {
                    log(`[Style] 强制清除残留内联样式: ${nodeId}`);
                    nodeEl.style.removeProperty('border');
                    nodeEl.style.removeProperty('border-radius');
                    nodeEl.style.removeProperty('box-shadow');
                    nodeEl.style.removeProperty('outline');
                }
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
        // 方法1: 使用 data-node-id 属性选择器
        const nodeEl = document.querySelector(`.canvas-node[data-node-id="${nodeId}"]`) as HTMLElement;
        if (nodeEl) {
            return nodeEl;
        }

        // 方法2: 通过 canvas 对象查找（如果已设置）
        if (this.canvas?.nodes) {
            const node = this.canvas.nodes.get(nodeId);
            if (node?.nodeEl) {
                return node.nodeEl as HTMLElement;
            }
        }

        // 方法3: 遍历所有 canvas-node 元素，通过 canvas 对象匹配
        if (this.canvas?.nodes) {
            const allNodeEls = document.querySelectorAll('.canvas-node');
            for (const el of Array.from(allNodeEls)) {
                const dataNodeId = el.getAttribute('data-node-id');
                if (dataNodeId === nodeId) {
                    return el as HTMLElement;
                }
                // 尝试通过 canvas.nodes 匹配
                const nodes = Array.from(this.canvas.nodes.values()) as any[];
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
