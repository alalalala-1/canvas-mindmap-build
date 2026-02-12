import { App, TFile } from 'obsidian';
import { log } from '../../utils/logger';
import { CanvasFileService } from './canvas-file-service';
import { FloatingNodeRecord, FloatingNodesMetadata, CanvasEdgeLike } from '../types';

export class FloatingNodeStateManager {
    private app: App;
    private canvasFileService: CanvasFileService;
    private floatingNodesCache: Map<string, Map<string, FloatingNodeRecord>> = new Map();
    private isInitialized: Map<string, boolean> = new Map();

    constructor(app: App, canvasFileService: CanvasFileService) {
        this.app = app;
        this.canvasFileService = canvasFileService;
    }

    /**
     * 初始化缓存
     */
    async initializeCache(canvasFilePath: string, force: boolean = false): Promise<void> {
        if (!force && this.isInitialized.get(canvasFilePath)) return;
        
        if (force) {
            log(`[FloatingState] 强制刷新缓存: ${canvasFilePath}`);
            this.isInitialized.delete(canvasFilePath);
            this.floatingNodesCache.delete(canvasFilePath);
        }
        
        await this.getAllFloatingNodes(canvasFilePath);
        this.isInitialized.set(canvasFilePath, true);
    }

    // =========================================================================
    // 状态存储
    // =========================================================================

