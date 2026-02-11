import { App, ItemView, Notice, Plugin, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../settings/types';
import { CollapseStateManager } from '../state/collapse-state';
import { CanvasFileService } from './services/canvas-file-service';
import { log } from '../utils/logger';
import { arrangeLayout as originalArrangeLayout, CanvasArrangerSettings } from './layout';
import { FloatingNodeService } from './services/floating-node-service';

import { VisibilityService } from './services/visibility-service';
import { LayoutDataProvider } from './services/layout-data-provider';

/**
 * 布局管理器 - 负责Canvas布局相关的操作
 */
export class LayoutManager {
    private plugin: Plugin;
    private app: App;
    private settings: CanvasMindmapBuildSettings;
    private collapseStateManager: CollapseStateManager;
    private canvasFileService: CanvasFileService;
    private visibilityService: VisibilityService;
    private layoutDataProvider: LayoutDataProvider;
    private floatingNodeService: FloatingNodeService | null = null;

    constructor(
        plugin: Plugin,
        app: App,
        settings: CanvasMindmapBuildSettings,
        collapseStateManager: CollapseStateManager,
        canvasFileService: CanvasFileService,
        visibilityService: VisibilityService,
        layoutDataProvider: LayoutDataProvider
    ) {
        this.plugin = plugin;
        this.app = app;
        this.settings = settings;
        this.collapseStateManager = collapseStateManager;
        this.canvasFileService = canvasFileService;
        this.visibilityService = visibilityService;
        this.layoutDataProvider = layoutDataProvider;
    }

    /**
     * 设置 FloatingNodeService 实例
     * 由 CanvasManager 调用，确保使用同一个实例
     */
    setFloatingNodeService(service: FloatingNodeService): void {
        this.floatingNodeService = service;
    }

    /**
     * 自动整理画布布局（带防抖）
     */
    private arrangeTimeoutId: number | null = null;
    async arrangeCanvas() {
        if (this.arrangeTimeoutId !== null) {
            window.clearTimeout(this.arrangeTimeoutId);
        }

        this.arrangeTimeoutId = window.setTimeout(async () => {
            this.arrangeTimeoutId = null;
            await this.performArrange();
        }, 100);
    }

    private async performArrange() {
        const activeView = this.app.workspace.activeLeaf?.view;

        if (!activeView || activeView.getViewType() !== 'canvas') {
            new Notice("No active canvas found.");
            return;
        }

        const canvas = (activeView as any)?.canvas;

        if (!canvas) {
            new Notice("Canvas view not initialized.");
            return;
        }

        try {
            const layoutData = await this.layoutDataProvider.getLayoutData(canvas);
            if (!layoutData) {
                new Notice("Failed to gather canvas data.");
                return;
            }

            const { visibleNodes, edges, originalEdges, canvasData, allNodes, canvasFilePath } = layoutData;

            log(`[Layout] 整理: ${visibleNodes.size} 节点, ${edges.length} 边`);

            const layoutSettings: CanvasArrangerSettings = {
                horizontalSpacing: this.settings.horizontalSpacing,
                verticalSpacing: this.settings.verticalSpacing,
                textNodeWidth: this.settings.textNodeWidth,
                textNodeMaxHeight: this.settings.textNodeMaxHeight,
                imageNodeWidth: this.settings.imageNodeWidth,
                imageNodeHeight: this.settings.imageNodeHeight,
                formulaNodeWidth: this.settings.formulaNodeWidth,
                formulaNodeHeight: this.settings.formulaNodeHeight,
            };

            const result = originalArrangeLayout(
                visibleNodes,
                edges,
                layoutSettings,
                originalEdges,
                allNodes,
                canvasData
            );

            if (!canvasFilePath) throw new Error('找不到路径');

            const memoryEdges = canvas.edges instanceof Map 
                ? Array.from((canvas.edges as Map<string, any>).values()) 
                : Array.isArray(canvas.edges) ? canvas.edges : [];

            let updatedCount = 0;
            const success = await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (data) => {
                if (!data.nodes) return false;
                let changed = false;

                for (const node of data.nodes) {
                    const newPos = result.get(node.id);
                    if (newPos) {
                        if (node.x !== newPos.x || node.y !== newPos.y || 
                            node.width !== newPos.width || node.height !== newPos.height) {
                            node.x = newPos.x;
                            node.y = newPos.y;
                            node.width = newPos.width;
                            node.height = newPos.height;
                            changed = true;
                        }
                    }
                }

                const fileEdgeIds = new Set(data.edges.map((e: any) => e.id));
                for (const memEdge of memoryEdges) {
                    if (memEdge.id && !fileEdgeIds.has(memEdge.id)) {
                        data.edges.push(memEdge);
                        changed = true;
                    }
                }

                return changed;
            });

            if (success) {
                for (const [nodeId, newPosition] of result.entries()) {
                    const node = allNodes.get(nodeId);
                    if (node && typeof node.setData === 'function') {
                        const currentData = node.getData ? node.getData() : {};
                        node.setData({
                            ...currentData,
                            x: newPosition.x,
                            y: newPosition.y,
                            width: newPosition.width,
                            height: newPosition.height,
                        });
                        updatedCount++;
                    }
                }

                if (typeof canvas.requestUpdate === 'function') canvas.requestUpdate();
                if (typeof canvas.requestSave === 'function') canvas.requestSave();
            }

            await this.cleanupStaleFloatingNodes(canvas, allNodes);
            await this.reapplyFloatingNodeStyles(canvas);

            new Notice(`布局完成！更新了 ${updatedCount} 个节点`);
            log(`[Layout] 完成: 更新 ${updatedCount}`);
            
        } catch (err) {
            log(`[Layout] 失败`, err);
            new Notice("布局失败，请重试");
        }
    }

    /**
     * 在折叠/展开节点后自动整理布局
     */
    async autoArrangeAfterToggle(nodeId: string, canvas: any, isCollapsing: boolean = true) {
        if (!canvas) return;

        // 获取所有节点和边
        const nodes = canvas.nodes instanceof Map ? canvas.nodes : new Map(Object.entries(canvas.nodes));
        const edges = canvas.fileData?.edges || 
                     (canvas.edges instanceof Map ? Array.from(canvas.edges.values()) : 
                     Array.isArray(canvas.edges) ? canvas.edges : []);

        if (!nodes || nodes.size === 0) return;

        try {
            const allChildNodeIds = new Set<string>();
            this.collapseStateManager.addAllDescendantsToSet(nodeId, edges, allChildNodeIds);
            
            const canvasData = canvas.fileData || canvas;
            if (canvasData?.metadata?.floatingNodes) {
                for (const [floatingNodeId, info] of Object.entries(canvasData.metadata.floatingNodes)) {
                    let isFloating = false;
                    let originalParent = '';
                    if (typeof info === 'boolean') {
                        isFloating = info;
                    } else if (typeof info === 'object' && info !== null) {
                        isFloating = (info as any).isFloating;
                        originalParent = (info as any).originalParent || '';
                    }
                    
                    if (isFloating && originalParent === nodeId && !allChildNodeIds.has(floatingNodeId)) {
                        allChildNodeIds.add(floatingNodeId);
                    }
                }
            }
            
            if (isCollapsing) {
                for (const childId of allChildNodeIds) {
                    const childNode = nodes.get(childId);
                    if (childNode?.nodeEl) {
                        (childNode.nodeEl as HTMLElement).style.display = 'none';
                    }
                }
                
                for (const edge of edges) {
                    const fromId = this.getNodeIdFromEdgeEndpoint(edge?.from);
                    const toId = this.getNodeIdFromEdgeEndpoint(edge?.to);
                    if ((fromId && allChildNodeIds.has(fromId)) || (toId && allChildNodeIds.has(toId))) {
                        if (edge.lineGroupEl) (edge.lineGroupEl as HTMLElement).style.display = 'none';
                        if (edge.lineEndGroupEl) (edge.lineEndGroupEl as HTMLElement).style.display = 'none';
                    }
                }
            } else {
                for (const childId of allChildNodeIds) {
                    const childNode = nodes.get(childId);
                    if (childNode?.nodeEl) {
                        (childNode.nodeEl as HTMLElement).style.display = '';
                    }
                }
                
                for (const edge of edges) {
                    const fromId = this.getNodeIdFromEdgeEndpoint(edge?.from);
                    const toId = this.getNodeIdFromEdgeEndpoint(edge?.to);
                    if ((fromId && allChildNodeIds.has(fromId)) || (toId && allChildNodeIds.has(toId))) {
                        if (edge.lineGroupEl) (edge.lineGroupEl as HTMLElement).style.display = '';
                        if (edge.lineEndGroupEl) (edge.lineEndGroupEl as HTMLElement).style.display = '';
                    }
                }
            }

            const visibleNodeIds = new Set<string>();
            nodes.forEach((node: any, id: string) => {
                const nodeEl = node.nodeEl as HTMLElement;
                if (!nodeEl || nodeEl.style.display !== 'none') visibleNodeIds.add(id);
            });

            const layoutSettings: CanvasArrangerSettings = {
                horizontalSpacing: this.settings.horizontalSpacing,
                verticalSpacing: this.settings.verticalSpacing,
                textNodeWidth: this.settings.textNodeWidth,
                textNodeMaxHeight: this.settings.textNodeMaxHeight,
                imageNodeWidth: this.settings.imageNodeWidth,
                imageNodeHeight: this.settings.imageNodeHeight,
                formulaNodeWidth: this.settings.formulaNodeWidth,
                formulaNodeHeight: this.settings.formulaNodeHeight,
            };

            const visibleNodes = new Map<string, any>();
            nodes.forEach((node: any, id: string) => {
                if (visibleNodeIds.has(id)) visibleNodes.set(id, node);
            });
            
            const newLayout = originalArrangeLayout(visibleNodes, edges, layoutSettings, undefined, undefined, canvasData);

            if (!newLayout || newLayout.size === 0) return;

            let updatedCount = 0;
            for (const [targetNodeId, newPosition] of newLayout.entries()) {
                const node = nodes.get(targetNodeId);
                if (node) {
                    const targetX = isNaN(newPosition.x) ? 0 : newPosition.x;
                    const targetY = isNaN(newPosition.y) ? 0 : newPosition.y;

                    if (typeof node.setData === 'function') {
                        const currentData = node.getData ? node.getData() : {};
                        node.setData({
                            ...currentData,
                            x: targetX,
                            y: targetY,
                            width: newPosition.width,
                            height: newPosition.height,
                        });
                        updatedCount++;
                    } else if (typeof node.x === 'number') {
                        node.x = targetX;
                        node.y = targetY;
                        if (typeof node.update === 'function') node.update();
                        updatedCount++;
                    }
                }
            }

            if (typeof canvas.requestUpdate === 'function') canvas.requestUpdate();
            if (canvas.requestSave) canvas.requestSave();
            
        } catch (err) {
            log(`[Layout] Toggle 失败: ${err}`);
        }
    }

    // =========================================================================
    // 辅助方法：从边的端点获取节点 ID
    // =========================================================================
    private getNodeIdFromEdgeEndpoint(endpoint: any): string | null {
        if (!endpoint) return null;
        if (typeof endpoint === 'string') return endpoint;
        if (typeof endpoint.nodeId === 'string') return endpoint.nodeId;
        if (endpoint.node && typeof endpoint.node.id === 'string') return endpoint.node.id;
        return null;
    }

    // =========================================================================
    // 折叠/展开节点
    // =========================================================================
    async toggleNodeCollapse(nodeId: string, canvas: any) {
        const isCurrentlyCollapsed = this.collapseStateManager.isCollapsed(nodeId);
        
        if (isCurrentlyCollapsed) {
            this.collapseStateManager.markExpanded(nodeId);
            // 展开操作
            await this.autoArrangeAfterToggle(nodeId, canvas, false);
        } else {
            this.collapseStateManager.markCollapsed(nodeId);
            // 折叠操作
            await this.autoArrangeAfterToggle(nodeId, canvas, true);
        }
    }

    // =========================================================================
    // 拖拽时同步隐藏的子节点和浮动子树
    // =========================================================================
    async syncHiddenChildrenOnDrag(node: any) {
        if (!node || !node.id) return;

        const canvas = node.canvas;
        if (!canvas) return;

        // 1. 同步由于折叠而隐藏的子节点
        if (this.collapseStateManager.isCollapsed(node.id)) {
            // ... (现有的同步逻辑，如果以后需要的话)
        }

        // 2. 同步浮动子树
        if (this.floatingNodeService) {
            const floatingChildrenIds = this.floatingNodeService.getFloatingChildren(node.id);
            if (floatingChildrenIds.length > 0) {
                const dx = node.x - (node.prevX ?? node.x);
                const dy = node.y - (node.prevY ?? node.y);

                if (dx === 0 && dy === 0) {
                    node.prevX = node.x;
                    node.prevY = node.y;
                    return;
                }

                for (const childId of floatingChildrenIds) {
                    const childNode = canvas.nodes.get(childId);
                    if (childNode) {
                        childNode.moveAndResize({
                            x: childNode.x + dx,
                            y: childNode.y + dy,
                            width: childNode.width,
                            height: childNode.height
                        });
                        // 递归同步子节点的子节点（虽然浮动节点本身会触发拖拽，但这里是父节点带动）
                        // 注意：moveAndResize 可能会触发 childNode 的 node-drag 事件，导致死循环
                        // 但 moveAndResize 通常不触发事件，除非是通过 UI 拖拽
                    }
                }
                
                node.prevX = node.x;
                node.prevY = node.y;
            }
        }
    }

    // =========================================================================
    // 检查并清除已连接的浮动节点状态
    // =========================================================================
    private async checkAndClearConnectedFloatingNodes(canvas: any): Promise<void> {
        try {
            // 获取当前 canvas 路径 - 使用多种方法尝试获取
            let canvasFilePath = canvas.file?.path;
            
            if (!canvasFilePath) {
                const activeView = this.app.workspace.activeLeaf?.view;
                if (activeView && activeView.getViewType() === 'canvas') {
                    canvasFilePath = (activeView as any).file?.path;
                }
            }
            
            if (!canvasFilePath) return;
            
            const canvasFile = this.app.vault.getAbstractFileByPath(canvasFilePath);
            if (!(canvasFile instanceof TFile)) return;

            const canvasContent = await this.app.vault.read(canvasFile);
            const canvasData = JSON.parse(canvasContent);
            const floatingNodes = canvasData.metadata?.floatingNodes || {};

            // 获取当前所有边
            const edges = canvas.edges instanceof Map ? Array.from(canvas.edges.values()) :
                         Array.isArray(canvas.edges) ? canvas.edges : [];

            // 检查每个浮动节点是否已经有连接
            for (const nodeId of Object.keys(floatingNodes)) {
                let isFloating = false;
                if (typeof floatingNodes[nodeId] === 'boolean') {
                    isFloating = floatingNodes[nodeId];
                } else if (typeof floatingNodes[nodeId] === 'object' && floatingNodes[nodeId] !== null) {
                    isFloating = (floatingNodes[nodeId] as any).isFloating;
                }
                
                if (isFloating) {
                    let hasConnection = false;
                    for (const edge of edges) {
                        const fromNodeId = this.getNodeIdFromEdgeEndpoint(edge?.from);
                        const toNodeId = this.getNodeIdFromEdgeEndpoint(edge?.to);
                        if (fromNodeId === nodeId || toNodeId === nodeId) {
                            hasConnection = true;
                            break;
                        }
                    }
                    
                    if (hasConnection) {
                        await this.clearFloatingNodeState(nodeId, canvas);
                    }
                }
            }
        } catch (err) {
            log(`[Layout] 检查浮动失败: ${err}`);
        }
    }

    // =========================================================================
    // 辅助方法：清除浮动节点状态
    // =========================================================================
    private async clearFloatingNodeState(nodeId: string, canvas?: any): Promise<void> {
        try {
            const activeView = this.app.workspace.activeLeaf?.view;
            if (!activeView || activeView.getViewType() !== 'canvas') return;

            const canvasObj = (activeView as any)?.canvas;
            if (!canvasObj) return;

            const canvasFilePath = canvasObj.file?.path || (activeView as any).file?.path;
            if (!canvasFilePath) return;

            const canvasFile = this.app.vault.getAbstractFileByPath(canvasFilePath);
            if (!(canvasFile instanceof TFile)) return;

            const canvasContent = await this.app.vault.read(canvasFile);
            const canvasData = JSON.parse(canvasContent);

            if (canvasData.metadata?.floatingNodes?.[nodeId]) {
                delete canvasData.metadata.floatingNodes[nodeId];
                if (Object.keys(canvasData.metadata.floatingNodes).length === 0) {
                    delete canvasData.metadata.floatingNodes;
                }
                await this.app.vault.modify(canvasFile, JSON.stringify(canvasData, null, 2));
            }

            const node = canvas.nodes?.get(nodeId);
            if (node?.nodeEl) {
                (node.nodeEl as HTMLElement).style.border = '';
                (node.nodeEl as HTMLElement).style.borderRadius = '';
                (node.nodeEl as HTMLElement).classList.remove('cmb-floating-node');
            }
        } catch (err) {
            log(`[Layout] 清除浮动失败: ${nodeId}, ${err}`);
        }
    }

    // =========================================================================
    // 清理残留的浮动节点数据（不存在的节点）
    // =========================================================================
    private async cleanupStaleFloatingNodes(canvas: any, currentNodes: Map<string, any>): Promise<void> {
        try {
            const canvasFilePath = canvas.file?.path;
            if (!canvasFilePath) return;

            const canvasFile = this.app.vault.getAbstractFileByPath(canvasFilePath);
            if (!(canvasFile instanceof TFile)) return;

            const canvasContent = await this.app.vault.read(canvasFile);
            const canvasData = JSON.parse(canvasContent);

            if (!canvasData.metadata?.floatingNodes) return;

            const currentNodeIds = new Set<string>();
            currentNodes.forEach((_, id) => {
                currentNodeIds.add(id);
            });

            const floatingNodes = canvasData.metadata.floatingNodes;
            let hasStaleNodes = false;
            let staleCount = 0;

            // 检查并删除不存在的浮动节点记录
            for (const nodeId of Object.keys(floatingNodes)) {
                if (!currentNodeIds.has(nodeId)) {
                    delete floatingNodes[nodeId];
                    hasStaleNodes = true;
                    staleCount++;
                }
            }

            // 如果 floatingNodes 为空，删除整个对象
            if (Object.keys(floatingNodes).length === 0) {
                delete canvasData.metadata.floatingNodes;
            }

            // 如果有残留的节点，保存文件
            if (hasStaleNodes) {
                await this.app.vault.modify(canvasFile, JSON.stringify(canvasData, null, 2));
            }
        } catch (err) {
            log(`[Layout] 清理残留失败: ${err}`);
        }
    }

    // =========================================================================
    // 重新应用浮动节点的红框样式
    // =========================================================================
    private async reapplyFloatingNodeStyles(canvas: any): Promise<void> {
        try {
            const canvasFilePath = canvas.file?.path;
            if (!canvasFilePath) return;

            // 使用新的服务重新应用浮动节点样式（传入 canvas 只应用当前存在的节点）
            if (this.floatingNodeService) {
                await this.floatingNodeService.reapplyAllFloatingStyles(canvas);
            }
        } catch (err) {
            log(`[Layout] 重新应用样式失败: ${err}`);
        }
    }
}
