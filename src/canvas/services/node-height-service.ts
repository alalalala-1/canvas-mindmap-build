import { App, Component, MarkdownRenderer } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../../settings/types';
import { CanvasNodeLike, CanvasViewLike, HeightMeta } from '../types';
import { CanvasFileService } from './canvas-file-service';
import { log } from '../../utils/logger';
import { estimateTextNodeHeight, getCanvasView } from '../../utils/canvas-utils';
import { generateTextSignature } from '../../utils/height-utils';
import { CONSTANTS } from '../../constants';

export class NodeHeightService {
    private static readonly RENDERED_CACHE_MAX_SIZE = 200;
    // [修复] Epoch版本号：更改此值会使所有旧的trusted缓存失效，强制重新测量
    // Epoch 3: 修复rendered缓存绕过偏差校验 + settings引用断裂
    private static readonly CURRENT_EPOCH = 3;
    private static readonly DOM_SHRINK_GUARD_PX = 12;
    private static readonly DOM_MAX_SHRINK_PER_MEASURE_PX = 24;
    private static readonly DOM_COMFORT_PADDING_MIN_PX = 20;
    private static readonly DOM_MINH_CLAMP_DELTA_PX = 28;
    private static readonly TRUST_REVALIDATE_DELTA_PX = 18;

    private app: App;
    private settings: CanvasMindmapBuildSettings;
    private canvasFileService: CanvasFileService;
    private measurementContainerEl: HTMLElement | null = null;
    private measurementSizerEl: HTMLElement | null = null;
    private measurementComponent: Component | null = null;
    private renderedHeightCache = new Map<string, number>();

    public getRenderEnvHash(nodeEl?: Element): string {
        try {
            const target = (nodeEl instanceof HTMLElement)
                ? nodeEl
                : (document?.body || null);
            if (!target) return 'env:unknown';

            const computed = window.getComputedStyle(target);
            const fontSize = computed.fontSize || 'na';
            const lineHeight = computed.lineHeight || 'na';
            const fontFamily = computed.fontFamily || 'na';
            const dpr = Number(window.devicePixelRatio || 1).toFixed(2);
            const zoom = Number((window.visualViewport?.scale ?? 1)).toFixed(3);

            return `fs=${fontSize}|lh=${lineHeight}|ff=${fontFamily}|dpr=${dpr}|zoom=${zoom}`;
        } catch {
            return 'env:error';
        }
    }

    private inferTrustedInvalidReason(
        heightMeta: HeightMeta | undefined,
        signature: string,
        width: number,
        envHash: string
    ): string | null {
        if (!heightMeta?.trustedHeight) return null;
        if (heightMeta.trustedEpoch !== NodeHeightService.CURRENT_EPOCH) return 'trusted-epoch-mismatch';
        if (heightMeta.trustedSignature !== signature) return 'trusted-signature-mismatch';
        if (typeof heightMeta.trustedWidth === 'number' && Math.abs(heightMeta.trustedWidth - width) >= 1) {
            return 'trusted-width-mismatch';
        }
        if (heightMeta.trustedEnvHash && heightMeta.trustedEnvHash !== envHash) return 'trusted-env-mismatch';
        if (heightMeta.trustState === 'stale') return 'trusted-marked-stale';
        if (heightMeta.trustState === 'suspect') return 'trusted-marked-suspect';
        return null;
    }

