import { App, ItemView, Notice, TFile, Plugin } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../../settings/types';
import { CanvasFileService } from './canvas-file-service';
import { NodePositionCalculator } from '../utils/node-position-calculator';
import { generateRandomId } from '../../utils/canvas-utils';
import { log } from '../../utils/logger';

/**
 * 节点创建服务
 * 负责创建新节点并添加到 Canvas
 */
export class NodeCreationService {
    private app: App;
    private plugin: Plugin;
    private settings: CanvasMindmapBuildSettings;
    private canvasFileService: CanvasFileService;
    private positionCalculator: NodePositionCalculator;
    private canvasManager: any;

    constructor(
        app: App,
        plugin: Plugin,
        settings: CanvasMindmapBuildSettings,
        canvasFileService: CanvasFileService,
        canvasManager?: any
    ) {
        this.app = app;
        this.plugin = plugin;
        this.settings = settings;
        this.canvasFileService = canvasFileService;
        this.positionCalculator = new NodePositionCalculator(settings);
        this.canvasManager = canvasManager;
    }

    setCanvasManager(canvasManager: any) {
        this.canvasManager = canvasManager;
    }

    /**
     * 添加节点到 Canvas
     */
    async addNodeToCanvas(content: string, sourceFile: TFile | null): Promise<void> {
        if (!sourceFile) {
            new Notice('No file selected');
            return;
        }

        // 优先使用设置中的 canvas 文件路径
        let canvasFilePath: string | undefined = this.settings.canvasFilePath;

        // 如果设置中没有路径，再尝试获取当前打开的 canvas
        if (!canvasFilePath) {
            canvasFilePath = this.canvasFileService.getCurrentCanvasFilePath();
        }

        if (!canvasFilePath) {
            new Notice('Please configure the canvas file path in settings or open a canvas file.');
            return;
        }

        const newNodeId = generateRandomId();

        // 使用原子操作添加节点
        const success = await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (canvasData) => {
            if (!canvasData.nodes) canvasData.nodes = [];
            if (!canvasData.edges) canvasData.edges = [];
            if (!canvasData.canvasMindmapBuildHistory) canvasData.canvasMindmapBuildHistory = [];

            const newNode = this.createNodeData(content, sourceFile, newNodeId);

            // 找到父节点并计算位置
            const parentNode = this.findParentNodeForNewNode(canvasData);

            if (parentNode) {
                log(`[Create] 父节点: ${parentNode.id} (${parentNode.x}, ${parentNode.y})`);
            }

            const position = this.positionCalculator.calculatePosition(newNode, parentNode, canvasData);
            newNode.x = position.x;
            newNode.y = position.y;

            canvasData.nodes.push(newNode);
            canvasData.canvasMindmapBuildHistory.push(newNodeId);
            log(`[Create] 节点已添加: ${newNodeId}`);

            // 如果有父节点，添加连线
            if (parentNode) {
                const newEdge = {
                    id: generateRandomId(),
                    fromNode: parentNode.id,
                    toNode: newNodeId,
                    fromSide: "right",
                    toSide: "left"
                };
                canvasData.edges.push(newEdge);
                
                // 关键：如果父节点被折叠了，新节点应该标记为隐藏，且由于它有了入边，它不应该是浮动节点
                const isParentCollapsed = this.canvasManager?.collapseStateManager?.isCollapsed(parentNode.id);
                if (isParentCollapsed) {
                    newNode.unknownData = {
                        ...newNode.unknownData,
                        collapsedHide: true
                    };
                }
            }

            return true; 
        });

        if (!success) {
            new Notice('Error saving canvas file.');
            return;
        }

        // 后续处理
        await this.postNodeCreation(newNodeId);

