import { App, ItemView, Notice, Plugin } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../../settings/types';
import { CanvasFileService } from './canvas-file-service';
import { FloatingNodeService } from './floating-node-service';
import { log } from '../../utils/logger';
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
    private canvasManager: any;

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

    setCanvasManager(canvasManager: any): void {
        this.canvasManager = canvasManager;
    }

    /**
     * 删除当前选中的边
     */
    async deleteSelectedEdge(): Promise<void> {
        log('[Event] UI: 确认删除边');
        const canvasView = getCanvasView(this.app);
        if (!canvasView) {
            new Notice('No active canvas found');
            return;
        }

        const canvas = (canvasView as any).canvas;
        if (!canvas) {
            new Notice('Canvas not initialized');
            return;
        }
        
        const edge = this.getSelectedEdge(canvas);

        if (!edge) {
            new Notice('No edge selected');
            return;
        }
        
        await this.deleteEdge(edge, canvas);
    }

    /**
     * 获取当前选中的边
     */
    private getSelectedEdge(canvas: any): any | null {
        if (canvas.selectedEdge) {
            return canvas.selectedEdge;
        }
        
        if (canvas.selectedEdges && canvas.selectedEdges.length > 0) {
            return canvas.selectedEdges[0];
        }
        
        if (canvas.edges) {
            const edgesArray = Array.from(canvas.edges.values()) as any[];
            for (const edge of edgesArray) {
                const isFocused = edge?.lineGroupEl?.classList?.contains('is-focused');
                const isSelected = edge?.lineGroupEl?.classList?.contains('is-selected');
                
                if (isFocused || isSelected) {
                    return edge;
                }
            }
        }
        
        return null;
    }

    /**
     * 删除指定的边
     */
    private async deleteEdge(edge: any, canvas: any): Promise<void> {
        try {
            const parentNodeId = edge.from?.node?.id || edge.fromNode;
            const childNodeId = edge.to?.node?.id || edge.toNode;
            
            log(`[EdgeDelete] 边: ${parentNodeId} -> ${childNodeId}`);

            const canvasFilePath = canvas.file?.path || getCurrentCanvasFilePath(this.app);
            if (!canvasFilePath) return;

            let hasOtherIncomingEdges = false;
            const success = await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (canvasData) => {
                if (!canvasData.edges) return false;
                
                const originalEdgeCount = canvasData.edges.length;
                canvasData.edges = canvasData.edges.filter((e: any) => {
                    const fromId = e.from?.node?.id || e.fromNode;
                    const toId = e.to?.node?.id || e.toNode;
                    return !(fromId === parentNodeId && toId === childNodeId);
                });
                
                hasOtherIncomingEdges = canvasData.edges.some((e: any) => {
                    const toId = e.to?.node?.id || e.toNode;
                    return toId === childNodeId;
                });
                
                return canvasData.edges.length !== originalEdgeCount;
            });

            if (canvas.edges && edge.id) {
                const edgeId = edge.id;
                if (canvas.edges.has(edgeId)) {
                    canvas.edges.delete(edgeId);
                }
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

            if (childNodeId && parentNodeId && !hasOtherIncomingEdges) {
                log(`[EdgeDelete] 孤立: ${childNodeId}`);
                
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

                await this.floatingNodeService.initialize(canvasFilePath, canvas);
                await this.floatingNodeService.markNodeAsFloating(childNodeId, parentNodeId, canvasFilePath, subtreeIds);
            }

            // 统一刷新画布
            this.reloadCanvas(canvas);
            
            // 刷新折叠按钮（延迟执行确保DOM更新）
            setTimeout(() => {
                if (this.canvasManager) {
                    log(`[EdgeDelete] 刷新折叠按钮`);
                    this.canvasManager.checkAndAddCollapseButtons();
                }
            }, 200);
        } catch (err) {
            log(`[EdgeDelete] 失败`, err);
        }
    }

    /**
     * 刷新画布
     */
    private reloadCanvas(canvas: any): void {
        if (typeof canvas.reload === 'function') {
            canvas.reload();
        } else if (typeof canvas.requestUpdate === 'function') {
            canvas.requestUpdate();
        } else if (canvas.requestSave) {
            canvas.requestSave();
        }
    }
}
