import { App, ItemView, Plugin, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../settings/types';
import { CollapseStateManager } from '../state/collapse-state';
import { LayoutManager } from './layout-manager';
import { CanvasEventManager } from './canvas-event-manager';
import { CanvasNodeManager } from './canvas-node-manager';
import { CanvasUIManager } from './canvas-ui-manager';
import { FloatingNodeService } from './services/floating-node-service';
import { CanvasFileService } from './services/canvas-file-service';
import { EdgeDeletionService } from './services/edge-deletion-service';
import { FromLinkRepairService } from './services/fromlink-repair-service';
import { NodeOrderService } from './services/node-order-service';
import { log } from '../utils/logger';
import {
    getCanvasView
} from '../utils/canvas-utils';

import { VisibilityService } from './services/visibility-service';
import { LayoutDataProvider } from './services/layout-data-provider';
import { ICanvasManager, CanvasViewLike, CanvasNodeLike, CanvasLike } from './types';

export class CanvasManager implements ICanvasManager {
    private plugin: Plugin;
    private app: App;
    private settings: CanvasMindmapBuildSettings;
    public readonly collapseStateManager: CollapseStateManager;
    private canvasFileService: CanvasFileService;
    private visibilityService: VisibilityService;
    private layoutDataProvider: LayoutDataProvider;
    private layoutManager: LayoutManager;
    private eventManager: CanvasEventManager;
    private nodeManager: CanvasNodeManager;
    private uiManager: CanvasUIManager;
    private floatingNodeService: FloatingNodeService;
    private edgeDeletionService: EdgeDeletionService;
    private fromLinkRepairService: FromLinkRepairService;
    private nodeOrderService: NodeOrderService;
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
        this.floatingNodeService = new FloatingNodeService(app, settings, this.canvasFileService);
        this.floatingNodeService.setCanvasManager(this);
        this.eventManager = new CanvasEventManager(plugin, app, settings, collapseStateManager, this);
        this.nodeManager = new CanvasNodeManager(app, plugin, settings, collapseStateManager, this.canvasFileService);
        this.nodeManager.setCanvasManager(this);
        this.uiManager = new CanvasUIManager(app, settings, collapseStateManager);
        this.edgeDeletionService = new EdgeDeletionService(app, plugin, settings, this.canvasFileService, this.floatingNodeService);
        this.edgeDeletionService.setCanvasManager(this);
        this.fromLinkRepairService = new FromLinkRepairService(app, this.canvasFileService);
        this.nodeOrderService = new NodeOrderService(app, this.canvasFileService);

        // 设置 LayoutManager 的 FloatingNodeService（使用同一个实例）
        this.layoutManager.setFloatingNodeService(this.floatingNodeService);
        this.layoutManager.setCanvasManager(this);

        log('[Manager] 实例化');
    }

    // =========================================================================
    // 初始化
    // =========================================================================
    initialize() {
        void this.eventManager.initialize();
    }

    // =========================================================================
    // 公共接口方法
    // =========================================================================
    /**
     * 手动触发画布布局整理
     * @param source 触发来源标识
     */
    async arrangeCanvas(source: string = 'manual') {
        await this.layoutManager.arrangeCanvas(source);
    }

    /**
     * [OpenFix] Canvas 打开后触发轻量自愈（仅视觉层，不写布局坐标）
     */
    public scheduleOpenStabilization(source: string = 'canvas-open'): void {
        this.layoutManager.scheduleOpenStabilization(source);
    }

    public async addNodeToCanvas(content: string, sourceFile: TFile | null) {
        await this.nodeManager.addNodeToCanvas(content, sourceFile);
    }

    public async adjustNodeHeightAfterRender(nodeId: string) {
        await this.nodeManager.adjustNodeHeightAfterRender(nodeId);
    }

    public async measureAndPersistTrustedHeight(nodeId: string, options?: { suppressRequestSave?: boolean }) {
        await this.nodeManager.measureAndPersistTrustedHeight(nodeId, options);
    }

    public async validateAndRepairNodeHeights(file: TFile) {
        await this.nodeManager.validateAndRepairNodeHeights(file);
    }

    public async adjustAllTextNodeHeights(options?: { skipMountedTextNodes?: boolean; suppressRequestSave?: boolean }): Promise<number> {
        return await this.nodeManager.adjustAllTextNodeHeights(options);
    }

    public markProgrammaticCanvasReload(filePath: string, holdMs: number = 1800): void {
        this.eventManager.markProgrammaticCanvasReload(filePath, holdMs);
    }

    public async refreshTrustedHeightsForVisibleTextNodes(limit: number = 8, options?: { suppressRequestSave?: boolean }): Promise<number> {
        return await this.nodeManager.refreshTrustedHeightsForVisibleTextNodes(limit, options);
    }

    public async refreshTrustedHeightsForViewportTextNodes(limit: number = 24, batchSize: number = 6, options?: { suppressRequestSave?: boolean }): Promise<number> {
        return await this.nodeManager.refreshTrustedHeightsForViewportTextNodes(limit, batchSize, options);
    }

    public syncScrollableStateForMountedNodes(): number {
        return this.nodeManager.syncScrollableStateForMountedNodes();
    }

    public calculateTextNodeHeight(content: string, nodeEl?: Element, nodeWidthOverride?: number): number {
        return this.nodeManager.calculateTextNodeHeight(content, nodeEl, nodeWidthOverride);
    }

    async deleteSelectedEdge() {
        await this.edgeDeletionService.deleteSelectedEdge();
    }

    async repairNodeFromLinks(): Promise<void> {
        await this.fromLinkRepairService.repairFromLinksForCurrentCanvas();
    }

    public async sortSiblingsByMarkdownOrderAndArrange(): Promise<void> {
        const changed = await this.nodeOrderService.sortSiblingsByMarkdownOrder();
        if (!changed) return;
        await this.refreshActiveCanvasFromFile('sort-markdown-order');
        await this.arrangeCanvas('manual');
    }

    public async moveSelectedNodeUpAndArrange(): Promise<void> {
        const changed = await this.nodeOrderService.moveSelectedNode('up');
        if (!changed) return;
        await this.arrangeCanvas('manual');
    }

    public async moveSelectedNodeDownAndArrange(): Promise<void> {
        const changed = await this.nodeOrderService.moveSelectedNode('down');
        if (!changed) return;
        await this.arrangeCanvas('manual');
    }

    public async indentSelectedNodeAndArrange(): Promise<void> {
        const changed = await this.nodeOrderService.indentSelectedNode();
        if (!changed) return;
        await this.arrangeCanvas('manual');
    }

    public async outdentSelectedNodeAndArrange(): Promise<void> {
        const changed = await this.nodeOrderService.outdentSelectedNode();
        if (!changed) return;
        await this.arrangeCanvas('manual');
    }

    // =========================================================================
    // 删除操作标志控制（防止删边后被误判为新边）
    // =========================================================================
    startDeletingOperation(): void {
        this.eventManager.startDeletingOperation();
    }

    endDeletingOperation(canvas: CanvasLike | null): void {
        this.eventManager.endDeletingOperation(canvas);
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
        
        const canvas = (canvasView as CanvasViewLike).canvas;
        if (!canvas) return;

        await this.layoutManager.toggleNodeCollapse(nodeId, canvas);
    }

    public async syncHiddenChildrenOnDrag(node: CanvasNodeLike) {
        await this.layoutManager.syncHiddenChildrenOnDrag(node);
    }

    public async scheduleButtonCheck() {
        // 现在 checkAndAddCollapseButtons 已有防抖机制，直接调用即可
        await this.checkAndAddCollapseButtons();
    }

    public async checkAndClearFloatingStateForNewEdges() {
        const canvasView = this.getCanvasView();
        if (!canvasView) {
            log(`[CanvasManager] 无 canvasView，跳过浮动清理检测`);
            return;
        }

        const canvas = (canvasView as CanvasViewLike).canvas;
        if (!canvas) {
            log(`[CanvasManager] 无 canvas，跳过浮动清理检测`);
            return;
        }

        // 使用新的服务强制检测边变化
        log(`[CanvasManager] 触发浮动清理检测`);
        this.floatingNodeService.forceEdgeDetection(canvas);
    }

    public getFloatingNodeService(): FloatingNodeService {
        return this.floatingNodeService;
    }

    public getCanvasFileService(): CanvasFileService {
        return this.canvasFileService;
    }

    public async handleSingleDelete(node: CanvasNodeLike, canvas: CanvasLike): Promise<void> {
        await this.nodeManager.handleSingleDelete(node, canvas);
    }

    public async handleCascadeDelete(node: CanvasNodeLike, canvas: CanvasLike): Promise<void> {
        await this.nodeManager.handleCascadeDelete(node, canvas);
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

    private async refreshActiveCanvasFromFile(reason: string): Promise<void> {
        const canvasView = this.getCanvasView();
        if (!canvasView || canvasView.getViewType() !== 'canvas') return;

        const viewWithCanvas = canvasView as ItemView & {
            canvas?: CanvasLike & { file?: TFile };
            file?: TFile;
            leaf?: { openFile?: (file: TFile, openState?: { active?: boolean }) => Promise<void> };
        };

        const file = viewWithCanvas.canvas?.file instanceof TFile
            ? viewWithCanvas.canvas.file
            : viewWithCanvas.file instanceof TFile
                ? viewWithCanvas.file
                : null;
        if (!(file instanceof TFile)) return;

        const leaf = viewWithCanvas.leaf;
        if (!leaf || typeof leaf.openFile !== 'function') return;

        this.markProgrammaticCanvasReload(file.path, 1800);
        log(`[CanvasManager] RefreshActiveCanvasFromFile: reason=${reason}, file=${file.path}`);
        await leaf.openFile(file, { active: false });
        await new Promise<void>((resolve) => window.setTimeout(resolve, 120));
    }
}
