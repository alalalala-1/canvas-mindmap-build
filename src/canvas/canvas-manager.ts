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
import { log } from '../utils/logger';
import {
    getCanvasView,
    getCurrentCanvasFilePath,
    readCanvasData,
    writeCanvasData,
    isFormulaContent
} from '../utils/canvas-utils';

import { VisibilityService } from './services/visibility-service';
import { LayoutDataProvider } from './services/layout-data-provider';

export class CanvasManager {
    private plugin: Plugin;
    private app: App;
    private settings: CanvasMindmapBuildSettings;
    private collapseStateManager: CollapseStateManager;
    private canvasFileService: CanvasFileService;
    private visibilityService: VisibilityService;
    private layoutDataProvider: LayoutDataProvider;
    private layoutManager: LayoutManager;
    private eventManager: CanvasEventManager;
    private nodeManager: CanvasNodeManager;
    private uiManager: CanvasUIManager;
    private floatingNodeService: FloatingNodeService;
    private edgeDeletionService: EdgeDeletionService;
    private buttonCheckTimeoutId: number | null = null;

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
        this.visibilityService = new VisibilityService(collapseStateManager);
        this.layoutDataProvider = new LayoutDataProvider(app, this.canvasFileService, this.visibilityService);

        // 2. 初始化功能模块，注入底层服务
        this.layoutManager = new LayoutManager(
            plugin,
            app,
            settings,
            collapseStateManager,
            this.canvasFileService,
            this.visibilityService,
            this.layoutDataProvider
        );
        this.floatingNodeService = new FloatingNodeService(app, settings);
        this.floatingNodeService.setCanvasManager(this);
        this.eventManager = new CanvasEventManager(plugin, app, settings, collapseStateManager, this);
        this.nodeManager = new CanvasNodeManager(app, plugin, settings, collapseStateManager, this.canvasFileService);
        this.nodeManager.setCanvasManager(this);
        this.uiManager = new CanvasUIManager(app, settings, collapseStateManager);
        this.edgeDeletionService = new EdgeDeletionService(app, plugin, settings, this.canvasFileService, this.floatingNodeService);
        this.edgeDeletionService.setCanvasManager(this);

        // 设置 LayoutManager 的 FloatingNodeService（使用同一个实例）
        this.layoutManager.setFloatingNodeService(this.floatingNodeService);
        this.layoutManager.setCanvasManager(this);

        log('[Manager] 实例化');
    }

    // =========================================================================
    // 初始化
    // =========================================================================
    initialize() {
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

    public async adjustAllTextNodeHeights(): Promise<number> {
        return await this.nodeManager.adjustAllTextNodeHeights();
    }

    async deleteSelectedEdge() {
        await this.edgeDeletionService.deleteSelectedEdge();
    }

    // =========================================================================
    // 公共接口方法供事件管理器调用
    // =========================================================================
    public async checkAndAddCollapseButtons() {
        // 防抖：如果已有待执行的检查，取消之前的
        if (this.buttonCheckTimeoutId !== null) {
            clearTimeout(this.buttonCheckTimeoutId);
        }
        
        // 延迟执行，避免短时间内多次调用
        this.buttonCheckTimeoutId = window.setTimeout(async () => {
            this.buttonCheckTimeoutId = null;
            await this.uiManager.checkAndAddCollapseButtons();
        }, 50); // 50ms 防抖延迟
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
        // 现在 checkAndAddCollapseButtons 已有防抖机制，直接调用即可
        await this.checkAndAddCollapseButtons();
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
}
