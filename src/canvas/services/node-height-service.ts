import { App, ItemView, Component, MarkdownRenderer } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../../settings/types';
import { CanvasNodeLike, CanvasLike, CanvasViewLike } from '../types';
import { CanvasFileService } from './canvas-file-service';
import { log } from '../../utils/logger';
import { estimateTextNodeHeight, getCanvasView } from '../../utils/canvas-utils';

export class NodeHeightService {
    private app: App;
    private settings: CanvasMindmapBuildSettings;
    private canvasFileService: CanvasFileService;
    private measurementContainerEl: HTMLElement | null = null;
    private measurementSizerEl: HTMLElement | null = null;
    private measurementComponent: Component | null = null;

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
     * @param nodeWidthOverride 可选的节点宽度
     * @returns 计算后的高度
     */
    calculateTextNodeHeight(content: string, nodeEl?: Element, nodeWidthOverride?: number): number {
        const maxHeight = this.settings.textNodeMaxHeight || 800;
        const fallbackWidth = typeof nodeWidthOverride === 'number' && nodeWidthOverride > 0
            ? nodeWidthOverride
            : (this.settings.textNodeWidth || 400);
        const estimatedHeight = this.calculateTextNodeHeightComputed(content, fallbackWidth);

        if (nodeEl && this.isZeroSizedNode(nodeEl, true)) {
            log(`[NodeHeight] calculateTextNodeHeight: nodeEl存在但zero-sized, 使用estimated=${estimatedHeight}`);
            return estimatedHeight;
        }

        if (nodeEl) {
            const measuredHeight = this.measureActualContentHeight(nodeEl, content, fallbackWidth, true);
            if (measuredHeight > 0) {
                // [修复] 直接使用DOM测量值，不做reconcile
                const final = Math.min(measuredHeight, maxHeight);
                log(`[NodeHeight] calculateTextNodeHeight: estimated=${estimatedHeight}, measured=${measuredHeight}, final=${final}`);
                return final;
            }
        }

        log(`[NodeHeight] calculateTextNodeHeight: 无DOM测量, 使用estimated=${estimatedHeight}`);
        return estimatedHeight;
    }

    async calculateTextNodeHeightAsync(content: string, nodeEl?: Element, nodeWidthOverride?: number): Promise<number> {
        const info = await this.calculateTextNodeHeightInfoAsync(content, nodeEl, nodeWidthOverride);
        return info.height;
    }

