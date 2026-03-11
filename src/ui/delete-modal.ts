import { App } from 'obsidian';

export interface DeleteConfirmationResult {
    action: 'cancel' | 'confirm' | 'single' | 'cascade';
}

export class DeleteConfirmationModal {
    private app: App;
    private result: DeleteConfirmationResult = { action: 'cancel' };
    private resolvePromise: ((result: DeleteConfirmationResult) => void) | null = null;
    private hasChildren: boolean;
    private overlayEl: HTMLDivElement | null = null;
    private panelEl: HTMLDivElement | null = null;
    private isOpen = false;
    private keydownHandler: ((event: KeyboardEvent) => void) | null = null;

    constructor(app: App, hasChildren: boolean = true) {
        this.app = app;
        this.hasChildren = hasChildren;
    }

    open(): void {
        if (this.isOpen) return;
        this.isOpen = true;
        this.result = { action: 'cancel' };

        const overlayEl = document.createElement('div');
        overlayEl.className = 'canvas-mindmap-delete-overlay canvas-mindmap-delete-modal';

        const panelEl = document.createElement('div');
        panelEl.className = [
            'canvas-mindmap-delete-panel',
            'canvas-mindmap-delete-modal',
            this.hasChildren ? 'canvas-mindmap-delete-modal--cascade' : 'canvas-mindmap-delete-modal--simple'
        ].join(' ');
        panelEl.setAttribute('role', 'dialog');
        panelEl.setAttribute('aria-modal', 'true');
        panelEl.setAttribute('aria-label', '确认删除节点');
        panelEl.tabIndex = -1;

        const titleEl = document.createElement('div');
        titleEl.className = 'canvas-mindmap-delete-title';
        titleEl.textContent = '确认删除节点';
        panelEl.appendChild(titleEl);

        const descriptionEl = document.createElement('p');
        descriptionEl.className = 'canvas-mindmap-delete-description';
        descriptionEl.textContent = this.hasChildren
            ? '该节点有子节点，请选择删除方式：'
            : '确定要删除此节点吗？';
        panelEl.appendChild(descriptionEl);

        if (this.hasChildren) {
            const infoEl = document.createElement('p');
            infoEl.className = 'canvas-mindmap-delete-info';
            infoEl.textContent = '仅删除节点：保留子节点并连接到父节点\n级联删除：删除节点及其所有子节点';
            panelEl.appendChild(infoEl);
        }

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'canvas-mindmap-delete-actions';
        panelEl.appendChild(buttonContainer);

        const primaryButton = this.hasChildren
            ? this.appendActionButton(buttonContainer, '仅删除节点', 'single')
            : this.appendActionButton(buttonContainer, '删除', 'confirm');

        if (this.hasChildren) {
            this.appendActionButton(buttonContainer, '级联删除', 'cascade');
        }
        this.appendActionButton(buttonContainer, '取消', 'cancel');

        overlayEl.addEventListener('pointerdown', (event) => {
            if (event.target !== overlayEl) return;
            event.preventDefault();
            event.stopPropagation();
        }, { capture: true });
        overlayEl.addEventListener('click', (event) => {
            if (event.target !== overlayEl) return;
            event.preventDefault();
            event.stopPropagation();
            this.close({ action: 'cancel' });
        }, { capture: true });

        overlayEl.appendChild(panelEl);
        document.body.appendChild(overlayEl);

        this.overlayEl = overlayEl;
        this.panelEl = panelEl;
        this.keydownHandler = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            this.close({ action: 'cancel' });
        };
        document.addEventListener('keydown', this.keydownHandler, true);

        window.setTimeout(() => {
            primaryButton.focus();
        }, 0);
    }

    close(result?: DeleteConfirmationResult): void {
        if (!this.isOpen && !this.resolvePromise) return;
        if (result) {
            this.result = result;
        }

        this.isOpen = false;
        this.overlayEl?.remove();
        this.overlayEl = null;
        this.panelEl = null;

        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler, true);
            this.keydownHandler = null;
        }

        if (this.resolvePromise) {
            this.resolvePromise(this.result);
            this.resolvePromise = null;
        }
    }

    async waitForResult(): Promise<DeleteConfirmationResult> {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;
        });
    }

    private appendActionButton(
        container: HTMLElement,
        label: string,
        action: DeleteConfirmationResult['action']
    ): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'canvas-mindmap-delete-btn';
        button.textContent = label;
        button.addEventListener('pointerdown', (event) => {
            event.stopPropagation();
        });
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.close({ action });
        });
        container.appendChild(button);
        return button;
    }
}
