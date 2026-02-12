import { App, ItemView, Notice } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../../settings/types';
import { CollapseStateManager } from '../../state/collapse-state';
import { CanvasFileService } from './canvas-file-service';
import { DeleteConfirmationModal } from '../../ui/delete-modal';
import {
    generateRandomId,
    getEdgeFromNodeId,
    getEdgeToNodeId,
    getCurrentCanvasFilePath,
    getCanvasView
} from '../../utils/canvas-utils';
import { log } from '../../utils/logger';

/**
 * 节点删除服务
 * 负责删除节点（支持单节点删除和级联删除）
 */
export class NodeDeletionService {
    private app: App;
    private settings: CanvasMindmapBuildSettings;
    private collapseStateManager: CollapseStateManager;
    private canvasFileService: CanvasFileService;
    private canvasManager: any;

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

    setCanvasManager(canvasManager: any): void {
        this.canvasManager = canvasManager;
    }

    /**
     * 执行删除操作（显示确认对话框）
     */
    async executeDeleteOperation(selectedNode: any, canvas: any): Promise<void> {
        log(`[UI] 删除节点: ${selectedNode.id}`);
        const edges = this.getEdgesFromCanvas(canvas);
        const hasChildren = this.collapseStateManager.getChildNodes(selectedNode.id, edges).length > 0;

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

    /**
     * 处理单节点删除（将子节点连接到父节点）
     */
    async handleSingleDelete(node: any, canvas: any): Promise<void> {
        try {
            log(`[Delete] 单节点: ${node.id}`);
            const edges = this.getEdgesFromCanvas(canvas);
            const allNodes = Array.from(canvas.nodes.values()) as any[];
            const parentNode = this.findParentNode(node.id, edges, allNodes);
            const childNodes = this.collapseStateManager.getChildNodes(node.id, edges);
            const canvasFilePath = getCurrentCanvasFilePath(this.app);

            if (!canvasFilePath) throw new Error('无法获取路径');

            if (parentNode && childNodes.length > 0) {

                const newEdges: any[] = [];
                for (const childId of childNodes) {
                    newEdges.push({
                        id: generateRandomId(),
                        fromNode: parentNode.id,
                        fromSide: 'right',
                        toNode: childId,
                        toSide: 'left'
                    });
                }

                await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (data: any) => {
                    data.nodes = data.nodes.filter((n: any) => n.id !== node.id);
                    data.edges = data.edges.filter((e: any) => {
                        const fromId = getEdgeFromNodeId(e);
                        const toId = getEdgeToNodeId(e);
                        return fromId !== node.id && toId !== node.id;
                    });
                    data.edges.push(...newEdges);
                    return true;
                });
            } else {
                await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (data: any) => {
                    data.nodes = data.nodes.filter((n: any) => n.id !== node.id);
                    data.edges = data.edges.filter((e: any) => {
                        const fromId = getEdgeFromNodeId(e);
                        const toId = getEdgeToNodeId(e);
                        return fromId !== node.id && toId !== node.id;
                    });
                    return true;
                });
            }

            this.collapseStateManager.clearCache();
            this.reloadCanvas(canvas);
            setTimeout(() => this.refreshCollapseButtons(), 200);

            new Notice('节点已删除');
        } catch (err) {
            log(`[Delete] 失败:`, err);
            new Notice('删除失败');
        }
    }

    /**
     * 处理级联删除（删除节点及其所有后代）
     */
    async handleCascadeDelete(node: any, canvas: any): Promise<void> {
        try {
            log(`[Delete] 级联: ${node.id}`);
            const edges = this.getEdgesFromCanvas(canvas);

            const nodesToDelete = new Set<string>();
            nodesToDelete.add(node.id);
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

            collectDescendants(node.id);


            await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (data: any) => {
                data.nodes = data.nodes.filter((n: any) => !nodesToDelete.has(n.id));
                data.edges = data.edges.filter((e: any) => {
                    const fromId = getEdgeFromNodeId(e);
                    const toId = getEdgeToNodeId(e);
                    return !nodesToDelete.has(fromId || '') && !nodesToDelete.has(toId || '');
                });
                return true;
            });

            this.collapseStateManager.clearCache();
            this.reloadCanvas(canvas);
            setTimeout(() => this.refreshCollapseButtons(), 200);

            new Notice(`已删除 ${nodesToDelete.size} 个节点`);
        } catch (err) {
            log(`[Delete] 级联失败:`, err);
            new Notice('删除失败');
        }
    }

    /**
     * 刷新 Canvas 显示
     */
    private reloadCanvas(canvas: any): void {
        if (typeof canvas.reload === 'function') {
            canvas.reload();
        } else if (typeof canvas.requestUpdate === 'function') {
            canvas.requestUpdate();
        } else if (typeof canvas.requestSave === 'function') {
            canvas.requestSave();
        }
        log(`[Delete] 刷新 Canvas`);
    }

    /**
     * 从 canvas 获取边列表
     */
    private getEdgesFromCanvas(canvas: any): any[] {
        if (canvas.fileData?.edges) return canvas.fileData.edges;
        if (canvas.edges) return Array.from(canvas.edges.values());
        return [];
    }

    /**
     * 查找节点的父节点
     */
    private findParentNode(nodeId: string, edges: any[], allNodes: any[]): any | null {
        for (const edge of edges) {
            const fromId = getEdgeFromNodeId(edge);
            const toId = getEdgeToNodeId(edge);

            if (toId === nodeId && fromId) {
                const parentNode = allNodes.find((n: any) => n.id === fromId);
                if (parentNode) return parentNode;
            }
        }
        return null;
    }

    /**
     * 刷新折叠按钮
     */
    private refreshCollapseButtons(): void {
        log(`[Delete] refreshCollapseButtons 被调用, canvasManager=${this.canvasManager ? 'exists' : 'null'}`);
        if (this.canvasManager) {
            this.canvasManager.checkAndAddCollapseButtons();
        } else {
            log(`[Delete] canvasManager 未设置，尝试从视图获取`);
            const canvasView = this.getCanvasView();
            if (canvasView) {
                const canvasManager = (canvasView as any).plugin?.canvasManager;
                if (canvasManager) {
                    canvasManager.checkAndAddCollapseButtons();
                }
            }
        }
    }

    /**
     * 获取 Canvas 视图
     */
    private getCanvasView(): ItemView | null {
        return getCanvasView(this.app);
    }
}
