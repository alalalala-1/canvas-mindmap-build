/**
 * Canvas 相关类型定义
 */

export interface FromLink {
    file: string;
    from: { line: number, ch: number };
    to: { line: number, ch: number };
}

export interface CanvasNode {
    id: string;
    nodeEl?: HTMLElement;
    text?: string;
    type?: 'text' | 'file';
    file?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
}