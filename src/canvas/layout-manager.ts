import { App, ItemView, Notice, Plugin, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../settings/types';
import { CollapseStateManager } from '../state/collapse-state';
import { debug, info, warn, error, trace, logTime } from '../utils/logger';
import { arrangeLayout as originalArrangeLayout, CanvasArrangerSettings } from './layout';

/**
 * 布局管理器 - 负责Canvas布局相关的操作
 */
export class LayoutManager {
    private plugin: Plugin;
    private app: App;
    private settings: CanvasMindmapBuildSettings;
    private collapseStateManager: CollapseStateManager;

    constructor(
        plugin: Plugin,
        app: App,
        settings: CanvasMindmapBuildSettings,
        collapseStateManager: CollapseStateManager
    ) {
        this.plugin = plugin;
        this.app = app;
        this.settings = settings;
        this.collapseStateManager = collapseStateManager;
        debug('LayoutManager 实例化完成');
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

        // 获取节点和边，确保类型正确
        const nodes = canvas.nodes instanceof Map ? canvas.nodes : new Map(Object.entries(canvas.nodes));
        const edges = canvas.edges instanceof Map ? Array.from(canvas.edges.values()) : 
                     Array.isArray(canvas.edges) ? canvas.edges : [];

        info(`arrangeCanvas: 检测到 ${nodes.size} 个节点, ${edges.length} 条边`);

        if (!nodes || nodes.size === 0) {
            new Notice("No nodes found in the canvas.");
            warn("arrangeCanvas: 未找到任何节点");
            return;
        }

        try {
            // 收集可见节点ID - 正确处理折叠状态
            const visibleNodeIds = new Set<string>();

            // 首先，获取所有节点ID
            const allNodeIds = new Set<string>();
            nodes.forEach((node: any, id: string) => {
                allNodeIds.add(id);
            });

            debug(`arrangeCanvas: 所有节点ID: [${Array.from(allNodeIds).join(', ')}]`);

            // 然后，排除被折叠的节点及其后代
            const collapsedNodes = this.collapseStateManager.getAllCollapsedNodes();
            const allCollapsedNodes = new Set<string>(collapsedNodes);

            debug(`arrangeCanvas: 折叠的节点: [${Array.from(collapsedNodes).join(', ')}]`);

            // 递归添加所有后代节点到折叠集合中
            collapsedNodes.forEach(nodeId => {
                this.collapseStateManager.addAllDescendantsToSet(nodeId, edges, allCollapsedNodes);
            });

            debug(`arrangeCanvas: 所有被折叠的节点（包括后代）: [${Array.from(allCollapsedNodes).join(', ')}]`);

            // 可见节点是所有节点减去折叠节点
            allNodeIds.forEach(id => {
                if (!allCollapsedNodes.has(id)) {
                    visibleNodeIds.add(id);
                }
            });

            debug(`arrangeCanvas: 可见节点ID: [${Array.from(visibleNodeIds).join(', ')}]`);

            if (visibleNodeIds.size === 0) {
                new Notice("No visible nodes found to arrange.");
                warn("arrangeCanvas: 未找到任何可见节点");
                return;
            }

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

            debug('arrangeCanvas: 布局设置', layoutSettings);

            // 记录原始位置
            debug("arrangeCanvas: 原始节点位置:");
            nodes.forEach((node: any, id: string) => {
                if (visibleNodeIds.has(id)) {
                    debug(`    节点 ${id}: x=${node.x || 0}, y=${node.y || 0}, width=${node.width || 'unknown'}, height=${node.height || 'unknown'}`);
                }
            });

            // 从 Canvas 文件中读取原始数据（包含节点文本和边）
            let originalEdges = edges;
            let fileNodes = new Map<string, any>(); // 从文件读取的节点数据
            let floatingNodes = new Set<string>(); // 浮动节点集合
            let canvasData: any = null; // 用于传递给布局算法
            try {
                const canvasFilePath = canvas.file?.path || (activeView as any).file?.path;
                if (canvasFilePath) {
                    const canvasFile = this.app.vault.getAbstractFileByPath(canvasFilePath);
                    if (canvasFile instanceof TFile) {
                        const canvasContent = await this.app.vault.read(canvasFile);
                        canvasData = JSON.parse(canvasContent);
                        // 读取文件中的节点数据（包含 text 内容）
                        if (canvasData.nodes && Array.isArray(canvasData.nodes)) {
                            for (const node of canvasData.nodes) {
                                if (node.id) {
                                    fileNodes.set(node.id, node);
                                }
                            }
                            debug(`arrangeCanvas: 从文件读取到 ${fileNodes.size} 个节点`);
                        }
                        if (canvasData.edges && Array.isArray(canvasData.edges)) {
                            originalEdges = canvasData.edges;
                            debug(`arrangeCanvas: 从文件读取到 ${originalEdges.length} 条原始边`);
                        }
                        // 读取浮动节点标记（只保留当前存在的节点）
                        if (canvasData.metadata?.floatingNodes) {
                            const allNodeIds = new Set<string>();
                            nodes.forEach((node: any, id: string) => {
                                allNodeIds.add(id);
                            });
                            
                            for (const nodeId of Object.keys(canvasData.metadata.floatingNodes)) {
                                // 只添加当前存在的节点
                                if (allNodeIds.has(nodeId)) {
                                    floatingNodes.add(nodeId);
                                } else {
                                    warn(`arrangeCanvas: 浮动节点 ${nodeId} 不存在于当前 Canvas，已忽略`);
                                }
                            }
                            info(`arrangeCanvas: 发现 ${floatingNodes.size} 个有效浮动节点: [${Array.from(floatingNodes).join(', ')}]`);
                        }
                    }
                }
            } catch (e) {
                debug('arrangeCanvas: 无法读取原始数据，使用当前数据');
            }

            // 在 arrange 时不需要清除浮动状态，因为浮动子树应该参与布局
            // 浮动状态的清除应该在添加新边时处理

            // 计算新的布局（浮动子树作为整体参与布局）
            // 创建只包含可见节点的新 Map，合并内存节点和文件节点的数据
            const visibleNodes = new Map<string, any>();

            nodes.forEach((node: any, id: string) => {
                if (visibleNodeIds.has(id)) {
                    // 合并内存节点和文件节点的数据，优先使用文件节点的 text
                    const fileNode = fileNodes.get(id);
                    const nodeText = fileNode?.text || node.text;

                    // 检测是否是公式节点
                    const isFormula = nodeText && /^\$\$[\s\S]*\$\$$/.test(nodeText.trim());
                    if (isFormula) {
                        debug(`arrangeCanvas: 检测到公式节点 ${id}: ${nodeText?.substring(0, 50)}...`);
                    }

                    const mergedNode = {
                        ...node,
                        ...(fileNode || {}),
                        // 确保使用文件中的文本内容（用于检测公式）
                        text: nodeText
                    };
                    visibleNodes.set(id, mergedNode);
                }
            });

            debug(`arrangeCanvas: 可见节点数量: ${visibleNodes.size}`);

            const layoutTimer = logTime('originalArrangeLayout');
            // 传递所有节点和canvasData用于浮动子树布局
            const newLayout = originalArrangeLayout(visibleNodes, edges, layoutSettings, originalEdges, nodes, canvasData);
            layoutTimer();

            if (!newLayout || newLayout.size === 0) {
                new Notice("Layout could not be calculated. Check console for errors.");
                error("arrangeCanvas: 布局计算失败，返回空结果");
                return;
            }

            info(`arrangeCanvas: 新布局计算完成，包含 ${newLayout.size} 个节点`);
            debug("arrangeCanvas: 新节点位置:");
            for (const [nodeId, newPosition] of newLayout.entries()) {
                debug(`    节点 ${nodeId}: x=${newPosition.x}, y=${newPosition.y}, width=${newPosition.width}, height=${newPosition.height}`);
            }

            // 使用 Canvas API 更新节点位置 - 优先使用 setData 方法
            let updatedCount = 0;
            let failedCount = 0;
            
            for (const [nodeId, newPosition] of newLayout.entries()) {
                const node = nodes.get(nodeId);
                if (node) {
                    // 确保坐标是有效的数字
                    const targetX = isNaN(newPosition.x) ? 0 : newPosition.x;
                    const targetY = isNaN(newPosition.y) ? 0 : newPosition.y;

                    trace(`arrangeCanvas: 更新节点 ${nodeId} 位置: (${targetX}, ${targetY})`);
                    
                    // 优先使用 setData 方法（这是 Obsidian Canvas 的标准方式）
                    if (typeof node.setData === 'function') {
                        const currentData = node.getData ? node.getData() : {};
                        trace(`arrangeCanvas: 节点 ${nodeId} 当前数据:`, currentData);
                        node.setData({
                            ...currentData,
                            x: targetX,
                            y: targetY,
                            width: newPosition.width,
                            height: newPosition.height,
                        });
                        trace(`arrangeCanvas: 节点 ${nodeId} setData 调用成功`);
                        updatedCount++;
                    } 
                    // 如果 setData 不可用，尝试直接更新 x/y 属性并调用 update
                    else if (typeof node.x === 'number' && typeof node.y === 'number') {
                        trace(`arrangeCanvas: 节点 ${nodeId} 直接更新属性: x=${targetX}, y=${targetY}`);
                        node.x = targetX;
                        node.y = targetY;
                        if (typeof node.update === 'function') {
                            node.update();
                            trace(`arrangeCanvas: 节点 ${nodeId} update() 调用成功`);
                        }
                        updatedCount++;
                    }
                    // 最后才尝试 DOM 操作（但这种方式不会同步到 Canvas 内部数据）
                    else if (node.nodeEl) {
                        const nodeEl = node.nodeEl as HTMLElement;
                        // 设置 transform 来移动节点（仅作为视觉效果，不推荐）
                        nodeEl.style.transform = `translate(${targetX}px, ${targetY}px)`;
                        warn(`arrangeCanvas: 节点 ${nodeId} DOM transform 更新（仅视觉效果）`);
                        updatedCount++;
                    } else {
                        failedCount++;
                    }
                } else {
                    warn(`arrangeCanvas: 警告 - 未找到节点 ${nodeId}`);
                    failedCount++;
                }
            }

            info(`arrangeCanvas: 成功更新 ${updatedCount} 个节点, 失败 ${failedCount} 个`);

            // 强制 Canvas 重绘并保存
            if (typeof canvas.requestUpdate === 'function') {
                canvas.requestUpdate();
                debug("arrangeCanvas: requestUpdate() 调用成功");
            } else {
                trace("arrangeCanvas: requestUpdate() 方法不存在");
            }
            
            if (canvas.requestSave) {
                canvas.requestSave();
                debug("arrangeCanvas: requestSave() 调用成功");
            } else {
                trace("arrangeCanvas: requestSave() 方法不存在");
            }

            // 同步更新所有折叠按钮的尺寸（需要 CanvasManager 的方法）
            // this.canvasManager.updateAllCollapseButtonSizes(canvas);
            debug("arrangeCanvas: 折叠按钮尺寸同步完成");

            // 在 arrange 完成后，检查并清除已连接节点的浮动状态
            await this.checkAndClearConnectedFloatingNodes(canvas);

            // 清理残留的浮动节点数据（不存在的节点）
            await this.cleanupStaleFloatingNodes(canvas, nodes);

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
        const edges = canvas.edges instanceof Map ? Array.from(canvas.edges.values()) : 
                     Array.isArray(canvas.edges) ? canvas.edges : [];

        if (!nodes || nodes.size === 0) {
            trace('autoArrangeAfterToggle: 没有节点数据');
            return;
        }

        try {
            // 获取所有子节点ID（包括后代）
            const allChildNodeIds = new Set<string>();
            this.collapseStateManager.addAllDescendantsToSet(nodeId, edges, allChildNodeIds);
            
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
            
            const newLayout = originalArrangeLayout(visibleNodes, edges, layoutSettings);

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
    // 拖拽时同步隐藏的子节点
    // =========================================================================
    async syncHiddenChildrenOnDrag(node: any) {
        // 这里可以实现拖拽时同步隐藏子节点的逻辑
        // 目前先留空，因为主要问题在删除和浮动节点
        debug(`syncHiddenChildrenOnDrag called for node ${node?.id}`);
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

            const canvas = (activeView as any)?.canvas;
            if (!canvas) {
                info(`[layout-manager.clearFloatingNodeState] 无法获取 canvas 对象`);
                return;
            }

            const canvasFilePath = canvas.file?.path || (activeView as any).file?.path;
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
}
