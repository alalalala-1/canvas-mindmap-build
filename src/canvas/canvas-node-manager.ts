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
    estimateTextNodeHeight,
    getCanvasView,
    getCurrentCanvasFilePath,
    resolveArrangedTextWidth
} from '../utils/canvas-utils';
import { generateTextSignature } from '../utils/height-utils';
import { CanvasLike, CanvasNodeLike, ICanvasManager, CanvasViewLike, HeightMeta } from './types';

/** 高度调整的统计上下文 */
interface HeightAdjustmentStats {
    adjustedCount: number;
    widthAdjustedCount: number;
    increasedCount: number;
    decreasedCount: number;
    cappedCount: number;
    formulaCount: number;
    maxIncrease: number;
    maxDecrease: number;
    sourceDomCount: number;
    sourceRenderedCount: number;
    sourceEstimateCount: number;
    sourceZeroDomCount: number;
    sourceFileTrustedCount: number;
    sourceSamples: string[];
}

/** 创建空的统计上下文 */
function createEmptyStats(): HeightAdjustmentStats {
    return {
        adjustedCount: 0,
        widthAdjustedCount: 0,
        increasedCount: 0,
        decreasedCount: 0,
        cappedCount: 0,
        formulaCount: 0,
        maxIncrease: 0,
        maxDecrease: 0,
        sourceDomCount: 0,
        sourceRenderedCount: 0,
        sourceEstimateCount: 0,
        sourceZeroDomCount: 0,
        sourceFileTrustedCount: 0,
        sourceSamples: []
    };
}

interface TrustedMeasureCollector {
    total: number;
    success: number;
    updated: number;
    unchanged: number;
    noDom: number;
    virtualized: number;
    nonText: number;
    zeroHeight: number;
    error: number;
    trustedMarkedStale: number;
    trustedMarkedSuspect: number;
    trustedRevalidated: number;
    samples: string[];
}

function createTrustedMeasureCollector(): TrustedMeasureCollector {
    return {
        total: 0,
        success: 0,
        updated: 0,
        unchanged: 0,
        noDom: 0,
        virtualized: 0,
        nonText: 0,
        zeroHeight: 0,
        error: 0,
        trustedMarkedStale: 0,
        trustedMarkedSuspect: 0,
        trustedRevalidated: 0,
        samples: []
    };
}

export class CanvasNodeManager {
    private static readonly SCROLLABLE_NODE_CLASS = 'cmb-node-scrollable';
    private static readonly SCROLLABLE_OWNER_SELECTORS: string[] = [
        '.canvas-node-content',
        '.canvas-node-content .markdown-preview-view',
        '.canvas-node-content .markdown-preview-sizer'
    ];

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

    // 失焦测量统计（用于快速判断 trustedHeight 是否长期无法更新）
    private blurMeasureStats = {
        total: 0,
        success: 0,
        skippedNoDom: 0,
        skippedVirtualized: 0,
        skippedNonText: 0,
        failedZeroHeight: 0,
        skippedNoCanvasPath: 0,
        error: 0
    };

    private readonly perNodeAnomalyLogThresholdPx: number = 20;
    private readonly batchSummarySampleLimit: number = 5;
    private readonly trustedSuspectDeltaPx: number = 20;

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
        this.nodeHeightService = new NodeHeightService(app, settings, canvasFileService);

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

