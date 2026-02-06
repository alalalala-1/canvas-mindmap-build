import { App, ItemView, Notice, Plugin } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../../settings/types';
import { CanvasFileService } from './canvas-file-service';
import { FloatingNodeService } from './floating-node-service';
import { info, warn, debug, error } from '../../utils/logger';
import { getCanvasView, getCurrentCanvasFilePath } from '../../utils/canvas-utils';

/**
 * 边删除服务
 * 负责删除选中的边，并处理由此产生的浮动节点状态
 */
export class EdgeDeletionService {
    private app: App;
    private plugin: Plugin;
    private settings: CanvasMindmapBuildSettings;
    private canvasFileService: CanvasFileService;
    private floatingNodeService: FloatingNodeService;

    constructor(
        app: App,
        plugin: Plugin,
        settings: CanvasMindmapBuildSettings,
        canvasFileService: CanvasFileService,
        floatingNodeService: FloatingNodeService
    ) {
        this.app = app;
        this.plugin = plugin;
        this.settings = settings;
        this.canvasFileService = canvasFileService;
        this.floatingNodeService = floatingNodeService;
    }

    /**
     * 删除当前选中的边
     */
    async deleteSelectedEdge(): Promise<void> {
        info('开始执行删除边命令');
        
        const canvasView = getCanvasView(this.app);
        if (!canvasView) {
            warn('未找到 canvas 视图');
            new Notice('No active canvas found');
            return;
        }
        info('找到 canvas 视图');

        const canvas = (canvasView as any).canvas;
        if (!canvas) {
            warn('canvas 视图中没有 canvas 对象');
            new Notice('Canvas not initialized');
            return;
        }
        
        const edge = this.getSelectedEdge(canvas);

        if (!edge) {
            warn('未找到选中的边');
            new Notice('No edge selected');
            return;
        }
        
        info(`找到选中的边: ${edge.id || 'unknown'}`);
        await this.deleteEdge(edge, canvas);
    }

    /**
     * 获取当前选中的边
     */
    private getSelectedEdge(canvas: any): any | null {
        debug('开始查找选中的边...');
        
        if (canvas.selectedEdge) {
            debug('找到 canvas.selectedEdge');
            return canvas.selectedEdge;
        }
        
        if (canvas.selectedEdges && canvas.selectedEdges.length > 0) {
            debug(`找到 canvas.selectedEdges，数量: ${canvas.selectedEdges.length}`);
            return canvas.selectedEdges[0];
        }
        
        if (canvas.edges) {
            const edgesArray = Array.from(canvas.edges.values()) as any[];
            debug(`检查 ${edgesArray.length} 条边...`);
            
            for (const edge of edgesArray) {
                const isFocused = edge?.lineGroupEl?.classList?.contains('is-focused');
                const isSelected = edge?.lineGroupEl?.classList?.contains('is-selected');
                
                if (isFocused || isSelected) {
                    debug(`找到选中的边: ${edge?.id}, focused: ${isFocused}, selected: ${isSelected}`);
                    return edge;
                }
            }
        }
        
        debug('未找到选中的边');
        return null;
    }

    /**
     * 删除指定的边
     */
    private async deleteEdge(edge: any, canvas: any): Promise<void> {
        try {
            const parentNodeId = edge.from?.node?.id || edge.fromNode;
            const childNodeId = edge.to?.node?.id || edge.toNode;
            
            info(`准备原子化删除边: ${parentNodeId} -> ${childNodeId}`);

            // 获取 canvas 文件路径
            const canvasFilePath = canvas.file?.path || getCurrentCanvasFilePath(this.app);
            
            if (!canvasFilePath) {
                warn('无法获取 canvas 文件路径');
                return;
            }

            // 使用原子操作删除边
            let hasOtherIncomingEdges = false;
            const success = await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (canvasData) => {
                if (!canvasData.edges) return false;
                
                const originalEdgeCount = canvasData.edges.length;
                canvasData.edges = canvasData.edges.filter((e: any) => {
                    const fromId = e.from?.node?.id || e.fromNode;
                    const toId = e.to?.node?.id || e.toNode;
                    return !(fromId === parentNodeId && toId === childNodeId);
                });
                
                // 检查节点是否还有其他入边
                hasOtherIncomingEdges = canvasData.edges.some((e: any) => {
                    const toId = e.to?.node?.id || e.toNode;
                    return toId === childNodeId;
                });
                
                return canvasData.edges.length !== originalEdgeCount;
            });

            if (success) {
                info('Canvas 文件已原子化更新');
            }

            // 从 Canvas 内存中删除边（如果存在）
            if (canvas.edges && edge.id) {
                const edgeId = edge.id;
                if (canvas.edges.has(edgeId)) {
                    canvas.edges.delete(edgeId);
                    info(`已从 Canvas 内存中删除边: ${edgeId}`);
                }
                // 同时清理选中状态
                if (canvas.selectedEdge === edge) {
                    canvas.selectedEdge = null;
                }
                if (canvas.selectedEdges) {
                    const index = canvas.selectedEdges.indexOf(edge);
                    if (index > -1) {
                        canvas.selectedEdges.splice(index, 1);
                    }
                }
            }

            // 标记孤立节点为浮动状态（及其整个子树）
            if (childNodeId && parentNodeId && !hasOtherIncomingEdges) {
                info(`标记孤立节点 ${childNodeId} 及其子树为浮动状态，原父节点: ${parentNodeId}`);
                
                // 获取整个子树
                const subtreeIds: string[] = [];
                if (canvas.nodes && canvas.edges) {
                    const childrenMap = new Map<string, string[]>();
                    canvas.edges.forEach((e: any) => {
                        const f = e.from?.node?.id || e.fromNode;
                        const t = e.to?.node?.id || e.toNode;
                        if (f && t) {
                            if (!childrenMap.has(f)) childrenMap.set(f, []);
                            childrenMap.get(f)!.push(t);
                        }
                    });

                    const collectSubtree = (id: string) => {
                        const children = childrenMap.get(id) || [];
                        for (const childId of children) {
                            if (!subtreeIds.includes(childId)) {
                                subtreeIds.push(childId);
                                collectSubtree(childId);
                            }
                        }
                    };
                    collectSubtree(childNodeId);
                }

                // 确保浮动节点服务已初始化
                await this.floatingNodeService.initialize(canvasFilePath, canvas);
                // 标记浮动状态（包括子树）
                await this.floatingNodeService.markNodeAsFloating(childNodeId, parentNodeId, canvasFilePath, subtreeIds);
            }

            // 触发UI更新
            if (typeof canvas.requestUpdate === 'function') {
                canvas.requestUpdate();
            } else if (typeof canvas.reload === 'function') {
                canvas.reload();
            }

            new Notice('Edge deleted successfully');
        } catch (err) {
            error(`删除边失败: ${err}`);
            new Notice('Failed to delete edge');
        }
    }
}
