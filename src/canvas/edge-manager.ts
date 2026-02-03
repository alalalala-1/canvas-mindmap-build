import { App, ItemView, MarkdownView, Notice, Plugin, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../settings/types';
import { CollapseStateManager } from '../state/collapse-state';
import { debug, info, warn, error, logTime } from '../utils/logger';
import { DeleteConfirmationModal, DeleteConfirmationResult } from '../ui/delete-modal';

/**
 * 边管理器 - 负责边相关的操作和删除逻辑
 */
export class EdgeManager {
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
        debug('EdgeManager 实例化完成');
    }

    /**
     * 执行删除操作
     */
    async executeDeleteOperation(selectedNode: any, canvas: any) {
        const endTimer = logTime('executeDeleteOperation');
        
        // 检查节点是否有子节点
        let edges: any[] = [];
        if (canvas.fileData?.edges) edges = canvas.fileData.edges;
        if (canvas.edges) edges = Array.from(canvas.edges.values());
        
        const hasChildren = this.collapseStateManager.getChildNodes(selectedNode.id, edges).length > 0;
        debug(`节点 ${selectedNode.id} 有子节点: ${hasChildren}`);
        
        // 显示确认对话框（根据是否有子节点显示不同选项）
        const modal = new DeleteConfirmationModal(this.app, hasChildren);
        modal.open();
        const result = await modal.waitForResult();
        
        if (result.action === 'cancel') {
            debug('用户取消删除操作');
            return;
        }
        
        if (result.action === 'confirm' || result.action === 'single') {
            // 'confirm' 用于无子节点的情况，'single' 用于有子节点的情况
            info(`执行单个删除: ${selectedNode.id}`);
            await this.handleSingleDelete(selectedNode, canvas);
        } else if (result.action === 'cascade') {
            info(`执行级联删除: ${selectedNode.id}`);
            await this.handleCascadeDelete(selectedNode, canvas);
        }
        
        endTimer();
    }

    /**
     * 单个删除：删除当前节点，子节点连接到父节点
     */
    private async handleSingleDelete(node: any, canvas: any) {
        const endTimer = logTime('handleSingleDelete');
        
        try {
            // 获取所有边数据
            let edges: any[] = [];
            if (canvas.fileData?.edges) edges = canvas.fileData.edges;
            if (canvas.edges) edges = Array.from(canvas.edges.values());
            
            // 获取所有节点数据
            const allNodes = Array.from(canvas.nodes.values());
            
            // 找到被删除节点的父节点
            const parentNode = this.findParentNode(node.id, edges, allNodes);
            debug(`节点 ${node.id} 的父节点:`, parentNode?.id);
            
            // 找到被删除节点的子节点
            const childNodes = this.collapseStateManager.getChildNodes(node.id, edges);
            debug(`节点 ${node.id} 的子节点:`, childNodes);
            
            // 如果有父节点和子节点，重新连接
            if (parentNode && childNodes.length > 0) {
                // 创建新的边连接父节点到子节点
                const newEdges: any[] = [];
                for (const childId of childNodes) {
                    const newEdge = {
                        id: this.generateRandomId(),
                        fromNode: parentNode.id,
                        fromSide: 'right',
                        toNode: childId,
                        toSide: 'left'
                    };
                    newEdges.push(newEdge);
                }
                
                debug(`创建 ${newEdges.length} 条新边连接父节点到子节点`);
                
                // 更新Canvas数据
                await this.updateCanvasData(canvas, (data: any) => {
                    // 移除被删除节点
                    data.nodes = data.nodes.filter((n: any) => n.id !== node.id);
                    
                    // 移除与被删除节点相关的边（兼容两种格式）
                    data.edges = data.edges.filter((e: any) => {
                        const fromId = e.from?.node?.id || e.fromNode;
                        const toId = e.to?.node?.id || e.toNode;
                        return fromId !== node.id && toId !== node.id;
                    });
                    
                    // 添加新的边
                    data.edges.push(...newEdges);
                });
            } else {
                // 直接删除节点（没有父节点或没有子节点）
                debug('直接删除节点（无父节点或无子节点）');
                await this.updateCanvasData(canvas, (data: any) => {
                    data.nodes = data.nodes.filter((n: any) => n.id !== node.id);
                    data.edges = data.edges.filter((e: any) => 
                        e.fromNode !== node.id && e.toNode !== node.id
                    );
                });
            }
            
            // 显示之前被折叠隐藏的子节点
            if (childNodes.length > 0) {
                this.showChildNodes(childNodes, canvas);
            }

            // 清理折叠状态
            this.collapseStateManager.clearCache();

            // 重新检查按钮（需要 CanvasManager 的方法）
            // this.canvasManager.checkAndAddCollapseButtons();

            new Notice('节点删除成功！');
            info(`节点 ${node.id} 删除成功`);
            
        } catch (err) {
            error('删除操作失败:', err);
            new Notice('删除操作失败，请重试');
        }
        
        endTimer();
    }
    
    /**
     * 级联删除：删除当前节点及其所有子节点
     */
    private async handleCascadeDelete(node: any, canvas: any) {
        const endTimer = logTime('handleCascadeDelete');
        
        try {
            // 获取所有边数据
            let edges: any[] = [];
            if (canvas.fileData?.edges) edges = canvas.fileData.edges;
            if (canvas.edges) edges = Array.from(canvas.edges.values());
            
            // 收集所有要删除的节点（包括后代）
            const nodesToDelete = new Set<string>();
            nodesToDelete.add(node.id);
            
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
            debug(`级联删除将删除 ${nodesToDelete.size} 个节点:`, Array.from(nodesToDelete));
            
            // 更新Canvas数据
            await this.updateCanvasData(canvas, (data: any) => {
                // 移除所有要删除的节点
                data.nodes = data.nodes.filter((n: any) => !nodesToDelete.has(n.id));
                
                // 移除与删除节点相关的边（兼容两种格式）
                data.edges = data.edges.filter((e: any) => {
                    const fromId = e.from?.node?.id || e.fromNode;
                    const toId = e.to?.node?.id || e.toNode;
                    return !nodesToDelete.has(fromId) && !nodesToDelete.has(toId);
                });
            });
            
            // 清理折叠状态
            this.collapseStateManager.clearCache();
            
            // 重新检查按钮（需要 CanvasManager 的方法）
            // this.canvasManager.checkAndAddCollapseButtons();
            
            new Notice(`成功删除 ${nodesToDelete.size} 个节点！`);
            info(`级联删除成功，共删除 ${nodesToDelete.size} 个节点`);
            
        } catch (err) {
            error('级联删除操作失败:', err);
            new Notice('删除操作失败，请重试');
        }
        
        endTimer();
    }

    /**
     * 显示被折叠隐藏的子节点
     */
    private showChildNodes(childNodeIds: string[], canvas: any) {
        const allNodes = Array.from(canvas.nodes.values());
        let shownCount = 0;

        for (const childId of childNodeIds) {
            const node = allNodes.find((n: any) => n.id === childId) as any;
            if (node?.nodeEl) {
                const el = node.nodeEl as HTMLElement;
                // 检查节点是否被隐藏
                if (el.style.display === 'none') {
                    el.style.display = '';
                    el.style.visibility = '';
                    shownCount++;
                }
            }
        }

        // 同时显示相关的边
        let edges: any[] = [];
        if (canvas.fileData?.edges) edges = canvas.fileData.edges;
        if (canvas.edges) edges = Array.from(canvas.edges.values());

        for (const childId of childNodeIds) {
            for (const edge of edges) {
                const fromId = edge.from?.node?.id || edge.fromNode;
                const toId = edge.to?.node?.id || edge.toNode;

                // 显示与子节点相关的边
                if (fromId === childId || toId === childId) {
                    if (edge.lineGroupEl) {
                        (edge.lineGroupEl as HTMLElement).style.display = '';
                    }
                    if (edge.lineEndGroupEl) {
                        (edge.lineEndGroupEl as HTMLElement).style.display = '';
                    }
                }
            }
        }

        debug(`显示 ${shownCount} 个被折叠隐藏的子节点`);
    }

    /**
     * 更新Canvas数据文件
     */
    private async updateCanvasData(canvas: any, updateCallback: (data: any) => void) {
        const endTimer = logTime('updateCanvasData');
        
        // 获取Canvas文件路径
        let canvasFilePath: string | undefined;
        
        // 方法1: 从 canvas.file.path 获取
        if (canvas.file?.path) {
            canvasFilePath = canvas.file.path;
        }
        
        // 方法2: 从 activeView 获取
        if (!canvasFilePath) {
            const activeView = this.app.workspace.getActiveViewOfType(ItemView);
            if (activeView?.getViewType() === 'canvas' && (activeView as any).file) {
                canvasFilePath = (activeView as any).file.path;
            }
        }
        
        // 方法3: 从 canvas.view.file 获取
        if (!canvasFilePath && canvas.view?.file?.path) {
            canvasFilePath = canvas.view.file.path;
        }
        
        if (!canvasFilePath) {
            throw new Error('无法获取Canvas文件路径');
        }
        
        debug(`更新 Canvas 文件: ${canvasFilePath}`);
        
        const canvasFile = this.app.vault.getAbstractFileByPath(canvasFilePath);
        if (!(canvasFile instanceof TFile)) {
            throw new Error('Canvas file not found');
        }
        
        const canvasContent = await this.app.vault.read(canvasFile);
        const canvasData = JSON.parse(canvasContent);
        
        updateCallback(canvasData);
        
        await this.app.vault.modify(canvasFile, JSON.stringify(canvasData, null, 2));
        
        // 触发Canvas重新加载
        if (typeof canvas.reload === 'function') {
            canvas.reload();
            debug('Canvas reload() 调用成功');
        }
        
        endTimer();
    }

    /**
     * 查找节点的父节点
     */
    private findParentNode(nodeId: string, edges: any[], allNodes: any[]): any | null {
        for (const edge of edges) {
            const fromId = edge.from?.node?.id || edge.fromNode;
            const toId = edge.to?.node?.id || edge.toNode;
            
            if (toId === nodeId) {
                const parentNode = allNodes.find((n: any) => n.id === fromId);
                if (parentNode) {
                    return parentNode;
                }
            }
        }
        return null;
    }

    /**
     * 生成随机ID
     */
    private generateRandomId(): string {
        return Math.random().toString(36).substring(2, 10);
    }
}
