import { App } from 'obsidian';
import { FloatingNodeStateManager } from './floating-node-state-manager';
import { FloatingNodeStyleManager } from './floating-node-style-manager';
import { EdgeChangeDetector } from './edge-change-detector';
import { CanvasFileService } from './canvas-file-service';
import { log } from '../../utils/logger';
import { CanvasMindmapBuildSettings } from '../../settings/types';

/**
 * 浮动节点服务
 * 整合状态管理、视觉样式和边变化检测
 * 提供统一的浮动节点管理接口
 */
export class FloatingNodeService {
    private canvasFileService: CanvasFileService;
    private stateManager: FloatingNodeStateManager;
    private styleManager: FloatingNodeStyleManager;
    private edgeDetector: EdgeChangeDetector;
    private currentCanvasFilePath: string | null = null;
    private canvas: any = null; // 缓存当前 canvas 对象

    constructor(app: App, settings: CanvasMindmapBuildSettings) {
        this.canvasFileService = new CanvasFileService(app, settings);
        this.stateManager = new FloatingNodeStateManager(app, this.canvasFileService);
        this.styleManager = new FloatingNodeStyleManager();
        this.edgeDetector = new EdgeChangeDetector();
    }

    // =========================================================================
    // 初始化
    // =========================================================================

    /**
     * 为 Canvas 初始化浮动节点服务
     */
    async initialize(canvasFilePath: string, canvas: any): Promise<void> {
        this.canvas = canvas;

        if (this.currentCanvasFilePath === canvasFilePath) {
            return;
        }

        log(`[FloatingNode] 初始化: ${canvasFilePath} (已修正)`);
        this.currentCanvasFilePath = canvasFilePath;

        await this.stateManager.initializeCache(canvasFilePath);

        await this.reapplyAllFloatingStyles(canvas);

        this.startEdgeDetection(canvas);
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

        if (this.canvas) {
            let modified = false;
            const timestamp = Date.now();

            const node = this.canvas.nodes.get(nodeId);
            if (node) {
                if (!node.data) node.data = {};
                node.data.isFloating = true;
                node.data.originalParent = originalParentId;
                node.data.floatingTimestamp = timestamp;
                modified = true;
            }
            this.stateManager.updateMemoryCache(filePath, nodeId, {
                isFloating: true,
                originalParent: originalParentId,
                floatingTimestamp: timestamp
            });

            if (modified) {
                if (typeof this.canvas.requestSave === 'function') {
                    this.canvas.requestSave();
                } else if (typeof this.canvas.requestFrame === 'function') {
                    this.canvas.requestFrame();
                }
            }

            this.styleManager.applyFloatingStyle(nodeId);

            return true;
        }

        const success = await this.stateManager.markNodeAsFloating(
            nodeId,
            originalParentId,
            filePath,
            []
        );

        if (success) {
            this.styleManager.applyFloatingStyle(nodeId);
        }

        return success;
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

        // 仅在实际需要清除时输出日志
        if (nodesToClear.length > 0) {
            log(`[FloatingNode] 清除: ${nodeId} (共 ${nodesToClear.length} 个)`);
        }

        for (const id of nodesToClear) {
            this.styleManager.clearFloatingStyle(id);
        }

        for (const id of nodesToClear) {
            this.stateManager.updateMemoryCache(this.currentCanvasFilePath, id, null);
        }

        if (this.canvas) {
            let modified = false;
            
            for (const id of nodesToClear) {
                const node = this.canvas.nodes.get(id);
                if (node?.data) {
                    delete node.data.isFloating;
                    delete node.data.originalParent;
                    delete node.data.floatingTimestamp;
                    delete node.data.isSubtreeNode;
                    modified = true;
                }
            }

            if (modified) {
                if (typeof this.canvas.requestSave === 'function') {
                    this.canvas.requestSave();
                }
            }
            return true;
        }

        return await this.stateManager.clearNodeFloatingState(nodeId, this.currentCanvasFilePath, clearSubtree);
    }

    /**
     * 清理节点相关的浮动标记（用于节点被彻底删除时）
     */
    async clearFloatingMarks(node: any): Promise<void> {
        if (!node?.id || !this.currentCanvasFilePath) return;
        
        const nodeId = node.id;
        
        // 1. 清除视觉样式
        this.styleManager.clearFloatingStyle(nodeId);
        
        // 2. 更新内存缓存
        this.stateManager.updateMemoryCache(this.currentCanvasFilePath, nodeId, null);
        
        // 3. 彻底从状态文件中移除记录
        await this.stateManager.clearNodeFloatingState(nodeId, this.currentCanvasFilePath);
    }

