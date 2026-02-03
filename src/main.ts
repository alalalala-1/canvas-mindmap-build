import { Editor, ItemView, MarkdownView, Notice, Plugin, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings, DEFAULT_SETTINGS } from './settings/types';
import { CanvasMindmapBuildSettingTab } from './settings/setting-tab';
import { CollapseStateManager } from './state/collapse-state';
import { CanvasManager } from './canvas/canvas-manager';
import { updateLoggerConfig, info, debug } from './utils/logger';

export default class CanvasMindmapBuildPlugin extends Plugin {
    settings: CanvasMindmapBuildSettings;
    lastClickedNodeId: string | null = null;
    private collapseStateManager: CollapseStateManager = new CollapseStateManager();
    private canvasManager: CanvasManager;

    constructor(app: any, manifest: any) {
        super(app, manifest);
        this.settings = DEFAULT_SETTINGS;
        this.canvasManager = new CanvasManager(this, app, this.settings, this.collapseStateManager);
    }

    async onload() {
        await this.loadSettings();

        // 初始化日志系统配置
        updateLoggerConfig(this.settings);
        info('插件加载中...');

        // 初始化折叠按钮颜色
        this.updateCollapseButtonColor();

        // 初始化Canvas管理器
        this.canvasManager.initialize();

        // 添加命令
        this.addCommand({
            id: 'add-to-canvas-mindmap',
            name: 'Add to Canvas Mindmap',
            callback: () => {
                const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (mdView && mdView.editor.getSelection()) {
                    this.canvasManager.addNodeToCanvas(mdView.editor.getSelection(), mdView.file);
                } else {
                    new Notice('Please select some text in a Markdown editor.');
                }
            }
        });

        this.addCommand({
            id: 'arrange-canvas-mindmap-layout',
            name: 'Arrange Canvas Mindmap Layout',
            callback: () => this.canvasManager.arrangeCanvas(),
        });

        this.addCommand({
            id: 'delete-selected-edge',
            name: 'Delete Selected Edge',
            callback: () => this.canvasManager.deleteSelectedEdge(),
        });

        this.addCommand({
            id: 'adjust-all-text-node-heights',
            name: 'Adjust All Text Node Heights',
            callback: () => this.canvasManager.adjustAllTextNodeHeights(),
        });

        this.addSettingTab(new CanvasMindmapBuildSettingTab(this.app, this));

        debug('插件加载完成');
    }

    onunload() {
        info('插件卸载中...');
        this.canvasManager.unload();
        info('插件已卸载');
    }

    async loadSettings() {
        const data = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
        this.lastClickedNodeId = data?.lastClickedNodeId || null;

        // 更新日志配置
        updateLoggerConfig(this.settings);
        debug('设置已加载', this.settings);
    }

    async saveSettings() {
        await this.saveData(this.settings);
        // 更新日志配置
        updateLoggerConfig(this.settings);
        debug('设置已保存', this.settings);
    }

    updateCollapseButtonColor() {
        // 更新 CSS 变量
        document.documentElement.style.setProperty('--cmb-collapse-button-color', this.settings.collapseButtonColor);
    }
}
