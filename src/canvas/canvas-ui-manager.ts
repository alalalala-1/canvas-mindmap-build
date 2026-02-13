import { App, ItemView } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../settings/types';
import { CollapseStateManager } from '../state/collapse-state';
import { getCanvasView } from '../utils/canvas-utils';
import { log } from '../utils/logger';
import { CONSTANTS } from '../constants';
import { CanvasLike, CanvasNodeLike, CanvasEdgeLike, CanvasViewLike } from './types';

export class CanvasUIManager {
    private app: App;
    private settings: CanvasMindmapBuildSettings;
    private collapseStateManager: CollapseStateManager;
    private resizeObservers = new Map<string, ResizeObserver>();

    constructor(
        app: App,
        settings: CanvasMindmapBuildSettings,
        collapseStateManager: CollapseStateManager
    ) {
        this.app = app;
        this.settings = settings;
        this.collapseStateManager = collapseStateManager;
    }

    async checkAndAddCollapseButtons() {
        const canvasView = this.getCanvasView();
        if (!canvasView) {
            log(`[UI] checkAndAddCollapseButtons: 无 canvasView`);
            return;
        }

        const canvas = (canvasView as CanvasViewLike).canvas;
        if (!canvas) {
            log(`[UI] checkAndAddCollapseButtons: 无 canvas`);
            return;
        }

        let nodes: CanvasNodeLike[] = [];
        let edges: CanvasEdgeLike[] = [];
        
        if (canvas.fileData?.nodes) {
            nodes = canvas.fileData.nodes;
            edges = canvas.fileData?.edges || [];
            log(`[UI] checkAndAddCollapseButtons: 从 fileData 获取, nodes=${nodes.length}, edges=${edges.length}`);
        } else if (canvas.nodes && canvas.edges) {
            nodes = canvas.nodes instanceof Map 
                ? Array.from(canvas.nodes.values()) 
                : Object.values(canvas.nodes);
            edges = canvas.edges instanceof Map 
                ? Array.from(canvas.edges.values()) 
                : Array.isArray(canvas.edges) 
                    ? canvas.edges 
                    : [];
            log(`[UI] checkAndAddCollapseButtons: 从内存获取, nodes=${nodes.length}, edges=${edges.length}`);
        }

        if (nodes.length === 0) {
            log(`[UI] checkAndAddCollapseButtons: 无节点`);
            return;
        }

        const nodesWithChildren = new Set<string>();
        for (const e of edges) {
            const fromId = typeof e.from === 'string' 
                ? e.from 
                : e.from?.node?.id || e.fromNode;
            if (fromId) {
                nodesWithChildren.add(fromId);
            }
        }

        for (const node of nodes) {
            const nodeId = node.id;
            if (!nodeId) continue;
            
            const nodeEl = node.nodeEl;
            if (!nodeEl) continue;

            nodeEl.setAttribute('data-node-id', nodeId);

            const hasChildren = nodesWithChildren.has(nodeId);

            if (!hasChildren) {
                const existingBtn = nodeEl.querySelector('.cmb-collapse-button');
                if (existingBtn) {
                    log(`[UI] 移除折叠按钮: ${nodeId} (无子节点)`);
                    existingBtn.remove();
                    this.collapseStateManager.markExpanded(nodeId);
                }
                continue;
            }

            await this.addCollapseButtonToNodeIfNeeded(nodeEl, nodeId, edges);
        }
    }

    private async addCollapseButtonToNodeIfNeeded(
        nodeEl: Element, 
        nodeId: string, 
        edges: CanvasEdgeLike[]
    ): Promise<void> {
        const existingBtn = nodeEl.querySelector('.cmb-collapse-button');
        
        const hasChildren = edges.some((e) => {
            const fromId = typeof e.from === 'string' 
                ? e.from 
                : e.from?.node?.id || e.fromNode;
            return fromId === nodeId;
        });

        if (!hasChildren) {
            if (existingBtn) {
                existingBtn.remove();
                this.collapseStateManager.markExpanded(nodeId);
            }
            return;
        }

        if (!existingBtn) {
            await this.addCollapseButton(nodeEl, nodeId, edges);
        } else {
            const isCollapsed = this.collapseStateManager.isCollapsed(nodeId);
            existingBtn.classList.toggle('collapsed', isCollapsed);
            existingBtn.classList.toggle('expanded', !isCollapsed);
        }
    }

