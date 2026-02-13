import { CanvasNodeLike, CanvasEdgeLike } from './canvas/types';

declare module 'obsidian' {
    interface Workspace {
        on(event: 'canvas:edge-create', callback: (edge: CanvasEdgeLike) => void): EventRef;
        on(event: 'canvas:edge-delete', callback: (edge: CanvasEdgeLike) => void): EventRef;
        on(event: 'canvas:node-create', callback: (node: CanvasNodeLike) => void): EventRef;
        on(event: 'canvas:node-delete', callback: (node: CanvasNodeLike) => void): EventRef;
        on(event: 'canvas:node-move', callback: (node: CanvasNodeLike) => void): EventRef;
        on(event: 'canvas:change', callback: () => void): EventRef;
    }
}
