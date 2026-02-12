import { App, Modal, Setting } from 'obsidian';

/**
 * 节点文本编辑模态框
 */
export class EditTextModal extends Modal {
    private result: string;
    private onSubmit: (result: string) => void;

    constructor(app: App, initialText: string, onSubmit: (result: string) => void) {
        super(app);
        this.result = initialText;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: '编辑节点文本' });

        new Setting(contentEl)
            .setName('内容')
            .addTextArea((text) => {
                text.setValue(this.result);
                text.onChange((value) => {
                    this.result = value;
                });
                text.inputEl.addClass('canvas-mindmap-edit-textarea');
            });

        new Setting(contentEl)
            .addButton((btn) =>
                btn
                    .setButtonText('保存')
                    .setCta()
                    .onClick(() => {
                        this.close();
                        this.onSubmit(this.result);
                    })
            )
            .addButton((btn) =>
                btn
                    .setButtonText('取消')
                    .onClick(() => {
                        this.close();
                    })
            );
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
