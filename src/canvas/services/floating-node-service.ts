import { App } from 'obsidian';
import { FloatingNodeStateManager } from './floating-node-state-manager';
import { FloatingNodeStyleManager } from './floating-node-style-manager';
import { CanvasFileService } from './canvas-file-service';
import { EdgeChangeDetector } from './edge-change-detector';
import { log } from '../../utils/logger';
import { CONSTANTS } from '../../constants';
import { CanvasMindmapBuildSettings } from '../../settings/types';
import { CanvasLike, CanvasEdgeLike, CanvasNodeLike, ICanvasManager } from '../types';
import { getNodeFromCanvas, getEdgesFromCanvas, getEdgeToNodeId as getEdgeToNodeIdUtil, getEdgeFromNodeId as getEdgeFromNodeIdUtil } from '../../utils/canvas-utils';

export class FloatingNodeService {
    private canvasFileService: CanvasFileService;
    private stateManager: FloatingNodeStateManager;
    private styleManager: FloatingNodeStyleManager;
    private edgeDetector: EdgeChangeDetector;
    private currentCanvasFilePath: string | null = null;
    private canvas: CanvasLike | null = null;
    private canvasManager: ICanvasManager | null = null;
    private recentConnectedNodes: Map<string, number> = new Map();
    private edgeWatchTimeouts: Map<string, Set<number>> = new Map();
    private floatingNodeIds: Set<string> = new Set();
    private isClearingFloating: boolean = false;
    private pendingClearNodes: string[] = [];

    constructor(app: App, settings: CanvasMindmapBuildSettings) {
        this.canvasFileService = new CanvasFileService(app, settings);
        this.stateManager = new FloatingNodeStateManager(app, this.canvasFileService);
        this.styleManager = new FloatingNodeStyleManager();
        this.edgeDetector = new EdgeChangeDetector();
    }

    setCanvasManager(canvasManager: ICanvasManager): void {
        this.canvasManager = canvasManager;
    }

    /**
     * 从Canvas获取指定节点
     */
    private getNodeFromCanvas(nodeId: string): CanvasNodeLike | null {
        return getNodeFromCanvas(this.canvas, nodeId);
    }

    /**
     * 从Canvas获取所有边
     */
    private getEdgesFromCanvas(): CanvasEdgeLike[] {
        if (!this.canvas) return [];
        let edges = getEdgesFromCanvas(this.canvas);
        const fileEdges = this.canvas.fileData?.edges;
        if (fileEdges && fileEdges.length > edges.length) {
            edges = fileEdges;
        }
        return edges;
    }

    /**
     * 获取边的目标节点ID
     */
    private getEdgeToNodeId(edge: CanvasEdgeLike): string | null {
        return getEdgeToNodeIdUtil(edge);
    }

    /**
     * 检查节点是否有入边
     */
    private hasIncomingEdge(nodeId: string, edges: CanvasEdgeLike[]): boolean {
        return edges.some((edge) => {
            const toId = this.getEdgeToNodeId(edge);
            return toId === nodeId;
        });
    }

    /**
     * 获取Canvas中所有节点ID
     */
    private getCanvasNodeIds(canvas: CanvasLike | null | undefined): Set<string> {
        const nodeIds = new Set<string>();
        if (!canvas?.nodes) return nodeIds;
        
        if (canvas.nodes instanceof Map) {
            for (const nodeId of canvas.nodes.keys()) {
                if (nodeId) nodeIds.add(nodeId);
            }
        } else if (Array.isArray(canvas.nodes)) {
            for (const node of canvas.nodes) {
                if (node?.id) nodeIds.add(node.id);
            }
        } else if (typeof canvas.nodes === 'object') {
            for (const nodeId of Object.keys(canvas.nodes)) {
                nodeIds.add(nodeId);
            }
        }
        
        return nodeIds;
    }

    // =========================================================================
    // 初始化
    // =========================================================================

