import { App, ItemView, Notice, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../settings/types';
import { CollapseStateManager } from '../state/collapse-state';
import { DeleteConfirmationModal } from '../ui/delete-modal';
import { debug, info, warn, error } from '../utils/logger';

export class CanvasNodeManager {
    private app: App;
    private settings: CanvasMindmapBuildSettings;
    private collapseStateManager: CollapseStateManager;
    private canvasManager: any;

    constructor(
        app: App,
        settings: CanvasMindmapBuildSettings,
        collapseStateManager: CollapseStateManager,
        canvasManager?: any
    ) {
        this.app = app;
        this.settings = settings;
        this.collapseStateManager = collapseStateManager;
        this.canvasManager = canvasManager;
    }

    setCanvasManager(canvasManager: any) {
        this.canvasManager = canvasManager;
    }

    // =========================================================================
    // 添加节点到 Canvas
    // =========================================================================
    async addNodeToCanvas(content: string, sourceFile: TFile | null) {
        if (!sourceFile) {
            new Notice('No file selected');
            return;
        }

        // 优先使用设置中的 canvas 文件路径
        let canvasFilePath: string | undefined = this.settings.canvasFilePath;
        
        // 如果设置中没有路径，再尝试获取当前打开的 canvas
        if (!canvasFilePath) {
            canvasFilePath = this.getCurrentCanvasFilePath();
        }
        
        if (!canvasFilePath) {
            new Notice('Please configure the canvas file path in settings or open a canvas file.');
            return;
        }

        const canvasFile = this.app.vault.getAbstractFileByPath(canvasFilePath);
        if (!(canvasFile instanceof TFile)) {
            new Notice(`Canvas file not found: ${canvasFilePath}`);
            return;
        }

        try {
            const canvasContent = await this.app.vault.read(canvasFile);
            let canvasData: any;
            try {
                canvasData = JSON.parse(canvasContent);
            } catch (parseError) {
                new Notice('Canvas文件格式错误，请检查文件内容');
                return;
            }
            
            if (!canvasData.nodes) canvasData.nodes = [];
            if (!canvasData.edges) canvasData.edges = [];

            const newNodeId = this.generateRandomId();
            const newNode: any = { id: newNodeId };

            // 检测公式
            const trimmedContent = content.trim();
            const formulaMatch = this.settings.enableFormulaDetection && 
                trimmedContent.startsWith('$$') && 
                trimmedContent.endsWith('$$') &&
                trimmedContent.length > 4;

            if (formulaMatch) {
                newNode.type = 'text';
                newNode.text = content;
                newNode.width = this.settings.formulaNodeWidth || 600;
                newNode.height = this.settings.formulaNodeHeight || 200;
            } else {
                // 检测图片
                const imageRegex = /!\[\[(.*?)\]\]|!\[.*?\]\((.*?)\)/;
                const imageMatch = content.match(imageRegex);

                if (imageMatch) {
                    const imagePath = imageMatch[1] || imageMatch[2];
                    newNode.type = 'file';
                    newNode.file = imagePath;
                    newNode.width = this.settings.imageNodeWidth || 400;
                    newNode.height = this.settings.imageNodeHeight || 300;
                } else {
                    newNode.type = 'text';
                    newNode.text = content;
                    newNode.width = this.settings.textNodeWidth || 250;
                    // 使用一个默认高度，等待 DOM 渲染完成后再调整
                    newNode.height = 80;
                }
            }

            // 添加 fromLink
            const editor = this.app.workspace.getActiveViewOfType(ItemView)?.leaf?.view as any;
            if (editor?.editor) {
                const selection = editor.editor.listSelections()?.[0];
                if (selection) {
                    const from = selection.anchor.line < selection.head.line || 
                        (selection.anchor.line === selection.head.line && selection.anchor.ch < selection.head.ch) 
                        ? selection.anchor : selection.head;
                    const to = selection.anchor.line > selection.head.line || 
                        (selection.anchor.line === selection.head.line && selection.anchor.ch > selection.head.ch) 
                        ? selection.anchor : selection.head;
                    const fromLink = { file: sourceFile.path, from, to };
                    
                    try {
                        const fromLinkJson = JSON.stringify(fromLink);
                        if (newNode.type === 'text') {
                            newNode.text += `\n<!-- fromLink:${fromLinkJson} -->`;
                        } else {
                            newNode.color = `fromLink:${fromLinkJson}`;
                        }
                    } catch (jsonError) {}
                }
            }
            
            // 找到父节点（当前选中的节点或根节点）
            info(`开始添加新节点，内容长度: ${content.length}`);
            const parentNode = this.findParentNodeForNewNode(canvasData);
            
            if (parentNode) {
                info(`找到父节点: ${parentNode.id}, 位置: (${parentNode.x}, ${parentNode.y})`);
            } else {
                info('未找到父节点，将使用默认位置');
            }
            
            // 计算新节点位置（在父节点右侧，高度中心对齐，避免重叠）
            const position = this.calculateNewNodePositionWithParent(newNode, parentNode, canvasData);
            newNode.x = position.x;
            newNode.y = position.y;
            info(`新节点位置: (${newNode.x}, ${newNode.y})`);
            
            canvasData.nodes.push(newNode);
            info(`新节点已添加到 nodes 数组，当前节点数: ${canvasData.nodes.length}`);
            
            // 如果有父节点，添加连线
            if (parentNode) {
                const newEdge = {
                    id: this.generateRandomId(),
                    fromNode: parentNode.id,
                    toNode: newNodeId,
                    fromSide: "right",
                    toSide: "left"
                };
                canvasData.edges.push(newEdge);
                info(`已添加连线: ${parentNode.id} -> ${newNodeId}`);
            }

            await this.app.vault.modify(canvasFile, JSON.stringify(canvasData, null, 2));

            this.collapseStateManager.clearCache();
            
            // 调用 CanvasManager 的公共方法
            if (this.canvasManager) {
                this.canvasManager.checkAndAddCollapseButtons();
                this.canvasManager.scheduleButtonCheck();
                
                // 延迟调整新节点高度
                setTimeout(() => {
                    info(`[addNodeToCanvas] 开始调整新节点 ${newNodeId} 高度`);
                    this.canvasManager.adjustNodeHeightAfterRender(newNodeId);
                }, 200);
            } else {
                warn('[addNodeToCanvas] canvasManager 未设置');
            }

            new Notice('Node added to canvas successfully!');
        } catch (e: any) {
            new Notice('Error processing canvas file.');
            error("Canvas Mindmap Build - Error:", e);
        }
    }

    // =========================================================================
    // 删除节点相关
    // =========================================================================
    async executeDeleteOperation(selectedNode: any, canvas: any) {
        let edges: any[] = [];
        if (canvas.fileData?.edges) edges = canvas.fileData.edges;
        if (canvas.edges) edges = Array.from(canvas.edges.values());
        
        const hasChildren = this.collapseStateManager.getChildNodes(selectedNode.id, edges).length > 0;
        
        const modal = new DeleteConfirmationModal(this.app, hasChildren);
        modal.open();
        const result = await modal.waitForResult();
        
        if (result.action === 'cancel') return;
        
        if (result.action === 'confirm' || result.action === 'single') {
            await this.handleSingleDelete(selectedNode, canvas);
        } else if (result.action === 'cascade') {
            await this.handleCascadeDelete(selectedNode, canvas);
        }
    }

    public async handleSingleDelete(node: any, canvas: any) {
        try {
            let edges: any[] = [];
            if (canvas.fileData?.edges) edges = canvas.fileData.edges;
            if (canvas.edges) edges = Array.from(canvas.edges.values());
            
            const allNodes = Array.from(canvas.nodes.values()) as any[];
            const parentNode = this.findParentNode(node.id, edges, allNodes);
            const childNodes = this.collapseStateManager.getChildNodes(node.id, edges);
            
            if (parentNode && childNodes.length > 0) {
                // 创建新的边连接父节点到子节点
                const newEdges: any[] = [];
                for (const childId of childNodes) {
                    const newEdge = {
                        id: this.generateRandomId(),
                        fromNode: parentNode.id,
                        fromSide: 'right',
                        toNode: childId,
                        toSide: 'left'
                    };
                    newEdges.push(newEdge);
                }
                
                await this.updateCanvasData(canvas, (data: any) => {
                    data.nodes = data.nodes.filter((n: any) => n.id !== node.id);
                    data.edges = data.edges.filter((e: any) => 
                        e.fromNode !== node.id && e.toNode !== node.id
                    );
                    data.edges.push(...newEdges);
                });
            } else {
                await this.updateCanvasData(canvas, (data: any) => {
                    data.nodes = data.nodes.filter((n: any) => n.id !== node.id);
                    data.edges = data.edges.filter((e: any) => 
                        e.fromNode !== node.id && e.toNode !== node.id
                    );
                });
            }
            
            this.collapseStateManager.clearCache();
            
            // 调用 CanvasManager 的公共方法
            const canvasView = this.getCanvasView();
            if (canvasView) {
                const canvasManager = (canvasView as any).plugin?.canvasManager;
                if (canvasManager) {
                    canvasManager.checkAndAddCollapseButtons();
                }
            }
            
            new Notice('节点删除成功！');
            
        } catch (error) {
            new Notice('删除操作失败，请重试');
        }
    }

    public async handleCascadeDelete(node: any, canvas: any) {
        try {
            let edges: any[] = [];
            if (canvas.fileData?.edges) edges = canvas.fileData.edges;
            if (canvas.edges) edges = Array.from(canvas.edges.values());
            
            const nodesToDelete = new Set<string>();
            nodesToDelete.add(node.id);
            
            const collectDescendants = (parentId: string) => {
                const directChildren = this.collapseStateManager.getChildNodes(parentId, edges);
                for (const childId of directChildren) {
                    if (!nodesToDelete.has(childId)) {
                        nodesToDelete.add(childId);
                        collectDescendants(childId);
                    }
                }
            };
            
            collectDescendants(node.id);
            
            await this.updateCanvasData(canvas, (data: any) => {
                data.nodes = data.nodes.filter((n: any) => !nodesToDelete.has(n.id));
                data.edges = data.edges.filter((e: any) => 
                    !nodesToDelete.has(e.fromNode) && !nodesToDelete.has(e.toNode)
                );
            });
            
            this.collapseStateManager.clearCache();
            
            // 调用 CanvasManager 的公共方法
            const canvasView = this.getCanvasView();
            if (canvasView) {
                const canvasManager = (canvasView as any).plugin?.canvasManager;
                if (canvasManager) {
                    canvasManager.checkAndAddCollapseButtons();
                }
            }
            
            new Notice(`成功删除 ${nodesToDelete.size} 个节点！`);
        } catch (err) {
            error('级联删除节点失败:', err);
            new Notice('删除节点失败，请查看控制台');
        }
    }

    private findParentNode(nodeId: string, edges: any[], allNodes: any[]): any | null {
        for (const edge of edges) {
            const fromId = edge.from?.node?.id || edge.fromNode;
            const toId = edge.to?.node?.id || edge.toNode;
            
            if (toId === nodeId) {
                const parentNode = allNodes.find((n: any) => n.id === fromId);
                if (parentNode) return parentNode;
            }
        }
        return null;
    }

    private async updateCanvasData(canvas: any, updateCallback: (data: any) => void) {
        let canvasFilePath: string | undefined;
        
        if (canvas.file?.path) {
            canvasFilePath = canvas.file.path;
        }
        
        if (!canvasFilePath) {
            const activeView = this.app.workspace.getActiveViewOfType(ItemView);
            if (activeView?.getViewType() === 'canvas' && (activeView as any).file) {
                canvasFilePath = (activeView as any).file.path;
            }
        }
        
        if (!canvasFilePath && this.settings.canvasFilePath) {
            canvasFilePath = this.settings.canvasFilePath;
        }
        
        if (!canvasFilePath) {
            throw new Error('无法获取Canvas文件路径');
        }
        
        const canvasFile = this.app.vault.getAbstractFileByPath(canvasFilePath);
        if (!(canvasFile instanceof TFile)) {
            throw new Error('Canvas file not found');
        }
        
        const canvasContent = await this.app.vault.read(canvasFile);
        const canvasData = JSON.parse(canvasContent);
        
        updateCallback(canvasData);
        
        await this.app.vault.modify(canvasFile, JSON.stringify(canvasData, null, 2));
        
        if (typeof canvas.reload === 'function') {
            canvas.reload();
        }
    }

    private getCanvasFilePath(canvasView: ItemView): string | undefined {
        if ((canvasView as any).canvas?.file?.path) {
            return (canvasView as any).canvas.file.path;
        }
        
        if ((canvasView as any).file?.path) {
            return (canvasView as any).file.path;
        }
        
        if (this.settings.canvasFilePath) {
            return this.settings.canvasFilePath;
        }
        
        return undefined;
    }

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
    // 找到父节点（当前选中的节点或根节点）
    // =========================================================================
    private findParentNodeForNewNode(canvasData: any): any | null {
        const nodes = canvasData.nodes || [];
        if (nodes.length === 0) return null;
        
        // 尝试获取当前选中的节点
        const canvasView = this.getCanvasView();
        if (canvasView) {
            const canvas = (canvasView as any).canvas;
            if (canvas?.selection) {
                const selectedNodes = Array.from(canvas.selection.values()) as any[];
                if (selectedNodes.length > 0) {
                    // 找到选中的节点在文件数据中的对应节点
                    const selectedNodeId = selectedNodes[0].id;
                    const parentNode = nodes.find((n: any) => n.id === selectedNodeId);
                    if (parentNode) return parentNode;
                }
            }
        }
        
        // 如果没有选中的节点，找到根节点（没有父节点的节点）
        const edges = canvasData.edges || [];
        const childNodeIds = new Set(edges.map((e: any) => e.toNode || e.to?.node?.id));
        
        for (const node of nodes) {
            if (!childNodeIds.has(node.id)) {
                return node; // 返回第一个根节点
            }
        }
        
        // 如果没有根节点，返回第一个节点
        return nodes[0];
    }

    // =========================================================================
    // 计算新节点位置（在父节点右侧，高度中心对齐，避免重叠）
    // =========================================================================
    private calculateNewNodePositionWithParent(newNode: any, parentNode: any | null, canvasData: any): { x: number; y: number } {
        if (!parentNode) {
            return { x: 0, y: 0 };
        }
        
        // 使用设置中的间距参数
        const horizontalSpacing = this.settings.horizontalSpacing || 200;
        const verticalSpacing = this.settings.verticalSpacing || 40;
        
        const baseX = parentNode.x + (parentNode.width || 250) + horizontalSpacing;
        const parentCenterY = parentNode.y + (parentNode.height || 100) / 2;
        const newNodeHeight = newNode.height || 100;
        const baseY = parentCenterY - newNodeHeight / 2;
        
        // 获取父节点的所有子节点
        const edges = canvasData.edges || [];
        const childNodeIds = edges
            .filter((e: any) => (e.fromNode || e.from?.node?.id) === parentNode.id)
            .map((e: any) => e.toNode || e.to?.node?.id);
        
        const childNodes = (canvasData.nodes || []).filter((n: any) => childNodeIds.includes(n.id));
        debug(`父节点 ${parentNode.id} 已有 ${childNodes.length} 个子节点`);
        
        // 如果没有子节点，使用基础位置
        if (childNodes.length === 0) {
            debug(`使用基础位置: (${baseX}, ${baseY})，水平间距: ${horizontalSpacing}`);
            return { x: baseX, y: baseY };
        }
        
        // 找到最下方的子节点
        let lowestChild = childNodes[0];
        let maxBottom = childNodes[0].y + (childNodes[0].height || 100);
        
        for (const child of childNodes) {
            const childBottom = child.y + (child.height || 100);
            if (childBottom > maxBottom) {
                maxBottom = childBottom;
                lowestChild = child;
            }
        }
        
        // 新节点放在最下方子节点的下方
        const newY = maxBottom + verticalSpacing;
        debug(`新节点将放在最下方子节点 ${lowestChild.id} 的下方，Y: ${newY}，垂直间距: ${verticalSpacing}`);
        
        return { x: baseX, y: newY };
    }

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

    private generateRandomId(): string {
        return Math.random().toString(36).substring(2, 10);
    }
}