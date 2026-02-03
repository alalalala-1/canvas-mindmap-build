import { App, ItemView, Notice, Plugin, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../settings/types';
import { CollapseStateManager } from '../state/collapse-state';
import { LayoutManager } from './layout-manager';
import { DeleteConfirmationModal } from '../ui/delete-modal';
import { DeleteEdgeConfirmationModal } from '../ui/delete-edge-modal';
import { debug, info, warn, error, trace, logTime } from '../utils/logger';

export class CanvasManager {
    private plugin: Plugin;
    private app: App;
    private settings: CanvasMindmapBuildSettings;
    private collapseStateManager: CollapseStateManager;
    private layoutManager: LayoutManager;
    private mutationObserver: MutationObserver | null = null;
    private resizeObservers = new Map<string, ResizeObserver>();
    private clickDebounceMap = new Map<string, number>();
    private isLoadingCollapseState = false;
    private lastLoadedCanvasPath: string | null = null;
    private mutationObserverRetryCount = 0;
    private readonly MAX_MUTATION_OBSERVER_RETRIES = 10;
    private isObserverSetup = false;

    constructor(
        plugin: Plugin,
        app: App,
        settings: CanvasMindmapBuildSettings,
        collapseStateManager: CollapseStateManager
    ) {
        this.plugin = plugin;
        this.app = app;
        this.settings = settings;
        this.collapseStateManager = collapseStateManager;
        this.layoutManager = new LayoutManager(plugin, app, settings, collapseStateManager);
        debug('CanvasManager 实例化完成');
    }

    // =========================================================================
    // 初始化
    // =========================================================================
    initialize() {
        debug('初始化 Canvas 管理器');
        // 不在初始化时启动 observer，只在 canvas 打开时启动
        this.registerEventListeners();
        
        // 如果当前已经有 canvas 打开，立即启动 observer
        const canvasView = this.getCanvasView();
        if (canvasView) {
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
                    
                    // 获取当前 canvas 路径，如果切换了 canvas 则重置加载状态
                    const currentPath = this.getCurrentCanvasFilePath();
                    if (currentPath !== this.lastLoadedCanvasPath) {
                        this.resetCollapseStateLoading();
                    }
                    
                    await this.loadCollapseStateFromCanvasFile();
                    this.scheduleButtonCheck();
                    
                    const canvasView = this.app.workspace.getActiveViewOfType(ItemView);
                    if (canvasView) {
                        this.setupCanvasEventListeners(canvasView);
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
                            await this.deleteEdge(selectedEdge, canvas);
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
            await this.handleSingleDelete(selectedNode, canvas);
        } else if (result.action === 'cascade') {
            await this.handleCascadeDelete(selectedNode, canvas);
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
            await this.toggleNodeCollapse(nodeId, canvasView);
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
    private setupCanvasEventListeners(canvasView: ItemView) {
        const canvas = (canvasView as any).canvas;
        if (!canvas?.on) return;

        canvas.on('edge-add', () => {
            info('Canvas 事件: edge-add');
            this.collapseStateManager.clearCache();
            setTimeout(() => this.checkAndAddCollapseButtons(), 50);
        });

        canvas.on('edge-delete', () => {
            info('Canvas 事件: edge-delete - 边被删除');
            this.collapseStateManager.clearCache();
            setTimeout(() => {
                info('edge-delete 后刷新折叠按钮');
                this.checkAndAddCollapseButtons();
            }, 50);
        });

        canvas.on('node-select', () => {
            setTimeout(() => this.checkAndAddCollapseButtons(), 30);
        });

        canvas.on('node-drag', (node: any) => {
            if (node?.id && this.collapseStateManager.isCollapsed(node.id)) {
                this.syncHiddenChildrenOnDrag(node, canvas);
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
            
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (const node of Array.from(mutation.addedNodes)) {
                        if (node instanceof HTMLElement) {
                            if (node.classList.contains('canvas-node') || 
                                node.querySelector('.canvas-node')) {
                                shouldCheckButtons = true;
                                break;
                            }
                        }
                    }
                }
            }
            
            if (shouldCheckButtons) {
                setTimeout(() => this.checkAndAddCollapseButtons(), 100);
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
    // 按钮检查调度
    // =========================================================================
    private scheduleButtonCheck() {
        requestAnimationFrame(() => this.checkAndAddCollapseButtons());
        
        const intervals = [50, 100, 200, 300, 500, 800, 1200];
        intervals.forEach(delay => {
            setTimeout(() => this.checkAndAddCollapseButtons(), delay);
        });
    }

    // =========================================================================
    // 检查并添加折叠按钮
    // =========================================================================
    async checkAndAddCollapseButtons() {
        const canvasView = this.getCanvasView();
        if (!canvasView) return;

        const canvas = (canvasView as any).canvas;
        if (!canvas) return;

        // 从文件读取完整的节点和边数据
        let nodes: any[] = [];
        let edges: any[] = [];
        
        try {
            const canvasFilePath = this.getCanvasFilePath(canvasView);
            if (canvasFilePath) {
                const canvasFile = this.app.vault.getAbstractFileByPath(canvasFilePath);
                if (canvasFile instanceof TFile) {
                    const canvasContent = await this.app.vault.read(canvasFile);
                    const canvasData = JSON.parse(canvasContent);
                    nodes = canvasData.nodes || [];
                    edges = canvasData.edges || [];
                    
                    // 只在第一次加载时应用折叠状态
                    if (canvasData.metadata?.collapseStates && !this.lastLoadedCanvasPath) {
                        for (const [nodeId, isCollapsed] of Object.entries(canvasData.metadata.collapseStates)) {
                            if (isCollapsed === true) {
                                this.collapseStateManager.markCollapsed(nodeId);
                                this.applyCollapseState(nodeId, canvas, true);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            // 如果文件读取失败，回退到内存数据
            if (canvas.fileData?.nodes) {
                nodes = canvas.fileData.nodes;
                edges = canvas.fileData?.edges || [];
            } else if (canvas.nodes && canvas.edges) {
                nodes = Array.from(canvas.nodes.values());
                edges = Array.from(canvas.edges.values());
            }
        }

        if (nodes.length === 0 || edges.length === 0) return;

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
            
            // 检查该节点是否有子节点
            const hasChildren = edges.some((e: any) => {
                const fromId = e.from?.node?.id || e.fromNode;
                return fromId === nodeId;
            });

            if (!hasChildren) {
                const existingBtn = domNodeMap.get(nodeId)?.querySelector('.cmb-collapse-button');
                if (existingBtn) {
                    existingBtn.remove();
                    this.collapseStateManager.markExpanded(nodeId);
                }
                continue;
            }

            const nodeEl = domNodeMap.get(nodeId);
            if (nodeEl) {
                await this.addCollapseButtonToNodeIfNeeded(nodeEl, nodeId, edges, nodes.map((n: any) => n.id));
            }
        }
    }

    // =========================================================================
    // 添加折叠按钮到节点
    // =========================================================================
    private async addCollapseButtonToNodeIfNeeded(
        nodeEl: Element, 
        nodeId: string, 
        edges: any[],
        allNodeIds: string[]
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
        const isVisible = nodeElAsHtml.offsetParent !== null;
        const isInDocument = document.contains(nodeEl);
        debug(`节点 ${nodeId} DOM状态: 可见=${isVisible}, 在文档中=${isInDocument}`);

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
        
        info(`为节点 ${nodeId} 添加折叠按钮，方向: ${direction}, 尺寸: ${nodeWidth}x${nodeHeight}`);
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
    // 切换节点折叠状态
    // =========================================================================
    private async toggleNodeCollapse(nodeId: string, canvasView: ItemView) {
        const canvas = (canvasView as any).canvas;
        if (!canvas) return;

        const isCurrentlyCollapsed = this.collapseStateManager.isCollapsed(nodeId);
        
        if (isCurrentlyCollapsed) {
            await this.expandNode(nodeId, canvas);
            debug(`节点 ${nodeId} 从已折叠状态切换到已展开`);
        } else {
            await this.collapseNode(nodeId, canvas);
            debug(`节点 ${nodeId} 从已展开状态切换到已折叠`);
        }

        this.collapseStateManager.clearCache();

        // 自动布局调整
        try {
            await this.autoArrangeAfterToggle(nodeId, canvasView);
        } catch (error) {
            debug(`自动布局调整失败:`, error);
        }
    }

    // =========================================================================
    // 折叠节点
    // =========================================================================
    private async collapseNode(nodeId: string, canvas: any) {
        let edges: any[] = [];
        if (canvas.fileData?.edges) edges = canvas.fileData.edges;
        if (canvas.edges) edges = Array.from(canvas.edges.values());
        
        const allNodes = Array.from(canvas.nodes.values()) as any[];
        const childNodeIds = this.collapseStateManager.getChildNodes(nodeId, edges);
        if (childNodeIds.length === 0) return;

        // 收集所有后代节点
        const nodesToHide = new Set<string>();
        
        const collectDescendants = (parentId: string) => {
            const directChildren = this.collapseStateManager.getChildNodes(parentId, edges);
            for (const childId of directChildren) {
                if (!nodesToHide.has(childId)) {
                    nodesToHide.add(childId);
                    collectDescendants(childId);
                }
            }
        };
        
        for (const childId of childNodeIds) {
            nodesToHide.add(childId);
            collectDescendants(childId);
        }

        // 隐藏节点
        for (const id of nodesToHide) {
            const node = allNodes.find((n: any) => n.id === id);
            if (node?.nodeEl) {
                (node.nodeEl as HTMLElement).style.display = 'none';
            }
        }

        // 隐藏边
        const hiddenEdges: any[] = [];
        for (const id of nodesToHide) {
            for (const edge of edges) {
                const fromId = edge.from?.node?.id || edge.fromNode;
                const toId = edge.to?.node?.id || edge.toNode;
                if (fromId === id || toId === id) {
                    if (!hiddenEdges.includes(edge)) hiddenEdges.push(edge);
                }
            }
        }
        
        for (const childId of childNodeIds) {
            const edge = edges.find((e: any) => {
                const fromId = e.from?.node?.id || e.fromNode;
                const toId = e.to?.node?.id || e.toNode;
                return fromId === nodeId && toId === childId;
            });
            if (edge && !hiddenEdges.includes(edge)) hiddenEdges.push(edge);
        }

        for (const edge of hiddenEdges) {
            if (edge.lineGroupEl) {
                (edge.lineGroupEl as HTMLElement).style.display = 'none';
            }
            if (edge.lineEndGroupEl) {
                (edge.lineEndGroupEl as HTMLElement).style.display = 'none';
            }
        }

        this.collapseStateManager.markCollapsed(nodeId);
        this.updateCollapseButtonState(nodeId, true);
        await this.saveCollapseStateToCanvasFile(nodeId, true, canvas);
    }

    // =========================================================================
    // 展开节点 - 修复孙节点闪现问题
    // =========================================================================
    private async expandNode(nodeId: string, canvas: any) {
        let edges: any[] = [];
        if (canvas.fileData?.edges) edges = canvas.fileData.edges;
        if (canvas.edges) edges = Array.from(canvas.edges.values());
        
        const allNodes = Array.from(canvas.nodes.values()) as any[];

        // 只显示直接子节点，然后根据子节点的折叠状态决定是否显示孙节点
        const nodesToShow = new Set<string>();
        const edgesToShow = new Set<any>();

        // 递归收集需要显示的节点和边
        const collectVisibleNodes = (parentId: string) => {
            const directChildren = this.collapseStateManager.getChildNodes(parentId, edges);
            for (const childId of directChildren) {
                if (nodesToShow.has(childId)) continue;

                // 添加子节点
                nodesToShow.add(childId);

                // 添加从父节点到子节点的边
                const edge = edges.find((e: any) => {
                    const fromId = e.from?.node?.id || e.fromNode;
                    const toId = e.to?.node?.id || e.toNode;
                    return fromId === parentId && toId === childId;
                });
                if (edge) edgesToShow.add(edge);

                // 如果子节点没有被折叠，继续显示其子节点
                if (!this.collapseStateManager.isCollapsed(childId)) {
                    collectVisibleNodes(childId);
                }
            }
        };

        // 从当前节点开始收集
        collectVisibleNodes(nodeId);

        // 显示节点
        for (const id of nodesToShow) {
            const node = allNodes.find((n: any) => n.id === id);
            if (node?.nodeEl) {
                (node.nodeEl as HTMLElement).style.display = '';
            }
        }

        // 显示边
        for (const edge of edgesToShow) {
            if (edge.lineGroupEl) {
                (edge.lineGroupEl as HTMLElement).style.display = '';
            }
            if (edge.lineEndGroupEl) {
                (edge.lineEndGroupEl as HTMLElement).style.display = '';
            }
        }

        this.collapseStateManager.markExpanded(nodeId);
        this.updateCollapseButtonState(nodeId, false);
        await this.saveCollapseStateToCanvasFile(nodeId, false, canvas);
    }

    // =========================================================================
    // 更新按钮状态
    // =========================================================================
    private updateCollapseButtonState(nodeId: string, isCollapsed: boolean) {
        const btn = document.querySelector(`.cmb-collapse-button[data-node-id="${nodeId}"]`) as HTMLElement;
        if (btn) {
            btn.classList.remove('collapsed', 'expanded');
            btn.classList.add(isCollapsed ? 'collapsed' : 'expanded');
            btn.title = isCollapsed ? '点击展开子节点' : '点击折叠子节点';
        }
    }

    // =========================================================================
    // 删除节点相关
    // =========================================================================
    private async handleSingleDelete(node: any, canvas: any) {
        try {
            let edges: any[] = [];
            if (canvas.fileData?.edges) edges = canvas.fileData.edges;
            if (canvas.edges) edges = Array.from(canvas.edges.values());
            
            const allNodes = Array.from(canvas.nodes.values()) as any[];
            const parentNode = this.findParentNode(node.id, edges, allNodes);
            const childNodes = this.collapseStateManager.getChildNodes(node.id, edges);
            
            if (parentNode && childNodes.length > 0) {
                // 创建新的边连接父节点到子节点
                const newEdges: any[] = [];
                for (const childId of childNodes) {
                    const newEdge = {
                        id: this.generateRandomId(),
                        fromNode: parentNode.id,
                        fromSide: 'right',
                        toNode: childId,
                        toSide: 'left'
                    };
                    newEdges.push(newEdge);
                }
                
                await this.updateCanvasData(canvas, (data: any) => {
                    data.nodes = data.nodes.filter((n: any) => n.id !== node.id);
                    data.edges = data.edges.filter((e: any) => 
                        e.fromNode !== node.id && e.toNode !== node.id
                    );
                    data.edges.push(...newEdges);
                });
            } else {
                await this.updateCanvasData(canvas, (data: any) => {
                    data.nodes = data.nodes.filter((n: any) => n.id !== node.id);
                    data.edges = data.edges.filter((e: any) => 
                        e.fromNode !== node.id && e.toNode !== node.id
                    );
                });
            }
            
            this.collapseStateManager.clearCache();
            requestAnimationFrame(() => this.checkAndAddCollapseButtons());
            new Notice('节点删除成功！');
            
        } catch (error) {
            new Notice('删除操作失败，请重试');
        }
    }

    private async handleCascadeDelete(node: any, canvas: any) {
        try {
            let edges: any[] = [];
            if (canvas.fileData?.edges) edges = canvas.fileData.edges;
            if (canvas.edges) edges = Array.from(canvas.edges.values());
            
            const nodesToDelete = new Set<string>();
            nodesToDelete.add(node.id);
            
            const collectDescendants = (parentId: string) => {
                const directChildren = this.collapseStateManager.getChildNodes(parentId, edges);
                for (const childId of directChildren) {
                    if (!nodesToDelete.has(childId)) {
                        nodesToDelete.add(childId);
                        collectDescendants(childId);
                    }
                }
            };
            
            collectDescendants(node.id);
            
            await this.updateCanvasData(canvas, (data: any) => {
                data.nodes = data.nodes.filter((n: any) => !nodesToDelete.has(n.id));
                data.edges = data.edges.filter((e: any) => 
                    !nodesToDelete.has(e.fromNode) && !nodesToDelete.has(e.toNode)
                );
            });
            
            this.collapseStateManager.clearCache();
            requestAnimationFrame(() => this.checkAndAddCollapseButtons());
            new Notice(`成功删除 ${nodesToDelete.size} 个节点！`);
            
        } catch (error) {
            new Notice('删除操作失败，请重试');
        }
    }

    // =========================================================================
    // 删除边
    // =========================================================================
    async deleteSelectedEdge() {
        info('开始执行删除边命令');
        
        const canvasView = this.getCanvasView();
        if (!canvasView) {
            warn('未找到 canvas 视图');
            new Notice('No active canvas found');
            return;
        }
        info('找到 canvas 视图');

        const canvas = (canvasView as any).canvas;
        if (!canvas) {
            warn('canvas 视图中没有 canvas 对象');
            new Notice('Canvas not initialized');
            return;
        }
        
        const edge = this.getSelectedEdge(canvas);

        if (!edge) {
            warn('未找到选中的边');
            new Notice('No edge selected');
            return;
        }
        
        info(`找到选中的边: ${edge.id || 'unknown'}`);
        await this.deleteEdge(edge, canvas);
    }

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

    private async deleteEdge(edge: any, canvas: any): Promise<void> {
        try {
            const parentNodeId = edge.from?.node?.id || edge.fromNode;
            const childNodeId = edge.to?.node?.id || edge.toNode;
            
            info(`准备删除边: ${parentNodeId} -> ${childNodeId}`);

            // 从文件中删除边 - 优先使用设置中的路径
            let canvasFilePath: string | undefined = this.settings.canvasFilePath;
            
            // 如果设置中没有，尝试从 canvas 对象获取
            if (!canvasFilePath && canvas?.file?.path) {
                canvasFilePath = canvas.file.path;
            }
            
            // 如果还没有，尝试获取当前打开的 canvas
            if (!canvasFilePath) {
                canvasFilePath = this.getCurrentCanvasFilePath();
            }
            
            info(`Canvas 文件路径: ${canvasFilePath}`);
            
            if (canvasFilePath) {
                const canvasFile = this.app.vault.getAbstractFileByPath(canvasFilePath);
                if (canvasFile instanceof TFile) {
                    info(`读取 canvas 文件: ${canvasFilePath}`);
                    const canvasContent = await this.app.vault.read(canvasFile);
                    const canvasData = JSON.parse(canvasContent);
                    
                    const originalEdgeCount = canvasData.edges?.length || 0;
                    info(`原始边数量: ${originalEdgeCount}`);

                    canvasData.edges = canvasData.edges.filter((e: any) => {
                        const fromId = e.from?.node?.id || e.fromNode;
                        const toId = e.to?.node?.id || e.toNode;
                        const shouldDelete = fromId === parentNodeId && toId === childNodeId;
                        if (shouldDelete) {
                            info(`找到要删除的边: ${fromId} -> ${toId}`);
                        }
                        return !shouldDelete;
                    });
                    
                    const newEdgeCount = canvasData.edges.length;
                    info(`删除后边数量: ${newEdgeCount}, 删除了 ${originalEdgeCount - newEdgeCount} 条边`);

                    await this.app.vault.modify(canvasFile, JSON.stringify(canvasData, null, 2));
                    info('Canvas 文件已更新');
                } else {
                    warn(`Canvas 文件不存在或不是文件: ${canvasFilePath}`);
                }
            } else {
                warn('无法获取 canvas 文件路径');
            }

            // 重新加载 Canvas
            if (typeof canvas.reload === 'function') {
                info('重新加载 canvas');
                canvas.reload();
            }

            // 移动孤立节点到父节点下方
            if (childNodeId && parentNodeId) {
                info(`移动孤立节点 ${childNodeId} 到父节点 ${parentNodeId} 下方`);
                setTimeout(() => {
                    this.moveIsolatedNodeToParent(childNodeId, parentNodeId, canvas);
                }, 100);
            }

            new Notice('Edge deleted successfully');
            info('边删除成功');
        } catch (err) {
            error('删除边失败:', err);
            new Notice('Failed to delete edge');
        }
    }

    // =========================================================================
    // 移动孤立节点到父节点下方
    // =========================================================================
    private async moveIsolatedNodeToParent(childNodeId: string, parentNodeId: string, canvas: any): Promise<void> {
        try {
            await new Promise(resolve => setTimeout(resolve, 50));

            const activeView = this.app.workspace.getActiveViewOfType(ItemView);
            if (!activeView || activeView.getViewType() !== 'canvas') return;

            const freshCanvas = (activeView as any).canvas;
            if (!freshCanvas?.nodes) return;

            const parentNode = freshCanvas.nodes.get(parentNodeId);
            const childNode = freshCanvas.nodes.get(childNodeId);

            if (!parentNode || !childNode) return;

            // 计算新位置
            const newX = parentNode.x;
            let newY = parentNode.y + parentNode.height + 40;

            // 检查重叠
            const allNodes = Array.from(freshCanvas.nodes.values()) as any[];
            let hasOverlap = true;
            const minSpacing = 40;

            while (hasOverlap) {
                hasOverlap = false;
                for (const node of allNodes) {
                    if (node.id === parentNodeId || node.id === childNodeId) continue;

                    const nodeBottom = node.y + (node.height || 0);
                    const childBottom = newY + (childNode.height || 0);
                    const xOverlap = Math.abs(node.x - newX) < 50;
                    const yOverlap = (newY < nodeBottom + minSpacing) && (childBottom > node.y - minSpacing);

                    if (xOverlap && yOverlap) {
                        newY = nodeBottom + minSpacing;
                        hasOverlap = true;
                        break;
                    }
                }
            }

            // 移动节点及其子节点
            const nodesToMove = this.getNodeAndDescendants(childNodeId, freshCanvas);
            const deltaX = newX - childNode.x;
            const deltaY = newY - childNode.y;

            for (const nodeId of nodesToMove) {
                const node = freshCanvas.nodes.get(nodeId);
                if (!node) continue;

                node.x += deltaX;
                node.y += deltaY;
                if (typeof node.update === 'function') {
                    node.update();
                }
            }

            if (typeof freshCanvas.requestSave === 'function') {
                freshCanvas.requestSave();
            }
        } catch (err) {
            error('移动孤立节点失败:', err);
        }
    }

    private getNodeAndDescendants(nodeId: string, canvas: any): string[] {
        const result = [nodeId];
        const edges = canvas.edges instanceof Map ? Array.from(canvas.edges.values()) :
                     Array.isArray(canvas.edges) ? canvas.edges : [];

        for (const edge of edges) {
            const fromId = edge.from?.node?.id || edge.fromNode;
            const toId = edge.to?.node?.id || edge.toNode;
            if (fromId === nodeId && toId) {
                result.push(...this.getNodeAndDescendants(toId, canvas));
            }
        }

        return result;
    }

    // =========================================================================
    // 自动布局
    // =========================================================================
    async arrangeCanvas() {
        await this.layoutManager.arrangeCanvas();
    }

    private async autoArrangeAfterToggle(nodeId: string, canvasView: ItemView) {
        await this.layoutManager.autoArrangeAfterToggle(nodeId, canvasView);
    }

    // =========================================================================
    // 添加节点到 Canvas
    // =========================================================================
    async addNodeToCanvas(content: string, sourceFile: TFile | null) {
        if (!sourceFile) {
            new Notice('No file selected');
            return;
        }

        // 优先使用设置中的 canvas 文件路径
        let canvasFilePath: string | undefined = this.settings.canvasFilePath;
        
        // 如果设置中没有路径，再尝试获取当前打开的 canvas
        if (!canvasFilePath) {
            canvasFilePath = this.getCurrentCanvasFilePath();
        }
        
        if (!canvasFilePath) {
            new Notice('Please configure the canvas file path in settings or open a canvas file.');
            return;
        }

        const canvasFile = this.app.vault.getAbstractFileByPath(canvasFilePath);
        if (!(canvasFile instanceof TFile)) {
            new Notice(`Canvas file not found: ${canvasFilePath}`);
            return;
        }

        try {
            const canvasContent = await this.app.vault.read(canvasFile);
            let canvasData: any;
            try {
                canvasData = JSON.parse(canvasContent);
            } catch (parseError) {
                new Notice('Canvas文件格式错误，请检查文件内容');
                return;
            }
            
            if (!canvasData.nodes) canvasData.nodes = [];
            if (!canvasData.edges) canvasData.edges = [];

            const newNodeId = this.generateRandomId();
            const newNode: any = { id: newNodeId };

            // 检测公式
            const trimmedContent = content.trim();
            const formulaMatch = this.settings.enableFormulaDetection && 
                trimmedContent.startsWith('$$') && 
                trimmedContent.endsWith('$$') &&
                trimmedContent.length > 4;

            if (formulaMatch) {
                newNode.type = 'text';
                newNode.text = content;
                newNode.width = this.settings.formulaNodeWidth || 600;
                newNode.height = this.settings.formulaNodeHeight || 200;
            } else {
                // 检测图片
                const imageRegex = /!\[\[(.*?)\]\]|!\[.*?\]\((.*?)\)/;
                const imageMatch = content.match(imageRegex);

                if (imageMatch) {
                    const imagePath = imageMatch[1] || imageMatch[2];
                    newNode.type = 'file';
                    newNode.file = imagePath;
                    newNode.width = this.settings.imageNodeWidth || 400;
                    newNode.height = this.settings.imageNodeHeight || 300;
                } else {
                    newNode.type = 'text';
                    newNode.text = content;
                    newNode.width = this.settings.textNodeWidth || 250;
                    newNode.height = this.calculateTextNodeHeight(content);
                }
            }

            // 添加 fromLink
            const editor = this.app.workspace.getActiveViewOfType(ItemView)?.leaf?.view as any;
            if (editor?.editor) {
                const selection = editor.editor.listSelections()?.[0];
                if (selection) {
                    const from = selection.anchor.line < selection.head.line || 
                        (selection.anchor.line === selection.head.line && selection.anchor.ch < selection.head.ch) 
                        ? selection.anchor : selection.head;
                    const to = selection.anchor.line > selection.head.line || 
                        (selection.anchor.line === selection.head.line && selection.anchor.ch > selection.head.ch) 
                        ? selection.anchor : selection.head;
                    const fromLink = { file: sourceFile.path, from, to };
                    
                    try {
                        const fromLinkJson = JSON.stringify(fromLink);
                        if (newNode.type === 'text') {
                            newNode.text += `\n<!-- fromLink:${fromLinkJson} -->`;
                        } else {
                            newNode.color = `fromLink:${fromLinkJson}`;
                        }
                    } catch (jsonError) {}
                }
            }
            
            // 找到父节点（当前选中的节点或根节点）
            info(`开始添加新节点，内容长度: ${content.length}`);
            const parentNode = this.findParentNodeForNewNode(canvasData);
            
            if (parentNode) {
                info(`找到父节点: ${parentNode.id}, 位置: (${parentNode.x}, ${parentNode.y})`);
            } else {
                info('未找到父节点，将使用默认位置');
            }
            
            // 计算新节点位置（在父节点右侧，高度中心对齐，避免重叠）
            const position = this.calculateNewNodePositionWithParent(newNode, parentNode, canvasData);
            newNode.x = position.x;
            newNode.y = position.y;
            info(`新节点位置: (${newNode.x}, ${newNode.y})`);
            
            canvasData.nodes.push(newNode);
            info(`新节点已添加到 nodes 数组，当前节点数: ${canvasData.nodes.length}`);
            
            // 如果有父节点，添加连线
            if (parentNode) {
                const newEdge = {
                    id: this.generateRandomId(),
                    fromNode: parentNode.id,
                    toNode: newNodeId,
                    fromSide: "right",
                    toSide: "left"
                };
                canvasData.edges.push(newEdge);
                info(`已添加连线: ${parentNode.id} -> ${newNodeId}`);
            }

            await this.app.vault.modify(canvasFile, JSON.stringify(canvasData, null, 2));

            this.collapseStateManager.clearCache();
            this.checkAndAddCollapseButtons();
            this.scheduleButtonCheck();

            new Notice('Node added to canvas successfully!');
        } catch (e: any) {
            new Notice('Error processing canvas file.');
            error("Canvas Mindmap Build - Error:", e);
        }
    }

    // =========================================================================
    // 找到父节点（当前选中的节点或根节点）
    // =========================================================================
    private findParentNodeForNewNode(canvasData: any): any | null {
        const nodes = canvasData.nodes || [];
        if (nodes.length === 0) return null;
        
        // 尝试获取当前选中的节点
        const canvasView = this.getCanvasView();
        if (canvasView) {
            const canvas = (canvasView as any).canvas;
            if (canvas?.selection) {
                const selectedNodes = Array.from(canvas.selection.values()) as any[];
                if (selectedNodes.length > 0) {
                    // 找到选中的节点在文件数据中的对应节点
                    const selectedNodeId = selectedNodes[0].id;
                    const parentNode = nodes.find((n: any) => n.id === selectedNodeId);
                    if (parentNode) return parentNode;
                }
            }
        }
        
        // 如果没有选中的节点，找到根节点（没有父节点的节点）
        const edges = canvasData.edges || [];
        const childNodeIds = new Set(edges.map((e: any) => e.toNode || e.to?.node?.id));
        
        for (const node of nodes) {
            if (!childNodeIds.has(node.id)) {
                return node; // 返回第一个根节点
            }
        }
        
        // 如果没有根节点，返回第一个节点
        return nodes[0];
    }

    // =========================================================================
    // 计算新节点位置（在父节点右侧，高度中心对齐，避免重叠）
    // =========================================================================
    private calculateNewNodePositionWithParent(newNode: any, parentNode: any | null, canvasData: any): { x: number; y: number } {
        if (!parentNode) {
            return { x: 0, y: 0 };
        }
        
        // 使用设置中的间距参数
        const horizontalSpacing = this.settings.horizontalSpacing || 200;
        const verticalSpacing = this.settings.verticalSpacing || 40;
        
        const baseX = parentNode.x + (parentNode.width || 250) + horizontalSpacing;
        const parentCenterY = parentNode.y + (parentNode.height || 100) / 2;
        const newNodeHeight = newNode.height || 100;
        const baseY = parentCenterY - newNodeHeight / 2;
        
        // 获取父节点的所有子节点
        const edges = canvasData.edges || [];
        const childNodeIds = edges
            .filter((e: any) => (e.fromNode || e.from?.node?.id) === parentNode.id)
            .map((e: any) => e.toNode || e.to?.node?.id);
        
        const childNodes = (canvasData.nodes || []).filter((n: any) => childNodeIds.includes(n.id));
        debug(`父节点 ${parentNode.id} 已有 ${childNodes.length} 个子节点`);
        
        // 如果没有子节点，使用基础位置
        if (childNodes.length === 0) {
            debug(`使用基础位置: (${baseX}, ${baseY})，水平间距: ${horizontalSpacing}`);
            return { x: baseX, y: baseY };
        }
        
        // 找到最下方的子节点
        let lowestChild = childNodes[0];
        let maxBottom = childNodes[0].y + (childNodes[0].height || 100);
        
        for (const child of childNodes) {
            const childBottom = child.y + (child.height || 100);
            if (childBottom > maxBottom) {
                maxBottom = childBottom;
                lowestChild = child;
            }
        }
        
        // 新节点放在最下方子节点的下方
        const newY = maxBottom + verticalSpacing;
        debug(`新节点将放在最下方子节点 ${lowestChild.id} 的下方，Y: ${newY}，垂直间距: ${verticalSpacing}`);
        
        return { x: baseX, y: newY };
    }

    // =========================================================================
    // 辅助方法
    // =========================================================================
    private findParentNode(nodeId: string, edges: any[], allNodes: any[]): any | null {
        for (const edge of edges) {
            const fromId = edge.from?.node?.id || edge.fromNode;
            const toId = edge.to?.node?.id || edge.toNode;
            
            if (toId === nodeId) {
                const parentNode = allNodes.find((n: any) => n.id === fromId);
                if (parentNode) return parentNode;
            }
        }
        return null;
    }

    private async updateCanvasData(canvas: any, updateCallback: (data: any) => void) {
        let canvasFilePath: string | undefined;
        
        if (canvas.file?.path) {
            canvasFilePath = canvas.file.path;
        }
        
        if (!canvasFilePath) {
            const activeView = this.app.workspace.getActiveViewOfType(ItemView);
            if (activeView?.getViewType() === 'canvas' && (activeView as any).file) {
                canvasFilePath = (activeView as any).file.path;
            }
        }
        
        if (!canvasFilePath && this.settings.canvasFilePath) {
            canvasFilePath = this.settings.canvasFilePath;
        }
        
        if (!canvasFilePath) {
            throw new Error('无法获取Canvas文件路径');
        }
        
        const canvasFile = this.app.vault.getAbstractFileByPath(canvasFilePath);
        if (!(canvasFile instanceof TFile)) {
            throw new Error('Canvas file not found');
        }
        
        const canvasContent = await this.app.vault.read(canvasFile);
        const canvasData = JSON.parse(canvasContent);
        
        updateCallback(canvasData);
        
        await this.app.vault.modify(canvasFile, JSON.stringify(canvasData, null, 2));
        
        if (typeof canvas.reload === 'function') {
            canvas.reload();
        }
    }

    private getCanvasFilePath(canvasView: ItemView): string | undefined {
        if ((canvasView as any).canvas?.file?.path) {
            return (canvasView as any).canvas.file.path;
        }
        
        if ((canvasView as any).file?.path) {
            return (canvasView as any).file.path;
        }
        
        if (this.settings.canvasFilePath) {
            return this.settings.canvasFilePath;
        }
        
        return undefined;
    }

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
        const activeView = this.app.workspace.getActiveViewOfType(ItemView);
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

    private getNodeIdFromElement(el: Element, canvas: any): string | null {
        const dataNodeId = el.getAttribute('data-node-id');
        if (dataNodeId) return dataNodeId;

        const nodes = Array.from(canvas.nodes.values()) as any[];
        for (const node of nodes) {
            if (node.nodeEl === el || el.contains(node.nodeEl)) {
                return node.id;
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

    private syncHiddenChildrenOnDrag(parentNode: any, canvas: any) {
        // 简化版本：不跟踪偏移量，只确保折叠状态正确
    }

    private applyCollapseState(nodeId: string, canvas: any, isCollapsed: boolean) {
        if (!canvas?.nodes) return;
        
        if (isCollapsed) {
            this.collapseNodeWithoutSaving(nodeId, canvas);
        } else {
            this.expandNodeWithoutSaving(nodeId, canvas);
        }
    }

    private collapseNodeWithoutSaving(nodeId: string, canvas: any) {
        let edges: any[] = [];
        if (canvas.fileData?.edges) edges = canvas.fileData.edges;
        if (canvas.edges) edges = Array.from(canvas.edges.values());
        
        const allNodes = Array.from(canvas.nodes.values()) as any[];
        const childNodeIds = this.collapseStateManager.getChildNodes(nodeId, edges);
        if (childNodeIds.length === 0) return;

        const nodesToHide = new Set<string>();
        
        const collectDescendants = (parentId: string) => {
            const directChildren = this.collapseStateManager.getChildNodes(parentId, edges);
            for (const childId of directChildren) {
                if (!nodesToHide.has(childId)) {
                    nodesToHide.add(childId);
                    collectDescendants(childId);
                }
            }
        };
        
        for (const childId of childNodeIds) {
            nodesToHide.add(childId);
            collectDescendants(childId);
        }

        for (const id of nodesToHide) {
            const node = allNodes.find((n: any) => n.id === id);
            if (node?.nodeEl) {
                (node.nodeEl as HTMLElement).style.display = 'none';
            }
        }

        const hiddenEdges: any[] = [];
        for (const id of nodesToHide) {
            for (const edge of edges) {
                const fromId = edge.from?.node?.id || edge.fromNode;
                const toId = edge.to?.node?.id || edge.toNode;
                if (fromId === id || toId === id) {
                    if (!hiddenEdges.includes(edge)) hiddenEdges.push(edge);
                }
            }
        }

        for (const edge of hiddenEdges) {
            if (edge.lineGroupEl) {
                (edge.lineGroupEl as HTMLElement).style.display = 'none';
            }
            if (edge.lineEndGroupEl) {
                (edge.lineEndGroupEl as HTMLElement).style.display = 'none';
            }
        }

        this.collapseStateManager.markCollapsed(nodeId);
        this.updateCollapseButtonState(nodeId, true);
    }

    private expandNodeWithoutSaving(nodeId: string, canvas: any) {
        let edges: any[] = [];
        if (canvas.fileData?.edges) edges = canvas.fileData.edges;
        if (canvas.edges) edges = Array.from(canvas.edges.values());
        
        const allNodes = Array.from(canvas.nodes.values()) as any[];
        const childNodeIds = this.collapseStateManager.getChildNodes(nodeId, edges);

        const nodesToShow = new Set<string>();
        
        const collectAllDescendants = (parentId: string) => {
            const directChildren = this.collapseStateManager.getChildNodes(parentId, edges);
            for (const childId of directChildren) {
                if (!nodesToShow.has(childId)) {
                    nodesToShow.add(childId);
                    collectAllDescendants(childId);
                }
            }
        };
        
        for (const childId of childNodeIds) {
            nodesToShow.add(childId);
            collectAllDescendants(childId);
        }

        for (const id of nodesToShow) {
            const node = allNodes.find((n: any) => n.id === id);
            if (node?.nodeEl) {
                (node.nodeEl as HTMLElement).style.display = '';
            }
        }

        const shownEdges: any[] = [];
        for (const childId of childNodeIds) {
            const edge = edges.find((e: any) => {
                const fromId = e.from?.node?.id || e.fromNode;
                const toId = e.to?.node?.id || e.toNode;
                return fromId === nodeId && toId === childId;
            });
            if (edge && !shownEdges.includes(edge)) shownEdges.push(edge);
        }

        for (const edge of shownEdges) {
            if (edge.lineGroupEl) {
                (edge.lineGroupEl as HTMLElement).style.display = '';
            }
            if (edge.lineEndGroupEl) {
                (edge.lineEndGroupEl as HTMLElement).style.display = '';
            }
        }

        this.collapseStateManager.markExpanded(nodeId);
        this.updateCollapseButtonState(nodeId, false);
    }

    private async saveCollapseStateToCanvasFile(nodeId: string, isCollapsed: boolean, canvas: any) {
        try {
            let canvasFilePath: string | undefined;
            
            if (canvas.file?.path) {
                canvasFilePath = canvas.file.path;
            }
            
            if (!canvasFilePath) {
                const activeView = this.app.workspace.getActiveViewOfType(ItemView);
                if (activeView?.getViewType() === 'canvas' && (activeView as any).file) {
                    canvasFilePath = (activeView as any).file.path;
                }
            }
            
            if (!canvasFilePath && this.settings.canvasFilePath) {
                canvasFilePath = this.settings.canvasFilePath;
            }
            
            if (!canvasFilePath) return;
            
            const canvasFile = this.app.vault.getAbstractFileByPath(canvasFilePath);
            if (!(canvasFile instanceof TFile)) return;
            
            const canvasContent = await this.app.vault.read(canvasFile);
            const canvasData = JSON.parse(canvasContent);
            
            if (!canvasData.metadata) canvasData.metadata = {};
            if (!canvasData.metadata.collapseStates) canvasData.metadata.collapseStates = {};
            
            if (isCollapsed) {
                canvasData.metadata.collapseStates[nodeId] = true;
            } else {
                delete canvasData.metadata.collapseStates[nodeId];
            }
            
            await this.app.vault.modify(canvasFile, JSON.stringify(canvasData, null, 2));
            
            info(`保存折叠状态到Canvas文件: 节点 ${nodeId} ${isCollapsed ? '已折叠' : '已展开'}`);
            
        } catch (err) {
            error(`保存折叠状态失败: ${err}`);
        }
    }

    private async loadCollapseStateFromCanvasFile() {
        // 防止重复加载
        if (this.isLoadingCollapseState) {
            debug('折叠状态正在加载中，跳过重复请求');
            return;
        }
        
        try {
            this.isLoadingCollapseState = true;
            
            // 优先获取当前打开的 canvas 文件路径
            let canvasFilePath = this.getCurrentCanvasFilePath();
            
            // 如果没有当前打开的 canvas，再使用设置中的路径
            if (!canvasFilePath) {
                canvasFilePath = this.settings.canvasFilePath;
            }
            
            if (!canvasFilePath) {
                this.isLoadingCollapseState = false;
                return;
            }
            
            // 如果已经加载过这个 canvas，跳过（除非强制刷新）
            if (this.lastLoadedCanvasPath === canvasFilePath) {
                debug(`Canvas ${canvasFilePath} 的折叠状态已经加载过，跳过`);
                this.isLoadingCollapseState = false;
                return;
            }
            
            const canvasFile = this.app.vault.getAbstractFileByPath(canvasFilePath);
            if (!(canvasFile instanceof TFile)) {
                this.isLoadingCollapseState = false;
                return;
            }
            
            const canvasContent = await this.app.vault.read(canvasFile);
            const canvasData = JSON.parse(canvasContent);
            
            if (canvasData.metadata?.collapseStates) {
                this.collapseStateManager.clearCache();
                
                for (const [nodeId, isCollapsed] of Object.entries(canvasData.metadata.collapseStates)) {
                    if (isCollapsed === true) {
                        this.collapseStateManager.markCollapsed(nodeId);
                    }
                }
                
                this.lastLoadedCanvasPath = canvasFilePath;
                info('从Canvas文件加载折叠状态完成');
            }
            
        } catch (err) {
            error(`加载折叠状态失败: ${err}`);
        } finally {
            this.isLoadingCollapseState = false;
        }
    }
    
    // 重置加载状态，用于切换 canvas 时调用
    public resetCollapseStateLoading() {
        this.lastLoadedCanvasPath = null;
        this.isLoadingCollapseState = false;
    }

    private calculateTextNodeHeight(content: string): number {
        const minHeight = 30;
        const maxHeight = this.settings.textNodeMaxHeight || 800;
        const nodeWidth = this.settings.textNodeWidth || 400;

        // 使用设置中的节点宽度来计算每行字符数
        const avgCharWidth = 9.5; // 稍微增加字符宽度估算
        const charsPerLine = Math.floor((nodeWidth - 22) / avgCharWidth); // 稍微减小内边距

        const lineHeight = 18; // 减小行高
        const verticalPadding = 11; // 减小上下内边距

        const chineseCharRegex = /[\u4e00-\u9fa5]/;
        let numLines = 0;
        const lines = content.split('\n');

        for (const line of lines) {
            const trimmedLine = line.trim();

            if (trimmedLine === '') {
                // 空行也算一行，但高度较小
                numLines += 0.2;
                continue;
            }

            let lineLength = 0;
            // 移除 Markdown 标记后计算长度
            const cleanLine = trimmedLine
                .replace(/^#{1,6}\s+/, '') // 移除标题标记
                .replace(/\*\*|\*|__|_|`|\[|\]|\(|\)/g, ''); // 移除格式标记

            for (const char of cleanLine) {
                // 中文字符占2个宽度单位，英文占1个
                lineLength += chineseCharRegex.test(char) ? 2 : 1;
            }

            // 计算这行需要多少行显示
            const linesNeeded = Math.ceil(lineLength / charsPerLine);
            numLines += Math.max(linesNeeded, 1);
        }

        const calculatedHeight = Math.ceil((numLines * lineHeight) + verticalPadding);
        return Math.max(minHeight, Math.min(calculatedHeight, maxHeight));
    }

    // =========================================================================
    // 调整所有文本节点高度
    // =========================================================================
    public async adjustAllTextNodeHeights(): Promise<void> {
        try {
            const canvasFilePath = this.getCurrentCanvasFilePath();
            if (!canvasFilePath) {
                new Notice('No canvas file is currently open.');
                return;
            }

            const canvasFile = this.app.vault.getAbstractFileByPath(canvasFilePath);
            if (!(canvasFile instanceof TFile)) {
                new Notice('Canvas file not found.');
                return;
            }

            info(`开始调整所有文本节点高度: ${canvasFilePath}`);
            const canvasContent = await this.app.vault.read(canvasFile);
            const canvasData = JSON.parse(canvasContent);

            if (!canvasData.nodes) {
                new Notice('No nodes found in canvas.');
                return;
            }

            debug(`总共 ${canvasData.nodes.length} 个节点`);

            const maxHeight = this.settings.textNodeMaxHeight || 800;
            const textNodeWidth = this.settings.textNodeWidth || 400;
            let adjustedCount = 0;
            let skippedCount = 0;

            for (const node of canvasData.nodes) {
                debug(`检查节点 ${node.id}: type=${node.type}, hasText=${!!node.text}`);
                
                // 只处理文本节点（没有 media 或 attachment 类型的节点）
                if (!node.type || node.type === 'text' || node.type === 'file') {
                    // 如果节点有文本内容
                    if (node.text) {
                        // 检测是否是公式节点（使用正则表达式，支持换行和fromLink注释）
                        const trimmedContent = node.text.trim();
                        // 公式以 $$ 开头和结尾，后面可能有 fromLink 注释
                        const isFormula = this.settings.enableFormulaDetection && 
                            /^\$\$[\s\S]*?\$\$\s*(<!-- fromLink:[\s\S]*?-->)?\s*$/.test(trimmedContent);
                        
                        const contentPreview = trimmedContent.length > 60 
                            ? `${trimmedContent.substring(0, 30)}...${trimmedContent.substring(trimmedContent.length - 30)}`
                            : trimmedContent;
                        debug(`节点 ${node.id}: 内容="${contentPreview}", isFormula=${isFormula}`);
                        
                        let newHeight: number;
                        
                        if (isFormula) {
                            // 公式节点使用固定高度和宽度
                            newHeight = this.settings.formulaNodeHeight || 80;
                            node.width = this.settings.formulaNodeWidth || 400;
                            debug(`节点 ${node.id}: 公式节点，设置高度=${newHeight}, 宽度=${node.width}`);
                        } else {
                            // 普通文本节点根据内容计算高度
                            const calculatedHeight = this.calculateTextNodeHeight(node.text);
                            newHeight = Math.min(calculatedHeight, maxHeight);
                            debug(`节点 ${node.id}: 普通文本节点，计算高度=${calculatedHeight}, 最终高度=${newHeight}`);
                        }
                        
                        if (node.height !== newHeight) {
                            debug(`节点 ${node.id}: 高度从 ${node.height} 调整为 ${newHeight}`);
                            node.height = newHeight;
                            adjustedCount++;
                        } else {
                            debug(`节点 ${node.id}: 高度未变化 (${node.height})`);
                            skippedCount++;
                        }
                    } else {
                        debug(`节点 ${node.id}: 无文本内容，跳过`);
                    }
                } else {
                    debug(`节点 ${node.id}: 非文本节点 (type=${node.type})，跳过`);
                }
            }

            await this.app.vault.modify(canvasFile, JSON.stringify(canvasData, null, 2));
            
            // 重新加载 canvas 以应用更改
            const canvasView = this.getCanvasView();
            if (canvasView) {
                const canvas = (canvasView as any).canvas;
                if (canvas) {
                    // 尝试多种方式刷新 canvas
                    if (typeof canvas.reload === 'function') {
                        canvas.reload();
                    } else if (typeof canvas.requestSave === 'function') {
                        canvas.requestSave();
                    } else if (typeof canvas.update === 'function') {
                        canvas.update();
                    }
                    
                    // 强制刷新视图
                    setTimeout(() => {
                        if (canvasView && typeof (canvasView as any).reload === 'function') {
                            (canvasView as any).reload();
                        }
                    }, 100);
                }
            }

            new Notice(`Adjusted ${adjustedCount} nodes, skipped ${skippedCount} nodes.`);
            info(`调整了 ${adjustedCount} 个节点，跳过了 ${skippedCount} 个节点`);
        } catch (err) {
            error(`调整节点高度失败: ${err}`);
            new Notice('Failed to adjust node heights.');
        }
    }

    private generateRandomId(): string {
        return Math.random().toString(36).substring(2, 10);
    }

    // =========================================================================
    // 卸载
    // =========================================================================
    unload() {
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }
        
        this.resizeObservers.forEach(observer => observer.disconnect());
        this.resizeObservers.clear();
        
        const buttons = document.querySelectorAll('.cmb-collapse-button');
        buttons.forEach(btn => btn.remove());
    }
}
