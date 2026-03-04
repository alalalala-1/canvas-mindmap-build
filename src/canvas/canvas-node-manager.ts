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
     */
    async validateAndRepairNodeHeights(file: TFile): Promise<void> {
        log(`[Node] 开始健康检查: ${file.path}`);

        try {
            const textDimensions = this.nodeTypeService.getTextDimensions();

            await this.canvasFileService.modifyCanvasDataAtomic(file.path, async (canvasData) => {
                if (!canvasData.nodes) return false;

                let repairedCount = 0;
                let repairedSamples: string[] = [];

                for (const node of canvasData.nodes) {
                    // 仅处理文本节点
                    if (node.type !== 'text' || !node.text) continue;

                    // 1. 获取基础参数
                    const width = (typeof node.width === 'number' && node.width > 0)
                        ? node.width
                        : textDimensions.width;

                    // 2. 计算纯估算高度（作为基准真值）
                    const estimatedHeight = estimateTextNodeHeight(
                        node.text,
                        width,
                        this.settings.textNodeMaxHeight || 800
                    );

                    // 3. 检查当前持久化高度
                    const currentHeight = node.height ?? 0;

                    // 4. 获取元数据
                    if (!node.data || typeof node.data !== 'object') {
                        node.data = {};
                    }
                    const heightMeta = (node.data as { heightMeta?: HeightMeta }).heightMeta || {};

                    // 5. 判定是否需要修复
                    let shouldRepair = false;
                    let repairReason = '';

                    // 场景A: 高度极小（可能是之前的 DOM=0 错误写入）
                    if (currentHeight < 20) {
                        shouldRepair = true;
                        repairReason = 'too_small';
                    }
                    // 场景B: 非手动调整，且偏差过大 (>20% 且 >20px)
                    else {
                        const delta = Math.abs(currentHeight - estimatedHeight);
                        const threshold = Math.max(20, estimatedHeight * 0.2);

                        if (delta > threshold) {
                            shouldRepair = true;
                            repairReason = `deviation_large(curr=${currentHeight},est=${estimatedHeight})`;
                        }
                    }

                    // 6. 执行修复
                    if (shouldRepair) {
                        node.height = estimatedHeight;

                        // 更新元数据以匹配估算值
                        heightMeta.lastAutoHeight = estimatedHeight;
                        heightMeta.lastWidth = width;
                        (node.data as { heightMeta?: HeightMeta }).heightMeta = heightMeta;

                        repairedCount++;
                        if (repairedSamples.length < 5) {
                            repairedSamples.push(`${node.id}:${repairReason}`);
                        }
                    }
                }

                if (repairedCount > 0) {
                    log(`[Node] 健康检查完成: 修复了 ${repairedCount} 个异常节点. Samples: ${repairedSamples.join(', ')}`);
                    new Notice(`已修复 ${repairedCount} 个节点的高度异常`);
                    return true; // 触发保存
                } else {
                    log(`[Node] 健康检查完成: 未发现异常`);
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

    async adjustAllTextNodeHeights(): Promise<number> {
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

            for (const [nodeId, domNode] of canvas.nodes) {
                const nodeMeta = this.getNodeTextAndType(domNode);
                if (!nodeMeta.isTextLike || !nodeMeta.text) continue;

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
            }

            // 统一请求保存（由 Obsidian 决定何时写入）
            if (changed && typeof canvas.requestSave === 'function') {
                canvas.requestSave();
            }

            this.refreshCanvasAfterHeightAdjust();
            this.logHeightAdjustStats(stats);
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
    }> {
        const text = textContent || domNode.text || '';
        const isFormula = this.nodeTypeService.isFormula(text);
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

        if (isFormula) {
            newHeight = formulaDimensions.height;
            source = 'formula';
            log(`[Node.perNode] id=${domNode.id} formula: newH=${newHeight}`);
        } else {
            // 获取节点元数据
            const heightMeta = this.getHeightMeta(domNode);

            const nodeEl = domNode.nodeEl;
            const heightInfo = await this.nodeHeightService.calculateTextNodeHeightInfoAsync(
                text,
                nodeEl,
                width,
                logDetail,
                heightMeta
            );
            newHeight = heightInfo.height;
            source = heightInfo.source;

            // 更新元数据
            heightMeta.lastSignature = signature;
            heightMeta.lastWidth = width;
            heightMeta.lastAutoHeight = newHeight;
            heightMeta.manualHeight = false;

            if (heightInfo.shouldSaveTrusted) {
                heightMeta.trustedHeight = newHeight;
                heightMeta.trustedSignature = signature;
                heightMeta.trustedTimestamp = Date.now();
            }

            this.persistHeightMeta(domNode, heightMeta);
        }

        const oldHeight = domNode.height ?? 0;
        const delta = newHeight - oldHeight;
        const heightChanged = Math.abs(delta) >= 1;

        return { newHeight, newWidth: width, oldWidth, widthChanged, oldHeight, delta, heightChanged, isFormula, source };
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

    public calculateTextNodeHeight(content: string, nodeEl?: Element, nodeWidthOverride?: number): number {
        return this.nodeHeightService.calculateTextNodeHeight(content, nodeEl, nodeWidthOverride);
    }

    /**
     * [渐进式策略] 测量并保存节点的可信高度（在节点失焦时调用）
     * 使用 Obsidian 原生 API 而非直接文件写入，避免触发重渲染循环
     * @param nodeId 节点ID
     */
    async measureAndPersistTrustedHeight(nodeId: string): Promise<void> {
        log(`[Node] measureAndPersistTrustedHeight 被调用, nodeId=${nodeId}`);
        this.blurMeasureStats.total++;
        
        try {
            const canvasView = getCanvasView(this.app);
            const canvas = canvasView ? (canvasView as CanvasViewLike).canvas : null;
            
            // 获取DOM节点（必须在视口内）
            const domNode = canvas?.nodes instanceof Map ? canvas.nodes.get(nodeId) : undefined;
            if (!domNode?.nodeEl) {
                this.blurMeasureStats.skippedNoDom++;
                this.logBlurMeasureSummary('no-dom');
                log(`[Node] 失焦测量跳过: 节点不在DOM中 ${nodeId}`);
                return;
            }
            
            // 检查节点是否真的可见（非虚拟化）
            const isVirtualized = this.isNodeVirtualized(domNode.nodeEl);
            if (isVirtualized) {
                this.blurMeasureStats.skippedVirtualized++;
                this.logBlurMeasureSummary('virtualized');
                log(`[Node] 失焦测量跳过: 节点已虚拟化 ${nodeId}`);
                return;
            }
            
            const nodeMeta = this.getNodeTextAndType(domNode);
            if (!nodeMeta.isTextLike || !nodeMeta.text) {
                this.blurMeasureStats.skippedNonText++;
                this.logBlurMeasureSummary('non-text');
                log(`[Node] 失焦测量跳过: 非文本或无文本 ${nodeId}, type=${nodeMeta.typeRaw || 'undefined'}`);
                return;
            }
            
            // 测量当前高度
            const width = domNode.width || this.settings.textNodeWidth || 400;
            const measuredHeight = this.nodeHeightService.calculateTextNodeHeight(nodeMeta.text, domNode.nodeEl, width);
            
            if (measuredHeight <= 0) {
                this.blurMeasureStats.failedZeroHeight++;
                this.logBlurMeasureSummary('zero-height');
                log(`[Node] 失焦测量失败: 测量高度为0 ${nodeId}`);
                return;
            }
            
            this.blurMeasureStats.success++;
            this.logBlurMeasureSummary('success');
            log(`[Node] 失焦测量成功: id=${nodeId}, h=${measuredHeight}`);
            
            // ===== 关键修改：使用 Obsidian 原生 API 而非直接文件写入 =====
            // 这样可以更新内存中的节点高度，由 Obsidian 的渲染引擎统一管理
            // 避免触发文件变化 → 重渲染 → Observer → 再次测量 → 再次写入 的死循环
            
            // 检查是否需要更新高度
            const currentHeight = domNode.height ?? 0;
            if (Math.abs(currentHeight - measuredHeight) < 1) {
                log(`[Node] 失焦更新跳过: 高度差异小于1px ${nodeId}, cur=${currentHeight}, new=${measuredHeight}`);
                return;
            }
            
            // 使用 moveAndResize 更新内存中的节点（不触发文件写入循环）
            if (typeof domNode.moveAndResize === 'function') {
                domNode.moveAndResize({
                    x: domNode.x ?? 0,
                    y: domNode.y ?? 0,
                    width: domNode.width ?? width,
                    height: measuredHeight
                });
                log(`[Node] 失焦更新: id=${nodeId}, ${currentHeight}->${measuredHeight} (moveAndResize)`);
            } else {
                // 备用方案：直接设置属性
                domNode.height = measuredHeight;
                log(`[Node] 失焦更新: id=${nodeId}, ${currentHeight}->${measuredHeight} (direct)`);
            }
            
            // 请求 Canvas 保存（由 Obsidian 决定何时写入文件）
            if (canvas && typeof canvas.requestSave === 'function') {
                canvas.requestSave();
            }
            
            // 同时在节点 data 中更新元数据（内存中）
            const heightMeta = this.getHeightMeta(domNode);
            const signature = generateTextSignature(nodeMeta.text, width);
            heightMeta.trustedHeight = measuredHeight;
            heightMeta.trustedSignature = signature;
            heightMeta.trustedTimestamp = Date.now();
            heightMeta.lastWidth = width;
            heightMeta.lastAutoHeight = measuredHeight;
            this.persistHeightMeta(domNode, heightMeta);
            
        } catch (err) {
            this.blurMeasureStats.error++;
            this.logBlurMeasureSummary('error');
            log(`[Node] 失焦测量异常: ${err}`);
        }
    }

    private logBlurMeasureSummary(trigger: string): void {
        const total = this.blurMeasureStats.total;
        if (total % 20 !== 0 && trigger !== 'success') return;
        log(`[Node] BlurMeasureSummary: trigger=${trigger}, total=${total}, success=${this.blurMeasureStats.success}, noDom=${this.blurMeasureStats.skippedNoDom}, virtualized=${this.blurMeasureStats.skippedVirtualized}, nonText=${this.blurMeasureStats.skippedNonText}, zeroH=${this.blurMeasureStats.failedZeroHeight}, noPath=${this.blurMeasureStats.skippedNoCanvasPath}, error=${this.blurMeasureStats.error}`);
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
    async refreshTrustedHeightsForVisibleTextNodes(limit: number = 8): Promise<number> {
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
        for (const nodeId of candidateIds) {
            await this.measureAndPersistTrustedHeight(nodeId);
            refreshed++;
        }

        log(`[Node] ProactiveTrustedRefresh: refreshed=${refreshed}, candidates=${candidateIds.length}, limit=${limit}, noDom=${noDomCount}, virtualized=${virtualizedCount}, nonText=${nonTextCount}, noText=${noTextCount}, candidateSample=${candidateSamples.join('|') || 'none'}, skippedSample=${skippedSamples.join('|') || 'none'}`);
        return refreshed;
    }

    /** 刷新 Canvas 边和视图 */
    private refreshCanvasAfterHeightAdjust(): void {
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
                if (typeof (edge as any).render === 'function') {
                    (edge as any).render();
                }
            }
        }
        if (typeof canvas.requestSave === 'function') canvas.requestSave();
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
