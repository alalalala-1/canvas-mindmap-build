import { App } from 'obsidian';

export interface DeleteEdgeConfirmationResult {
    action: 'cancel' | 'confirm';
}

export class DeleteEdgeConfirmationModal {
    private app: App;
    private result: DeleteEdgeConfirmationResult = { action: 'cancel' };
    private resolvePromise: ((result: DeleteEdgeConfirmationResult) => void) | null = null;
    private overlayEl: HTMLDivElement | null = null;
    private isOpen = false;
    private keydownHandler: ((event: KeyboardEvent) => void) | null = null;

    constructor(app: App) {
        this.app = app;
    }

    open(): void {
        if (this.isOpen) return;
        this.isOpen = true;
        this.result = { action: 'cancel' };

        const overlayEl = document.createElement('div');
        overlayEl.className = 'canvas-mindmap-delete-edge-overlay canvas-mindmap-delete-edge-modal';

        const panelEl = document.createElement('div');
        panelEl.className = 'canvas-mindmap-delete-edge-panel canvas-mindmap-delete-edge-modal canvas-mindmap-delete-edge-modal--simple';
        panelEl.setAttribute('role', 'dialog');
        panelEl.setAttribute('aria-modal', 'true');
        panelEl.setAttribute('aria-label', '确认删除连线');
        panelEl.tabIndex = -1;

        const titleEl = document.createElement('div');
        titleEl.className = 'canvas-mindmap-delete-title';
        titleEl.textContent = '确认删除连线';
        panelEl.appendChild(titleEl);

        const descriptionEl = document.createElement('p');
        descriptionEl.className = 'canvas-mindmap-delete-edge-description';
        descriptionEl.textContent = '确定要删除此连线及其箭头吗？';
        panelEl.appendChild(descriptionEl);

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'canvas-mindmap-delete-edge-actions';
        panelEl.appendChild(buttonContainer);

        const confirmBtn = this.appendActionButton(buttonContainer, '删除', 'confirm');
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
        this.keydownHandler = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            this.close({ action: 'cancel' });
        };
        document.addEventListener('keydown', this.keydownHandler, true);

        window.setTimeout(() => {
            confirmBtn.focus();
        }, 0);
    }

    close(result?: DeleteEdgeConfirmationResult): void {
        if (!this.isOpen && !this.resolvePromise) return;
        if (result) {
            this.result = result;
        }

        this.isOpen = false;
        this.overlayEl?.remove();
        this.overlayEl = null;

        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler, true);
            this.keydownHandler = null;
        }

        if (this.resolvePromise) {
            this.resolvePromise(this.result);
            this.resolvePromise = null;
        }
    }

    async waitForResult(): Promise<DeleteEdgeConfirmationResult> {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;
        });
    }

    private appendActionButton(
        container: HTMLElement,
        label: string,
        action: DeleteEdgeConfirmationResult['action']
    ): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'canvas-mindmap-delete-edge-btn';
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
