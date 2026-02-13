import { App } from 'obsidian';
import { FloatingNodeStateManager } from './floating-node-state-manager';
import { FloatingNodeStyleManager } from './floating-node-style-manager';
import { EdgeChangeDetector, NewEdgeCallback } from './edge-change-detector';
import { CanvasFileService } from './canvas-file-service';
import { log } from '../../utils/logger';
import { CONSTANTS } from '../../constants';
import { CanvasMindmapBuildSettings } from '../../settings/types';
import { CanvasLike, CanvasEdgeLike, CanvasNodeLike, ICanvasManager } from '../types';
import { getNodeFromCanvas, getEdgesFromCanvas, getEdgeToNodeId as getEdgeToNodeIdUtil } from '../../utils/canvas-utils';

export class FloatingNodeService {
    private canvasFileService: CanvasFileService;
    private stateManager: FloatingNodeStateManager;
    private styleManager: FloatingNodeStyleManager;
    private edgeDetector: EdgeChangeDetector;
    private currentCanvasFilePath: string | null = null;
    private canvas: CanvasLike | null = null;
    private canvasManager: ICanvasManager | null = null;

    constructor(app: App, settings: CanvasMindmapBuildSettings) {
        this.canvasFileService = new CanvasFileService(app, settings);
        this.stateManager = new FloatingNodeStateManager(app, this.canvasFileService);
        this.styleManager = new FloatingNodeStyleManager();
        this.edgeDetector = new EdgeChangeDetector();
    }

    setCanvasManager(canvasManager: ICanvasManager): void {
        this.canvasManager = canvasManager;
    }

    private getNodeFromCanvas(nodeId: string): CanvasNodeLike | null {
        return getNodeFromCanvas(this.canvas, nodeId);
    }

    private getEdgesFromCanvas(): CanvasEdgeLike[] {
        return getEdgesFromCanvas(this.canvas);
    }

    private getEdgeToNodeId(edge: CanvasEdgeLike): string | null {
        return getEdgeToNodeIdUtil(edge);
    }

    private hasIncomingEdge(nodeId: string, edges: CanvasEdgeLike[]): boolean {
        return edges.some((edge) => {
            const toId = this.getEdgeToNodeId(edge);
            return toId === nodeId;
        });
    }

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
            this.startEdgeDetection(canvas);
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

        this.startEdgeDetection(canvas);
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
        this.edgeDetector.stopDetection();
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

        return persistSuccess;
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

        // 1. 清除样式
        for (const id of nodesToClear) {
            this.styleManager.clearFloatingStyle(id);
        }

        // 2. 更新内存缓存
        for (const id of nodesToClear) {
            this.stateManager.updateMemoryCache(this.currentCanvasFilePath, id, null);
        }

        // 3. 持久化到文件（通过 stateManager）
        const persistSuccess = await this.stateManager.clearNodeFloatingState(
            nodeId, 
            this.currentCanvasFilePath, 
            clearSubtree
        );
        log(`[FloatingNode] 持久化清除浮动状态: ${nodeId}, success=${persistSuccess}`);

        // 4. 更新 canvas 内存中的节点数据
        if (this.canvas) {
            for (const id of nodesToClear) {
                const node = this.getNodeFromCanvas(id);
                if (node?.data) {
                    delete node.data.isFloating;
                    delete node.data.originalParent;
                    delete node.data.floatingTimestamp;
                    delete node.data.isSubtreeNode;
                }
            }

            if (typeof this.canvas.requestSave === 'function') {
                this.canvas.requestSave();
            }
        }

        return persistSuccess;
    }

    async clearFloatingMarks(node: CanvasNodeLike): Promise<void> {
        if (!node?.id || !this.currentCanvasFilePath) return;
        
        const nodeId = node.id;
        
        this.styleManager.clearFloatingStyle(nodeId);
        
        this.stateManager.updateMemoryCache(this.currentCanvasFilePath, nodeId, null);
        
        await this.stateManager.clearNodeFloatingState(nodeId, this.currentCanvasFilePath);
    }

    /**
     * 处理新边（当检测到新边时调用）
     * 注意：此方法在边创建时被调用，此时边可能还未保存到文件
     * 因此只更新内存状态，不触发文件操作
     */
    async handleNewEdge(edge: CanvasEdgeLike): Promise<void> {
        let toNodeId: string | null = null;
        let fromNodeId: string | null = null;
        
        if (typeof edge?.to === 'string') {
            toNodeId = edge.to;
        } else if (edge?.to?.node?.id) {
            toNodeId = edge.to.node.id;
        } else if (edge?.toNode) {
            toNodeId = edge.toNode;
        }
        
        if (typeof edge?.from === 'string') {
            fromNodeId = edge.from;
        } else if (edge?.from?.node?.id) {
            fromNodeId = edge.from.node.id;
        } else if (edge?.fromNode) {
            fromNodeId = edge.fromNode;
        }

        if (!toNodeId) {
            log(`[FloatingNode] 警告: 无法解析连线目标节点 ID`);
            return;
        }

        log(`[FloatingNode] 处理新连线: ${fromNodeId} -> ${toNodeId}`);

        if (!this.currentCanvasFilePath) {
            log(`[FloatingNode] 警告: currentCanvasFilePath 为空，无法处理新连线`);
            return;
        }

        // 1. 立即清除目标节点的视觉样式（入边消除红框）
        this.styleManager.clearFloatingStyle(toNodeId);

        // 2. 检查内存缓存中的浮动状态（不刷新缓存，避免读取旧文件数据）
        const isToNodeFloating = await this.stateManager.isNodeFloatingFromCache(toNodeId, this.currentCanvasFilePath);
        log(`[FloatingNode] 目标节点 ${toNodeId} 浮动状态(内存): ${isToNodeFloating}`);

        // 3. 如果目标节点是浮动节点，清除其浮动状态（仅内存）
        if (isToNodeFloating) {
            log(`[FloatingNode] 目标节点 ${toNodeId} 是浮动节点，正在清除状态（仅内存）...`);
            // 只更新内存缓存，不触发文件修改
            this.stateManager.updateMemoryCache(this.currentCanvasFilePath, toNodeId, null);
            // 更新 canvas 内存中的节点数据
            if (this.canvas) {
                const node = this.getNodeFromCanvas(toNodeId);
                if (node) {
                    if (!node.data) node.data = {};
                    delete node.data.isFloating;
                    delete node.data.originalParent;
                    delete node.data.floatingTimestamp;
                    delete node.data.isSubtreeNode;
                    log(`[FloatingNode] 已清除 canvas 内存中的浮动数据: ${toNodeId}`);
                }
            }
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
     * 启动边变化检测
     */
    private startEdgeDetection(canvas: CanvasLike): void {
        const callback: NewEdgeCallback = async (newEdges) => {
            for (const edge of newEdges) {
                await this.handleNewEdge(edge);
            }
        };
        this.edgeDetector.startDetection(canvas, callback, { interval: 500, maxChecks: 0 });
    }

    /**
     * 手动触发边变化检测
     */
    forceEdgeDetection(canvas: CanvasLike): void {
        this.edgeDetector.forceCheck(canvas);
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