    /**
     * 在 Canvas 加载时进行全量数据健康检查
     * 修复持久化数据中的异常高度（如 DOM 测量错误导致的残留值）
     *
     * [修复v4] 核心原则：
     * 1. trusted 高度是 DOM 实测值，优先级 > estimate
     * 2. 仅修复极端异常（<20px），不再基于 estimate 偏差做大面积修复
     * 3. 如果有有效的 trusted 高度但文件高度偏离，则恢复 trusted 高度
     */
    async validateAndRepairNodeHeights(file: TFile): Promise<void> {
        log(`[Node] 开始健康检查: ${file.path}`);

        try {
            const textDimensions = this.nodeTypeService.getTextDimensions();
            const CURRENT_EPOCH = 3; // 与 NodeHeightService.CURRENT_EPOCH 保持一致

            await this.canvasFileService.modifyCanvasDataAtomic(file.path, (canvasData) => {
                if (!canvasData.nodes) return false;

                let repairedCount = 0;
                let repairedTrustedCount = 0;
                let skippedTrustedCount = 0;
                const repairedSamples: string[] = [];

                for (const node of canvasData.nodes) {
                    // 仅处理文本节点
                    if (node.type !== 'text' || !node.text) continue;

                    // 1. 获取基础参数
                    const width = (typeof node.width === 'number' && node.width > 0)
                        ? node.width
                        : textDimensions.width;

                    // 2. 检查当前持久化高度
                    const currentHeight = node.height ?? 0;

                    // 3. 获取元数据
                    if (!node.data || typeof node.data !== 'object') {
                        node.data = {};
                    }
                    const heightMeta = (node.data as { heightMeta?: HeightMeta }).heightMeta;

                    // 4. 检查 trusted 高度是否有效
                    // trusted 高度来自 DOM 实测，比估算更可靠
                    const hasTrusted = !!heightMeta?.trustedHeight
                        && typeof heightMeta.trustedHeight === 'number'
                        && heightMeta.trustedHeight > 0
                        && heightMeta.trustedEpoch === CURRENT_EPOCH
                        && heightMeta.trustState !== 'stale'
                        && heightMeta.trustState !== 'suspect';

                    if (hasTrusted && heightMeta?.trustedHeight) {
                        // 有有效的 trusted 高度：将文件高度恢复为 trusted 高度（如偏离过大）
                        const trustedHeight = heightMeta.trustedHeight;
                        const delta = Math.abs(currentHeight - trustedHeight);
                        if (delta > 5 && currentHeight < trustedHeight * 0.85) {
                            // 文件高度明显低于 trusted 高度（可能被之前的修复误伤），恢复
                            const prevHeight = currentHeight;
                            node.height = trustedHeight;
                            repairedTrustedCount++;
                            if (repairedSamples.length < 5) {
                                repairedSamples.push(`${node.id}:restore-trusted(${prevHeight}->${trustedHeight})`);
                            }
                        } else {
                            // trusted 高度与文件高度接近，无需修改
                            skippedTrustedCount++;
                        }
                        continue; // 有 trusted 的节点不做 estimate 偏差检查
                    }

                    // 5. 无 trusted 高度的节点：仅修复极端异常（高度极小）
                    // [修复v4] 移除基于 estimate 偏差的修复！
                    // 原因：estimate 系统性低估（偏差可达 50%+），基于 estimate 修复会造成大量误伤
                    // 只有高度明显错误（<20px）时才修复
                    let shouldRepair = false;
                    let repairReason = '';

                    if (currentHeight < 20) {
                        shouldRepair = true;
                        repairReason = 'too_small';
                    }
                    // [已移除] 场景B: 基于 estimate 偏差>20% 的修复
                    // 该逻辑会将 DOM 正确测量的高度（如 300px）误判为异常并替换为低估值（如 184px）
                    // 导致节点高度被永久压缩，无法通过 arrange 自动修复

                    if (shouldRepair) {
                        // 仅修复极端情况时，使用 estimate 作为初始值
                        const estimatedHeight = estimateTextNodeHeight(
                            node.text,
                            width,
                            this.settings.textNodeMaxHeight || 800
                        );
                        node.height = estimatedHeight;

                        const existingMeta = (node.data as { heightMeta?: HeightMeta }).heightMeta || {};
                        existingMeta.lastAutoHeight = estimatedHeight;
                        existingMeta.lastWidth = width;
                        (node.data as { heightMeta?: HeightMeta }).heightMeta = existingMeta;

                        repairedCount++;
                        if (repairedSamples.length < 5) {
                            repairedSamples.push(`${node.id}:${repairReason}`);
                        }
                    }
                }

                const totalRepaired = repairedCount + repairedTrustedCount;
                if (totalRepaired > 0) {
                    log(
                        `[Node] 健康检查完成: 修复=${repairedCount}(extreme), ` +
                        `restored-trusted=${repairedTrustedCount}, skipped-trusted=${skippedTrustedCount}. ` +
                        `Samples: ${repairedSamples.join(', ')}`
                    );
                    if (repairedCount > 0) {
                        new Notice(`已修复 ${repairedCount} 个高度异常节点`);
                    }
                    return true; // 触发保存
                } else {
                    log(`[Node] 健康检查完成: 未发现需要修复的节点, skipped-trusted=${skippedTrustedCount}`);
                    return false;
                }
            });
        } catch (err) {
            log(`[Node] 健康检查失败:`, err);
        }
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

    async adjustAllTextNodeHeights(options?: { skipMountedTextNodes?: boolean; suppressRequestSave?: boolean }): Promise<number> {
        try {
            // ===== 改动2：使用 Obsidian 原生 API 而非直接文件写入 =====
            // 获取 Canvas 内存节点进行操作
            const canvasView = getCanvasView(this.app);
            const canvas = canvasView ? (canvasView as CanvasViewLike).canvas : null;
            if (!canvas?.nodes || !(canvas.nodes instanceof Map)) {
                log(`[Node] 批量调整跳过: 无法获取 Canvas 节点`);
                return 0;
            }

            log(`[Node] 开始批量调整高度 (内存模式)`);

            const stats = createEmptyStats();
            const textDimensions = this.nodeTypeService.getTextDimensions();
            const maxHeight = textDimensions.maxHeight;
            const formulaDimensions = this.nodeTypeService.getFormulaDimensions();

            // 遍历内存中的节点
            let changed = false;
            const logDetail = false;
            let skippedMountedTextNodes = 0;
            let nonDomShrinkBlockedCount = 0;
            let nonDomShrinkBlockedMaxDelta = 0;
            const nonDomShrinkBlockedBySource = new Map<string, number>();
            const nonDomShrinkBlockedSamples: string[] = [];
            let trustedMarkedStaleCount = 0;
            let trustedMarkedSuspectCount = 0;
            let trustedRevalidatedCount = 0;
            const trustedTransitionSamples: string[] = [];

            for (const [nodeId, domNode] of canvas.nodes) {
                const nodeMeta = this.getNodeTextAndType(domNode);
                if (!nodeMeta.isTextLike || !nodeMeta.text) continue;

                if (options?.skipMountedTextNodes && this.isNodeDomMounted(domNode)) {
                    skippedMountedTextNodes++;
                    continue;
                }

                // 计算新高度
                const result = await this.adjustSingleNodeHeightMemory(
                    domNode,
                    nodeMeta.text,
                    textDimensions,
                    maxHeight,
                    formulaDimensions,
                    logDetail
                );

                // 更新统计
                if (result.heightChanged) {
                    stats.adjustedCount++;
                    changed = true;
                }
                if (result.widthChanged) {
                    stats.widthAdjustedCount++;
                    changed = true;
                }
                if (result.isFormula) stats.formulaCount++;
                if (result.delta > 0) {
                    stats.increasedCount++;
                    if (result.delta > stats.maxIncrease) stats.maxIncrease = result.delta;
                } else if (result.delta < 0) {
                    stats.decreasedCount++;
                    if (Math.abs(result.delta) > stats.maxDecrease) stats.maxDecrease = Math.abs(result.delta);
                }
                if (result.newHeight >= maxHeight) stats.cappedCount++;

                // 统计来源
                if (result.source === 'dom') stats.sourceDomCount++;
                else if (result.source === 'rendered') stats.sourceRenderedCount++;
                else if (result.source === 'zero-dom') stats.sourceZeroDomCount++;
                else if (result.source === 'trusted-history') stats.sourceFileTrustedCount++;
                else stats.sourceEstimateCount++;

                // 使用 moveAndResize 更新节点
                if ((result.heightChanged || result.widthChanged) && typeof domNode.moveAndResize === 'function') {
                    domNode.moveAndResize({
                        x: domNode.x ?? 0,
                        y: domNode.y ?? 0,
                        width: result.newWidth,
                        height: result.newHeight
                    });
                }

                if (result.shrinkBlocked) {
                    nonDomShrinkBlockedCount++;
                    const sourceKey = result.shrinkBlockedSource || result.source || 'unknown';
                    nonDomShrinkBlockedBySource.set(sourceKey, (nonDomShrinkBlockedBySource.get(sourceKey) ?? 0) + 1);
                    nonDomShrinkBlockedMaxDelta = Math.max(nonDomShrinkBlockedMaxDelta, result.blockedDelta);
                    if (nonDomShrinkBlockedSamples.length < this.batchSummarySampleLimit) {
                        nonDomShrinkBlockedSamples.push(
                            `${nodeId}:${sourceKey}:${result.blockedCandidateHeight}->${result.blockedFinalHeight}`
                        );
                    }
                }

                if (result.trustedMarkedStale) {
                    trustedMarkedStaleCount++;
                    if (trustedTransitionSamples.length < this.batchSummarySampleLimit) {
                        trustedTransitionSamples.push(`${nodeId}:stale:${result.trustedStateReason || 'unknown'}`);
                    }
                }

                if (result.trustedMarkedSuspect) {
                    trustedMarkedSuspectCount++;
                    if (trustedTransitionSamples.length < this.batchSummarySampleLimit) {
                        trustedTransitionSamples.push(`${nodeId}:suspect:${result.trustedStateReason || 'unknown'}`);
                    }
                }

                if (result.trustedRevalidated) {
                    trustedRevalidatedCount++;
                    if (trustedTransitionSamples.length < this.batchSummarySampleLimit) {
                        trustedTransitionSamples.push(`${nodeId}:valid:${result.trustedStateReason || 'dom-revalidate'}`);
                    }
                }

            }

            // 统一请求保存（由 Obsidian 决定何时写入）
            if (!options?.suppressRequestSave && changed && typeof canvas.requestSave === 'function') {
                canvas.requestSave();
            }

            const scrollabilityUpdated = this.syncScrollableStateForMountedNodes();
            if (scrollabilityUpdated > 0) {
                log(`[Node] ScrollabilitySync: updated=${scrollabilityUpdated}`);
            }

            this.refreshCanvasAfterHeightAdjust(!!options?.suppressRequestSave);
            this.logHeightAdjustStats(stats);
            if (nonDomShrinkBlockedCount > 0) {
                const sourceSummary = Array.from(nonDomShrinkBlockedBySource.entries())
                    .map(([source, count]) => `${source}:${count}`)
                    .join('|');
                log(
                    `[Node] NonDomShrinkBlockedSummary: count=${nonDomShrinkBlockedCount}, ` +
                    `maxBlockedDelta=${nonDomShrinkBlockedMaxDelta.toFixed(1)}, ` +
                    `sources=${sourceSummary || 'none'}, samples=${nonDomShrinkBlockedSamples.join('|') || 'none'}`
                );
            }
            if (options?.skipMountedTextNodes) {
                log(`[Node] HeightAdjustSkipMounted: skipped=${skippedMountedTextNodes}`);
            }
            if (trustedMarkedStaleCount > 0 || trustedMarkedSuspectCount > 0 || trustedRevalidatedCount > 0) {
                log(
                    `[Node] TrustedStateSummary: stale=${trustedMarkedStaleCount}, suspect=${trustedMarkedSuspectCount}, ` +
                    `revalidated=${trustedRevalidatedCount}, samples=${trustedTransitionSamples.join('|') || 'none'}`
                );
            }
            return stats.adjustedCount;
        } catch (err) {
            log(`[Node] 批量调整失败:`, err);
            return 0;
        }
    }

    /** 调整内存中单个节点高度（不写文件） */
    private async adjustSingleNodeHeightMemory(
        domNode: CanvasNodeLike,
        textContent: string,
        textDimensions: { width: number; maxHeight: number },
        maxHeight: number,
        formulaDimensions: { width: number; height: number },
        logDetail: boolean
    ): Promise<{
        newHeight: number;
        newWidth: number;
        oldWidth: number;
        widthChanged: boolean;
        oldHeight: number;
        delta: number;
        heightChanged: boolean;
        isFormula: boolean;
        source: string;
        shrinkBlocked: boolean;
        shrinkBlockedSource: string;
        blockedCandidateHeight: number;
        blockedFinalHeight: number;
        blockedDelta: number;
        trustedMarkedStale: boolean;
        trustedMarkedSuspect: boolean;
        trustedRevalidated: boolean;
        trustedStateReason: string;
    }> {
        const text = textContent || domNode.text || '';
        const isFormula = this.nodeTypeService.isFormula(text);
        const oldHeight = domNode.height ?? 0;
        let newHeight: number;
        let source = 'estimate';
        const width = isFormula
            ? (domNode.width || textDimensions.width)
            : resolveArrangedTextWidth(text, textDimensions.width);

        const oldWidth = domNode.width ?? textDimensions.width;
        const widthChanged = Math.abs(oldWidth - width) >= 1;
        if (widthChanged) {
            domNode.width = width;
        }

        const signature = generateTextSignature(text, width);
        let shrinkBlocked = false;
        let shrinkBlockedSource = '';
        let blockedCandidateHeight = 0;
        let blockedFinalHeight = 0;
        let blockedDelta = 0;
        let trustedMarkedStale = false;
        let trustedMarkedSuspect = false;
        let trustedRevalidated = false;
        let trustedStateReason = '';

        if (isFormula) {
            newHeight = formulaDimensions.height;
            source = 'formula';
            if (this.shouldLogVerboseNodeDiagnostics()) {
                log(`[Node.perNode] id=${domNode.id} formula: newH=${newHeight}`);
            }
        } else {
            // 获取节点元数据
            const heightMeta = this.getHeightMeta(domNode);

            const nodeEl = domNode.nodeEl;
            const heightInfo = await this.nodeHeightService.calculateTextNodeHeightInfoAsync(
                text,
                nodeEl,
                width,
                logDetail,
                heightMeta,
                domNode.id
            );
            newHeight = heightInfo.height;
            source = heightInfo.source;

            const previousTrustState = heightMeta.trustState || (heightMeta.trustedHeight ? 'valid' : 'none');
            if (heightInfo.markTrustedStaleReason) {
                heightMeta.trustState = 'stale';
                heightMeta.suspectReason = heightInfo.markTrustedStaleReason;
                heightMeta.suspectCount = (heightMeta.suspectCount ?? 0) + 1;
                trustedMarkedStale = previousTrustState !== 'stale';
                trustedStateReason = heightInfo.markTrustedStaleReason;
            }

            // 非 DOM 来源高度仅允许 grow，不允许 shrink，避免节点被过度压矮
            if (oldHeight > 0 && newHeight < oldHeight && source !== 'dom') {
                const blockedHeight = newHeight;
                newHeight = oldHeight;
                shrinkBlocked = true;
                shrinkBlockedSource = source;
                blockedCandidateHeight = blockedHeight;
                blockedFinalHeight = newHeight;
                blockedDelta = Math.max(0, oldHeight - blockedHeight);
            }

            if (source === 'trusted-history') {
                const trustedLowDelta = heightInfo.estimated - newHeight;
                if (trustedLowDelta > this.trustedSuspectDeltaPx) {
                    heightMeta.trustState = 'suspect';
                    heightMeta.suspectCount = (heightMeta.suspectCount ?? 0) + 1;
                    heightMeta.suspectReason = `trusted-low-vs-estimate:${trustedLowDelta.toFixed(1)}`;
                    trustedMarkedSuspect = previousTrustState !== 'suspect';
                    trustedStateReason = heightMeta.suspectReason;
                }
            }

            // 更新元数据
            heightMeta.lastSignature = signature;
            heightMeta.lastWidth = width;
            heightMeta.lastAutoHeight = newHeight;
            heightMeta.manualHeight = false;

            if (heightInfo.shouldSaveTrusted) {
                heightMeta.trustedHeight = newHeight;
                heightMeta.trustedSignature = signature;
                heightMeta.trustedTimestamp = Date.now();
                heightMeta.trustedEpoch = 3; // Epoch 3: 修复rendered缓存绕过 + settings引用断裂
                heightMeta.trustedWidth = width;
                heightMeta.trustedEnvHash = heightInfo.renderEnvHash || this.nodeHeightService.getRenderEnvHash(nodeEl);
                heightMeta.trustedSource = 'dom-stable';
                heightMeta.trustState = 'valid';
                heightMeta.suspectReason = undefined;
                heightMeta.suspectCount = 0;
                trustedRevalidated = previousTrustState !== 'valid';
                if (trustedRevalidated && !trustedStateReason) {
                    trustedStateReason = 'dom-revalidate';
                }
            }

            this.persistHeightMeta(domNode, heightMeta);
        }

        const delta = newHeight - oldHeight;
        const heightChanged = Math.abs(delta) >= 1;

        // [诊断] 记录所有非formula节点的调整细节
        if (!isFormula) {
            const textPreview = text.substring(0, 15).replace(/\n/g, ' ');
            // 仅在异常偏差时输出 per-node 诊断，避免批量刷屏
            if (this.shouldLogVerboseNodeDiagnostics()) {
                const estimatedHeight = estimateTextNodeHeight(text, width, maxHeight);
                const deviation = newHeight - estimatedHeight;
                const isAnomaly = Math.abs(deviation) > this.perNodeAnomalyLogThresholdPx
                    || Math.abs(delta) > this.perNodeAnomalyLogThresholdPx
                    || shrinkBlocked;
                if (isAnomaly) {
                    log(`[Node.perNode] id=${domNode.id}, src=${source}, oldH=${oldHeight}, newH=${newHeight}, delta=${delta.toFixed(1)}, est=${estimatedHeight}, dev=${deviation.toFixed(1)}, shrinkBlocked=${shrinkBlocked}, w=${width}, text="${textPreview}"`);
                }
            }
        }

        return {
            newHeight,
            newWidth: width,
            oldWidth,
            widthChanged,
            oldHeight,
            delta,
            heightChanged,
            isFormula,
            source,
            shrinkBlocked,
            shrinkBlockedSource,
            blockedCandidateHeight,
            blockedFinalHeight,
            blockedDelta,
            trustedMarkedStale,
            trustedMarkedSuspect,
            trustedRevalidated,
            trustedStateReason
        };


    }
    
    async handleSingleDelete(node: CanvasNodeLike, canvas: CanvasLike): Promise<void> {
        return this.nodeDeletionService.handleSingleDelete(node, canvas);
    }

    async handleCascadeDelete(node: CanvasNodeLike, canvas: CanvasLike): Promise<void> {
        return this.nodeDeletionService.handleCascadeDelete(node, canvas);
    }

    editNodeText(node: CanvasNodeLike, canvas: CanvasLike): void {
        const currentText = node.text || '';

        const modal = new EditTextModal(
            this.app,
            currentText,
            (newText: string) => {
                if (!newText || newText === currentText) return;

                void (async () => {
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
                        log(`[Node] 更新文本失败: ${String(err)}`);
                    }
                })();
            }
        );

        modal.open();
    }

