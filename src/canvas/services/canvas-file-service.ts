import { App, ItemView, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../../settings/types';
import { log } from '../../utils/logger';
import { getCurrentCanvasFilePath } from '../../utils/canvas-utils';
import { 
    CanvasDataLike, 
    CanvasNodeLike, 
    CanvasEdgeLike, 
    FloatingNodesMetadata,
    FloatingNodeRecord,
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
                if (typeof info === 'boolean' && info === true) {
                    floatingNodes.add(nodeId);
                } else if (typeof info === 'object' && info !== null) {
                    const nodeInfo = info as FloatingNodeRecord;
                    if (nodeInfo.isFloating) {
                        floatingNodes.add(nodeId);
                        if (nodeInfo.originalParent) {
                            originalParents.set(nodeId, nodeInfo.originalParent);
                        }
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
        if (!(canvasFile instanceof TFile)) return false;

        try {
            const content = await this.app.vault.read(canvasFile);
            const data = JSON.parse(content) as CanvasDataLike;

            const shouldModify = await updateCallback(data);
            log(`[File] 原子修改第一次检查: shouldModify=${shouldModify}`);

            if (shouldModify) {
                const latestContent = await this.app.vault.read(canvasFile);
                const latestData = JSON.parse(latestContent) as CanvasDataLike;
                
                const finalShouldModify = await updateCallback(latestData);
                log(`[File] 原子修改第二次检查: finalShouldModify=${finalShouldModify}`);
                
                if (finalShouldModify) {
                    const output = JSON.stringify(latestData, null, 2);
                    await this.app.vault.modify(canvasFile, output);
                    log(`[File] 原子修改成功: ${filePath}`);
                    return true;
                }
            }
            return false;
        } catch (err) {
            log('[File] 原子修改失败:', err);
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
