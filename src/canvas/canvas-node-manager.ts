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
import { CanvasLike, CanvasNodeLike, ICanvasManager, CanvasViewLike, HeightMeta } from './types';

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
                    const isManual = heightMeta.manualHeight === true;

                    // 5. 判定是否需要修复
                    let shouldRepair = false;
                    let repairReason = '';

                    // 场景A: 高度极小（可能是之前的 DOM=0 错误写入）
                    if (currentHeight < 20) {
                        shouldRepair = true;
                        repairReason = 'too_small';
                    }
                    // 场景B: 非手动调整，且偏差过大 (>20% 且 >20px)
                    else if (!isManual) {
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

                        // 重置 manualHeight，因为这显然不是用户想要的“正确”手动值
                        if (isManual && currentHeight < 20) {
                            heightMeta.manualHeight = false;
                        }

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

            let adjustedCount = 0;
            let increasedCount = 0;
            let decreasedCount = 0;
            let cappedCount = 0;
            let formulaCount = 0;
            let maxIncrease = 0;
            let maxDecrease = 0;
            let missingDomCount = 0;
            let manualKeepCount = 0;
            let manualSetCount = 0;
            let manualResetCount = 0;
            let sourceDomCount = 0;
            let sourceRenderedCount = 0;
            let sourceEstimateCount = 0;
            let sourceZeroDomCount = 0;
            let sourceFileTrustedCount = 0;
            let sourceSampleCount = 0;
            const sourceSamples: string[] = [];
            let zeroDomOverrideCount = 0;
            let zeroDomOverrideSampleCount = 0;
            const zeroDomOverrideSamples: string[] = [];

            const textDimensions = this.nodeTypeService.getTextDimensions();
            const maxHeight = textDimensions.maxHeight;
            const formulaDimensions = this.nodeTypeService.getFormulaDimensions();

            let updatePass = 0;
            await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, async (canvasData) => {
                updatePass += 1;
                if (!canvasData.nodes) return false;

                let changed = false;

                const logDetail = updatePass === 1;

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

                const getTextSignature = (content: string, width: number): string => {
                    let hash = 0;
                    for (let i = 0; i < content.length; i++) {
                        hash = (hash * 31 + content.charCodeAt(i)) >>> 0;
                    }
                    return `${content.length}:${hash}:${width}`;
                };

                for (const node of canvasData.nodes) {
                    if (!node.type || node.type === 'text') {
                        if (node.text) {
                            const isFormula = this.nodeTypeService.isFormula(node.text);

                            let newHeight: number;
                            if (isFormula) {
                                formulaCount++;
                                newHeight = formulaDimensions.height;
                                node.width = formulaDimensions.width;
                                if (!node.data || typeof node.data !== 'object') {
                                    node.data = {};
                                }
                                const heightMeta = (node.data as { heightMeta?: HeightMeta }).heightMeta || {};
                                heightMeta.manualHeight = false;
                                heightMeta.lastWidth = node.width;
                                heightMeta.lastAutoHeight = newHeight;
                                heightMeta.lastSignature = getTextSignature(node.text, node.width);
                                (node.data as { heightMeta?: HeightMeta }).heightMeta = heightMeta;
                                log(`[Node.perNode] id=${node.id} formula: newH=${newHeight}`);
                            } else {
                                const width = typeof node.width === 'number' && node.width > 0
                                    ? node.width
                                    : textDimensions.width;
                                if (!node.width || node.width <= 0) {
                                    node.width = width;
                                }

                                // === DOM可见性检测 ===  
                                const domNode = nodeDomMap.get(node.id || '');
                                const nodeEl = domNode?.nodeEl;
                                
                                // [关键修复] 使用DOM测量（包括minHeight），无论是否虚拟化
                                // 传入文件历史高度以启用智能验证机制
                                const heightInfo = await this.nodeHeightService.calculateTextNodeHeightInfoAsync(
                                    node.text,
                                    nodeEl,
                                    width,
                                    logDetail,
                                    node.height  // 传入历史高度进行智能验证
                                );
                                newHeight = heightInfo.height;

                                // 统计来源（file-trusted 单独统计）
                                if (heightInfo.source === 'dom') sourceDomCount++;
                                else if (heightInfo.source === 'rendered') sourceRenderedCount++;
                                else if (heightInfo.source === 'zero-dom') sourceZeroDomCount++;
                                else if (heightInfo.source === 'file-trusted') sourceFileTrustedCount++;
                                else sourceEstimateCount++;

                                if (sourceSampleCount < 8 && Math.abs(heightInfo.height - (node.height ?? 0)) > 1) {
                                    sourceSamples.push(`${node.id}:${heightInfo.source} ${node.height ?? 0}->${heightInfo.height}`);
                                    sourceSampleCount++;
                                }
                                
                                // 更新元数据（简化版）
                                if (!node.data || typeof node.data !== 'object') {
                                    node.data = {};
                                }
                                const heightMeta = (node.data as { heightMeta?: HeightMeta }).heightMeta || {};
                                const signature = getTextSignature(node.text, width);
                                heightMeta.lastSignature = signature;
                                heightMeta.lastWidth = width;
                                heightMeta.lastAutoHeight = newHeight;
                                heightMeta.manualHeight = false; // SSOT: 移除手动高度概念
                                (node.data as { heightMeta?: HeightMeta }).heightMeta = heightMeta;
                                
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
                    // 强制重绘所有边，确保它们连接到正确的高度
                    if (canvas.edges) {
                        const edgesArray = canvas.edges instanceof Map
                            ? Array.from(canvas.edges.values())
                            : Array.isArray(canvas.edges)
                                ? canvas.edges
                                : [];
                        for (const edge of edgesArray) {
                            if (typeof (edge as any).render === 'function') {
                                (edge as any).render();
                            }
                        }
                    }
                    
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
            log(`[Node] 批量调整统计: 增加=${increasedCount}, 减少=${decreasedCount}, maxIncrease=${maxIncrease.toFixed(1)}, maxDecrease=${maxDecrease.toFixed(1)}, capped=${cappedCount}, formula=${formulaCount}, missingDom=${missingDomCount}, manualKeep=${manualKeepCount}, manualSet=${manualSetCount}, manualReset=${manualResetCount}`);
            log(`[Node] 高度来源统计: dom=${sourceDomCount}, rendered=${sourceRenderedCount}, file-trusted=${sourceFileTrustedCount}, estimate=${sourceEstimateCount}, zeroDom=${sourceZeroDomCount}, sample=${sourceSamples.join('|')}`);
            if (zeroDomOverrideCount > 0) {
                log(`[Node] DOM0高度清洗: count=${zeroDomOverrideCount}, sample=${zeroDomOverrideSamples.join('|')}`);
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

    public calculateTextNodeHeight(content: string, nodeEl?: Element, nodeWidthOverride?: number): number {
        return this.nodeHeightService.calculateTextNodeHeight(content, nodeEl, nodeWidthOverride);
    }
}
