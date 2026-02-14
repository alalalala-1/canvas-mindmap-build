import { App, ItemView, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../../settings/types';
import { log } from '../../utils/logger';
import { getCurrentCanvasFilePath, parseFloatingNodeInfo } from '../../utils/canvas-utils';
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
    private fileLocks: Map<string, boolean> = new Map();
    private pendingOperations: Map<string, Array<() => void>> = new Map();

    constructor(app: App, settings: CanvasMindmapBuildSettings) {
        this.app = app;
        this.settings = settings;
    }

    /**
     * 获取文件锁
     */
    private acquireLock(filePath: string): boolean {
        if (this.fileLocks.get(filePath)) {
            log(`[File] 锁已被占用: ${filePath}`);
            return false;
        }
        this.fileLocks.set(filePath, true);
        log(`[File] 获取锁: ${filePath}`);
        return true;
    }

    /**
     * 释放文件锁
     */
    private releaseLock(filePath: string): void {
        this.fileLocks.set(filePath, false);
        log(`[File] 释放锁: ${filePath}`);
        // 执行等待的操作
        const pending = this.pendingOperations.get(filePath);
        if (pending && pending.length > 0) {
            const nextOp = pending.shift();
            if (nextOp) {
                log(`[File] 执行等待的操作: ${filePath}, 剩余=${pending.length}`);
                setTimeout(nextOp, 100);
            }
        }
    }

    /**
     * 等待锁释放
     */
    private waitForLock(filePath: string, callback: () => void): void {
        if (!this.pendingOperations.has(filePath)) {
            this.pendingOperations.set(filePath, []);
        }
        this.pendingOperations.get(filePath)!.push(callback);
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
        // 如果获取不到锁，延迟执行
        if (!this.acquireLock(filePath)) {
            log(`[File] 文件被锁定，等待重试: ${filePath}`);
            return new Promise((resolve) => {
                this.waitForLock(filePath, async () => {
                    const result = await this.modifyCanvasDataAtomic(filePath, updateCallback);
                    resolve(result);
                });
            });
        }

        const canvasFile = this.app.vault.getAbstractFileByPath(filePath);
        if (!(canvasFile instanceof TFile)) {
            this.releaseLock(filePath);
            return false;
        }

        try {
            const content = await this.app.vault.read(canvasFile);
            const data = JSON.parse(content) as CanvasDataLike;
            const firstEdgeCount = data.edges?.length || 0;

            const shouldModify = await updateCallback(data);
            log(`[File] 原子修改第一次检查: shouldModify=${shouldModify}, edges=${firstEdgeCount}`);

            if (shouldModify) {
                const latestContent = await this.app.vault.read(canvasFile);
                const latestData = JSON.parse(latestContent) as CanvasDataLike;
                const secondEdgeCount = latestData.edges?.length || 0;
                
                const finalShouldModify = await updateCallback(latestData);
                log(`[File] 原子修改第二次检查: finalShouldModify=${finalShouldModify}, edges=${secondEdgeCount}`);
                
                if (finalShouldModify) {
                    const output = JSON.stringify(latestData, null, 2);
                    await this.app.vault.modify(canvasFile, output);
                    log(`[File] 原子修改成功: ${filePath}, edges=${secondEdgeCount}`);
                    this.releaseLock(filePath);
                    return true;
                }
            }
            this.releaseLock(filePath);
            return false;
        } catch (err) {
            log('[File] 原子修改失败:', err);
            this.releaseLock(filePath);
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
