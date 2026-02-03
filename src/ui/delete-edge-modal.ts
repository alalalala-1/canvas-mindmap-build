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
        
        // 设置模态框大小
        this.contentEl.style.maxWidth = '320px';
        this.modalEl.style.maxWidth = '340px';
        
        // 添加自定义样式
        this.modalEl.addClass('canvas-mindmap-delete-edge-modal');
    }

    onOpen() {
        const { contentEl } = this;
        
        // 添加说明文本
        const descriptionEl = contentEl.createEl('p', {
            cls: 'canvas-mindmap-delete-edge-description'
        });
        
        descriptionEl.setText('确定要删除此连线及其箭头吗？');
        descriptionEl.style.marginBottom = '20px';
        descriptionEl.style.textAlign = 'center';
        descriptionEl.style.fontSize = '16px';
        descriptionEl.style.fontWeight = 'bold';

        // 创建按钮容器
        const buttonContainer = contentEl.createDiv();
        buttonContainer.style.display = 'flex';
        buttonContainer.style.flexDirection = 'row';
        buttonContainer.style.justifyContent = 'space-around';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.marginTop = '20px';

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
        
        // 添加全局样式
        const style = document.createElement('style');
        style.textContent = `
            .canvas-mindmap-delete-edge-modal .modal {
                border: 3px solid #e74c3c !important;
                border-radius: 15px !important;
            }
            .canvas-mindmap-delete-edge-modal .modal-title {
                font-size: 12px !important;
                font-weight: bold !important;
            }
            .canvas-mindmap-delete-edge-description {
                font-size: 12px !important;
                margin-bottom: 15px !important;
            }
            .canvas-mindmap-delete-edge-btn {
                border: 3px solid #e74c3c;
                border-radius: 15px;
                padding: 8px 16px;
                font-size: 12px;
                font-weight: bold;
                color: #e74c3c;
                background-color: white;
                cursor: pointer;
                min-width: 70px;
                transition: all 0.2s ease;
            }
            .canvas-mindmap-delete-edge-btn:hover {
                background-color: #e74c3c;
                color: white;
            }
            .canvas-mindmap-delete-edge-btn:active {
                background-color: #c0392b;
                color: white;
            }
        `;
        contentEl.appendChild(style);
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
