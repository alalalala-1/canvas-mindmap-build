import { info, warn, error, debug } from '../../utils/logger';

/**
 * 浮动节点视觉样式管理器
 * 负责浮动节点的视觉呈现（红框样式）
 * 单一职责：视觉样式，不涉及状态管理
 */
export class FloatingNodeStyleManager {
    private readonly FLOATING_CLASS = 'cmb-floating-node';

    // =========================================================================
    // 样式应用
    // =========================================================================

    /**
     * 应用浮动节点样式（红框）
     */
    applyFloatingStyle(nodeId: string): boolean {
        try {
            info(`[FloatingNodeStyleManager] 为节点 ${nodeId} 应用浮动样式`);

            const nodeEl = this.findNodeElement(nodeId);
            if (!nodeEl) {
                warn(`[FloatingNodeStyleManager] 未找到节点 ${nodeId} 的 DOM 元素，可能是 Obsidian 正在重绘，准备重试...`);
                // 延迟重试
                setTimeout(() => this.applyFloatingStyleRetry(nodeId, 1), 300);
                setTimeout(() => this.applyFloatingStyleRetry(nodeId, 2), 1000);
                return false;
            }

            // 应用样式类
            nodeEl.classList.add(this.FLOATING_CLASS);

            // 内联样式兜底，确保在主题或更高优先级规则下仍可见
            nodeEl.style.setProperty('border', '4px solid #ff4444', 'important');
            nodeEl.style.setProperty('border-radius', '8px', 'important');
            nodeEl.style.setProperty('box-shadow', '0 0 15px rgba(255, 68, 68, 0.4)', 'important');
            nodeEl.style.setProperty('outline', '0px solid transparent', 'important');

            // 强制重绘
            void nodeEl.offsetHeight;

            info(`[FloatingNodeStyleManager] 已为节点 ${nodeId} 应用浮动样式类`);
            return true;
        } catch (err) {
            error('[FloatingNodeStyleManager] 应用浮动样式失败:', err);
            return false;
        }
    }

    /**
     * 延迟重试应用样式
     */
    private applyFloatingStyleRetry(nodeId: string, retryNum: number): void {
        const nodeEl = this.findNodeElement(nodeId);
        if (nodeEl) {
            if (!nodeEl.classList.contains(this.FLOATING_CLASS)) {
                nodeEl.classList.add(this.FLOATING_CLASS);
                info(`[FloatingNodeStyleManager] 已为节点 ${nodeId} 应用浮动样式类（重试 #${retryNum}）`);
            }
        } else {
            debug(`[FloatingNodeStyleManager] 重试 #${retryNum} 仍未找到节点 ${nodeId}`);
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
                warn(`[FloatingNodeStyleManager] 未找到节点 ${nodeId} 的 DOM 元素，无法清除浮动样式`);
                return false;
            }

            // 清除样式类
            nodeEl.classList.remove(this.FLOATING_CLASS);

            // 移除内联样式兜底
            nodeEl.style.removeProperty('border');
            nodeEl.style.removeProperty('border-radius');
            nodeEl.style.removeProperty('box-shadow');
            nodeEl.style.removeProperty('outline');

            // 强制重绘
            void nodeEl.offsetHeight;

            return true;
        } catch (err) {
            error('[FloatingNodeStyleManager] 清除浮动样式失败:', err);
            return false;
        }
    }

    // =========================================================================
    // 批量操作
    // =========================================================================

    /**
     * 应用所有浮动节点的样式
     */
    applyAllFloatingStyles(nodeIds: string[]): void {
        info(`[FloatingNodeStyleManager] 为 ${nodeIds.length} 个节点应用浮动样式`);
        for (const nodeId of nodeIds) {
            this.applyFloatingStyle(nodeId);
        }
    }

    /**
     * 清除所有浮动节点的样式
     */
    clearAllFloatingStyles(nodeIds: string[]): void {
        info(`[FloatingNodeStyleManager] 清除 ${nodeIds.length} 个节点的浮动样式`);
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

        // 方法2: 遍历所有 canvas-node 元素
        const allNodeEls = document.querySelectorAll('.canvas-node');
        for (const el of Array.from(allNodeEls)) {
            const dataNodeId = el.getAttribute('data-node-id');
            if (dataNodeId === nodeId) {
                return el as HTMLElement;
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
