import { App, ItemView, Notice, Plugin, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../settings/types';
import { CollapseStateManager } from '../state/collapse-state';
import { DeleteConfirmationModal } from '../ui/delete-modal';
import { DeleteEdgeConfirmationModal } from '../ui/delete-edge-modal';
import { FloatingNodeManager } from './floating-node-manager';
import { CanvasManager } from './canvas-manager';
import { debug, info, warn, error } from '../utils/logger';

export class CanvasEventManager {
    private plugin: Plugin;
    private app: App;
    private settings: CanvasMindmapBuildSettings;
    private collapseStateManager: CollapseStateManager;
    private floatingNodeManager: FloatingNodeManager;
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
        floatingNodeManager: FloatingNodeManager,
        canvasManager: CanvasManager
    ) {
        this.plugin = plugin;
        this.app = app;
        this.settings = settings;
        this.collapseStateManager = collapseStateManager;
        this.floatingNodeManager = floatingNodeManager;
        this.canvasManager = canvasManager;
    }

    // =========================================================================
    // 初始化事件监听
    // =========================================================================
    initialize() {
        this.registerEventListeners();
        
        // 如果当前已经有 canvas 打开，立即启动 observer 和事件监听器
        const canvasView = this.getCanvasView();
        if (canvasView) {
            this.setupCanvasEventListeners(canvasView);
            this.setupMutationObserver();
        }
    }

    private registerEventListeners() {
        // 监听 Canvas 视图打开
        this.plugin.registerEvent(
            this.app.workspace.on('active-leaf-change', async (leaf) => {
                if (leaf?.view?.getViewType() === 'canvas') {
                    debug('检测到 Canvas 视图打开');
                    
                    // 启动 MutationObserver
                    this.setupMutationObserver();
                    
                    const canvasView = this.app.workspace.getActiveViewOfType(ItemView);
                    if (canvasView) {
                        this.setupCanvasEventListeners(canvasView);
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
    setupCanvasEventListeners(canvasView: ItemView) {
        const canvas = (canvasView as any).canvas;
        if (!canvas?.on) return;

        canvas.on('edge-add', async (edge: any) => {
            info('[edge-add] Canvas 事件: edge-add');
            
            // 清除折叠缓存，确保新添加的子节点能被正确识别
            this.collapseStateManager.clearCache();
            info('[edge-add] 已清除折叠状态缓存');

            // 获取边的源节点和目标节点
            const fromNodeId = this.getNodeIdFromEdgeEndpoint(edge?.from);
            const toNodeId = this.getNodeIdFromEdgeEndpoint(edge?.to);

            info(`[edge-add] 新边: ${fromNodeId} -> ${toNodeId}`);
            info(`[edge-add] floatingNodeManager 存在: ${this.floatingNodeManager ? '是' : '否'}`);

            // 如果源节点或目标节点是浮动节点，清除其浮动状态
            if (fromNodeId) {
                info(`[edge-add] 清除源节点 ${fromNodeId} 的浮动状态`);
                await this.floatingNodeManager.clearFloatingNodeState(fromNodeId, canvas);
                info(`[edge-add] 源节点 ${fromNodeId} 浮动状态清除完成`);
            }
            
            if (toNodeId) {
                info(`[edge-add] 清除目标节点 ${toNodeId} 的浮动状态`);
                await this.floatingNodeManager.clearFloatingNodeState(toNodeId, canvas);
                info(`[edge-add] 目标节点 ${toNodeId} 浮动状态清除完成`);
            } else {
                warn('[edge-add] 无法获取目标节点 ID，边对象:', edge);
            }

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
                
                // 从文件中获取浮动节点列表（更可靠）
                const canvasFilePath = this.getCurrentCanvasFilePath();
                if (canvasFilePath) {
                    try {
                        const canvasFile = this.app.vault.getAbstractFileByPath(canvasFilePath);
                        if (canvasFile instanceof TFile) {
                            const canvasContent = await this.app.vault.read(canvasFile);
                            const canvasData = JSON.parse(canvasContent);
                            const floatingNodes = canvasData.metadata?.floatingNodes || {};
                            
                            // 检查节点是否处于浮动状态
                            if (floatingNodes[nodeId] !== undefined) {
                                // 兼容旧格式（boolean）和新格式（object）
                                let isFloating = false;
                                if (typeof floatingNodes[nodeId] === 'boolean') {
                                    isFloating = floatingNodes[nodeId];
                                } else if (typeof floatingNodes[nodeId] === 'object' && floatingNodes[nodeId] !== null) {
                                    isFloating = floatingNodes[nodeId].isFloating;
                                }
                                
                                if (isFloating) {
                                    // 检查节点是否有边连接（入边或出边）
                                    const hasIncomingEdge = this.checkNodeHasIncomingEdge(nodeId, canvas);
                                    const hasOutgoingEdge = this.checkNodeHasOutgoingEdge(nodeId, canvas);
                                    
                                    if (hasIncomingEdge || hasOutgoingEdge) {
                                        info(`节点 ${nodeId} 被选中，有边连接且处于浮动状态，清除浮动状态`);
                                        await this.floatingNodeManager.clearFloatingNodeState(nodeId);
                                    }
                                }
                            }
                        }
                    } catch (err) {
                        error('node-select 事件处理错误:', err);
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
                const memoryFloatingNodes = canvas.fileData?.metadata?.floatingNodes || {};
                if (memoryFloatingNodes[nodeId]) {
                    info(`新节点 ${nodeId} 被添加，清除浮动状态`);
                    await this.floatingNodeManager.clearFloatingNodeState(nodeId);
                }
            }
        });

        canvas.on('node-drag', (node: any) => {
            if (node?.id && this.collapseStateManager.isCollapsed(node.id)) {
                this.canvasManager.syncHiddenChildrenOnDrag(node);
            }
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
            let shouldCheckEdges = false;

            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (const node of Array.from(mutation.addedNodes)) {
                        if (node instanceof HTMLElement) {
                            // 检查是否有新节点添加
                            if (node.classList.contains('canvas-node') ||
                                node.querySelector('.canvas-node')) {
                                shouldCheckButtons = true;
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
                                shouldCheckEdges = true;
                                info('MutationObserver 检测到边添加:', node.className || node.tagName);
                            }
                            
                            // 调试：输出所有添加的节点类名
                            if (node.className) {
                                debug('MutationObserver 添加节点:', node.className);
                            } else if (node.tagName) {
                                debug('MutationObserver 添加元素:', node.tagName);
                            }
                        }
                    }
                }
            }

            if (shouldCheckButtons) {
                this.canvasManager.checkAndAddCollapseButtons();
            }

            // 如果有新边添加，检查是否需要清除浮动状态
            if (shouldCheckEdges) {
                info('MutationObserver 调用 checkAndClearFloatingStateForNewEdges');
                this.canvasManager.checkAndClearFloatingStateForNewEdges();
            }
        });

        this.mutationObserverRetryCount = 0;
        this.isObserverSetup = true;
        this.mutationObserver.observe(canvasWrapper, {
            childList: true,
            subtree: true
        });
        debug('MutationObserver 已成功设置');
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
        if (!endpoint) return null;
        if (typeof endpoint === 'string') return endpoint;
        if (typeof endpoint.nodeId === 'string') return endpoint.nodeId;
        if (endpoint.node && typeof endpoint.node.id === 'string') return endpoint.node.id;
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
    // 获取当前 Canvas 文件路径
    // =========================================================================
    private getCurrentCanvasFilePath(): string | undefined {
        // 方法1: 从 activeLeaf 获取
        const activeLeaf = this.app.workspace.activeLeaf;
        if (activeLeaf?.view?.getViewType() === 'canvas') {
            const canvas = (activeLeaf.view as any).canvas;
            if (canvas?.file?.path) {
                return canvas.file.path;
            }
            if ((activeLeaf.view as any).file?.path) {
                return (activeLeaf.view as any).file.path;
            }
        }
        
        // 方法2: 从 getActiveViewOfType 获取
        const activeView = this.app.workspace.getActiveViewOfType('canvas' as any);
        if (activeView?.getViewType() === 'canvas') {
            const canvas = (activeView as any).canvas;
            if (canvas?.file?.path) {
                return canvas.file.path;
            }
            if ((activeView as any).file?.path) {
                return (activeView as any).file.path;
            }
        }
        
        // 方法3: 从所有 leaves 中查找 canvas
        const canvasLeaves = this.app.workspace.getLeavesOfType('canvas');
        for (const leaf of canvasLeaves) {
            if (leaf.view?.getViewType() === 'canvas') {
                const canvas = (leaf.view as any).canvas;
                if (canvas?.file?.path) {
                    return canvas.file.path;
                }
                if ((leaf.view as any).file?.path) {
                    return (leaf.view as any).file.path;
                }
            }
        }
        
        return undefined;
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