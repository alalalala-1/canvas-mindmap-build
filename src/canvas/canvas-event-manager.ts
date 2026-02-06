import { App, ItemView, Notice, Plugin, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../settings/types';
import { CollapseStateManager } from '../state/collapse-state';
import { DeleteConfirmationModal } from '../ui/delete-modal';
import { DeleteEdgeConfirmationModal } from '../ui/delete-edge-modal';
import { FloatingNodeService } from './services/floating-node-service';
import { CanvasManager } from './canvas-manager';
import { debug, info, warn, error } from '../utils/logger';
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

    // =========================================================================
    // 初始化事件监听
    // =========================================================================
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
        // 监听 Canvas 边创建事件（标准 API）
        // 使用类型断言，因为这些事件在 Obsidian v1.11+ 中可用但类型定义可能不完整
        info('[registerEventListeners] 注册 canvas:edge-created 事件监听');
        this.plugin.registerEvent(
            (this.app.workspace as any).on('canvas:edge-created', (canvas: any, edge: any) => {
                info('[canvas:edge-created] 边创建事件触发');
                info(`[canvas:edge-created] canvas type: ${typeof canvas}, edge type: ${typeof edge}`);
                info(`[canvas:edge-created] edge:`, edge);

                // 使用新的服务处理新边
                this.floatingNodeService.handleNewEdge(edge);
            })
        );
        
        // 调试：监听所有 canvas 相关事件
        const canvasEvents = ['canvas:node-created', 'canvas:node-deleted', 'canvas:edge-deleted', 'canvas:selection-change'];
        for (const eventName of canvasEvents) {
            this.plugin.registerEvent(
                (this.app.workspace as any).on(eventName, (...args: any[]) => {
                    info(`[debug] 事件触发: ${eventName}`, args.length);
                })
            );
        }
        
        // 监听 Canvas 边删除事件（标准 API）
        this.plugin.registerEvent(
            (this.app.workspace as any).on('canvas:edge-deleted', (canvas: any, edgeId: string) => {
                info(`[canvas:edge-deleted] 边删除事件触发: ${edgeId}`);
                // 可以在这里添加额外的清理逻辑
            })
        );
        
        // 监听 Canvas 视图打开
        this.plugin.registerEvent(
            this.app.workspace.on('active-leaf-change', async (leaf) => {
                if (leaf?.view?.getViewType() === 'canvas') {
                    debug('检测到 Canvas 视图打开');
                    
                    // 启动 MutationObserver
                    this.setupMutationObserver();
                    
                    const canvasView = this.app.workspace.getActiveViewOfType(ItemView);
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
                        info('删除按钮被点击，显示边删除确认对话框');
                        const modal = new DeleteEdgeConfirmationModal(this.app);
                        modal.open();
                        const result = await modal.waitForResult();
                        
                        if (result.action === 'confirm') {
                            info('用户确认删除边');
                            await this.canvasManager.deleteSelectedEdge();
                        } else {
                            info('用户取消删除边');
                        }
                        return;
                    }
                    
                    // 否则检查是否选中了节点
                    const selectedNode = this.getSelectedNodeFromCanvas(canvas);
                    if (selectedNode) {
                        info('删除按钮被点击，执行节点删除操作');
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
            return canvas.selection.values().next().value;
        } else if (canvas.selectedNodes && canvas.selectedNodes.length > 0) {
            return canvas.selectedNodes[0];
        } else {
            const allNodes = Array.from(canvas.nodes.values());
            for (const node of allNodes) {
                const nodeAny = node as any;
                if (nodeAny.nodeEl) {
                    const hasFocused = nodeAny.nodeEl.classList.contains('is-focused');
                    const hasSelected = nodeAny.nodeEl.classList.contains('is-selected');
                    if (hasFocused || hasSelected) return node;
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
        
        if (result.action === 'confirm' || result.action === 'single') {
            // 调用 CanvasNodeManager 的单个删除方法
            await this.canvasManager['nodeManager'].handleSingleDelete(selectedNode, canvas);
        } else if (result.action === 'cascade') {
            // 调用 CanvasNodeManager 的级联删除方法
            await this.canvasManager['nodeManager'].handleCascadeDelete(selectedNode, canvas);
        }
    }

    // =========================================================================
    // 折叠按钮点击处理
    // =========================================================================
    private async handleCollapseButtonClick(nodeId: string, event: MouseEvent, canvasView: ItemView) {
        const currentTime = Date.now();
        const lastClickTime = this.clickDebounceMap.get(nodeId) || 0;
        
        if (currentTime - lastClickTime < 300) {
            debug(`节点 ${nodeId} 在300ms内重复点击，忽略`);
            return;
        }
        
        this.clickDebounceMap.set(nodeId, currentTime);
        event.preventDefault();
        event.stopPropagation();
        
        debug(`点击折叠按钮: ${nodeId}, 当前状态: ${this.collapseStateManager.isCollapsed(nodeId) ? '已折叠' : '已展开'}`);
        
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

        try {
            // 打开源文件并跳转
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
            error('处理 fromLink 点击失败:', err);
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
                info(`[canvas-event] 事件触发: ${eventName}`, data);
            });
        }
        
        canvas.on('edge-add', async (edge: any) => {
            info('[edge-add] Canvas 事件: edge-add');

            // 清除折叠缓存，确保新添加的子节点能被正确识别
            this.collapseStateManager.clearCache();
            info('[edge-add] 已清除折叠状态缓存');

            // 直接处理新边，确保浮动状态立即清除（有些环境下 canvas:edge-created 不会触发）
            // 使用下一帧保证 Canvas 的 edges 映射已更新
            requestAnimationFrame(async () => {
                try {
                    await this.floatingNodeService.handleNewEdge(edge);
                } catch (err) {
                    error('[edge-add] 处理新边失败:', err);
                }
            });

            await this.canvasManager.checkAndAddCollapseButtons();
            info('[edge-add] 事件处理完成');
        });

        canvas.on('edge-delete', () => {
            info('Canvas 事件: edge-delete - 边被删除');
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
                        info(`节点 ${nodeId} 被选中，有入边且处于浮动状态，清除浮动状态`);
                        await this.floatingNodeService.clearNodeFloatingState(nodeId);
                    }
                }
            }

            this.canvasManager.checkAndAddCollapseButtons();
        });

        // 监听节点添加事件（当通过连线创建新连接时）
        canvas.on('node-add', async (node: any) => {
            if (node?.id) {
                const nodeId = node.id;
                // 检查新添加的节点是否是浮动节点，如果是则清除状态
                const isFloating = await this.floatingNodeService.isNodeFloating(nodeId);
                if (isFloating) {
                    info(`新节点 ${nodeId} 被添加，清除浮动状态`);
                    await this.floatingNodeService.clearNodeFloatingState(nodeId);
                }
            }
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
        // 如果已经设置过 observer，不再重复设置
        if (this.isObserverSetup) {
            return;
        }

        // 只有在 canvas 视图打开时才启动 observer
        const canvasView = this.getCanvasView();
        if (!canvasView) {
            // 没有打开的 canvas，不启动 observer，也不重试
            return;
        }

        // 尝试多种选择器来找到 canvas 容器
        const canvasWrapper = document.querySelector('.canvas-wrapper') || 
                             document.querySelector('.canvas-node-container') ||
                             document.querySelector('.canvas');
        
        if (!canvasWrapper) {
            this.mutationObserverRetryCount++;
            if (this.mutationObserverRetryCount <= this.MAX_MUTATION_OBSERVER_RETRIES) {
                // 只在有 canvas 视图时才重试，且只在第一次失败时输出日志
                if (this.getCanvasView()) {
                    if (this.mutationObserverRetryCount === 1) {
                        debug('Canvas 容器尚未加载，等待重试...');
                    }
                    setTimeout(() => this.setupMutationObserver(), 100);
                }
            } else {
                warn(`达到最大重试次数，停止查找 Canvas 容器`);
                this.isObserverSetup = true; // 标记为已设置，避免重复尝试
            }
            return;
        }

        // 找到容器后才创建 observer
        this.mutationObserver = new MutationObserver((mutations) => {
            let shouldCheckButtons = false;
            let addedNodeIds: string[] = [];

            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (const node of Array.from(mutation.addedNodes)) {
                        if (node instanceof HTMLElement) {
                            // 检查是否有新节点添加
                            if (node.classList.contains('canvas-node')) {
                                shouldCheckButtons = true;
                                const nodeId = node.getAttribute('data-node-id');
                                if (nodeId) addedNodeIds.push(nodeId);
                            } else {
                                const internalNodes = node.querySelectorAll('.canvas-node');
                                if (internalNodes.length > 0) {
                                    shouldCheckButtons = true;
                                    internalNodes.forEach(n => {
                                        const id = n.getAttribute('data-node-id');
                                        if (id) addedNodeIds.push(id);
                                    });
                                }
                            }
                            
                            // 检查是否有新边添加 - 更全面的检测
                            const hasCanvasEdges = node.classList.contains('canvas-edges') || 
                                                 node.querySelector('.canvas-edges');
                            const hasCanvasEdge = node.classList.contains('canvas-edge') || 
                                                node.querySelector('.canvas-edge');
                            const hasPathElements = node.tagName === 'svg' && 
                                                  node.querySelector('path') &&
                                                  (node.querySelector('path.canvas-display-path') || 
                                                   node.querySelector('path.canvas-interaction-path'));
                            
                            if (hasCanvasEdges || hasCanvasEdge || hasPathElements) {
                                // 边添加通常意味着可能有浮动状态需要清除
                                // 但我们已经有 canvas:edge-created 事件，所以这里主要用于日志调试
                                // debug('MutationObserver 检测到边添加');
                            }
                        }
                    }
                }
            }

            if (shouldCheckButtons) {
                this.canvasManager.checkAndAddCollapseButtons();
                
                // 关键修复：当节点重新进入 DOM 时，重新应用浮动样式
                if (addedNodeIds.length > 0) {
                    const canvasView = this.getCanvasView();
                    const canvas = (canvasView as any)?.canvas;
                    if (canvas) {
                        requestAnimationFrame(() => {
                            this.floatingNodeService.reapplyAllFloatingStyles(canvas);
                        });
                    }
                }
            }
        });

        this.mutationObserverRetryCount = 0;
        this.isObserverSetup = true;
        this.mutationObserver.observe(canvasWrapper, {
            childList: true,
            subtree: true
        });
        debug('MutationObserver 已成功设置');

        // 注意：边变化检测已在 FloatingNodeService.initialize 中启动
        // 这里不需要重复启动
    }
    
    // =========================================================================
    // 辅助方法
    // =========================================================================
    private getSelectedEdge(canvas: any): any | null {
        debug('开始查找选中的边...');
        
        if (canvas.selectedEdge) {
            debug('找到 canvas.selectedEdge');
            return canvas.selectedEdge;
        }
        
        if (canvas.selectedEdges && canvas.selectedEdges.length > 0) {
            debug(`找到 canvas.selectedEdges，数量: ${canvas.selectedEdges.length}`);
            return canvas.selectedEdges[0];
        }
        
        if (canvas.edges) {
            const edgesArray = Array.from(canvas.edges.values()) as any[];
            debug(`检查 ${edgesArray.length} 条边...`);
            
            for (const edge of edgesArray) {
                const isFocused = edge?.lineGroupEl?.classList?.contains('is-focused');
                const isSelected = edge?.lineGroupEl?.classList?.contains('is-selected');
                
                if (isFocused || isSelected) {
                    debug(`找到选中的边: ${edge?.id}, focused: ${isFocused}, selected: ${isSelected}`);
                    return edge;
                }
            }
        }
        
        debug('未找到选中的边');
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
