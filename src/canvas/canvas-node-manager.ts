import { App, ItemView, Notice, Plugin, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../settings/types';
import { CollapseStateManager } from '../state/collapse-state';
import { NodeCreationService } from './services/node-creation-service';
import { NodeDeletionService } from './services/node-deletion-service';
import { CanvasFileService } from './services/canvas-file-service';
import { EditTextModal } from '../ui/edit-modal';
import { log } from '../utils/logger';
import {
    getCanvasView,
    getCurrentCanvasFilePath,
    estimateTextNodeHeight
} from '../utils/canvas-utils';
import { CanvasLike, CanvasNodeLike, CanvasDataLike, ICanvasManager, CanvasViewLike } from './types';

export class CanvasNodeManager {
    private app: App;
    private plugin: Plugin;
    private settings: CanvasMindmapBuildSettings;
    private collapseStateManager: CollapseStateManager;
    private canvasManager: ICanvasManager | null = null;

    private canvasFileService: CanvasFileService;
    private nodeCreationService: NodeCreationService;
    private nodeDeletionService: NodeDeletionService;

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
            const canvasFilePath = this.canvasFileService.getCurrentCanvasFilePath();
            log(`[Node] canvasFilePath=${canvasFilePath || 'null'}`);
            if (!canvasFilePath) return;

            let newHeightValue: number | null = null;

            await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (canvasData) => {
                if (!canvasData.nodes) return false;

                const node = canvasData.nodes.find(n => n.id === nodeId);
                log(`[Node] 查找节点: ${nodeId}, 找到=${node ? 'yes' : 'no'}`);
                if (!node) return false;

                if (!node.type || node.type === 'text') {
                    log(`[Node] 节点类型=text, text长度=${node.text?.length || 0}`);
                    if (node.text) {
                        const isFormula = this.settings.enableFormulaDetection && 
                            node.text.trim().startsWith('$$') && 
                            node.text.trim().endsWith('$$');

                        let newHeight: number;
                        if (isFormula) {
                            newHeight = this.settings.formulaNodeHeight || 80;
                            node.width = this.settings.formulaNodeWidth || 400;
                            log(`[Node] 公式节点, newHeight=${newHeight}`);
                        } else {
                            const canvasView = getCanvasView(this.app);
                            const canvas = canvasView ? (canvasView as CanvasViewLike).canvas : null;
                            let nodeEl: Element | undefined;
                            if (canvas?.nodes && canvas.nodes instanceof Map) {
                                const nodeData = canvas.nodes.get(nodeId);
                                if (nodeData?.nodeEl) {
                                    nodeEl = nodeData.nodeEl;
                                }
                            }
                            const calculatedHeight = this.calculateTextNodeHeight(node.text, nodeEl);
                            const maxHeight = this.settings.textNodeMaxHeight || 800;
                            newHeight = Math.min(calculatedHeight, maxHeight);
                            log(`[Node] 计算高度: calculated=${calculatedHeight}, max=${maxHeight}, newHeight=${newHeight}, currentHeight=${node.height}`);
                        }

                        if (node.height !== newHeight) {
                            log(`[Node] 更新高度: ${node.height} -> ${newHeight}`);
                            node.height = newHeight;
                            newHeightValue = newHeight;
                            return true;
                        } else {
                            log(`[Node] 高度未变化，跳过更新`);
                            newHeightValue = node.height || null;
                            return false;
                        }
                    }
                }
                return false;
            });

            const currentHeight = newHeightValue;
            if (currentHeight !== null) {
                const canvasView = getCanvasView(this.app);
                const canvas = canvasView ? (canvasView as CanvasViewLike).canvas : null;
                if (canvas?.nodes && canvas.nodes instanceof Map) {
                    const nodeData = canvas.nodes.get(nodeId);
                    if (nodeData) {
                        log(`[Node] 同步更新内存节点高度: ${currentHeight}`);
                        nodeData.height = currentHeight;
                        if (nodeData.nodeEl) {
                            nodeData.nodeEl.style.height = `${currentHeight}px`;
                        }
                        const nodeWithRender = nodeData as CanvasNodeLike & { render?: () => void };
                        if (typeof nodeWithRender.render === 'function') {
                            nodeWithRender.render();
                        }
                        if (!nodeData.nodeEl || nodeData.nodeEl.clientHeight === 0) {
                            setTimeout(() => {
                                this.adjustNodeHeightAfterRender(nodeId);
                            }, 500);
                        }
                        if (typeof canvas.requestSave === 'function') {
                            canvas.requestSave();
                        }
                    }
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

            await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (canvasData) => {
                if (!canvasData.nodes) return false;

                const maxHeight = this.settings.textNodeMaxHeight || 800;
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
                            const isFormula = this.settings.enableFormulaDetection && 
                                node.text.trim().startsWith('$$') && 
                                node.text.trim().endsWith('$$');

                            let newHeight: number;
                            if (isFormula) {
                                newHeight = this.settings.formulaNodeHeight || 80;
                                node.width = this.settings.formulaNodeWidth || 400;
                            } else {
                                const nodeData = node.id ? nodeDomMap.get(node.id) : undefined;
                                const nodeEl = nodeData?.nodeEl;
                                const calculatedHeight = this.calculateTextNodeHeight(node.text, nodeEl);
                                newHeight = Math.min(calculatedHeight, maxHeight);
                            }

                            if (node.height !== newHeight) {
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
        const maxHeight = this.settings.textNodeMaxHeight || 800;
        const nodeWidth = this.settings.textNodeWidth || 400;

        if (nodeEl) {
            const measuredHeight = this.measureActualContentHeight(nodeEl, content);
            if (measuredHeight > 0) {
                return Math.min(measuredHeight, maxHeight);
            }
        }

        const computedHeight = this.calculateTextNodeHeightComputed(content, nodeWidth);
        return computedHeight;
    }

    private measureActualContentHeight(nodeEl: Element, content: string): number {
        try {
            const contentEl = nodeEl.querySelector('.canvas-node-content') as HTMLElement;
            const sizerEl = nodeEl.querySelector('.markdown-preview-sizer') as HTMLElement;

            if (sizerEl) {
                const sizerMinHeightStyle = sizerEl.style.minHeight;
                if (sizerMinHeightStyle) {
                    const parsedMinHeight = parseFloat(sizerMinHeightStyle);
                    if (!isNaN(parsedMinHeight) && parsedMinHeight > 0) {
                        return Math.ceil(parsedMinHeight + 24);
                    }
                }
            }

            if (contentEl) {
                const pElement = contentEl.querySelector('p');
                if (pElement) {
                    const pRect = pElement.getBoundingClientRect();
                    const pStyles = window.getComputedStyle(pElement);
                    const lineHeight = parseFloat(pStyles.lineHeight) || 24;
                    
                    const actualLines = Math.max(1, Math.round(pRect.height / lineHeight));
                    
                    const styles = window.getComputedStyle(contentEl);
                    const paddingTop = parseFloat(styles.paddingTop) || 8;
                    const paddingBottom = parseFloat(styles.paddingBottom) || 8;

                    return Math.ceil(actualLines * lineHeight + paddingTop + paddingBottom + 20);
                }
            }

            if (sizerEl) {
                const scrollHeight = sizerEl.scrollHeight;
                if (scrollHeight > 20) {
                    return Math.ceil(scrollHeight + 24);
                }

                const rect = sizerEl.getBoundingClientRect();
                if (rect.height > 0) {
                    return Math.ceil(rect.height + 24);
                }
            }

            if (contentEl) {
                const styles = window.getComputedStyle(contentEl);
                const paddingTop = parseFloat(styles.paddingTop) || 8;
                const paddingBottom = parseFloat(styles.paddingBottom) || 8;
                const scrollHeight = contentEl.scrollHeight;
                if (scrollHeight > 20) {
                    return Math.ceil(scrollHeight + paddingTop + paddingBottom);
                }
            }

            const nodeWidth = nodeEl.clientWidth || 400;
            return this.calculateTextNodeHeightComputed(content, nodeWidth);
        } catch (e) {
            log(`[Node] 测量高度异常: ${e}`);
        }
        return 0;
    }

    private calculateTextNodeHeightComputed(content: string, nodeWidth: number): number {
        const maxHeight = this.settings.textNodeMaxHeight || 800;
        return estimateTextNodeHeight(content, nodeWidth, maxHeight);
    }
}
