import { App, ItemView, Notice, Plugin, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../settings/types';
import { CollapseStateManager } from '../state/collapse-state';
import { DeleteConfirmationModal } from '../ui/delete-modal';
import { DeleteEdgeConfirmationModal } from '../ui/delete-edge-modal';
import { FloatingNodeService } from './services/floating-node-service';
import { CanvasManager } from './canvas-manager';
import { log } from '../utils/logger';
import {
    getCanvasView,
    getCurrentCanvasFilePath,
    getNodeIdFromEdgeEndpoint,
    debounce
} from '../utils/canvas-utils';

export class CanvasEventManager {
    private plugin: Plugin;
    private app: App;
    private settings: CanvasMindmapBuildSettings;
    private collapseStateManager: CollapseStateManager;
    private floatingNodeService: FloatingNodeService;
    private canvasManager: CanvasManager;
    private mutationObserver: MutationObserver | null = null;
    private clickDebounceMap = new Map<string, number>();
    private mutationObserverRetryCount = 0;
    private readonly MAX_MUTATION_OBSERVER_RETRIES = 10;
    private isObserverSetup = false;

    constructor(
        plugin: Plugin,
        app: App,
        settings: CanvasMindmapBuildSettings,
        collapseStateManager: CollapseStateManager,
        canvasManager: CanvasManager
    ) {
        this.plugin = plugin;
        this.app = app;
        this.settings = settings;
        this.collapseStateManager = collapseStateManager;
        this.canvasManager = canvasManager;
        // 从 CanvasManager 获取 FloatingNodeService
        this.floatingNodeService = canvasManager.getFloatingNodeService();
    }

    /**
     * 初始化事件监听
     */
    async initialize() {
        this.registerEventListeners();
        
        // 如果当前已经有 canvas 打开，立即启动 observer 和事件监听器
        const canvasView = this.getCanvasView();
        if (canvasView) {
            await this.setupCanvasEventListeners(canvasView);
            this.setupMutationObserver();
        }
    }

    private registerEventListeners() {
        // 监听 Canvas 视图打开
        this.plugin.registerEvent(
            this.app.workspace.on('active-leaf-change', async (leaf) => {
                if (leaf?.view?.getViewType() === 'canvas') {
                    // 启动 MutationObserver
                    this.setupMutationObserver();
                    
                    // 直接使用当前 leaf 的 view，确保它是正确的 canvas 视图
                    const canvasView = leaf.view as ItemView;
                    if (canvasView) {
                        await this.setupCanvasEventListeners(canvasView);
                        // Canvas打开时立即检查并添加所有必要的DOM属性和按钮
                        setTimeout(() => {
                            this.canvasManager.checkAndAddCollapseButtons();
                        }, 500);
                    }
                }
            })
        );

        // 节点点击处理
        const handleNodeClick = async (event: MouseEvent) => {
            const canvasView = this.getCanvasView();
            if (!canvasView) return;

            const targetEl = event.target as HTMLElement;
            
            // 检查是否点击了删除按钮
            const deleteBtn = this.findDeleteButton(targetEl);
            if (deleteBtn) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                
                setTimeout(async () => {
                    const canvas = (canvasView as any).canvas;
                    
                    // 先检查是否选中了边
                    const selectedEdge = this.getSelectedEdge(canvas);
                    if (selectedEdge) {
                        const modal = new DeleteEdgeConfirmationModal(this.app);
                        modal.open();
                        const result = await modal.waitForResult();
                        
                        if (result.action === 'confirm') {
                            await this.canvasManager.deleteSelectedEdge();
                        }
                        return;
                    }
                    
                    // 否则检查是否选中了节点
                    const selectedNode = this.getSelectedNodeFromCanvas(canvas);
                    if (selectedNode) {
                        await this.executeDeleteOperation(selectedNode, canvas);
                    }
                }, 0);
                return;
            }
            
            // 检查是否点击了折叠按钮
            const collapseBtn = targetEl.closest('.cmb-collapse-button');
            if (collapseBtn) {
                const nodeId = collapseBtn.getAttribute('data-node-id');
                if (nodeId) {
                    const isDirectButtonClick = targetEl.closest('.cmb-collapse-button') === collapseBtn;
                    if (isDirectButtonClick) {
                        await this.handleCollapseButtonClick(nodeId, event, canvasView);
                    }
                }
                return;
            }

            // 处理 fromLink 点击
            await this.handleFromLinkClick(targetEl, canvasView);
        };

        this.plugin.registerDomEvent(document, 'click', handleNodeClick, { capture: true });
    }

    // =========================================================================
    // 删除按钮相关
    // =========================================================================
    private findDeleteButton(targetEl: HTMLElement): HTMLElement | null {
        // 方法1: 直接匹配 data-type="trash"
        let deleteBtn = targetEl.closest('[data-type="trash"]') as HTMLElement;
        
        // 方法2: 检查 clickable-icon 类
        if (!deleteBtn) {
            deleteBtn = targetEl.closest('.clickable-icon') as HTMLElement;
            if (deleteBtn) {
                const isTrashButton = deleteBtn.getAttribute('data-type') === 'trash' ||
                                    deleteBtn.classList.contains('trash') ||
                                    deleteBtn.querySelector('svg')?.outerHTML.toLowerCase().includes('trash') ||
                                    deleteBtn.title?.toLowerCase().includes('delete') ||
                                    deleteBtn.title?.toLowerCase().includes('trash') ||
                                    deleteBtn.getAttribute('aria-label') === 'Remove';
                if (!isTrashButton) deleteBtn = null as unknown as HTMLElement;
            }
        }
        
        return deleteBtn;
    }

    private getSelectedNodeFromCanvas(canvas: any): any | null {
        if (!canvas?.nodes) return null;
        
        if (canvas.selection && canvas.selection.size > 0) {
            const firstSelected = canvas.selection.values().next().value;
            // 确保它是节点而不是边
            if (firstSelected && (firstSelected.nodeEl || firstSelected.type)) {
                return firstSelected;
            }
        }
        
        if (canvas.selectedNodes && canvas.selectedNodes.length > 0) {
            return canvas.selectedNodes[0];
        }
        
        // 回退：检查 DOM 类名
        const allNodes = Array.from(canvas.nodes.values());
        for (const node of allNodes) {
            const nodeAny = node as any;
            if (nodeAny.nodeEl) {
                const hasFocused = nodeAny.nodeEl.classList.contains('is-focused');
                const hasSelected = nodeAny.nodeEl.classList.contains('is-selected');
                if (hasFocused || hasSelected) {
                    return node;
                }
            }
        }
        
        return null;
    }

    private async executeDeleteOperation(selectedNode: any, canvas: any) {
        let edges: any[] = [];
        if (canvas.fileData?.edges) edges = canvas.fileData.edges;
        if (canvas.edges) edges = Array.from(canvas.edges.values());
        
        const hasChildren = this.collapseStateManager.getChildNodes(selectedNode.id, edges).length > 0;
        
        const modal = new DeleteConfirmationModal(this.app, hasChildren);
        modal.open();
        const result = await modal.waitForResult();
        
        if (result.action === 'cancel') return;

        this.collapseStateManager.clearCache();
        log(`[Event] UI: 删除 ${selectedNode.id} (${result.action})`);
        if (result.action === 'confirm' || result.action === 'single') {
            await this.canvasManager['nodeManager'].handleSingleDelete(selectedNode, canvas);
        } else if (result.action === 'cascade') {
            await this.canvasManager['nodeManager'].handleCascadeDelete(selectedNode, canvas);
        }
    }

    // =========================================================================
    // 折叠按钮点击处理
    // =========================================================================
    private async handleCollapseButtonClick(nodeId: string, event: MouseEvent, canvasView: ItemView) {
        const currentTime = Date.now();
        const lastClickTime = this.clickDebounceMap.get(nodeId) || 0;
        
        if (currentTime - lastClickTime < 300) return;
        
        this.clickDebounceMap.set(nodeId, currentTime);
        event.preventDefault();
        event.stopPropagation();
        
        log(`[Event] UI: ${this.collapseStateManager.isCollapsed(nodeId) ? '展开' : '折叠'}: ${nodeId}`);
        
        try {
            await this.canvasManager.toggleNodeCollapse(nodeId);
        } finally {
            setTimeout(() => {
                if (this.clickDebounceMap.get(nodeId) === currentTime) {
                    this.clickDebounceMap.delete(nodeId);
                }
            }, 500);
        }
    }

    // =========================================================================
    // fromLink 点击处理
    // =========================================================================
    private async handleFromLinkClick(targetEl: HTMLElement, canvasView: ItemView) {
        let nodeEl = targetEl.closest('.canvas-node');
        if (!nodeEl && targetEl.classList.contains('canvas-node-content-blocker')) {
            nodeEl = targetEl.parentElement?.closest('.canvas-node') || null;
        }
        if (!nodeEl) return;

        const canvas = (canvasView as any).canvas;
        if (!canvas?.nodes) return;
        
        const nodes = Array.from(canvas.nodes.values()) as any[];
        const clickedNode = nodes.find(node => node.nodeEl === nodeEl);
        if (!clickedNode) return;

        // 解析 fromLink
        let fromLink: any = null;
        if (clickedNode.text) {
            const match = clickedNode.text.match(/<!-- fromLink:(.*?) -->/);
            if (match?.[1]) {
                try {
                    fromLink = JSON.parse(match[1]);
                } catch (e) {}
            }
        }
        
        if (!fromLink) return;

        log(`[Event] UI: 跳转 fromLink -> ${fromLink.file}`);
        try {
            const sourceFile = this.app.vault.getAbstractFileByPath(fromLink.file);
            if (!(sourceFile instanceof TFile)) {
                new Notice('Source file not found.');
                return;
            }

            let mdLeaf = this.app.workspace.getLeavesOfType('markdown').find(
                leaf => (leaf.view as any).file?.path === fromLink.file
            );
            if (!mdLeaf) {
                mdLeaf = this.app.workspace.getLeaf('split', 'vertical');
                await mdLeaf.openFile(sourceFile);
            } else {
                this.app.workspace.setActiveLeaf(mdLeaf, true, true);
            }

            const view = mdLeaf.view as any;
            setTimeout(() => {
                view.editor.setSelection(fromLink.from, fromLink.to);
                view.editor.scrollIntoView({ from: fromLink.from, to: fromLink.to }, true);
            }, 100);
        } catch (err) {
            log(`[Event] UI: 跳转失败: ${err}`);
        }
    }

    // =========================================================================
    // Canvas 事件监听
    // =========================================================================
    async setupCanvasEventListeners(canvasView: ItemView) {
        const canvas = (canvasView as any).canvas;
        if (!canvas?.on) return;

        // 初始化 FloatingNodeService（如果尚未初始化）
        const canvasFilePath = canvas.file?.path || (canvasView as any).file?.path;
        if (canvasFilePath) {
            await this.floatingNodeService.initialize(canvasFilePath, canvas);
        }

        // 监听所有可能的事件
        const events = ['edge-add', 'edge-change', 'edge-modify', 'connection-add', 'link-add'];
        for (const eventName of events) {
            canvas.on(eventName, async (data: any) => {
                // 仅在关键事件时输出 log
            });
        }
        
        canvas.on('edge-add', async (edge: any) => {
            const fromId = edge.from?.node?.id || edge.fromNode || (typeof edge.from === 'string' ? edge.from : null);
            const toId = edge.to?.node?.id || edge.toNode || (typeof edge.to === 'string' ? edge.to : null);
            log(`[Event] Canvas:EdgeAdd: ${edge.id} (${fromId} -> ${toId})`);

            this.collapseStateManager.clearCache();
            requestAnimationFrame(async () => {
                try {
                    await this.floatingNodeService.handleNewEdge(edge);
                } catch (err) {
                    log(`[EdgeAdd] 异常: ${err}`);
                }
            });
            await this.canvasManager.checkAndAddCollapseButtons();
        });

        canvas.on('edge-delete', (edge: any) => {
            const fromId = edge.from?.node?.id || edge.fromNode || (typeof edge.from === 'string' ? edge.from : null);
            const toId = edge.to?.node?.id || edge.toNode || (typeof edge.to === 'string' ? edge.to : null);
            log(`[Event] Canvas:EdgeDelete: ${edge.id} (${fromId} -> ${toId})`);

            this.collapseStateManager.clearCache();
            this.canvasManager.checkAndAddCollapseButtons();
        });

        canvas.on('node-select', async (node: any) => {
            // 检查选中的节点是否是浮动节点，如果是，清除浮动状态
            if (node?.id) {
                const nodeId = node.id;

                // 使用新的服务检查并清除浮动状态
                const isFloating = await this.floatingNodeService.isNodeFloating(nodeId);
                if (isFloating) {
                    // 检查节点是否有入边（有父节点）
                    // 浮动节点的定义是"没有入边（没有父节点）的节点"
                    // 它可以有出边（子节点），所以只检查入边
                    const hasIncomingEdge = this.checkNodeHasIncomingEdge(nodeId, canvas);

                    if (hasIncomingEdge) {
                        await this.floatingNodeService.clearNodeFloatingState(nodeId);
                    }
                }
            }

            this.canvasManager.checkAndAddCollapseButtons();
        });

        canvas.on('node-add', async (node: any) => {
            if (node?.id) {
                const isFloating = await this.floatingNodeService.isNodeFloating(node.id);
                if (isFloating) {
                    await this.floatingNodeService.clearNodeFloatingState(node.id);
                }
                setTimeout(() => {
                    this.canvasManager.adjustNodeHeightAfterRender(node.id);
                }, 100);
            }
        });

        canvas.on('node-delete', (node: any) => {
            log(`[Event] Canvas:NodeDelete: ${node.id}`);
            this.floatingNodeService.clearFloatingMarks(node);
            this.canvasManager.checkAndAddCollapseButtons();
        });

        canvas.on('node-drag', (node: any) => {
            // 只要节点有被折叠的子节点，或者有浮动子节点，就需要同步
            this.canvasManager.syncHiddenChildrenOnDrag(node);
        });
    }

    // =========================================================================
    // MutationObserver
    // =========================================================================
    private setupMutationObserver() {
        if (this.isObserverSetup) return;

        const canvasView = this.getCanvasView();
        if (!canvasView) return;

        const canvasWrapper = document.querySelector('.canvas-wrapper') || 
                             document.querySelector('.canvas-node-container') ||
                             document.querySelector('.canvas');
        
        if (!canvasWrapper) {
            this.mutationObserverRetryCount++;
            if (this.mutationObserverRetryCount <= this.MAX_MUTATION_OBSERVER_RETRIES) {
                setTimeout(() => this.setupMutationObserver(), 100);
            } else {
                this.isObserverSetup = true;
            }
            return;
        }

        this.mutationObserver = new MutationObserver((mutations) => {
            let shouldCheckButtons = false;
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (const node of Array.from(mutation.addedNodes)) {
                        if (node instanceof HTMLElement && node.classList.contains('canvas-node')) {
                            shouldCheckButtons = true;
                        }
                    }
                }
            }

            if (shouldCheckButtons) {
                this.canvasManager.checkAndAddCollapseButtons();
            }
        });

        this.mutationObserver.observe(canvasWrapper, { childList: true, subtree: true });
        this.isObserverSetup = true;
        this.plugin.register(() => this.mutationObserver?.disconnect());
    }
    
    // =========================================================================
    // 辅助方法
    // =========================================================================
    private getSelectedEdge(canvas: any): any | null {
        if (canvas.selectedEdge) return canvas.selectedEdge;
        
        if (canvas.selectedEdges && canvas.selectedEdges.length > 0) {
            return canvas.selectedEdges[0];
        }
        
        if (canvas.edges) {
            const edgesArray = Array.from(canvas.edges.values()) as any[];
            for (const edge of edgesArray) {
                const isFocused = edge?.lineGroupEl?.classList?.contains('is-focused');
                const isSelected = edge?.lineGroupEl?.classList?.contains('is-selected');
                
                if (isFocused || isSelected) {
                    return edge;
                }
            }
        }
        
        return null;
    }

    private checkNodeHasIncomingEdge(nodeId: string, canvas: any): boolean {
        if (!canvas?.edges) return false;
        
        const edges = canvas.edges instanceof Map ? Array.from(canvas.edges.values()) :
                     Array.isArray(canvas.edges) ? canvas.edges : [];
        
        for (const edge of edges) {
            const toNodeId = this.getNodeIdFromEdgeEndpoint(edge?.to);
            if (toNodeId === nodeId) {
                return true;
            }
        }
        
        return false;
    }

    private checkNodeHasOutgoingEdge(nodeId: string, canvas: any): boolean {
        if (!canvas?.edges) return false;
        
        const edges = canvas.edges instanceof Map ? Array.from(canvas.edges.values()) :
                     Array.isArray(canvas.edges) ? canvas.edges : [];
        
        for (const edge of edges) {
            const fromNodeId = this.getNodeIdFromEdgeEndpoint(edge?.from);
            if (fromNodeId === nodeId) {
                return true;
            }
        }
        
        return false;
    }

    private getNodeIdFromEdgeEndpoint(endpoint: any): string | null {
        return getNodeIdFromEdgeEndpoint(endpoint);
    }

    private getCanvasView(): ItemView | null {
        return getCanvasView(this.app);
    }

    // =========================================================================
    // 获取当前 Canvas 文件路径
    // =========================================================================
    private getCurrentCanvasFilePath(): string | undefined {
        return getCurrentCanvasFilePath(this.app);
    }

    // =========================================================================
    // 卸载
    // =========================================================================
    unload() {
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }
        
        const buttons = document.querySelectorAll('.cmb-collapse-button');
        buttons.forEach(btn => btn.remove());
    }
}
