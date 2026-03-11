import { App, ItemView, Notice, Plugin } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../../settings/types';
import { CollapseStateManager } from '../../state/collapse-state';
import { CanvasFileService } from './canvas-file-service';
import { CONSTANTS } from '../../constants';
import {
    buildEdgeIdSet,
    clearCanvasSelection,
    generateRandomId,
    getCurrentCanvasFilePath,
    getCanvasView,
    getEdgeFromNodeId,
    getEdgeToNodeId,
    getEdgesFromCanvas,
    getNodesFromCanvas
} from '../../utils/canvas-utils';
import { log } from '../../utils/logger';
import {
    CanvasDataLike,
    CanvasLike,
    CanvasNodeLike,
    CanvasEdgeLike,
    CanvasViewLike,
    ICanvasManager,
    PluginWithLastClicked
} from '../types';

type GraphSnapshot = {
    nodes: CanvasNodeLike[];
    edges: CanvasEdgeLike[];
};

type SingleDeletePlan = {
    source: 'single';
    nodeId: string;
    canvasFilePath: string;
    nodesToDelete: Set<string>;
    parentNodeId: string | null;
    childNodeIds: string[];
    reconnectEdges: CanvasEdgeLike[];
};

type CascadeDeletePlan = {
    source: 'cascade';
    nodeId: string;
    canvasFilePath: string;
    nodesToDelete: Set<string>;
};

type DeletePlan = SingleDeletePlan | CascadeDeletePlan;

type MetadataWithNodeMaps = {
    floatingNodes?: Record<string, unknown>;
    collapseState?: Record<string, unknown>;
    [key: string]: unknown;
};

export class NodeDeletionService {
    private app: App;
    private plugin: Plugin;
    private settings: CanvasMindmapBuildSettings;
    private collapseStateManager: CollapseStateManager;
    private canvasFileService: CanvasFileService;
    private canvasManager: ICanvasManager | null = null;

    constructor(
        app: App,
        plugin: Plugin,
        settings: CanvasMindmapBuildSettings,
        collapseStateManager: CollapseStateManager,
        canvasFileService: CanvasFileService
    ) {
        this.app = app;
        this.plugin = plugin;
        this.settings = settings;
        this.collapseStateManager = collapseStateManager;
        this.canvasFileService = canvasFileService;
    }

    setCanvasManager(canvasManager: ICanvasManager): void {
        this.canvasManager = canvasManager;
    }