    private refreshNodeAndButtons(): void {
        const canvasView = getCanvasView(this.app);
        if (canvasView && this.canvasManager) {
            void this.canvasManager.checkAndAddCollapseButtons();
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
            this.updateNodeScrollability(node);
            if (typeof canvas.requestSave === 'function') {
                canvas.requestSave();
            }
        }
    }

    getCurrentCanvasFilePath(): string | undefined {
        return getCurrentCanvasFilePath(this.app);
    }

    public calculateTextNodeHeight(content: string, nodeEl?: Element, nodeWidthOverride?: number): number {
        return this.nodeHeightService.calculateTextNodeHeight(content, nodeEl, nodeWidthOverride);
    }

    /**
     * [渐进式策略] 测量并保存节点的可信高度（在节点失焦时调用）
     * 使用 Obsidian 原生 API 而非直接文件写入，避免触发重渲染循环
     * @param nodeId 节点ID
     */
    measureAndPersistTrustedHeight(
        nodeId: string,
        options?: { suppressSuccessLogs?: boolean; collector?: TrustedMeasureCollector; suppressRequestSave?: boolean }
    ): void {
        const suppressSuccessLogs = !!options?.suppressSuccessLogs;
        const collector = options?.collector;
        if (collector) collector.total++;
        if (!suppressSuccessLogs && this.shouldLogVerboseNodeDiagnostics()) {
            log(`[Node] measureAndPersistTrustedHeight 被调用, nodeId=${nodeId}`);
        }
        this.blurMeasureStats.total++;
        
        try {
            const canvasView = getCanvasView(this.app);
            const canvas = canvasView ? (canvasView as CanvasViewLike).canvas : null;
            
            // 获取DOM节点（必须在视口内）
            const domNode = canvas?.nodes instanceof Map ? canvas.nodes.get(nodeId) : undefined;
            if (!domNode?.nodeEl) {
                this.blurMeasureStats.skippedNoDom++;
                if (collector) {
                    collector.noDom++;
                    this.pushCollectorSample(collector, `no-dom:${nodeId}`);
                }
                this.logBlurMeasureSummary('no-dom');
                if (!suppressSuccessLogs && this.shouldLogVerboseNodeDiagnostics()) {
                    log(`[Node] 失焦测量跳过: 节点不在DOM中 ${nodeId}`);
                }
                return;
            }
            
            // 检查节点是否真的可见（非虚拟化）
            const isVirtualized = this.isNodeVirtualized(domNode.nodeEl);
            if (isVirtualized) {
                this.blurMeasureStats.skippedVirtualized++;
                if (collector) {
                    collector.virtualized++;
                    this.pushCollectorSample(collector, `virtualized:${nodeId}`);
                }
                this.logBlurMeasureSummary('virtualized');
                if (!suppressSuccessLogs && this.shouldLogVerboseNodeDiagnostics()) {
                    log(`[Node] 失焦测量跳过: 节点已虚拟化 ${nodeId}`);
                }
                return;
            }
            
            const nodeMeta = this.getNodeTextAndType(domNode);
            if (!nodeMeta.isTextLike || !nodeMeta.text) {
                this.blurMeasureStats.skippedNonText++;
                if (collector) {
                    collector.nonText++;
                    this.pushCollectorSample(collector, `non-text:${nodeId}`);
                }
                this.logBlurMeasureSummary('non-text');
                if (!suppressSuccessLogs && this.shouldLogVerboseNodeDiagnostics()) {
                    log(`[Node] 失焦测量跳过: 非文本或无文本 ${nodeId}, type=${nodeMeta.typeRaw || 'undefined'}`);
                }
                return;
            }
            
            // 测量当前高度
            const width = domNode.width || this.settings.textNodeWidth || 400;
            const measuredHeight = this.nodeHeightService.calculateTextNodeHeight(nodeMeta.text, domNode.nodeEl, width, nodeId);
            
            if (measuredHeight <= 0) {
                this.blurMeasureStats.failedZeroHeight++;
                if (collector) {
                    collector.zeroHeight++;
                    this.pushCollectorSample(collector, `zero-height:${nodeId}`);
                }
                this.logBlurMeasureSummary('zero-height');
                log(`[Node] 失焦测量失败: 测量高度为0 ${nodeId}`);
                return;
            }
            
            this.blurMeasureStats.success++;
            if (collector) collector.success++;
            this.logBlurMeasureSummary('success');
            if (!suppressSuccessLogs && this.shouldLogVerboseNodeDiagnostics()) {
                log(`[Node] 失焦测量成功: id=${nodeId}, h=${measuredHeight}`);
            }
            
            // ===== 关键修改：使用 Obsidian 原生 API 而非直接文件写入 =====
            // 这样可以更新内存中的节点高度，由 Obsidian 的渲染引擎统一管理
            // 避免触发文件变化 → 重渲染 → Observer → 再次测量 → 再次写入 的死循环
            
            // 检查是否需要更新高度
            const currentHeight = domNode.height ?? 0;
            if (Math.abs(currentHeight - measuredHeight) < 1) {
                if (collector) collector.unchanged++;
                if (!suppressSuccessLogs && this.shouldLogVerboseNodeDiagnostics()) {
                    log(`[Node] 失焦更新跳过: 高度差异小于1px ${nodeId}, cur=${currentHeight}, new=${measuredHeight}`);
                }
                return;
            }
            if (collector) collector.updated++;
            
            // 使用 moveAndResize 更新内存中的节点（不触发文件写入循环）
            if (typeof domNode.moveAndResize === 'function') {
                domNode.moveAndResize({
                    x: domNode.x ?? 0,
                    y: domNode.y ?? 0,
                    width: domNode.width ?? width,
                    height: measuredHeight
                });
                if (!suppressSuccessLogs && this.shouldLogVerboseNodeDiagnostics()) {
                    log(`[Node] 失焦更新: id=${nodeId}, ${currentHeight}->${measuredHeight} (moveAndResize)`);
                }
            } else {
                // 备用方案：直接设置属性
                domNode.height = measuredHeight;
                if (!suppressSuccessLogs && this.shouldLogVerboseNodeDiagnostics()) {
                    log(`[Node] 失焦更新: id=${nodeId}, ${currentHeight}->${measuredHeight} (direct)`);
                }
            }
            
            // 请求 Canvas 保存（由 Obsidian 决定何时写入文件）
            if (!options?.suppressRequestSave && canvas && typeof canvas.requestSave === 'function') {
                canvas.requestSave();
            }
            
            // 同时在节点 data 中更新元数据（内存中）
            const heightMeta = this.getHeightMeta(domNode);
            const signature = generateTextSignature(nodeMeta.text, width);
            heightMeta.trustedHeight = measuredHeight;
            heightMeta.trustedSignature = signature;
            heightMeta.trustedTimestamp = Date.now();
            heightMeta.trustedEpoch = 3; // Epoch 3: 修复rendered缓存绕过 + settings引用断裂
            heightMeta.trustedWidth = width;
            heightMeta.trustedEnvHash = this.nodeHeightService.getRenderEnvHash(domNode.nodeEl);
            heightMeta.trustedSource = 'dom-stable';
            heightMeta.trustState = 'valid';
            heightMeta.suspectReason = undefined;
            heightMeta.suspectCount = 0;
            heightMeta.lastWidth = width;
            heightMeta.lastAutoHeight = measuredHeight;
            this.persistHeightMeta(domNode, heightMeta);

            this.updateNodeScrollability(domNode);
            
        } catch (err) {
            this.blurMeasureStats.error++;
            if (collector) {
                collector.error++;
                this.pushCollectorSample(collector, `error:${nodeId}`);
            }
            this.logBlurMeasureSummary('error');
            log(`[Node] 失焦测量异常: ${String(err)}`);
        }
    }

