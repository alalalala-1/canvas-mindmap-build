import { App, ItemView, Notice, Plugin, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../settings/types';
import { CollapseStateManager } from '../state/collapse-state';
import { DeleteConfirmationModal } from '../ui/delete-modal';
import { DeleteEdgeConfirmationModal } from '../ui/delete-edge-modal';
import { FloatingNodeService } from './services/floating-node-service';
import { CanvasFileService } from './services/canvas-file-service';
import { CanvasManager } from './canvas-manager';
import { log } from '../utils/logger';
import { CONSTANTS } from '../constants';
import {
    getCanvasView,
    getNodeIdFromEdgeEndpoint,
    getSelectedEdge,
    getEdgeFromNodeId,
    getEdgeToNodeId,
    getEdgesFromCanvas
} from '../utils/canvas-utils';
import { CanvasLike, CanvasNodeLike, CanvasEdgeLike, CanvasViewLike, CanvasEventType, MarkdownViewLike } from './types';

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
    private canvasFileService: CanvasFileService;
    private mutationObserver: MutationObserver | null = null;
    private clickDebounceMap = new Map<string, number>();
    private mutationObserverRetryCount = 0;
    private readonly MAX_MUTATION_OBSERVER_RETRIES = 10;
    private isObserverSetup = false;
    private canvasChangeTimeoutId: number | null = null;
    private currentCanvasFilePath: string | null = null;
    private lastEdgeIds: Set<string> = new Set();
    private canvasFileModifyTimeoutId: number | null = null;

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
        this.canvasFileService = new CanvasFileService(app, settings);
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
        this.plugin.registerEvent(
            this.app.vault.on('modify', (file) => {
                if (!this.currentCanvasFilePath) return;
                if (file.path !== this.currentCanvasFilePath) return;
                if (this.canvasFileModifyTimeoutId !== null) {
                    window.clearTimeout(this.canvasFileModifyTimeoutId);
                }
                this.canvasFileModifyTimeoutId = window.setTimeout(async () => {
                    this.canvasFileModifyTimeoutId = null;
                    await this.handleCanvasFileModified(file.path);
                }, CONSTANTS.TIMING.BUTTON_CHECK_DEBOUNCE);
            })
        );

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
                        }, CONSTANTS.TIMING.RENDER_DELAY);
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
                    const canvas = (canvasView as CanvasViewLike).canvas;
                    if (!canvas) return;
                    
                    // 先检查是否选中了边
                    const selectedEdge = getSelectedEdge(canvas);
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
        if (!canvas?.nodes) return null;
        
        if (canvas.selection && canvas.selection.size > 0) {
            const firstSelected = canvas.selection.values().next().value;
            if (firstSelected && (firstSelected.nodeEl || firstSelected.type)) {
                return firstSelected;
            }
        }
        
        if (canvas.selectedNodes && canvas.selectedNodes.length > 0) {
            return canvas.selectedNodes[0] || null;
        }
        
        const allNodes = canvas.nodes instanceof Map 
            ? Array.from(canvas.nodes.values()) 
            : Array.isArray(canvas.nodes) 
                ? canvas.nodes 
                : [];
                
        for (const node of allNodes) {
            if (node.nodeEl) {
                const hasFocused = node.nodeEl.classList.contains('is-focused');
                const hasSelected = node.nodeEl.classList.contains('is-selected');
                if (hasFocused || hasSelected) {
                    return node;
                }
            }
        }
        
        return null;
    }

    private async executeDeleteOperation(selectedNode: CanvasNodeLike, canvas: CanvasLike) {
        let edges: CanvasEdgeLike[] = [];
        if (canvas.fileData?.edges) edges = canvas.fileData.edges as CanvasEdgeLike[];
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
            await this.canvasManager.handleSingleDelete(selectedNode, canvas);
        } else if (result.action === 'cascade') {
            await this.canvasManager.handleCascadeDelete(selectedNode, canvas);
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
            }, CONSTANTS.TIMING.RETRY_DELAY);
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

        const canvas = (canvasView as CanvasViewLike).canvas;
        if (!canvas?.nodes) return;
        
        const nodes = canvas.nodes instanceof Map 
            ? Array.from(canvas.nodes.values()) 
            : Array.isArray(canvas.nodes) 
                ? canvas.nodes 
                : [];
        const clickedNode = nodes.find(node => node.nodeEl === nodeEl);
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
        
        if (!fromLink && clickedNode.color?.startsWith('fromLink:')) {
            try {
                const fromLinkJson = clickedNode.color.substring('fromLink:'.length);
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
                new Notice('找不到源文件');
                return;
            }

            let mdLeaf = this.app.workspace.getLeavesOfType('markdown').find(
                leaf => (leaf.view as MarkdownViewLike).file?.path === fromLink!.file
            );
            if (!mdLeaf) {
                mdLeaf = this.app.workspace.getLeaf('split', 'vertical');
                await mdLeaf.openFile(sourceFile);
            } else {
                this.app.workspace.setActiveLeaf(mdLeaf, true, true);
            }

            const view = mdLeaf.view as MarkdownViewLike;
            setTimeout(() => {
                view.editor?.setSelection(fromLink!.from, fromLink!.to);
                view.editor?.scrollIntoView({ from: fromLink!.from, to: fromLink!.to }, true);
            }, CONSTANTS.TIMING.SCROLL_DELAY);
        } catch (err) {
            log(`[Event] UI: 跳转失败: ${err}`);
        }
    }

    // =========================================================================
    // Canvas 事件监听（使用 Obsidian 官方事件系统）
    // =========================================================================
    async setupCanvasEventListeners(canvasView: ItemView) {
        const canvas = (canvasView as CanvasViewLike).canvas;
        log(`[Event] setupCanvasEventListeners 被调用, canvas=${canvas ? 'exists' : 'null'}`);
        
        if (!canvas) {
            log(`[Event] canvas 不存在，跳过设置`);
            return;
        }

        const canvasFilePath = canvas.file?.path || (canvasView as CanvasViewLike).file?.path;
        log(`[Event] canvasFilePath=${canvasFilePath || 'null'}`);
        this.currentCanvasFilePath = canvasFilePath || null;
        if (canvas) {
            const edges = getEdgesFromCanvas(canvas);
            this.lastEdgeIds = this.buildEdgeIdSet(edges);
            log(`[Event] 初始化边快照: edges=${edges.length}`);
        }
        
        if (canvasFilePath) {
            log(`[Event] 正在初始化 FloatingNodeService...`);
            await this.floatingNodeService.initialize(canvasFilePath, canvas);
            log(`[Event] FloatingNodeService 初始化完成`);
        } else {
            log(`[Event] 警告: 无法获取 canvas 文件路径，跳过 FloatingNodeService 初始化`);
        }

        this.registerCanvasWorkspaceEvents(canvas);
    }

    private buildEdgeIdSet(edges: CanvasEdgeLike[]): Set<string> {
        const ids = new Set<string>();
        for (const edge of edges) {
            const fromId = getEdgeFromNodeId(edge);
            const toId = getEdgeToNodeId(edge);
            if (fromId && toId) {
                ids.add(`${fromId}->${toId}`);
            } else if (edge.id) {
                ids.add(edge.id);
            }
        }
        return ids;
    }

    private async handleCanvasFileModified(filePath: string): Promise<void> {
        log(`[Event] Canvas 文件变更: ${filePath}`);
        const data = await this.canvasFileService.readCanvasData(filePath);
        if (!data) {
            log(`[Event] Canvas 文件读取失败: ${filePath}`);
            return;
        }
        const edges = data.edges || [];
        const newEdgeIds = this.buildEdgeIdSet(edges);
        const newEdges: CanvasEdgeLike[] = [];

        for (const edge of edges) {
            const fromId = getEdgeFromNodeId(edge);
            const toId = getEdgeToNodeId(edge);
            const edgeId = fromId && toId ? `${fromId}->${toId}` : edge.id;
            if (edgeId && !this.lastEdgeIds.has(edgeId)) {
                newEdges.push(edge);
            }
        }

        if (newEdges.length > 0) {
            log(`[Event] Canvas 文件检测到新边: ${newEdges.length}`);
            for (const edge of newEdges) {
                await this.floatingNodeService.handleNewEdge(edge, true);
            }
            await this.canvasManager.checkAndAddCollapseButtons();
        }

        this.lastEdgeIds = newEdgeIds;
    }

    private registerCanvasWorkspaceEvents(canvas: CanvasLike) {
        this.plugin.registerEvent(
            this.app.workspace.on('canvas:edge-create', async (edge: CanvasEdgeLike) => {
                const fromId = (edge.from as { node?: { id?: string } })?.node?.id || edge.fromNode || (typeof edge.from === 'string' ? edge.from : null);
                const toId = (edge.to as { node?: { id?: string } })?.node?.id || edge.toNode || (typeof edge.to === 'string' ? edge.to : null);
                log(`[Event] Canvas:EdgeCreate: ${edge.id} (${fromId} -> ${toId})`);

                this.collapseStateManager.clearCache();
                requestAnimationFrame(async () => {
                    try {
                        await this.floatingNodeService.handleNewEdge(edge, false);
                    } catch (err) {
                        log(`[EdgeCreate] 异常: ${err}`);
                    }
                });
                await this.canvasManager.checkAndAddCollapseButtons();
                for (const delay of CONSTANTS.BUTTON_CHECK_INTERVALS) {
                    setTimeout(() => {
                        this.canvasManager.checkAndAddCollapseButtons();
                        this.canvasManager.checkAndClearFloatingStateForNewEdges();
                    }, delay);
                }
            })
        );

        this.plugin.registerEvent(
            this.app.workspace.on('canvas:edge-delete', (edge: CanvasEdgeLike) => {
                const fromId = (edge.from as { node?: { id?: string } })?.node?.id || edge.fromNode || (typeof edge.from === 'string' ? edge.from : null);
                const toId = (edge.to as { node?: { id?: string } })?.node?.id || edge.toNode || (typeof edge.to === 'string' ? edge.to : null);
                log(`[Event] Canvas:EdgeDelete: ${edge.id} (${fromId} -> ${toId})`);

                this.collapseStateManager.clearCache();
                this.canvasManager.checkAndAddCollapseButtons();
            })
        );

        this.plugin.registerEvent(
            this.app.workspace.on('canvas:change', () => {
                log(`[Event] Canvas:Change 触发`);
                if (this.canvasChangeTimeoutId !== null) {
                    log(`[Event] Canvas:Change 清理上一次防抖任务`);
                    window.clearTimeout(this.canvasChangeTimeoutId);
                }
                this.canvasChangeTimeoutId = window.setTimeout(() => {
                    this.canvasChangeTimeoutId = null;
                    log(`[Event] Canvas:Change 防抖执行`);
                    this.canvasManager.checkAndClearFloatingStateForNewEdges();
                    this.canvasManager.checkAndAddCollapseButtons();
                }, CONSTANTS.TIMING.BUTTON_CHECK_DEBOUNCE);
            })
        );

        this.plugin.registerEvent(
            this.app.workspace.on('canvas:node-create', async (node: CanvasNodeLike) => {
                const nodeId = node?.id;
                log(`[Event] Canvas:NodeCreate 触发, node=${JSON.stringify(nodeId || node)}`);
                if (nodeId) {
                    const isFloating = await this.floatingNodeService.isNodeFloating(nodeId);
                    if (isFloating) {
                        await this.floatingNodeService.clearNodeFloatingState(nodeId);
                    }
                    log(`[Event] Canvas:NodeCreate 调用 adjustNodeHeightAfterRender: ${nodeId}`);
                    setTimeout(() => {
                        this.canvasManager.adjustNodeHeightAfterRender(nodeId);
                    }, CONSTANTS.TIMING.SCROLL_DELAY);
                } else {
                    log(`[Event] Canvas:NodeCreate 警告: node.id 为空`);
                }
            })
        );

        this.plugin.registerEvent(
            this.app.workspace.on('canvas:node-delete', (node: CanvasNodeLike) => {
                log(`[Event] Canvas:NodeDelete: ${node.id}`);
                this.floatingNodeService.clearFloatingMarks(node);
                this.canvasManager.checkAndAddCollapseButtons();
            })
        );

        this.plugin.registerEvent(
            this.app.workspace.on('canvas:node-move', (node: CanvasNodeLike) => {
                this.canvasManager.syncHiddenChildrenOnDrag(node);
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
                setTimeout(() => this.setupMutationObserver(), CONSTANTS.TIMING.SCROLL_DELAY);
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

    private getCanvasView(): ItemView | null {
        return getCanvasView(this.app);
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
