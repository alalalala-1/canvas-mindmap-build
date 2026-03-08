import { App, MarkdownView, Notice, Plugin, PluginManifest } from 'obsidian';
import { CanvasMindmapBuildSettings, DEFAULT_SETTINGS } from './settings/types';
import { CanvasMindmapBuildSettingTab } from './settings/setting-tab';
import { CollapseStateManager } from './state/collapse-state';
import { CanvasManager } from './canvas/canvas-manager';
import { updateLoggerConfig, log } from './utils/logger';
import { validateSettings, migrateSettings } from './settings/validator';
import { CSS_VARS } from './constants';

export default class CanvasMindmapBuildPlugin extends Plugin {
    settings: CanvasMindmapBuildSettings;
    lastClickedNodeId: string | null = null;
    private collapseStateManager: CollapseStateManager = new CollapseStateManager();
    private canvasManager: CanvasManager;

    constructor(app: App, manifest: PluginManifest) {
        super(app, manifest);
        // [修复] 创建DEFAULT_SETTINGS的副本，避免所有模块共享同一个引用
        this.settings = { ...DEFAULT_SETTINGS };
        this.canvasManager = new CanvasManager(this, app, this.settings, this.collapseStateManager);
    }

    async onload() {
        await this.loadSettings();

        updateLoggerConfig(this.settings);
        log('[Lifecycle] 插件加载');

        this.updateCollapseButtonColor();
        this.canvasManager.initialize();

        this.addCommand({
            id: 'add-to-canvas-mindmap',
            name: 'Add to canvas mindmap',
            callback: async () => {
                const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (mdView && mdView.editor.getSelection()) {
                    await this.canvasManager.addNodeToCanvas(mdView.editor.getSelection(), mdView.file);
                } else {
                    new Notice('请在 Markdown 编辑器中选择文本');
                }
            }
        });

        this.addCommand({
            id: 'arrange-canvas-mindmap-layout',
            name: 'Arrange canvas mindmap layout',
            callback: () => this.canvasManager.arrangeCanvas(),
        });

        this.addCommand({
            id: 'repair-node-fromlinks',
            name: 'Repair node fromLinks (修复节点源链接)',
            callback: () => this.canvasManager.repairNodeFromLinks(),
        });

        this.addCommand({
            id: 'sort-siblings-by-markdown-order',
            name: 'Sort sibling nodes by Markdown order (按 Markdown 顺序重排同级)',
            callback: () => this.canvasManager.sortSiblingsByMarkdownOrderAndArrange(),
        });

        this.addCommand({
            id: 'move-selected-node-up',
            name: 'Move selected node up (同级上移)',
            callback: () => this.canvasManager.moveSelectedNodeUpAndArrange(),
        });

        this.addCommand({
            id: 'move-selected-node-down',
            name: 'Move selected node down (同级下移)',
            callback: () => this.canvasManager.moveSelectedNodeDownAndArrange(),
        });

        this.addCommand({
            id: 'indent-selected-node',
            name: '右移一级：成为前一同级的子节点',
            callback: () => this.canvasManager.indentSelectedNodeAndArrange(),
        });

        this.addCommand({
            id: 'outdent-selected-node',
            name: '左移一级：成为父级的后继同级',
            callback: () => this.canvasManager.outdentSelectedNodeAndArrange(),
        });

        this.addSettingTab(new CanvasMindmapBuildSettingTab(this.app, this));
    }

    onunload() {
        log('[Lifecycle] 插件卸载');
        this.canvasManager.unload();
    }

    async loadSettings() {
        try {
            const data = (await this.loadData()) as unknown;
            const dataObj = (data && typeof data === 'object') ? (data as Record<string, unknown>) : {};

            const validatedData = validateSettings(dataObj);
            let mergedSettings = { ...DEFAULT_SETTINGS, ...validatedData };
            mergedSettings = migrateSettings(mergedSettings);

            // [修复] 使用Object.assign更新同一对象，保持所有模块的settings引用有效
            // 之前用 this.settings = mergedSettings 会断开CanvasManager等模块的引用
            Object.assign(this.settings, mergedSettings);
            this.lastClickedNodeId = typeof dataObj.lastClickedNodeId === 'string' ? dataObj.lastClickedNodeId : null;

            updateLoggerConfig(this.settings);
            log('[Settings] 加载成功');
        } catch (e) {
            log('[Settings] 加载失败:', e);
            // [修复] 失败时也用Object.assign，保持引用
            Object.assign(this.settings, DEFAULT_SETTINGS);
            new Notice('加载插件设置失败，使用默认设置');
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
        updateLoggerConfig(this.settings);
        log('[Settings] 已保存');
    }

    updateCollapseButtonColor() {
        // 更新 CSS 变量
        document.documentElement.style.setProperty(CSS_VARS.COLLAPSE_BUTTON_COLOR, this.settings.collapseButtonColor);
    }
}
