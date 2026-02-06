import { App, TFile } from 'obsidian';
import { info, warn, error, debug } from '../../utils/logger';
import { CanvasFileService } from './canvas-file-service';

/**
 * 浮动节点状态管理器
 * 负责浮动节点状态的存储、读取、清除和持久化
 * 单一职责：状态管理，不涉及视觉样式
 */
export class FloatingNodeStateManager {
    private app: App;
    private canvasFileService: CanvasFileService;
    private floatingNodesCache: Map<string, Map<string, any>> = new Map(); // canvasPath -> (nodeId -> data)
    private isInitialized: Map<string, boolean> = new Map();

    constructor(app: App, canvasFileService: CanvasFileService) {
        this.app = app;
        this.canvasFileService = canvasFileService;
    }

    /**
     * 初始化缓存
     */
    async initializeCache(canvasFilePath: string): Promise<void> {
        if (this.isInitialized.get(canvasFilePath)) return;
        await this.getAllFloatingNodes(canvasFilePath);
        this.isInitialized.set(canvasFilePath, true);
    }

    // =========================================================================
    // 状态存储
    // =========================================================================

    /**
     * 标记节点为浮动状态（支持子树批量标记）
     * 同时更新内存和文件
     */
    async markNodeAsFloating(
        nodeId: string,
        originalParentId: string,
        canvasFilePath: string,
        subtreeIds: string[] = []
    ): Promise<boolean> {
        try {
            const allNodeIds = [nodeId, ...subtreeIds];
            info(`[FloatingNodeStateManager] 标记节点 ${nodeId} 及其子树 [${subtreeIds.join(',')}] 为浮动状态`);

            // 1. 更新内存缓存
            const timestamp = Date.now();
            for (const id of allNodeIds) {
                const floatingData = {
                    isFloating: true,
                    originalParent: originalParentId,
                    floatingTimestamp: timestamp,
                    isSubtreeNode: id !== nodeId // 标记是否是子树节点（非根部浮动节点）
                };
                this.updateMemoryCache(canvasFilePath, id, floatingData);
            }

            // 2. 原子化修改文件
            return await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (canvasData) => {
                let modified = false;

                // 在 metadata 中标记
                if (!canvasData.metadata) canvasData.metadata = {};
                if (!canvasData.metadata.floatingNodes) canvasData.metadata.floatingNodes = {};
                
                for (const id of allNodeIds) {
                    const existingMeta = canvasData.metadata.floatingNodes[id];
                    if (!existingMeta || existingMeta.originalParent !== originalParentId) {
                        canvasData.metadata.floatingNodes[id] = {
                            isFloating: true,
                            originalParent: originalParentId,
                            isSubtreeNode: id !== nodeId
                        };
                        modified = true;
                    }

                    // 在节点本身的 data 属性中标记
                    if (canvasData.nodes) {
                        const nodeData = canvasData.nodes.find((n: any) => n.id === id);
                        if (nodeData) {
                            if (!nodeData.data) nodeData.data = {};
                            if (nodeData.data.isFloating !== true || nodeData.data.originalParent !== originalParentId) {
                                nodeData.data.isFloating = true;
                                nodeData.data.originalParent = originalParentId;
                                nodeData.data.floatingTimestamp = timestamp;
                                nodeData.data.isSubtreeNode = id !== nodeId;
                                modified = true;
                            }
                        }
                    }
                }

                return modified;
            });
        } catch (err) {
            error('[FloatingNodeStateManager] 标记浮动节点失败:', err);
            return false;
        }
    }

    /**
     * 清除节点的浮动状态
     * 同时更新内存和文件
     */
    async clearNodeFloatingState(
        nodeId: string,
        canvasFilePath: string
    ): Promise<boolean> {
        try {
            info(`[FloatingNodeStateManager] 准备清除节点 ${nodeId} 的浮动状态`);

            // 1. 更新内存缓存
            this.updateMemoryCache(canvasFilePath, nodeId, null);

            // 2. 原子化修改文件
            return await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (canvasData) => {
                let modified = false;

                // 1. 清除 metadata 中的标记
                if (canvasData.metadata?.floatingNodes?.[nodeId]) {
                    delete canvasData.metadata.floatingNodes[nodeId];
                    if (Object.keys(canvasData.metadata.floatingNodes).length === 0) {
                        delete canvasData.metadata.floatingNodes;
                    }
                    modified = true;
                }

                // 2. 清除节点 data 属性中的标记
                if (canvasData.nodes) {
                    const nodeData = canvasData.nodes.find((n: any) => n.id === nodeId);
                    if (nodeData?.data?.isFloating) {
                        delete nodeData.data.isFloating;
                        delete nodeData.data.originalParent;
                        delete nodeData.data.floatingTimestamp;
                        delete nodeData.data.isSubtreeNode;
                        modified = true;
                    }
                }

                return modified;
            });
        } catch (err) {
            error('[FloatingNodeStateManager] 清除浮动节点状态失败:', err);
            return false;
        }
    }

    /**
     * 辅助方法：更新内存缓存
     */
    public updateMemoryCache(canvasFilePath: string, nodeId: string, data: any | null): void {
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

    // =========================================================================
    // 状态读取
    // =========================================================================

    /**
     * 获取所有浮动节点
     * 优先从缓存读取
     */
    async getAllFloatingNodes(canvasFilePath: string): Promise<Map<string, any>> {
        // 如果已经有缓存且已初始化，直接返回
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

            // 从节点 data 属性读取
            if (canvasData.nodes && Array.isArray(canvasData.nodes)) {
                for (const node of canvasData.nodes) {
                    if (node.data?.isFloating) {
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
            for (const [nodeId, data] of Object.entries(metadataFloatingNodes)) {
                if (!floatingNodes.has(nodeId)) {
                    floatingNodes.set(nodeId, data);
                }
            }

            // 更新缓存
            this.floatingNodesCache.set(canvasFilePath, floatingNodes);
            this.isInitialized.set(canvasFilePath, true);
        } catch (err) {
            error('[FloatingNodeStateManager] 读取浮动节点失败:', err);
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
        return canvasCache?.get(nodeId)?.isFloating === true;
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

    /**
     * 清除所有浮动节点的状态
     */
    async clearAllFloatingNodes(canvasFilePath: string): Promise<void> {
        try {
            const floatingNodes = await this.getAllFloatingNodes(canvasFilePath);
            info(`[FloatingNodeStateManager] 清除所有 ${floatingNodes.size} 个浮动节点的状态`);

            for (const nodeId of floatingNodes.keys()) {
                await this.clearNodeFloatingState(nodeId, canvasFilePath);
            }
        } catch (err) {
            error('[FloatingNodeStateManager] 清除所有浮动节点失败:', err);
        }
    }

    /**
     * 验证浮动节点状态（检查是否真的有入边）
     * 如果浮动节点有入边，说明它已经不是浮动节点，清除其状态
     */
    async validateFloatingNodes(
        canvasFilePath: string,
        edges: any[]
    ): Promise<string[]> {
        const clearedNodes: string[] = [];

        try {
            const floatingNodes = await this.getAllFloatingNodes(canvasFilePath);

            for (const [nodeId, data] of floatingNodes) {
                // 检查是否有边连接到该节点
                const hasIncomingEdge = edges.some((edge: any) => {
                    const toId = edge?.to?.node?.id || edge?.toNode ||
                                (typeof edge.to === 'string' ? edge.to : null);
                    return toId === nodeId;
                });

                // 如果有入边，说明不是浮动节点，清除状态
                if (hasIncomingEdge) {
                    info(`[FloatingNodeStateManager] 节点 ${nodeId} 有入边，清除浮动状态`);
                    await this.clearNodeFloatingState(nodeId, canvasFilePath);
                    clearedNodes.push(nodeId);
                }
            }
        } catch (err) {
            error('[FloatingNodeStateManager] 验证浮动节点失败:', err);
        }

        return clearedNodes;
    }
}
