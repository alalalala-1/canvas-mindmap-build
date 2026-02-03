import { App, Modal, Setting } from "obsidian";

export interface DeleteConfirmationResult {
    action: 'cancel' | 'confirm' | 'single' | 'cascade';
}

export class DeleteConfirmationModal extends Modal {
    private result: DeleteConfirmationResult = { action: 'cancel' };
    private resolvePromise: ((result: DeleteConfirmationResult) => void) | null = null;
    private hasChildren: boolean;

    constructor(app: App, hasChildren: boolean = true) {
        super(app);
        this.hasChildren = hasChildren;
        this.titleEl.setText('确认删除节点');
        
        // 根据是否有子节点调整模态框大小和样式
        if (!hasChildren) {
            this.contentEl.style.maxWidth = '320px';
            this.modalEl.style.maxWidth = '340px';
        } else {
            this.contentEl.style.maxWidth = '450px';
            this.modalEl.style.maxWidth = '470px';
        }
        
        // 添加自定义样式
        this.modalEl.addClass('canvas-mindmap-delete-modal');
    }

    onOpen() {
        const { contentEl } = this;
        
        // 添加说明文本的样式
        const descriptionEl = contentEl.createEl('p', {
            cls: 'canvas-mindmap-delete-description'
        });
        
        if (this.hasChildren) {
            descriptionEl.setText('该节点有子节点，请选择删除方式：');
            descriptionEl.style.marginBottom = '20px';
            descriptionEl.style.textAlign = 'center';
            descriptionEl.style.fontSize = '16px';
            descriptionEl.style.fontWeight = 'bold';
            
            // 添加说明
            const infoEl = contentEl.createEl('p', {
                cls: 'canvas-mindmap-delete-info'
            });
            infoEl.setText('仅删除节点：保留子节点并连接到父节点\n级联删除：删除节点及其所有子节点');
            infoEl.style.fontSize = '12px';
            infoEl.style.color = '#666';
            infoEl.style.marginBottom = '15px';
            infoEl.style.whiteSpace = 'pre-line';
            
            // 创建按钮容器
            const buttonContainer = contentEl.createDiv();
            buttonContainer.style.display = 'flex';
            buttonContainer.style.flexDirection = 'row';
            buttonContainer.style.justifyContent = 'space-around';
            buttonContainer.style.gap = '10px';
            buttonContainer.style.marginTop = '20px';
            
            // 仅删除节点按钮
            const singleBtn = buttonContainer.createEl('button', {
                text: '仅删除节点',
                cls: 'canvas-mindmap-delete-btn'
            });
            singleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.result = { action: 'single' };
                this.close();
            });

            // 级联删除按钮
            const cascadeBtn = buttonContainer.createEl('button', {
                text: '级联删除',
                cls: 'canvas-mindmap-delete-btn'
            });
            cascadeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.result = { action: 'cascade' };
                this.close();
            });

            // 取消按钮
            const cancelBtn = buttonContainer.createEl('button', {
                text: '取消',
                cls: 'canvas-mindmap-delete-btn'
            });
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.result = { action: 'cancel' };
                this.close();
            });
        } else {
            descriptionEl.setText('确定要删除此节点吗？');
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
                cls: 'canvas-mindmap-delete-btn'
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
                cls: 'canvas-mindmap-delete-btn'
            });
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.result = { action: 'cancel' };
                this.close();
            });
        }
        
        // 添加全局样式
        const style = document.createElement('style');
        style.textContent = `
            .canvas-mindmap-delete-modal .modal {
                border: 3px solid #e74c3c !important;
                border-radius: 15px !important;
            }
            .canvas-mindmap-delete-modal .modal-title {
                font-size: 12px !important;
                font-weight: bold !important;
            }
            .canvas-mindmap-delete-description {
                font-size: 12px !important;
                margin-bottom: 15px !important;
            }
            .canvas-mindmap-delete-btn {
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
            .canvas-mindmap-delete-btn:hover {
                background-color: #e74c3c;
                color: white;
            }
            .canvas-mindmap-delete-btn:active {
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

    async waitForResult(): Promise<DeleteConfirmationResult> {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;
        });
    }
}