import { App } from 'obsidian';
import { CanvasFileService } from './canvas-file-service';
import { VisibilityService } from './visibility-service';
import { log } from '../../utils/logger';
import { CONSTANTS } from '../../constants';
import { estimateTextNodeHeight, getCurrentCanvasFilePath, getNodeIdFromEdgeEndpoint, isImageContent, isFormulaContent, isRecord, reloadCanvas } from '../../utils/canvas-utils';
import {
    CanvasDataLike,
    CanvasEdgeLike,
    CanvasLike,
    CanvasNodeLike,
    LayoutData
} from '../types';

/**
 * 布局数据提供者 - 负责为布局引擎准备所需的所有数据
 * 统一了从内存和文件中获取数据的逻辑
 */
export class LayoutDataProvider {
    private app: App;
    private canvasFileService: CanvasFileService;
    private visibilityService: VisibilityService;

    constructor(app: App, canvasFileService: CanvasFileService, visibilityService: VisibilityService) {
        this.app = app;
        this.canvasFileService = canvasFileService;
        this.visibilityService = visibilityService;
    }

    /**
     * 获取布局所需的所有数据
     */
    async getLayoutData(canvas: unknown): Promise<LayoutData | null> {
        if (!isRecord(canvas)) return null;
        const canvasLike = canvas as CanvasLike;

        const allNodes = this.getCanvasNodes(canvasLike);
        const edges = this.getCanvasEdges(canvasLike);

        if (!allNodes || allNodes.size === 0) return null;

        let edgeMissingFrom = 0;
        let edgeMissingTo = 0;
        let edgeMissingFromNode = 0;
        let edgeMissingToNode = 0;
        const edgeSample: Array<{ id?: string; fromId?: string | null; toId?: string | null }> = [];
        for (const edge of edges) {
            const fromId = getNodeIdFromEdgeEndpoint(edge.from);
            const toId = getNodeIdFromEdgeEndpoint(edge.to);
            if (!fromId) edgeMissingFrom++;
            if (!toId) edgeMissingTo++;
            if (fromId && !allNodes.has(fromId)) edgeMissingFromNode++;
            if (toId && !allNodes.has(toId)) edgeMissingToNode++;
            if (edgeSample.length < 5 && ( !fromId || !toId || (fromId && !allNodes.has(fromId)) || (toId && !allNodes.has(toId)) )) {
                edgeSample.push({ id: edge.id, fromId, toId });
            }
        }
        if (edgeMissingFrom || edgeMissingTo || edgeMissingFromNode || edgeMissingToNode) {
            log(`[LayoutData] 边端点异常: total=${edges.length}, missingFrom=${edgeMissingFrom}, missingTo=${edgeMissingTo}, missingFromNode=${edgeMissingFromNode}, missingToNode=${edgeMissingToNode}, sample=${edgeSample.map(s => `${s.id || 'unknown'}:${s.fromId || 'null'}->${s.toId || 'null'}`).join('|')}`);
        }

        const visibleNodeIds = this.visibilityService.getVisibleNodeIds(allNodes, edges);
        if (visibleNodeIds.size === 0) return null;

        // 过滤可见边：只保留两个端点都可见的边
        const visibleEdges = edges.filter((edge) => {
            const fromId = getNodeIdFromEdgeEndpoint(edge.from);
            const toId = getNodeIdFromEdgeEndpoint(edge.to);
            return fromId && toId && visibleNodeIds.has(fromId) && visibleNodeIds.has(toId);
        });

        let originalEdges = edges;
        let fileNodes = new Map<string, CanvasNodeLike>();
        let floatingNodes = new Set<string>();
        let canvasData: CanvasDataLike | null = null;
        const canvasFilePath = canvasLike.file?.path || getCurrentCanvasFilePath(this.app);

        if (canvasFilePath) {
            try {
                canvasData = await this.canvasFileService.readCanvasData(canvasFilePath);
                if (canvasData) {
                    const nodesList = this.canvasFileService.getNodes(canvasData);
                    if (Array.isArray(nodesList)) {
                        for (const node of nodesList) {
                            if (node?.id) fileNodes.set(node.id, node);
                        }
                    }
                    originalEdges = this.canvasFileService.getEdges(canvasData);
                    floatingNodes = this.getValidatedFloatingNodes(canvasData, allNodes, originalEdges, edges);
                }
            } catch (e) {
                log('[LayoutData] 错误: 读取文件', e);
            }
        }

        const getCanvasScale = (nodeEl: HTMLElement): number => {
            const wrapper = nodeEl.closest('.canvas-wrapper') || nodeEl.closest('.canvas');
            if (!wrapper) return 1;
            const transform = window.getComputedStyle(wrapper).transform;
            if (!transform || transform === 'none') return 1;
            const matrix = new DOMMatrix(transform);
            const scaleX = Math.abs(matrix.a);
            const scaleY = Math.abs(matrix.d);
            if (!Number.isFinite(scaleX) || scaleX <= 0) return 1;
            if (Number.isFinite(scaleY) && scaleY > 0) return Math.max(scaleX, scaleY);
            return scaleX;
        };

        const reconcileTextHeight = (dataHeight: number, estimatedHeight: number) => {
            // [修复-方案B] 激进策略：优先使用估算值，只在极端情况下才使用旧数据
            // 目的：彻底清理历史脏数据，重新建立准确的高度基线
            if (estimatedHeight <= 0 && dataHeight > 0) {
                // 无法估算但有历史数据，暂时接受
                return { height: dataHeight, source: 'data', ratio: null, override: false };
            }
            if (estimatedHeight <= 0) {
                return { height: 0, source: 'none', ratio: null, override: false };
            }
            
            // 核心策略：默认使用估算值
            let height = estimatedHeight;
            let source = 'estimate';
            let ratio: number | null = null;
            let override = false;
            
            if (dataHeight > 0) {
                ratio = dataHeight / estimatedHeight;
                // 非常宽松的范围 [0.50, 2.00]，只过滤极端异常值
                // 大部分情况下都使用估算值，除非文件值在合理范围内
                if (ratio >= 0.50 && ratio <= 2.00) {
                    // 即使在合理范围内，也优先用估算值（方案B激进策略）
                    // 只有当文件值非常接近估算值时才使用
                    if (ratio >= 0.90 && ratio <= 1.10) {
                        height = dataHeight;
                        source = 'data';
                    } else {
                        override = true;
                    }
                } else {
                    // 极端异常，必须覆盖
                    override = true;
                    if (ratio < 0.50 || ratio > 2.00) {
                        log(`[LayoutData] reconcile覆盖异常值: dataH=${dataHeight.toFixed(0)}, estH=${estimatedHeight.toFixed(0)}, ratio=${ratio.toFixed(2)}`);
                    }
                }
            }
            return { height, source, ratio, override };
        };

        let measurePass = 0;
        const measureVisibleNodes = () => {
            measurePass += 1;
            const logDetail = measurePass === 1;
            const visibleNodes = new Map<string, CanvasNodeLike>();
            let domHeightAppliedCount = 0;
            let domHeightMissingElCount = 0;
            let domHeightHiddenCount = 0;
            let domHeightZeroCount = 0;
            let domHeightDiffCount = 0;
            let domHeightDiffSum = 0;
            let domHeightDiffMaxAbs = 0;
            let domHeightZeroEstimatedCount = 0;
            let domHeightZeroEstimatedAppliedCount = 0;
            let domHeightZeroEstimatedSameCount = 0;
            let domHeightZeroResolvedByEstimateCount = 0;
            let domHeightZeroResolvedByDataCount = 0;
            let domHeightZeroOverrideCount = 0;
            let domHeightMissingResolvedByEstimateCount = 0;
            let domHeightMissingResolvedByDataCount = 0;
            let domHeightMissingOverrideCount = 0;
            let dataHeightFromFileCount = 0;
            let dataHeightFromMemoryCount = 0;
            let dataHeightMissingCount = 0;
            let domElementCount = 0;
            const domHeightDiffSamples: Array<{ id: string; domHeight: number; dataHeight: number; rect: number; client: number; scroll: number; offset: number }> = [];
            const domHeightZeroSamples: Array<{ id: string; dataHeight: number; rect: number; client: number; scroll: number; offset: number }> = [];
            const domHeightZeroEstimatedSamples: Array<{ id: string; dataHeight: number; estimatedHeight: number; width: number }> = [];
            const domHeightZeroDetailSamples: Array<{ id: string; type: string; x: number; y: number; width: number; height: number; textLength: number }> = [];
            const domHeightZeroReconcileSamples: Array<{ id: string; dataHeight: number; estimatedHeight: number; finalHeight: number; ratio: number | null; source: string }> = [];
            const domHeightMissingReconcileSamples: Array<{ id: string; dataHeight: number; estimatedHeight: number; finalHeight: number; ratio: number | null; source: string }> = [];
            const domHeightHiddenSamples: string[] = [];
            const domHeightMissingSamples: string[] = [];
            const heightSamples: Array<{ id: string; height: number }> = [];

            allNodes.forEach((node, id) => {
                if (visibleNodeIds.has(id)) {
                    const fileNode = fileNodes.get(id);
                    const nodeText = fileNode?.text || node.text;

                    const mergedNode = {
                        ...(fileNode || {}),
                        ...node,
                        text: nodeText
                    };

                    const fileHeightValue = typeof fileNode?.height === 'number' ? fileNode.height : 0;
                    const fileWidthValue = typeof fileNode?.width === 'number' ? fileNode.width : 0;
                    if ((!mergedNode.width || mergedNode.width <= 0) && fileWidthValue > 0) {
                        mergedNode.width = fileWidthValue;
                    }

                    // [修复] 优先使用文件高度：height服务最后更新了文件，内存节点的height可能是stale旧值
                    // 场景：adjustAllTextNodeHeights写入文件但内存节点height字段未同步（或同步被覆盖）
                    const memoryHeightRaw = typeof node?.height === 'number' ? node.height : 0;
                    if (fileHeightValue > 0) {
                        if (Math.abs(fileHeightValue - memoryHeightRaw) > 1) {
                            log(`[LayoutData] 文件高度优先: id=${id}, fileH=${fileHeightValue.toFixed(0)}, memH=${memoryHeightRaw.toFixed(0)}, diff=${(fileHeightValue - memoryHeightRaw).toFixed(0)}`);
                        }
                        mergedNode.height = fileHeightValue;
                    }

                    // [修复] 计数器：基于实际使用的高度来源（优先文件 > 内存 > 无）
                    // 注意：fileHeightValue > 0 时已通过上方代码将 mergedNode.height 设为文件值
                    if (fileHeightValue > 0) dataHeightFromFileCount++;
                    else if (memoryHeightRaw > 0) dataHeightFromMemoryCount++;
                    else dataHeightMissingCount++;

                    const dataHeight = typeof mergedNode.height === 'number' ? mergedNode.height : 0;
                    const nodeEl = node?.nodeEl;
                    if (nodeEl && nodeEl instanceof HTMLElement) {
                        domElementCount++;
                        const display = window.getComputedStyle(nodeEl).display;
                        if (display !== 'none') {
                            const rectHeight = nodeEl.getBoundingClientRect().height;
                            const offsetHeight = nodeEl.offsetHeight;
                            const clientHeight = nodeEl.clientHeight;
                            let scale = getCanvasScale(nodeEl);
                            const localScale = rectHeight > 0 && offsetHeight > 0 ? rectHeight / offsetHeight : 0;
                            if (scale === 1 && localScale > 0 && Math.abs(localScale - 1) > 0.05) {
                                scale = localScale;
                            }
                            let domHeight = 0;
                            if (rectHeight > 0 && scale > 0) {
                                domHeight = rectHeight / scale;
                            }
                            if (domHeight <= 0 && offsetHeight > 0) {
                                domHeight = offsetHeight;
                            }
                            if (domHeight <= 0 && clientHeight > 0) {
                                domHeight = clientHeight;
                            }

                            // === 诊断：DOM可见节点的详细测量信息（包括sizer.minHeight）===
                            const sizerElDiag = nodeEl.querySelector('.markdown-preview-sizer') as HTMLElement | null;
                            const sizerMinHDiag = sizerElDiag?.style?.minHeight || 'none';
                            const sizerScrollHDiag = sizerElDiag?.scrollHeight || 0;
                            const contentElDiag = nodeEl.querySelector('.canvas-node-content') as HTMLElement | null;
                            const pElDiag = contentElDiag?.querySelector('p') as HTMLElement | null;
                            const pScrollHDiag = pElDiag?.scrollHeight || 0;
                            const pClientHDiag = pElDiag?.clientHeight || 0;
                            if (logDetail) {
                                log(`[LayoutData.perNode] id=${id} fileH=${fileHeightValue} memH=${dataHeight} rectH=${rectHeight.toFixed(1)} offsetH=${offsetHeight} clientH=${clientHeight} scale=${scale.toFixed(3)} domH=${domHeight.toFixed(1)} sizer.minH=${sizerMinHDiag} sizer.scrollH=${sizerScrollHDiag} p.scrollH=${pScrollHDiag} p.clientH=${pClientHDiag}`);
                            }

                            if (domHeight && domHeight > 0) {
                                const diff = domHeight - dataHeight;
                                if (Math.abs(diff) > CONSTANTS.LAYOUT.HEIGHT_TOLERANCE) {
                                    // [修复] DOM高度 vs 文件高度冲突时，需要reconcile而不是盲目用DOM
                                    // 场景：adjustAllTextNodeHeights刚写94到文件，Canvas DOM还未重渲染（仍显示65）
                                    // → domHeight=65 < fileHeight=94 → DOM是stale旧值，应优先信任文件
                                    // 规则：
                                    //   1. 如果 fileHeight>0 且 domHeight < fileHeight → DOM是stale，用fileHeight
                                    //   2. 如果 fileHeight>0 且 domHeight > fileHeight → DOM更大（内容实际变大了），用domHeight
                                    //   3. 如果 estimatedHeight>0 → 三方比较，用最接近estimated的值
                                    let resolvedHeight = domHeight;
                                    const nodeTextContent = mergedNode.text || '';
                                    const nodeWidthForEst = typeof mergedNode.width === 'number' && mergedNode.width > 0
                                        ? mergedNode.width : CONSTANTS.LAYOUT.TEXT_NODE_WIDTH;
                                    const maxH = CONSTANTS.LAYOUT.TEXT_NODE_MAX_HEIGHT;
                                    const nodeType = mergedNode.type;
                                    const isTextNodeForReconcile = !nodeType || nodeType === 'text';
                                    
                                    if (fileHeightValue > 0 && domHeight < fileHeightValue) {
                                        // DOM比文件小，优先用文件高度（DOM可能是stale）
                                        if (isTextNodeForReconcile && nodeTextContent) {
                                            const estimatedH = estimateTextNodeHeight(nodeTextContent, nodeWidthForEst, maxH);
                                            if (estimatedH > 0) {
                                                // 三方reconcile：估算为参考，哪个更接近就用哪个
                                                const diffToEst_dom = Math.abs(domHeight - estimatedH);
                                                const diffToEst_file = Math.abs(fileHeightValue - estimatedH);
                                                if (diffToEst_dom < diffToEst_file && domHeight >= estimatedH * 0.85) {
                                                    // DOM更接近估算且不偏低 → 用DOM
                                                    resolvedHeight = domHeight;
                                                    if (logDetail) {
                                                        log(`[LayoutData] DOM<FILE三方reconcile→DOM: id=${id}, dom=${domHeight.toFixed(1)}, file=${fileHeightValue.toFixed(1)}, est=${estimatedH.toFixed(1)}, diffDom=${diffToEst_dom.toFixed(1)}, diffFile=${diffToEst_file.toFixed(1)}`);
                                                    }
                                                } else {
                                                    // 文件更接近估算 → 用fileHeight（dom是stale）
                                                    resolvedHeight = fileHeightValue;
                                                    if (logDetail) {
                                                        log(`[LayoutData] DOM<FILE三方reconcile→FILE: id=${id}, dom=${domHeight.toFixed(1)}, file=${fileHeightValue.toFixed(1)}, est=${estimatedH.toFixed(1)}, diffDom=${diffToEst_dom.toFixed(1)}, diffFile=${diffToEst_file.toFixed(1)}`);
                                                    }
                                                }
                                            } else {
                                                // 估算无效 → 用fileHeight
                                                resolvedHeight = fileHeightValue;
                                                if (logDetail) {
                                                    log(`[LayoutData] DOM<FILE→FILE(无估算): id=${id}, dom=${domHeight.toFixed(1)}, file=${fileHeightValue.toFixed(1)}`);
                                                }
                                            }
                                        } else {
                                            // 非文本节点 → 用fileHeight
                                            resolvedHeight = fileHeightValue;
                                            if (logDetail) {
                                                log(`[LayoutData] DOM<FILE→FILE(非文本): id=${id}, dom=${domHeight.toFixed(1)}, file=${fileHeightValue.toFixed(1)}`);
                                            }
                                        }
                                    } else if (fileHeightValue > 0 && domHeight > fileHeightValue) {
                                        // DOM比文件大 → 内容撑大了，用domHeight（更准确）
                                        resolvedHeight = domHeight;
                                        if (logDetail) {
                                            log(`[LayoutData] DOM>FILE→DOM: id=${id}, dom=${domHeight.toFixed(1)}, file=${fileHeightValue.toFixed(1)}`);
                                        }
                                    }
                                    // else: fileHeight=0 → 用domHeight（原逻辑）
                                    
                                    if (resolvedHeight !== dataHeight) {
                                        mergedNode.height = resolvedHeight;
                                        domHeightAppliedCount++;
                                        domHeightDiffCount++;
                                        domHeightDiffSum += Math.abs(resolvedHeight - dataHeight);
                                        if (Math.abs(resolvedHeight - dataHeight) > domHeightDiffMaxAbs) domHeightDiffMaxAbs = Math.abs(resolvedHeight - dataHeight);
                                        if (domHeightDiffSamples.length < 5) {
                                            domHeightDiffSamples.push({
                                                id,
                                                domHeight: resolvedHeight,
                                                dataHeight,
                                                rect: rectHeight,
                                                client: nodeEl.clientHeight,
                                                scroll: nodeEl.scrollHeight,
                                                offset: nodeEl.offsetHeight
                                            });
                                        }
                                        if (domHeightDiffSamples.length < 5) {
                                            if (logDetail) {
                                                log(`[LayoutData] DOM高度偏差详情: id=${id}, fileH=${fileHeightValue.toFixed(1)}, memH=${dataHeight.toFixed(1)}, domH=${domHeight.toFixed(1)}, resolvedH=${resolvedHeight.toFixed(1)}, rect=${rectHeight.toFixed(1)}, client=${clientHeight}, scroll=${nodeEl.scrollHeight}, offset=${offsetHeight}, scale=${scale.toFixed(3)}, localScale=${localScale ? localScale.toFixed(3) : 'n/a'}, w=${typeof mergedNode.width === 'number' ? mergedNode.width : 0}, len=${typeof mergedNode.text === 'string' ? mergedNode.text.length : 0}`);
                                            }
                                        }
                                    } else {
                                        if (logDetail) {
                                            log(`[LayoutData] DOM高度偏差reconcile后相同, 跳过: id=${id}, domH=${domHeight.toFixed(1)}, dataH=${dataHeight.toFixed(1)}, resolvedH=${resolvedHeight.toFixed(1)}`);
                                        }
                                    }
                                } // end if (domHeight && domHeight > 0)
                            } else {
                                domHeightZeroCount++;
                                if (domHeightZeroSamples.length < 5) {
                                    domHeightZeroSamples.push({
                                        id,
                                        dataHeight,
                                        rect: rectHeight,
                                        client: nodeEl.clientHeight,
                                        scroll: nodeEl.scrollHeight,
                                        offset: nodeEl.offsetHeight
                                    });
                                }
                                if (domHeightZeroDetailSamples.length < 10) {
                                    const type = mergedNode.type || 'text';
                                    const textLength = typeof mergedNode.text === 'string' ? mergedNode.text.length : 0;
                                    domHeightZeroDetailSamples.push({
                                        id,
                                        type,
                                        x: typeof mergedNode.x === 'number' ? mergedNode.x : 0,
                                        y: typeof mergedNode.y === 'number' ? mergedNode.y : 0,
                                        width: typeof mergedNode.width === 'number' ? mergedNode.width : 0,
                                        height: typeof mergedNode.height === 'number' ? mergedNode.height : 0,
                                        textLength
                                    });
                                }
                                const nodeType = mergedNode.type;
                                const isTextNode = !nodeType || nodeType === 'text';
                                if (isTextNode) {
                                    const content = mergedNode.text || '';
                                    const width = typeof mergedNode.width === 'number' && mergedNode.width > 0
                                        ? mergedNode.width
                                        : CONSTANTS.LAYOUT.TEXT_NODE_WIDTH;
                                    const maxHeight = CONSTANTS.LAYOUT.TEXT_NODE_MAX_HEIGHT;
                                    let estimatedHeight = estimateTextNodeHeight(content, width, maxHeight);
                                    if (isFormulaContent(content)) {
                                        estimatedHeight = CONSTANTS.LAYOUT.FORMULA_NODE_HEIGHT;
                                    } else if (isImageContent(content)) {
                                        estimatedHeight = CONSTANTS.LAYOUT.IMAGE_NODE_HEIGHT;
                                    }
                                    if (estimatedHeight > 0) {
                                        domHeightZeroEstimatedCount++;
                                        const candidateHeight = dataHeight > 0 ? dataHeight : fileHeightValue;
                                        const reconcile = reconcileTextHeight(candidateHeight, estimatedHeight);
                                        if (reconcile.height > 0) {
                                            if (reconcile.height !== dataHeight) {
                                                mergedNode.height = reconcile.height;
                                            }
                                            if (reconcile.source === 'data') {
                                                domHeightZeroEstimatedSameCount++;
                                                domHeightZeroResolvedByDataCount++;
                                            } else {
                                                domHeightZeroEstimatedAppliedCount++;
                                                domHeightZeroResolvedByEstimateCount++;
                                            }
                                            if (reconcile.override) domHeightZeroOverrideCount++;
                                            if (domHeightZeroEstimatedSamples.length < 5) {
                                                domHeightZeroEstimatedSamples.push({
                                                    id,
                                                    dataHeight: candidateHeight,
                                                    estimatedHeight,
                                                    width
                                                });
                                            }
                                            if (domHeightZeroReconcileSamples.length < 5) {
                                                domHeightZeroReconcileSamples.push({
                                                    id,
                                                    dataHeight: candidateHeight,
                                                    estimatedHeight,
                                                    finalHeight: reconcile.height,
                                                    ratio: reconcile.ratio,
                                                    source: reconcile.source
                                                });
                                            }
                                            if (domHeightZeroEstimatedSamples.length < 5) {
                                                const ratioText = reconcile.ratio === null ? 'n/a' : reconcile.ratio.toFixed(2);
                                                if (logDetail) {
                                                    log(`[LayoutData] DOM0估算详情: id=${id}, estH=${estimatedHeight.toFixed(1)}, dataH=${candidateHeight.toFixed(1)}, finalH=${reconcile.height.toFixed(1)}, ratio=${ratioText}, src=${reconcile.source}, w=${width}, len=${content.length}`);
                                                }
                                            }
                                        }
                                    }
                                } else if (fileHeightValue > 0) {
                                    mergedNode.height = fileHeightValue;
                                    if (domHeightZeroDetailSamples.length < 10) {
                                        log(`[LayoutData] DOM0使用文件高度: id=${id}, fileH=${fileHeightValue.toFixed(1)}, memH=${dataHeight.toFixed(1)}, w=${typeof mergedNode.width === 'number' ? mergedNode.width : 0}, len=${typeof mergedNode.text === 'string' ? mergedNode.text.length : 0}`);
                                    }
                                }
                            }
                        } else {
                            domHeightHiddenCount++;
                            if (domHeightHiddenSamples.length < 5) domHeightHiddenSamples.push(id);
                        }
                    } else {
                        domHeightMissingElCount++;
                        if (domHeightMissingSamples.length < 5) domHeightMissingSamples.push(id);
                        const nodeType = mergedNode.type;
                        const isTextNode = !nodeType || nodeType === 'text';
                        if (isTextNode) {
                            const content = mergedNode.text || '';
                            const width = typeof mergedNode.width === 'number' && mergedNode.width > 0
                                ? mergedNode.width
                                : CONSTANTS.LAYOUT.TEXT_NODE_WIDTH;
                            const maxHeight = CONSTANTS.LAYOUT.TEXT_NODE_MAX_HEIGHT;
                            let estimatedHeight = estimateTextNodeHeight(content, width, maxHeight);
                            if (isFormulaContent(content)) {
                                estimatedHeight = CONSTANTS.LAYOUT.FORMULA_NODE_HEIGHT;
                            } else if (isImageContent(content)) {
                                estimatedHeight = CONSTANTS.LAYOUT.IMAGE_NODE_HEIGHT;
                            }
                            if (estimatedHeight > 0) {
                                const candidateHeight = dataHeight > 0 ? dataHeight : fileHeightValue;
                                const reconcile = reconcileTextHeight(candidateHeight, estimatedHeight);
                                if (reconcile.height > 0) {
                                    if (reconcile.height !== dataHeight) {
                                        mergedNode.height = reconcile.height;
                                    }
                                    if (reconcile.source === 'data') {
                                        domHeightMissingResolvedByDataCount++;
                                    } else {
                                        domHeightMissingResolvedByEstimateCount++;
                                    }
                                    if (reconcile.override) domHeightMissingOverrideCount++;
                                    if (domHeightMissingReconcileSamples.length < 5) {
                                        domHeightMissingReconcileSamples.push({
                                            id,
                                            dataHeight: candidateHeight,
                                            estimatedHeight,
                                            finalHeight: reconcile.height,
                                            ratio: reconcile.ratio,
                                            source: reconcile.source
                                        });
                                    }
                                    if (domHeightMissingSamples.length < 5) {
                                        const ratioText = reconcile.ratio === null ? 'n/a' : reconcile.ratio.toFixed(2);
                                        log(`[LayoutData] 缺少DOM高度对比: id=${id}, estH=${estimatedHeight.toFixed(1)}, dataH=${candidateHeight.toFixed(1)}, finalH=${reconcile.height.toFixed(1)}, ratio=${ratioText}, src=${reconcile.source}, w=${width}, len=${content.length}`);
                                    }
                                }
                            }
                        } else if (fileHeightValue > 0) {
                            mergedNode.height = fileHeightValue;
                            if (domHeightMissingSamples.length < 5) {
                                log(`[LayoutData] 缺少DOM使用文件高度: id=${id}, fileH=${fileHeightValue.toFixed(1)}, memH=${dataHeight.toFixed(1)}, w=${typeof mergedNode.width === 'number' ? mergedNode.width : 0}, len=${typeof mergedNode.text === 'string' ? mergedNode.text.length : 0}`);
                            }
                        }
                    }

                    visibleNodes.set(id, mergedNode);
                    const finalHeight = typeof mergedNode.height === 'number' ? mergedNode.height : 0;
                    if (heightSamples.length < CONSTANTS.LAYOUT.MAX_HEIGHT_SAMPLES) {
                        heightSamples.push({ id, height: finalHeight });
                    }
                }
            });

            return {
                visibleNodes,
                domHeightAppliedCount,
                domHeightMissingElCount,
                domHeightHiddenCount,
                domHeightZeroCount,
                domHeightDiffCount,
                domHeightDiffSum,
                domHeightDiffMaxAbs,
                dataHeightFromFileCount,
                dataHeightFromMemoryCount,
                dataHeightMissingCount,
                domHeightDiffSamples,
                domHeightZeroSamples,
                domHeightZeroEstimatedSamples,
                domHeightZeroDetailSamples,
                domHeightZeroReconcileSamples,
                domHeightMissingReconcileSamples,
                domHeightHiddenSamples,
                domHeightMissingSamples,
                heightSamples,
                domElementCount,
                domHeightZeroEstimatedAppliedCount,
                domHeightZeroEstimatedCount,
                domHeightZeroEstimatedSameCount,
                domHeightZeroResolvedByEstimateCount,
                domHeightZeroResolvedByDataCount,
                domHeightZeroOverrideCount,
                domHeightMissingResolvedByEstimateCount,
                domHeightMissingResolvedByDataCount,
                domHeightMissingOverrideCount
            };
        };

        // [修复-方案B优化] Canvas使用虚拟化渲染，不在视口的节点DOM为空是正常现象
        // 不需要重试，直接接受现实并使用估算值/文件值
        const measureResult = measureVisibleNodes();
        const visibleCount = measureResult.visibleNodes.size;
        
        if (measureResult.domHeightZeroCount > 0) {
            log(`[LayoutData] DOM零高度节点: ${measureResult.domHeightZeroCount}/${visibleCount} (虚拟化渲染导致，使用估算值/文件值)`);
        }

        const {
            visibleNodes,
            domHeightAppliedCount,
            domHeightMissingElCount,
            domHeightHiddenCount,
            domHeightZeroCount,
            domHeightDiffCount,
            domHeightDiffSum,
            domHeightDiffMaxAbs,
            dataHeightFromFileCount,
            dataHeightFromMemoryCount,
            dataHeightMissingCount,
            domHeightDiffSamples,
            domHeightZeroSamples,
            domHeightZeroEstimatedSamples,
            domHeightZeroDetailSamples,
            domHeightZeroReconcileSamples,
            domHeightMissingReconcileSamples,
            domHeightHiddenSamples,
            domHeightMissingSamples,
            domHeightZeroEstimatedAppliedCount,
            domHeightZeroEstimatedCount,
            domHeightZeroEstimatedSameCount,
            domHeightZeroResolvedByEstimateCount,
            domHeightZeroResolvedByDataCount,
            domHeightZeroOverrideCount,
            domHeightMissingResolvedByEstimateCount,
            domHeightMissingResolvedByDataCount,
            domHeightMissingOverrideCount
        } = measureResult;

        if (visibleCount > 0) {
            const heights = Array.from(visibleNodes.values()).map(n => (typeof n.height === 'number' ? n.height : 0));
            const heightSum = heights.reduce((a, b) => a + b, 0);
            const heightMin = Math.min(...heights);
            const heightMax = Math.max(...heights);
            const zeroHeightCount = heights.filter(h => h <= 0).length;
            const avgHeight = heightSum / heights.length;
            log(`[LayoutData] 高度统计 count=${visibleCount}, min=${heightMin.toFixed(1)}, max=${heightMax.toFixed(1)}, avg=${avgHeight.toFixed(1)}, zero=${zeroHeightCount}, dom覆盖=${domHeightAppliedCount}, 无元素=${domHeightMissingElCount}, 隐藏=${domHeightHiddenCount}, 0高=${domHeightZeroCount}`);
            log(`[LayoutData] 高度来源 file=${dataHeightFromFileCount}, memory=${dataHeightFromMemoryCount}, missing=${dataHeightMissingCount}`);
            if (domHeightDiffCount > 0) {
                const avgDiff = domHeightDiffSum / domHeightDiffCount;
                const sample = domHeightDiffSamples.map(s => `${s.id}:${s.dataHeight}->${s.domHeight} rect=${s.rect.toFixed(1)} client=${s.client} scroll=${s.scroll} offset=${s.offset}`).join('|');
                log(`[LayoutData] DOM高度差异 count=${domHeightDiffCount}, max=${domHeightDiffMaxAbs.toFixed(1)}, avg=${avgDiff.toFixed(1)}, sample=${sample}`);
            }
            if (domHeightZeroCount > 0) {
                const zeroSample = domHeightZeroSamples.map(s => `${s.id}:data=${s.dataHeight} rect=${s.rect.toFixed(1)} client=${s.client} scroll=${s.scroll} offset=${s.offset}`).join('|');
                log(`[LayoutData] DOM高度为0 count=${domHeightZeroCount}, sample=${zeroSample}`);
                if (domHeightZeroDetailSamples.length > 0) {
                    const detailSample = domHeightZeroDetailSamples.map(s => `${s.id}:${s.type} x=${s.x} y=${s.y} w=${s.width} h=${s.height} len=${s.textLength}`).join('|');
                    log(`[LayoutData] DOM高度为0详情 file=${canvasFilePath || 'unknown'}, sample=${detailSample}`);
                }
            }
            if (domHeightZeroEstimatedAppliedCount > 0) {
                const estimatedSample = domHeightZeroEstimatedSamples.map(s => `${s.id}:${s.dataHeight}->${s.estimatedHeight} w=${s.width}`).join('|');
                log(`[LayoutData] DOM0估算修正 applied=${domHeightZeroEstimatedAppliedCount}/${domHeightZeroEstimatedCount}, same=${domHeightZeroEstimatedSameCount}, sample=${estimatedSample}`);
            }
            if (domHeightZeroResolvedByEstimateCount > 0 || domHeightZeroResolvedByDataCount > 0) {
                const reconcileSample = domHeightZeroReconcileSamples.map(s => `${s.id}:${s.dataHeight}->${s.estimatedHeight}=>${s.finalHeight} r=${s.ratio === null ? 'n/a' : s.ratio.toFixed(2)} src=${s.source}`).join('|');
                log(`[LayoutData] DOM0高度对比 est=${domHeightZeroResolvedByEstimateCount}, data=${domHeightZeroResolvedByDataCount}, override=${domHeightZeroOverrideCount}, sample=${reconcileSample}`);
            }
            if (domHeightHiddenCount > 0) {
                log(`[LayoutData] DOM隐藏 sample=${domHeightHiddenSamples.join('|')}`);
            }
            if (domHeightMissingElCount > 0) {
                log(`[LayoutData] DOM缺失 sample=${domHeightMissingSamples.join('|')}`);
            }
            if (domHeightMissingResolvedByEstimateCount > 0 || domHeightMissingResolvedByDataCount > 0) {
                const missingSample = domHeightMissingReconcileSamples.map(s => `${s.id}:${s.dataHeight}->${s.estimatedHeight}=>${s.finalHeight} r=${s.ratio === null ? 'n/a' : s.ratio.toFixed(2)} src=${s.source}`).join('|');
                log(`[LayoutData] DOM缺失高度对比 est=${domHeightMissingResolvedByEstimateCount}, data=${domHeightMissingResolvedByDataCount}, override=${domHeightMissingOverrideCount}, sample=${missingSample}`);
            }
        }

        return {
            visibleNodes,
            allNodes,
            edges: visibleEdges, // 使用过滤后的可见边
            originalEdges,
            canvasData,
            floatingNodes,
            canvasFilePath: canvasFilePath || ''
        };
    }

