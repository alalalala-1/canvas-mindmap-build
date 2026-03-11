import { App, ItemView, Notice, TFile, Plugin } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../../settings/types';
import { CanvasFileService } from './canvas-file-service';
import { NodeTypeService } from './node-type-service';
import { NodePositionCalculator } from '../utils/node-position-calculator';
import { describeCanvasSelectionState, generateRandomId, getCanvasView, getDirectSelectedNodes } from '../../utils/canvas-utils';
import { log } from '../../utils/logger';
import { CONSTANTS } from '../../constants';
import { CanvasNodeLike, CanvasEdgeLike, CanvasDataLike, ICanvasManager, EditorWithSelection, CanvasViewLike, PluginWithLastClicked } from '../types';

type ParentNodeResolution = {
    parentNode: CanvasNodeLike | null;
    source: string;
    detail: string;
};

type CanvasPathResolution = {
    path?: string;
    source: string;
    candidatesSummary: string;
};

export class NodeCreationService {
    private app: App;
    private plugin: Plugin;
    private settings: CanvasMindmapBuildSettings;
    private canvasFileService: CanvasFileService;
    private nodeTypeService: NodeTypeService;
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
        this.nodeTypeService = new NodeTypeService(settings);
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

        const pluginContext = this.plugin as PluginWithLastClicked;
        const contextCanvasFilePath = pluginContext.lastClickedCanvasFilePath;
        const openCanvasFilePath = this.getOpenCanvasFilePath();
        const settingsCanvasFilePath = this.settings.canvasFilePath;
        const canvasPathResolution = this.resolveTargetCanvasFilePath(
            contextCanvasFilePath,
            openCanvasFilePath,
            settingsCanvasFilePath
        );
        const canvasFilePath = canvasPathResolution.path;
        const canvasFilePathSource = canvasPathResolution.source;

        const trimmedContent = content.trim();
        log(
            `[Create] AddNodeStart: sourceFile=${sourceFile.path}, selectionLength=${content.length}, ` +
            `trimmedLength=${trimmedContent.length}, preview=${JSON.stringify(trimmedContent.slice(0, 80))}, ` +
            `lastClickedNodeId=${pluginContext.lastClickedNodeId || 'none'}, ` +
            `lastClickedCanvasFilePath=${contextCanvasFilePath || 'none'}, ` +
            `openCanvasFilePath=${openCanvasFilePath || 'none'}, settingsCanvasFilePath=${settingsCanvasFilePath || 'none'}, ` +
            `targetCanvasFilePath=${canvasFilePath || 'none'}, targetCanvasSource=${canvasFilePathSource}, ` +
            `pathCandidates=${canvasPathResolution.candidatesSummary}, canvasSelection=${this.describeCanvasSelection()}`
        );

        if (!canvasFilePath) {
            new Notice('未找到有效的 canvas 文件路径，请打开目标 canvas 或修正设置中的路径');
            return;
        }

        const newNodeId = generateRandomId();
        let modifyPass = 0;
        let lastParentResolutionSummary = 'none';
        let lastPlacementSummary = 'none';

