import { App, ItemView, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../settings/types';
import { CanvasUIManager } from './canvas-ui-manager';
import { debug, info, warn, error } from '../utils/logger';

export class FloatingNodeManager {
    private app: App;
    private settings: CanvasMindmapBuildSettings;

    constructor(app: App, settings: CanvasMindmapBuildSettings) {
        this.app = app;
        this.settings = settings;
    }

    // =========================================================================
    // 标记节点为浮动状态（红色边框）- 标记整个浮动子树
    // 将标志存储在节点本身的 data 属性中，确保持久化
    // =========================================================================
    async markNodeAsFloating(nodeId: string, canvas: any, originalParentId: string): Promise<void> {
        try {
            // 获取所有边数据用于构建子树
            let edges: any[] = [];
            if (canvas.fileData?.edges) edges = canvas.fileData.edges;
            if (canvas.edges) edges = Array.from(canvas.edges.values());

            // 递归收集整个子树的所有节点
            const floatingSubtreeNodes = new Set<string>();
            this.collectNodeSubtree(nodeId, edges, floatingSubtreeNodes);

            // 立即应用红色边框样式（只应用到目标节点，子节点不加红框）
            this.applyFloatingNodeStyle(nodeId, canvas);

            // 在文件中将整个子树标记为浮动状态
            const canvasFilePath = this.getCurrentCanvasFilePath();
            if (canvasFilePath) {
                const canvasFile = this.app.vault.getAbstractFileByPath(canvasFilePath);
                if (canvasFile instanceof TFile) {
                    const canvasContent = await this.app.vault.read(canvasFile);
                    const canvasData = JSON.parse(canvasContent);

                    // 1. 在 metadata 中标记整个子树为浮动状态（向后兼容）
                    if (!canvasData.metadata) canvasData.metadata = {};
                    if (!canvasData.metadata.floatingNodes) canvasData.metadata.floatingNodes = {};
                    
                    // 2. 在节点本身的 data 属性中标记（确保持久化到节点）
                    if (!canvasData.nodes) canvasData.nodes = [];
                    
                    for (const subtreeNodeId of floatingSubtreeNodes) {
                        // 只有根节点设置原父节点，子节点不设置
                        const isRoot = subtreeNodeId === nodeId;
                        
                        // metadata 标记（向后兼容）
                        canvasData.metadata.floatingNodes[subtreeNodeId] = {
                            isFloating: true,
                            originalParent: isRoot ? originalParentId : undefined
                        };
                        
                        // 节点本身 data 属性标记（主要持久化方式）
                        const nodeData = canvasData.nodes.find((n: any) => n.id === subtreeNodeId);
                        if (nodeData) {
                            if (!nodeData.data) nodeData.data = {};
                            nodeData.data.isFloating = true;
                            if (isRoot) {
                                nodeData.data.originalParent = originalParentId;
                            }
                            nodeData.data.floatingTimestamp = Date.now();
                        }
                    }

                    // 保存文件
                    await this.app.vault.modify(canvasFile, JSON.stringify(canvasData, null, 2));
                    info(`已将浮动子树 (${floatingSubtreeNodes.size} 个节点) 标记为浮动状态，原父节点: ${originalParentId}`);
                    
                    // 同时更新内存中的 canvas 数据，确保后续操作能立即看到更新
                    if (canvas) {
                        if (!canvas.fileData) canvas.fileData = {};
                        if (!canvas.fileData.metadata) canvas.fileData.metadata = {};
                        if (!canvas.fileData.metadata.floatingNodes) canvas.fileData.metadata.floatingNodes = {};
                        
                        for (const subtreeNodeId of floatingSubtreeNodes) {
                            canvas.fileData.metadata.floatingNodes[subtreeNodeId] = {
                                isFloating: true,
                                originalParent: originalParentId
                            };
                        }
                        info(`已同步更新内存中的浮动节点数据`);
                    }
                }
            }

        } catch (err) {
            error('标记浮动节点失败:', err);
        }
    }

    // =========================================================================
    // 递归收集节点子树
    // =========================================================================
    private collectNodeSubtree(nodeId: string, edges: any[], subtreeNodes: Set<string>) {
        if (subtreeNodes.has(nodeId)) return;
        
        subtreeNodes.add(nodeId);
        
        // 找到所有直接子节点
        const children = this.getChildNodes(nodeId, edges);
        for (const childId of children) {
            this.collectNodeSubtree(childId, edges, subtreeNodes);
        }
    }

    // =========================================================================
    // 获取子节点
    // =========================================================================
    private getChildNodes(parentId: string, edges: any[]): string[] {
        const children: string[] = [];
        for (const edge of edges) {
            const fromId = edge.from?.node?.id || edge.fromNode;
            const toId = edge.to?.node?.id || edge.toNode;
            if (fromId === parentId && toId) {
                children.push(toId);
            }
        }
        return children;
    }

    // =========================================================================
    // 查找节点的原父节点
    // =========================================================================
    private findOriginalParent(nodeId: string, edges: any[]): string | null {
        for (const edge of edges) {
            const fromId = edge.from?.node?.id || edge.fromNode;
            const toId = edge.to?.node?.id || edge.toNode;
            if (toId === nodeId && fromId) {
                return fromId;
            }
        }
        return null;
    }

    // =========================================================================
    // 应用浮动节点样式（红色边框）
    // =========================================================================
    private applyFloatingNodeStyle(nodeId: string, canvas: any): void {
        // 使用 CanvasUIManager 来应用样式，确保 data-node-id 属性已设置
        const canvasView = this.getCanvasView();
        if (canvasView) {
            const uiManager = new CanvasUIManager(this.app, this.settings, null as any);
            uiManager.applyFloatingNodeStyle(nodeId);
        } else {
            // 回退到直接查找DOM元素
            const nodeEl = this.findNodeElementById(nodeId, canvas);
            if (nodeEl) {
                // 检查是否已经是浮动样式，避免重复应用
                if (nodeEl.style.border === '4px solid rgb(255, 68, 68)') {
                    return;
                }
                nodeEl.style.border = '4px solid #ff4444';
                nodeEl.style.borderRadius = '8px';
                info(`已为节点 ${nodeId} 应用浮动样式`);
            } else {
                // 如果找不到，延迟后重试（只重试一次）
                setTimeout(() => {
                    const retryNodeEl = this.findNodeElementById(nodeId, canvas);
                    if (retryNodeEl && retryNodeEl.style.border !== '4px solid rgb(255, 68, 68)') {
                        retryNodeEl.style.border = '4px solid #ff4444';
                        retryNodeEl.style.borderRadius = '8px';
                        info(`已为节点 ${nodeId} 应用浮动样式（延迟）`);
                    }
                }, 500);
            }
        }
    }

    // =========================================================================
    // 清除浮动节点样式
    // =========================================================================
    clearFloatingNodeStyle(nodeId: string, canvas: any): void {
        info(`[clearFloatingNodeStyle] 开始清除节点 ${nodeId} 的浮动样式`);
        
        // 方法1: 直接使用 data-node-id 属性选择器（最可靠的方法）
        let nodeEl = document.querySelector(`.canvas-node[data-node-id="${nodeId}"]`) as HTMLElement;
        info(`[clearFloatingNodeStyle] 方法1 (data-node-id选择器): ${nodeEl ? '找到' : '未找到'}`);
        
        // 方法2: 如果没找到，尝试从 canvas.nodes 获取
        if (!nodeEl && canvas?.nodes) {
            const node = canvas.nodes.get(nodeId);
            if (node?.nodeEl) {
                nodeEl = node.nodeEl as HTMLElement;
                info(`[clearFloatingNodeStyle] 方法2 (canvas.nodes): 找到节点 ${nodeId}`);
            } else {
                info(`[clearFloatingNodeStyle] 方法2 (canvas.nodes): 未找到`);
            }
        }
        
        // 方法3: 最后尝试：遍历所有 canvas-node 元素
        if (!nodeEl) {
            const allNodeEls = document.querySelectorAll('.canvas-node');
            info(`[clearFloatingNodeStyle] 方法3 (遍历DOM): 总共有 ${allNodeEls.length} 个 canvas-node 元素`);
            for (const el of Array.from(allNodeEls)) {
                const dataNodeId = el.getAttribute('data-node-id');
                if (dataNodeId === nodeId) {
                    nodeEl = el as HTMLElement;
                    info(`[clearFloatingNodeStyle] 方法3 (遍历DOM): 找到节点 ${nodeId}`);
                    break;
                }
            }
        }
        
        if (nodeEl) {
            // 清除前记录当前样式
            const beforeBorder = nodeEl.style.border;
            info(`[clearFloatingNodeStyle] 清除前样式: border="${beforeBorder}"`);
            
            // 清除所有可能的样式
            nodeEl.style.border = '';
            nodeEl.style.borderRadius = '';
            nodeEl.style.boxShadow = '';
            nodeEl.classList.remove('cmb-floating-node');
            
            // 强制浏览器重新渲染以确保样式生效
            // 通过读取 offsetHeight 触发重绘
            void nodeEl.offsetHeight;
            
            // 清除后记录样式
            const afterBorder = nodeEl.style.border;
            info(`[clearFloatingNodeStyle] 清除后样式: border="${afterBorder}"`);
            
            info(`[clearFloatingNodeStyle] 已清除节点 ${nodeId} 的浮动样式`);
        } else {
            warn(`[clearFloatingNodeStyle] 未找到节点 ${nodeId} 的DOM元素，无法清除浮动样式`);
        }
    }

    // =========================================================================
    // 根据节点 ID 查找 DOM 元素
    // =========================================================================
    private findNodeElementById(nodeId: string, canvas: any): HTMLElement | null {
        // 方法1: 直接使用 data-node-id 属性选择器
        const nodeEl = document.querySelector(`.canvas-node[data-node-id="${nodeId}"]`) as HTMLElement;
        if (nodeEl) {
            return nodeEl;
        }

        // 方法2: 获取 canvas 对象，从 canvas.nodes 中获取 nodeEl
        if (canvas?.nodes) {
            const node = canvas.nodes.get(nodeId);
            if (node?.nodeEl) {
                return node.nodeEl as HTMLElement;
            }
        }

        // 方法3: 遍历所有 .canvas-node 元素，使用 getNodeIdFromElement 匹配
        const allNodeEls = document.querySelectorAll('.canvas-node');
        for (const el of Array.from(allNodeEls)) {
            const id = this.getNodeIdFromElement(el, canvas);
            if (id === nodeId) {
                return el as HTMLElement;
            }
        }

        return null;
    }

    // =========================================================================
    // 从元素获取节点ID
    // =========================================================================
    private getNodeIdFromElement(el: Element, canvas: any): string | null {
        const dataNodeId = el.getAttribute('data-node-id');
        if (dataNodeId) return dataNodeId;

        if (canvas?.nodes) {
            const nodes = Array.from(canvas.nodes.values()) as any[];
            for (const node of nodes) {
                if (node.nodeEl === el || el.contains(node.nodeEl)) {
                    return node.id;
                }
            }
        }

        const idMatch = el.className.match(/[a-zA-Z0-9]{8,}/);
        if (idMatch) return idMatch[0];

        return null;
    }

    // =========================================================================
    // 检查节点是否有入边
    // =========================================================================
    checkNodeHasIncomingEdge(nodeId: string, canvas: any): boolean {
        if (!canvas?.edges) return false;
        
        const edges = canvas.edges instanceof Map ? Array.from(canvas.edges.values()) :
                     Array.isArray(canvas.edges) ? canvas.edges : [];
        
        for (const edge of edges) {
            const toNodeId = this.getNodeIdFromEdgeEndpoint(edge?.to);
            if (toNodeId === nodeId) {
                return true;
            }
        }
        
        return false;
    }

    // =========================================================================
    // 检查节点是否有出边
    // =========================================================================
    checkNodeHasOutgoingEdge(nodeId: string, canvas: any): boolean {
        if (!canvas?.edges) return false;
        
        const edges = canvas.edges instanceof Map ? Array.from(canvas.edges.values()) :
                     Array.isArray(canvas.edges) ? canvas.edges : [];
        
        for (const edge of edges) {
            const fromNodeId = this.getNodeIdFromEdgeEndpoint(edge?.from);
            if (fromNodeId === nodeId) {
                return true;
            }
        }
        
        return false;
    }

    // =========================================================================
    // 从边的端点获取节点 ID
    // =========================================================================
    private getNodeIdFromEdgeEndpoint(endpoint: any): string | null {
        if (!endpoint) return null;
        if (typeof endpoint === 'string') return endpoint;
        if (typeof endpoint.nodeId === 'string') return endpoint.nodeId;
        if (endpoint.node && typeof endpoint.node.id === 'string') return endpoint.node.id;
        return null;
    }

    // =========================================================================
    // 检查新添加的边，清除目标节点的浮动状态
    // 从 metadata 和节点 data 属性中读取浮动节点标志
    // =========================================================================
    async checkAndClearFloatingStateForNewEdges(canvas: any): Promise<void> {
        info('[checkAndClearFloatingStateForNewEdges] 开始检查新边的浮动状态');
        if (!canvas?.edges) {
            info('[checkAndClearFloatingStateForNewEdges] canvas.edges 不存在');
            return;
        }

        // 获取当前所有边
        const edges = canvas.edges instanceof Map ? Array.from(canvas.edges.values()) :
                     Array.isArray(canvas.edges) ? canvas.edges : [];
        info(`[checkAndClearFloatingStateForNewEdges] 当前有 ${edges.length} 条边`);

        // 获取浮动节点列表
        const canvasFilePath = this.getCurrentCanvasFilePath();
        info(`[checkAndClearFloatingStateForNewEdges] canvasFilePath=${canvasFilePath || 'undefined'}`);
        
        // 收集浮动节点（从 metadata 和节点 data 属性）
        const floatingNodesMap = new Map<string, any>();
        
        if (!canvasFilePath) {
            // 如果无法获取文件路径，尝试从 canvas.fileData 中读取
            if (canvas.fileData?.metadata?.floatingNodes) {
                info('[checkAndClearFloatingStateForNewEdges] 从内存中读取浮动节点');
                Object.entries(canvas.fileData.metadata.floatingNodes).forEach(([id, data]) => {
                    floatingNodesMap.set(id, data);
                });
            }
            // 也从节点 data 属性读取
            if (canvas.fileData?.nodes) {
                for (const node of canvas.fileData.nodes) {
                    if (node.data?.isFloating) {
                        floatingNodesMap.set(node.id, {
                            isFloating: true,
                            originalParent: node.data.originalParent
                        });
                    }
                }
            }
        } else {
            try {
                const canvasFile = this.app.vault.getAbstractFileByPath(canvasFilePath);
                if (!(canvasFile instanceof TFile)) {
                    info('[checkAndClearFloatingStateForNewEdges] 无法获取 canvas 文件');
                    return;
                }

                const canvasContent = await this.app.vault.read(canvasFile);
                const canvasData = JSON.parse(canvasContent);
                
                // 1. 从 metadata 读取（向后兼容）
                const floatingNodes = canvasData.metadata?.floatingNodes || {};
                Object.entries(floatingNodes).forEach(([id, data]) => {
                    floatingNodesMap.set(id, data);
                });
                
                // 2. 从节点 data 属性读取（主要方式）
                if (canvasData.nodes && Array.isArray(canvasData.nodes)) {
                    for (const node of canvasData.nodes) {
                        if (node.data?.isFloating) {
                            floatingNodesMap.set(node.id, {
                                isFloating: true,
                                originalParent: node.data.originalParent
                            });
                        }
                    }
                }
                
                info(`[checkAndClearFloatingStateForNewEdges] 文件中有 ${floatingNodesMap.size} 个浮动节点记录`);
            } catch (err) {
                error('读取浮动节点时出错:', err);
                return;
            }
        }

        // 检查每条边的源节点和目标节点是否是浮动节点
        for (const edge of edges) {
            const fromNodeId = this.getNodeIdFromEdgeEndpoint(edge?.from);
            const toNodeId = this.getNodeIdFromEdgeEndpoint(edge?.to);
            info(`[checkAndClearFloatingStateForNewEdges] 检查边: ${fromNodeId} -> ${toNodeId}`);

            // 检查源节点
            if (fromNodeId && floatingNodesMap.has(fromNodeId)) {
                const data = floatingNodesMap.get(fromNodeId);
                let isFloating = false;
                if (typeof data === 'boolean') {
                    isFloating = data;
                } else if (typeof data === 'object' && data !== null) {
                    isFloating = data.isFloating;
                }

                if (isFloating) {
                    info(`[checkAndClearFloatingStateForNewEdges] 检测到新边从浮动节点 ${fromNodeId} 发出，清除浮动状态`);
                    await this.clearFloatingNodeState(fromNodeId, canvas);
                }
            }

            // 检查目标节点
            if (toNodeId && floatingNodesMap.has(toNodeId)) {
                const data = floatingNodesMap.get(toNodeId);
                let isFloating = false;
                if (typeof data === 'boolean') {
                    isFloating = data;
                } else if (typeof data === 'object' && data !== null) {
                    isFloating = data.isFloating;
                }

                if (isFloating) {
                    info(`检测到新边连接到浮动节点 ${toNodeId}，清除浮动状态`);
                    await this.clearFloatingNodeState(toNodeId, canvas);
                }
            }
        }
    }

    // =========================================================================
    // 从内存数据中检查并清除浮动状态（备选方法）
    // =========================================================================
    private async checkAndClearFromMemory(canvas: any, floatingNodes: any): Promise<void> {
        if (!canvas?.edges) return;

        const edges = canvas.edges instanceof Map ? Array.from(canvas.edges.values()) :
                     Array.isArray(canvas.edges) ? canvas.edges : [];

        for (const edge of edges) {
            const fromNodeId = this.getNodeIdFromEdgeEndpoint(edge?.from);
            const toNodeId = this.getNodeIdFromEdgeEndpoint(edge?.to);

            // 检查源节点
            if (fromNodeId && floatingNodes[fromNodeId] !== undefined) {
                let isFloating = false;
                if (typeof floatingNodes[fromNodeId] === 'boolean') {
                    isFloating = floatingNodes[fromNodeId];
                } else if (typeof floatingNodes[fromNodeId] === 'object' && floatingNodes[fromNodeId] !== null) {
                    isFloating = floatingNodes[fromNodeId].isFloating;
                }

                if (isFloating) {
                    info(`[内存] 检测到新边从浮动节点 ${fromNodeId} 发出，清除浮动状态`);
                    await this.clearFloatingNodeState(fromNodeId, canvas);
                }
            }

            // 检查目标节点
            if (toNodeId && floatingNodes[toNodeId] !== undefined) {
                let isFloating = false;
                if (typeof floatingNodes[toNodeId] === 'boolean') {
                    isFloating = floatingNodes[toNodeId];
                } else if (typeof floatingNodes[toNodeId] === 'object' && floatingNodes[toNodeId] !== null) {
                    isFloating = floatingNodes[toNodeId].isFloating;
                }

                if (isFloating) {
                    info(`[内存] 检测到新边连接到浮动节点 ${toNodeId}，清除浮动状态`);
                    await this.clearFloatingNodeState(toNodeId, canvas);
                }
            }
        }
    }

    // =========================================================================
    // 清除浮动节点状态（只清除DOM样式，不修改文件）
    // =========================================================================
    async clearFloatingNodeState(nodeId: string, canvas?: any): Promise<void> {
        info(`[clearFloatingNodeState] 开始清除节点 ${nodeId} 的浮动状态`);
        try {
            // 1. 清除DOM样式
            const canvasForStyle = canvas || this.getCanvasFromView();
            info(`[clearFloatingNodeState] canvasForStyle=${canvasForStyle ? '存在' : '不存在'}`);
            if (canvasForStyle) {
                this.clearFloatingNodeStyle(nodeId, canvasForStyle);
            } else {
                warn(`[clearFloatingNodeState] 无法获取 canvas 对象，跳过样式清除`);
            }

            // 2. 延迟从文件中移除浮动标记（避免频繁修改文件导致 Obsidian 重新加载）
            // 使用防抖策略，合并多次清除操作
            this.debouncedClearFloatingNodeFromFile(nodeId);
            
        } catch (err) {
            error('[clearFloatingNodeState] 清除浮动节点状态失败:', err);
        }
    }

    // 防抖：延迟清除文件中的浮动标记
    private debouncedClearTimers: Map<string, number> = new Map();
    private debouncedClearFloatingNodeFromFile(nodeId: string): void {
        // 清除之前的定时器
        if (this.debouncedClearTimers.has(nodeId)) {
            window.clearTimeout(this.debouncedClearTimers.get(nodeId));
        }
        
        // 设置新的定时器，5秒后执行
        const timer = window.setTimeout(() => {
            this.clearFloatingNodeFromFile(nodeId);
            this.debouncedClearTimers.delete(nodeId);
        }, 5000);
        
        this.debouncedClearTimers.set(nodeId, timer);
    }

    // 实际从文件中清除浮动标记
    private async clearFloatingNodeFromFile(nodeId: string): Promise<void> {
        try {
            const canvasFilePath = this.getCurrentCanvasFilePath();
            if (!canvasFilePath) return;
            
            const canvasFile = this.app.vault.getAbstractFileByPath(canvasFilePath);
            if (!(canvasFile instanceof TFile)) return;
            
            const canvasContent = await this.app.vault.read(canvasFile);
            const canvasData = JSON.parse(canvasContent);

            let modified = false;

            // 1. 清除 metadata 中的标记（向后兼容）
            if (canvasData.metadata?.floatingNodes?.[nodeId] !== undefined) {
                delete canvasData.metadata.floatingNodes[nodeId];

                if (Object.keys(canvasData.metadata.floatingNodes).length === 0) {
                    delete canvasData.metadata.floatingNodes;
                }
                modified = true;
            }

            // 2. 清除节点本身 data 属性中的标记
            if (canvasData.nodes && Array.isArray(canvasData.nodes)) {
                const nodeData = canvasData.nodes.find((n: any) => n.id === nodeId);
                if (nodeData?.data?.isFloating) {
                    delete nodeData.data.isFloating;
                    delete nodeData.data.originalParent;
                    delete nodeData.data.floatingTimestamp;
                    modified = true;
                    info(`[clearFloatingNodeFromFile] 已清除节点 ${nodeId} data 属性中的浮动标记`);
                }
            }

            if (modified) {
                await this.app.vault.modify(canvasFile, JSON.stringify(canvasData, null, 2));
                info(`[clearFloatingNodeFromFile] 已延迟清除节点 ${nodeId} 的浮动状态`);
            }
        } catch (err) {
            error('[clearFloatingNodeFromFile] 失败:', err);
        }
    }

    // =========================================================================
    // 从视图获取 Canvas 对象
    // =========================================================================
    private getCanvasFromView(): any {
        const canvasView = this.getCanvasView();
        if (canvasView) {
            return (canvasView as any).canvas;
        }
        return null;
    }

    // =========================================================================
    // 获取当前 Canvas 文件路径
    // =========================================================================
    private getCurrentCanvasFilePath(): string | undefined {
        // 方法1: 从 activeLeaf 获取
        const activeLeaf = this.app.workspace.activeLeaf;
        if (activeLeaf?.view?.getViewType() === 'canvas') {
            const canvas = (activeLeaf.view as any).canvas;
            if (canvas?.file?.path) {
                return canvas.file.path;
            }
            if ((activeLeaf.view as any).file?.path) {
                return (activeLeaf.view as any).file.path;
            }
        }
        
        // 方法2: 从 getActiveViewOfType 获取
        const activeView = this.app.workspace.getActiveViewOfType(ItemView);
        if (activeView?.getViewType() === 'canvas') {
            const canvas = (activeView as any).canvas;
            if (canvas?.file?.path) {
                return canvas.file.path;
            }
            if ((activeView as any).file?.path) {
                return (activeView as any).file.path;
            }
        }
        
        // 方法3: 从所有 leaves 中查找 canvas
        const canvasLeaves = this.app.workspace.getLeavesOfType('canvas');
        for (const leaf of canvasLeaves) {
            if (leaf.view?.getViewType() === 'canvas') {
                const canvas = (leaf.view as any).canvas;
                if (canvas?.file?.path) {
                    return canvas.file.path;
                }
                if ((leaf.view as any).file?.path) {
                    return (leaf.view as any).file.path;
                }
            }
        }
        
        return undefined;
    }

    // =========================================================================
    // 获取 Canvas 视图
    // =========================================================================
    private getCanvasView(): ItemView | null {
        const activeLeaf = this.app.workspace.activeLeaf;
        if (activeLeaf?.view && (activeLeaf.view as any).canvas) {
            return activeLeaf.view as ItemView;
        }

        const leaves = this.app.workspace.getLeavesOfType('canvas');
        for (const leaf of leaves) {
            if (leaf.view && (leaf.view as any).canvas) {
                return leaf.view as ItemView;
            }
        }

        const view = this.app.workspace.getActiveViewOfType(ItemView);
        if (view && view.getViewType() === 'canvas') {
            return view;
        }

        return null;
    }

    // =========================================================================
    // 重新应用所有浮动节点的红框样式（打开 Canvas 时调用）
    // 从 metadata 和节点 data 属性中读取浮动节点标志
    // =========================================================================
    async reapplyAllFloatingStyles(canvas: any): Promise<void> {
        try {
            const canvasFilePath = this.getCurrentCanvasFilePath();
            if (!canvasFilePath) return;

            const canvasFile = this.app.vault.getAbstractFileByPath(canvasFilePath);
            if (!(canvasFile instanceof TFile)) return;

            const canvasContent = await this.app.vault.read(canvasFile);
            const canvasData = JSON.parse(canvasContent);
            
            // 收集所有浮动节点（从 metadata 和节点 data 属性）
            const floatingNodeIds = new Set<string>();
            
            // 1. 从 metadata 读取（向后兼容）
            const floatingNodes = canvasData.metadata?.floatingNodes || {};
            for (const [nodeId, data] of Object.entries(floatingNodes)) {
                let isFloating = false;
                if (typeof data === 'boolean') {
                    isFloating = data;
                } else if (typeof data === 'object' && data !== null) {
                    isFloating = (data as any).isFloating;
                }
                if (isFloating) {
                    floatingNodeIds.add(nodeId);
                }
            }
            
            // 2. 从节点本身的 data 属性读取（主要方式）
            if (canvasData.nodes && Array.isArray(canvasData.nodes)) {
                for (const node of canvasData.nodes) {
                    if (node.data?.isFloating) {
                        floatingNodeIds.add(node.id);
                        // 同时更新 metadata（向后兼容）
                        if (!canvasData.metadata) canvasData.metadata = {};
                        if (!canvasData.metadata.floatingNodes) canvasData.metadata.floatingNodes = {};
                        if (!canvasData.metadata.floatingNodes[node.id]) {
                            canvasData.metadata.floatingNodes[node.id] = {
                                isFloating: true,
                                originalParent: node.data.originalParent
                            };
                        }
                    }
                }
            }

            // 应用红框样式
            let appliedCount = 0;
            for (const nodeId of floatingNodeIds) {
                this.applyFloatingNodeStyle(nodeId, canvas);
                appliedCount++;
            }

            if (appliedCount > 0) {
                info(`[reapplyAllFloatingStyles] 已重新应用 ${appliedCount} 个浮动节点的红框样式`);
            }
        } catch (err) {
            error('[reapplyAllFloatingStyles] 失败:', err);
        }
    }
}
