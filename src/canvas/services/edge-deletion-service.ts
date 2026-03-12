import { App, Notice, Plugin } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../../settings/types';
import { CanvasFileService } from './canvas-file-service';
import { FloatingNodeService } from './floating-node-service';
import { log } from '../../utils/logger';
import { CONSTANTS } from '../../constants';
import { getCanvasView, getCurrentCanvasFilePath, getEdgeFromNodeId, getEdgeToNodeId, getSelectedEdge } from '../../utils/canvas-utils';
import { CanvasLike, CanvasEdgeLike, ICanvasManager, CanvasViewLike } from '../types';
import { requestCanvasSave, requestCanvasUpdate } from '../adapters/canvas-runtime-adapter';
import { clearEdgeSelectionState, setSingleSelectedEdgeState } from '../adapters/canvas-selection-adapter';

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
            new Notice('未找到活动的 canvas');
            return;
        }

        const canvas = (canvasView as CanvasViewLike).canvas;
        if (!canvas) {
            new Notice('画布未初始化');
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

            // 开始删除操作，暂停新边检测
            this.canvasManager?.startDeletingOperation();

            // 核心修复：调用 Canvas 的原生删除机制
            const nativeDeleteSuccess = this.triggerNativeEdgeDelete(edge, canvas);
            log(`[EdgeDelete] 原生删除: ${nativeDeleteSuccess ? '成功' : '失败，使用兜底方案'}`);

            // 文件层删除：只有这里真实删到边，后续孤立/浮动后处理才允许继续
            let hasOtherIncomingEdges = false;
            const edgeRemovedFromFile = await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (canvasData) => {
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

            log(
                `[EdgeDelete] 文件删边结果: removed=${edgeRemovedFromFile}, ` +
                `hasOtherIncoming=${hasOtherIncomingEdges}, parent=${parentNodeId || 'none'}, child=${childNodeId || 'none'}`
            );

            // 如果原生删除失败，手动清理 Canvas 内存中的边
            if (!nativeDeleteSuccess) {
                this.manualCleanupEdge(edge, canvas, parentNodeId, childNodeId);
            }

            if (!edgeRemovedFromFile) {
                log(
                    `[EdgeDelete] 跳过孤立/浮动后处理: reason=edge-not-removed-from-file, ` +
                    `parent=${parentNodeId || 'none'}, child=${childNodeId || 'none'}`
                );
            }

            if (edgeRemovedFromFile && childNodeId && parentNodeId && !hasOtherIncomingEdges) {
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

                // 修复：不再调用 initialize()，直接标记浮动节点
                // initialize() 会触发 reapplyAllFloatingStyles() 导致与其他操作冲突
                this.floatingNodeService.removeFromRecentConnected(childNodeId);
                await this.floatingNodeService.markNodeAsFloating(childNodeId, parentNodeId, canvasFilePath, subtreeIds, true);
            } else if (edgeRemovedFromFile) {
                log(
                    `[EdgeDelete] 跳过浮动标记: removed=${edgeRemovedFromFile}, ` +
                    `parent=${parentNodeId || 'none'}, child=${childNodeId || 'none'}, hasOtherIncoming=${hasOtherIncomingEdges}`
                );
            }

            // 结束删除操作，恢复新边检测并更新边快照
            this.canvasManager?.endDeletingOperation(canvas);

            setTimeout(() => {
                if (this.canvasManager) {
                    log(`[EdgeDelete] 刷新折叠按钮`);
                    void this.canvasManager.checkAndAddCollapseButtons();
                }
            }, CONSTANTS.TIMING.STYLE_APPLY_DELAY);
        } catch (err) {
            log(`[EdgeDelete] 失败`, err);
            this.canvasManager?.endDeletingOperation(canvas);
        }
    }

    /**
     * 触发 Canvas 的原生边删除机制
     */
    private triggerNativeEdgeDelete(edge: CanvasEdgeLike, canvas: CanvasLike): boolean {
        try {
            const canvasAny = canvas as CanvasLike & {
                removeEdge?: (edge: CanvasEdgeLike) => void;
                deleteEdge?: (edge: CanvasEdgeLike) => void;
                removeSelection?: () => void;
            };

            if (typeof canvasAny.removeEdge === 'function') {
                canvasAny.removeEdge(edge);
                log(`[EdgeDelete] 使用 canvas.removeEdge`);
                return true;
            }

            if (typeof canvasAny.deleteEdge === 'function') {
                canvasAny.deleteEdge(edge);
                log(`[EdgeDelete] 使用 canvas.deleteEdge`);
                return true;
            }

            if (typeof canvasAny.removeSelection === 'function') {
                setSingleSelectedEdgeState(canvas, edge, { clearSelection: true });
                canvasAny.removeSelection();
                log(`[EdgeDelete] 使用 canvas.removeSelection`);
                return true;
            }

            // 模拟 Delete 键
            setSingleSelectedEdgeState(canvas, edge);
            const canvasEl = document.querySelector('.canvas-wrapper') || document.querySelector('.canvas');
            if (canvasEl) {
                const deleteEvent = new KeyboardEvent('keydown', {
                    key: 'Delete',
                    code: 'Delete',
                    keyCode: 46,
                    bubbles: true,
                    cancelable: true
                });
                canvasEl.dispatchEvent(deleteEvent);
                log(`[EdgeDelete] 模拟 Delete 键`);
            }

            return false;
        } catch (err) {
            log(`[EdgeDelete] 原生删除异常`, err);
            return false;
        }
    }

    /**
     * 兜底清理逻辑：手动清理 Canvas 内存和 DOM
     */
    private manualCleanupEdge(
        edge: CanvasEdgeLike,
        canvas: CanvasLike,
        parentNodeId: string | null,
        childNodeId: string | null
    ): void {
        try {
            if (canvas.edges && edge?.id) {
                const edgeId = edge.id;
                if (canvas.edges instanceof Map && canvas.edges.has(edgeId)) {
                    canvas.edges.delete(edgeId);
                }
                clearEdgeSelectionState(canvas, edge);

                this.removeEdgeDomElements(edge);
            }

            if (canvas.fileData?.edges && parentNodeId && childNodeId) {
                canvas.fileData.edges = canvas.fileData.edges.filter((e) => {
                    const fromId = getEdgeFromNodeId(e);
                    const toId = getEdgeToNodeId(e);
                    return !(fromId === parentNodeId && toId === childNodeId);
                });
            }

            // [修复] 关键步骤：强制 Canvas 重新渲染
            // 如果不调用 requestUpdate，Canvas 可能会缓存旧的边数据，
            // 下次渲染时重新创建已删除边的 DOM 元素
            if (requestCanvasUpdate(canvas)) {
                log(`[EdgeDelete] 触发 canvas.requestUpdate() 强制重新渲染`);
            } else if (requestCanvasSave(canvas)) {
                log(`[EdgeDelete] 触发 canvas.requestSave() 保存状态`);
            }
        } catch (err) {
            log(`[EdgeDelete] 兜底清理失败`, err);
        }
    }

    /**
     * 移除边的 DOM 元素
     */
    private removeEdgeDomElements(edge: CanvasEdgeLike): void {
        try {
            if (edge.lineGroupEl) {
                edge.lineGroupEl.remove();
                log(`[EdgeDelete] 移除 lineGroupEl`);
            }

            const edgeAny = edge as CanvasEdgeLike & {
                lineEl?: HTMLElement;
                labelEl?: HTMLElement;
                wrapperEl?: HTMLElement;
            };

            if (edgeAny.lineEl) edgeAny.lineEl.remove();
            if (edgeAny.labelEl) edgeAny.labelEl.remove();
            if (edgeAny.wrapperEl) edgeAny.wrapperEl.remove();
        } catch (err) {
            log(`[EdgeDelete] 移除 DOM 失败`, err);
        }
    }
}