    private getValidatedFloatingNodes(
        canvasData: CanvasDataLike,
        memoryNodes: Map<string, CanvasNodeLike>,
        originalEdges: CanvasEdgeLike[],
        memoryEdges: CanvasEdgeLike[]
    ): Set<string> {
        const floatingNodes = new Set<string>();
        const floatingInfo = this.canvasFileService.getFloatingNodesInfo(canvasData);
        const floatingNodesToRemove: string[] = [];
        
        for (const nodeId of floatingInfo.floatingNodes) {
            if (!memoryNodes.has(nodeId)) {
                floatingNodesToRemove.push(nodeId);
                continue;
            }

            const hasIncomingEdge = originalEdges.some((edge) => this.getEdgeToNodeId(edge) === nodeId);
            const hasIncomingMemoryEdge = memoryEdges.some((edge) => this.getEdgeToNodeId(edge) === nodeId);

            if (!hasIncomingEdge && !hasIncomingMemoryEdge) {
                floatingNodes.add(nodeId);
            } else {
                // 只有当确定有入边时才记录清理日志
                if (hasIncomingEdge || hasIncomingMemoryEdge) {
                    log(`[LayoutData] 验证发现入边，清理浮动标记: ${nodeId}`);
                }
                floatingNodesToRemove.push(nodeId);
            }
        }

        for (const nodeId of floatingNodesToRemove) {
            if (canvasData?.metadata?.floatingNodes?.[nodeId]) {
                delete canvasData.metadata.floatingNodes[nodeId];
            }
            if (Array.isArray(canvasData?.nodes)) {
                const nodeData = canvasData.nodes.find((n) => n?.id === nodeId);
                if (nodeData?.data?.isFloating) {
                    delete nodeData.data.isFloating;
                    delete nodeData.data.originalParent;
                    delete nodeData.data.floatingTimestamp;
                }
            }
            const memoryNode = memoryNodes.get(nodeId);
            if (memoryNode?.data?.isFloating) {
                delete memoryNode.data.isFloating;
                delete memoryNode.data.originalParent;
                delete memoryNode.data.floatingTimestamp;
            }
        }

        if (floatingNodes.size > 0) {
            log(`[LayoutData] 浮动: ${floatingNodes.size}`);
        }

        return floatingNodes;
    }

    private getEdgeToNodeId(edge: CanvasEdgeLike): string | null {
        const nodeId = getNodeIdFromEdgeEndpoint(edge.to);
        if (nodeId) return nodeId;
        return typeof edge.toNode === 'string' ? edge.toNode : null;
    }

    private getCanvasNodes(canvas: CanvasLike): Map<string, CanvasNodeLike> {
        if (canvas.nodes instanceof Map) {
            return canvas.nodes;
        }
        if (canvas.nodes && isRecord(canvas.nodes)) {
            return new Map(Object.entries(canvas.nodes));
        }
        return new Map();
    }

    private getCanvasEdges(canvas: CanvasLike): CanvasEdgeLike[] {
        if (canvas.edges instanceof Map) {
            return Array.from(canvas.edges.values());
        }
        if (Array.isArray(canvas.edges)) {
            return canvas.edges;
        }
        return [];
    }
}