    private logBlurMeasureSummary(trigger: string): void {
        const total = this.blurMeasureStats.total;
        const shouldLog = trigger === 'error' || trigger === 'zero-height' || total % 20 === 0;
        if (!shouldLog) return;
        log(`[Node] BlurMeasureSummary: trigger=${trigger}, total=${total}, success=${this.blurMeasureStats.success}, noDom=${this.blurMeasureStats.skippedNoDom}, virtualized=${this.blurMeasureStats.skippedVirtualized}, nonText=${this.blurMeasureStats.skippedNonText}, zeroH=${this.blurMeasureStats.failedZeroHeight}, noPath=${this.blurMeasureStats.skippedNoCanvasPath}, error=${this.blurMeasureStats.error}`);
    }

    private shouldLogVerboseNodeDiagnostics(): boolean {
        return !!this.settings.enableDebugLogging && !!this.settings.enableVerboseCanvasDiagnostics;
    }

    private pushCollectorSample(collector: TrustedMeasureCollector, sample: string): void {
        if (collector.samples.length >= this.batchSummarySampleLimit) return;
        collector.samples.push(sample);
    }

    private isNodeVirtualized(nodeEl: Element): boolean {
        const el = nodeEl as HTMLElement;
        const rectHeight = el.getBoundingClientRect().height;
        return rectHeight === 0 && el.offsetHeight === 0 && el.clientHeight === 0 && el.scrollHeight === 0;
    }