    /**
     * 标记节点为浮动状态
     * 同时更新内存和文件
     * 注意：只标记根节点，子树节点有入边，不应被标记为浮动
     */
    async markNodeAsFloating(
        nodeId: string,
        originalParentId: string,
        canvasFilePath: string,
        _subtreeIds: string[] = []
    ): Promise<boolean> {
        try {
            log(`[FloatingState] 标记节点为浮动: ${nodeId}, 原父节点: ${originalParentId}`);
            const timestamp = Date.now();
            const floatingData = {
                isFloating: true,
                originalParent: originalParentId,
                floatingTimestamp: timestamp
            };
            this.updateMemoryCache(canvasFilePath, nodeId, floatingData);

            return await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (canvasData) => {
                let modified = false;

                if (!canvasData.metadata) canvasData.metadata = {};
                if (!canvasData.metadata.floatingNodes) canvasData.metadata.floatingNodes = {};
                
                const floatingNodes = canvasData.metadata.floatingNodes as FloatingNodesMetadata;
                const existingMeta = floatingNodes[nodeId] as FloatingNodeRecord | boolean | undefined;
                const existingOriginalParent = typeof existingMeta === 'object' ? existingMeta.originalParent : undefined;
                
                if (!existingMeta || existingOriginalParent !== originalParentId) {
                    floatingNodes[nodeId] = {
                        isFloating: true,
                        originalParent: originalParentId
                    };
                    modified = true;
                    log(`[FloatingState] 更新 metadata.floatingNodes`);
                }

                if (canvasData.nodes) {
                    const nodeData = canvasData.nodes.find(n => n.id === nodeId);
                    if (nodeData) {
                        if (!nodeData.data) nodeData.data = {};
                        if (nodeData.data.isFloating !== true || nodeData.data.originalParent !== originalParentId) {
                            nodeData.data.isFloating = true;
                            nodeData.data.originalParent = originalParentId;
                            nodeData.data.floatingTimestamp = timestamp;
                            modified = true;
                            log(`[FloatingState] 更新 node.data`);
                        }
                    } else {
                        log(`[FloatingState] 警告: 未找到节点 ${nodeId} 在 canvas 数据中`);
                    }
                }

                log(`[FloatingState] 标记回调返回 modified=${modified}`);
                return modified;
            });
        } catch (err) {
            log('[FloatingState] 标记失败', err);
            return false;
        }
    }

    /**
     * 清除节点的浮动状态
     * 同时更新内存和文件
     */
    async clearNodeFloatingState(
        nodeId: string,
        canvasFilePath: string,
        clearSubtree: boolean = false
    ): Promise<boolean> {
        try {
            const nodesToClear = [nodeId];
            if (clearSubtree) {
                // 如果需要清除子树，我们需要先找到所有相关的浮动节点
                const canvasCache = this.floatingNodesCache.get(canvasFilePath);
                if (canvasCache) {
                    for (const [id, data] of canvasCache.entries()) {
                        if (data.originalParent === nodeId) {
                            nodesToClear.push(id);
                        }
                    }
                }
            }

            // 1. 更新内存缓存
            for (const id of nodesToClear) {
                this.updateMemoryCache(canvasFilePath, id, null);
            }

            // 2. 原子化修改文件
            return await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (canvasData) => {
                let modified = false;

                for (const id of nodesToClear) {
                    // 1. 清除 metadata 中的标记
                    if (canvasData.metadata?.floatingNodes?.[id]) {
                        delete canvasData.metadata.floatingNodes[id];
                        modified = true;
                    }

                    // 2. 清除节点 data 属性中的标记
                    if (canvasData.nodes) {
                        const nodeData = canvasData.nodes.find(n => n.id === id);
                        if (nodeData?.data?.isFloating) {
                            delete nodeData.data.isFloating;
                            delete nodeData.data.originalParent;
                            delete nodeData.data.floatingTimestamp;
                            delete nodeData.data.isSubtreeNode;
                            modified = true;
                        }
                    }
                }

                if (modified && canvasData.metadata?.floatingNodes && Object.keys(canvasData.metadata.floatingNodes).length === 0) {
                    delete canvasData.metadata.floatingNodes;
                }

                return modified;
            });
        } catch (err) {
            log('[FloatingState] 清除失败', err);
            return false;
        }
    }

    public updateMemoryCache(canvasFilePath: string, nodeId: string, data: FloatingNodeRecord | null): void {
        let canvasCache = this.floatingNodesCache.get(canvasFilePath);
        if (!canvasCache) {
            canvasCache = new Map();
            this.floatingNodesCache.set(canvasFilePath, canvasCache);
        }
        
        if (data === null) {
            canvasCache.delete(nodeId);
        } else {
            canvasCache.set(nodeId, data);
        }
    }

    async getAllFloatingNodes(canvasFilePath: string): Promise<Map<string, FloatingNodeRecord>> {
        if (this.isInitialized.get(canvasFilePath) && this.floatingNodesCache.has(canvasFilePath)) {
            return this.floatingNodesCache.get(canvasFilePath)!;
        }

        const floatingNodes = new Map<string, any>();

        try {
            const canvasFile = this.app.vault.getAbstractFileByPath(canvasFilePath);
            if (!(canvasFile instanceof TFile)) {
                return floatingNodes;
            }

            const canvasContent = await this.app.vault.read(canvasFile);
            const canvasData = JSON.parse(canvasContent);

            log(`[FloatingState] 读取文件: ${canvasFilePath}, nodes=${canvasData.nodes?.length || 0}, metadata=${canvasData.metadata ? 'exists' : 'null'}`);

            // 从节点 data 属性读取
            if (canvasData.nodes && Array.isArray(canvasData.nodes)) {
                for (const node of canvasData.nodes) {
                    if (node.data?.isFloating) {
                        log(`[FloatingState] 从 node.data 找到浮动节点: ${node.id}`);
                        floatingNodes.set(node.id, {
                            isFloating: true,
                            originalParent: node.data.originalParent,
                            floatingTimestamp: node.data.floatingTimestamp,
                            isSubtreeNode: node.data.isSubtreeNode
                        });
                    }
                }
            }

            // 从 metadata 读取补充
            const metadataFloatingNodes = canvasData.metadata?.floatingNodes || {};
            const metaCount = Object.keys(metadataFloatingNodes).length;
            if (metaCount > 0) {
                log(`[FloatingState] metadata.floatingNodes 数量: ${metaCount}`);
            }
            for (const [nodeId, data] of Object.entries(metadataFloatingNodes)) {
                if (!floatingNodes.has(nodeId)) {
                    log(`[FloatingState] 从 metadata 找到浮动节点: ${nodeId}`);
                    floatingNodes.set(nodeId, data as any);
                }
            }

            log(`[FloatingState] 从文件读取到浮动节点数: ${floatingNodes.size}`);

            // 更新缓存
            this.floatingNodesCache.set(canvasFilePath, floatingNodes);
            this.isInitialized.set(canvasFilePath, true);
        } catch (err) {
            // 只有解析 JSON 失败才记录 log，避免文件不存在等常规情况的日志爆炸
            if (err instanceof SyntaxError) {
                log('[FloatingNodeState] 解析 JSON 失败:', canvasFilePath);
            }
        }

        return floatingNodes;
    }

    /**
     * 获取指定父节点关联的所有浮动子节点ID
     */
    getFloatingChildren(canvasFilePath: string, parentId: string): string[] {
        const canvasCache = this.floatingNodesCache.get(canvasFilePath);
        if (!canvasCache) return [];

        const children: string[] = [];
        for (const [nodeId, data] of canvasCache.entries()) {
            if (data.originalParent === parentId) {
                children.push(nodeId);
            }
        }
        return children;
    }

    /**
     * 检查节点是否是浮动节点
     */
    async isNodeFloating(nodeId: string, canvasFilePath: string): Promise<boolean> {
        await this.initializeCache(canvasFilePath);
        const canvasCache = this.floatingNodesCache.get(canvasFilePath);
        const data = canvasCache?.get(nodeId);
        const isFloating = data?.isFloating === true;
        
        if (isFloating) {
            log(`[FloatingState] 节点状态查询: ${nodeId} = 浮动 (原父节点: ${data?.originalParent})`);
        }
        
        return isFloating;
    }

    /**
     * 仅从内存缓存检查节点是否是浮动节点（不触发文件读取）
     * 用于边创建事件处理，避免读取旧文件数据
     */
    isNodeFloatingFromCache(nodeId: string, canvasFilePath: string): boolean {
        const canvasCache = this.floatingNodesCache.get(canvasFilePath);
        if (!canvasCache) {
            log(`[FloatingState] 内存缓存不存在: ${canvasFilePath}`);
            return false;
        }
        const data = canvasCache.get(nodeId);
        const isFloating = data?.isFloating === true;
        log(`[FloatingState] 内存缓存查询: ${nodeId} = ${isFloating}`);
        return isFloating;
    }

    /**
     * 获取浮动节点的原父节点
     */
    async getOriginalParent(nodeId: string, canvasFilePath: string): Promise<string | null> {
        const floatingNodes = await this.getAllFloatingNodes(canvasFilePath);
        const data = floatingNodes.get(nodeId);
        return data?.originalParent || null;
    }

    // =========================================================================
    // 批量操作
    // =========================================================================

    // 清除所有浮动节点状态（仅清除内存缓存）
    async clearAllFloatingStates(): Promise<boolean> {
        try {
            let totalNodes = 0;
            for (const canvasCache of this.floatingNodesCache.values()) {
                totalNodes += canvasCache.size;
            }

            if (totalNodes === 0) return true;

            this.floatingNodesCache.clear();
            this.isInitialized.clear();

            return true;
        } catch (err) {
            log('[FloatingNodeState] 清除所有浮动节点异常:', err);
            return false;
        }
    }

    async validateFloatingNodes(
        canvasFilePath: string,
        edges: CanvasEdgeLike[]
    ): Promise<string[]> {
        const clearedNodes: string[] = [];

        try {
            const floatingNodes = await this.getAllFloatingNodes(canvasFilePath);
            if (floatingNodes.size > 0) {
                log(`[FloatingState] 开始验证 ${floatingNodes.size} 个浮动节点...`);
            }

            for (const [nodeId, data] of floatingNodes) {
                const incomingEdges = edges.filter((edge) => {
                    const toId = typeof edge.to === 'string' 
                        ? edge.to 
                        : edge.to?.node?.id || edge.toNode;
                    return toId === nodeId;
                });

                if (incomingEdges.length > 0) {
                    log(`[FloatingState] 发现节点 ${nodeId} 有 ${incomingEdges.length} 条入边，清除浮动状态`);
                    await this.clearNodeFloatingState(nodeId, canvasFilePath);
                    clearedNodes.push(nodeId);
                }
            }
        } catch (err) {
            log('[FloatingState] 验证浮动节点失败:', err);
        }

        return clearedNodes;
    }
}