    async calculateTextNodeHeightInfoAsync(
        content: string,
        nodeEl?: Element,
        nodeWidthOverride?: number,
        logDetail: boolean = false,
        fileHeight?: number
    ): Promise<{ height: number; source: 'dom' | 'rendered' | 'estimate' | 'zero-dom' | 'file-trusted'; estimated: number }> {
        const maxHeight = this.settings.textNodeMaxHeight || 800;
        const fallbackWidth = typeof nodeWidthOverride === 'number' && nodeWidthOverride > 0
            ? nodeWidthOverride
            : (this.settings.textNodeWidth || 400);
        const estimatedHeight = this.calculateTextNodeHeightComputed(content, fallbackWidth);

        if (!nodeEl) {
            return { height: estimatedHeight, source: 'estimate', estimated: estimatedHeight };
        }

        // [关键修复] 提前判断虚拟化状态
        const isVirtualized = this.isZeroSizedNode(nodeEl, false);
        
        // [路径1] 虚拟化节点：优先使用历史数据验证策略
        if (isVirtualized && fileHeight && fileHeight > 0) {
            const ratio = Math.abs(fileHeight - estimatedHeight) / estimatedHeight;
            
            // 差异小于50%，直接信任历史数据，跳过DOM测量
            // [方案B] 提高阈值以减少频繁重测量和振荡
            if (ratio < 0.5) {
                const final = Math.min(fileHeight, maxHeight);
                if (logDetail) {
                    log(`[NodeHeight] 虚拟化节点信任历史: est=${estimatedHeight}, file=${fileHeight}, ratio=${(ratio*100).toFixed(1)}%, final=${final}`);
                }
                return { height: final, source: 'file-trusted', estimated: estimatedHeight };
            }
            
            // 差异较大（50%+），记录并继续验证
            if (logDetail) {
                log(`[NodeHeight] 虚拟化节点差异大，需验证: est=${estimatedHeight}, file=${fileHeight}, ratio=${(ratio*100).toFixed(1)}%`);
            }
        }
        
        // [路径2] 非虚拟化节点 或 历史不可信：尝试DOM测量
        const measuredHeight = this.measureActualContentHeight(nodeEl, content, fallbackWidth, false);
        if (measuredHeight > 0) {
            const final = Math.min(measuredHeight, maxHeight);
            const source = isVirtualized ? 'rendered' : 'dom';
            return { height: final, source, estimated: estimatedHeight };
        }

        // [路径3] DOM测量失败，尝试离屏渲染
        if (isVirtualized) {
            const renderedHeight = await this.measureRenderedMarkdownHeight(content, fallbackWidth, nodeEl, false);
            if (renderedHeight > 0) {
                const final = Math.min(renderedHeight, maxHeight);
                return { height: final, source: 'rendered', estimated: estimatedHeight };
            }
            
            // 离屏渲染也失败，如果有历史数据就用历史（总比估算好）
            if (fileHeight && fileHeight > 0) {
                const final = Math.min(fileHeight, maxHeight);
                if (logDetail) {
                    log(`[NodeHeight] 离屏渲染失败，回退历史: file=${fileHeight}, final=${final}`);
                }
                return { height: final, source: 'file-trusted', estimated: estimatedHeight };
            }
            
            // 最后fallback：估算
            return { height: estimatedHeight, source: 'zero-dom', estimated: estimatedHeight };
        }

        // [路径4] 非虚拟化节点，DOM测量失败，尝试离屏渲染
        const renderedHeight = await this.measureRenderedMarkdownHeight(content, fallbackWidth, nodeEl, false);
        if (renderedHeight > 0) {
            const final = Math.min(renderedHeight, maxHeight);
            return { height: final, source: 'rendered', estimated: estimatedHeight };
        }

        return { height: estimatedHeight, source: 'estimate', estimated: estimatedHeight };
    }