    private getNodeTextAndType(node: CanvasNodeLike | undefined): { text: string; isTextLike: boolean; typeRaw?: string } {
        if (!node) return { text: '', isTextLike: false, typeRaw: undefined };
        const data = typeof node.getData === 'function' ? node.getData() : undefined;
        const dataText = typeof data?.text === 'string' ? data.text : '';
        const text = (typeof node.text === 'string' && node.text.length > 0) ? node.text : dataText;
        const typeRaw = typeof node.type === 'string'
            ? node.type
            : (typeof data?.type === 'string' ? data.type : undefined);
        const isTextLike = !typeRaw || typeRaw === 'text';
        return { text, isTextLike, typeRaw };
    }

    private isNodeDomMounted(node: CanvasNodeLike): boolean {
        return !!node.nodeEl && !this.isNodeVirtualized(node.nodeEl);
    }

    private isElementInViewport(el: Element): boolean {
        const rect = el.getBoundingClientRect();
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        return rect.bottom > 0 && rect.right > 0 && rect.left < viewportWidth && rect.top < viewportHeight;
    }

    private isNodeAtMaxHeight(node: CanvasNodeLike, maxHeight: number): boolean {
        const memoryHeight = typeof node.height === 'number' ? node.height : 0;
        const domHeight = node.nodeEl?.offsetHeight ?? 0;
        const height = memoryHeight > 0 ? memoryHeight : domHeight;
        return height >= Math.max(1, maxHeight - 1);
    }

