import { App, ItemView, Notice, Plugin, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../settings/types';
import { CollapseStateManager } from '../state/collapse-state';
import { NodeCreationService } from './services/node-creation-service';
import { NodeDeletionService } from './services/node-deletion-service';
import { CanvasFileService } from './services/canvas-file-service';
import { EditTextModal } from '../ui/edit-modal';
import { debug, info, warn, error } from '../utils/logger';
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
        return this.nodeCreationService.adjustNodeHeightAfterRender(nodeId);
    }

    /**
     * 调整所有文本节点的高度
     */
    async adjustAllTextNodeHeights(): Promise<void> {
        try {
            const canvasFilePath = this.canvasFileService.getCurrentCanvasFilePath();
            if (!canvasFilePath) {
                new Notice('No canvas file is currently open.');
                return;
            }

            info(`开始调整所有文本节点高度: ${canvasFilePath}`);
            
            // 使用原子操作调整所有节点高度
            let adjustedCount = 0;
            let skippedCount = 0;

            await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (canvasData) => {
                if (!canvasData.nodes) return false;

                const maxHeight = this.settings.textNodeMaxHeight || 800;
                let changed = false;

                // 获取当前 canvas 视图中已渲染的节点 DOM 元素映射
                const canvasView = getCanvasView(this.app);
                const canvas = canvasView ? (canvasView as any).canvas : null;
                const nodeDomMap = new Map<string, Element>();
                
                if (canvas?.nodes) {
                    for (const [nodeId, nodeData] of canvas.nodes) {
                        if (nodeData?.nodeEl) {
                            nodeDomMap.set(nodeId, nodeData.nodeEl);
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
                                const nodeEl = nodeDomMap.get(node.id);
                                const calculatedHeight = (this.nodeCreationService as any).calculateTextNodeHeight(node.text, nodeEl);
                                newHeight = Math.min(calculatedHeight, maxHeight);
                            }

                            if (node.height !== newHeight) {
                                node.height = newHeight;
                                adjustedCount++;
                                changed = true;
                            } else {
                                skippedCount++;
                            }
                        }
                    }
                }
                return changed;
            });

            new Notice(`Adjusted ${adjustedCount} nodes, skipped ${skippedCount} nodes.`);
            info(`调整了 ${adjustedCount} 个节点，跳过了 ${skippedCount} 个节点`);
        } catch (err) {
            error(`调整节点高度失败: ${err}`);
            new Notice('Failed to adjust node heights.');
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
                        new Notice('节点文本已更新');
                    } catch (err) {
                        error('更新节点文本失败:', err);
                        new Notice('更新节点文本失败');
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
            this.canvasManager.checkAndAddCollapseButtons();
            this.canvasManager.scheduleButtonCheck();
        }
    }

    // ==================== 节点高度调整 ====================

    /**
     * 调整节点高度
     */
    adjustNodeHeight(nodeId: string, newHeight: number): void {
        const canvasView = getCanvasView(this.app);
        if (!canvasView) {
            warn('[adjustNodeHeight] 未找到 Canvas 视图');
            return;
        }

        const canvas = (canvasView as any).canvas;
        const node = canvas.nodes.get(nodeId);

        if (!node) {
            warn(`[adjustNodeHeight] 未找到节点 ${nodeId}`);
            return;
        }

        // 更新节点高度
        if (node.height !== newHeight) {
            node.height = newHeight;
            node.render();
            canvas.requestSave();

            info(`[adjustNodeHeight] 节点 ${nodeId} 高度已调整为 ${newHeight}`);
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

        debug(`calculateTextNodeHeightComputed: 行数=${totalLines}, 行高=${lineHeight}, 高度=${calculatedHeight}`);

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
