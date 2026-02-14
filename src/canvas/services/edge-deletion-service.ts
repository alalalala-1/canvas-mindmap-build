import { App, Notice, Plugin } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../../settings/types';
import { CanvasFileService } from './canvas-file-service';
import { FloatingNodeService } from './floating-node-service';
import { log } from '../../utils/logger';
import { CONSTANTS } from '../../constants';
import { getCanvasView, getCurrentCanvasFilePath, getEdgeFromNodeId, getEdgeToNodeId, reloadCanvas, getSelectedEdge } from '../../utils/canvas-utils';
import { CanvasLike, CanvasEdgeLike, ICanvasManager, CanvasViewLike } from '../types';

export class EdgeDeletionService {
    private app: App;
    private plugin: Plugin;
    private settings: CanvasMindmapBuildSettings;
    private canvasFileService: CanvasFileService;
    private floatingNodeService: FloatingNodeService;
    private canvasManager: ICanvasManager | null = null;

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

    setCanvasManager(canvasManager: ICanvasManager): void {
        this.canvasManager = canvasManager;
    }

    async deleteSelectedEdge(): Promise<void> {
        log('[Event] UI: 确认删除边');
        const canvasView = getCanvasView(this.app);
        if (!canvasView) {
            new Notice('未找到活动的 Canvas');
            return;
        }

        const canvas = (canvasView as CanvasViewLike).canvas;
        if (!canvas) {
            new Notice('Canvas 未初始化');
            return;
        }
        
        const edge = getSelectedEdge(canvas);

        if (!edge) {
            new Notice('未选中边');
            return;
        }
        
        await this.deleteEdge(edge, canvas);
    }

    private async deleteEdge(edge: CanvasEdgeLike, canvas: CanvasLike): Promise<void> {
        try {
            const parentNodeId = getEdgeFromNodeId(edge);
            const childNodeId = getEdgeToNodeId(edge);
            
            log(`[EdgeDelete] 边: ${parentNodeId} -> ${childNodeId}`);

            const canvasFilePath = canvas.file?.path || getCurrentCanvasFilePath(this.app);
            if (!canvasFilePath) return;

            let hasOtherIncomingEdges = false;
            await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (canvasData) => {
                if (!canvasData.edges) return false;
                
                const originalEdgeCount = canvasData.edges.length;
                canvasData.edges = canvasData.edges.filter((e) => {
                    const fromId = getEdgeFromNodeId(e);
                    const toId = getEdgeToNodeId(e);
                    return !(fromId === parentNodeId && toId === childNodeId);
                });
                
                hasOtherIncomingEdges = canvasData.edges.some((e) => {
                    return getEdgeToNodeId(e) === childNodeId;
                });
                
                return canvasData.edges.length !== originalEdgeCount;
            });

            if (canvas.edges && edge?.id) {
                const edgeId = edge.id;
                if (canvas.edges instanceof Map && canvas.edges.has(edgeId)) {
                    canvas.edges.delete(edgeId);
                }
                if (canvas.selectedEdge === edge) {
                    (canvas as { selectedEdge?: CanvasEdgeLike | null }).selectedEdge = null;
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
                    const edgesArray = canvas.edges instanceof Map
                        ? Array.from(canvas.edges.values())
                        : Array.isArray(canvas.edges)
                            ? canvas.edges
                            : [];
                    
                    for (const e of edgesArray) {
                        const f = getEdgeFromNodeId(e);
                        const t = getEdgeToNodeId(e);
                        if (f && t) {
                            if (!childrenMap.has(f)) childrenMap.set(f, []);
                            childrenMap.get(f)!.push(t);
                        }
                    }

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

                this.floatingNodeService.removeFromRecentConnected(childNodeId);
                await this.floatingNodeService.initialize(canvasFilePath, canvas);
                await this.floatingNodeService.markNodeAsFloating(childNodeId, parentNodeId, canvasFilePath, subtreeIds);
            }

            reloadCanvas(canvas);
            
            setTimeout(() => {
                if (this.canvasManager) {
                    log(`[EdgeDelete] 刷新折叠按钮`);
                    this.canvasManager.checkAndAddCollapseButtons();
                }
            }, CONSTANTS.TIMING.STYLE_APPLY_DELAY);
        } catch (err) {
            log(`[EdgeDelete] 失败`, err);
        }
    }
}