    /**
     * 为 Canvas 初始化浮动节点服务
     */
    async initialize(canvasFilePath: string, canvas: CanvasLike): Promise<void> {
        log(`[FloatingNode] initialize 被调用: canvasFilePath=${canvasFilePath}, canvas=${canvas ? 'exists' : 'null'}`);
        
        this.canvas = canvas;
        this.styleManager.setCanvas(canvas);

        if (this.currentCanvasFilePath === canvasFilePath) {
            log(`[FloatingNode] 相同路径，重新初始化缓存并应用样式: ${canvasFilePath}`);
            await this.stateManager.initializeCache(canvasFilePath, true);
            await this.reapplyAllFloatingStyles(canvas);
            return;
        }

        log(`[FloatingNode] 开始初始化: ${canvasFilePath}`);
        this.currentCanvasFilePath = canvasFilePath;

        log(`[FloatingNode] 正在初始化缓存...`);
        await this.stateManager.initializeCache(canvasFilePath);
        log(`[FloatingNode] 缓存初始化完成`);

        log(`[FloatingNode] 正在重新应用浮动节点样式...`);
        await this.reapplyAllFloatingStyles(canvas);
        log(`[FloatingNode] 样式应用完成`);

        log(`[FloatingNode] 初始化完成: ${canvasFilePath}`);
        
        // 如果 canvas 节点数为0，延迟重试（canvas可能还没加载完）
        const nodeCount = this.getNodeCount(canvas);
        if (nodeCount === 0) {
            log(`[FloatingNode] Canvas 节点数为0，延迟500ms重试样式应用`);
            setTimeout(async () => {
                if (this.canvas) {
                    const retryNodeCount = this.getNodeCount(this.canvas);
                    log(`[FloatingNode] 重试时 Canvas 节点数: ${retryNodeCount}`);
                    if (retryNodeCount > 0) {
                        await this.reapplyAllFloatingStyles(this.canvas);
                    }
                }
            }, CONSTANTS.TIMING.RETRY_DELAY);
        }
    }

    private getNodeCount(canvas: CanvasLike | null): number {
        if (!canvas?.nodes) return 0;
        if (canvas.nodes instanceof Map) return canvas.nodes.size;
        if (Array.isArray(canvas.nodes)) return canvas.nodes.length;
        if (typeof canvas.nodes === 'object') return Object.keys(canvas.nodes).length;
        return 0;
    }

    /**
     * 清理资源
     */
    cleanup(): void {
        this.currentCanvasFilePath = null;
    }

    // =========================================================================
    // 核心操作
    // =========================================================================

    /**
     * 标记节点为浮动状态（支持子树批量标记）
     * @param nodeId 节点ID
     * @param originalParentId 原父节点ID
     * @param canvasFilePath 可选，Canvas文件路径。如果不提供，使用当前初始化的路径
     * @param subtreeIds 可选，子树节点ID列表
     */
    async markNodeAsFloating(
        nodeId: string,
        originalParentId: string,
        canvasFilePath?: string,
        subtreeIds: string[] = []
    ): Promise<boolean> {
        this.recentConnectedNodes.delete(nodeId);
        this.clearEdgeWatch(nodeId);
        log(`[FloatingNode] 标记浮动: ${nodeId} (子树: ${subtreeIds.length} 个)`);
        
        const filePath = canvasFilePath || this.currentCanvasFilePath;
        if (!filePath) {
            return false;
        }

        // 先更新内存缓存
        const timestamp = Date.now();
        this.stateManager.updateMemoryCache(filePath, nodeId, {
            isFloating: true,
            originalParent: originalParentId,
            floatingTimestamp: timestamp
        });

        // 持久化到文件（通过 stateManager）
        const persistSuccess = await this.stateManager.markNodeAsFloating(
            nodeId,
            originalParentId,
            filePath,
            subtreeIds
        );
        log(`[FloatingNode] 持久化浮动状态: ${nodeId}, success=${persistSuccess}`);

        // 更新 canvas 内存中的节点数据
        if (this.canvas) {
            const node = this.getNodeFromCanvas(nodeId);
            if (node) {
                if (!node.data) node.data = {};
                node.data.isFloating = true;
                node.data.originalParent = originalParentId;
                node.data.floatingTimestamp = timestamp;
            }

            if (typeof this.canvas.requestSave === 'function') {
                this.canvas.requestSave();
            }
        }

        // 应用样式
        this.styleManager.applyFloatingStyle(nodeId);
        this.addFloatingNodeId(nodeId);
        this.scheduleEdgeWatch(nodeId);

        return persistSuccess;
    }

