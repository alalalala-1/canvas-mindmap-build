import { App, Notice, Plugin, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../settings/types';
import { CollapseStateManager } from '../state/collapse-state';
import { NodeCreationService } from './services/node-creation-service';
import { NodeDeletionService } from './services/node-deletion-service';
import { CanvasFileService } from './services/canvas-file-service';
import { NodeTypeService } from './services/node-type-service';
import { NodeHeightService } from './services/node-height-service';
import { EditTextModal } from '../ui/edit-modal';
import { log } from '../utils/logger';
import { CONSTANTS } from '../constants';
import {
    getCanvasView,
    getCurrentCanvasFilePath
} from '../utils/canvas-utils';
import { CanvasLike, CanvasNodeLike, ICanvasManager, CanvasViewLike } from './types';

export class CanvasNodeManager {
    private app: App;
    private plugin: Plugin;
    private settings: CanvasMindmapBuildSettings;
    private collapseStateManager: CollapseStateManager;
    private canvasManager: ICanvasManager | null = null;

    private canvasFileService: CanvasFileService;
    private nodeCreationService: NodeCreationService;
    private nodeDeletionService: NodeDeletionService;
    private nodeTypeService: NodeTypeService;
    private nodeHeightService: NodeHeightService;

    constructor(
        app: App,
        plugin: Plugin,
        settings: CanvasMindmapBuildSettings,
        collapseStateManager: CollapseStateManager,
        canvasFileService: CanvasFileService
    ) {
        this.app = app;
        this.plugin = plugin;
        this.settings = settings;
        this.collapseStateManager = collapseStateManager;
        this.canvasFileService = canvasFileService;

        this.nodeTypeService = new NodeTypeService(settings);
        this.nodeHeightService = new NodeHeightService(app, settings, canvasFileService, this.nodeTypeService);

        this.nodeCreationService = new NodeCreationService(
            app,
            plugin,
            settings,
            this.canvasFileService
        );
        this.nodeDeletionService = new NodeDeletionService(
            app,
            settings,
            collapseStateManager,
            this.canvasFileService
        );
    }

    setCanvasManager(canvasManager: ICanvasManager): void {
        this.canvasManager = canvasManager;
        this.nodeCreationService.setCanvasManager(canvasManager);
        this.nodeDeletionService.setCanvasManager(canvasManager);
    }

    async addNodeToCanvas(content: string, sourceFile: TFile | null): Promise<void> {
        return this.nodeCreationService.addNodeToCanvas(content, sourceFile);
    }

    async adjustNodeHeightAfterRender(nodeId: string): Promise<void> {
        log(`[Node] adjustNodeHeightAfterRender 被调用, nodeId=${nodeId}`);
        try {
            const newHeightValue = await this.nodeHeightService.adjustNodeHeight(nodeId);

            if (newHeightValue !== null) {
                this.nodeHeightService.syncMemoryNodeHeight(nodeId, newHeightValue);

                const nodeData = this.nodeHeightService.getCanvasNodeElement(nodeId);
                if (nodeData && (!nodeData.nodeEl || nodeData.nodeEl.clientHeight === 0)) {
                    setTimeout(() => {
                        void this.adjustNodeHeightAfterRender(nodeId);
                    }, CONSTANTS.TIMING.RETRY_DELAY);
                }
            }
        } catch (err) {
            log(`[Node] 调整高度失败: ${nodeId}`, err);
        }
    }

    async adjustAllTextNodeHeights(): Promise<number> {
        try {
            const canvasFilePath = this.canvasFileService.getCurrentCanvasFilePath();
            if (!canvasFilePath) {
                log(`[Node] 批量调整跳过: 找不到当前 Canvas 路径`);
                return 0;
            }

            log(`[Node] 开始批量调整高度: ${canvasFilePath}`);
            
            let adjustedCount = 0;
            let increasedCount = 0;
            let decreasedCount = 0;
            let cappedCount = 0;
            let formulaCount = 0;
            let maxIncrease = 0;
            let maxDecrease = 0;
            let missingDomCount = 0;

            const textDimensions = this.nodeTypeService.getTextDimensions();
            const maxHeight = textDimensions.maxHeight;
            const formulaDimensions = this.nodeTypeService.getFormulaDimensions();

            await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (canvasData) => {
                if (!canvasData.nodes) return false;

                let changed = false;

                const canvasView = getCanvasView(this.app);
                const canvas = canvasView ? (canvasView as CanvasViewLike).canvas : null;
                const nodeDomMap = new Map<string, CanvasNodeLike>();
                
                if (canvas?.nodes && canvas.nodes instanceof Map) {
                    for (const [id, nodeData] of canvas.nodes) {
                        if (nodeData?.nodeEl) {
                            nodeDomMap.set(id, nodeData);
                        }
                    }
                }

                for (const node of canvasData.nodes) {
                    if (!node.type || node.type === 'text') {
                        if (node.text) {
                            const isFormula = this.nodeTypeService.isFormula(node.text);

                            let newHeight: number;
                            if (isFormula) {
                                formulaCount++;
                                newHeight = formulaDimensions.height;
                                node.width = formulaDimensions.width;
                            } else {
                                const nodeData = node.id ? nodeDomMap.get(node.id) : undefined;
                                const nodeEl = nodeData?.nodeEl;
                                const calculatedHeight = this.nodeHeightService.calculateTextNodeHeight(node.text, nodeEl);
                                newHeight = Math.min(calculatedHeight, maxHeight);
                                if (!nodeData?.nodeEl) {
                                    missingDomCount++;
                                }
                            }

                            const previousHeight = node.height ?? 0;
                            const delta = newHeight - previousHeight;
                            if (delta > 0) {
                                increasedCount++;
                                if (delta > maxIncrease) maxIncrease = delta;
                            } else if (delta < 0) {
                                decreasedCount++;
                                const absDelta = Math.abs(delta);
                                if (absDelta > maxDecrease) maxDecrease = absDelta;
                            }
                            if (newHeight >= maxHeight) cappedCount++;

                            if (previousHeight !== newHeight) {
                                node.height = newHeight;
                                adjustedCount++;
                                changed = true;
                            }

                            const memNodeData = node.id ? nodeDomMap.get(node.id) : undefined;
                            if (memNodeData) {
                                if (memNodeData.height !== newHeight) {
                                    memNodeData.height = newHeight;
                                    if (memNodeData.nodeEl) {
                                        memNodeData.nodeEl.style.height = `${newHeight}px`;
                                    }
                                    const nodeWithRender = memNodeData as CanvasNodeLike & { render?: () => void };
                                    if (typeof nodeWithRender.render === 'function') {
                                        nodeWithRender.render();
                                    }
                                }
                            }
                        }
                    }
                }
                return changed;
            });

            const canvasView = getCanvasView(this.app);
            if (canvasView) {
                const canvas = (canvasView as CanvasViewLike).canvas;
                if (canvas) {
                    if (typeof canvas.requestSave === 'function') canvas.requestSave();
                    if (typeof canvas.requestUpdate === 'function') canvas.requestUpdate();
                }
            }

            if (adjustedCount > 0) {
                new Notice(`已调整 ${adjustedCount} 个节点高度`);
                log(`[Node] 批量调整完成: ${adjustedCount}`);
            } else {
                log(`[Node] 批量调整完成: 无需更新节点高度`);
            }
            log(`[Node] 批量调整统计: 增加=${increasedCount}, 减少=${decreasedCount}, maxIncrease=${maxIncrease.toFixed(1)}, maxDecrease=${maxDecrease.toFixed(1)}, capped=${cappedCount}, formula=${formulaCount}, missingDom=${missingDomCount}`);
            return adjustedCount;
        } catch (err) {
            log(`[Node] 批量调整失败:`, err);
            return 0;
        }
    }

    async handleSingleDelete(node: CanvasNodeLike, canvas: CanvasLike): Promise<void> {
        return this.nodeDeletionService.handleSingleDelete(node, canvas);
    }

    async handleCascadeDelete(node: CanvasNodeLike, canvas: CanvasLike): Promise<void> {
        return this.nodeDeletionService.handleCascadeDelete(node, canvas);
    }

    async editNodeText(node: CanvasNodeLike, canvas: CanvasLike): Promise<void> {
        const currentText = node.text || '';

        const modal = new EditTextModal(
            this.app,
            currentText,
            async (newText: string) => {
                if (newText && newText !== currentText) {
                    try {
                        const currentCanvasView = getCanvasView(this.app);
                        const canvasFilePath = currentCanvasView ? this.canvasFileService.getCanvasFilePathFromView(currentCanvasView) : undefined;
                        if (!canvasFilePath) {
                            throw new Error('无法获取 Canvas 文件路径');
                        }

                        await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (data) => {
                            const nodeData = data.nodes?.find(n => n.id === node.id);
                            if (nodeData && nodeData.text !== newText) {
                                nodeData.text = newText;
                                return true;
                            }
                            return false;
                        });

                        if (typeof (canvas as CanvasLike & { reload?: () => void }).reload === 'function') {
                            (canvas as CanvasLike & { reload?: () => void }).reload!();
                        }

                        this.refreshNodeAndButtons();
                    } catch (err) {
                        log(`[Node] 更新文本失败: ${err}`);
                    }
                }
            }
        );

        modal.open();
    }

    private refreshNodeAndButtons(): void {
        const canvasView = getCanvasView(this.app);
        if (canvasView && this.canvasManager) {
            this.canvasManager.checkAndAddCollapseButtons();
        }
    }

    adjustNodeHeight(nodeId: string, newHeight: number): void {
        const canvasView = getCanvasView(this.app);
        if (!canvasView) return;

        const canvas = (canvasView as CanvasViewLike).canvas;
        if (!canvas?.nodes || !(canvas.nodes instanceof Map)) return;
        
        const node = canvas.nodes.get(nodeId);

        if (!node) return;

        if (node.height !== newHeight) {
            node.height = newHeight;
            const nodeWithRender = node as CanvasNodeLike & { render?: () => void };
            if (typeof nodeWithRender.render === 'function') {
                nodeWithRender.render();
            }
            if (typeof canvas.requestSave === 'function') {
                canvas.requestSave();
            }
        }
    }

    getCurrentCanvasFilePath(): string | undefined {
        return getCurrentCanvasFilePath(this.app);
    }

    public calculateTextNodeHeight(content: string, nodeEl?: Element): number {
        return this.nodeHeightService.calculateTextNodeHeight(content, nodeEl);
    }
}
