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
    getCurrentCanvasFilePath
} from '../utils/canvas-utils';
import { generateTextSignature } from '../utils/height-utils';
import { CanvasLike, CanvasNodeLike, ICanvasManager, CanvasViewLike, HeightMeta } from './types';

/** 高度调整的统计上下文 */
interface HeightAdjustmentStats {
    adjustedCount: number;
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
            const canvasFilePath = this.canvasFileService.getCurrentCanvasFilePath();
            if (!canvasFilePath) {
                log(`[Node] 批量调整跳过: 找不到当前 Canvas 路径`);
                return 0;
            }

            log(`[Node] 开始批量调整高度: ${canvasFilePath}`);

            const stats = createEmptyStats();
            const textDimensions = this.nodeTypeService.getTextDimensions();
            const maxHeight = textDimensions.maxHeight;
            const formulaDimensions = this.nodeTypeService.getFormulaDimensions();

            await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, async (canvasData) => {
                if (!canvasData.nodes) return false;

                let changed = false;
                const logDetail = false;
                const nodeDomMap = this.buildNodeDomMap();
                let sourceSampleCount = 0;

                for (const node of canvasData.nodes) {
                    if (!node.type || node.type === 'text') {
                        if (node.text) {
                            const result = await this.adjustSingleNodeHeight(
                                node, 
                                nodeDomMap, 
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
                            else if (result.source === 'file-trusted' || result.source === 'trusted-history') stats.sourceFileTrustedCount++;
                            else stats.sourceEstimateCount++;
                            
                            // 收集样本
                            if (sourceSampleCount < 8 && result.heightChanged) {
                                stats.sourceSamples.push(`${node.id}:${result.source} ${result.oldHeight}->${result.newHeight}`);
                                sourceSampleCount++;
                            }
                            
                            // 同步内存节点
                            this.syncMemoryNodeHeight(node.id, result.newHeight, nodeDomMap);
                        }
                    }
                }
                return changed;
            });