    /**
     * 清除多个节点的浮动样式
     */
    private clearFloatingStyles(nodeIds: string[]): void {
        for (const id of nodeIds) {
            this.styleManager.clearFloatingStyle(id);
        }
    }

    /**
     * 清除内存中的浮动状态缓存
     */
    private clearFloatingMemory(filePath: string, nodeIds: string[]): void {
        for (const id of nodeIds) {
            this.stateManager.updateMemoryCache(filePath, id, null);
        }
    }

    /**
     * 清除Canvas节点数据中的浮动状态
     * @param nodeIds 节点ID列表
     * @param requestSave 是否请求保存文件
     * @param delay 保存延迟（毫秒），用于确保边数据已写入后再保存
     */
    private clearFloatingCanvasData(nodeIds: string[], requestSave: boolean = true, delay: number = 0): void {
        if (!this.canvas) return;
        for (const id of nodeIds) {
            const node = this.getNodeFromCanvas(id);
            if (node?.data) {
                delete node.data.isFloating;
                delete node.data.originalParent;
                delete node.data.floatingTimestamp;
                delete node.data.isSubtreeNode;
            }
        }
        if (requestSave && typeof this.canvas.requestSave === 'function') {
            if (delay > 0) {
                setTimeout(() => {
                    if (typeof this.canvas?.requestSave === 'function') {
                        this.canvas.requestSave();
                    }
                }, delay);
            } else {
                this.canvas.requestSave();
            }
        }
    }

    /**
     * 持久化清除浮动状态到文件
     */
    private async persistClearFloatingState(nodeId: string, clearSubtree: boolean): Promise<boolean> {
        if (!this.currentCanvasFilePath) {
            return false;
        }
        return await this.stateManager.clearNodeFloatingState(
            nodeId,
            this.currentCanvasFilePath,
            clearSubtree
        );
    }

    /**
     * 清除节点的浮动状态（支持子树批量清除）
     */
    async clearNodeFloatingState(nodeId: string, clearSubtree: boolean = true): Promise<boolean> {
        if (!this.currentCanvasFilePath) {
            return false;
        }

        const nodesToClear = [nodeId];
        if (clearSubtree) {
            const subtreeChildren = this.getFloatingChildren(nodeId);
            nodesToClear.push(...subtreeChildren);
        }

        if (nodesToClear.length > 0) {
            log(`[FloatingNode] 清除: ${nodeId} (共 ${nodesToClear.length} 个)`);
        }

        return await this.executeClearFloating(nodesToClear, true);
    }

    /**
     * 执行清除浮动状态的核心逻辑
     * @param nodesToClear 要清除的节点列表
     * @param persistToFile 是否持久化到文件
     */
    private async executeClearFloating(nodesToClear: string[], persistToFile: boolean): Promise<boolean> {
        if (!this.currentCanvasFilePath || nodesToClear.length === 0) {
            return false;
        }

        this.isClearingFloating = true;
        let persistSuccess = false;
        const primaryNodeId = nodesToClear[0];
        if (!primaryNodeId) {
            this.isClearingFloating = false;
            return false;
        }
 
        try {
            this.removeFloatingNodeIds(nodesToClear);
            this.clearFloatingStyles(nodesToClear);
            this.clearFloatingMemory(this.currentCanvasFilePath, nodesToClear);

            if (persistToFile) {
                persistSuccess = await this.persistClearFloatingState(primaryNodeId, false);
                this.clearFloatingCanvasData(nodesToClear, true, CONSTANTS.TIMING.RETRY_DELAY);
            } else {
                this.clearFloatingCanvasData(nodesToClear, false);
            }
 
            log(`[FloatingNode] 清除浮动完成: ${nodesToClear.length} 个节点, success=${persistSuccess}`);
        } finally {
            this.isClearingFloating = false;
 
            // 处理队列中等待的节点
            if (this.pendingClearNodes.length > 0) {
                const pending = [...this.pendingClearNodes];
                this.pendingClearNodes = [];
                log(`[FloatingNode] 处理队列中的待清除节点: ${pending.length} 个`);
 
                for (const nodeId of pending) {
                    const isStillFloating = await this.stateManager.isNodeFloatingFromCache(nodeId, this.currentCanvasFilePath);
                    if (isStillFloating) {
                        await this.executeClearFloating([nodeId], persistToFile);
                    }
                }
            }
        }
 
        return persistSuccess;
    }

