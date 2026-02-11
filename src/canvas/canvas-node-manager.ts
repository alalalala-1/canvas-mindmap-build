import { App, ItemView, Notice, Plugin, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../settings/types';
import { CollapseStateManager } from '../state/collapse-state';
import { NodeCreationService } from './services/node-creation-service';
import { NodeDeletionService } from './services/node-deletion-service';
import { CanvasFileService } from './services/canvas-file-service';
import { EditTextModal } from '../ui/edit-modal';
import { log } from '../utils/logger';
import {
    generateRandomId,
    getCanvasView,
    getCurrentCanvasFilePath,
    isFormulaContent
} from '../utils/canvas-utils';

/**
 * Canvas 节点管理器
 * 负责协调节点相关的操作，委托具体实现给各个服务
 */
export class CanvasNodeManager {
    private app: App;
    private plugin: Plugin;
    private settings: CanvasMindmapBuildSettings;
    private collapseStateManager: CollapseStateManager;
    private canvasManager: any;

    // 服务
    private canvasFileService: CanvasFileService;
    private nodeCreationService: NodeCreationService;
    private nodeDeletionService: NodeDeletionService;

    constructor(
        app: App,
        plugin: Plugin,
        settings: CanvasMindmapBuildSettings,
        collapseStateManager: CollapseStateManager,
        canvasFileService: CanvasFileService
    ) {
        this.app = app;
        this.plugin = plugin;
        this.settings = settings;
        this.collapseStateManager = collapseStateManager;
        this.canvasFileService = canvasFileService;

        // 初始化服务
        this.nodeCreationService = new NodeCreationService(
            app,
            plugin,
            settings,
            this.canvasFileService
        );
        this.nodeDeletionService = new NodeDeletionService(
            app,
            settings,
            collapseStateManager,
            this.canvasFileService
        );
    }

    /**
     * 设置 CanvasManager 实例（用于后续操作）
     */
    setCanvasManager(canvasManager: any): void {
        this.canvasManager = canvasManager;
        this.nodeCreationService.setCanvasManager(canvasManager);
        this.nodeDeletionService.setCanvasManager(canvasManager);
    }

    // ==================== 节点创建 ====================

    /**
     * 添加节点到 Canvas
     */
    async addNodeToCanvas(content: string, sourceFile: TFile | null): Promise<void> {
        return this.nodeCreationService.addNodeToCanvas(content, sourceFile);
    }

    /**
     * 调整指定节点的高度
     */
    async adjustNodeHeightAfterRender(nodeId: string): Promise<void> {
        log(`[Node] adjustNodeHeightAfterRender 被调用, nodeId=${nodeId}`);
        try {
            const canvasFilePath = this.canvasFileService.getCurrentCanvasFilePath();
            log(`[Node] canvasFilePath=${canvasFilePath || 'null'}`);
            if (!canvasFilePath) return;

            let newHeightValue: number | null = null;

            await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (canvasData) => {
                if (!canvasData.nodes) return false;

                const node = canvasData.nodes.find((n: any) => n.id === nodeId);
                log(`[Node] 查找节点: ${nodeId}, 找到=${node ? 'yes' : 'no'}`);
                if (!node) return false;

                if (!node.type || node.type === 'text') {
                    log(`[Node] 节点类型=text, text长度=${node.text?.length || 0}`);
                    if (node.text) {
                        const isFormula = this.settings.enableFormulaDetection && 
                            node.text.trim().startsWith('$$') && 
                            node.text.trim().endsWith('$$');

                        let newHeight: number;
                        if (isFormula) {
                            newHeight = this.settings.formulaNodeHeight || 80;
                            node.width = this.settings.formulaNodeWidth || 400;
                            log(`[Node] 公式节点, newHeight=${newHeight}`);
                        } else {
                            const canvasView = getCanvasView(this.app);
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
                            log(`[Node] 计算高度: calculated=${calculatedHeight}, max=${maxHeight}, newHeight=${newHeight}, currentHeight=${node.height}`);
                        }

                        if (node.height !== newHeight) {
                            log(`[Node] 更新高度: ${node.height} -> ${newHeight}`);
                            node.height = newHeight;
                            newHeightValue = newHeight;
                            return true;
                        } else {
                            log(`[Node] 高度未变化，跳过更新`);
                            // 即使高度没变，也要记录 newHeightValue 以便触发同步
                            newHeightValue = node.height;
                            return false;
                        }
                    }
                }
                return false;
            });

            // 无论原子修改是否返回 true（即数据是否真的变了），我们都尝试同步内存状态
            // 这对于新创建的节点非常重要，因为它们可能已经有正确的高度但在 DOM 中没渲染对
            const currentHeight = newHeightValue;
            if (currentHeight !== null) {
                const canvasView = getCanvasView(this.app);
                const canvas = canvasView ? (canvasView as any).canvas : null;
                if (canvas?.nodes) {
                    const nodeData = canvas.nodes.get(nodeId);
                    if (nodeData) {
                        log(`[Node] 同步更新内存节点高度: ${currentHeight}`);
                        nodeData.height = currentHeight;
                        if (nodeData.nodeEl) {
                            nodeData.nodeEl.style.height = `${currentHeight}px`;
                        }
                        if (typeof nodeData.render === 'function') {
                            nodeData.render();
                        }
                        // 如果是刚创建的节点，可能需要再次调用以确保 DOM 稳定后的最终调整
                        if (!nodeData.nodeEl || nodeData.nodeEl.clientHeight === 0) {
                            setTimeout(() => {
                                this.adjustNodeHeightAfterRender(nodeId);
                            }, 500);
                        }
                        if (typeof canvas.requestSave === 'function') {
                            canvas.requestSave();
                        }
                    }
                }
            }
        } catch (err) {
            log(`[Node] 调整高度失败: ${nodeId}`, err);
        }
    }

    /**
     * 调整所有文本节点的高度
     */
    async adjustAllTextNodeHeights(): Promise<number> {
        try {
            const canvasFilePath = this.canvasFileService.getCurrentCanvasFilePath();
            if (!canvasFilePath) {
                log(`[Node] 批量调整跳过: 找不到当前 Canvas 路径`);
                return 0;
            }

            log(`[Node] 开始批量调整高度: ${canvasFilePath}`);
            
            let adjustedCount = 0;

            await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (canvasData) => {
                if (!canvasData.nodes) return false;

                const maxHeight = this.settings.textNodeMaxHeight || 800;
                let changed = false;

                const canvasView = getCanvasView(this.app);
                const canvas = canvasView ? (canvasView as any).canvas : null;
                const nodeDomMap = new Map<string, any>();
                
                if (canvas?.nodes) {
                    for (const [id, nodeData] of canvas.nodes) {
                        if (nodeData?.nodeEl) {
                            nodeDomMap.set(id, nodeData);
                        }
                    }
                }

                for (const node of canvasData.nodes) {
                    if (!node.type || node.type === 'text') {
                        if (node.text) {
                            const isFormula = this.settings.enableFormulaDetection && 
                                node.text.trim().startsWith('$$') && 
                                node.text.trim().endsWith('$$');

                            let newHeight: number;
                            if (isFormula) {
                                newHeight = this.settings.formulaNodeHeight || 80;
                                node.width = this.settings.formulaNodeWidth || 400;
                            } else {
                                const nodeData = nodeDomMap.get(node.id);
                                const nodeEl = nodeData?.nodeEl;
                                const calculatedHeight = this.calculateTextNodeHeight(node.text, nodeEl);
                                newHeight = Math.min(calculatedHeight, maxHeight);
                                
                                
                            }

                            // 更新文件数据
                            if (node.height !== newHeight) {
                                node.height = newHeight;
                                adjustedCount++;
                                changed = true;
                            }

                            // 强制同步内存和渲染高度（即使文件数据没变，也要确保内存和 DOM 一致）
                            const nodeData = nodeDomMap.get(node.id);
                            if (nodeData) {
                                if (nodeData.height !== newHeight) {
                                    nodeData.height = newHeight;
                                    if (nodeData.nodeEl) {
                                        nodeData.nodeEl.style.height = `${newHeight}px`;
                                    }
                                    if (typeof nodeData.render === 'function') {
                                        nodeData.render();
                                    }
                                }
                            }
                        }
                    }
                }
                return changed;
            });

            const canvasView = getCanvasView(this.app);
            if (canvasView) {
                const canvas = (canvasView as any).canvas;
                if (canvas) {
                    if (typeof canvas.requestSave === 'function') canvas.requestSave();
                    if (typeof canvas.requestUpdate === 'function') canvas.requestUpdate();
                }
            }

            if (adjustedCount > 0) {
                new Notice(`已调整 ${adjustedCount} 个节点高度`);
                log(`[Node] 批量调整完成: ${adjustedCount}`);
            } else {
                log(`[Node] 批量调整完成: 无需更新节点高度`);
            }
            return adjustedCount;
        } catch (err) {
            log(`[Node] 批量调整失败:`, err);
            return 0;
        }
    }

    /**
     * 创建新节点（从当前选中的文本）
     */
    async createNewNode(): Promise<void> {
        const activeView = this.app.workspace.getActiveViewOfType(ItemView);
        if (!activeView) {
            new Notice('请先打开一个文件');
            return;
        }

        const editor = (activeView as any).editor;
        if (!editor) {
            new Notice('当前视图不支持文本选择');
            return;
        }

        const selection = editor.getSelection();
        if (!selection || selection.trim().length === 0) {
            new Notice('请先选择要添加的文本');
            return;
        }

        const sourceFile = (activeView as any).file;
        if (!sourceFile) {
            new Notice('无法获取当前文件');
            return;
        }

        await this.addNodeToCanvas(selection, sourceFile);
    }

    // ==================== 节点删除 ====================

    /**
     * 执行删除操作
     */
    async executeDeleteOperation(selectedNode: any, canvas: any): Promise<void> {
        return this.nodeDeletionService.executeDeleteOperation(selectedNode, canvas);
    }

    /**
     * 处理单节点删除
     */
    async handleSingleDelete(node: any, canvas: any): Promise<void> {
        return this.nodeDeletionService.handleSingleDelete(node, canvas);
    }

    /**
     * 处理级联删除
     */
    async handleCascadeDelete(node: any, canvas: any): Promise<void> {
        return this.nodeDeletionService.handleCascadeDelete(node, canvas);
    }

    // ==================== 节点编辑 ====================

    /**
     * 编辑节点文本
     */
    async editNodeText(node: any, canvas: any): Promise<void> {
        const currentText = node.text || '';

        const modal = new EditTextModal(
            this.app,
            currentText,
            async (newText: string) => {
                if (newText && newText !== currentText) {
                    try {
                        const currentCanvasView = getCanvasView(this.app);
                        const canvasFilePath = currentCanvasView ? this.canvasFileService.getCanvasFilePathFromView(currentCanvasView) : undefined;
                        if (!canvasFilePath) {
                            throw new Error('无法获取 Canvas 文件路径');
                        }

                        await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (data: any) => {
                            const nodeData = data.nodes.find((n: any) => n.id === node.id);
                            if (nodeData && nodeData.text !== newText) {
                                nodeData.text = newText;
                                return true;
                            }
                            return false;
                        });

                        if (typeof canvas.reload === 'function') {
                            canvas.reload();
                        }

                        this.refreshNodeAndButtons();
                    } catch (err) {
                        log(`[Node] 更新文本失败: ${err}`);
                    }
                }
            }
        );

        modal.open();
    }

    /**
     * 刷新节点和按钮
     */
    private refreshNodeAndButtons(): void {
        const canvasView = getCanvasView(this.app);
        if (canvasView && this.canvasManager) {
            // 检查折叠按钮（已有防抖机制）
            this.canvasManager.checkAndAddCollapseButtons();
        }
    }

    // ==================== 节点高度调整 ====================

    /**
     * 调整节点高度
     */
    adjustNodeHeight(nodeId: string, newHeight: number): void {
        const canvasView = getCanvasView(this.app);
        if (!canvasView) return;

        const canvas = (canvasView as any).canvas;
        const node = canvas.nodes.get(nodeId);

        if (!node) return;

        if (node.height !== newHeight) {
            node.height = newHeight;
            node.render();
            canvas.requestSave();
        }
    }

    // ==================== 工具方法 ====================

    /**
     * 获取当前 Canvas 文件路径
     */
    getCurrentCanvasFilePath(): string | undefined {
        return getCurrentCanvasFilePath(this.app);
    }

    // ==================== 高度计算逻辑 ====================

    public calculateTextNodeHeight(content: string, nodeEl?: Element): number {
        const maxHeight = this.settings.textNodeMaxHeight || 800;
        const nodeWidth = this.settings.textNodeWidth || 400;

        if (nodeEl) {
            const measuredHeight = this.measureActualContentHeight(nodeEl, content);
            if (measuredHeight > 0) {
                return Math.min(measuredHeight, maxHeight);
            }
        }

        const computedHeight = this.calculateTextNodeHeightComputed(content, nodeWidth);
        return computedHeight;
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
                        return Math.ceil(parsedMinHeight + 24);
                    }
                }
            }

            if (contentEl) {
                const pElement = contentEl.querySelector('p');
                if (pElement) {
                    const pRect = pElement.getBoundingClientRect();
                    const pStyles = window.getComputedStyle(pElement);
                    const lineHeight = parseFloat(pStyles.lineHeight) || 24;
                    
                    const actualLines = Math.max(1, Math.round(pRect.height / lineHeight));
                    
                    const styles = window.getComputedStyle(contentEl);
                    const paddingTop = parseFloat(styles.paddingTop) || 8;
                    const paddingBottom = parseFloat(styles.paddingBottom) || 8;

                    return Math.ceil(actualLines * lineHeight + paddingTop + paddingBottom + 20);
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
            log(`[Node] 测量高度异常: ${e}`);
        }
        return 0;
    }

    /**
     * 基于计算的高度估算（当无法测量 DOM 时使用）
     * 使用更保守的估计，确保内容不被截断
     */
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

        return Math.max(minHeight, Math.min(calculatedHeight, maxHeight));
    }

    /**
     * 读取 Canvas 数据
     */
    async readCanvasData(filePath: string): Promise<any | null> {
        return this.canvasFileService.readCanvasData(filePath);
    }

    /**
     * 生成随机 ID
     */
    generateRandomId(): string {
        return generateRandomId();
    }
}
