import { App, MarkdownView, Notice, Plugin, PluginManifest } from 'obsidian';
import { CanvasMindmapBuildSettings, DEFAULT_SETTINGS } from './settings/types';
import { CanvasMindmapBuildSettingTab } from './settings/setting-tab';
import { CollapseStateManager } from './state/collapse-state';
import { CanvasManager } from './canvas/canvas-manager';
import {
    buildDebugReport,
    createLogTrace,
    finishLogTrace,
    log,
    logEvent,
    updateLoggerConfig,
} from './utils/logger';
import { validateSettings, migrateSettings } from './settings/validator';
import { CSS_VARS } from './constants';
import { makeSnapshot, snapshotCanvasRuntime, snapshotViewportState, snapshotViewState } from './utils/logging/snapshots';
import { getCanvasView } from './utils/canvas-utils';

export default class CanvasMindmapBuildPlugin extends Plugin {
    settings: CanvasMindmapBuildSettings;
    lastClickedNodeId: string | null = null;
    lastClickedCanvasFilePath: string | null = null;
    lastNavigationSourceNodeId: string | null = null;
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
                const trace = createLogTrace('command.add-to-canvas-mindmap', {
                    activeView: snapshotViewState(this.app.workspace.getActiveViewOfType(MarkdownView)),
                });
                const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
                const selection = mdView?.editor.getSelection() || '';
                log(
                    `[Command] AddToCanvasMindmap: markdown=${!!mdView}, selectionLength=${selection.length}, ` +
                    `sourceFile=${mdView?.file?.path || 'none'}, lastClickedNodeId=${this.lastClickedNodeId || 'none'}, ` +
                    `lastClickedCanvasFilePath=${this.lastClickedCanvasFilePath || 'none'}`
                );
                logEvent({
                    level: 'info',
                    subsystem: 'command',
                    event: 'AddToCanvasMindmap',
                    message: 'command invoked',
                    traceId: trace.traceId,
                    data: {
                        hasMarkdownView: !!mdView,
                        selectionLength: selection.length,
                        sourceFile: mdView?.file?.path || 'none',
                        lastClickedNodeId: this.lastClickedNodeId || 'none',
                        lastClickedCanvasFilePath: this.lastClickedCanvasFilePath || 'none',
                    }
                });

