import { App, ItemView, Notice } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../../settings/types';
import { CollapseStateManager } from '../../state/collapse-state';
import { CanvasFileService, UpdateCallback } from './canvas-file-service';
import { DeleteConfirmationModal } from '../../ui/delete-modal';
import { CONSTANTS } from '../../constants';
import {
    generateRandomId,
    getEdgeFromNodeId,
    getEdgeToNodeId,
    getCurrentCanvasFilePath,
    getCanvasView,
    getNodesFromCanvas,
    getEdgesFromCanvas
} from '../../utils/canvas-utils';
import { log } from '../../utils/logger';
import { CanvasLike, CanvasNodeLike, CanvasEdgeLike, CanvasDataLike, ICanvasManager } from '../types';

export class NodeDeletionService {
    private app: App;
    private settings: CanvasMindmapBuildSettings;
    private collapseStateManager: CollapseStateManager;
    private canvasFileService: CanvasFileService;
    private canvasManager: ICanvasManager | null = null;

    constructor(
        app: App,
        settings: CanvasMindmapBuildSettings,
        collapseStateManager: CollapseStateManager,
        canvasFileService: CanvasFileService
    ) {
        this.app = app;
        this.settings = settings;
        this.collapseStateManager = collapseStateManager;
        this.canvasFileService = canvasFileService;
    }

    setCanvasManager(canvasManager: ICanvasManager): void {
        this.canvasManager = canvasManager;
    }

    async executeDeleteOperation(selectedNode: CanvasNodeLike, canvas: CanvasLike): Promise<void> {
        log(`[UI] 删除节点: ${selectedNode.id}`);
        const edges = this.getEdgesFromCanvas(canvas);
        const nodeId = selectedNode.id!;
        const hasChildren = this.collapseStateManager.getChildNodes(nodeId, edges).length > 0;

        const modal = new DeleteConfirmationModal(this.app, hasChildren);
        modal.open();
        const result = await modal.waitForResult();

        if (result.action === 'cancel') return;

        if (result.action === 'confirm' || result.action === 'single') {
            await this.handleSingleDelete(selectedNode, canvas);
        } else if (result.action === 'cascade') {
            await this.handleCascadeDelete(selectedNode, canvas);
        }
    }

    async handleSingleDelete(node: CanvasNodeLike, canvas: CanvasLike): Promise<void> {
        try {
            log(`[Delete] 单节点: ${node.id}`);
            const edges = this.getEdgesFromCanvas(canvas);
            const allNodes = this.getNodesFromCanvas(canvas);
            const nodeId = node.id!;
            const parentNode = this.findParentNode(nodeId, edges, allNodes);
            const childNodes = this.collapseStateManager.getChildNodes(nodeId, edges);
            const canvasFilePath = getCurrentCanvasFilePath(this.app);

            if (!canvasFilePath) throw new Error('无法获取路径');

            if (parentNode && childNodes.length > 0) {
                const newEdges: CanvasEdgeLike[] = [];
                for (const childId of childNodes) {
                    newEdges.push({
                        id: generateRandomId(),
                        fromNode: parentNode.id!,
                        fromSide: 'right',
                        toNode: childId,
                        toSide: 'left'
                    });
                }

                await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (data) => {
                    data.nodes = data.nodes?.filter(n => n.id !== nodeId) || [];
                    data.edges = data.edges?.filter(e => {
                        const fromId = getEdgeFromNodeId(e);
                        const toId = getEdgeToNodeId(e);
                        return fromId !== nodeId && toId !== nodeId;
                    }) || [];
                    data.edges?.push(...newEdges);
                    return true;
                });
            } else {
                await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (data) => {
                    data.nodes = data.nodes?.filter(n => n.id !== nodeId) || [];
                    data.edges = data.edges?.filter(e => {
                        const fromId = getEdgeFromNodeId(e);
                        const toId = getEdgeToNodeId(e);
                        return fromId !== nodeId && toId !== nodeId;
                    }) || [];
                    return true;
                });
            }