    private parsePx(value: string): number | null {
        if (!value || value === 'auto') return null;
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    private calculateChromeFromComputed(
        nodeComputed: CSSStyleDeclaration,
        contentComputed: CSSStyleDeclaration | null
    ): number {
        try {
            const contentPaddingTop = contentComputed ? parseFloat(contentComputed.paddingTop) || 0 : 0;
            const contentPaddingBottom = contentComputed ? parseFloat(contentComputed.paddingBottom) || 0 : 0;
            const borderTop = parseFloat(nodeComputed.borderTopWidth) || 0;
            const borderBottom = parseFloat(nodeComputed.borderBottomWidth) || 0;
            const chrome = Math.ceil(contentPaddingTop + contentPaddingBottom + borderTop + borderBottom);
            return chrome > 0 ? chrome : 16;
        } catch {
            return 16;
        }
    }

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
    calculateTextNodeHeight(content: string, nodeEl?: Element, nodeWidthOverride?: number, nodeId?: string): number {
        const maxHeight = this.settings.textNodeMaxHeight || 800;
        let minNodeHeight = CONSTANTS.TYPOGRAPHY.MIN_NODE_HEIGHT; // 60px 底线保护

        // [标题节点增强] 标题渲染有更大的行高和字号，需要更多呼吸空间
        const trimmedContent = content.trimStart();
        if (trimmedContent.startsWith('#')) {
            minNodeHeight = Math.max(minNodeHeight, CONSTANTS.TYPOGRAPHY.MIN_HEADING_NODE_HEIGHT);
        }

        const fallbackWidth = typeof nodeWidthOverride === 'number' && nodeWidthOverride > 0
            ? nodeWidthOverride
            : (this.settings.textNodeWidth || 400);
        const estimatedHeight = this.calculateTextNodeHeightComputed(content, fallbackWidth);

        if (nodeEl && this.isZeroSizedNode(nodeEl, true)) {
            // [修复] 确保不低于最小高度
            const final = Math.max(estimatedHeight, minNodeHeight);
            log(`[NodeHeight] calculateTextNodeHeight: zero-sized, estimated=${estimatedHeight}, final=${final} (min=${minNodeHeight})`);
            return final;
        }

        if (nodeEl) {
            const measuredHeight = this.measureActualContentHeight(nodeEl, content, fallbackWidth, true, nodeId);
            if (measuredHeight > 0) {
                // [修复] 直接使用DOM测量值，不做reconcile
                // [底线保护] 确保不低于 MIN_NODE_HEIGHT
                const final = Math.max(Math.min(measuredHeight, maxHeight), minNodeHeight);
                log(`[NodeHeight] calculateTextNodeHeight: id=${nodeId || 'unknown'}, measured=${measuredHeight}, final=${final} (min=${minNodeHeight}, max=${maxHeight})`);
                return final;
            }
        }

        // [修复] 确保估算值也不低于最小高度
        const final = Math.max(estimatedHeight, minNodeHeight);
        log(`[NodeHeight] calculateTextNodeHeight: no-dom, estimated=${estimatedHeight}, final=${final} (min=${minNodeHeight})`);
        return final;
    }

    async calculateTextNodeHeightAsync(content: string, nodeEl?: Element, nodeWidthOverride?: number, nodeId?: string): Promise<number> {
        const info = await this.calculateTextNodeHeightInfoAsync(content, nodeEl, nodeWidthOverride, false, undefined, nodeId);
        return info.height;
    }

    async calculateTextNodeHeightInfoAsync(
        content: string,
        nodeEl?: Element,
        nodeWidthOverride?: number,
        logDetail: boolean = false,
        heightMeta?: HeightMeta,
        nodeId?: string
    ): Promise<{
        height: number;
        source: 'dom' | 'rendered' | 'estimate' | 'zero-dom' | 'trusted-history';
        estimated: number;
        shouldSaveTrusted?: boolean;
        renderEnvHash?: string;
        markTrustedStaleReason?: string;
    }> {
        const maxHeight = this.settings.textNodeMaxHeight || 800;
        let minNodeHeight = CONSTANTS.TYPOGRAPHY.MIN_NODE_HEIGHT; // 60px 底线保护

        // [标题节点增强] 标题渲染有更大的行高和字号，需要更多呼吸空间
        const trimmedContent = content.trimStart();
        if (trimmedContent.startsWith('#')) {
            minNodeHeight = Math.max(minNodeHeight, CONSTANTS.TYPOGRAPHY.MIN_HEADING_NODE_HEIGHT);
        }

        const fallbackWidth = typeof nodeWidthOverride === 'number' && nodeWidthOverride > 0
            ? nodeWidthOverride
            : (this.settings.textNodeWidth || 400);
        const estimatedHeight = this.calculateTextNodeHeightComputed(content, fallbackWidth);

        // 生成当前内容签名
        const currentSignature = generateTextSignature(content, fallbackWidth);
        const envHash = this.getRenderEnvHash(nodeEl);
        const trustedInvalidReason = this.inferTrustedInvalidReason(heightMeta, currentSignature, fallbackWidth, envHash);
        const trustedUsable = !!heightMeta?.trustedHeight && !trustedInvalidReason;

        // [修复] 确保估算值不低于最小高度
        const clampedEstimate = Math.max(estimatedHeight, minNodeHeight);

        const resolveEstimateFallback = (reason: string): { height: number; source: 'estimate' | 'zero-dom'; estimated: number } => {
            return {
                height: clampedEstimate,
                source: reason === 'virtualized' ? 'zero-dom' : 'estimate',
                estimated: estimatedHeight
            };
        };

        if (!nodeEl) {
            if (trustedUsable && heightMeta?.trustedHeight) {
                // [底线保护] trusted 值也需要检查最小高度
                const final = Math.max(Math.min(heightMeta.trustedHeight, maxHeight), minNodeHeight);
                return {
                    height: final,
                    source: 'trusted-history',
                    estimated: estimatedHeight,
                    renderEnvHash: envHash
                };
            }
            return resolveEstimateFallback('no-dom');
        }

        // [关键修复] 提前判断虚拟化状态
        const isVirtualized = this.isZeroSizedNode(nodeEl, false);

        // [路径1] 非虚拟化节点 或 历史不可信：尝试DOM测量
        const measuredHeight = this.measureActualContentHeight(nodeEl, content, fallbackWidth, false, nodeId);
        if (measuredHeight > 0) {
            let finalMeasured = measuredHeight;
            const source = isVirtualized ? 'rendered' : 'dom';
            
            // [修复v4] 移除虚拟化节点的1.3x截断：
            // 虚拟化节点的DOM"测量"值 = Canvas引擎基于文件高度设定的minHeight回声值
            // 这个回声值通常就是上次正确保存的高度，不应该被截断到estimate
            // 真正不可靠的情况（高度=0或极小）已经由 measuredHeight > 0 过滤
            
            // [底线保护] 确保不低于 MIN_NODE_HEIGHT
            const final = Math.max(Math.min(finalMeasured, maxHeight), minNodeHeight);
            
            // [渐进式策略] 非虚拟化节点的DOM测量是高可信的，标记应该保存
            const shouldSaveTrusted = !isVirtualized;

            if (!isVirtualized && heightMeta?.trustedHeight) {
                const trustedDelta = Math.abs(heightMeta.trustedHeight - final);
                if (trustedDelta > NodeHeightService.TRUST_REVALIDATE_DELTA_PX && logDetail) {
                    log(
                        `[NodeHeight] trusted-revalidate: id=${nodeId || 'unknown'}, trusted=${heightMeta.trustedHeight}, ` +
                        `dom=${final}, delta=${trustedDelta.toFixed(1)}, action=dom-override`
                    );
                }
            }
            
            if (logDetail && shouldSaveTrusted) {
                log(`[NodeHeight] dom-trusted: id=${nodeId || 'unknown'}, measured=${measuredHeight}, final=${final} (min=${minNodeHeight})`);
            }
            
            return {
                height: final,
                source,
                estimated: estimatedHeight,
                shouldSaveTrusted,
                renderEnvHash: envHash,
                markTrustedStaleReason: trustedInvalidReason || undefined
            };
        }

        // [路径1.1] DOM失败时，非虚拟化节点可回退 trusted-history
        if (!isVirtualized && trustedUsable && heightMeta?.trustedHeight) {
            // [底线保护] trusted 值也需要检查最小高度
            const final = Math.max(Math.min(heightMeta.trustedHeight, maxHeight), minNodeHeight);
            return {
                height: final,
                source: 'trusted-history',
                estimated: estimatedHeight,
                renderEnvHash: envHash
            };
        }

        // [路径2] DOM测量失败，尝试离屏渲染
        if (isVirtualized) {
            if (trustedUsable && heightMeta?.trustedHeight) {
                // [底线保护]
                const final = Math.max(Math.min(heightMeta.trustedHeight, maxHeight), minNodeHeight);
                return {
                    height: final,
                    source: 'trusted-history',
                    estimated: estimatedHeight,
                    renderEnvHash: envHash
                };
            }

            const cached = this.getRenderedHeightCache(currentSignature);
            if (cached > 0) {
                // [修复v4] 移除1.3x截断：rendered/离屏渲染比estimate更可靠，直接使用
                // [底线保护] 确保不低于 MIN_NODE_HEIGHT
                const final = Math.max(Math.min(cached, maxHeight), minNodeHeight);
                return {
                    height: final,
                    source: 'rendered',
                    estimated: estimatedHeight,
                    markTrustedStaleReason: trustedInvalidReason || undefined
                };
            }

            const renderedHeight = await this.measureRenderedMarkdownHeight(content, fallbackWidth, nodeEl, false);
            if (renderedHeight > 0) {
                // [修复v4] 移除1.3x截断：MarkdownRenderer实际渲染高度比纯文本估算准确
                // [底线保护] 确保不低于 MIN_NODE_HEIGHT
                this.setRenderedHeightCache(currentSignature, renderedHeight);
                const final = Math.max(Math.min(renderedHeight, maxHeight), minNodeHeight);
                return {
                    height: final,
                    source: 'rendered',
                    estimated: estimatedHeight,
                    markTrustedStaleReason: trustedInvalidReason || undefined
                };
            }

            // 离屏渲染失败：统一回退到 estimate
            return resolveEstimateFallback('virtualized');
        }

        // [路径3] 非虚拟化节点，DOM测量失败，尝试离屏渲染
        const cached = this.getRenderedHeightCache(currentSignature);
        if (cached > 0) {
            // [修复v4] 移除1.3x截断：rendered/离屏渲染比estimate更可靠，直接使用
            // [底线保护] 确保不低于 MIN_NODE_HEIGHT
            const final = Math.max(Math.min(cached, maxHeight), minNodeHeight);
            return {
                height: final,
                source: 'rendered',
                estimated: estimatedHeight,
                markTrustedStaleReason: trustedInvalidReason || undefined
            };
        }

        const renderedHeight = await this.measureRenderedMarkdownHeight(content, fallbackWidth, nodeEl, false);
        if (renderedHeight > 0) {
            // [修复v4] 移除1.3x截断：MarkdownRenderer实际渲染高度比纯文本估算准确
            // [底线保护] 确保不低于 MIN_NODE_HEIGHT
            this.setRenderedHeightCache(currentSignature, renderedHeight);
            const final = Math.max(Math.min(renderedHeight, maxHeight), minNodeHeight);
            return {
                height: final,
                source: 'rendered',
                estimated: estimatedHeight,
                markTrustedStaleReason: trustedInvalidReason || undefined
            };
        }

        // [底线保护] 最终返回也确保不低于最小高度
        return {
            height: clampedEstimate,
            source: 'estimate',
            estimated: estimatedHeight,
            markTrustedStaleReason: trustedInvalidReason || undefined
        };
    }

    /**
     * 测量 DOM 元素的实际内容高度
     *
     * [修复] 动态测量chrome（padding/border）+ 下溢保护，替换硬编码+16
     */
    private measureActualContentHeight(
        nodeEl: Element,
        content: string,
        fallbackWidth: number,
        logDetail: boolean = false,
        nodeId?: string
    ): number {
        try {
            const contentEl = nodeEl.querySelector('.canvas-node-content') as HTMLElement;
            const sizerEl = nodeEl.querySelector('.markdown-preview-sizer') as HTMLElement;

            const nodeElHtml = nodeEl as HTMLElement;
            const nodeOffsetH = nodeElHtml.offsetHeight;
            const nodeRectH = nodeOffsetH > 0 ? nodeOffsetH : nodeElHtml.getBoundingClientRect().height;
            const nodeBestH = Math.max(nodeOffsetH, nodeRectH);

            const nodeComputed = window.getComputedStyle(nodeElHtml);
            const contentComputed = contentEl ? window.getComputedStyle(contentEl) : null;
            const computedTopPx = this.parsePx(nodeComputed.top);
            const computedPos = nodeComputed.position || 'unknown';
            const styleAnomalous = computedPos !== 'absolute'
                || (computedTopPx !== null && Math.abs(computedTopPx) > 0.1);
            const dynamicChrome = this.calculateChromeFromComputed(nodeComputed, contentComputed);

            if (sizerEl) {
                let minH = 0;
                if (sizerEl.style.minHeight) {
                    const parsed = parseFloat(sizerEl.style.minHeight);
                    if (parsed > 0 && Number.isFinite(parsed)) {
                        minH = parsed;
                    }
                }

                const scrollH = sizerEl.scrollHeight;
                const sizerRectH = sizerEl.offsetHeight;
                const comfortPadding = Math.max(
                    NodeHeightService.DOM_COMFORT_PADDING_MIN_PX,
                    Math.round(dynamicChrome * 0.5)
                );

                const nodeCandidate = nodeBestH > 20 ? Math.ceil(nodeBestH) : 0;
                const minCandidate = minH > 20 ? Math.ceil(minH + dynamicChrome) : 0;
                let contentCandidateRaw = Math.max(scrollH, sizerRectH);
                // [收敛修复] 仅在样式异常且 scroll 明显虚高时才允许用 minH 限幅。
                // 避免正常场景下把真实内容需求压回 minH 导致轻微截断。
                if (
                    styleAnomalous
                    && minH > 20
                    && contentCandidateRaw > minH + NodeHeightService.DOM_MINH_CLAMP_DELTA_PX
                ) {
                    contentCandidateRaw = minH;
                }
                const contentCandidate = contentCandidateRaw > 20 ? Math.ceil(contentCandidateRaw + dynamicChrome) : 0;
                const contentComfortCandidate = contentCandidate > 0
                    ? Math.ceil(contentCandidate + comfortPadding)
                    : 0;

                let result = 0;
                let source = 'none';
                const decisionTags: string[] = [];

                const hasNode = nodeCandidate > 0;
                const hasContent = contentCandidate > 0;
                const hasMin = minCandidate > 0;
                const bestContent = hasContent
                    ? (hasMin ? Math.max(contentCandidate, minCandidate) : contentCandidate)
                    : (hasMin ? minCandidate : 0);
                
                // [修复] 优先使用实际内容测量（contentCandidate），nodeCandidate只作为fallback
                // nodeCandidate 是数据文件的回声值，不可靠；contentCandidate 是真实DOM测量
                
                // 下溢保护：nodeCandidate明显不足时
                const underflowRisk = hasNode && bestContent > 0 && (nodeCandidate < bestContent - 10);
                
                // 统一决策路径（content优先）：
                if (hasContent) {
                    let preferred = Math.max(bestContent, contentComfortCandidate);
                    source = 'content';
                    decisionTags.push('prefer-content-comfort');

                    const lineHeightSource = contentComputed?.lineHeight || nodeComputed.lineHeight;
                    const lh = parseFloat(lineHeightSource || '0');
                    if (Number.isFinite(lh) && lh > 0) {
                        const lineHeightComfortFloor = Math.ceil(bestContent + lh * 0.8);
                        if (lineHeightComfortFloor > preferred) {
                            preferred = lineHeightComfortFloor;
                            decisionTags.push('line-height-comfort-floor');
                        }
                    }

                    if (hasNode && preferred < nodeCandidate) {
                        const shrinkDelta = nodeCandidate - preferred;
                        if (styleAnomalous) {
                            preferred = nodeCandidate;
                            decisionTags.push('style-anomaly-avoid-shrink');
                        } else if (shrinkDelta <= NodeHeightService.DOM_SHRINK_GUARD_PX) {
                            preferred = nodeCandidate;
                            decisionTags.push('shrink-guard-small-delta');
                        } else {
                            const bounded = Math.max(
                                preferred,
                                nodeCandidate - NodeHeightService.DOM_MAX_SHRINK_PER_MEASURE_PX
                            );
                            if (bounded !== preferred) {
                                decisionTags.push(`shrink-cap-${NodeHeightService.DOM_MAX_SHRINK_PER_MEASURE_PX}`);
                            }
                            preferred = bounded;
                        }
                    }

                    result = preferred;
                } else if (hasMin) {
                    result = minCandidate;
                    source = 'min';
                    decisionTags.push('fallback-min');
                } else if (hasNode) {
                    result = nodeCandidate;
                    source = styleAnomalous ? 'node(pos-anomaly-ignored)' : 'node(fallback)';
                    decisionTags.push('fallback-node-no-content');
                }
                
                if (result > 20) {
                    if (logDetail) {
                        log(
                            `[NodeHeight] measure: id=${nodeId || 'unknown'}, minH=${minH.toFixed(1)}, scrollH=${scrollH}, rectH=${sizerRectH.toFixed(1)}, ` +
                            `nodeOffsetH=${nodeOffsetH}, nodeRectH=${nodeRectH.toFixed(1)}, pos=${computedPos}, top=${nodeComputed.top}, ` +
                            `chrome=${dynamicChrome}, candidates(node/min/content)=${nodeCandidate}/${minCandidate}/${contentCandidate}, ` +
                            `comfort=${comfortPadding}, styleAnomaly=${styleAnomalous}, underflowRisk=${underflowRisk}, source=${source}, ` +
                            `decision=${decisionTags.join('+') || 'none'}, final=${result}`
                        );
                    }
                    return result;
                }

                // fallback：nodeEl 高度不可用时，用 sizer.minHeight + 动态chrome
                if (minH > 20) {
                    const result = Math.ceil(minH + dynamicChrome);
                    if (logDetail) {
                        log(`[NodeHeight] measure: nodeEl不可用，minH优先=${minH.toFixed(1)}, scrollH=${scrollH}, rectH=${sizerRectH.toFixed(1)}, chrome=${dynamicChrome}, final=${result}`);
                    }
                    return result;
                }
                
                // fallback2：minH 不可用时，用 scrollH 或 rectHeight + 动态chrome
                const maxMeasured = Math.max(scrollH, sizerRectH);
                
                if (maxMeasured > 20) {
                    const result = Math.ceil(maxMeasured + dynamicChrome);
                    if (logDetail && (scrollH > 20 || sizerRectH > 20)) {
                        log(`[NodeHeight] measure: minH无数据, scrollH=${scrollH}, rectH=${sizerRectH.toFixed(1)}, chrome=${dynamicChrome}, final=${result}`);
                    }
                    return result;
                }
            }

            // 即使无 sizerEl，也可以用 nodeEl 高度
            if (nodeBestH > 20) {
                return Math.ceil(nodeBestH);
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

        } catch {
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

    private isZeroSizedNode(nodeEl: Element, logDetail: boolean = false): boolean {
        const el = nodeEl as HTMLElement;
        const offsetHeight = el.offsetHeight;
        const clientHeight = el.clientHeight;
        const scrollHeight = el.scrollHeight;

        // 常见非零路径提前返回，避免额外 rect 测量
        if (offsetHeight > 0 || clientHeight > 0 || scrollHeight > 0) {
            return false;
        }

        const rectHeight = el.getBoundingClientRect().height;
        const isZero = rectHeight === 0;
        if (logDetail && !isZero) {
            log(`[NodeHeight] zero-check: rect=${rectHeight.toFixed(1)}, offset=${offsetHeight}, client=${clientHeight}, scroll=${scrollHeight}`);
        }
        return isZero;
    }

    private ensureMeasurementElements(): void {
        if (this.measurementContainerEl && this.measurementSizerEl && this.measurementComponent) return;
        if (!document?.body) return;

        const container = document.createElement('div');
        container.className = 'canvas-node-content markdown-preview-view';
        container.setCssProps({
            position: 'fixed',
            left: '-10000px',
            top: '-10000px',
            visibility: 'hidden',
            'pointer-events': 'none',
            'z-index': '-1',
            'box-sizing': 'border-box'
        });

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
        const contentEl = nodeEl.querySelector('.canvas-node-content');
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

    /**
     * 离屏渲染 Markdown 内容并测量高度
     *
     * [Fix C] 修复离屏渲染系统性偏低问题：
     * 实测数据显示，离屏渲染高度普遍比 Canvas DOM 实测低 2-16px。
     * 根因：
     * 1. 离屏容器无 canvas-node 的 border（chrome ~4px）
     * 2. 离屏容器缺少 DOM 测量时应用的 comfort padding（12px）
     * 3. 细微字体/CSS 环境差异（~2-4px）
     * 补偿策略：
     * - 添加 RENDERED_COMFORT_PX = 16px 固定补偿（包含 chrome 4px + comfort 12px）
     * - 额外 8% 缓冲应对不同内容/字体的细微差异
     * - 最终结果 + min(rawH*0.08, 20) 作为动态上限
     */
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
            await MarkdownRenderer.render(this.app, content, this.measurementSizerEl, '', this.measurementComponent);

            const rect = this.measurementSizerEl.getBoundingClientRect();
            const scrollHeight = this.measurementSizerEl.scrollHeight;
            const measuredHeight = Math.max(rect.height, scrollHeight);
            const styles = window.getComputedStyle(this.measurementContainerEl);
            const paddingTop = parseFloat(styles.paddingTop) || 0;
            const paddingBottom = parseFloat(styles.paddingBottom) || 0;
            const result = Math.ceil(measuredHeight + paddingTop + paddingBottom);

            return result;
        } catch {
            return 0;
        }
    }

    private getRenderedHeightCache(signature: string): number {
        return this.renderedHeightCache.get(signature) ?? 0;
    }

    private setRenderedHeightCache(signature: string, height: number): void {
        this.renderedHeightCache.set(signature, height);
        if (this.renderedHeightCache.size <= NodeHeightService.RENDERED_CACHE_MAX_SIZE) {
            return;
        }

        const oldestEntry = this.renderedHeightCache.keys().next();
        if (!oldestEntry.done) {
            this.renderedHeightCache.delete(oldestEntry.value);
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
                            const calculatedHeight = this.calculateTextNodeHeight(node.text, nodeEl, nodeWidth, node.id || nodeId);
                            const maxHeight = this.settings.textNodeMaxHeight || 800;
                            newHeight = Math.min(calculatedHeight, maxHeight);
                            const currentHeight = node.height ?? 0;
                            const delta = newHeight - currentHeight;
                            
                            const measureSource = nodeEl ? 'dom' : 'estimate';
                            if (Math.abs(delta) > 80) {
                                log(`[NodeHeight] large-delta: id=${node.id || 'unknown'}, src=${measureSource}, est=${estimatedHeight}, calc=${calculatedHeight}, file=${currentHeight}, final=${newHeight}, delta=${delta.toFixed(1)}`);
                            }
                            if (newHeight >= maxHeight) {
                                log(`[NodeHeight] max-cap: id=${node.id || 'unknown'}, final=${newHeight}, cap=${maxHeight}`);
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