            this.refreshCanvasAfterHeightAdjust();
            this.logHeightAdjustStats(stats);
            return stats.adjustedCount;
        } catch (err) {
            log(`[Node] 批量调整失败:`, err);
            return 0;
        }
    }

    /** 调整单个节点高度 */
    private async adjustSingleNodeHeight(
        node: CanvasNodeLike,
        nodeDomMap: Map<string, CanvasNodeLike>,
        textDimensions: { width: number; maxHeight: number },
        maxHeight: number,
        formulaDimensions: { width: number; height: number },
        logDetail: boolean
    ): Promise<{
        newHeight: number;
        oldHeight: number;
        delta: number;
        heightChanged: boolean;
        isFormula: boolean;
        source: string;
    }> {
        const isFormula = this.nodeTypeService.isFormula(node.text || '');
        let newHeight: number;
        let source = 'estimate';

        if (isFormula) {
            newHeight = formulaDimensions.height;
            node.width = formulaDimensions.width;
            if (!node.data || typeof node.data !== 'object') {
                node.data = {};
            }
            const heightMeta = (node.data as { heightMeta?: HeightMeta }).heightMeta || {};
            heightMeta.manualHeight = false;
            heightMeta.lastWidth = node.width;
            heightMeta.lastAutoHeight = newHeight;
            heightMeta.lastSignature = generateTextSignature(node.text || '', node.width);
            (node.data as { heightMeta?: HeightMeta }).heightMeta = heightMeta;
            log(`[Node.perNode] id=${node.id} formula: newH=${newHeight}`);
        } else {
            const width = typeof node.width === 'number' && node.width > 0
                ? node.width
                : textDimensions.width;
            if (!node.width || node.width <= 0) {
                node.width = width;
            }

            if (!node.data || typeof node.data !== 'object') {
                node.data = {};
            }
            const heightMeta = (node.data as { heightMeta?: HeightMeta }).heightMeta || {};
            
            const domNode = nodeDomMap.get(node.id || '');
            const nodeEl = domNode?.nodeEl;
            
            const heightInfo = await this.nodeHeightService.calculateTextNodeHeightInfoAsync(
                node.text || '',
                nodeEl,
                width,
                logDetail,
                node.height,
                heightMeta
            );
            newHeight = heightInfo.height;
            source = heightInfo.source;

            const signature = generateTextSignature(node.text || '', width);
            heightMeta.lastSignature = signature;
            heightMeta.lastWidth = width;
            heightMeta.lastAutoHeight = newHeight;
            heightMeta.manualHeight = false;
            
            if (heightInfo.shouldSaveTrusted) {
                heightMeta.trustedHeight = newHeight;
                heightMeta.trustedSignature = signature;
                heightMeta.trustedTimestamp = Date.now();
            }
            
            (node.data as { heightMeta?: HeightMeta }).heightMeta = heightMeta;
        }

        const oldHeight = node.height ?? 0;
        const delta = newHeight - oldHeight;
        const heightChanged = oldHeight !== newHeight;
        
        if (heightChanged) {
            node.height = newHeight;
        }

        return { newHeight, oldHeight, delta, heightChanged, isFormula, source };
    }

    /** 同步内存中的节点高度 */
    private syncMemoryNodeHeight(nodeId: string | undefined, newHeight: number, nodeDomMap: Map<string, CanvasNodeLike>): void {
        if (!nodeId) return;
        const memNodeData = nodeDomMap.get(nodeId);
        if (memNodeData && memNodeData.height !== newHeight) {
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
     * @param nodeId 节点ID
     */
    async measureAndPersistTrustedHeight(nodeId: string): Promise<void> {
        log(`[Node] measureAndPersistTrustedHeight 被调用, nodeId=${nodeId}`);
        
        try {
            const canvasView = getCanvasView(this.app);
            const canvas = canvasView ? (canvasView as CanvasViewLike).canvas : null;
            
            // 获取DOM节点（必须在视口内）
            const domNode = canvas?.nodes instanceof Map ? canvas.nodes.get(nodeId) : undefined;
            if (!domNode?.nodeEl) {
                log(`[Node] 失焦测量跳过: 节点不在DOM中 ${nodeId}`);
                return;
            }
            
            // 检查节点是否真的可见（非虚拟化）
            const isVirtualized = this.isNodeVirtualized(domNode.nodeEl);
            if (isVirtualized) {
                log(`[Node] 失焦测量跳过: 节点已虚拟化 ${nodeId}`);
                return;
            }
            
            if (!domNode.text || domNode.type !== 'text') {
                log(`[Node] 失焦测量跳过: 非文本节点 ${nodeId}`);
                return;
            }
            
            // 测量当前高度
            const width = domNode.width || this.settings.textNodeWidth || 400;
            const measuredHeight = this.nodeHeightService.calculateTextNodeHeight(domNode.text, domNode.nodeEl, width);
            
            if (measuredHeight <= 0) {
                log(`[Node] 失焦测量失败: 测量高度为0 ${nodeId}`);
                return;
            }
            
            log(`[Node] 失焦测量成功: id=${nodeId}, h=${measuredHeight}`);
            
            // 持久化到文件
            const canvasFilePath = this.canvasFileService.getCurrentCanvasFilePath();
            if (!canvasFilePath) {
                log(`[Node] 失焦保存跳过: 找不到Canvas路径`);
                return;
            }
            
            await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (canvasData) => {
                if (!canvasData.nodes) return false;
                
                const node = canvasData.nodes.find(n => n.id === nodeId);
                if (!node || !node.text) return false;
                
                // 初始化元数据
                if (!node.data || typeof node.data !== 'object') {
                    node.data = {};
                }
                const heightMeta = (node.data as { heightMeta?: HeightMeta }).heightMeta || {};
                
                // 生成签名
                const signature = generateTextSignature(node.text, width);
                
                // 保存可信测量值
                heightMeta.trustedHeight = measuredHeight;
                heightMeta.trustedSignature = signature;
                heightMeta.trustedTimestamp = Date.now();
                heightMeta.lastWidth = width;
                heightMeta.lastAutoHeight = measuredHeight;
                
                (node.data as { heightMeta?: HeightMeta }).heightMeta = heightMeta;
                
                // 同时更新node.height
                const changed = node.height !== measuredHeight;
                if (changed) {
                    node.height = measuredHeight;
                    log(`[Node] 失焦保存: id=${nodeId}, ${node.height}->${measuredHeight}`);
                }
                
                return changed;
            });
            
        } catch (err) {
            log(`[Node] 失焦测量异常: ${err}`);
        }
    }

    private isNodeVirtualized(nodeEl: Element): boolean {
        const el = nodeEl as HTMLElement;
        const rectHeight = el.getBoundingClientRect().height;
        return rectHeight === 0 && el.offsetHeight === 0 && el.clientHeight === 0 && el.scrollHeight === 0;
    }

    /** 构建节点 ID → DOM 节点的映射 */
    private buildNodeDomMap(): Map<string, CanvasNodeLike> {
        const nodeDomMap = new Map<string, CanvasNodeLike>();
        const canvasView = getCanvasView(this.app);
        const canvas = canvasView ? (canvasView as CanvasViewLike).canvas : null;
        if (canvas?.nodes && canvas.nodes instanceof Map) {
            for (const [id, nodeData] of canvas.nodes) {
                if (nodeData?.nodeEl) {
                    nodeDomMap.set(id, nodeData);
                }
            }
        }
        return nodeDomMap;
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
        log(`[Node] 批量调整统计: 增加=${stats.increasedCount}, 减少=${stats.decreasedCount}, maxIncrease=${stats.maxIncrease.toFixed(1)}, maxDecrease=${stats.maxDecrease.toFixed(1)}, capped=${stats.cappedCount}, formula=${stats.formulaCount}`);
        log(`[Node] 高度来源统计: dom=${stats.sourceDomCount}, rendered=${stats.sourceRenderedCount}, file-trusted=${stats.sourceFileTrustedCount}, estimate=${stats.sourceEstimateCount}, zeroDom=${stats.sourceZeroDomCount}, sample=${stats.sourceSamples.join('|')}`);
    }
}
