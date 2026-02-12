import {App, PluginSettingTab, Setting} from "obsidian";
import CanvasMindmapBuildPlugin from "../main";
import { updateLoggerConfig, log } from "../utils/logger";

export class CanvasMindmapBuildSettingTab extends PluginSettingTab {
    plugin: CanvasMindmapBuildPlugin;

    constructor(app: App, plugin: CanvasMindmapBuildPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        new Setting(containerEl).setName('Basics').setHeading();

        new Setting(containerEl)
            .setName('Target canvas file')
            .setDesc('The path to the canvas file where new nodes will be added.')
            .addText(text => text
                .setPlaceholder('Path/to/your/canvas.canvas')
                .setValue(this.plugin.settings.canvasFilePath)
                .onChange(async (value) => {
                    this.plugin.settings.canvasFilePath = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl).setName('Text nodes').setHeading();

        new Setting(containerEl)
            .setName('Text node width')
            .addText(text => text
                .setPlaceholder('300')
                .setValue(this.plugin.settings.textNodeWidth.toString())
                .onChange(async (value) => {
                    this.plugin.settings.textNodeWidth = parseInt(value) || 300;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Text node max height')
            .setDesc('The maximum height for a text node when auto-sizing is enabled.')
            .addText(text => text
                .setPlaceholder('400')
                .setValue(this.plugin.settings.textNodeMaxHeight.toString())
                .onChange(async (value) => {
                    this.plugin.settings.textNodeMaxHeight = parseInt(value) || 400;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl).setName('Image nodes').setHeading();

        new Setting(containerEl)
            .setName('Image node width')
            .addText(text => text
                .setPlaceholder('400')
                .setValue(this.plugin.settings.imageNodeWidth.toString())
                .onChange(async (value) => {
                    this.plugin.settings.imageNodeWidth = parseInt(value) || 400;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Image node height')
            .addText(text => text
                .setPlaceholder('400')
                .setValue(this.plugin.settings.imageNodeHeight.toString())
                .onChange(async (value) => {
                    this.plugin.settings.imageNodeHeight = parseInt(value) || 400;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl).setName('Formula (LaTeX) nodes').setHeading();

        new Setting(containerEl)
            .setName('Enable formula detection')
            .setDesc('Use special dimensions for content identified as a formula (starts with $$).')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableFormulaDetection)
                .onChange(async (value) => {
                    this.plugin.settings.enableFormulaDetection = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Formula node width')
            .addText(text => text
                .setPlaceholder('600')
                .setValue(this.plugin.settings.formulaNodeWidth.toString())
                .onChange(async (value) => {
                    this.plugin.settings.formulaNodeWidth = parseInt(value) || 600;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Formula node height')
            .addText(text => text
                .setPlaceholder('200')
                .setValue(this.plugin.settings.formulaNodeHeight.toString())
                .onChange(async (value) => {
                    this.plugin.settings.formulaNodeHeight = parseInt(value) || 200;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl).setName('Node spacing').setHeading();

        new Setting(containerEl)
            .setName('Horizontal spacing')
            .setDesc('The horizontal distance between parent and child nodes.')
            .addText(text => text
                .setPlaceholder('200')
                .setValue(this.plugin.settings.horizontalSpacing.toString())
                .onChange(async (value) => {
                    this.plugin.settings.horizontalSpacing = parseInt(value) || 200;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Vertical spacing')
            .setDesc('The vertical distance between sibling nodes.')
            .addText(text => text
                .setPlaceholder('40')
                .setValue(this.plugin.settings.verticalSpacing.toString())
                .onChange(async (value) => {
                    this.plugin.settings.verticalSpacing = parseInt(value) || 40;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl).setName('Collapse button').setHeading();

        new Setting(containerEl)
            .setName('Collapse button color')
            .setDesc('The color of the collapse button for all states.')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.collapseButtonColor)
                .onChange(async (value) => {
                    this.plugin.settings.collapseButtonColor = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateCollapseButtonColor();
                }));

        new Setting(containerEl).setName('Debug').setHeading();

        new Setting(containerEl)
            .setName('Enable debug logging')
            .setDesc('Enable detailed logging for debugging purposes. Logs will appear in the developer console.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableDebugLogging)
                .onChange(async (value) => {
                    this.plugin.settings.enableDebugLogging = value;
                    await this.plugin.saveSettings();
                    updateLoggerConfig(this.plugin.settings);
                    log(`Debug logging ${value ? 'enabled' : 'disabled'}`);
                }));
    }
}
