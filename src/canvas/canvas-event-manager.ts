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
import { CanvasLike, CanvasNodeLike, CanvasEdgeLike } from './types';

type FromLinkInfo = {
    file: string;
    from: { line: number; ch: number };
    to: { line: number; ch: number };
};

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
        log(`[Event] CanvasEventManager.initialize() 被调用`);
        this.registerEventListeners();
        
        // 如果当前已经有 canvas 打开，立即启动 observer 和事件监听器
        const canvasView = this.getCanvasView();
        log(`[Event] getCanvasView() 返回: ${canvasView ? 'exists' : 'null'}`);
        if (canvasView) {
            log(`[Event] 立即设置 canvas 事件监听器`);
            await this.setupCanvasEventListeners(canvasView);
            this.setupMutationObserver();
        } else {
            log(`[Event] 当前没有打开的 canvas，等待 active-leaf-change 事件`);
        }
    }

    private registerEventListeners() {
        // 监听 Canvas 视图打开
        this.plugin.registerEvent(
            this.app.workspace.on('active-leaf-change', async (leaf) => {
                log(`[Event] active-leaf-change 触发, leaf=${leaf ? 'exists' : 'null'}, viewType=${leaf?.view?.getViewType() || 'null'}`);
                if (leaf?.view?.getViewType() === 'canvas') {
                    log(`[Event] Canvas 视图打开，开始设置事件监听`);
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

    private getSelectedNodeFromCanvas(canvas: CanvasLike): CanvasNodeLike | null {
        const canvasAny = canvas as any;
        if (!canvas?.nodes) return null;
        
        if (canvasAny.selection && canvasAny.selection.size > 0) {
            const firstSelected = canvasAny.selection.values().next().value;
            if (firstSelected && (firstSelected.nodeEl || firstSelected.type)) {
                return firstSelected;
            }
        }
        
        if (canvasAny.selectedNodes && canvasAny.selectedNodes.length > 0) {
            return canvasAny.selectedNodes[0];
        }
        
        const allNodes = canvas.nodes instanceof Map 
            ? Array.from(canvas.nodes.values()) 
            : Array.isArray(canvas.nodes) 
                ? canvas.nodes 
                : [];
                
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

    private async executeDeleteOperation(selectedNode: CanvasNodeLike, canvas: CanvasLike) {
        const canvasAny = canvas as any;
        let edges: any[] = [];
        if (canvasAny.fileData?.edges) edges = canvasAny.fileData.edges;
        if (canvas.edges) {
            edges = canvas.edges instanceof Map 
                ? Array.from(canvas.edges.values()) 
                : Array.isArray(canvas.edges) 
                    ? canvas.edges 
                    : [];
        }
        
        const nodeId = selectedNode.id!;
        const hasChildren = this.collapseStateManager.getChildNodes(nodeId, edges).length > 0;
        
        const modal = new DeleteConfirmationModal(this.app, hasChildren);
        modal.open();
        const result = await modal.waitForResult();
        
        if (result.action === 'cancel') return;

        this.collapseStateManager.clearCache();
        log(`[Event] UI: 删除 ${nodeId} (${result.action})`);
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

        const canvas = (canvasView as any).canvas as CanvasLike;
        if (!canvas?.nodes) return;
        
        const nodes = canvas.nodes instanceof Map 
            ? Array.from(canvas.nodes.values()) 
            : Array.isArray(canvas.nodes) 
                ? canvas.nodes 
                : [];
        const clickedNode = nodes.find(node => (node as any).nodeEl === nodeEl);
        if (!clickedNode) return;

        let fromLink: FromLinkInfo | null = null;
        
        if (clickedNode.text) {
            const match = clickedNode.text.match(/<!-- fromLink:(.*?) -->/);
            if (match?.[1]) {
                try {
                    fromLink = JSON.parse(match[1]) as FromLinkInfo;
                } catch (e) {
                    log(`[Event] fromLink 解析失败: ${e}`);
                }
            }
        }
        
        if (!fromLink && (clickedNode as any).color?.startsWith('fromLink:')) {
            try {
                const fromLinkJson = (clickedNode as any).color.substring('fromLink:'.length);
                fromLink = JSON.parse(fromLinkJson) as FromLinkInfo;
            } catch (e) {
                log(`[Event] fromLink (color) 解析失败: ${e}`);
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
                leaf => (leaf.view as any).file?.path === fromLink!.file
            );
            if (!mdLeaf) {
                mdLeaf = this.app.workspace.getLeaf('split', 'vertical');
                await mdLeaf.openFile(sourceFile);
            } else {
                this.app.workspace.setActiveLeaf(mdLeaf, true, true);
            }

            const view = mdLeaf.view as any;
            setTimeout(() => {
                view.editor.setSelection(fromLink!.from, fromLink!.to);
                view.editor.scrollIntoView({ from: fromLink!.from, to: fromLink!.to }, true);
            }, 100);
        } catch (err) {
            log(`[Event] UI: 跳转失败: ${err}`);
        }
    }

    // =========================================================================
    // Canvas 事件监听（使用 Obsidian 官方事件系统）
    // =========================================================================
    async setupCanvasEventListeners(canvasView: ItemView) {
        const canvas = (canvasView as any).canvas as CanvasLike;
        log(`[Event] setupCanvasEventListeners 被调用, canvas=${canvas ? 'exists' : 'null'}`);
        
        if (!canvas) {
            log(`[Event] canvas 不存在，跳过设置`);
            return;
        }

        const canvasFilePath = (canvas as any).file?.path || (canvasView as any).file?.path;
        log(`[Event] canvasFilePath=${canvasFilePath || 'null'}`);
        
        if (canvasFilePath) {
            log(`[Event] 正在初始化 FloatingNodeService...`);
            await this.floatingNodeService.initialize(canvasFilePath, canvas);
            log(`[Event] FloatingNodeService 初始化完成`);
        } else {
            log(`[Event] 警告: 无法获取 canvas 文件路径，跳过 FloatingNodeService 初始化`);
        }

        this.registerCanvasWorkspaceEvents(canvas);
    }

    private registerCanvasWorkspaceEvents(canvas: CanvasLike) {
        this.plugin.registerEvent(
            this.app.workspace.on('canvas:edge-create' as any, async (edge: any) => {
                const typedEdge = edge as CanvasEdgeLike;
                const fromId = (edge as any).from?.node?.id || typedEdge.fromNode || (typeof typedEdge.from === 'string' ? typedEdge.from : null);
                const toId = (edge as any).to?.node?.id || typedEdge.toNode || (typeof typedEdge.to === 'string' ? typedEdge.to : null);
                log(`[Event] Canvas:EdgeCreate: ${typedEdge.id} (${fromId} -> ${toId})`);

                this.collapseStateManager.clearCache();
                requestAnimationFrame(async () => {
                    try {
                        await this.floatingNodeService.handleNewEdge(typedEdge);
                    } catch (err) {
                        log(`[EdgeCreate] 异常: ${err}`);
                    }
                });
                await this.canvasManager.checkAndAddCollapseButtons();
            })
        );

        this.plugin.registerEvent(
            this.app.workspace.on('canvas:edge-delete' as any, (edge: any) => {
                const typedEdge = edge as CanvasEdgeLike;
                const fromId = (edge as any).from?.node?.id || typedEdge.fromNode || (typeof typedEdge.from === 'string' ? typedEdge.from : null);
                const toId = (edge as any).to?.node?.id || typedEdge.toNode || (typeof typedEdge.to === 'string' ? typedEdge.to : null);
                log(`[Event] Canvas:EdgeDelete: ${typedEdge.id} (${fromId} -> ${toId})`);

                this.collapseStateManager.clearCache();
                this.canvasManager.checkAndAddCollapseButtons();
            })
        );

        this.plugin.registerEvent(
            this.app.workspace.on('canvas:node-create' as any, async (node: any) => {
                const typedNode = node as CanvasNodeLike;
                const nodeId = typedNode?.id;
                log(`[Event] Canvas:NodeCreate 触发, node=${JSON.stringify(nodeId || node)}`);
                if (nodeId) {
                    const isFloating = await this.floatingNodeService.isNodeFloating(nodeId);
                    if (isFloating) {
                        await this.floatingNodeService.clearNodeFloatingState(nodeId);
                    }
                    log(`[Event] Canvas:NodeCreate 调用 adjustNodeHeightAfterRender: ${nodeId}`);
                    setTimeout(() => {
                        this.canvasManager.adjustNodeHeightAfterRender(nodeId);
                    }, 100);
                } else {
                    log(`[Event] Canvas:NodeCreate 警告: node.id 为空`);
                }
            })
        );

        this.plugin.registerEvent(
            this.app.workspace.on('canvas:node-delete' as any, (node: any) => {
                const typedNode = node as CanvasNodeLike;
                log(`[Event] Canvas:NodeDelete: ${typedNode.id}`);
                this.floatingNodeService.clearFloatingMarks(typedNode);
                this.canvasManager.checkAndAddCollapseButtons();
            })
        );

        this.plugin.registerEvent(
            this.app.workspace.on('canvas:node-move' as any, (node: any) => {
                this.canvasManager.syncHiddenChildrenOnDrag(node);
            })
        );

        this.plugin.registerEvent(
            this.app.workspace.on('canvas:change' as any, async () => {
                this.collapseStateManager.clearCache();
                await this.canvasManager.checkAndAddCollapseButtons();
            })
        );

        log(`[Event] Canvas 工作区事件已注册`);
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
    private getSelectedEdge(canvas: CanvasLike): CanvasEdgeLike | null {
        const canvasAny = canvas as any;
        if (canvasAny.selectedEdge) return canvasAny.selectedEdge;
        
        if (canvasAny.selectedEdges && canvasAny.selectedEdges.length > 0) {
            return canvasAny.selectedEdges[0];
        }
        
        if (canvas.edges) {
            const edgesArray = canvas.edges instanceof Map 
                ? Array.from(canvas.edges.values()) 
                : Array.isArray(canvas.edges) 
                    ? canvas.edges 
                    : [];
            for (const edge of edgesArray) {
                const isFocused = (edge as any)?.lineGroupEl?.classList?.contains('is-focused');
                const isSelected = (edge as any)?.lineGroupEl?.classList?.contains('is-selected');
                
                if (isFocused || isSelected) {
                    return edge;
                }
            }
        }
        
        return null;
    }

    // 已迁移到 canvas-utils.ts，直接使用 getEdgeToNodeId / getEdgeFromNodeId

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
