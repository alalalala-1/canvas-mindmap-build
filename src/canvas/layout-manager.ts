import { App, ItemView, Notice, Plugin, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../settings/types';
import { CollapseStateManager } from '../state/collapse-state';
import { CanvasFileService } from './services/canvas-file-service';
import { debug, info, warn, error, trace, logTime } from '../utils/logger';
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
        debug('LayoutManager 实例化完成');
    }

    /**
     * 设置 FloatingNodeService 实例
     * 由 CanvasManager 调用，确保使用同一个实例
     */
    setFloatingNodeService(service: FloatingNodeService): void {
        this.floatingNodeService = service;
    }

    /**
     * 自动整理画布布局
     */
    async arrangeCanvas() {
        const endTimer = logTime('arrangeCanvas');
        info("开始执行 arrangeCanvas 命令");
        
        const activeView = this.app.workspace.activeLeaf?.view;

        if (!activeView || activeView.getViewType() !== 'canvas') {
            new Notice("No active canvas found. Please open a canvas file and try again.");
            warn("arrangeCanvas: 未找到活动的Canvas视图");
            return;
        }

        const canvas = (activeView as any)?.canvas;

        if (!canvas) {
            new Notice("Canvas view is not properly initialized.");
            warn("arrangeCanvas: Canvas对象未初始化");
            return;
        }

        try {
            // 1. 获取布局所需的所有数据
            const layoutData = await this.layoutDataProvider.getLayoutData(canvas);
            if (!layoutData) {
                new Notice("Failed to gather canvas data for layout.");
                return;
            }

            const { visibleNodes, edges, originalEdges, canvasData, allNodes, canvasFilePath } = layoutData;

            info(`arrangeCanvas: 准备布局数据完成, 可见节点 ${visibleNodes.size}, 边 ${edges.length}`);

            // 2. 转换设置以匹配布局算法需要的格式
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

            debug('arrangeCanvas: 布局设置', layoutSettings);

            // 3. 生成最终结果
            const result = originalArrangeLayout(
                visibleNodes,
                edges,
                layoutSettings,
                originalEdges,
                allNodes,
                canvasData
            );

            info(`arrangeCanvas: 新布局计算完成，包含 ${result.size} 个节点`);

            if (!canvasFilePath) {
                throw new Error('无法获取 Canvas 文件路径');
            }

            // 4. 使用原子操作将新布局写入文件
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
                return changed;
            });

            if (success) {
                info(`arrangeCanvas: 布局已成功保存到文件: ${canvasFilePath}`);
                
                // 5. 更新内存中的节点位置以实现立即响应
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

                // 强制重绘
                if (typeof canvas.requestUpdate === 'function') {
                    canvas.requestUpdate();
                }
                if (typeof canvas.requestSave === 'function') {
                    canvas.requestSave();
                }
            } else {
                warn(`arrangeCanvas: 布局未发生变化或保存失败`);
            }

            // 6. 后置处理：清理残留数据和重绘样式
            await this.cleanupStaleFloatingNodes(canvas, allNodes);
            await this.reapplyFloatingNodeStyles(canvas);

            new Notice(`Canvas arranged successfully! ${updatedCount} nodes updated.`);
            info(`arrangeCanvas: 完成！成功更新 ${updatedCount} 个节点`);
            
        } catch (err) {
            error('arrangeCanvas: 发生错误:', err);
            new Notice("An error occurred while arranging the canvas. Check console for details.");
        }
        
        endTimer();
    }

    /**
     * 在折叠/展开节点后自动整理布局
     */
    async autoArrangeAfterToggle(nodeId: string, canvas: any, isCollapsing: boolean = true) {
        const endTimer = logTime(`autoArrangeAfterToggle(${nodeId}), isCollapsing=${isCollapsing}`);
        
        // 获取当前可见的节点（未被折叠的节点）
        if (!canvas) {
            warn('autoArrangeAfterToggle: Canvas 对象无效');
            return;
        }

        // 获取所有节点和边
        const nodes = canvas.nodes instanceof Map ? canvas.nodes : new Map(Object.entries(canvas.nodes));
        // 优先使用 canvas.fileData.edges，因为它包含所有边（包括新添加的）
        const edges = canvas.fileData?.edges || 
                     (canvas.edges instanceof Map ? Array.from(canvas.edges.values()) : 
                     Array.isArray(canvas.edges) ? canvas.edges : []);

        if (!nodes || nodes.size === 0) {
            trace('autoArrangeAfterToggle: 没有节点数据');
            return;
        }

        try {
            // 获取所有子节点ID（包括后代）
            const allChildNodeIds = new Set<string>();
            debug(`autoArrangeAfterToggle: 边数量: ${edges.length}`);
            edges.forEach((edge: any, index: number) => {
                const fromId = this.getNodeIdFromEdgeEndpoint(edge?.from);
                const toId = this.getNodeIdFromEdgeEndpoint(edge?.to);
                debug(`autoArrangeAfterToggle: 边 ${index}: ${fromId} -> ${toId}`);
            });
            this.collapseStateManager.addAllDescendantsToSet(nodeId, edges, allChildNodeIds);
            
            // 从 canvasData 中读取浮动节点信息，将浮动子节点也添加到集合中
            const canvasData = canvas.fileData || canvas;
            if (canvasData?.metadata?.floatingNodes) {
                for (const [floatingNodeId, info] of Object.entries(canvasData.metadata.floatingNodes)) {
                    // 兼容旧格式（boolean）和新格式（object）
                    let isFloating = false;
                    let originalParent = '';
                    if (typeof info === 'boolean') {
                        isFloating = info;
                    } else if (typeof info === 'object' && info !== null) {
                        isFloating = (info as any).isFloating;
                        originalParent = (info as any).originalParent || '';
                    }
                    
                    // 如果浮动节点的原父节点是当前节点，添加到子节点集合
                    if (isFloating && originalParent === nodeId && !allChildNodeIds.has(floatingNodeId)) {
                        allChildNodeIds.add(floatingNodeId);
                        debug(`autoArrangeAfterToggle: 添加浮动子节点 ${floatingNodeId}`);
                    }
                }
            }
            
            debug(`autoArrangeAfterToggle: 节点 ${nodeId} 的所有子节点: [${Array.from(allChildNodeIds).join(', ')}]`);

            // 如果是折叠操作，隐藏所有子节点和相关的边
            if (isCollapsing) {
                for (const childId of allChildNodeIds) {
                    const childNode = nodes.get(childId);
                    if (childNode?.nodeEl) {
                        (childNode.nodeEl as HTMLElement).style.display = 'none';
                        debug(`隐藏子节点: ${childId}`);
                    }
                }
                
                // 隐藏与子节点相关的边
                for (const edge of edges) {
                    const fromId = this.getNodeIdFromEdgeEndpoint(edge?.from);
                    const toId = this.getNodeIdFromEdgeEndpoint(edge?.to);
                    
                    // 如果边的源节点或目标节点是子节点，隐藏这条边
                    if ((fromId && allChildNodeIds.has(fromId)) || (toId && allChildNodeIds.has(toId))) {
                        if (edge.lineGroupEl) {
                            (edge.lineGroupEl as HTMLElement).style.display = 'none';
                        }
                        if (edge.lineEndGroupEl) {
                            (edge.lineEndGroupEl as HTMLElement).style.display = 'none';
                        }
                        debug(`隐藏边: ${fromId} -> ${toId}`);
                    }
                }
            } 
            // 如果是展开操作，显示所有子节点和相关的边
            else {
                for (const childId of allChildNodeIds) {
                    const childNode = nodes.get(childId);
                    if (childNode?.nodeEl) {
                        (childNode.nodeEl as HTMLElement).style.display = '';
                        debug(`显示子节点: ${childId}`);
                    }
                }
                
                // 显示与子节点相关的边
                for (const edge of edges) {
                    const fromId = this.getNodeIdFromEdgeEndpoint(edge?.from);
                    const toId = this.getNodeIdFromEdgeEndpoint(edge?.to);
                    
                    // 如果边的源节点或目标节点是子节点，显示这条边
                    if ((fromId && allChildNodeIds.has(fromId)) || (toId && allChildNodeIds.has(toId))) {
                        if (edge.lineGroupEl) {
                            (edge.lineGroupEl as HTMLElement).style.display = '';
                        }
                        if (edge.lineEndGroupEl) {
                            (edge.lineEndGroupEl as HTMLElement).style.display = '';
                        }
                        debug(`显示边: ${fromId} -> ${toId}`);
                    }
                }
            }

            // 收集可见节点ID
            const visibleNodeIds = new Set<string>();
            nodes.forEach((node: any, id: string) => {
                // 检查节点是否可见
                const nodeEl = node.nodeEl as HTMLElement;
                if (!nodeEl || nodeEl.style.display !== 'none') {
                    visibleNodeIds.add(id);
                }
            });

            debug(`autoArrangeAfterToggle: 可见节点数: ${visibleNodeIds.size}`);

            // 转换设置以匹配布局算法需要的格式
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

            // 计算新的布局（只考虑可见节点）
            // 创建只包含可见节点的新 Map
            const visibleNodes = new Map<string, any>();
            nodes.forEach((node: any, id: string) => {
                if (visibleNodeIds.has(id)) {
                    visibleNodes.set(id, node);
                }
            });
            
            const newLayout = originalArrangeLayout(visibleNodes, edges, layoutSettings, undefined, undefined, canvasData);

            if (!newLayout || newLayout.size === 0) {
                warn('autoArrangeAfterToggle: 布局计算返回空结果');
                return;
            }

            // 更新节点位置
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
                        if (typeof node.update === 'function') {
                            node.update();
                        }
                        updatedCount++;
                    }
                }
            }

            info(`autoArrangeAfterToggle: 更新了 ${updatedCount} 个节点位置`);

            // 强制 Canvas 重绘
            if (typeof canvas.requestUpdate === 'function') {
                canvas.requestUpdate();
            }
            if (canvas.requestSave) {
                canvas.requestSave();
            }
            
        } catch (err) {
            error('autoArrangeAfterToggle: 发生错误:', err);
        }

        endTimer();
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
            debug(`syncHiddenChildrenOnDrag: node ${node.id} is collapsed`);
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
        info('[checkAndClearConnectedFloatingNodes] 开始检查已连接的浮动节点');
        try {
            // 获取当前 canvas 路径 - 使用多种方法尝试获取
            let canvasFilePath = canvas.file?.path;
            
            // 如果 canvas.file?.path 不存在，尝试从 activeView 获取
            if (!canvasFilePath) {
                const activeView = this.app.workspace.activeLeaf?.view;
                if (activeView && activeView.getViewType() === 'canvas') {
                    canvasFilePath = (activeView as any).file?.path;
                }
            }
            
            if (!canvasFilePath) {
                info('[checkAndClearConnectedFloatingNodes] 无法获取 canvas 路径');
                return;
            }
            
            info(`[checkAndClearConnectedFloatingNodes] 获取到 canvas 路径: ${canvasFilePath}`);

            const canvasFile = this.app.vault.getAbstractFileByPath(canvasFilePath);
            if (!(canvasFile instanceof TFile)) {
                info('[checkAndClearConnectedFloatingNodes] 无法获取 canvas 文件');
                return;
            }

            const canvasContent = await this.app.vault.read(canvasFile);
            const canvasData = JSON.parse(canvasContent);
            const floatingNodes = canvasData.metadata?.floatingNodes || {};
            const floatingNodeCount = Object.keys(floatingNodes).length;
            info(`[checkAndClearConnectedFloatingNodes] 文件中有 ${floatingNodeCount} 个浮动节点记录`);

            // 获取当前所有边
            const edges = canvas.edges instanceof Map ? Array.from(canvas.edges.values()) :
                         Array.isArray(canvas.edges) ? canvas.edges : [];
            info(`[checkAndClearConnectedFloatingNodes] 当前有 ${edges.length} 条边`);

            // 检查每个浮动节点是否已经有连接
            for (const nodeId of Object.keys(floatingNodes)) {
                // 兼容旧格式（boolean）和新格式（object）
                let isFloating = false;
                if (typeof floatingNodes[nodeId] === 'boolean') {
                    isFloating = floatingNodes[nodeId];
                } else if (typeof floatingNodes[nodeId] === 'object' && floatingNodes[nodeId] !== null) {
                    isFloating = floatingNodes[nodeId].isFloating;
                }
                
                info(`[checkAndClearConnectedFloatingNodes] 检查节点 ${nodeId}: isFloating=${isFloating}`);
                
                if (isFloating) {
                    // 检查节点是否有入边或出边
                    let hasConnection = false;
                    
                    for (const edge of edges) {
                        const fromNodeId = this.getNodeIdFromEdgeEndpoint(edge?.from);
                        const toNodeId = this.getNodeIdFromEdgeEndpoint(edge?.to);
                        
                        if (fromNodeId === nodeId || toNodeId === nodeId) {
                            hasConnection = true;
                            info(`[checkAndClearConnectedFloatingNodes] 节点 ${nodeId} 有连接: ${fromNodeId} -> ${toNodeId}`);
                            break;
                        }
                    }
                    
                    if (hasConnection) {
                        info(`[checkAndClearConnectedFloatingNodes] 节点 ${nodeId} 已有连接，调用 clearFloatingNodeState`);
                        await this.clearFloatingNodeState(nodeId, canvas);
                    } else {
                        info(`[checkAndClearConnectedFloatingNodes] 节点 ${nodeId} 没有连接`);
                    }
                }
            }
            info('[checkAndClearConnectedFloatingNodes] 检查完成');
        } catch (err) {
            error('[checkAndClearConnectedFloatingNodes] 检查并清除已连接浮动节点状态失败:', err);
        }
    }

    // =========================================================================
    // 辅助方法：清除浮动节点状态
    // =========================================================================
    private async clearFloatingNodeState(nodeId: string, canvas?: any): Promise<void> {
        info(`[layout-manager.clearFloatingNodeState] 开始清除节点 ${nodeId} 的浮动状态`);
        try {
            // 获取当前 canvas 路径
            const activeView = this.app.workspace.activeLeaf?.view;
            if (!activeView || activeView.getViewType() !== 'canvas') {
                info(`[layout-manager.clearFloatingNodeState] 没有活动的 canvas 视图`);
                return;
            }

            const canvasObj = (activeView as any)?.canvas;
            if (!canvasObj) {
                info(`[layout-manager.clearFloatingNodeState] 无法获取 canvas 对象`);
                return;
            }

            const canvasFilePath = canvasObj.file?.path || (activeView as any).file?.path;
            if (!canvasFilePath) {
                info(`[layout-manager.clearFloatingNodeState] 无法获取 canvas 文件路径`);
                return;
            }

            const canvasFile = this.app.vault.getAbstractFileByPath(canvasFilePath);
            if (!(canvasFile instanceof TFile)) {
                info(`[layout-manager.clearFloatingNodeState] 无法获取 canvas 文件`);
                return;
            }

            const canvasContent = await this.app.vault.read(canvasFile);
            const canvasData = JSON.parse(canvasContent);

            // 从 metadata 中移除浮动节点标记
            if (canvasData.metadata?.floatingNodes?.[nodeId]) {
                info(`[layout-manager.clearFloatingNodeState] 从 metadata 中删除节点 ${nodeId}`);
                delete canvasData.metadata.floatingNodes[nodeId];

                // 如果 floatingNodes 为空，删除整个对象
                if (Object.keys(canvasData.metadata.floatingNodes).length === 0) {
                    delete canvasData.metadata.floatingNodes;
                    info(`[layout-manager.clearFloatingNodeState] floatingNodes 为空，删除整个对象`);
                }

                // 保存文件
                await this.app.vault.modify(canvasFile, JSON.stringify(canvasData, null, 2));
                info(`[layout-manager.clearFloatingNodeState] 已清除节点 ${nodeId} 的浮动状态并保存文件`);
            } else {
                info(`[layout-manager.clearFloatingNodeState] 节点 ${nodeId} 不在 metadata.floatingNodes 中`);
            }

            // 清除样式
            const node = canvas.nodes?.get(nodeId);
            if (node?.nodeEl) {
                const beforeBorder = (node.nodeEl as HTMLElement).style.border;
                (node.nodeEl as HTMLElement).style.border = '';
                (node.nodeEl as HTMLElement).style.borderRadius = '';
                // 也清除可能的CSS类
                (node.nodeEl as HTMLElement).classList.remove('cmb-floating-node');
                info(`[layout-manager.clearFloatingNodeState] 已清除节点 ${nodeId} 的样式，清除前: "${beforeBorder}"`);
            } else {
                info(`[layout-manager.clearFloatingNodeState] 无法获取节点 ${nodeId} 的 DOM 元素`);
            }
        } catch (err) {
            error('[layout-manager.clearFloatingNodeState] 清除浮动节点状态失败:', err);
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

            // 检查并删除不存在的浮动节点记录
            for (const nodeId of Object.keys(floatingNodes)) {
                if (!currentNodeIds.has(nodeId)) {
                    delete floatingNodes[nodeId];
                    hasStaleNodes = true;
                    warn(`cleanupStaleFloatingNodes: 删除残留的浮动节点记录: ${nodeId}`);
                }
            }

            // 如果 floatingNodes 为空，删除整个对象
            if (Object.keys(floatingNodes).length === 0) {
                delete canvasData.metadata.floatingNodes;
            }

            // 如果有残留的节点，保存文件
            if (hasStaleNodes) {
                await this.app.vault.modify(canvasFile, JSON.stringify(canvasData, null, 2));
                info(`cleanupStaleFloatingNodes: 已清理残留的浮动节点数据`);
            }
        } catch (err) {
            error('清理残留浮动节点数据失败:', err);
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
            error('[reapplyFloatingNodeStyles] 重新应用浮动节点样式失败:', err);
        }
    }
}
