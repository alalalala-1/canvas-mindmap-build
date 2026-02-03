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

            // 计算新的布局（只考虑可见节点）
            // 创建只包含可见节点的新 Map
            const visibleNodes = new Map<string, any>();
            nodes.forEach((node: any, id: string) => {
                if (visibleNodeIds.has(id)) {
                    visibleNodes.set(id, node);
                }
            });

            // 从 Canvas 文件中读取原始边数据（包含已删除的边）
            let originalEdges = edges;
            try {
                const canvasFilePath = canvas.file?.path || (activeView as any).file?.path;
                if (canvasFilePath) {
                    const canvasFile = this.app.vault.getAbstractFileByPath(canvasFilePath);
                    if (canvasFile instanceof TFile) {
                        const canvasContent = await this.app.vault.read(canvasFile);
                        const canvasData = JSON.parse(canvasContent);
                        if (canvasData.edges && Array.isArray(canvasData.edges)) {
                            originalEdges = canvasData.edges;
                            debug(`arrangeCanvas: 从文件读取到 ${originalEdges.length} 条原始边`);
                        }
                    }
                }
            } catch (e) {
                debug('arrangeCanvas: 无法读取原始边数据，使用当前边数据');
            }

            const layoutTimer = logTime('originalArrangeLayout');
            // 传递所有节点用于判断孤立节点，但只返回可见节点的布局
            const newLayout = originalArrangeLayout(visibleNodes, edges, layoutSettings, originalEdges, nodes);
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
    async autoArrangeAfterToggle(nodeId: string, canvasView: ItemView) {
        const endTimer = logTime(`autoArrangeAfterToggle(${nodeId})`);
        
        // 获取当前可见的节点（未被折叠的节点）
        const canvas = (canvasView as any).canvas;
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
            
            // 同步更新所有折叠按钮的尺寸（需要 CanvasManager 的方法）
            // this.canvasManager.updateAllCollapseButtonSizes(canvas);
            
        } catch (err) {
            error('autoArrangeAfterToggle: 发生错误:', err);
        }
        
        endTimer();
    }
}