    private getScrollableOwnerElements(nodeEl: HTMLElement): HTMLElement[] {
        const owners: HTMLElement[] = [];
        const seen = new Set<HTMLElement>();

        for (const selector of CanvasNodeManager.SCROLLABLE_OWNER_SELECTORS) {
            const list = nodeEl.querySelectorAll(selector);
            for (const el of Array.from(list)) {
                if (!(el instanceof HTMLElement)) continue;
                if (seen.has(el)) continue;
                seen.add(el);
                owners.push(el);
            }
        }

        return owners;
    }

    private hasVerticalOverflow(el: HTMLElement): boolean {
        return el.scrollHeight > el.clientHeight + 1;
    }

    private applyInlineOverflowY(el: HTMLElement, overflowY: 'hidden' | 'auto'): boolean {
        const current = el.style.getPropertyValue('overflow-y');
        const currentPriority = el.style.getPropertyPriority('overflow-y');
        if (current === overflowY && currentPriority === 'important') {
            return false;
        }
        el.style.setProperty('overflow-y', overflowY, 'important');
        return true;
    }

    /**
     * 同步单个节点的滚动条显示状态：仅在“命中最大高度且内容溢出”时允许纵向滚动
     */
    private updateNodeScrollability(node: CanvasNodeLike): boolean {
        const nodeEl = node.nodeEl;
        if (!nodeEl) return false;

        // 虚拟化节点不做溢出测量，避免不必要的强制回流；待节点重新挂载后再同步
        if (this.isNodeVirtualized(nodeEl)) {
            const hadClass = nodeEl.classList.contains(CanvasNodeManager.SCROLLABLE_NODE_CLASS);
            nodeEl.classList.remove(CanvasNodeManager.SCROLLABLE_NODE_CLASS);
            return hadClass;
        }

        const before = nodeEl.classList.contains(CanvasNodeManager.SCROLLABLE_NODE_CLASS);
        const scrollOwners = this.getScrollableOwnerElements(nodeEl);

        const nodeMeta = this.getNodeTextAndType(node);
        const contentEl = nodeEl.querySelector('.canvas-node-content');
        if (!contentEl || !nodeMeta.isTextLike || !nodeMeta.text) {
            nodeEl.classList.remove(CanvasNodeManager.SCROLLABLE_NODE_CLASS);
            let changed = before;
            for (const owner of scrollOwners) {
                if (this.applyInlineOverflowY(owner, 'hidden')) {
                    changed = true;
                }
            }
            return changed;
        }

        const maxHeight = this.settings.textNodeMaxHeight || 800;
        const atMaxHeight = this.isNodeAtMaxHeight(node, maxHeight);
        const shouldScrollable = atMaxHeight
            ? scrollOwners.some((owner) => this.hasVerticalOverflow(owner))
            : false;

        nodeEl.classList.toggle(CanvasNodeManager.SCROLLABLE_NODE_CLASS, shouldScrollable);
        let changed = before !== shouldScrollable;
        const targetOverflowY: 'hidden' | 'auto' = shouldScrollable ? 'auto' : 'hidden';
        for (const owner of scrollOwners) {
            if (this.applyInlineOverflowY(owner, targetOverflowY)) {
                changed = true;
            }
        }

        return changed;
    }

