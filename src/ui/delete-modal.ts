import { App, Modal } from "obsidian";

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

        this.modalEl.addClass('canvas-mindmap-delete-modal');
        this.modalEl.addClass(hasChildren ? 'canvas-mindmap-delete-modal--cascade' : 'canvas-mindmap-delete-modal--simple');
    }

    onOpen() {
        const { contentEl } = this;
        
        // 添加说明文本的样式
        const descriptionEl = contentEl.createEl('p', {
            cls: 'canvas-mindmap-delete-description'
        });
        
        if (this.hasChildren) {
            descriptionEl.setText('该节点有子节点，请选择删除方式：');
            
            // 添加说明
            const infoEl = contentEl.createEl('p', {
                cls: 'canvas-mindmap-delete-info'
            });
            infoEl.setText('仅删除节点：保留子节点并连接到父节点\n级联删除：删除节点及其所有子节点');
            
            // 创建按钮容器
            const buttonContainer = contentEl.createDiv({
                cls: 'canvas-mindmap-delete-actions'
            });
            
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

            // 创建按钮容器
            const buttonContainer = contentEl.createDiv({
                cls: 'canvas-mindmap-delete-actions'
            });

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
