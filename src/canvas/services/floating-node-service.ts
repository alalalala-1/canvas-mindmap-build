import { App } from 'obsidian';
import { FloatingNodeStateManager } from './floating-node-state-manager';
import { FloatingNodeStyleManager } from './floating-node-style-manager';
import { EdgeChangeDetector } from './edge-change-detector';
import { CanvasFileService } from './canvas-file-service';
import { info, warn, error } from '../../utils/logger';
import { CanvasMindmapBuildSettings } from '../../settings/types';
import { traceEnter, traceExit, traceError, traceStep } from '../../utils/function-tracer';

/**
 * 浮动节点服务
 * 整合状态管理、视觉样式和边变化检测
 * 提供统一的浮动节点管理接口
 */
export class FloatingNodeService {
    private app: App;
    private canvasFileService: CanvasFileService;
    private stateManager: FloatingNodeStateManager;
    private styleManager: FloatingNodeStyleManager;
    private edgeDetector: EdgeChangeDetector;
    private currentCanvasFilePath: string | null = null;
    private canvas: any = null; // 缓存当前 canvas 对象

    constructor(app: App, settings: CanvasMindmapBuildSettings) {
        this.app = app;
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
        traceEnter('FloatingNodeService', 'initialize', canvasFilePath, { edgeCount: canvas?.edges?.size || canvas?.edges?.length || 0 });

        this.canvas = canvas; // 保存 canvas 对象引用

        // 如果已经在同一个 canvas 上初始化，跳过
        if (this.currentCanvasFilePath === canvasFilePath) {
            traceStep('FloatingNodeService', 'initialize', '跳过重复初始化', { currentCanvasFilePath: this.currentCanvasFilePath });
            traceExit('FloatingNodeService', 'initialize', 'skipped');
            return;
        }

        traceStep('FloatingNodeService', 'initialize', '开始初始化', { canvasFilePath });
        this.currentCanvasFilePath = canvasFilePath;

        // 初始化状态缓存
        await this.stateManager.initializeCache(canvasFilePath);

        // 1. 重新应用所有浮动节点的样式（只应用当前 Canvas 中存在的节点）
        traceStep('FloatingNodeService', 'initialize', '重新应用浮动节点样式');
        await this.reapplyAllFloatingStyles(canvas);

        // 2. 启动边变化检测
        traceStep('FloatingNodeService', 'initialize', '启动边变化检测');
        this.startEdgeDetection(canvas);

        traceStep('FloatingNodeService', 'initialize', '初始化完成');
        traceExit('FloatingNodeService', 'initialize');
    }

    /**
     * 清理资源
     */
    cleanup(): void {
        info('[FloatingNodeService] 清理资源');
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
        const filePath = canvasFilePath || this.currentCanvasFilePath;
        if (!filePath) {
            warn('[FloatingNodeService] 未初始化，无法标记浮动节点');
            return false;
        }

        info(`[FloatingNodeService] 标记节点 ${nodeId} 及其子树 [${subtreeIds.join(',')}] 为浮动状态`);

        // 1. 如果有 canvas 对象，优先使用内存更新方式，避免与 EdgeDeletionService 的原子写入冲突
        if (this.canvas) {
            info(`[FloatingNodeService] 使用 Canvas 对象内存更新浮动状态: ${nodeId}`);
            const allNodeIds = [nodeId, ...subtreeIds];
            let modified = false;
            const timestamp = Date.now();

            for (const id of allNodeIds) {
                const node = this.canvas.nodes.get(id);
                if (node) {
                    if (!node.data) node.data = {};
                    node.data.isFloating = true;
                    node.data.originalParent = originalParentId;
                    node.data.floatingTimestamp = timestamp;
                    node.data.isSubtreeNode = id !== nodeId;
                    modified = true;
                }
                // 更新内存缓存
                this.stateManager.updateMemoryCache(filePath, id, {
                    isFloating: true,
                    originalParent: originalParentId,
                    floatingTimestamp: timestamp,
                    isSubtreeNode: id !== nodeId
                });
            }

            if (modified) {
                if (typeof this.canvas.requestSave === 'function') {
                    this.canvas.requestSave();
                } else if (typeof this.canvas.requestFrame === 'function') {
                    this.canvas.requestFrame();
                }
            }

            // 视觉样式
            this.styleManager.applyFloatingStyle(nodeId);
            for (const id of subtreeIds) {
                this.styleManager.applyFloatingStyle(id);
            }

            // 关键修复：不再这里直接调用 stateManager.markNodeAsFloating 进行异步文件写入
            // 因为 Obsidian 的 requestSave() 会负责将 node.data 的变更（isFloating 等）持久化到文件。
            // 直接进行文件写入会产生竞争条件，导致新连的边在文件保存时被旧数据覆盖（即“连线连两次”问题）。
            info(`[FloatingNodeService] 已通过内存更新标记浮动状态，等待 Obsidian 自动持久化`);

            return true;
        }

        // 2. 回退到直接文件操作
        const success = await this.stateManager.markNodeAsFloating(
            nodeId,
            originalParentId,
            filePath,
            subtreeIds
        );

        // 3. 应用视觉样式 (所有节点都变红框)
        if (success) {
            this.styleManager.applyFloatingStyle(nodeId);
            for (const id of subtreeIds) {
                this.styleManager.applyFloatingStyle(id);
            }
        }

        return success;
    }

