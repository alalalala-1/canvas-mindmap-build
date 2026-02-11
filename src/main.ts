import { Editor, ItemView, MarkdownView, Notice, Plugin, TFile } from 'obsidian';
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

    constructor(app: any, manifest: any) {
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
    }

    onunload() {
        log('[Lifecycle] 插件卸载');
        this.canvasManager.unload();
    }

    async loadSettings() {
        try {
            const data = await this.loadData();

            const validatedData = validateSettings(data || {});
            let mergedSettings = { ...DEFAULT_SETTINGS, ...validatedData };
            mergedSettings = migrateSettings(mergedSettings);

            this.settings = mergedSettings;
            this.lastClickedNodeId = data?.lastClickedNodeId || null;

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
