import { App, ItemView, Notice } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../../settings/types';
import { CollapseStateManager } from '../../state/collapse-state';
import { CanvasFileService } from './canvas-file-service';
import { DeleteConfirmationModal } from '../../ui/delete-modal';
import { generateRandomId, getNodeIdFromEdgeEndpoint } from '../../utils/canvas-utils';
import { error } from '../../utils/logger';

/**
 * 节点删除服务
 * 负责删除节点（支持单节点删除和级联删除）
 */
export class NodeDeletionService {
    private app: App;
    private settings: CanvasMindmapBuildSettings;
    private collapseStateManager: CollapseStateManager;
    private canvasFileService: CanvasFileService;

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

    /**
     * 执行删除操作（显示确认对话框）
     */
    async executeDeleteOperation(selectedNode: any, canvas: any): Promise<void> {
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
            const edges = this.getEdgesFromCanvas(canvas);
            const allNodes = Array.from(canvas.nodes.values()) as any[];
            const parentNode = this.findParentNode(node.id, edges, allNodes);
            const childNodes = this.collapseStateManager.getChildNodes(node.id, edges);
            const canvasFilePath = canvas.file?.path;

            if (!canvasFilePath) {
                throw new Error('无法获取 Canvas 文件路径');
            }

            if (parentNode && childNodes.length > 0) {
                // 创建新的边连接父节点到子节点
                const newEdges: any[] = [];
                for (const childId of childNodes) {
                    const newEdge = {
                        id: generateRandomId(),
                        fromNode: parentNode.id,
                        fromSide: 'right',
                        toNode: childId,
                        toSide: 'left'
                    };
                    newEdges.push(newEdge);
                }

                await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (data: any) => {
                    const initialCount = data.nodes.length;
                    data.nodes = data.nodes.filter((n: any) => n.id !== node.id);
                    data.edges = data.edges.filter((e: any) =>
                        e.fromNode !== node.id && e.toNode !== node.id
                    );
                    data.edges.push(...newEdges);
                    return data.nodes.length !== initialCount;
                });
            } else {
                await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (data: any) => {
                    const initialCount = data.nodes.length;
                    data.nodes = data.nodes.filter((n: any) => n.id !== node.id);
                    data.edges = data.edges.filter((e: any) =>
                        e.fromNode !== node.id && e.toNode !== node.id
                    );
                    return data.nodes.length !== initialCount;
                });
            }

            this.collapseStateManager.clearCache();
            this.refreshCollapseButtons();

            if (typeof canvas.reload === 'function') {
                canvas.reload();
            }

            new Notice('节点删除成功！');
        } catch (err) {
            error('删除节点失败:', err);
            new Notice('删除操作失败，请重试');
        }
    }

    /**
     * 处理级联删除（删除节点及其所有后代）
     */
    async handleCascadeDelete(node: any, canvas: any): Promise<void> {
        try {
            const edges = this.getEdgesFromCanvas(canvas);
            const nodesToDelete = new Set<string>();
            nodesToDelete.add(node.id);
            const canvasFilePath = canvas.file?.path;

            if (!canvasFilePath) {
                throw new Error('无法获取 Canvas 文件路径');
            }

            // 递归收集所有后代节点
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
                const initialCount = data.nodes.length;
                data.nodes = data.nodes.filter((n: any) => !nodesToDelete.has(n.id));
                data.edges = data.edges.filter((e: any) =>
                    !nodesToDelete.has(e.fromNode) && !nodesToDelete.has(e.toNode)
                );
                return data.nodes.length !== initialCount;
            });

            this.collapseStateManager.clearCache();
            this.refreshCollapseButtons();

            if (typeof canvas.reload === 'function') {
                canvas.reload();
            }

            new Notice(`成功删除 ${nodesToDelete.size} 个节点！`);
        } catch (err) {
            error('级联删除节点失败:', err);
            new Notice('删除节点失败，请查看控制台');
        }
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
            const fromId = getNodeIdFromEdgeEndpoint(edge.from);
            const toId = getNodeIdFromEdgeEndpoint(edge.to);

            if (toId === nodeId) {
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
        const canvasView = this.getCanvasView();
        if (canvasView) {
            const canvasManager = (canvasView as any).plugin?.canvasManager;
            if (canvasManager) {
                canvasManager.checkAndAddCollapseButtons();
            }
        }
    }

    /**
     * 获取 Canvas 视图
     */
    private getCanvasView(): ItemView | null {
        const activeLeaf = this.app.workspace.activeLeaf;
        if (activeLeaf?.view && (activeLeaf.view as any).canvas) {
            return activeLeaf.view as ItemView;
        }

        const leaves = this.app.workspace.getLeavesOfType('canvas');
        for (const leaf of leaves) {
            if (leaf.view && (leaf.view as any).canvas) {
                return leaf.view as ItemView;
            }
        }

        const view = this.app.workspace.getActiveViewOfType(ItemView);
        if (view && view.getViewType() === 'canvas') {
            return view;
        }

        return null;
    }
}