        const success = await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (canvasData) => {
            modifyPass += 1;
            const phase = modifyPass === 1 ? 'preflight' : `final-${modifyPass}`;
            if (!canvasData.nodes) canvasData.nodes = [];
            if (!canvasData.edges) canvasData.edges = [];
            if (!canvasData.canvasMindmapBuildHistory) canvasData.canvasMindmapBuildHistory = [];

            const newNode = this.createNodeData(content, sourceFile, newNodeId);

            const parentResolution = this.findParentNodeForNewNode(canvasData, canvasFilePath);
            const parentNode = parentResolution.parentNode;
            lastParentResolutionSummary = `phase=${phase},source=${parentResolution.source},parent=${parentNode?.id || 'none'},detail=${parentResolution.detail}`;

            log(
                `[Create] ParentResolve: phase=${phase}, targetCanvas=${canvasFilePath}, source=${parentResolution.source}, ` +
                `parent=${parentNode?.id || 'none'}, detail=${parentResolution.detail}, canvasSelection=${this.describeCanvasSelection()}`
            );

            if (parentNode) {
                log(`[Create] 父节点: phase=${phase}, id=${parentNode.id} (${parentNode.x}, ${parentNode.y})`);
            }

            const position = this.positionCalculator.calculatePosition(newNode, parentNode, canvasData);
            newNode.x = position.x;
            newNode.y = position.y;
            lastPlacementSummary = `phase=${phase},x=${position.x},y=${position.y},parent=${parentNode?.id || 'none'}`;

            log(
                `[Create] NodePlacement: phase=${phase}, node=${newNodeId}, x=${position.x}, y=${position.y}, ` +
                `parent=${parentNode?.id || 'none'}, targetCanvas=${canvasFilePath}`
            );

            canvasData.nodes.push(newNode);
            canvasData.canvasMindmapBuildHistory.push(newNodeId);
            log(`[Create] 节点已添加: phase=${phase}, node=${newNodeId}, historySize=${canvasData.canvasMindmapBuildHistory.length}`);

            if (parentNode) {
                const newEdge: CanvasEdgeLike = {
                    id: generateRandomId(),
                    fromNode: parentNode.id,
                    toNode: newNodeId,
                    fromSide: "right",
                    toSide: "left"
                };
                canvasData.edges.push(newEdge);
                log(`[Create] EdgeCreated: phase=${phase}, edge=${newEdge.id}, from=${parentNode.id}, to=${newNodeId}`);
                
                if (parentNode.id && this.canvasManager?.collapseStateManager?.isCollapsed(parentNode.id)) {
                    newNode.unknownData = {
                        ...newNode.unknownData,
                        collapsedHide: true
                    };
                    log(`[Create] NewNodeCollapsedHideInherited: phase=${phase}, node=${newNodeId}, parent=${parentNode.id}`);
                }
            } else {
                log(`[Create] EdgeSkipped: phase=${phase}, node=${newNodeId}, reason=no-parent`);
            }

            return true; 
        });

        log(
            `[Create] AddNodeWriteResult: success=${success}, node=${newNodeId}, targetCanvas=${canvasFilePath}, ` +
            `parent=${lastParentResolutionSummary}, placement=${lastPlacementSummary}`
        );

        if (!success) {
            new Notice('保存 canvas 文件失败');
            return;
        }

        await this.postNodeCreation(newNodeId, canvasFilePath);

        log(`[Create] AddNodeDone: node=${newNodeId}, targetCanvas=${canvasFilePath}`);

        new Notice('节点已成功添加到 canvas');
    }

    private createNodeData(content: string, sourceFile: TFile, nodeId: string): CanvasNodeLike {
        const newNode: CanvasNodeLike = { id: nodeId };
        const trimmedContent = content.trim();

        const dimensions = this.nodeTypeService.getNodeDimensions(trimmedContent);

        if (dimensions.type === 'formula') {
            newNode.type = 'text';
            newNode.text = content;
            newNode.width = dimensions.width;
            newNode.height = dimensions.height;
        } else if (dimensions.type === 'image') {
            const imageRegex = /!\[\[(.*?)\]\]|!\[.*?\]\((.*?)\)/;
            const imageMatch = content.match(imageRegex);

            if (imageMatch) {
                const imagePath = imageMatch[1] || imageMatch[2];
                newNode.type = 'file';
                newNode.file = imagePath;
                newNode.width = dimensions.width;
                newNode.height = dimensions.height;
            }
        } else {
            newNode.type = 'text';
            newNode.text = content;
            newNode.width = dimensions.width;
            
            if (this.canvasManager) {
                newNode.height = this.canvasManager.calculateTextNodeHeight(content);
            } else {
                newNode.height = 100;
            }
        }

        this.addFromLink(newNode, sourceFile);

        return newNode;
    }

    private resolveTargetCanvasFilePath(
        contextCanvasFilePath: string | null | undefined,
        openCanvasFilePath: string | null | undefined,
        settingsCanvasFilePath: string | null | undefined
    ): CanvasPathResolution {
        const candidates = [
            { source: 'last-clicked-canvas', path: contextCanvasFilePath },
            { source: 'current-open-canvas', path: openCanvasFilePath },
            { source: 'settings', path: settingsCanvasFilePath }
        ];

        const seenPaths = new Set<string>();
        const summaryParts: string[] = [];

        for (const candidate of candidates) {
            const candidatePath = candidate.path?.trim();
            if (!candidatePath) {
                summaryParts.push(`${candidate.source}:none`);
                continue;
            }

            if (seenPaths.has(candidatePath)) {
                summaryParts.push(`${candidate.source}:${candidatePath}:duplicate`);
                continue;
            }
            seenPaths.add(candidatePath);

            const exists = this.canvasFileExists(candidatePath);
            summaryParts.push(`${candidate.source}:${candidatePath}:${exists ? 'ok' : 'missing'}`);
            log(`[Create] CanvasPathCandidate: source=${candidate.source}, path=${candidatePath}, exists=${exists}`);

            if (exists) {
                log(`[Create] CanvasPathResolved: source=${candidate.source}, path=${candidatePath}`);
                return {
                    path: candidatePath,
                    source: candidate.source,
                    candidatesSummary: summaryParts.join('|')
                };
            }
        }

        log(`[Create] CanvasPathResolved: source=none, path=none, candidates=${summaryParts.join('|') || 'none'}`);
        return {
            path: undefined,
            source: 'none',
            candidatesSummary: summaryParts.join('|') || 'none'
        };
    }

    private canvasFileExists(filePath: string | null | undefined): boolean {
        if (!filePath) return false;
        return this.app.vault.getAbstractFileByPath(filePath) instanceof TFile;
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

    private findParentNodeForNewNode(canvasData: CanvasDataLike, targetCanvasFilePath: string): ParentNodeResolution {
        const nodes = canvasData.nodes || [];
        const edges = canvasData.edges || [];
        const history = canvasData.canvasMindmapBuildHistory || [];
        if (nodes.length === 0) {
            return { parentNode: null, source: 'none', detail: 'canvas-empty' };
        }

        const pluginContext = this.plugin as PluginWithLastClicked;
        const lastClickedNodeId = pluginContext.lastClickedNodeId;
        const lastClickedCanvasFilePath = pluginContext.lastClickedCanvasFilePath;
        if (lastClickedNodeId) {
            if (lastClickedCanvasFilePath && lastClickedCanvasFilePath !== targetCanvasFilePath) {
                log(
                    `[Create] 跳过最近焦点节点: node=${lastClickedNodeId}, ` +
                    `contextCanvas=${lastClickedCanvasFilePath}, targetCanvas=${targetCanvasFilePath}`
                );
            } else {
                const clickedNode = nodes.find(n => n.id === lastClickedNodeId);
                if (clickedNode) {
                    log(`[Create] 使用最近焦点节点: ${lastClickedNodeId}`);
                    return {
                        parentNode: clickedNode,
                        source: 'focused-node-context',
                        detail: `node=${lastClickedNodeId},contextCanvas=${lastClickedCanvasFilePath || 'none'}`
                    };
                }

                log(`[Create] 最近焦点节点未在目标 canvas 中找到: node=${lastClickedNodeId}, targetCanvas=${targetCanvasFilePath}`);
            }
        }

        const canvasView = this.getCanvasView();
        if (canvasView) {
            const canvas = (canvasView as CanvasViewLike).canvas;
            if (canvas) {
                const selectedNodes = getDirectSelectedNodes(canvas);
                const firstSelected = selectedNodes[0];
                if (firstSelected?.id) {
                    const selectedNodeId = firstSelected.id;
                    const parentNode = nodes.find(n => n.id === selectedNodeId);
                    if (parentNode) {
                        log(`[Create] 使用选中节点: ${selectedNodeId}`);
                        return {
                            parentNode,
                            source: 'canvas-selection',
                            detail: `node=${selectedNodeId},selectionSize=${selectedNodes.length}`
                        };
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
                        return {
                            parentNode,
                            source: 'history-parent',
                            detail: `historyNode=${lastId},parent=${parentNode.id}`
                        };
                    }
                }
                return {
                    parentNode: lastNode,
                    source: 'history-node',
                    detail: `historyNode=${lastId}`
                };
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
                        return {
                            parentNode,
                            source: 'fromlink-parent',
                            detail: `fromLinkNode=${lastNode.id},parent=${parentNode.id}`
                        };
                    }
                }
                return {
                    parentNode: lastNode,
                    source: 'fromlink-node',
                    detail: `fromLinkNode=${lastNode.id}`
                };
            }
        }

        const childNodeIds = new Set(edges.map(e => e.toNode || (typeof e.to === 'object' && e.to?.node?.id)));
        for (const node of nodes) {
            if (node.id && !childNodeIds.has(node.id)) {
                return {
                    parentNode: node,
                    source: 'root',
                    detail: `rootNode=${node.id}`
                };
            }
        }

        const fallbackNode = nodes[0] || null;
        return {
            parentNode: fallbackNode,
            source: fallbackNode ? 'first-node' : 'none',
            detail: fallbackNode?.id ? `firstNode=${fallbackNode.id}` : 'no-node'
        };
    }

    private async postNodeCreation(newNodeId: string, canvasFilePath: string): Promise<void> {
        if (this.canvasManager) {
            const refreshed = await this.canvasManager.refreshCanvasViewsForFile?.(canvasFilePath, `add-node:${newNodeId}`);
            if (typeof refreshed === 'number') {
                log(`[Create] CanvasRefreshAfterAdd: node=${newNodeId}, canvas=${canvasFilePath}, refreshed=${refreshed}`);
            }

            if (this.canvasManager.collapseStateManager) {
                this.canvasManager.collapseStateManager.clearCache();
            }

            this.canvasManager.checkAndAddCollapseButtons();
            this.canvasManager.scheduleNodeHeightAdjustment(
                newNodeId,
                CONSTANTS.TIMING.HEIGHT_ADJUST_DELAY,
                'post-node-create'
            );
        }
    }

    private describeCanvasSelection(): string {
        const canvasView = this.getCanvasView();
        const canvas = canvasView ? (canvasView as CanvasViewLike).canvas : null;
        return describeCanvasSelectionState(canvas);
    }

    private getOpenCanvasFilePath(): string | undefined {
        const canvasView = this.getCanvasView() as CanvasViewLike | null;
        return canvasView?.canvas?.file?.path || canvasView?.file?.path || undefined;
    }

    private getCanvasView(): ItemView | null {
        return getCanvasView(this.app);
    }
}
