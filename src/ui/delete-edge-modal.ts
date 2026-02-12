import { App, Modal } from "obsidian";

export interface DeleteEdgeConfirmationResult {
    action: 'cancel' | 'confirm';
}

export class DeleteEdgeConfirmationModal extends Modal {
    private result: DeleteEdgeConfirmationResult = { action: 'cancel' };
    private resolvePromise: ((result: DeleteEdgeConfirmationResult) => void) | null = null;

    constructor(app: App) {
        super(app);
        this.titleEl.setText('确认删除连线');
        this.modalEl.addClass('canvas-mindmap-delete-edge-modal');
        this.modalEl.addClass('canvas-mindmap-delete-edge-modal--simple');
    }

    onOpen() {
        const { contentEl } = this;
        
        // 添加说明文本
        const descriptionEl = contentEl.createEl('p', {
            cls: 'canvas-mindmap-delete-edge-description'
        });
        
        descriptionEl.setText('确定要删除此连线及其箭头吗？');

        // 创建按钮容器
        const buttonContainer = contentEl.createDiv({
            cls: 'canvas-mindmap-delete-edge-actions'
        });

        // 删除按钮
        const confirmBtn = buttonContainer.createEl('button', {
            text: '删除',
            cls: 'canvas-mindmap-delete-edge-btn'
        });
        confirmBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.result = { action: 'confirm' };
            this.close();
        });

        // 取消按钮
        const cancelBtn = buttonContainer.createEl('button', {
            text: '取消',
            cls: 'canvas-mindmap-delete-edge-btn'
        });
        cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.result = { action: 'cancel' };
            this.close();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        
        if (this.resolvePromise) {
            this.resolvePromise(this.result);
        }
    }

    async waitForResult(): Promise<DeleteEdgeConfirmationResult> {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;
        });
    }
}