    /**
     * 测量 DOM 元素的实际内容高度
     *
     * [修复] 直接使用sizer.scrollHeight - 它已经是完整的内容高度（包含所有内部padding）
     */
    private measureActualContentHeight(nodeEl: Element, content: string, fallbackWidth: number, logDetail: boolean = false): number {
        try {
            const contentEl = nodeEl.querySelector('.canvas-node-content') as HTMLElement;
            const sizerEl = nodeEl.querySelector('.markdown-preview-sizer') as HTMLElement;

            if (sizerEl) {
                // [修复] 同时读取 minHeight 和 scrollHeight，取较大值
                // 原因：minHeight 是"最小高度"，当内容很长时实际需要的 scrollHeight 会更大
                // 这样可以确保长内容不会被截断
                let minH = 0;
                if (sizerEl.style.minHeight) {
                    const parsed = parseFloat(sizerEl.style.minHeight);
                    if (parsed > 0 && Number.isFinite(parsed)) {
                        minH = parsed;
                    }
                }

                const scrollH = sizerEl.scrollHeight;
                const sizerRect = sizerEl.getBoundingClientRect();
                
                // 取三者的最大值：minHeight, scrollHeight, rect.height
                const maxMeasured = Math.max(minH, scrollH, sizerRect.height);
                
                if (maxMeasured > 20) {
                    const result = Math.ceil(maxMeasured + 16);
                    if (logDetail && (minH > 0 || scrollH > 20)) {
                        log(`[NodeHeight] measure: minH=${minH.toFixed(1)}, scrollH=${scrollH}, rectH=${sizerRect.height.toFixed(1)}, final=${result}`);
                    }
                    return result;
                }
            }

            // ===【路径2】contentEl.scrollHeight===
            if (contentEl) {
                const scrollH = contentEl.scrollHeight;
                if (scrollH > 20) {
                    return Math.ceil(scrollH);
                }
            }

            // ===【路径3-FALLBACK】如果DOM测量全部失败，使用估算===
            const nodeWidth = (nodeEl as HTMLElement).clientWidth;
            if (nodeWidth && nodeWidth > 0) {
                return this.calculateTextNodeHeightComputed(content, nodeWidth);
            }
            if (fallbackWidth > 0) {
                return this.calculateTextNodeHeightComputed(content, fallbackWidth);
            }

        } catch (e) {
            // Silent fail
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
     * 协调测量值与估算值
     *
     * 核心原则：
     * - 如果 measured < lowerRatio * estimated → 可疑，返回 estimated
     * - 如果 measured > upperRatio * estimated → 容器被撑大/Canvas minHeight污染，返回 estimated
     * - 否则 → 信任 measured
     *
     * 注意：此函数现在真正使用 lowerRatio 和 upperRatio 参数！
     */
    private reconcileMeasuredHeight(
        measured: number,
        estimated: number,
        lowerRatio: number,
        upperRatio: number,
        logDetail: boolean = false
    ): number {
        if (measured <= 0) {
            return 0;
        }

        if (estimated > 0) {
            const ratio = measured / estimated;

            if (ratio < 0.2) {
                return estimated;
            }
            if (ratio < lowerRatio) {
                return estimated;
            }
            if (ratio > upperRatio) {
                // 测量值比估算大太多：很可能是容器高度/Canvas minHeight污染
                // 返回 estimated 防止高度膨胀
                return estimated;
            }
        }

        return measured;
    }

    private isZeroSizedNode(nodeEl: Element, logDetail: boolean = false): boolean {
        const el = nodeEl as HTMLElement;
        const rectHeight = el.getBoundingClientRect().height;
        const isZero = rectHeight === 0 && el.offsetHeight === 0 && el.clientHeight === 0 && el.scrollHeight === 0;
        return isZero;
    }

    private ensureMeasurementElements(): void {
        if (this.measurementContainerEl && this.measurementSizerEl && this.measurementComponent) return;
        if (!document?.body) return;

        const container = document.createElement('div');
        container.className = 'canvas-node-content markdown-preview-view';
        container.style.position = 'fixed';
        container.style.left = '-10000px';
        container.style.top = '-10000px';
        container.style.visibility = 'hidden';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '-1';
        container.style.boxSizing = 'border-box';

        const sizer = document.createElement('div');
        sizer.className = 'markdown-preview-sizer markdown-preview-section';
        container.appendChild(sizer);
        document.body.appendChild(container);

        this.measurementContainerEl = container;
        this.measurementSizerEl = sizer;
        this.measurementComponent = new Component();
        log(`[NodeHeight] ensureMeasurementElements: 创建离屏测量容器`);
    }

    private applyMeasurementStyles(nodeEl?: Element): void {
        if (!this.measurementContainerEl || !nodeEl) return;
        const contentEl = nodeEl.querySelector('.canvas-node-content') as HTMLElement | null;
        const sourceEl = contentEl || (nodeEl as HTMLElement);
        if (!sourceEl) return;
        const styles = window.getComputedStyle(sourceEl);
        this.measurementContainerEl.style.fontSize = styles.fontSize;
        this.measurementContainerEl.style.lineHeight = styles.lineHeight;
        this.measurementContainerEl.style.fontFamily = styles.fontFamily;
        this.measurementContainerEl.style.fontWeight = styles.fontWeight;
        this.measurementContainerEl.style.fontStyle = styles.fontStyle;
        this.measurementContainerEl.style.letterSpacing = styles.letterSpacing;
        this.measurementContainerEl.style.wordBreak = styles.wordBreak;
        this.measurementContainerEl.style.whiteSpace = styles.whiteSpace;
        this.measurementContainerEl.style.paddingTop = styles.paddingTop;
        this.measurementContainerEl.style.paddingRight = styles.paddingRight;
        this.measurementContainerEl.style.paddingBottom = styles.paddingBottom;
        this.measurementContainerEl.style.paddingLeft = styles.paddingLeft;
    }

    private async measureRenderedMarkdownHeight(
        content: string,
        nodeWidth: number,
        nodeEl?: Element,
        logDetail: boolean = false
    ): Promise<number> {
        try {
            this.ensureMeasurementElements();
            if (!this.measurementContainerEl || !this.measurementSizerEl || !this.measurementComponent) {
                return 0;
            }

            const width = nodeWidth > 0 ? nodeWidth : (this.settings.textNodeWidth || 400);
            this.measurementContainerEl.style.width = `${width}px`;
            this.applyMeasurementStyles(nodeEl);
            this.measurementSizerEl.innerHTML = '';
            await MarkdownRenderer.renderMarkdown(content, this.measurementSizerEl, '', this.measurementComponent);

            const rect = this.measurementSizerEl.getBoundingClientRect();
            const scrollHeight = this.measurementSizerEl.scrollHeight;
            const measuredHeight = Math.max(rect.height, scrollHeight);
            const styles = window.getComputedStyle(this.measurementContainerEl);
            const paddingTop = parseFloat(styles.paddingTop) || 0;
            const paddingBottom = parseFloat(styles.paddingBottom) || 0;
            const result = Math.ceil(measuredHeight + paddingTop + paddingBottom);

            return result;
        } catch (err) {
            return 0;
        }
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
                            
                            // 先估算高度用于对比
                            const nodeWidth = node.width || this.settings.textNodeWidth || 400;
                            const estimatedHeight = this.calculateTextNodeHeightComputed(node.text, nodeWidth);
                            const calculatedHeight = this.calculateTextNodeHeight(node.text, nodeEl, nodeWidth);
                            const maxHeight = this.settings.textNodeMaxHeight || 800;
                            newHeight = Math.min(calculatedHeight, maxHeight);
                            const currentHeight = node.height ?? 0;
                            const delta = newHeight - currentHeight;
                            
                            // 增强日志：显示文本预览、估算vs实测对比
                            const textPreview = node.text.substring(0, 50).replace(/\n/g, '↵');
                            const measureSource = nodeEl ? 'DOM测量' : '估算';
                            
                            log(`[NodeHeight-SUMMARY] ========================================`);
                            log(`[NodeHeight-SUMMARY] 节点ID: ${node.id || 'unknown'}`);
                            log(`[NodeHeight-SUMMARY] 文本预览: "${textPreview}..." (总长度=${node.text.length})`);
                            log(`[NodeHeight-SUMMARY] 节点宽度: ${nodeWidth}`);
                            log(`[NodeHeight-SUMMARY] 估算高度: ${estimatedHeight}`);
                            log(`[NodeHeight-SUMMARY] ${measureSource}高度: ${calculatedHeight}`);
                            log(`[NodeHeight-SUMMARY] 文件中高度: ${currentHeight}`);
                            log(`[NodeHeight-SUMMARY] 最终高度: ${newHeight}`);
                            log(`[NodeHeight-SUMMARY] 变化量: ${delta.toFixed(1)} (${delta > 0 ? '+' : ''}${((delta/currentHeight)*100).toFixed(1)}%)`);
                            
                            if (Math.abs(delta) > 80) {
                                log(`[NodeHeight-SUMMARY] ⚠️ 高度变化过大！可能存在问题`);
                            }
                            if (newHeight >= maxHeight) {
                                log(`[NodeHeight-SUMMARY] ⚠️ 达到最大高度限制 ${maxHeight}`);
                            }
                            log(`[NodeHeight-SUMMARY] ========================================`);
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