            this.collapseStateManager.clearCache();
            this.reloadCanvas(canvas);
            setTimeout(() => this.refreshCollapseButtons(), CONSTANTS.TIMING.BUTTON_REFRESH_DELAY);

            new Notice('节点已删除');
        } catch (err) {
            log(`[Delete] 失败:`, err);
            new Notice('删除失败');
        }
    }

    async handleCascadeDelete(node: CanvasNodeLike, canvas: CanvasLike): Promise<void> {
        try {
            log(`[Delete] 级联: ${node.id}`);
            const edges = this.getEdgesFromCanvas(canvas);
            const nodeId = node.id!;

            const nodesToDelete = new Set<string>();
            nodesToDelete.add(nodeId);
            const canvasFilePath = getCurrentCanvasFilePath(this.app);

            if (!canvasFilePath) throw new Error('无法获取路径');

            const collectDescendants = (parentId: string) => {
                const directChildren = this.collapseStateManager.getChildNodes(parentId, edges);
                for (const childId of directChildren) {
                    if (!nodesToDelete.has(childId)) {
                        nodesToDelete.add(childId);
                        collectDescendants(childId);
                    }
                }
            };

            collectDescendants(nodeId);


            await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (data) => {
                data.nodes = data.nodes?.filter(n => n.id && !nodesToDelete.has(n.id)) || [];
                data.edges = data.edges?.filter(e => {
                    const fromId = getEdgeFromNodeId(e);
                    const toId = getEdgeToNodeId(e);
                    return !nodesToDelete.has(fromId || '') && !nodesToDelete.has(toId || '');
                }) || [];
                return true;
            });

            this.collapseStateManager.clearCache();
            this.reloadCanvas(canvas);
            setTimeout(() => this.refreshCollapseButtons(), CONSTANTS.TIMING.BUTTON_REFRESH_DELAY);

            new Notice(`已删除 ${nodesToDelete.size} 个节点`);
        } catch (err) {
            log(`[Delete] 级联失败:`, err);
            new Notice('删除失败');
        }
    }

    private reloadCanvas(canvas: CanvasLike): void {
        const canvasWithReload = canvas as CanvasLike & { reload?: () => void };
        if (typeof canvasWithReload.reload === 'function') {
            canvasWithReload.reload();
        } else if (typeof canvas.requestUpdate === 'function') {
            canvas.requestUpdate();
        } else if (typeof canvas.requestSave === 'function') {
            canvas.requestSave();
        }
        log(`[Delete] 刷新 Canvas`);
    }

    private getEdgesFromCanvas(canvas: CanvasLike): CanvasEdgeLike[] {
        if (canvas.fileData?.edges) return canvas.fileData.edges as CanvasEdgeLike[];
        return getEdgesFromCanvas(canvas);
    }

    private getNodesFromCanvas(canvas: CanvasLike): CanvasNodeLike[] {
        return getNodesFromCanvas(canvas);
    }

    private findParentNode(nodeId: string, edges: CanvasEdgeLike[], allNodes: CanvasNodeLike[]): CanvasNodeLike | null {
        for (const edge of edges) {
            const fromId = getEdgeFromNodeId(edge);
            const toId = getEdgeToNodeId(edge);

            if (toId === nodeId && fromId) {
                const parentNode = allNodes.find(n => n.id === fromId);
                if (parentNode) return parentNode;
            }
        }
        return null;
    }

    private refreshCollapseButtons(): void {
        log(`[Delete] refreshCollapseButtons 被调用, canvasManager=${this.canvasManager ? 'exists' : 'null'}`);
        if (this.canvasManager) {
            this.canvasManager.checkAndAddCollapseButtons();
        } else {
            log(`[Delete] canvasManager 未设置，尝试从视图获取`);
            const canvasView = this.getCanvasView();
            if (canvasView) {
                const viewWithPlugin = canvasView as ItemView & { plugin?: { canvasManager?: ICanvasManager } };
                const canvasManager = viewWithPlugin.plugin?.canvasManager;
                if (canvasManager) {
                    canvasManager.checkAndAddCollapseButtons();
                }
            }
        }
    }

    private getCanvasView(): ItemView | null {
        return getCanvasView(this.app);
    }
}