    private async addCollapseButton(nodeEl: Element, nodeId: string, edges: CanvasEdgeLike[]) {
        const direction = this.collapseStateManager.getNodeDirection(nodeId, edges);
        const computedStyle = window.getComputedStyle(nodeEl);
        if (computedStyle.position !== 'relative' && computedStyle.position !== 'absolute') {
            nodeEl.setAttribute('style', `position: relative; ${nodeEl.getAttribute('style') || ''}`);
        }

        const btn = document.createElement('button');
        btn.className = 'cmb-collapse-button';
        btn.setAttribute('data-node-id', nodeId);
        btn.setAttribute('data-direction', direction);
        btn.title = '点击折叠/展开子节点';

        const isCollapsed = this.collapseStateManager.isCollapsed(nodeId);
        btn.classList.add(isCollapsed ? 'collapsed' : 'expanded');

        this.applyButtonStyle(btn);
        nodeEl.appendChild(btn);
        nodeEl.setAttribute('data-node-id', nodeId);
    }

    private applyButtonStyle(btn: HTMLElement) {
        const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
        const btnWidth = isTouchDevice ? 24 : 20;
        btn.setAttribute(
            'style',
            `--cmb-collapse-btn-width: ${btnWidth}px; --cmb-collapse-btn-height: ${btnWidth}px; --cmb-collapse-btn-right: -${btnWidth}px;`
        );
    }

    updateCollapseButtonState(nodeId: string, isCollapsed: boolean) {
        const btn = document.querySelector(`.cmb-collapse-button[data-node-id="${nodeId}"]`) as HTMLElement;
        if (btn) {
            btn.classList.remove('collapsed', 'expanded');
            btn.classList.add(isCollapsed ? 'collapsed' : 'expanded');
            btn.title = isCollapsed ? '点击展开子节点' : '点击折叠子节点';
        }
    }

    applyFloatingNodeStyle(nodeId: string): void {
        const nodeEl = this.findNodeElementById(nodeId);
        if (nodeEl) {
            if (nodeEl.classList.contains('cmb-floating-node')) return;

            nodeEl.classList.add('cmb-floating-node');
        } else {
            setTimeout(() => {
                const retryNodeEl = this.findNodeElementById(nodeId);
                if (retryNodeEl) {
                    if (!retryNodeEl.classList.contains('cmb-floating-node')) {
                        retryNodeEl.classList.add('cmb-floating-node');
                    }
                }
            }, CONSTANTS.TIMING.RETRY_DELAY);
        }
    }

    clearFloatingNodeStyle(nodeId: string): void {
        const nodeEl = this.findNodeElementById(nodeId);
        if (nodeEl) {
            nodeEl.classList.remove('cmb-floating-node');
        }
    }

    private findNodeElementById(nodeId: string): HTMLElement | null {
        const nodeEl = document.querySelector(`.canvas-node[data-node-id="${nodeId}"]`) as HTMLElement;
        if (nodeEl) {
            return nodeEl;
        }

        const canvasView = this.getCanvasView();
        if (canvasView) {
            const canvas = (canvasView as CanvasViewLike).canvas;
            if (canvas?.nodes) {
                if (canvas.nodes instanceof Map) {
                    const node = canvas.nodes.get(nodeId);
                    if (node?.nodeEl) {
                        return node.nodeEl;
                    }
                } else if (typeof canvas.nodes === 'object') {
                    const node = (canvas.nodes as Record<string, CanvasNodeLike>)[nodeId];
                    if (node?.nodeEl) {
                        return node.nodeEl;
                    }
                }
            }
        }

        const allNodeEls = document.querySelectorAll('.canvas-node');
        const canvas = canvasView ? (canvasView as CanvasViewLike).canvas ?? null : null;
        for (const el of Array.from(allNodeEls)) {
            const id = this.getNodeIdFromElement(el, canvas);
            if (id === nodeId) {
                return el as HTMLElement;
            }
        }

        return null;
    }

    private getNodeIdFromElement(el: Element, canvas: CanvasLike | null): string | null {
        const dataNodeId = el.getAttribute('data-node-id');
        if (dataNodeId) return dataNodeId;

        if (canvas?.nodes) {
            const nodes = canvas.nodes instanceof Map 
                ? Array.from(canvas.nodes.values()) 
                : Object.values(canvas.nodes);
            for (const node of nodes) {
                if (node.nodeEl === el || (node.nodeEl && el.contains(node.nodeEl))) {
                    return node.id || null;
                }
            }
        }

        const idMatch = el.className.match(/[a-zA-Z0-9]{8,}/);
        if (idMatch) return idMatch[0];

        return null;
    }

    private getCanvasView(): ItemView | null {
        return getCanvasView(this.app);
    }

    unload() {
        this.resizeObservers.forEach(observer => observer.disconnect());
        this.resizeObservers.clear();
        
        const buttons = document.querySelectorAll('.cmb-collapse-button');
        buttons.forEach(btn => btn.remove());
    }
}
