import { App, ItemView, Notice, TFile, Plugin } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../../settings/types';
import { CanvasFileService } from './canvas-file-service';
import { NodePositionCalculator } from '../utils/node-position-calculator';
import { generateRandomId, getCanvasView } from '../../utils/canvas-utils';
import { log } from '../../utils/logger';
import { CanvasNodeLike, CanvasEdgeLike, CanvasDataLike, ICanvasManager, EditorWithSelection, CanvasViewLike, PluginWithLastClicked } from '../types';

export class NodeCreationService {
    private app: App;
    private plugin: Plugin;
    private settings: CanvasMindmapBuildSettings;
    private canvasFileService: CanvasFileService;
    private positionCalculator: NodePositionCalculator;
    private canvasManager: ICanvasManager | null = null;

    constructor(
        app: App,
        plugin: Plugin,
        settings: CanvasMindmapBuildSettings,
        canvasFileService: CanvasFileService,
        canvasManager?: ICanvasManager
    ) {
        this.app = app;
        this.plugin = plugin;
        this.settings = settings;
        this.canvasFileService = canvasFileService;
        this.positionCalculator = new NodePositionCalculator(settings);
        this.canvasManager = canvasManager || null;
    }

    setCanvasManager(canvasManager: ICanvasManager): void {
        this.canvasManager = canvasManager;
    }

    async addNodeToCanvas(content: string, sourceFile: TFile | null): Promise<void> {
        if (!sourceFile) {
            new Notice('未选择文件');
            return;
        }

        let canvasFilePath: string | undefined = this.settings.canvasFilePath;

        if (!canvasFilePath) {
            canvasFilePath = this.canvasFileService.getCurrentCanvasFilePath();
        }

        if (!canvasFilePath) {
            new Notice('请在设置中配置 Canvas 文件路径或打开一个 Canvas 文件');
            return;
        }

        const newNodeId = generateRandomId();

        const success = await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (canvasData) => {
            if (!canvasData.nodes) canvasData.nodes = [];
            if (!canvasData.edges) canvasData.edges = [];
            if (!canvasData.canvasMindmapBuildHistory) canvasData.canvasMindmapBuildHistory = [];

            const newNode = this.createNodeData(content, sourceFile, newNodeId);

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

            if (parentNode) {
                const newEdge: CanvasEdgeLike = {
                    id: generateRandomId(),
                    fromNode: parentNode.id,
                    toNode: newNodeId,
                    fromSide: "right",
                    toSide: "left"
                };
                canvasData.edges!.push(newEdge);
                
                if (parentNode.id && this.canvasManager?.collapseStateManager?.isCollapsed(parentNode.id)) {
                    newNode.unknownData = {
                        ...newNode.unknownData,
                        collapsedHide: true
                    };
                }
            }

            return true; 
        });

        if (!success) {
            new Notice('保存 Canvas 文件失败');
            return;
        }

        await this.postNodeCreation(newNodeId);

        new Notice('节点已成功添加到 Canvas');
    }

    private createNodeData(content: string, sourceFile: TFile, nodeId: string): CanvasNodeLike {
        const newNode: CanvasNodeLike = { id: nodeId };
        const trimmedContent = content.trim();

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
                
                if (this.canvasManager) {
                    newNode.height = this.canvasManager.calculateTextNodeHeight(content);
                } else {
                    newNode.height = 100;
                }
            }
        }

        this.addFromLink(newNode, sourceFile);

        return newNode;
    }

    private addFromLink(node: CanvasNodeLike, sourceFile: TFile): void {
        const editor = this.app.workspace.getActiveViewOfType(ItemView)?.leaf?.view as EditorWithSelection;
        if (editor?.editor?.listSelections) {
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
                        node.text = (node.text || '') + `\n<!-- fromLink:${fromLinkJson} -->`;
                    } else {
                        node.color = `fromLink:${fromLinkJson}`;
                    }
                } catch (jsonError) {
                    log('[Create] 添加 fromLink 失败', jsonError);
                }
            }
        }
    }

    private findParentNodeForNewNode(canvasData: CanvasDataLike): CanvasNodeLike | null {
        const nodes = canvasData.nodes || [];
        const edges = canvasData.edges || [];
        const history = canvasData.canvasMindmapBuildHistory || [];
        if (nodes.length === 0) return null;

        const lastClickedNodeId = (this.plugin as PluginWithLastClicked).lastClickedNodeId;
        if (lastClickedNodeId) {
            const clickedNode = nodes.find(n => n.id === lastClickedNodeId);
            if (clickedNode) {
                log(`[Create] 使用最后点击节点: ${lastClickedNodeId}`);
                return clickedNode;
            }
        }

        const canvasView = this.getCanvasView();
        if (canvasView) {
            const canvas = (canvasView as CanvasViewLike).canvas;
            if (canvas?.selection) {
                const selectedNodes = Array.from(canvas.selection.values()) as CanvasNodeLike[];
                const firstSelected = selectedNodes[0];
                if (firstSelected?.id) {
                    const selectedNodeId = firstSelected.id;
                    const parentNode = nodes.find(n => n.id === selectedNodeId);
                    if (parentNode) {
                        log(`[Create] 使用选中节点: ${selectedNodeId}`);
                        return parentNode;
                    }
                }
            }
        }

        const historyCopy = [...history];
        while (historyCopy.length > 0) {
            const lastId = historyCopy.pop();
            const lastNode = nodes.find(n => n.id === lastId);
            if (lastNode) {
                const parentEdge = edges.find(e => e.toNode === lastId);
                if (parentEdge) {
                    const parentNode = nodes.find(n => n.id === parentEdge.fromNode);
                    if (parentNode) {
                        log(`[Create] 从历史推断父节点: ${parentNode.id}`);
                        return parentNode;
                    }
                }
                return lastNode;
            }
        }

        const nodesWithFromLink = nodes.filter(n => 
            (n.text?.includes('<!-- fromLink:')) || (n.color?.startsWith('fromLink:'))
        );
        if (nodesWithFromLink.length > 0) {
            const lastNode = nodesWithFromLink[nodesWithFromLink.length - 1];
            if (lastNode) {
                const parentEdge = edges.find(e => e.toNode === lastNode.id);
                if (parentEdge) {
                    const parentNode = nodes.find(n => n.id === parentEdge.fromNode);
                    if (parentNode) {
                        log(`[Create] 从 fromLink 推断父节点: ${parentNode.id}`);
                        return parentNode;
                    }
                }
                return lastNode;
            }
        }

        const childNodeIds = new Set(edges.map(e => e.toNode || (typeof e.to === 'object' && e.to?.node?.id)));
        for (const node of nodes) {
            if (node.id && !childNodeIds.has(node.id)) {
                return node;
            }
        }

        return nodes[0] || null;
    }

    private async postNodeCreation(newNodeId: string): Promise<void> {
        if (this.canvasManager) {
            if (this.canvasManager.collapseStateManager) {
                this.canvasManager.collapseStateManager.clearCache();
            }

            await this.canvasManager.checkAndAddCollapseButtons();

            this.canvasManager.adjustNodeHeightAfterRender(newNodeId);
            
            const manager = this.canvasManager;
            setTimeout(() => {
                manager.adjustNodeHeightAfterRender(newNodeId);
            }, 300);

            setTimeout(() => {
                manager.adjustNodeHeightAfterRender(newNodeId);
            }, 800);
        }
    }

    private getCanvasView(): ItemView | null {
        return getCanvasView(this.app);
    }
}
