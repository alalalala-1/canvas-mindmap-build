/**
 * UI/DOM 辅助工具函数
 * 用于处理 Canvas UI 元素的查找和操作
 */

import { CanvasLike } from '../canvas/types';
import { getNodeFromCanvas } from './node-utils';

/**
 * 查找"缩放到适应"按钮
 */
export function findZoomToFitButton(targetEl: HTMLElement): HTMLElement | null {
    const controlItem = targetEl.closest('.canvas-control-item');
    if (!(controlItem instanceof HTMLElement)) return null;

    const ariaLabel = controlItem.getAttribute('aria-label')?.toLowerCase() || '';
    if (ariaLabel.includes('zoom to fit')) return controlItem;

    const hasMaximizeIcon = !!controlItem.querySelector('svg.lucide-maximize');
    return hasMaximizeIcon ? controlItem : null;
}

/**
 * 尝试缩放到选中内容
 */
export function tryZoomToSelection(app: { 
    commands?: { executeCommandById?: (id: string) => boolean | void };
}, canvasView: { zoomToSelection?: () => void }, canvas: CanvasLike & { zoomToSelection?: () => void }): boolean {
    if (typeof canvas.zoomToSelection === 'function') {
        canvas.zoomToSelection();
        return true;
    }

    if (typeof canvasView.zoomToSelection === 'function') {
        canvasView.zoomToSelection();
        return true;
    }

    if (app.commands && typeof app.commands.executeCommandById === 'function') {
        const result = app.commands.executeCommandById('canvas:zoom-to-selection');
        if (result !== false) return true;
    }

    return false;
}

/**
 * 查找删除按钮
 */
export function findDeleteButton(targetEl: HTMLElement): HTMLElement | null {
    let deleteBtn = targetEl.closest('[data-type="trash"]');
    if (deleteBtn instanceof HTMLElement) return deleteBtn;

    deleteBtn = targetEl.closest('.clickable-icon');
    if (!(deleteBtn instanceof HTMLElement)) return null;

    const isTrashButton = deleteBtn.getAttribute('data-type') === 'trash' ||
        deleteBtn.classList.contains('trash') ||
        deleteBtn.querySelector('svg')?.outerHTML.toLowerCase().includes('trash') ||
        deleteBtn.title?.toLowerCase().includes('delete') ||
        deleteBtn.title?.toLowerCase().includes('trash') ||
        deleteBtn.getAttribute('aria-label') === 'Remove';

    return isTrashButton ? deleteBtn : null;
}

/**
 * 从目标元素查找 Canvas 节点元素
 */
export function findCanvasNodeElementFromTarget(targetEl: HTMLElement): HTMLElement | null {
    let nodeEl = targetEl.closest('.canvas-node');
    if (!nodeEl && targetEl.classList.contains('canvas-node-content-blocker')) {
        nodeEl = targetEl.parentElement?.closest('.canvas-node') || null;
    }
    return nodeEl instanceof HTMLElement ? nodeEl : null;
}

/**
 * 解析 fromLink 信息
 */
export function parseFromLink(text?: string, color?: string): {
    file: string;
    from: { line: number; ch: number };
    to: { line: number; ch: number };
} | null {
    if (text) {
        const match = text.match(/<!-- fromLink:(.*?) -->/);
        if (match?.[1]) {
            try {
                return JSON.parse(match[1]) as {
                    file: string;
                    from: { line: number; ch: number };
                    to: { line: number; ch: number };
                };
            } catch {
                return null;
            }
        }
    }

    if (color?.startsWith('fromLink:')) {
        try {
            const fromLinkJson = color.substring('fromLink:'.length);
            return JSON.parse(fromLinkJson) as {
                file: string;
                from: { line: number; ch: number };
                to: { line: number; ch: number };
            };
        } catch {
            return null;
        }
    }

    return null;
}

/**
 * 安全地获取 Canvas 节点的 DOM 元素
 */
export function getNodeDomElement(canvas: CanvasLike, nodeId: string): HTMLElement | null {
    if (!canvas?.nodes) return null;
    if (canvas.nodes instanceof Map) {
        const nodeData = canvas.nodes.get(nodeId);
        return nodeData?.nodeEl || null;
    }
    return null;
}

/**
 * 检查节点是否在视图中可见
 */
export function isNodeVisible(canvas: CanvasLike, nodeId: string): boolean {
    const nodeEl = getNodeDomElement(canvas, nodeId);
    if (!nodeEl) return false;
    return nodeEl.style.display !== 'none';
}

/**
 * 显示/隐藏节点
 */
export function setNodeVisibility(canvas: CanvasLike, nodeId: string, visible: boolean): void {
    const nodeEl = getNodeDomElement(canvas, nodeId);
    if (nodeEl) {
        nodeEl.style.display = visible ? '' : 'none';
    }
}