    async handleSingleDelete(node: CanvasNodeLike, canvas: CanvasLike): Promise<void> {
        let effectiveCanvas: CanvasLike | null = canvas;
        try {
            const nodeId = node.id!;
            log(`[Delete] 单节点开始: ${nodeId}`);

            const canvasFilePath = this.resolveCanvasFilePath(canvas);
            if (!canvasFilePath) throw new Error('无法获取路径');

            this.canvasManager?.startDeletingOperation();
            this.clearDeletionRuntimeContext(canvas, 'single', nodeId, canvasFilePath);

            const plan = await this.buildSingleDeletePlan(node, canvas, canvasFilePath);
            this.logDeletePlan(plan);

            const deleted = await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (data) => {
                return this.applyDeletePlan(data, plan);
            });

            if (!deleted) {
                throw new Error(`未能从文件中删除节点: ${nodeId}`);
            }

            this.collapseStateManager.clearCache();
            effectiveCanvas = await this.refreshCanvasAfterDelete(
                canvasFilePath,
                canvas,
                `delete-node:${nodeId}`
            );
            setTimeout(() => void this.refreshCollapseButtons(), CONSTANTS.TIMING.BUTTON_REFRESH_DELAY);

            new Notice('节点已删除');
        } catch (err) {
            log(`[Delete] 失败:`, err);
            new Notice('删除失败');
        } finally {
            this.canvasManager?.endDeletingOperation(effectiveCanvas);
        }
    }

    async handleCascadeDelete(node: CanvasNodeLike, canvas: CanvasLike): Promise<void> {
        let effectiveCanvas: CanvasLike | null = canvas;
        try {
            const nodeId = node.id!;
            log(`[Delete] 级联删除开始: ${nodeId}`);

            const canvasFilePath = this.resolveCanvasFilePath(canvas);
            if (!canvasFilePath) throw new Error('无法获取路径');

            this.canvasManager?.startDeletingOperation();
            this.clearDeletionRuntimeContext(canvas, 'cascade', nodeId, canvasFilePath);

            const plan = await this.buildCascadeDeletePlan(node, canvas, canvasFilePath);
            this.logDeletePlan(plan);

            const deleted = await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (data) => {
                return this.applyDeletePlan(data, plan);
            });

            if (!deleted) {
                throw new Error(`未能从文件中级联删除节点: ${nodeId}`);
            }

            this.collapseStateManager.clearCache();
            effectiveCanvas = await this.refreshCanvasAfterDelete(
                canvasFilePath,
                canvas,
                `delete-node-cascade:${nodeId}`
            );
            setTimeout(() => this.refreshCollapseButtons(), CONSTANTS.TIMING.BUTTON_REFRESH_DELAY);

            new Notice(`已删除 ${plan.nodesToDelete.size} 个节点`);
        } catch (err) {
            log(`[Delete] 级联失败:`, err);
            new Notice('删除失败');
        } finally {
            this.canvasManager?.endDeletingOperation(effectiveCanvas);
        }
    }

    private resolveCanvasFilePath(canvas: CanvasLike): string | undefined {
        return canvas.file?.path
            || getCurrentCanvasFilePath(this.app)
            || this.settings.canvasFilePath
            || undefined;
    }

    private async buildSingleDeletePlan(
        node: CanvasNodeLike,
        canvas: CanvasLike,
        canvasFilePath: string
    ): Promise<SingleDeletePlan> {
        const nodeId = node.id!;
        const snapshot = await this.getGraphSnapshot(canvas, canvasFilePath);
        const parentNode = this.findParentNode(nodeId, snapshot.edges, snapshot.nodes);
        const childNodeIds = this.collapseStateManager.getChildNodes(nodeId, snapshot.edges);
        const reconnectEdges = this.buildReconnectEdges(
            parentNode?.id || null,
            childNodeIds,
            snapshot.edges,
            new Set([nodeId])
        );

        return {
            source: 'single',
            nodeId,
            canvasFilePath,
            nodesToDelete: new Set([nodeId]),
            parentNodeId: parentNode?.id || null,
            childNodeIds,
            reconnectEdges
        };
    }

    private async buildCascadeDeletePlan(
        node: CanvasNodeLike,
        canvas: CanvasLike,
        canvasFilePath: string
    ): Promise<CascadeDeletePlan> {
        const nodeId = node.id!;
        const snapshot = await this.getGraphSnapshot(canvas, canvasFilePath);
        const nodesToDelete = new Set<string>([nodeId]);

        const collectDescendants = (parentId: string) => {
            const directChildren = this.collapseStateManager.getChildNodes(parentId, snapshot.edges);
            for (const childId of directChildren) {
                if (nodesToDelete.has(childId)) continue;
                nodesToDelete.add(childId);
                collectDescendants(childId);
            }
        };

        collectDescendants(nodeId);

        return {
            source: 'cascade',
            nodeId,
            canvasFilePath,
            nodesToDelete
        };
    }

    private async getGraphSnapshot(canvas: CanvasLike, canvasFilePath: string): Promise<GraphSnapshot> {
        const latestData = await this.canvasFileService.readCanvasData(canvasFilePath);
        if (latestData) {
            return {
                nodes: Array.isArray(latestData.nodes) ? latestData.nodes : [],
                edges: Array.isArray(latestData.edges) ? latestData.edges : []
            };
        }

        return {
            nodes: this.getNodesFromCanvas(canvas),
            edges: this.getEdgesFromCanvas(canvas)
        };
    }

    private buildReconnectEdges(
        parentNodeId: string | null,
        childNodeIds: string[],
        existingEdges: CanvasEdgeLike[],
        nodesToDelete: Set<string>
    ): CanvasEdgeLike[] {
        if (!parentNodeId || nodesToDelete.has(parentNodeId) || childNodeIds.length <= 0) {
            return [];
        }

        const reconnectEdges: CanvasEdgeLike[] = [];
        const existingEdgeIds = buildEdgeIdSet(existingEdges);

        for (const childId of childNodeIds) {
            if (!childId || childId === parentNodeId || nodesToDelete.has(childId)) continue;

            const candidateKey = `${parentNodeId}->${childId}`;
            if (existingEdgeIds.has(candidateKey)) continue;

            reconnectEdges.push({
                id: generateRandomId(),
                fromNode: parentNodeId,
                fromSide: 'right',
                toNode: childId,
                toSide: 'left'
            });
            existingEdgeIds.add(candidateKey);
        }

        return reconnectEdges;
    }

    private applyDeletePlan(data: CanvasDataLike, plan: DeletePlan): boolean {
        if (!Array.isArray(data.nodes)) data.nodes = [];
        if (!Array.isArray(data.edges)) data.edges = [];

        const previousNodeCount = data.nodes.length;
        const previousEdgeCount = data.edges.length;
        const previousHistoryCount = Array.isArray(data.canvasMindmapBuildHistory)
            ? data.canvasMindmapBuildHistory.length
            : 0;

        data.nodes = data.nodes.filter((candidateNode) => {
            return !(candidateNode.id && plan.nodesToDelete.has(candidateNode.id));
        });

        data.edges = data.edges.filter((edge) => {
            const fromId = getEdgeFromNodeId(edge);
            const toId = getEdgeToNodeId(edge);
            return !plan.nodesToDelete.has(fromId || '') && !plan.nodesToDelete.has(toId || '');
        });

        if (plan.source === 'single' && plan.reconnectEdges.length > 0) {
            const edgeIds = buildEdgeIdSet(data.edges);
            for (const reconnectEdge of plan.reconnectEdges) {
                const reconnectKey = `${reconnectEdge.fromNode || 'unknown'}->${reconnectEdge.toNode || 'unknown'}`;
                if (edgeIds.has(reconnectKey)) continue;
                data.edges.push(reconnectEdge);
                edgeIds.add(reconnectKey);
            }
        }

        if (Array.isArray(data.canvasMindmapBuildHistory)) {
            data.canvasMindmapBuildHistory = data.canvasMindmapBuildHistory.filter((historyNodeId) => {
                return !plan.nodesToDelete.has(historyNodeId);
            });
        }

        const metadataChanged = this.cleanupDeletedNodeMetadata(data, plan.nodesToDelete);

        const changed = previousNodeCount !== data.nodes.length
            || previousEdgeCount !== data.edges.length
            || previousHistoryCount !== (data.canvasMindmapBuildHistory?.length || 0)
            || metadataChanged;

        if (!changed) {
            log(`[Delete] 文件计划未产生修改: source=${plan.source}, node=${plan.nodeId}`);
        }

        return changed;
    }

    private cleanupDeletedNodeMetadata(data: CanvasDataLike, nodesToDelete: Set<string>): boolean {
        const metadata = data.metadata as MetadataWithNodeMaps | undefined;
        if (!metadata) return false;

        let changed = false;
        const cleanupRecord = (record: Record<string, unknown> | undefined): boolean => {
            if (!record) return false;
            let localChanged = false;
            for (const nodeId of nodesToDelete) {
                if (!(nodeId in record)) continue;
                delete record[nodeId];
                localChanged = true;
            }
            return localChanged;
        };

        if (cleanupRecord(metadata.floatingNodes)) changed = true;
        if (cleanupRecord(metadata.collapseState)) changed = true;

        return changed;
    }

    private clearDeletionRuntimeContext(
        canvas: CanvasLike,
        source: DeletePlan['source'],
        nodeId: string,
        canvasFilePath: string
    ): void {
        const clearedSelectionState = clearCanvasSelection(canvas);
        if (clearedSelectionState.cleared) {
            log(
                `[Delete] 清理删除前运行时选择: source=${source}, node=${nodeId}, ` +
                `nodes=${clearedSelectionState.clearedNodeIds.join('|') || 'none'}, ` +
                `edges=${clearedSelectionState.clearedEdgeIds.join('|') || 'none'}, ` +
                `domNodes=${clearedSelectionState.domNodeClearedCount}, domEdges=${clearedSelectionState.domEdgeClearedCount}`
            );
        }

        this.clearSuspiciousWorkspaceFocusContext(source, nodeId);
        this.clearPluginInteractionContext(source, nodeId, canvasFilePath);
    }

    private clearSuspiciousWorkspaceFocusContext(source: DeletePlan['source'], nodeId: string): void {
        const activeViewType = this.app.workspace.getActiveViewOfType(ItemView)?.getViewType?.() || 'none';
        const workspaceRecord = this.app.workspace as unknown as {
            activeEditor?: { editor?: unknown } | null;
        };
        const activeEditorInfo = workspaceRecord.activeEditor;
        const suspicious = activeViewType === 'canvas' && !!activeEditorInfo && !activeEditorInfo.editor;
        if (!suspicious) return;

        try {
            workspaceRecord.activeEditor = null;
        } catch {
            try {
                delete workspaceRecord.activeEditor;
            } catch {
                // ignore assignment/delete failures on Obsidian internals
            }
        }

        log(`[Delete] 清理可疑 focus 上下文: source=${source}, node=${nodeId}, activeView=${activeViewType}`);
    }

    private clearPluginInteractionContext(source: DeletePlan['source'], nodeId: string, canvasFilePath: string): void {
        const pluginContext = this.plugin as PluginWithLastClicked;
        const previousNodeId = pluginContext.lastClickedNodeId || null;
        const previousCanvasFilePath = pluginContext.lastClickedCanvasFilePath || null;
        const previousNavNodeId = pluginContext.lastNavigationSourceNodeId || null;

        pluginContext.lastClickedNodeId = null;
        pluginContext.lastClickedCanvasFilePath = null;
        pluginContext.lastNavigationSourceNodeId = null;

        if (previousNodeId || previousCanvasFilePath || previousNavNodeId) {
            log(
                `[Delete] 清理插件交互上下文: source=${source}, node=${nodeId}, canvas=${canvasFilePath}, ` +
                `prevNode=${previousNodeId || 'none'}, prevCanvas=${previousCanvasFilePath || 'none'}, ` +
                `prevNavNode=${previousNavNodeId || 'none'}`
            );
        }
    }

    private async refreshCanvasAfterDelete(
        canvasFilePath: string,
        fallbackCanvas: CanvasLike,
        reason: string
    ): Promise<CanvasLike | null> {
        const refreshed = await this.canvasManager?.refreshCanvasViewsForFile?.(canvasFilePath, reason) || 0;
        const freshCanvas = this.getActiveCanvasForFile(canvasFilePath);

        if (freshCanvas) {
            const clearedSelectionState = clearCanvasSelection(freshCanvas);
            if (clearedSelectionState.cleared) {
                log(
                    `[Delete] 刷新后再次清理选择态: reason=${reason}, ` +
                    `nodes=${clearedSelectionState.clearedNodeIds.join('|') || 'none'}, ` +
                    `edges=${clearedSelectionState.clearedEdgeIds.join('|') || 'none'}`
                );
            }
            freshCanvas.requestUpdate?.();
            return freshCanvas;
        }

        if (refreshed > 0) {
            log(`[Delete] 视图已刷新但未获取到活动 canvas: reason=${reason}, file=${canvasFilePath}`);
            return null;
        }

        log(`[Delete] 未命中 canvas leaf，使用运行时软刷新兜底: reason=${reason}, file=${canvasFilePath}`);
        clearCanvasSelection(fallbackCanvas);
        fallbackCanvas.requestUpdate?.();
        fallbackCanvas.requestSave?.();
        return fallbackCanvas;
    }

    private getActiveCanvasForFile(canvasFilePath: string): CanvasLike | null {
        const canvasView = this.getCanvasView() as CanvasViewLike | null;
        if (!canvasView) return null;

        const activeFilePath = canvasView.canvas?.file?.path || canvasView.file?.path || null;
        if (activeFilePath !== canvasFilePath) return null;

        return canvasView.canvas || null;
    }

    private logDeletePlan(plan: DeletePlan): void {
        if (plan.source === 'single') {
            log(
                `[Delete] 删除计划(single): node=${plan.nodeId}, canvas=${plan.canvasFilePath}, ` +
                `parent=${plan.parentNodeId || 'none'}, children=${plan.childNodeIds.join('|') || 'none'}, ` +
                `reconnect=${plan.reconnectEdges.length}`
            );
            return;
        }

        log(
            `[Delete] 删除计划(cascade): node=${plan.nodeId}, canvas=${plan.canvasFilePath}, ` +
            `nodes=${Array.from(plan.nodesToDelete).join('|') || 'none'}`
        );
    }

    private getEdgesFromCanvas(canvas: CanvasLike): CanvasEdgeLike[] {
        if (canvas.fileData?.edges) return canvas.fileData.edges;
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
            void this.canvasManager.checkAndAddCollapseButtons();
        } else {
            log(`[Delete] canvasManager 未设置，尝试从视图获取`);
            const canvasView = this.getCanvasView();
            if (canvasView) {
                const viewWithPlugin = canvasView as ItemView & { plugin?: { canvasManager?: ICanvasManager } };
                const canvasManager = viewWithPlugin.plugin?.canvasManager;
                if (canvasManager) {
                    void canvasManager.checkAndAddCollapseButtons();
                }
            }
        }
    }

    private getCanvasView(): ItemView | null {
        return getCanvasView(this.app);
    }
}