    /**
     * 批量同步当前 DOM-mounted 节点的滚动条状态
     */
    syncScrollableStateForMountedNodes(): number {
        const canvasView = getCanvasView(this.app);
        const canvas = canvasView ? (canvasView as CanvasViewLike).canvas : null;
        if (!canvas?.nodes || !(canvas.nodes instanceof Map)) {
            return 0;
        }

        let updated = 0;
        for (const [, node] of canvas.nodes) {
            if (!node.nodeEl) continue;
            if (this.updateNodeScrollability(node)) {
                updated++;
            }
        }
        return updated;
    }

    /**
     * 从内存 data 和 Obsidian 节点持久化 data 中读取高度元数据
     */
    private getHeightMeta(node: CanvasNodeLike): HeightMeta {
        const memoryMeta = (node.data && typeof node.data === 'object')
            ? (node.data as { heightMeta?: HeightMeta }).heightMeta
            : undefined;
        const persistedData = typeof node.getData === 'function' ? node.getData() : undefined;
        const persistedMeta = (persistedData && typeof persistedData === 'object')
            ? (persistedData as { heightMeta?: HeightMeta }).heightMeta
            : undefined;

        return {
            ...(persistedMeta || {}),
            ...(memoryMeta || {})
        };
    }

    /**
     * 同步写入高度元数据到内存与节点持久化 data，确保重开 canvas 后可恢复 trusted-history
     */
    private persistHeightMeta(node: CanvasNodeLike, heightMeta: HeightMeta): void {
        if (!node.data || typeof node.data !== 'object') {
            node.data = {};
        }
        (node.data as { heightMeta?: HeightMeta }).heightMeta = heightMeta;

        if (typeof node.setData === 'function') {
            const baseData = (typeof node.getData === 'function' ? node.getData() : {}) || {};
            node.setData({
                ...baseData,
                heightMeta
            });
        }
    }

    /**
     * 主动刷新当前可见文本节点的 trustedHeight（小批量）
     * 用于降低长期依赖估算高度且失焦测量触发不足的问题
     */
    async refreshTrustedHeightsForVisibleTextNodes(limit: number = 8, options?: { suppressRequestSave?: boolean }): Promise<number> {
        const canvasView = getCanvasView(this.app);
        const canvas = canvasView ? (canvasView as CanvasViewLike).canvas : null;
        if (!canvas?.nodes || !(canvas.nodes instanceof Map)) {
            return 0;
        }

        const candidateIds: string[] = [];
        let noDomCount = 0;
        let virtualizedCount = 0;
        let nonTextCount = 0;
        let noTextCount = 0;
        const candidateSamples: string[] = [];
        const skippedSamples: string[] = [];

        for (const [id, node] of canvas.nodes) {
            if (candidateIds.length >= limit) break;

            const nodeMeta = this.getNodeTextAndType(node);
            if (!node.nodeEl) {
                noDomCount++;
                if (skippedSamples.length < 4) skippedSamples.push(`${id}:no-dom`);
                continue;
            }
            if (this.isNodeVirtualized(node.nodeEl)) {
                virtualizedCount++;
                if (skippedSamples.length < 4) skippedSamples.push(`${id}:virtualized`);
                continue;
            }
            if (!nodeMeta.isTextLike) {
                nonTextCount++;
                if (skippedSamples.length < 4) skippedSamples.push(`${id}:type=${nodeMeta.typeRaw || 'undefined'}`);
                continue;
            }
            if (!nodeMeta.text) {
                noTextCount++;
                if (skippedSamples.length < 4) skippedSamples.push(`${id}:empty-text`);
                continue;
            }

            candidateIds.push(id);
            if (candidateSamples.length < 4) {
                candidateSamples.push(`${id}:type=${nodeMeta.typeRaw || 'undefined'} len=${nodeMeta.text.length}`);
            }
        }

        let refreshed = 0;
        const collector = createTrustedMeasureCollector();
        for (const nodeId of candidateIds) {
            await this.measureAndPersistTrustedHeight(nodeId, {
                suppressSuccessLogs: true,
                collector,
                suppressRequestSave: options?.suppressRequestSave
            });
            refreshed++;
        }

        log(
            `[Node] ProactiveTrustedRefresh: refreshed=${refreshed}, candidates=${candidateIds.length}, limit=${limit}, ` +
            `noDom=${noDomCount}, virtualized=${virtualizedCount}, nonText=${nonTextCount}, noText=${noTextCount}, ` +
            `measure={total=${collector.total},success=${collector.success},updated=${collector.updated},unchanged=${collector.unchanged},` +
            `noDom=${collector.noDom},virtualized=${collector.virtualized},nonText=${collector.nonText},zeroH=${collector.zeroHeight},error=${collector.error}}, ` +
            `candidateSample=${candidateSamples.join('|') || 'none'}, skippedSample=${skippedSamples.join('|') || 'none'}, ` +
            `issueSample=${collector.samples.join('|') || 'none'}`
        );
        return refreshed;
    }

