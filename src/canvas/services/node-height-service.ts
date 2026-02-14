
import { App, ItemView } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../../settings/types';
import { CanvasNodeLike, CanvasLike, CanvasViewLike } from '../types';
import { CanvasFileService } from './canvas-file-service';
import { log } from '../../utils/logger';
import { CONSTANTS } from '../../constants';
import { estimateTextNodeHeight, getCanvasView } from '../../utils/canvas-utils';

export class NodeHeightService {
    private app: App;
    private settings: CanvasMindmapBuildSettings;
    private canvasFileService: CanvasFileService;

    constructor(
        app: App,
        settings: CanvasMindmapBuildSettings,
        canvasFileService: CanvasFileService
    ) {
        this.app = app;
        this.settings = settings;
        this.canvasFileService = canvasFileService;
    }

    /**
     * 计算文本节点高度
     * @param content 节点内容
     * @param nodeEl 可选的 DOM 元素
     * @returns 计算后的高度
     */
    calculateTextNodeHeight(content: string, nodeEl?: Element): number {
        const maxHeight = this.settings.textNodeMaxHeight || 800;
        const nodeWidth = this.settings.textNodeWidth || 400;

        if (nodeEl) {
            const measuredHeight = this.measureActualContentHeight(nodeEl, content);
            if (measuredHeight > 0) {
                return Math.min(measuredHeight, maxHeight);
            }
        }

        return this.calculateTextNodeHeightComputed(content, nodeWidth);
    }

    /**
     * 测量 DOM 元素的实际内容高度
     */
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
            log(`[NodeHeight] 测量高度异常: ${e}`);
        }
        return 0;
    }

    /**
     * 估算文本节点高度（不依赖 DOM）
     */
    private calculateTextNodeHeightComputed(content: string, nodeWidth: number): number {
        const maxHeight = this.settings.textNodeMaxHeight || 800;
        return estimateTextNodeHeight(content, nodeWidth, maxHeight);
    }

    /**
     * 调整单个节点高度
     * @param nodeId 节点 ID
     * @returns 是否成功调整
     */
    async adjustNodeHeight(nodeId: string): Promise<number | null> {
        log(`[NodeHeight] adjustNodeHeight 被调用, nodeId=${nodeId}`);
        try {
            const canvasFilePath = this.canvasFileService.getCurrentCanvasFilePath();
            log(`[NodeHeight] canvasFilePath=${canvasFilePath || 'null'}`);
            if (!canvasFilePath) return null;

            let newHeightValue: number | null = null;

            await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (canvasData) => {
                if (!canvasData.nodes) return false;

                const node = canvasData.nodes.find(n => n.id === nodeId);
                log(`[NodeHeight] 查找节点: ${nodeId}, 找到=${node ? 'yes' : 'no'}`);
                if (!node) return false;

                if (!node.type || node.type === 'text') {
                    log(`[NodeHeight] 节点类型=text, text长度=${node.text?.length || 0}`);
                    if (node.text) {
                        const isFormula = this.settings.enableFormulaDetection && 
                            node.text.trim().startsWith('$$') && 
                            node.text.trim().endsWith('$$');

                        let newHeight: number;
                        if (isFormula) {
                            newHeight = this.settings.formulaNodeHeight || 80;
                            node.width = this.settings.formulaNodeWidth || 400;
                            log(`[NodeHeight] 公式节点, newHeight=${newHeight}`);
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
                            const currentHeight = node.height ?? 0;
                            const delta = newHeight - currentHeight;
                            if (newHeight >= maxHeight || Math.abs(delta) > 80) {
                                log(`[NodeHeight] 高度异常: id=${node.id || 'unknown'}, calculated=${calculatedHeight}, max=${maxHeight}, newHeight=${newHeight}, currentHeight=${currentHeight}, delta=${delta.toFixed(1)}, textLen=${node.text.length}`);
                            } else {
                                log(`[NodeHeight] 计算高度: id=${node.id || 'unknown'}, calculated=${calculatedHeight}, max=${maxHeight}, newHeight=${newHeight}, currentHeight=${currentHeight}`);
                            }
                        }

                        if (node.height !== newHeight) {
                            log(`[NodeHeight] 更新高度: ${node.height} -> ${newHeight}`);
                            node.height = newHeight;
                            newHeightValue = newHeight;
                            return true;
                        } else {
                            log(`[NodeHeight] 高度未变化，跳过更新`);
                            newHeightValue = node.height || null;
                            return false;
                        }
                    }
                }
                return false;
            });

            return newHeightValue;
        } catch (err) {
            log(`[NodeHeight] 调整高度失败: ${nodeId}`, err);
            return null;
        }
    }

    /**
     * 同步更新内存节点高度
     */
    syncMemoryNodeHeight(nodeId: string, newHeight: number): void {
        const canvasView = getCanvasView(this.app);
        const canvas = canvasView ? (canvasView as CanvasViewLike).canvas : null;
        if (canvas?.nodes && canvas.nodes instanceof Map) {
            const nodeData = canvas.nodes.get(nodeId);
            if (nodeData) {
                log(`[NodeHeight] 同步更新内存节点高度: ${newHeight}`);
                nodeData.height = newHeight;
                if (nodeData.nodeEl) {
                    nodeData.nodeEl.style.height = `${newHeight}px`;
                }
                const nodeWithRender = nodeData as CanvasNodeLike & { render?: () => void };
                if (typeof nodeWithRender.render === 'function') {
                    nodeWithRender.render();
                }
                if (typeof canvas.requestSave === 'function') {
                    canvas.requestSave();
                }
            }
        }
    }

    /**
     * 获取 Canvas 节点元素
     */
    getCanvasNodeElement(nodeId: string): CanvasNodeLike | undefined {
        const canvasView = getCanvasView(this.app);
        const canvas = canvasView ? (canvasView as CanvasViewLike).canvas : null;
        if (canvas?.nodes && canvas.nodes instanceof Map) {
            return canvas.nodes.get(nodeId);
        }
        return undefined;
    }
}