    async clearFloatingMarks(node: CanvasNodeLike): Promise<void> {
        if (!node?.id || !this.currentCanvasFilePath) return;
        
        const nodeId = node.id;
        
        this.removeFloatingNodeIds([nodeId]);
        this.clearFloatingStyles([nodeId]);
        this.clearFloatingMemory(this.currentCanvasFilePath, [nodeId]);
        await this.stateManager.clearNodeFloatingState(nodeId, this.currentCanvasFilePath);
    }

    /**
     * 处理新边（当检测到新边时调用）
     * 注意：此方法在边创建时被调用，此时边可能还未保存到文件
     * 因此只更新内存状态，不触发文件操作
     */
    async handleNewEdge(edge: CanvasEdgeLike, persistToFile: boolean = false): Promise<void> {
        const toNodeId = getEdgeToNodeIdUtil(edge);
        const fromNodeId = getEdgeFromNodeIdUtil(edge);

        if (!toNodeId) {
            log(`[FloatingNode] 警告: 无法解析连线目标节点 ID`);
            return;
        }

        log(`[FloatingNode] 处理新连线: ${fromNodeId} -> ${toNodeId}`);

        if (!this.currentCanvasFilePath) {
            log(`[FloatingNode] 警告: currentCanvasFilePath 为空，无法处理连线`);
            return;
        }

        this.clearEdgeWatch(toNodeId);
        this.recentConnectedNodes.set(toNodeId, Date.now());

        // 1. 立即清除目标节点的视觉样式（入边消除红框）
        this.styleManager.clearFloatingStyle(toNodeId);

        // 2. 检查内存缓存中的浮动状态（不刷新缓存，避免读取旧文件数据）
        const isToNodeFloating = await this.stateManager.isNodeFloatingFromCache(toNodeId, this.currentCanvasFilePath);
        log(`[FloatingNode] 目标节点 ${toNodeId} 浮动状态(内存): ${isToNodeFloating}`);

        // 3. 如果目标节点是浮动节点，清除其浮动状态
        if (isToNodeFloating) {
            // 如果正在处理清除操作，将节点加入队列等待处理
            if (this.isClearingFloating) {
                log(`[FloatingNode] 正在处理清除操作，将节点 ${toNodeId} 加入队列等待`);
                if (!this.pendingClearNodes.includes(toNodeId)) {
                    this.pendingClearNodes.push(toNodeId);
                }
                return;
            }

            log(`[FloatingNode] 目标节点 ${toNodeId} 是浮动节点，正在清除状态...`);
            await this.executeClearFloating([toNodeId], persistToFile);
        }

        // 4. 检查源节点是否原本是浮动节点，如果是，保持其红框样式
        if (fromNodeId) {
            const isFromNodeFloating = await this.stateManager.isNodeFloatingFromCache(fromNodeId, this.currentCanvasFilePath);
            log(`[FloatingNode] 源节点 ${fromNodeId} 浮动状态(内存): ${isFromNodeFloating}`);
            if (isFromNodeFloating) {
                log(`[FloatingNode] 源节点 ${fromNodeId} 是浮动节点，新边作为出边，保持其红框样式`);
                this.styleManager.applyFloatingStyle(fromNodeId);
            }
        }

        // 5. 刷新折叠按钮（父节点可能需要显示折叠按钮）
        if (this.canvasManager) {
            log(`[FloatingNode] 新连线后刷新折叠按钮`);
            this.canvasManager.checkAndAddCollapseButtons();
        }
    }

