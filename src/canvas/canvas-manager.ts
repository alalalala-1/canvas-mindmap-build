import { App, ItemView, Notice, Plugin, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../settings/types';
import { CollapseStateManager } from '../state/collapse-state';
import { LayoutManager } from './layout-manager';
import { CanvasEventManager } from './canvas-event-manager';
import { CanvasNodeManager } from './canvas-node-manager';
import { CanvasUIManager } from './canvas-ui-manager';
import { FloatingNodeService } from './services/floating-node-service';
import { CanvasFileService } from './services/canvas-file-service';
import { EdgeDeletionService } from './services/edge-deletion-service';
import { debug, info, warn, error } from '../utils/logger';
import {
    getCanvasView,
    getCurrentCanvasFilePath,
    readCanvasData,
    writeCanvasData,
    isFormulaContent
} from '../utils/canvas-utils';

export class CanvasManager {
    private plugin: Plugin;
    private app: App;
    private settings: CanvasMindmapBuildSettings;
    private collapseStateManager: CollapseStateManager;
    private canvasFileService: CanvasFileService;
    private layoutManager: LayoutManager;
    private eventManager: CanvasEventManager;
    private nodeManager: CanvasNodeManager;
    private uiManager: CanvasUIManager;
    private floatingNodeService: FloatingNodeService;
    private edgeDeletionService: EdgeDeletionService;

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
        
        // 1. 初始化底层服务
        this.canvasFileService = new CanvasFileService(app, settings);
        
        // 2. 初始化功能模块，注入底层服务
        this.layoutManager = new LayoutManager(plugin, app, settings, collapseStateManager, this.canvasFileService);
        this.floatingNodeService = new FloatingNodeService(app, settings);
        this.eventManager = new CanvasEventManager(plugin, app, settings, collapseStateManager, this);
        this.nodeManager = new CanvasNodeManager(app, plugin, settings, collapseStateManager, this.canvasFileService);
        this.nodeManager.setCanvasManager(this);
        this.uiManager = new CanvasUIManager(app, settings, collapseStateManager);
        this.edgeDeletionService = new EdgeDeletionService(app, plugin, settings, this.canvasFileService, this.floatingNodeService);

        // 设置 LayoutManager 的 FloatingNodeService（使用同一个实例）
        this.layoutManager.setFloatingNodeService(this.floatingNodeService);

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

    public async addNodeToCanvas(content: string, sourceFile: TFile | null) {
        await this.nodeManager.addNodeToCanvas(content, sourceFile);
    }

    public async adjustNodeHeightAfterRender(nodeId: string) {
        await this.nodeManager.adjustNodeHeightAfterRender(nodeId);
    }

    public async adjustAllTextNodeHeights(): Promise<void> {
        await this.nodeManager.adjustAllTextNodeHeights();
    }

    async deleteSelectedEdge() {
        await this.edgeDeletionService.deleteSelectedEdge();
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

    public async checkAndClearFloatingStateForNewEdges() {
        const canvasView = this.getCanvasView();
        if (!canvasView) return;

        const canvas = (canvasView as any).canvas;
        if (!canvas) return;

        // 使用新的服务强制检测边变化
        this.floatingNodeService.forceEdgeDetection(canvas);
    }

    // =========================================================================
    // 启动边变化检测轮询 - 当有浮动节点时调用
    // =========================================================================
    public startEdgeChangeDetectionForFloatingNodes(canvas: any) {
        // 边变化检测已经在 FloatingNodeService.initialize 中启动
        // 这里不需要重复启动
        info('[CanvasManager] 边变化检测已在 FloatingNodeService 中启动，跳过');
    }

    // =========================================================================
    // 获取浮动节点服务
    // =========================================================================
    public getFloatingNodeService(): FloatingNodeService {
        return this.floatingNodeService;
    }

    // =========================================================================
    // 卸载
    // =========================================================================
    unload() {
        this.eventManager.unload();
        this.uiManager.unload();
        // 清理浮动节点服务的资源
        this.floatingNodeService.cleanup();
    }

    // =========================================================================
    // 辅助方法（使用 canvas-utils）
    // =========================================================================
    private getCanvasView(): ItemView | null {
        return getCanvasView(this.app);
    }

    private getCurrentCanvasFilePath(): string | undefined {
        return getCurrentCanvasFilePath(this.app);
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