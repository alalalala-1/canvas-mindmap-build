import { App, ItemView, Notice, Plugin } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../../settings/types';
import { CanvasFileService } from './canvas-file-service';
import { FloatingNodeService } from './floating-node-service';
import { log } from '../../utils/logger';
import { getCanvasView, getCurrentCanvasFilePath, getEdgeFromNodeId, getEdgeToNodeId } from '../../utils/canvas-utils';
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
        
        const edge = this.getSelectedEdge(canvas);

        if (!edge) {
            new Notice('未选中边');
            return;
        }
        
        await this.deleteEdge(edge, canvas);
    }

    private getSelectedEdge(canvas: CanvasLike): CanvasEdgeLike | null {
        if (canvas.selectedEdge) {
            return canvas.selectedEdge;
        }
        
        if (canvas.selectedEdges && canvas.selectedEdges.length > 0) {
            return canvas.selectedEdges[0] || null;
        }
        
        if (canvas.edges) {
            const edgesArray = canvas.edges instanceof Map
                ? Array.from(canvas.edges.values())
                : Array.isArray(canvas.edges)
                    ? canvas.edges
                    : [];
                    
            for (const edge of edgesArray) {
                const isFocused = edge.lineGroupEl?.classList.contains('is-focused');
                const isSelected = edge.lineGroupEl?.classList.contains('is-selected');
                
                if (isFocused || isSelected) {
                    return edge;
                }
            }
        }
        
        return null;
    }

    private async deleteEdge(edge: CanvasEdgeLike, canvas: CanvasLike): Promise<void> {
        try {
            const parentNodeId = getEdgeFromNodeId(edge);
            const childNodeId = getEdgeToNodeId(edge);
            
            log(`[EdgeDelete] 边: ${parentNodeId} -> ${childNodeId}`);

            const canvasFilePath = canvas.file?.path || getCurrentCanvasFilePath(this.app);
            if (!canvasFilePath) return;

            let hasOtherIncomingEdges = false;
            const success = await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (canvasData) => {
                if (!canvasData.edges) return false;
                
                const originalEdgeCount = canvasData.edges.length;
                canvasData.edges = canvasData.edges.filter((e) => {
                    const fromId = typeof e.from === 'string' ? e.from : (e.from?.node?.id || e.fromNode);
                    const toId = typeof e.to === 'string' ? e.to : (e.to?.node?.id || e.toNode);
                    return !(fromId === parentNodeId && toId === childNodeId);
                });
                
                hasOtherIncomingEdges = canvasData.edges.some((e) => {
                    const toId = typeof e.to === 'string' ? e.to : (e.to?.node?.id || e.toNode);
                    return toId === childNodeId;
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

                await this.floatingNodeService.initialize(canvasFilePath, canvas);
                await this.floatingNodeService.markNodeAsFloating(childNodeId, parentNodeId, canvasFilePath, subtreeIds);
            }

            this.reloadCanvas(canvas);
            
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

    private reloadCanvas(canvas: CanvasLike): void {
        const canvasWithReload = canvas as CanvasLike & { reload?: () => void };
        if (typeof canvasWithReload.reload === 'function') {
            canvasWithReload.reload();
        } else if (typeof canvas.requestUpdate === 'function') {
            canvas.requestUpdate();
        } else if (canvas.requestSave) {
            canvas.requestSave();
        }
    }
}
