import { App, ItemView, MarkdownView, Notice, Plugin, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../settings/types';
import { CollapseStateManager } from '../state/collapse-state';
import { debug, info, warn, error, trace, logTime } from '../utils/logger';
import { safeJsonParse } from '../utils/json-utils';
import { getNodeIdFromElement } from '../utils/dom-utils';
import { FromLink, CanvasNode } from './types';

/**
 * 节点管理器 - 负责节点相关的操作
 */
export class NodeManager {
    private plugin: Plugin;
    private app: App;
    private settings: CanvasMindmapBuildSettings;
    private collapseStateManager: CollapseStateManager;

    constructor(
        plugin: Plugin,
        app: App,
        settings: CanvasMindmapBuildSettings,
        collapseStateManager: CollapseStateManager
    ) {
        this.plugin = plugin;
        this.app = app;
        this.settings = settings;
        this.collapseStateManager = collapseStateManager;
        debug('NodeManager 实例化完成');
    }

    /**
     * 添加节点到Canvas
     */
    async addNodeToCanvas(content: string, sourceFile: TFile | null) {
        const endTimer = logTime('addNodeToCanvas');
        
        // 优先使用设置中的 canvas 文件路径
        let canvasFilePath: string | undefined = this.settings.canvasFilePath;
        
        // 如果设置中没有路径，再尝试获取当前打开的 canvas
        if (!canvasFilePath) {
            // 方法1: 使用 getActiveViewOfType
            let activeView = this.app.workspace.getActiveViewOfType(ItemView);
            
            // 方法2: 如果失败，尝试从 activeLeaf 获取
            if (!activeView || activeView.getViewType() !== 'canvas') {
                const activeLeaf = this.app.workspace.activeLeaf;
                if (activeLeaf?.view && (activeLeaf.view as any).canvas) {
                    activeView = activeLeaf.view as ItemView;
                }
            }
            
            // 方法3: 遍历所有 leaves 查找 Canvas
            if (!activeView || activeView.getViewType() !== 'canvas') {
                const canvasLeaves = this.app.workspace.getLeavesOfType('canvas');
                for (const leaf of canvasLeaves) {
                    if (leaf.view && (leaf.view as any).canvas) {
                        activeView = leaf.view as ItemView;
                        break;
                    }
                }
            }
            
            if (activeView?.getViewType() === 'canvas') {
                const canvas = (activeView as any).canvas;
                // 尝试多种方式获取文件路径
                if (canvas?.file?.path) {
                    canvasFilePath = canvas.file.path;
                } else if ((activeView as any).file?.path) {
                    canvasFilePath = (activeView as any).file.path;
                }
                
                if (canvasFilePath) {
                    debug(`使用当前打开的 Canvas 文件: ${canvasFilePath}`);
                }
            }
        }
        
        // 如果仍然没有路径，提示用户配置
        if (!canvasFilePath) {
            new Notice('请先在设置中配置 Canvas 文件路径，或打开一个 Canvas 文件');
            warn('未配置 Canvas 文件路径，且没有打开的 Canvas 文件');
            return;
        }
        
        const canvasFile = this.app.vault.getAbstractFileByPath(canvasFilePath);
        if (!(canvasFile instanceof TFile)) {
            new Notice(`Canvas 文件不存在: ${canvasFilePath}`);
            error(`Canvas 文件不存在: ${canvasFilePath}`);
            return;
        }

        try {
            const canvasContent = await this.app.vault.read(canvasFile);
            
            // 安全解析Canvas文件内容
            let canvasData: any;
            try {
                canvasData = JSON.parse(canvasContent);
            } catch (parseError) {
                new Notice('Canvas文件格式错误，请检查文件内容');
                error('Canvas 文件解析失败:', parseError);
                return;
            }
            
            if (!canvasData.nodes) canvasData.nodes = [];
            if (!canvasData.edges) canvasData.edges = [];
            if (!canvasData.canvasMindmapBuildHistory) canvasData.canvasMindmapBuildHistory = [];

            let parentForEdge: any;
            let positionReferenceNode: any;
            let positionAs: 'child' | 'sibling' = 'child';

            // 获取最后点击的节点ID（需要从插件中获取）
            const lastClickedNodeId = (this.plugin as any).lastClickedNodeId;
            if (lastClickedNodeId) {
                const clickedNode = canvasData.nodes.find((n: any) => n.id === lastClickedNodeId);
                if (clickedNode) {
                    parentForEdge = clickedNode;
                    positionReferenceNode = clickedNode;
                    positionAs = 'child';
                    debug(`使用最后点击的节点作为父节点: ${lastClickedNodeId}`);
                } else {
                    (this.plugin as any).lastClickedNodeId = null;
                    await this.plugin.saveData({ lastClickedNodeId: null });
                }
            }
            
            if (!positionReferenceNode) {
                while (canvasData.canvasMindmapBuildHistory.length > 0) {
                    const lastId = canvasData.canvasMindmapBuildHistory.pop();
                    const lastNode = canvasData.nodes.find((n: any) => n.id === lastId);
                    if (lastNode) {
                        positionReferenceNode = lastNode;
                        const parentEdge = canvasData.edges.find((e: any) => e.toNode === lastNode.id);
                        if (parentEdge) {
                            parentForEdge = canvasData.nodes.find((n: any) => n.id === parentEdge.fromNode);
                        }
                        positionAs = 'sibling';
                        canvasData.canvasMindmapBuildHistory.push(lastId);
                        debug(`使用历史节点作为参考: ${lastId}`);
                        break;
                    }
                }
                
                if (!positionReferenceNode) {
                    // 恢复原始的简单字符串检查逻辑，避免JSON解析错误
                    const nodesWithFromLink = canvasData.nodes.filter((n: any) => 
                        (n.text?.includes('<!-- fromLink:')) || (n.color?.startsWith('fromLink:'))
                    );
                    
                    if (nodesWithFromLink.length > 0) {
                        const lastNode = nodesWithFromLink[nodesWithFromLink.length - 1];
                        positionReferenceNode = lastNode;
                        const parentEdge = canvasData.edges.find((e: any) => e.toNode === lastNode.id);
                        if (parentEdge) {
                            parentForEdge = canvasData.nodes.find((n: any) => n.id === parentEdge.fromNode);
                        }
                        positionAs = 'sibling';
                        debug(`使用 fromLink 节点作为参考: ${lastNode.id}`);
                    }
                }
            }

            const newNodeId = this.generateRandomId();
            const newNode: any = { id: newNodeId };

            // 检测公式（以 $$ 开头，$$ 结尾）
            const trimmedContent = content.trim();
            const formulaMatch = this.settings.enableFormulaDetection && 
                trimmedContent.startsWith('$$') && 
                trimmedContent.endsWith('$$') &&
                trimmedContent.length > 4;

            if (formulaMatch) {
                // 公式节点
                newNode.type = 'text';
                newNode.text = content;
                newNode.width = this.settings.formulaNodeWidth || 600;
                newNode.height = this.settings.formulaNodeHeight || 200;
                debug('创建公式节点');
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
                    debug(`创建图片节点: ${imagePath}`);
                } else {
                    newNode.type = 'text';
                    newNode.text = content;
                    newNode.width = this.settings.textNodeWidth || 250;
                    newNode.height = this.calculateTextNodeHeight(content);
                    debug('创建文本节点');
                }
            }

            if (sourceFile) {
                const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
                if (editor) {
                    const selection = editor.listSelections()[0];
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
                            debug(`添加 fromLink: ${sourceFile.path}`);
                        } catch (jsonError) {
                            // 如果 JSON.stringify 失败，跳过 fromLink 添加
                            warn('fromLink JSON 序列化失败:', jsonError);
                        }
                    }
                }
            }
            
            if (positionReferenceNode) {
                if (positionAs === 'sibling') {
                    newNode.x = positionReferenceNode.x;
                    newNode.y = positionReferenceNode.y + (positionReferenceNode.height || 60) + (this.settings.verticalSpacing || 50);
                    debug(`定位节点为兄弟节点: (${newNode.x}, ${newNode.y})`);
                } else {
                    const siblings = canvasData.nodes.filter((n: any) => 
                        canvasData.edges.some((e: any) => e.fromNode === positionReferenceNode?.id && e.toNode === n.id)
                    );
                    if (siblings.length > 0) {
                        const bottomSibling = siblings.reduce((prev: any, curr: any) => (prev.y > curr.y) ? prev : curr);
                        newNode.x = bottomSibling.x;
                        newNode.y = bottomSibling.y + (bottomSibling.height || 60) + (this.settings.verticalSpacing || 50);
                        debug(`定位节点为子节点（有兄弟）: (${newNode.x}, ${newNode.y})`);
                    } else {
                        newNode.x = positionReferenceNode.x + (positionReferenceNode.width || 250) + (this.settings.horizontalSpacing || 100);
                        newNode.y = positionReferenceNode.y;
                        debug(`定位节点为子节点（无兄弟）: (${newNode.x}, ${newNode.y})`);
                    }
                }
            } else {
                newNode.x = 0;
                newNode.y = 0;
                debug('定位节点为根节点: (0, 0)');
            }
            
            canvasData.nodes.push(newNode);
            canvasData.canvasMindmapBuildHistory.push(newNodeId);

            if (parentForEdge) {
                canvasData.edges.push({ 
                    id: this.generateRandomId(), 
                    fromNode: parentForEdge.id, 
                    fromSide: 'right', 
                    toNode: newNodeId, 
                    toSide: 'left' 
                });
                debug(`创建边: ${parentForEdge.id} -> ${newNodeId}`);
            }

            await this.app.vault.modify(canvasFile, JSON.stringify(canvasData, null, 2));

            this.collapseStateManager.clearCache();

            // 如果有父节点，专门针对父节点检查并添加折叠按钮
            if (parentForEdge) {
                // 这里需要调用 CanvasManager 的方法，通过事件或回调实现
                debug(`节点添加完成，父节点: ${parentForEdge.id}`);
            }

            new Notice('Node added to canvas successfully!');
            info(`节点添加成功: ${newNodeId}`);
            
        } catch (err) {
            error('添加节点失败:', err);
            new Notice('Error processing canvas file.');
        }
        
        endTimer();
    }

    /**
     * 计算文本节点高度
     */
    calculateTextNodeHeight(content: string): number {
        const minHeight = 60;
        const maxHeight = 400;
        const charsPerLine = 35;
        const lineHeight = 28;
        const verticalPadding = 20;

        const chineseCharRegex = /[\u4e00-\u9fa5]/;
        let numLines = 0;
        content.split('\n').forEach(line => {
            let lineLength = 0;
            for (const char of line) {
                lineLength += chineseCharRegex.test(char) ? 2 : 1.1;
            }
            numLines += Math.ceil(lineLength / charsPerLine) || 1;
        });

        const calculatedHeight = Math.max(minHeight, Math.min((numLines * lineHeight) + verticalPadding, maxHeight));
        trace(`计算文本节点高度: ${calculatedHeight}px (内容行数: ${numLines})`);
        return calculatedHeight;
    }

    /**
     * 生成随机ID
     */
    generateRandomId(): string {
        return Math.random().toString(36).substring(2, 10);
    }
}
