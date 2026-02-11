import { App, ItemView, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../settings/types';
import { CollapseStateManager } from '../state/collapse-state';
import { log } from '../utils/logger';

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

    // =========================================================================
    // 检查并添加折叠按钮
    // =========================================================================
    async checkAndAddCollapseButtons() {
        const canvasView = this.getCanvasView();
        if (!canvasView) {
            log(`[UI] checkAndAddCollapseButtons: 无 canvasView`);
            return;
        }

        const canvas = (canvasView as any).canvas;
        if (!canvas) {
            log(`[UI] checkAndAddCollapseButtons: 无 canvas`);
            return;
        }

        // 获取节点和边数据
        let nodes: any[] = [];
        let edges: any[] = [];
        
        if (canvas.fileData?.nodes) {
            nodes = canvas.fileData.nodes;
            edges = canvas.fileData?.edges || [];
            log(`[UI] checkAndAddCollapseButtons: 从 fileData 获取, nodes=${nodes.length}, edges=${edges.length}`);
        } else if (canvas.nodes && canvas.edges) {
            nodes = Array.from(canvas.nodes.values());
            edges = Array.from(canvas.edges.values());
            log(`[UI] checkAndAddCollapseButtons: 从内存获取, nodes=${nodes.length}, edges=${edges.length}`);
        }

        if (nodes.length === 0) {
            log(`[UI] checkAndAddCollapseButtons: 无节点`);
            return;
        }

        // 获取所有存在的DOM节点元素
        const existingNodeEls = document.querySelectorAll('.canvas-node');
        const domNodeMap = new Map<string, Element>();
        
        for (const nodeEl of Array.from(existingNodeEls)) {
            const nodeId = this.getNodeIdFromElement(nodeEl, canvas);
            if (nodeId) {
                domNodeMap.set(nodeId, nodeEl);
            }
        }

        // 遍历所有Canvas节点
        for (const node of nodes) {
            const nodeId = node.id;
            if (!nodeId) continue;
            
            const nodeEl = domNodeMap.get(nodeId);
            if (!nodeEl) continue;

            // 确保所有节点都有 data-node-id 属性（用于样式管理）
            nodeEl.setAttribute('data-node-id', nodeId);

            // 检查该节点是否有子节点
            const hasChildren = edges.some((e: any) => {
                const fromId = e.from?.node?.id || e.fromNode;
                return fromId === nodeId;
            });

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

    // =========================================================================
    // 添加折叠按钮到节点
    // =========================================================================
    private async addCollapseButtonToNodeIfNeeded(
        nodeEl: Element, 
        nodeId: string, 
        edges: any[]
    ): Promise<void> {
        const existingBtn = nodeEl.querySelector('.cmb-collapse-button');
        
        const hasChildren = edges.some((e: any) => {
            const fromId = e.from?.node?.id || e.fromNode;
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

    // =========================================================================
    // 添加折叠按钮
    // =========================================================================
    private async addCollapseButton(nodeEl: Element, nodeId: string, edges: any[]) {
        const direction = this.collapseStateManager.getNodeDirection(nodeId, edges);
        const nodeWidth = nodeEl.clientWidth || 300;
        const nodeHeight = nodeEl.clientHeight || 100;

        const nodeElAsHtml = nodeEl as HTMLElement;
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

        this.applyButtonStyle(btn, direction, nodeWidth, nodeHeight);
        nodeEl.appendChild(btn);
        nodeEl.setAttribute('data-node-id', nodeId);
    }

    // =========================================================================
    // 应用按钮样式
    // =========================================================================
    private applyButtonStyle(btn: HTMLElement, direction: string, nodeWidth: number, nodeHeight: number) {
        // 检测是否是触控设备，使用不同的按钮尺寸
        const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
        const btnWidth = isTouchDevice ? 24 : 20;
        // 按钮高度比节点高度高30%
        const btnHeight = Math.round(nodeHeight * 1.3);

        btn.style.position = 'absolute';
        btn.style.zIndex = '100';
        btn.style.cursor = 'pointer';
        btn.style.border = 'none';
        btn.style.outline = 'none';
        btn.style.backgroundColor = '#D4A574';
        // 竖条按钮，宽度固定，高度为节点的130%
        btn.style.width = `${btnWidth}px`;
        btn.style.height = `${btnHeight}px`;
        btn.style.minWidth = `${btnWidth}px`;
        btn.style.minHeight = `${btnHeight}px`;
        btn.style.borderRadius = '6px';
        btn.style.padding = '0';
        btn.style.margin = '0';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.fontSize = '12px';
        btn.style.color = 'white';
        btn.style.fontWeight = 'bold';
        btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        btn.style.pointerEvents = 'auto';
        // 按钮为正方形，左侧与节点右侧重叠，顶部对齐
        // right = -按钮宽度，这样按钮左侧就与节点右侧重叠
        btn.style.right = `-${btnWidth}px`;
        btn.style.top = '0px';
        btn.style.left = 'auto';
        btn.style.transform = 'none';
    }

    // =========================================================================
    // 更新按钮状态
    // =========================================================================
    updateCollapseButtonState(nodeId: string, isCollapsed: boolean) {
        const btn = document.querySelector(`.cmb-collapse-button[data-node-id="${nodeId}"]`) as HTMLElement;
        if (btn) {
            btn.classList.remove('collapsed', 'expanded');
            btn.classList.add(isCollapsed ? 'collapsed' : 'expanded');
            btn.title = isCollapsed ? '点击展开子节点' : '点击折叠子节点';
        }
    }

    // =========================================================================
    // 应用浮动节点样式（红色边框）
    // =========================================================================
    applyFloatingNodeStyle(nodeId: string): void {
        const nodeEl = this.findNodeElementById(nodeId);
        if (nodeEl) {
            // 检查是否已经是浮动样式，避免重复应用
            if (nodeEl.style.border === '4px solid rgb(255, 68, 68)') return;
            
            nodeEl.style.border = '4px solid #ff4444';
            nodeEl.style.borderRadius = '8px';
            nodeEl.classList.add('cmb-floating-node');
        } else {
            // 如果找不到，延迟后重试（只重试一次）
            setTimeout(() => {
                const retryNodeEl = this.findNodeElementById(nodeId);
                if (retryNodeEl) {
                    if (retryNodeEl.style.border !== '4px solid rgb(255, 68, 68)') {
                        retryNodeEl.style.border = '4px solid #ff4444';
                        retryNodeEl.style.borderRadius = '8px';
                        retryNodeEl.classList.add('cmb-floating-node');
                    }
                }
            }, 500);
        }
    }

    // =========================================================================
    // 清除浮动节点样式
    // =========================================================================
    clearFloatingNodeStyle(nodeId: string): void {
        const nodeEl = this.findNodeElementById(nodeId);
        if (nodeEl) {
            nodeEl.style.border = '';
            nodeEl.style.borderRadius = '';
            nodeEl.classList.remove('cmb-floating-node');
        }
    }

    // =========================================================================
    // 根据节点 ID 查找 DOM 元素
    // =========================================================================
    private findNodeElementById(nodeId: string): HTMLElement | null {
        // 方法1: 直接使用 data-node-id 属性选择器
        const nodeEl = document.querySelector(`.canvas-node[data-node-id="${nodeId}"]`) as HTMLElement;
        if (nodeEl) {
            return nodeEl;
        }

        // 方法2: 获取 canvas 对象，从 canvas.nodes 中获取 nodeEl
        const canvasView = this.getCanvasView();
        if (canvasView) {
            const canvas = (canvasView as any).canvas;
            if (canvas?.nodes) {
                const node = canvas.nodes.get(nodeId);
                if (node?.nodeEl) {
                    return node.nodeEl as HTMLElement;
                }
            }
        }

        // 方法3: 遍历所有 .canvas-node 元素，使用 getNodeIdFromElement 匹配
        const allNodeEls = document.querySelectorAll('.canvas-node');
        for (const el of Array.from(allNodeEls)) {
            const id = this.getNodeIdFromElement(el, canvasView ? (canvasView as any).canvas : null);
            if (id === nodeId) {
                return el as HTMLElement;
            }
        }

        return null;
    }

    // =========================================================================
    // 辅助方法
    // =========================================================================
    private getNodeIdFromElement(el: Element, canvas: any): string | null {
        const dataNodeId = el.getAttribute('data-node-id');
        if (dataNodeId) return dataNodeId;

        if (canvas?.nodes) {
            const nodes = Array.from(canvas.nodes.values()) as any[];
            for (const node of nodes) {
                if (node.nodeEl === el || el.contains(node.nodeEl)) {
                    return node.id;
                }
            }
        }

        const idMatch = el.className.match(/[a-zA-Z0-9]{8,}/);
        if (idMatch) return idMatch[0];

        return null;
    }

    private getCanvasView(): ItemView | null {
        const activeLeaf = this.app.workspace.activeLeaf;
        if (activeLeaf?.view && (activeLeaf.view as any).canvas) {
            return activeLeaf.view as ItemView;
        }

        const leaves = this.app.workspace.getLeavesOfType('canvas');
        for (const leaf of leaves) {
            if (leaf.view && (leaf.view as any).canvas) {
                return leaf.view as ItemView;
            }
        }

        const view = this.app.workspace.getActiveViewOfType(ItemView);
        if (view && view.getViewType() === 'canvas') {
            return view;
        }

        return null;
    }

    // =========================================================================
    // 卸载
    // =========================================================================
    unload() {
        this.resizeObservers.forEach(observer => observer.disconnect());
        this.resizeObservers.clear();
        
        const buttons = document.querySelectorAll('.cmb-collapse-button');
        buttons.forEach(btn => btn.remove());
    }
}