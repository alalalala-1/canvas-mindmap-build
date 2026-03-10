import { App, ItemView, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../../settings/types';
import { log } from '../../utils/logger';
import { estimateTextNodeHeight, getCurrentCanvasFilePath, getEdgeFromNodeId, getEdgeToNodeId, isFormulaContent, isImageContent, parseFloatingNodeInfo } from '../../utils/canvas-utils';
import { 
    CanvasDataLike, 
    CanvasNodeLike, 
    CanvasEdgeLike, 
    FloatingNodesMetadata,
    CanvasViewLike
} from '../types';

export type UpdateCallback = (data: CanvasDataLike) => boolean | Promise<boolean>;

export class CanvasFileService {
    private app: App;
    private settings: CanvasMindmapBuildSettings;

    constructor(app: App, settings: CanvasMindmapBuildSettings) {
        this.app = app;
        this.settings = settings;
    }

    getFloatingNodesInfo(canvasData: CanvasDataLike | null): {
        floatingNodes: Set<string>,
        originalParents: Map<string, string>
    } {
        const floatingNodes = new Set<string>();
        const originalParents = new Map<string, string>();

        if (!canvasData) return { floatingNodes, originalParents };

        // 1. 从 metadata 读取（向后兼容）
        const metadata = canvasData.metadata?.floatingNodes as FloatingNodesMetadata | undefined;
        if (metadata) {
            for (const [nodeId, info] of Object.entries(metadata)) {
                const { isFloating, originalParent } = parseFloatingNodeInfo(info);
                if (isFloating) {
                    floatingNodes.add(nodeId);
                    if (originalParent) {
                        originalParents.set(nodeId, originalParent);
                    }
                }
            }
        }

        // 2. 从节点本身的 data 属性读取（主要方式）
        const nodes = this.getNodes(canvasData);
        for (const node of nodes) {
            if (node.data?.isFloating) {
                floatingNodes.add(node.id!);
                if (node.data.originalParent) {
                    originalParents.set(node.id!, node.data.originalParent);
                }
            }
        }

        return { floatingNodes, originalParents };
    }

    getEdges(canvasData: CanvasDataLike | null): CanvasEdgeLike[] {
        if (!canvasData?.edges) return [];
        return Array.isArray(canvasData.edges) ? canvasData.edges : [];
    }

    getNodes(canvasData: CanvasDataLike | null): CanvasNodeLike[] {
        if (!canvasData?.nodes) return [];
        return Array.isArray(canvasData.nodes) ? canvasData.nodes : [];
    }

    getCurrentCanvasFilePath(): string | undefined {
        const currentPath = getCurrentCanvasFilePath(this.app);
        if (currentPath) return currentPath;

        if (this.settings.canvasFilePath) {
            return this.settings.canvasFilePath;
        }

        return undefined;
    }

    getCanvasFilePathFromView(canvasView: ItemView): string | undefined {
        const canvas = (canvasView as CanvasViewLike).canvas;
        if (canvas?.file?.path) {
            return canvas.file.path;
        }

        const viewFile = (canvasView as CanvasViewLike).file;
        if (viewFile?.path) {
            return viewFile.path;
        }

        if (this.settings.canvasFilePath) {
            return this.settings.canvasFilePath;
        }

        return undefined;
    }

    private normalizeCanvasData(canvasData: CanvasDataLike): { changed: boolean; summary: string } {
        let changed = false;
        let fixedNodes = 0;
        let removedNodes = 0;
        let fixedEdges = 0;
        let removedEdges = 0;

        if (!Array.isArray(canvasData.nodes)) {
            canvasData.nodes = [];
            changed = true;
        }
        if (!Array.isArray(canvasData.edges)) {
            canvasData.edges = [];
            changed = true;
        }
        if (!canvasData.metadata) {
            canvasData.metadata = {};
            changed = true;
        }

        const seenNodeIds = new Set<string>();
        const normalizedNodes: CanvasNodeLike[] = [];
        for (const node of canvasData.nodes) {
            const nodeId = node?.id;
            if (!nodeId || seenNodeIds.has(nodeId)) {
                removedNodes++;
                changed = true;
                continue;
            }
            seenNodeIds.add(nodeId);
            let nodeChanged = false;
            if (!node.type) {
                node.type = 'text';
                nodeChanged = true;
            }
            if (typeof node.x !== 'number' || Number.isNaN(node.x)) {
                node.x = 0;
                nodeChanged = true;
            }
            if (typeof node.y !== 'number' || Number.isNaN(node.y)) {
                node.y = 0;
                nodeChanged = true;
            }

            const textNodeWidth = this.settings.textNodeWidth || 300;
            const textNodeMaxHeight = this.settings.textNodeMaxHeight || 400;
            const imageNodeWidth = this.settings.imageNodeWidth || 400;
            const imageNodeHeight = this.settings.imageNodeHeight || 400;
            const formulaNodeWidth = this.settings.formulaNodeWidth || 600;
            const formulaNodeHeight = this.settings.formulaNodeHeight || 200;

            const nodeText = node.text || '';
            const isFormula = this.settings.enableFormulaDetection ? isFormulaContent(nodeText) : false;
            const isImage = isImageContent(nodeText);

            if (isFormula) {
                // [修复] 只在宽度/高度缺失或无效时才用默认值兜底
                // 不强制覆盖已有的有效值，因为 arrange 写入的高度是真正的 DOM 测量值
                if (!node.width || node.width <= 0) {
                    node.width = formulaNodeWidth;
                    nodeChanged = true;
                }
                if (!node.height || node.height <= 0) {
                    node.height = formulaNodeHeight;
                    nodeChanged = true;
                }
            } else if (isImage) {
                if (!node.width || node.width <= 0) {
                    node.width = imageNodeWidth;
                    nodeChanged = true;
                }
                if (!node.height || node.height <= 0) {
                    node.height = imageNodeHeight;
                    nodeChanged = true;
                }
            } else if (!node.type || node.type === 'text') {
                if (!node.width || node.width <= 0) {
                    node.width = textNodeWidth;
                    nodeChanged = true;
                }
                if (!node.height || node.height <= 0) {
                    node.height = estimateTextNodeHeight(nodeText, node.width || textNodeWidth, textNodeMaxHeight);
                    nodeChanged = true;
                }
            } else {
                if (!node.width || node.width <= 0) {
                    node.width = textNodeWidth;
                    nodeChanged = true;
                }
                if (!node.height || node.height <= 0) {
                    node.height = textNodeMaxHeight;
                    nodeChanged = true;
                }
            }

            if (nodeChanged) {
                fixedNodes++;
                changed = true;
            }
            normalizedNodes.push(node);
        }
        canvasData.nodes = normalizedNodes;

        const seenEdgeIds = new Set<string>();
        const normalizedEdges: CanvasEdgeLike[] = [];
        for (const edge of canvasData.edges) {
            const fromId = getEdgeFromNodeId(edge);
            const toId = getEdgeToNodeId(edge);
            if (!fromId || !toId || !seenNodeIds.has(fromId) || !seenNodeIds.has(toId)) {
                removedEdges++;
                changed = true;
                continue;
            }
            let edgeChanged = false;
            if (!edge.fromNode) {
                edge.fromNode = fromId;
                edgeChanged = true;
            }
            if (!edge.toNode) {
                edge.toNode = toId;
                edgeChanged = true;
            }
            if (!edge.id) {
                let edgeId = `${fromId}->${toId}`;
                let suffix = 1;
                while (seenEdgeIds.has(edgeId)) {
                    suffix += 1;
                    edgeId = `${fromId}->${toId}:${suffix}`;
                }
                edge.id = edgeId;
                edgeChanged = true;
            }
            if (edgeChanged) {
                fixedEdges++;
                changed = true;
            }
            if (edge.id) {
                seenEdgeIds.add(edge.id);
            }
            normalizedEdges.push(edge);
        }
        canvasData.edges = normalizedEdges;

        const summary = `nodes=${canvasData.nodes.length}, edges=${canvasData.edges.length}, fixedNodes=${fixedNodes}, removedNodes=${removedNodes}, fixedEdges=${fixedEdges}, removedEdges=${removedEdges}`;
        return { changed, summary };
    }

    async normalizeCanvasDataAtomic(filePath: string): Promise<boolean> {
        return this.modifyCanvasDataAtomic(filePath, (data) => {
            const { changed, summary } = this.normalizeCanvasData(data);
            if (changed) {
                log(`[Normalize] ${summary}`);
            }
            return changed;
        });
    }

    async readCanvasData(filePath: string): Promise<CanvasDataLike | null> {
        const canvasFile = this.app.vault.getAbstractFileByPath(filePath);
        if (!(canvasFile instanceof TFile)) return null;

        try {
            const canvasContent = await this.app.vault.read(canvasFile);
            return JSON.parse(canvasContent) as CanvasDataLike;
        } catch (parseError) {
            log('[File] 解析失败:', parseError);
            return null;
        }
    }

    async modifyCanvasDataAtomic(
        filePath: string,
        updateCallback: UpdateCallback
    ): Promise<boolean> {
        const canvasFile = this.app.vault.getAbstractFileByPath(filePath);
        if (!(canvasFile instanceof TFile)) {
            log(`[File] 原子修改失败: 找不到 canvas 文件 ${filePath}`);
            return false;
        }

        try {
            log(`[File] 原子修改开始: ${filePath}`);
            const content = await this.app.vault.read(canvasFile);
            const data = JSON.parse(content) as CanvasDataLike;

            const shouldModify = await updateCallback(data);
            log(`[File] 原子修改第一次检查: file=${filePath}, shouldModify=${shouldModify}`);

            if (shouldModify) {
                const latestContent = await this.app.vault.read(canvasFile);
                const latestData = JSON.parse(latestContent) as CanvasDataLike;
                
                const finalShouldModify = await updateCallback(latestData);
                log(`[File] 原子修改第二次检查: file=${filePath}, finalShouldModify=${finalShouldModify}`);
                
                if (finalShouldModify) {
                    const output = JSON.stringify(latestData, null, 2);
                    await this.app.vault.modify(canvasFile, output);
                    log(`[File] 原子修改成功: ${filePath}`);
                    return true;
                }

                log(`[File] 原子修改取消: file=${filePath}, reason=finalShouldModify=false`);
                return false;
            }

            log(`[File] 原子修改取消: file=${filePath}, reason=shouldModify=false`);
            return false;
        } catch (err) {
            log(`[File] 原子修改失败: ${filePath}`, err);
            return false;
        }
    }

    async saveCanvasData(filePath: string, data: CanvasDataLike): Promise<boolean> {
        const canvasFile = this.app.vault.getAbstractFileByPath(filePath);
        if (!(canvasFile instanceof TFile)) {
            log(`[File] 未找到文件: ${filePath}`);
            return false;
        }

        try {
            await this.app.vault.modify(canvasFile, JSON.stringify(data, null, 2));
            return true;
        } catch (err) {
            log('[File] 保存失败:', err);
            return false;
        }
    }
}
