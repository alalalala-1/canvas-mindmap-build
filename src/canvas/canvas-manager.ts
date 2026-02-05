import { App, ItemView, Notice, Plugin, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../settings/types';
import { CollapseStateManager } from '../state/collapse-state';
import { LayoutManager } from './layout-manager';
import { CanvasEventManager } from './canvas-event-manager';
import { CanvasNodeManager } from './canvas-node-manager';
import { CanvasUIManager } from './canvas-ui-manager';
import { FloatingNodeManager } from './floating-node-manager';
import { debug, info, warn, error } from '../utils/logger';

export class CanvasManager {
    private plugin: Plugin;
    private app: App;
    private settings: CanvasMindmapBuildSettings;
    private collapseStateManager: CollapseStateManager;
    private layoutManager: LayoutManager;
    private eventManager: CanvasEventManager;
    private nodeManager: CanvasNodeManager;
    private uiManager: CanvasUIManager;
    private floatingNodeManager: FloatingNodeManager;
    private isLoadingCollapseState = false;
    private lastLoadedCanvasPath: string | null = null;

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
        this.floatingNodeManager = new FloatingNodeManager(app, settings);
        this.eventManager = new CanvasEventManager(plugin, app, settings, collapseStateManager, this.floatingNodeManager, this);
        this.nodeManager = new CanvasNodeManager(app, settings, collapseStateManager);
        this.uiManager = new CanvasUIManager(app, settings, collapseStateManager);
        debug('CanvasManager 实例化完成');
    }

    // =========================================================================
    // 初始化
    // =========================================================================
    initialize() {
        debug('初始化 Canvas 管理器');
        this.eventManager.initialize();
    }

    // =========================================================================
    // 公共接口方法
    // =========================================================================
    async arrangeCanvas() {
        await this.layoutManager.arrangeCanvas();
    }

    async addNodeToCanvas(content: string, sourceFile: TFile | null) {
        await this.nodeManager.addNodeToCanvas(content, sourceFile);
    }

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

    // =========================================================================
    // 公共接口方法供事件管理器调用
    // =========================================================================
    public async checkAndAddCollapseButtons() {
        await this.uiManager.checkAndAddCollapseButtons();
    }

    public async toggleNodeCollapse(nodeId: string) {
        const canvasView = this.getCanvasView();
        if (!canvasView) return;
        
        const canvas = (canvasView as any).canvas;
        if (!canvas) return;

        await this.layoutManager.toggleNodeCollapse(nodeId, canvas);
    }

    public async syncHiddenChildrenOnDrag(node: any) {
        await this.layoutManager.syncHiddenChildrenOnDrag(node);
    }

    public async scheduleButtonCheck() {
        setTimeout(() => {
            this.checkAndAddCollapseButtons();
        }, 100);
    }

    public async adjustNodeHeightAfterRender(nodeId: string) {
        // 这里可以实现单个节点高度调整
        await this.adjustAllTextNodeHeights();
    }

    public async checkAndClearFloatingStateForNewEdges() {
        const canvasView = this.getCanvasView();
        if (!canvasView) return;
        
        const canvas = (canvasView as any).canvas;
        if (!canvas) return;

        await this.floatingNodeManager.checkAndClearFloatingStateForNewEdges(canvas);
    }

    // =========================================================================
    // 启动边变化检测轮询 - 当有浮动节点时调用
    // =========================================================================
    public startEdgeChangeDetectionForFloatingNodes(canvas: any) {
        // 通过 eventManager 启动轮询
        this.eventManager.startEdgeChangeDetection(canvas);
    }

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

            // 获取当前 canvas 视图中已渲染的节点 DOM 元素映射
            const canvasView = this.getCanvasView();
            const canvas = canvasView ? (canvasView as any).canvas : null;
            const nodeDomMap = new Map<string, Element>();
            
            if (canvas?.nodes) {
                for (const [nodeId, nodeData] of canvas.nodes) {
                    if (nodeData?.nodeEl) {
                        nodeDomMap.set(nodeId, nodeData.nodeEl);
                    }
                }
            }
            
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
                            // 尝试获取对应的 DOM 元素以获取实际渲染样式
                            const nodeEl = nodeDomMap.get(node.id);
                            const calculatedHeight = this.calculateTextNodeHeight(node.text, nodeEl);
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
            const canvasViewForReload = this.getCanvasView();
            if (canvasViewForReload) {
                const canvasForReload = (canvasViewForReload as any).canvas;
                if (canvasForReload) {
                    // 尝试多种方式刷新 canvas
                    if (typeof canvasForReload.reload === 'function') {
                        canvasForReload.reload();
                    } else if (typeof canvasForReload.requestSave === 'function') {
                        canvasForReload.requestSave();
                    } else if (typeof canvasForReload.update === 'function') {
                        canvasForReload.update();
                    }
                    
                    // 强制刷新视图
                    setTimeout(() => {
                        if (canvasViewForReload && typeof (canvasViewForReload as any).reload === 'function') {
                            (canvasViewForReload as any).reload();
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

    // =========================================================================
    // 卸载
    // =========================================================================
    unload() {
        this.eventManager.unload();
        this.uiManager.unload();
    }

    // =========================================================================
    // 辅助方法（保持向后兼容）
    // =========================================================================
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

            // 从 Canvas 内存中删除边（如果存在）
            if (canvas.edges && edge.id) {
                const edgeId = edge.id;
                if (canvas.edges.has(edgeId)) {
                    canvas.edges.delete(edgeId);
                    info(`已从 Canvas 内存中删除边: ${edgeId}`);
                }
                // 同时清理选中状态
                if (canvas.selectedEdge === edge) {
                    canvas.selectedEdge = null;
                }
                if (canvas.selectedEdges) {
                    const index = canvas.selectedEdges.indexOf(edge);
                    if (index > -1) {
                        canvas.selectedEdges.splice(index, 1);
                    }
                }
            }

            // 标记孤立节点为浮动状态（红色边框），不移动位置
            if (childNodeId && parentNodeId) {
                info(`标记孤立节点 ${childNodeId} 为浮动状态，原父节点: ${parentNodeId}`);
                // 不要重新加载 canvas，而是直接标记浮动状态
                // 延迟稍短一些，给DOM更新时间
                setTimeout(() => {
                    this.floatingNodeManager.markNodeAsFloating(childNodeId, canvas, parentNodeId);
                    // 标记浮动状态后，启动边变化检测轮询
                    // 这样当用户手动连接边时，可以自动清除浮动状态
                    this.startEdgeChangeDetectionForFloatingNodes(canvas);
                }, 100);
            }

            // 触发UI更新（而不是重新加载整个canvas）
            if (typeof canvas.requestUpdate === 'function') {
                canvas.requestUpdate();
            }
            if (canvas.requestSave) {
                canvas.requestSave();
            }

            new Notice('Edge deleted successfully');
            info('边删除成功');
        } catch (err) {
            error('删除边失败:', err);
            new Notice('Failed to delete edge');
        }
    }

    private calculateTextNodeHeight(content: string, nodeEl?: Element): number {
        const maxHeight = this.settings.textNodeMaxHeight || 800;
        const nodeWidth = this.settings.textNodeWidth || 400;

        // 如果有 DOM 元素，尝试直接测量内容的实际高度
        if (nodeEl) {
            const measuredHeight = this.measureActualContentHeight(nodeEl, content);
            debug(`calculateTextNodeHeight: nodeEl存在, 测量高度=${measuredHeight}`);
            if (measuredHeight > 0) {
                return Math.min(measuredHeight, maxHeight);
            }
            debug(`测量失败，回退到计算方式`);
        } else {
            debug(`calculateTextNodeHeight: nodeEl不存在，使用计算方式`);
        }

        // 回退到计算方式
        const computedHeight = this.calculateTextNodeHeightComputed(content, nodeWidth);
        debug(`计算方式得到高度=${computedHeight}`);
        return computedHeight;
    }

    /**
     * 直接测量 DOM 中内容的实际高度
     */
    private measureActualContentHeight(nodeEl: Element, content: string): number {
        try {
            const contentEl = nodeEl.querySelector('.canvas-node-content') as HTMLElement;
            const sizerEl = nodeEl.querySelector('.markdown-preview-sizer') as HTMLElement;

            // 方法1：直接读取 sizer 的 min-height（Obsidian 计算的内容实际高度）
            if (sizerEl) {
                const sizerMinHeightStyle = sizerEl.style.minHeight;
                if (sizerMinHeightStyle) {
                    const parsedMinHeight = parseFloat(sizerMinHeightStyle);
                    if (!isNaN(parsedMinHeight) && parsedMinHeight > 0) {
                        debug(`measureActualContentHeight: sizer min-height=${parsedMinHeight}`);
                        return Math.ceil(parsedMinHeight + 24);
                    }
                }
            }

            // 方法2：通过实际渲染的段落计算
            if (contentEl) {
                const pElement = contentEl.querySelector('p');
                if (pElement) {
                    const pRect = pElement.getBoundingClientRect();
                    const pStyles = window.getComputedStyle(pElement);
                    const lineHeight = parseFloat(pStyles.lineHeight) || 24;
                    
                    // 计算实际渲染的行数
                    const actualLines = Math.max(1, Math.round(pRect.height / lineHeight));
                    
                    // 获取内边距
                    const styles = window.getComputedStyle(contentEl);
                    const paddingTop = parseFloat(styles.paddingTop) || 8;
                    const paddingBottom = parseFloat(styles.paddingBottom) || 8;

                    const calculatedHeight = Math.ceil(actualLines * lineHeight + paddingTop + paddingBottom + 20);
                    debug(`measureActualContentHeight: 实际段落高度=${pRect.height}, 行数=${actualLines}, 行高=${lineHeight}, 计算高度=${calculatedHeight}`);
                    return calculatedHeight;
                }
            }

            // 方法3：使用 sizer 的 scrollHeight
            if (sizerEl) {
                const scrollHeight = sizerEl.scrollHeight;
                if (scrollHeight > 20) {
                    return Math.ceil(scrollHeight + 24);
                }

                // 备选：使用 getBoundingClientRect
                const rect = sizerEl.getBoundingClientRect();
                if (rect.height > 0) {
                    return Math.ceil(rect.height + 24);
                }
            }

            // 方法4：使用 contentEl 的 scrollHeight
            if (contentEl) {
                const styles = window.getComputedStyle(contentEl);
                const paddingTop = parseFloat(styles.paddingTop) || 8;
                const paddingBottom = parseFloat(styles.paddingBottom) || 8;
                const scrollHeight = contentEl.scrollHeight;
                if (scrollHeight > 20) {
                    return Math.ceil(scrollHeight + paddingTop + paddingBottom);
                }
            }

            // 最后备选：使用 node 宽度计算
            const nodeWidth = nodeEl.clientWidth || 400;
            return this.calculateTextNodeHeightComputed(content, nodeWidth);
        } catch (e) {
            debug(`measureActualContentHeight 异常: ${e}`);
        }
        return 0;
    }

    /**
     * 基于计算的高度估算（当无法测量 DOM 时使用）
     * 使用更保守的估计，确保内容不被截断
     */
    private calculateTextNodeHeightComputed(content: string, nodeWidth: number): number {
        const maxHeight = this.settings.textNodeMaxHeight || 800;

        // 内容区域可用宽度（更保守，考虑内边距）
        const contentWidth = nodeWidth - 40;

        // 默认字体参数 - 使用更保守的估计
        const fontSize = 14;
        const lineHeight = 26; // 进一步增加行高估计

        // 估算行数（使用更保守的字符宽度）
        const chineseCharRegex = /[\u4e00-\u9fa5]/;
        let totalLines = 0;
        const textLines = content.split('\n');

        for (const line of textLines) {
            const trimmedLine = line.trim();
            if (trimmedLine === '') {
                totalLines += 0.5;
                continue;
            }

            // 清理 Markdown 标记
            const cleanLine = trimmedLine
                .replace(/^#{1,6}\s+/, '')
                .replace(/\*\*|\*|__|_|`/g, '');

            // 更保守的像素宽度估算
            let pixelWidth = 0;
            for (const char of cleanLine) {
                if (chineseCharRegex.test(char)) {
                    pixelWidth += fontSize * 1.15; // 中文字符更宽
                } else {
                    pixelWidth += fontSize * 0.6; // 英文字符也更宽
                }
            }

            // 向上取整并增加额外行数缓冲
            const linesNeeded = Math.ceil(pixelWidth / contentWidth);
            totalLines += Math.max(1, linesNeeded);
        }

        // 计算高度（增加更多安全边距）
        const safetyPadding = 44; // 进一步增加安全边距
        const calculatedHeight = Math.ceil(totalLines * lineHeight + safetyPadding);
        const minHeight = 60;

        debug(`calculateTextNodeHeightComputed: 行数=${totalLines}, 行高=${lineHeight}, 高度=${calculatedHeight}`);

        return Math.max(minHeight, Math.min(calculatedHeight, maxHeight));
    }

    private textMeasureCanvas: HTMLCanvasElement | null = null;
}