        new Notice('Node added to canvas successfully!');
    }

    /**
     * 创建节点数据对象
     */
    private createNodeData(content: string, sourceFile: TFile, nodeId: string): any {
        const newNode: any = { id: nodeId };
        const trimmedContent = content.trim();

        // 检测公式
        const isFormula = this.settings.enableFormulaDetection &&
            trimmedContent.startsWith('$$') &&
            trimmedContent.endsWith('$$') &&
            trimmedContent.length > 4;

        if (isFormula) {
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
                
                // 使用 CanvasNodeManager 计算初始高度
                if (this.canvasManager?.nodeManager) {
                    newNode.height = this.canvasManager.nodeManager.calculateTextNodeHeight(content);
                } else {
                    newNode.height = 100;
                }
            }
        }

        this.addFromLink(newNode, sourceFile);

        return newNode;
    }

    /**
     * 添加 fromLink 信息到节点
     */
    private addFromLink(node: any, sourceFile: TFile): void {
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
                    if (node.type === 'text') {
                        node.text += `\n<!-- fromLink:${fromLinkJson} -->`;
                    } else {
                        node.color = `fromLink:${fromLinkJson}`;
                    }
                } catch (jsonError) {
                    log('[Create] 添加 fromLink 失败', jsonError);
                }
            }
        }
    }

    /**
     * 找到父节点（当前选中的节点、最后点击的节点或根据历史/链接推断）
     */
    private findParentNodeForNewNode(canvasData: any): any | null {
        const nodes = canvasData.nodes || [];
        const edges = canvasData.edges || [];
        const history = canvasData.canvasMindmapBuildHistory || [];
        if (nodes.length === 0) return null;

        // 1. 尝试使用最后点击的节点（从插件中获取）
        const lastClickedNodeId = (this.plugin as any).lastClickedNodeId;
        if (lastClickedNodeId) {
            const clickedNode = nodes.find((n: any) => n.id === lastClickedNodeId);
            if (clickedNode) {
                log(`[Create] 使用最后点击节点: ${lastClickedNodeId}`);
                return clickedNode;
            }
        }

        // 2. 尝试获取当前选中的节点
        const canvasView = this.getCanvasView();
        if (canvasView) {
            const canvas = (canvasView as any).canvas;
            if (canvas?.selection) {
                const selectedNodes = Array.from(canvas.selection.values()) as any[];
                if (selectedNodes.length > 0) {
                    const selectedNodeId = selectedNodes[0].id;
                    const parentNode = nodes.find((n: any) => n.id === selectedNodeId);
                    if (parentNode) {
                        log(`[Create] 使用选中节点: ${selectedNodeId}`);
                        return parentNode;
                    }
                }
            }
        }

        // 3. 尝试从构建历史中推断
        const historyCopy = [...history];
        while (historyCopy.length > 0) {
            const lastId = historyCopy.pop();
            const lastNode = nodes.find((n: any) => n.id === lastId);
            if (lastNode) {
                const parentEdge = edges.find((e: any) => e.toNode === lastId);
                if (parentEdge) {
                    const parentNode = nodes.find((n: any) => n.id === parentEdge.fromNode);
                    if (parentNode) {
                        log(`[Create] 从历史推断父节点: ${parentNode.id}`);
                        return parentNode;
                    }
                }
                return lastNode;
            }
        }

        // 4. 尝试从 fromLink 标记推断
        const nodesWithFromLink = nodes.filter((n: any) => 
            (n.text?.includes('<!-- fromLink:')) || (n.color?.startsWith('fromLink:'))
        );
        if (nodesWithFromLink.length > 0) {
            const lastNode = nodesWithFromLink[nodesWithFromLink.length - 1];
            const parentEdge = edges.find((e: any) => e.toNode === lastNode.id);
            if (parentEdge) {
                const parentNode = nodes.find((n: any) => n.id === parentEdge.fromNode);
                if (parentNode) {
                    log(`[Create] 从 fromLink 推断父节点: ${parentNode.id}`);
                    return parentNode;
                }
            }
            return lastNode;
        }

        // 5. 兜底逻辑：找到根节点（无入边的节点）
        const childNodeIds = new Set(edges.map((e: any) => e.toNode || (e.to?.node?.id)));
        for (const node of nodes) {
            if (!childNodeIds.has(node.id)) {
                return node;
            }
        }

        return nodes[0];
    }

    /**
     * 节点创建后的后续处理
     */
    private async postNodeCreation(newNodeId: string): Promise<void> {
        if (this.canvasManager) {
            if (this.canvasManager.collapseStateManager) {
                this.canvasManager.collapseStateManager.clearCache();
            }

            // 检查折叠按钮（已有防抖机制）
            await this.canvasManager.checkAndAddCollapseButtons();

            // 延迟调整新节点高度
            setTimeout(() => {
                this.canvasManager.adjustNodeHeightAfterRender(newNodeId);
            }, 300); 
        }
    }

    /**
     * 获取 Canvas 视图
     */
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
}
