import { App, ItemView, Notice } from 'obsidian';
import { DeleteConfirmationModal } from '../../ui/delete-modal';
import { DeleteEdgeConfirmationModal } from '../../ui/delete-edge-modal';
import {
    clearCanvasEdgeSelection,
    getEdgesFromCanvasOrFileData,
    getSelectedEdge,
    getSelectedNodeFromCanvas,
} from '../../utils/canvas-utils';
import { log } from '../../utils/logger';
import type { CanvasEdgeLike, CanvasLike, CanvasNodeLike } from '../types';

export interface DeleteOperationsHost {
    app: App;
    canvasManager: {
        deleteSelectedEdge(): Promise<void>;
        handleSingleDelete(node: CanvasNodeLike, canvas: CanvasLike): Promise<void>;
        handleCascadeDelete(node: CanvasNodeLike, canvas: CanvasLike): Promise<void>;
    };
    collapseStateManager: {
        getChildNodes(nodeId: string, edges: CanvasEdgeLike[]): unknown[];
        clearCache(): void;
    };
    getCanvasFromView(view: ItemView): CanvasLike | null;
    getEdgeSelectionFallbackKey(edge: CanvasEdgeLike): string;
    describeDeleteModalFocusContext(): string;
    openDeleteModalSafely(modal: { open: () => void }, kind: 'node' | 'edge', targetId: string): Promise<void>;
    waitForDeleteModalFocusSettle(kind: 'node' | 'edge', targetId: string): Promise<void>;
    syncSelectedEdgeState(canvas: CanvasLike, edge: CanvasEdgeLike): void;
    ensureEdgeSelectionFallbackClasses(edge: CanvasEdgeLike): void;
}

export async function executeDeleteEdgeOperation(
    host: DeleteOperationsHost,
    selectedEdge: CanvasEdgeLike,
    canvas: CanvasLike,
): Promise<void> {
    const edgeKey = host.getEdgeSelectionFallbackKey(selectedEdge);
    const modal = new DeleteEdgeConfirmationModal(host.app);
    const resultPromise = modal.waitForResult();
    log(
        `[Event] DeleteEdgeModalOpenRaw: edge=${edgeKey}, ` +
            `focusContext=${host.describeDeleteModalFocusContext()}`,
    );
    try {
        await host.openDeleteModalSafely(modal, 'edge', edgeKey);
    } catch (error) {
        log(`[Event] DeleteEdgeModalOpenError: ${String(error)}`);
        new Notice('删除连线确认框打开失败');
        return;
    }

    const result = await resultPromise;
    log(`[Event] DeleteEdgeModalResult: edge=${edgeKey}, action=${result.action}`);
    if (result.action !== 'confirm') return;

    await host.waitForDeleteModalFocusSettle('edge', edgeKey);
    host.syncSelectedEdgeState(canvas, selectedEdge);
    host.ensureEdgeSelectionFallbackClasses(selectedEdge);
    await host.canvasManager.deleteSelectedEdge();
}

export function handleDeleteButtonClick(host: DeleteOperationsHost, canvasView: ItemView): void {
    const canvas = host.getCanvasFromView(canvasView);
    if (!canvas) return;

    const selectedNode = getSelectedNodeFromCanvas(canvas);
    if (selectedNode) {
        const clearedState = clearCanvasEdgeSelection(canvas);
        if (clearedState.cleared) {
            log(
                `[Event] DeleteButtonPreferNode: node=${selectedNode.id || 'unknown'}, ` +
                    `clearedEdges=${clearedState.clearedEdgeIds.join('|') || 'none'}, domCleared=${clearedState.domClearedCount}`,
            );
        }
        void executeDeleteOperation(host, selectedNode, canvas);
        return;
    }

    const selectedEdge = getSelectedEdge(canvas);
    if (selectedEdge) {
        void executeDeleteEdgeOperation(host, selectedEdge, canvas);
    }
}

export async function executeDeleteOperation(
    host: DeleteOperationsHost,
    selectedNode: CanvasNodeLike,
    canvas: CanvasLike,
): Promise<void> {
    const edges = getEdgesFromCanvasOrFileData(canvas);

    const nodeId = selectedNode.id!;
    const hasChildren = host.collapseStateManager.getChildNodes(nodeId, edges).length > 0;

    const modal = new DeleteConfirmationModal(host.app, hasChildren);
    const resultPromise = modal.waitForResult();
    log(
        `[Event] DeleteNodeModalOpenRaw: node=${nodeId}, hasChildren=${hasChildren}, ` +
            `focusContext=${host.describeDeleteModalFocusContext()}`,
    );
    try {
        await host.openDeleteModalSafely(modal, 'node', nodeId);
    } catch (error) {
        log(`[Event] DeleteNodeModalOpenError: node=${nodeId}, error=${String(error)}`);
        new Notice('删除节点确认框打开失败');
        return;
    }

    const result = await resultPromise;
    log(`[Event] DeleteNodeModalResult: node=${nodeId}, action=${result.action}`);
    if (result.action === 'cancel') return;

    await host.waitForDeleteModalFocusSettle('node', nodeId);
    host.collapseStateManager.clearCache();
    log(`[Event] UI: 删除 ${nodeId} (${result.action})`);
    if (result.action === 'confirm' || result.action === 'single') {
        await host.canvasManager.handleSingleDelete(selectedNode, canvas);
    } else if (result.action === 'cascade') {
        await host.canvasManager.handleCascadeDelete(selectedNode, canvas);
    }
}