                try {
                    if (mdView && selection) {
                        await this.canvasManager.addNodeToCanvas(selection, mdView.file);
                        finishLogTrace(trace, {
                            status: 'success',
                            sourceFile: mdView.file?.path || 'none',
                            selectionLength: selection.length,
                        });
                    } else {
                        new Notice('请在 Markdown 编辑器中选择文本');
                        finishLogTrace(trace, {
                            status: 'notice',
                            reason: 'no-selection',
                        });
                    }
                } catch (err) {
                    logEvent({
                        level: 'error',
                        subsystem: 'command',
                        event: 'AddToCanvasMindmapFailed',
                        message: 'add to canvas mindmap failed',
                        traceId: trace.traceId,
                        data: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : String(err),
                    });
                    finishLogTrace(trace, { status: 'error' });
                    throw err;
                }
            }
        });

        this.addCommand({
            id: 'arrange-canvas-mindmap-layout',
            name: 'Arrange canvas mindmap layout',
            callback: async () => {
                const trace = createLogTrace('command.arrange-canvas-mindmap-layout', {
                    canvasView: snapshotViewState(getCanvasView(this.app)),
                    viewport: snapshotViewportState(),
                });
                try {
                    await this.canvasManager.arrangeCanvas();
                    finishLogTrace(trace, { status: 'scheduled' });
                } catch (err) {
                    logEvent({
                        level: 'error',
                        subsystem: 'command',
                        event: 'ArrangeCanvasMindmapFailed',
                        message: 'arrange canvas command failed',
                        traceId: trace.traceId,
                        data: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : String(err),
                    });
                    finishLogTrace(trace, { status: 'error' });
                    throw err;
                }
            },
        });

        this.addCommand({
            id: 'repair-node-fromlinks',
            name: 'Repair node from links (修复节点源链接)',
            callback: async () => {
                const trace = createLogTrace('command.repair-node-fromlinks', {
                    canvasView: snapshotViewState(getCanvasView(this.app)),
                });
                try {
                    await this.canvasManager.repairNodeFromLinks();
                    finishLogTrace(trace, { status: 'success' });
                } catch (err) {
                    logEvent({
                        level: 'error',
                        subsystem: 'command',
                        event: 'RepairNodeFromLinksFailed',
                        message: 'repair node from links failed',
                        traceId: trace.traceId,
                        data: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : String(err),
                    });
                    finishLogTrace(trace, { status: 'error' });
                    throw err;
                }
            },
        });

        this.addCommand({
            id: 'export-canvas-mindmap-debug-report',
            name: 'Export canvas mindmap debug report',
            callback: async () => {
                const canvasView = getCanvasView(this.app);
                const canvas = (canvasView as { canvas?: unknown } | null)?.canvas;
                const trace = createLogTrace('command.export-canvas-mindmap-debug-report', {
                    canvasView: snapshotViewState(canvasView),
                });
                let copied = false;

                try {
                    const report = buildDebugReport({
                        title: 'Canvas Mindmap Debug Report',
                        limit: 250,
                        snapshots: [
                            makeSnapshot('viewport', snapshotViewportState()),
                            makeSnapshot('canvas-view', snapshotViewState(canvasView)),
                            makeSnapshot('canvas-runtime', snapshotCanvasRuntime(canvas as Parameters<typeof snapshotCanvasRuntime>[0])),
                            makeSnapshot('plugin-settings', {
                                canvasFilePath: this.settings.canvasFilePath || 'unset',
                                debugLogging: this.settings.enableDebugLogging,
                                verboseDiagnostics: this.settings.enableVerboseCanvasDiagnostics,
                                textNodeWidth: this.settings.textNodeWidth,
                                textNodeMaxHeight: this.settings.textNodeMaxHeight,
                                horizontalSpacing: this.settings.horizontalSpacing,
                                verticalSpacing: this.settings.verticalSpacing,
                            })
                        ]
                    });

                    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(report);
                        copied = true;
                    }

                    console.info(report);
                    logEvent({
                        level: 'info',
                        subsystem: 'command',
                        event: 'ExportDebugReport',
                        message: 'debug report generated',
                        traceId: trace.traceId,
                        data: { copied, length: report.length }
                    });
                    new Notice(copied ? '调试报告已复制到剪贴板，并输出到控制台' : '调试报告已输出到控制台');
                    finishLogTrace(trace, { status: 'success', copied });
                } catch (err) {
                    logEvent({
                        level: 'error',
                        subsystem: 'command',
                        event: 'ExportDebugReportFailed',
                        message: 'export debug report failed',
                        traceId: trace.traceId,
                        data: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : String(err),
                    });
                    finishLogTrace(trace, { status: 'error', copied });
                    throw err;
                }
            }
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
        logEvent({
            level: 'info',
            subsystem: 'lifecycle',
            event: 'PluginLoaded',
            message: 'plugin onload complete',
            data: {
                commandCount: 10,
                canvasFilePath: this.settings.canvasFilePath || 'unset',
            }
        });
    }

    onunload() {
        log('[Lifecycle] 插件卸载');
        logEvent({
            level: 'info',
            subsystem: 'lifecycle',
            event: 'PluginUnload',
            message: 'plugin unloaded',
        });
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
            this.lastClickedCanvasFilePath = typeof dataObj.lastClickedCanvasFilePath === 'string'
                ? dataObj.lastClickedCanvasFilePath
                : null;
            this.lastNavigationSourceNodeId = typeof dataObj.lastNavigationSourceNodeId === 'string'
                ? dataObj.lastNavigationSourceNodeId
                : null;

            updateLoggerConfig(this.settings);
            log('[Settings] 加载成功');
            logEvent({
                level: 'info',
                subsystem: 'settings',
                event: 'LoadSettingsSuccess',
                message: 'settings loaded',
                data: {
                    canvasFilePath: this.settings.canvasFilePath || 'unset',
                    debugLogging: this.settings.enableDebugLogging,
                    verboseDiagnostics: this.settings.enableVerboseCanvasDiagnostics,
                }
            });
        } catch (e) {
            log('[Settings] 加载失败:', e);
            // [修复] 失败时也用Object.assign，保持引用
            Object.assign(this.settings, DEFAULT_SETTINGS);
            new Notice('加载插件设置失败，使用默认设置');
            logEvent({
                level: 'error',
                subsystem: 'settings',
                event: 'LoadSettingsFailed',
                message: 'load settings failed and defaults were applied',
                data: e instanceof Error ? { name: e.name, message: e.message, stack: e.stack } : String(e),
            });
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
        updateLoggerConfig(this.settings);
        log('[Settings] 已保存');
        logEvent({
            level: 'info',
            subsystem: 'settings',
            event: 'SaveSettings',
            message: 'settings saved',
            data: {
                canvasFilePath: this.settings.canvasFilePath || 'unset',
                debugLogging: this.settings.enableDebugLogging,
                verboseDiagnostics: this.settings.enableVerboseCanvasDiagnostics,
            }
        });
    }

    updateCollapseButtonColor() {
        // 更新 CSS 变量
        document.documentElement.style.setProperty(CSS_VARS.COLLAPSE_BUTTON_COLOR, this.settings.collapseButtonColor);
    }
}