    /**
     * 处理新边（当检测到新边时调用）
     */
    async handleNewEdge(edge: any): Promise<void> {
        const toNodeId = edge?.to?.node?.id || edge?.toNode || 
                        (typeof edge?.to === 'string' ? edge.to : 
                         typeof edge?.to?.id === 'string' ? edge.to.id : null);
        const fromNodeId = edge?.from?.node?.id || edge?.fromNode || 
                          (typeof edge?.from === 'string' ? edge.from : 
                           typeof edge?.from?.id === 'string' ? edge.from.id : null);

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

        // 2. 强制刷新缓存并验证状态
        await this.stateManager.initializeCache(this.currentCanvasFilePath, true);

        // 3. 检查并清除目标节点状态
        const isToNodeFloating = await this.stateManager.isNodeFloating(toNodeId, this.currentCanvasFilePath);
        if (isToNodeFloating) {
            log(`[FloatingNode] 目标节点 ${toNodeId} 仍标记为浮动，正在清除状态...`);
            await this.clearNodeFloatingState(toNodeId, true);
        }

        // 4. 检查源节点是否原本是浮动节点，如果是，则它变成了一个子树的根或中间节点
        // 注意：不清除源节点的红框，除非它本身也有了入边
        if (fromNodeId) {
            const isFromNodeFloating = await this.stateManager.isNodeFloating(fromNodeId, this.currentCanvasFilePath);
            if (isFromNodeFloating) {
                log(`[FloatingNode] 源节点 ${fromNodeId} 是浮动节点，新边作为出边，保持其红框样式`);
                // 确保样式还在（以防万一被误删）
                this.styleManager.applyFloatingStyle(fromNodeId);
            }
        }

        // 5. 如果有 canvas 对象，触发一次全局验证（处理可能存在的状态不同步）
        if (this.canvas) {
            const edges = Array.from(this.canvas.edges?.values() || []);
            await this.validateFloatingNodes(edges);
        }
    }

    // =========================================================================
    // 边变化检测
    // =========================================================================

    /**
     * 启动边变化检测
     */
    private startEdgeDetection(canvas: any): void {
        this.edgeDetector.startDetection(
            canvas,
            async (newEdges) => {
                for (const edge of newEdges) {
                    await this.handleNewEdge(edge);
                }
            },
            { interval: 500, maxChecks: 0 } // 0 表示持续检测
        );
    }

    /**
     * 手动触发边变化检测
     */
    forceEdgeDetection(canvas: any): void {
        this.edgeDetector.forceCheck(canvas);
    }

    // =========================================================================
    // 样式管理
    // =========================================================================

    /**
     * 重新应用所有浮动节点的样式
     * @param canvas 可选，Canvas 对象。如果提供，只应用当前 Canvas 中存在的节点
     */
    async reapplyAllFloatingStyles(canvas?: any): Promise<void> {
        if (!this.currentCanvasFilePath) return;

        // 获取当前 Canvas 中的所有节点 ID
        const canvasNodeIds = new Set<string>();
        if (canvas?.nodes) {
            const nodes = canvas.nodes instanceof Map
                ? Array.from(canvas.nodes.keys())
                : Array.isArray(canvas.nodes)
                    ? canvas.nodes.map((n: any) => n.id)
                    : [];
            for (const nodeId of nodes) {
                if (nodeId) canvasNodeIds.add(nodeId);
            }
        }

        // 获取当前 Canvas 中的所有边（用于验证浮动节点是否真的有入边）
        const edges: any[] = [];
        if (canvas?.edges) {
            const edgeData = canvas.edges instanceof Map
                ? Array.from(canvas.edges.values())
                : Array.isArray(canvas.edges)
                    ? canvas.edges
                    : [];
            for (const edge of edgeData) {
                if (edge) edges.push(edge);
            }
        }

        const floatingNodes = await this.stateManager.getAllFloatingNodes(
            this.currentCanvasFilePath
        );

        if (floatingNodes.size > 0) {
            log(`[FloatingNode] 重新应用样式，当前记录数: ${floatingNodes.size}`);
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
                const hasIncomingEdge = edges.some((edge: any) => {
                    const toId = edge?.to?.node?.id || edge?.toNode || edge?.to;
                    // 处理可能出现的复杂对象或直接 ID
                    const actualToId = typeof toId === 'string' ? toId : toId?.id;
                    return actualToId === nodeId;
                });

                if (hasIncomingEdge) {
                    // 节点有入边，不应该保持浮动状态
                    connectedFloatingNodes.push(nodeId);
                } else {
                    // 节点没有入边，是真正的浮动节点
                    validFloatingNodes.push(nodeId);
                }
            } else {
                // 节点不在当前 Canvas 中
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
                    // 同样验证是否有入边
                    const hasIncomingEdge = edges.some((edge: any) => {
                        const toId = edge?.to?.node?.id || edge?.toNode || edge?.to;
                        const actualToId = typeof toId === 'string' ? toId : toId?.id;
                        return actualToId === node.id;
                    });
                    
                    if (!hasIncomingEdge) {
                        validFloatingNodes.push(node.id);
                    } else {
                        // 内存中标记为浮动但实际有入边，也需要清理
                        if (!connectedFloatingNodes.includes(node.id)) {
                            connectedFloatingNodes.push(node.id);
                        }
                    }
                }
            }
        }


        // 应用有效节点的样式
        for (const nodeId of validFloatingNodes) {
            this.styleManager.applyFloatingStyle(nodeId);
        }

        // 清理有入边的浮动节点状态（异步执行，不阻塞）
        if (connectedFloatingNodes.length > 0) {
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

    /**
     * 验证浮动节点状态
     * 如果浮动节点有入边，清除其状态
     */
    async validateFloatingNodes(edges: any[]): Promise<string[]> {
        if (!this.currentCanvasFilePath) return [];

        const clearedNodes = await this.stateManager.validateFloatingNodes(
            this.currentCanvasFilePath,
            edges
        );

        // 清除视觉样式
        for (const nodeId of clearedNodes) {
            this.styleManager.clearFloatingStyle(nodeId);
        }

        return clearedNodes;
    }
}
