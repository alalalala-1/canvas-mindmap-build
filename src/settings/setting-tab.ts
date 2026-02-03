import {App, PluginSettingTab, Setting} from "obsidian";
import CanvasMindmapBuildPlugin from "../main";
import { CanvasMindmapBuildSettings } from "./types";
import { updateLoggerConfig, info } from "../utils/logger";

export class CanvasMindmapBuildSettingTab extends PluginSettingTab {
    plugin: CanvasMindmapBuildPlugin;

    constructor(app: App, plugin: CanvasMindmapBuildPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        containerEl.createEl('h2', {text: 'Canvas Mindmap Build Settings'});

        new Setting(containerEl)
            .setName('Target Canvas File')
            .setDesc('The path to the canvas file where new nodes will be added.')
            .addText(text => text
                .setPlaceholder('path/to/your/canvas.canvas')
                .setValue(this.plugin.settings.canvasFilePath)
                .onChange(async (value) => {
                    this.plugin.settings.canvasFilePath = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', {text: 'Text Nodes'});

        new Setting(containerEl)
            .setName('Text Node Width')
            .addText(text => text
                .setPlaceholder('300')
                .setValue(this.plugin.settings.textNodeWidth.toString())
                .onChange(async (value) => {
                    this.plugin.settings.textNodeWidth = parseInt(value) || 300;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Text Node Max Height')
            .setDesc('The maximum height for a text node when auto-sizing is enabled.')
            .addText(text => text
                .setPlaceholder('400')
                .setValue(this.plugin.settings.textNodeMaxHeight.toString())
                .onChange(async (value) => {
                    this.plugin.settings.textNodeMaxHeight = parseInt(value) || 400;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', {text: 'Image Nodes'});

        new Setting(containerEl)
            .setName('Image Node Width')
            .addText(text => text
                .setPlaceholder('400')
                .setValue(this.plugin.settings.imageNodeWidth.toString())
                .onChange(async (value) => {
                    this.plugin.settings.imageNodeWidth = parseInt(value) || 400;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Image Node Height')
            .addText(text => text
                .setPlaceholder('400')
                .setValue(this.plugin.settings.imageNodeHeight.toString())
                .onChange(async (value) => {
                    this.plugin.settings.imageNodeHeight = parseInt(value) || 400;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', {text: 'Formula (LaTeX) Nodes'});

        new Setting(containerEl)
            .setName('Enable Formula Detection')
            .setDesc('Use special dimensions for content identified as a formula (starts with $$).')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableFormulaDetection)
                .onChange(async (value) => {
                    this.plugin.settings.enableFormulaDetection = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Formula Node Width')
            .addText(text => text
                .setPlaceholder('600')
                .setValue(this.plugin.settings.formulaNodeWidth.toString())
                .onChange(async (value) => {
                    this.plugin.settings.formulaNodeWidth = parseInt(value) || 600;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Formula Node Height')
            .addText(text => text
                .setPlaceholder('200')
                .setValue(this.plugin.settings.formulaNodeHeight.toString())
                .onChange(async (value) => {
                    this.plugin.settings.formulaNodeHeight = parseInt(value) || 200;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', {text: 'Node Spacing'});

        new Setting(containerEl)
            .setName('Horizontal Spacing')
            .setDesc('The horizontal distance between parent and child nodes.')
            .addText(text => text
                .setPlaceholder('200')
                .setValue(this.plugin.settings.horizontalSpacing.toString())
                .onChange(async (value) => {
                    this.plugin.settings.horizontalSpacing = parseInt(value) || 200;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Vertical Spacing')
            .setDesc('The vertical distance between sibling nodes.')
            .addText(text => text
                .setPlaceholder('40')
                .setValue(this.plugin.settings.verticalSpacing.toString())
                .onChange(async (value) => {
                    this.plugin.settings.verticalSpacing = parseInt(value) || 40;
                    await this.plugin.saveSettings();
                }));

        // Debug Settings Section
        containerEl.createEl('h3', {text: 'Debug Settings'});

        new Setting(containerEl)
            .setName('Enable Debug Logging')
            .setDesc('Enable detailed logging for debugging purposes. Logs will appear in the developer console.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableDebugLogging)
                .onChange(async (value) => {
                    this.plugin.settings.enableDebugLogging = value;
                    await this.plugin.saveSettings();
                    updateLoggerConfig(this.plugin.settings);
                    info(`Debug logging ${value ? 'enabled' : 'disabled'}`);
                }));

        new Setting(containerEl)
            .setName('Log Level')
            .setDesc('Select the verbosity level for debug logs.')
            .addDropdown(dropdown => dropdown
                .addOption('error', 'Error - Only errors')
                .addOption('warn', 'Warn - Errors and warnings')
                .addOption('info', 'Info - General information (default)')
                .addOption('debug', 'Debug - Detailed debug information')
                .addOption('verbose', 'Verbose - All messages including trace')
                .setValue(this.plugin.settings.logLevel)
                .onChange(async (value) => {
                    this.plugin.settings.logLevel = value as CanvasMindmapBuildSettings['logLevel'];
                    await this.plugin.saveSettings();
                    updateLoggerConfig(this.plugin.settings);
                    info(`Log level changed to: ${value}`);
                }));

    }
}
