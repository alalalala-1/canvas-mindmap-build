/**
 * 内容类型检测工具函数
 * 用于检测节点内容的类型（公式、图片、文本、文件等）
 */

import { CanvasNodeLike } from '../canvas/types';

type CanvasDataNode = {
    id: string;
    data?: Record<string, unknown>;
    type?: string;
};

/**
 * 检测内容是否为公式
 */
export function isFormulaContent(content: string): boolean {
    if (!content) return false;
    const trimmed = content.trim();
    return /^\$\$[\s\S]*?\$\$\s*(<!-- fromLink:[\s\S]*?-->)?\s*$/.test(trimmed);
}

/**
 * 检测内容是否为图片
 */
export function isImageContent(content: string): boolean {
    if (!content) return false;
    const imageRegex = /!?\[\[.*?\]\]|!?\[.*?\]\(.*?\)/;
    return imageRegex.test(content);
}

/**
 * 检测节点是否为文本节点
 */
export function isTextNode(node: CanvasNodeLike | CanvasDataNode | null | undefined): boolean {
    if (!node) return true;
    return !node.type || node.type === 'text';
}

/**
 * 检测节点是否为文件节点
 */
export function isFileNode(node: CanvasNodeLike | CanvasDataNode | null | undefined): boolean {
    return node?.type === 'file';
}