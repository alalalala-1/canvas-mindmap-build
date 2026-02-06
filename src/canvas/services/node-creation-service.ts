import { App, ItemView, Notice, TFile, Plugin } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../../settings/types';
import { CanvasFileService } from './canvas-file-service';
import { NodePositionCalculator } from '../utils/node-position-calculator';
import { generateRandomId } from '../../utils/canvas-utils';
import { info, warn, debug } from '../../utils/logger';

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
            info(`开始添加新节点，内容长度: ${content.length}`);
            const parentNode = this.findParentNodeForNewNode(canvasData);

            if (parentNode) {
                info(`找到父节点: ${parentNode.id}, 位置: (${parentNode.x}, ${parentNode.y})`);
            } else {
                info('未找到父节点，将使用默认位置');
            }

            const position = this.positionCalculator.calculatePosition(newNode, parentNode, canvasData);
            newNode.x = position.x;
            newNode.y = position.y;
            info(`新节点位置: (${newNode.x}, ${newNode.y})`);

            canvasData.nodes.push(newNode);
            canvasData.canvasMindmapBuildHistory.push(newNodeId);
            info(`新节点已添加到 nodes 数组，当前节点数: ${canvasData.nodes.length}`);

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
                info(`已添加连线: ${parentNode.id} -> ${newNodeId}`);
            }

            return true; // 始终返回 true，因为我们添加了节点
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
                newNode.height = 80; // 默认高度，等待 DOM 渲染后调整
            }
        }

        // 添加 fromLink
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
                    debug('添加 fromLink 失败', jsonError);
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
                debug(`使用最后点击的节点作为父节点: ${lastClickedNodeId}`);
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
                        debug(`使用当前选中的节点作为父节点: ${selectedNodeId}`);
                        return parentNode;
                    }
                }
            }
        }

        // 3. 尝试从构建历史中推断（模仿 node-manager.ts 逻辑）
        const historyCopy = [...history];
        while (historyCopy.length > 0) {
            const lastId = historyCopy.pop();
            const lastNode = nodes.find((n: any) => n.id === lastId);
            if (lastNode) {
                // 如果这个节点已经有父节点，返回它的父节点作为兄弟节点的参考
                const parentEdge = edges.find((e: any) => e.toNode === lastId);
                if (parentEdge) {
                    const parentNode = nodes.find((n: any) => n.id === parentEdge.fromNode);
                    if (parentNode) {
                        debug(`从历史节点 ${lastId} 推断父节点: ${parentNode.id}`);
                        return parentNode;
                    }
                }
                // 如果它是根节点，就把它当做父节点（作为它的子节点）
                debug(`使用历史节点作为参考: ${lastId}`);
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
                    debug(`从 fromLink 节点 ${lastNode.id} 推断父节点: ${parentNode.id}`);
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
            this.canvasManager.checkAndAddCollapseButtons();
            this.canvasManager.scheduleButtonCheck();

            // 延迟调整新节点高度
            setTimeout(() => {
                info(`[postNodeCreation] 开始调整新节点 ${newNodeId} 高度`);
                this.canvasManager.adjustNodeHeightAfterRender(newNodeId);
            }, 200);
        } else {
            warn('[postNodeCreation] canvasManager 未设置');
        }
    }

    private calculateTextNodeHeightComputed(content: string, nodeWidth: number): number {
        const maxHeight = this.settings.textNodeMaxHeight || 800;

        // 内容区域可用宽度（更保守，考虑内边距）
        const contentWidth = nodeWidth - 40;

        // 默认字体参数 - 使用更保守的估计
        const fontSize = 14;
        const lineHeight = 26; // 进一步增加行高估计

        // 估算行数（使用更保守的字符宽度）
        const chineseCharRegex = /[\u4e00-\u9fa5]/;
        let totalLines = 0;
        const textLines = content.split('\n');

        for (const line of textLines) {
            const trimmedLine = line.trim();
            if (trimmedLine === '') {
                totalLines += 0.5;
                continue;
            }

            // 清理 Markdown 标记
            const cleanLine = trimmedLine
                .replace(/^#{1,6}\s+/, '')
                .replace(/\*\*|\*|__|_|`/g, '');

            // 更保守的像素宽度估算
            let pixelWidth = 0;
            for (const char of cleanLine) {
                if (chineseCharRegex.test(char)) {
                    pixelWidth += fontSize * 1.15; // 中文字符更宽
                } else {
                    pixelWidth += fontSize * 0.6; // 英文字符也更宽
                }
            }

            // 向上取整并增加额外行数缓冲
            const linesNeeded = Math.ceil(pixelWidth / contentWidth);
            totalLines += Math.max(1, linesNeeded);
        }

        // 计算高度（增加更多安全边距）
        const safetyPadding = 44; // 进一步增加安全边距
        const calculatedHeight = Math.ceil(totalLines * lineHeight + safetyPadding);
        const minHeight = 60;

        debug(`calculateTextNodeHeightComputed: 行数=${totalLines}, 行高=${lineHeight}, 高度=${calculatedHeight}`);

        return Math.max(minHeight, Math.min(calculatedHeight, maxHeight));
    }

    /**
     * 直接测量 DOM 中内容的实际高度
     */
    private measureActualContentHeight(nodeEl: Element, content: string): number {
        try {
            const contentEl = nodeEl.querySelector('.canvas-node-content') as HTMLElement;
            const sizerEl = nodeEl.querySelector('.markdown-preview-sizer') as HTMLElement;

            // 方法1：直接读取 sizer 的 min-height（Obsidian 计算的内容实际高度）
            if (sizerEl) {
                const sizerMinHeightStyle = sizerEl.style.minHeight;
                if (sizerMinHeightStyle) {
                    const parsedMinHeight = parseFloat(sizerMinHeightStyle);
                    if (!isNaN(parsedMinHeight) && parsedMinHeight > 0) {
                        debug(`measureActualContentHeight: sizer min-height=${parsedMinHeight}`);
                        return Math.ceil(parsedMinHeight + 24);
                    }
                }
            }

            // 方法2：通过实际渲染的段落计算
            if (contentEl) {
                const pElement = contentEl.querySelector('p');
                if (pElement) {
                    const pRect = pElement.getBoundingClientRect();
                    const pStyles = window.getComputedStyle(pElement);
                    const lineHeight = parseFloat(pStyles.lineHeight) || 24;
                    
                    // 计算实际渲染的行数
                    const actualLines = Math.max(1, Math.round(pRect.height / lineHeight));
                    
                    // 获取内边距
                    const styles = window.getComputedStyle(contentEl);
                    const paddingTop = parseFloat(styles.paddingTop) || 8;
                    const paddingBottom = parseFloat(styles.paddingBottom) || 8;

                    const calculatedHeight = Math.ceil(actualLines * lineHeight + paddingTop + paddingBottom + 20);
                    debug(`measureActualContentHeight: 实际段落高度=${pRect.height}, 行数=${actualLines}, 行高=${lineHeight}, 计算高度=${calculatedHeight}`);
                    return calculatedHeight;
                }
            }

            // 方法3：使用 sizer 的 scrollHeight
            if (sizerEl) {
                const scrollHeight = sizerEl.scrollHeight;
                if (scrollHeight > 20) {
                    return Math.ceil(scrollHeight + 24);
                }

                // 备选：使用 getBoundingClientRect
                const rect = sizerEl.getBoundingClientRect();
                if (rect.height > 0) {
                    return Math.ceil(rect.height + 24);
                }
            }

            // 方法4：使用 contentEl 的 scrollHeight
            if (contentEl) {
                const styles = window.getComputedStyle(contentEl);
                const paddingTop = parseFloat(styles.paddingTop) || 8;
                const paddingBottom = parseFloat(styles.paddingBottom) || 8;
                const scrollHeight = contentEl.scrollHeight;
                if (scrollHeight > 20) {
                    return Math.ceil(scrollHeight + paddingTop + paddingBottom);
                }
            }

            // 最后备选：使用 node 宽度计算
            const nodeWidth = nodeEl.clientWidth || 400;
            return this.calculateTextNodeHeightComputed(content, nodeWidth);
        } catch (e) {
            debug(`measureActualContentHeight 异常: ${e}`);
        }
        return 0;
    }

    private calculateTextNodeHeight(content: string, nodeEl?: Element): number {
        const maxHeight = this.settings.textNodeMaxHeight || 800;
        const nodeWidth = this.settings.textNodeWidth || 400;

        // 如果有 DOM 元素，尝试直接测量内容的实际高度
        if (nodeEl) {
            const measuredHeight = this.measureActualContentHeight(nodeEl, content);
            debug(`calculateTextNodeHeight: nodeEl存在, 测量高度=${measuredHeight}`);
            if (measuredHeight > 0) {
                return Math.min(measuredHeight, maxHeight);
            }
            debug(`测量失败，回退到计算方式`);
        } else {
            debug(`calculateTextNodeHeight: nodeEl不存在，使用计算方式`);
        }

        // 回退到计算方式
        const computedHeight = this.calculateTextNodeHeightComputed(content, nodeWidth);
        debug(`计算方式得到高度=${computedHeight}`);
        return computedHeight;
    }

    public async adjustNodeHeightAfterRender(nodeId: string) {
        // 调整指定节点的高度
        try {
            const canvasFilePath = this.canvasFileService.getCurrentCanvasFilePath();
            if (!canvasFilePath) return;

            // 使用原子操作调整高度
            await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (canvasData) => {
                if (!canvasData.nodes) return false;

                // 找到指定节点
                const node = canvasData.nodes.find((n: any) => n.id === nodeId);
                if (!node) return false;

                // 只处理文本节点
                if (!node.type || node.type === 'text') {
                    if (node.text) {
                        // 检测是否是公式节点
                        const isFormula = this.settings.enableFormulaDetection && 
                            node.text.trim().startsWith('$$') && 
                            node.text.trim().endsWith('$$');

                        let newHeight: number;

                        if (isFormula) {
                            newHeight = this.settings.formulaNodeHeight || 80;
                            node.width = this.settings.formulaNodeWidth || 400;
                        } else {
                            // 获取节点 DOM 元素以计算实际高度
                            const canvasView = this.getCanvasView();
                            const canvas = canvasView ? (canvasView as any).canvas : null;
                            let nodeEl: Element | undefined;
                            if (canvas?.nodes) {
                                const nodeData = canvas.nodes.get(nodeId);
                                if (nodeData?.nodeEl) {
                                    nodeEl = nodeData.nodeEl;
                                }
                            }
                            const calculatedHeight = this.calculateTextNodeHeight(node.text, nodeEl);
                            const maxHeight = this.settings.textNodeMaxHeight || 800;
                            newHeight = Math.min(calculatedHeight, maxHeight);
                        }

                        if (node.height !== newHeight) {
                            node.height = newHeight;
                            info(`新节点 ${nodeId} 高度已调整为 ${newHeight}`);
                            return true;
                        }
                    }
                }
                return false;
            });
        } catch (err) {
            info(`调整新节点高度失败: ${err}`);
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