    /**
     * 清除节点的浮动状态（支持子树批量清除）
     */
    async clearNodeFloatingState(nodeId: string, clearSubtree: boolean = true): Promise<boolean> {
        if (!this.currentCanvasFilePath) {
            warn('[FloatingNodeService] 未初始化，无法清除浮动状态');
            return false;
        }

        info(`[FloatingNodeService] 清除节点 ${nodeId} 的浮动状态${clearSubtree ? '（包括其子树）' : ''}`);

        const nodesToClear = [nodeId];
        if (clearSubtree) {
            // 获取所有以该节点为父节点的浮动节点（即子树节点）
            const subtreeChildren = this.getFloatingChildren(nodeId);
            nodesToClear.push(...subtreeChildren);
        }

        // 1. 清除视觉样式 (立即执行，确保用户反馈)
        for (const id of nodesToClear) {
            this.styleManager.clearFloatingStyle(id);
        }

        // 2. 更新内存缓存
        for (const id of nodesToClear) {
            this.stateManager.updateMemoryCache(this.currentCanvasFilePath, id, null);
        }

        // 3. 如果有 canvas 对象，优先使用内存更新方式（更安全，不冲突）
        if (this.canvas) {
            info(`[FloatingNodeService] 使用 Canvas 对象内存更新状态: ${nodesToClear.join(', ')}`);
            let modified = false;
            
            for (const id of nodesToClear) {
                const node = this.canvas.nodes.get(id);
                if (node && node.data && node.data.isFloating) {
                    delete node.data.isFloating;
                    delete node.data.originalParent;
                    delete node.data.floatingTimestamp;
                    delete node.data.isSubtreeNode;
                    modified = true;
                }
            }

            if (modified) {
                // 触发 Obsidian 保存
                if (typeof this.canvas.requestSave === 'function') {
                    this.canvas.requestSave();
                } else if (typeof this.canvas.requestFrame === 'function') {
                    this.canvas.requestFrame();
                }
            }
            
            // 关键修复：不再这里直接调用 stateManager.clearNodeFloatingState 进行文件写入
            // 因为 handleNewEdge 触发时，Obsidian 的新边可能还没写入文件，
            // 这里的原子写入（读取->修改->写入）会因为读取到旧文件内容而导致新边丢失（即“连线连两次”问题）。
            // 既然已经修改了 node.data 并调用了 requestSave，Obsidian 会负责将状态持久化到文件。
            
            info(`[FloatingNodeService] 已通过内存更新清除状态，等待 Obsidian 自动持久化`);
            return true;
        }

        // 4. 回退到直接文件操作
        let allSuccess = true;
        for (const id of nodesToClear) {
            const success = await this.stateManager.clearNodeFloatingState(
                id,
                this.currentCanvasFilePath
            );
            if (!success) allSuccess = false;
        }

        return allSuccess;
    }

    /**
     * 处理新边（当检测到新边时调用）
     */
    async handleNewEdge(edge: any): Promise<void> {
        const toNodeId = edge?.to?.node?.id || edge?.toNode;
        const fromNodeId = edge?.from?.node?.id || edge?.fromNode;

        traceEnter('FloatingNodeService', 'handleNewEdge', { fromNodeId, toNodeId, currentCanvasFilePath: this.currentCanvasFilePath });

        if (!this.currentCanvasFilePath) {
            traceStep('FloatingNodeService', 'handleNewEdge', '未初始化，跳过');
            traceExit('FloatingNodeService', 'handleNewEdge', 'not_initialized');
            return;
        }

        if (!toNodeId) {
            traceStep('FloatingNodeService', 'handleNewEdge', '新边没有目标节点');
            traceExit('FloatingNodeService', 'handleNewEdge', 'no_target');
            return;
        }

        traceStep('FloatingNodeService', 'handleNewEdge', '检查目标节点', { toNodeId });

        // 检查目标节点是否是浮动节点
        const isToNodeFloating = await this.stateManager.isNodeFloating(
            toNodeId,
            this.currentCanvasFilePath
        );

        if (isToNodeFloating) {
            traceStep('FloatingNodeService', 'handleNewEdge', '目标节点是浮动节点，清除状态', { toNodeId });
            // 立即清除状态（包含子树）
            // 连线后红框自动清除
            await this.clearNodeFloatingState(toNodeId, true);
        }

        // 检查源节点是否是浮动节点
        if (fromNodeId) {
            const isFromNodeFloating = await this.stateManager.isNodeFloating(
                fromNodeId,
                this.currentCanvasFilePath
            );
            if (isFromNodeFloating) {
                traceStep('FloatingNodeService', 'handleNewEdge', '源节点是浮动节点，清除状态', { fromNodeId });
                await this.clearNodeFloatingState(fromNodeId, true);
            }
        }

        traceStep('FloatingNodeService', 'handleNewEdge', '处理完成');
        traceExit('FloatingNodeService', 'handleNewEdge');
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

        const floatingNodes = await this.stateManager.getAllFloatingNodes(
            this.currentCanvasFilePath
        );

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

        info(`[FloatingNodeService] 重新应用 ${validFloatingNodes.length} 个浮动节点的样式（${connectedFloatingNodes.length} 个有入边需清除，${invalidFloatingNodes.length} 个不存在）`);

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

        info(`[FloatingNodeService] 清理 ${nodeIds.length} 个有入边的浮动节点状态`);
        for (const nodeId of nodeIds) {
            await this.clearNodeFloatingState(nodeId);
        }
    }

    /**
     * 清理不存在的浮动节点记录
     */
    private async cleanupInvalidFloatingNodes(nodeIds: string[]): Promise<void> {
        if (!this.currentCanvasFilePath) return;

        info(`[FloatingNodeService] 清理 ${nodeIds.length} 个不存在的浮动节点记录`);
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