    // =========================================================================
    // 边变化检测
    // =========================================================================

    /**
     * 手动触发边变化检测
     */
    forceEdgeDetection(canvas: CanvasLike): void {
        log(`[FloatingNode] 手动边检测触发`);
        const edges = this.getEdgesFromCanvas();
        log(`[FloatingNode] 当前边数: ${edges.length}`);
        
        // 检查所有边，确保折叠按钮状态正确
        this.canvasManager?.checkAndAddCollapseButtons();
        
        // 检查是否有新边需要处理
        for (const edge of edges) {
            const toNodeId = getEdgeToNodeIdUtil(edge);
            const fromNodeId = getEdgeFromNodeIdUtil(edge);
            if (toNodeId && this.currentCanvasFilePath) {
                // 检查目标节点是否是浮动节点
                const isFloating = this.floatingNodeIds.has(toNodeId) || this.stateManager.isNodeFloatingFromCache(toNodeId, this.currentCanvasFilePath);
                if (isFloating) {
                    log(`[FloatingNode] 检测到浮动节点的新入边: ${fromNodeId || 'unknown'} -> ${toNodeId}`);
                    void this.handleNewEdge(edge, false);
                }
            }
        }
    }

    // =========================================================================
    // 样式管理
    // =========================================================================

    /**
     * 重新应用所有浮动节点的样式
     * @param canvas 可选，Canvas 对象。如果提供，只应用当前 Canvas 中存在的节点
     */
    async reapplyAllFloatingStyles(canvas?: CanvasLike): Promise<void> {
        log(`[FloatingNode] reapplyAllFloatingStyles 被调用, currentCanvasFilePath=${this.currentCanvasFilePath || 'null'}`);
        
        if (canvas) {
            this.canvas = canvas;
            this.styleManager.setCanvas(canvas);
        }

        if (!this.currentCanvasFilePath) {
            log(`[FloatingNode] 警告: currentCanvasFilePath 为空，跳过样式应用`);
            return;
        }

        // 获取当前 Canvas 中的所有节点 ID
        const canvasNodeIds = this.getCanvasNodeIds(canvas);
        log(`[FloatingNode] Canvas 中节点数: ${canvasNodeIds.size}`);

        // 获取当前 Canvas 中的所有边（用于验证浮动节点是否真的有入边）
        const edges = this.getEdgesFromCanvas();
        log(`[FloatingNode] Canvas 中边数: ${edges.length}`);

        const floatingNodes = await this.stateManager.getAllFloatingNodes(
            this.currentCanvasFilePath
        );

        log(`[FloatingNode] 从状态管理器获取的浮动节点数: ${floatingNodes.size}`);
        if (floatingNodes.size > 0) {
            log(`[FloatingNode] 浮动节点列表: ${Array.from(floatingNodes.keys()).join(', ')}`);
        }

        // 过滤出当前 Canvas 中存在的浮动节点
        // 并验证它们是否真的没有入边（真正的浮动节点）
        const validFloatingNodes: string[] = [];
        const invalidFloatingNodes: string[] = [];
        const connectedFloatingNodes: string[] = [];

        // 1. 检查状态文件中的浮动节点
        for (const nodeId of floatingNodes.keys()) {
            // 检查节点是否在当前 Canvas 中
            if (!canvas || canvasNodeIds.has(nodeId)) {
                if (this.shouldSkipStyleApply(nodeId)) {
                    continue;
                }
                // 检查节点是否真的有入边
                if (this.hasIncomingEdge(nodeId, edges)) {
                    connectedFloatingNodes.push(nodeId);
                } else {
                    validFloatingNodes.push(nodeId);
                }
            } else {
                invalidFloatingNodes.push(nodeId);
            }
        }

        // 2. 补充检查内存中标记为浮动但可能还没写入文件的节点
        if (canvas?.nodes) {
            const nodes = canvas.nodes instanceof Map
                ? Array.from(canvas.nodes.values())
                : Array.isArray(canvas.nodes)
                    ? canvas.nodes
                    : [];
            
            for (const node of nodes) {
                if (node?.data?.isFloating && !validFloatingNodes.includes(node.id)) {
                    if (this.shouldSkipStyleApply(node.id)) {
                        continue;
                    }
                    if (!this.hasIncomingEdge(node.id, edges)) {
                        validFloatingNodes.push(node.id);
                    } else {
                        if (!connectedFloatingNodes.includes(node.id)) {
                            connectedFloatingNodes.push(node.id);
                        }
                    }
                }
            }
        }


        log(`[FloatingNode] 有效浮动节点: ${validFloatingNodes.length}, 有入边: ${connectedFloatingNodes.length}, 无效: ${invalidFloatingNodes.length}`);

        this.setFloatingNodeIds(validFloatingNodes);

        // 应用有效节点的样式
        for (const nodeId of validFloatingNodes) {
            log(`[FloatingNode] 正在应用样式到节点: ${nodeId}`);
            this.styleManager.applyFloatingStyle(nodeId);
        }
        log(`[FloatingNode] 样式应用完成，共 ${validFloatingNodes.length} 个节点`);

        // 清理有入边的浮动节点状态（异步执行，不阻塞）
        if (connectedFloatingNodes.length > 0) {
            log(`[FloatingNode] 清理有入边的浮动节点: ${connectedFloatingNodes.join(', ')}`);
            this.cleanupConnectedFloatingNodes(connectedFloatingNodes);
        }

        // 清理不存在的浮动节点记录（异步执行，不阻塞）
        if (invalidFloatingNodes.length > 0) {
            this.cleanupInvalidFloatingNodes(invalidFloatingNodes);
        }
    }