    /**
     * 手动 arrange 专用：优先刷新当前 viewport 内已挂载文本节点（分批）
     */
    async refreshTrustedHeightsForViewportTextNodes(limit: number = 24, batchSize: number = 6, options?: { suppressRequestSave?: boolean }): Promise<number> {
        const canvasView = getCanvasView(this.app);
        const canvas = canvasView ? (canvasView as CanvasViewLike).canvas : null;
        if (!canvas?.nodes || !(canvas.nodes instanceof Map)) {
            return 0;
        }

        const viewportCandidates: string[] = [];
        const mountedOffscreenCandidates: string[] = [];
        let noDomCount = 0;
        let virtualizedCount = 0;
        let nonTextCount = 0;
        let noTextCount = 0;

        for (const [id, node] of canvas.nodes) {
            const nodeMeta = this.getNodeTextAndType(node);
            if (!node.nodeEl) {
                noDomCount++;
                continue;
            }
            if (!this.isNodeDomMounted(node)) {
                virtualizedCount++;
                continue;
            }
            if (!nodeMeta.isTextLike) {
                nonTextCount++;
                continue;
            }
            if (!nodeMeta.text) {
                noTextCount++;
                continue;
            }

            if (this.isElementInViewport(node.nodeEl)) {
                viewportCandidates.push(id);
            } else {
                mountedOffscreenCandidates.push(id);
            }
        }

        const orderedCandidates = [...viewportCandidates, ...mountedOffscreenCandidates];
        const candidateIds = orderedCandidates.slice(0, Math.max(0, limit));

        let refreshed = 0;
        const collector = createTrustedMeasureCollector();
        for (let i = 0; i < candidateIds.length; i++) {
            const candidateId = candidateIds[i];
            if (!candidateId) continue;
            await this.measureAndPersistTrustedHeight(candidateId, {
                suppressSuccessLogs: true,
                collector,
                suppressRequestSave: options?.suppressRequestSave
            });
            refreshed++;

            if (batchSize > 0 && refreshed < candidateIds.length && refreshed % batchSize === 0) {
                await new Promise<void>((resolve) => {
                    requestAnimationFrame(() => resolve());
                });
            }
        }

        const scrollabilityUpdated = this.syncScrollableStateForMountedNodes();
        log(
            `[Node] ViewportTrustedRefresh: refreshed=${refreshed}, limit=${limit}, batchSize=${batchSize}, ` +
            `viewportCandidates=${viewportCandidates.length}, mountedOffscreenCandidates=${mountedOffscreenCandidates.length}, ` +
            `scrollabilityUpdated=${scrollabilityUpdated}, noDom=${noDomCount}, virtualized=${virtualizedCount}, nonText=${nonTextCount}, noText=${noTextCount}, ` +
            `measure={total=${collector.total},success=${collector.success},updated=${collector.updated},unchanged=${collector.unchanged},` +
            `noDom=${collector.noDom},virtualized=${collector.virtualized},nonText=${collector.nonText},zeroH=${collector.zeroHeight},error=${collector.error}}, ` +
            `issueSample=${collector.samples.join('|') || 'none'}`
        );

        return refreshed;
    }

    /** 刷新 Canvas 边和视图 */
    private refreshCanvasAfterHeightAdjust(suppressRequestSave: boolean = false): void {
        const canvasView = getCanvasView(this.app);
        if (!canvasView) return;
        const canvas = (canvasView as CanvasViewLike).canvas;
        if (!canvas) return;

        // 重绘所有边
        if (canvas.edges) {
            const edgesArray = canvas.edges instanceof Map
                ? Array.from(canvas.edges.values())
                : Array.isArray(canvas.edges) ? canvas.edges : [];
            for (const edge of edgesArray) {
                if (typeof (edge).render === 'function') {
                    (edge).render();
                }
            }
        }
        if (!suppressRequestSave && typeof canvas.requestSave === 'function') canvas.requestSave();
        if (typeof canvas.requestUpdate === 'function') canvas.requestUpdate();
    }

    /** 输出高度调整统计日志 */
    private logHeightAdjustStats(stats: HeightAdjustmentStats): void {
        if (stats.adjustedCount > 0) {
            new Notice(`已调整 ${stats.adjustedCount} 个节点高度`);
            log(`[Node] 批量调整完成: ${stats.adjustedCount}`);
        } else {
            log(`[Node] 批量调整完成: 无需更新节点高度`);
        }
        log(`[Node] 批量调整统计: 增加=${stats.increasedCount}, 减少=${stats.decreasedCount}, widthChanged=${stats.widthAdjustedCount}, maxIncrease=${stats.maxIncrease.toFixed(1)}, maxDecrease=${stats.maxDecrease.toFixed(1)}, capped=${stats.cappedCount}, formula=${stats.formulaCount}`);
        log(`[Node] 高度来源统计: dom=${stats.sourceDomCount}, rendered=${stats.sourceRenderedCount}, trusted=${stats.sourceFileTrustedCount}, estimate=${stats.sourceEstimateCount}, zeroDom=${stats.sourceZeroDomCount}, sample=${stats.sourceSamples.join('|')}`);
    }
}
