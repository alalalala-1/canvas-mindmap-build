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
        this.settings = DEFAULT_SETTINGS;
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
            id: 'delete-selected-edge',
            name: 'Delete selected edge',
            callback: () => this.canvasManager.deleteSelectedEdge(),
        });

        this.addCommand({
            id: 'adjust-all-text-node-heights',
            name: 'Adjust all text node heights',
            callback: () => this.canvasManager.adjustAllTextNodeHeights(),
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

            this.settings = mergedSettings;
            this.lastClickedNodeId = typeof dataObj.lastClickedNodeId === 'string' ? dataObj.lastClickedNodeId : null;

            updateLoggerConfig(this.settings);
            log('[Settings] 加载成功');
        } catch (e) {
            log('[Settings] 加载失败:', e);
            this.settings = { ...DEFAULT_SETTINGS };
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