    /**
     * 清理有入边的浮动节点状态（它们不应该保持浮动状态）
     */
    private async cleanupConnectedFloatingNodes(nodeIds: string[]): Promise<void> {
        if (!this.currentCanvasFilePath) return;

        for (const nodeId of nodeIds) {
            await this.clearNodeFloatingState(nodeId);
        }
    }

    /**
     * 清理不存在的浮动节点记录
     */
    private async cleanupInvalidFloatingNodes(nodeIds: string[]): Promise<void> {
        if (!this.currentCanvasFilePath) return;

        for (const nodeId of nodeIds) {
            await this.stateManager.clearNodeFloatingState(nodeId, this.currentCanvasFilePath);
        }
    }

    /**
     * 应用单个节点的浮动样式
     */
    applyFloatingStyle(nodeId: string): void {
        this.styleManager.applyFloatingStyle(nodeId);
    }

    /**
     * 清除单个节点的浮动样式
     */
    clearFloatingStyle(nodeId: string): void {
        this.styleManager.clearFloatingStyle(nodeId);
    }

    // =========================================================================
    // 查询
    // =========================================================================

    /**
     * 检查节点是否是浮动节点
     */
    async isNodeFloating(nodeId: string): Promise<boolean> {
        if (!this.currentCanvasFilePath) return false;
        return await this.stateManager.isNodeFloating(
            nodeId,
            this.currentCanvasFilePath
        );
    }

    /**
     * 获取指定父节点的浮动子节点ID列表
     */
    getFloatingChildren(parentId: string): string[] {
        if (!this.currentCanvasFilePath) return [];
        return this.stateManager.getFloatingChildren(this.currentCanvasFilePath, parentId);
    }

    /**
     * 获取所有浮动节点
     */
    async getAllFloatingNodes(): Promise<Map<string, any>> {
        if (!this.currentCanvasFilePath) return new Map();
        return await this.stateManager.getAllFloatingNodes(
            this.currentCanvasFilePath
        );
    }

