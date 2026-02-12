import { Platform } from 'obsidian';
import { Canvas } from '../canvas/types';

/**
 * 获取节点ID从DOM元素
 */
export function getNodeIdFromElement(el: Element, canvas: Canvas): string | null {
    // 尝试从 data-node-id 获取
    const dataNodeId = el.getAttribute('data-node-id');
    if (dataNodeId) return dataNodeId;

    // 尝试从 Canvas 节点数据中匹配
    const nodes = Array.from(canvas.nodes.values());
    for (const node of nodes) {
        const nodeEl = node.nodeEl;
        if (!nodeEl) continue;
        if (nodeEl === el) {
            return node.id;
        }
        if (nodeEl instanceof HTMLElement && nodeEl.contains(el)) {
            return node.id;
        }
        if (el instanceof HTMLElement && el.contains(nodeEl)) {
            return node.id;
        }
    }

    // 尝试从类名中提取
    const className = el.getAttribute('class') ?? '';
    const idMatch = className.match(/[a-zA-Z0-9]{8,}/);
    if (idMatch) return idMatch[0];

    return null;
}

/**
 * 检测移动设备
 */
export function detectMobileDevice(): boolean {
    const platform = Platform as unknown as { isMobileApp?: boolean; isMobile?: boolean };
    return platform.isMobileApp === true || platform.isMobile === true;
}