    private shouldSkipStyleApply(nodeId: string): boolean {
        const timestamp = this.recentConnectedNodes.get(nodeId);
        if (!timestamp) return false;
        const now = Date.now();
        if (now - timestamp > 3000) {
            this.recentConnectedNodes.delete(nodeId);
            return false;
        }
        return true;
    }

    private clearEdgeWatch(nodeId: string): void {
        const timeouts = this.edgeWatchTimeouts.get(nodeId);
        if (!timeouts) return;
        for (const timeoutId of timeouts) {
            window.clearTimeout(timeoutId);
        }
        this.edgeWatchTimeouts.delete(nodeId);
    }

    private scheduleEdgeWatch(nodeId: string): void {
        if (!this.canvas) return;
        if (this.edgeWatchTimeouts.has(nodeId)) return;
        const timeoutSet = new Set<number>();
        this.edgeWatchTimeouts.set(nodeId, timeoutSet);
        for (const delay of CONSTANTS.BUTTON_CHECK_INTERVALS) {
            const timeoutId = window.setTimeout(() => {
                const activeSet = this.edgeWatchTimeouts.get(nodeId);
                if (!activeSet || !activeSet.has(timeoutId)) return;
                activeSet.delete(timeoutId);
                if (activeSet.size === 0) {
                    this.edgeWatchTimeouts.delete(nodeId);
                }
                const edges = this.getEdgesFromCanvas();
                const matchedEdge = edges.find((edgeItem) => this.getEdgeToNodeId(edgeItem) === nodeId);
                if (matchedEdge) {
                    this.clearEdgeWatch(nodeId);
                    void this.handleNewEdge(matchedEdge, false);
                }
            }, delay);
            timeoutSet.add(timeoutId);
        }
    }

    private addFloatingNodeId(nodeId: string): void {
        this.floatingNodeIds.add(nodeId);
        this.updateEdgeDetection();
    }

    private removeFloatingNodeIds(nodeIds: string[]): void {
        let changed = false;
        for (const nodeId of nodeIds) {
            if (this.floatingNodeIds.delete(nodeId)) {
                changed = true;
            }
        }
        if (changed) {
            this.updateEdgeDetection();
        }
    }

    private setFloatingNodeIds(nodeIds: string[]): void {
        this.floatingNodeIds = new Set(nodeIds);
        this.updateEdgeDetection();
    }

    private updateEdgeDetection(canvasOverride?: CanvasLike): void {
        if (canvasOverride) {
            this.canvas = canvasOverride;
        }
        if (!this.canvas) return;
        if (this.floatingNodeIds.size === 0) {
            if (this.edgeDetector.isRunning()) {
                this.edgeDetector.stopDetection();
                log(`[FloatingNode] 边检测已停止（无浮动节点）`);
            }
            return;
        }
    }

    startEdgeDetectionWindow(canvas: CanvasLike): void {
        if (!canvas) return;
        this.canvas = canvas;
        if (this.floatingNodeIds.size === 0) return;
        if (this.edgeDetector.isRunning()) return;
        log(`[FloatingNode] 边检测已启动（窗口模式）`);
        this.edgeDetector.startDetection(
            canvas,
            (newEdges) => {
                for (const edge of newEdges) {
                    const toNodeId = getEdgeToNodeIdUtil(edge);
                    if (toNodeId && this.floatingNodeIds.has(toNodeId)) {
                        void this.handleNewEdge(edge, false);
                    }
                }
            },
            {
                interval: CONSTANTS.TIMING.EDGE_DETECTION_INTERVAL,
                maxChecks: 6
            }
        );
    }

    // =========================================================================
    // 验证
    // =========================================================================

    async validateFloatingNodes(edges: CanvasEdgeLike[]): Promise<string[]> {
        if (!this.currentCanvasFilePath) return [];

        const clearedNodes = await this.stateManager.validateFloatingNodes(
            this.currentCanvasFilePath,
            edges
        );

        for (const nodeId of clearedNodes) {
            this.styleManager.clearFloatingStyle(nodeId);
        }

        return clearedNodes;
    }
}
