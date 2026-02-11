import { App, ItemView, TFile } from 'obsidian';
import { CanvasMindmapBuildSettings } from '../../settings/types';
import { log } from '../../utils/logger';

/**
 * Canvas 文件操作服务
 * 负责读取、修改 Canvas 文件
 */
export class CanvasFileService {
    private app: App;
    private settings: CanvasMindmapBuildSettings;

    constructor(app: App, settings: CanvasMindmapBuildSettings) {
        this.app = app;
        this.settings = settings;
    }

    /**
     * 获取浮动节点信息
     * 从 metadata 和节点 data 属性中读取
     */
    getFloatingNodesInfo(canvasData: any): {
        floatingNodes: Set<string>,
        originalParents: Map<string, string>
    } {
        const floatingNodes = new Set<string>();
        const originalParents = new Map<string, string>();

        // 1. 从 metadata 读取（向后兼容）
        if (canvasData?.metadata?.floatingNodes) {
            for (const [nodeId, info] of Object.entries(canvasData.metadata.floatingNodes)) {
                if (typeof info === 'boolean' && info === true) {
                    floatingNodes.add(nodeId);
                } else if (typeof info === 'object' && info !== null) {
                    const nodeInfo = info as any;
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
        if (canvasData?.nodes && Array.isArray(canvasData.nodes)) {
            for (const node of canvasData.nodes) {
                if (node.data?.isFloating) {
                    floatingNodes.add(node.id);
                    if (node.data.originalParent) {
                        originalParents.set(node.id, node.data.originalParent);
                    }
                }
            }
        }

        return { floatingNodes, originalParents };
    }

    /**
     * 获取边列表（标准化格式）
     */
    getEdges(canvasData: any): any[] {
        if (!canvasData?.edges) return [];
        return Array.isArray(canvasData.edges) ? canvasData.edges : [];
    }

    /**
     * 获取节点列表（标准化格式）
     */
    getNodes(canvasData: any): any[] {
        if (!canvasData?.nodes) return [];
        return Array.isArray(canvasData.nodes) ? canvasData.nodes : [];
    }

    /**
     * 获取当前 Canvas 文件路径
     * 尝试多种方法获取路径
     */
    getCurrentCanvasFilePath(): string | undefined {
        // 方法1: 从 activeLeaf 获取
        const activeLeaf = this.app.workspace.activeLeaf;
        if (activeLeaf?.view?.getViewType() === 'canvas') {
            const canvas = (activeLeaf.view as any).canvas;
            if (canvas?.file?.path) {
                return canvas.file.path;
            }
            if ((activeLeaf.view as any).file?.path) {
                return (activeLeaf.view as any).file.path;
            }
        }

        // 方法2: 从 getActiveViewOfType 获取
        const activeView = this.app.workspace.getActiveViewOfType(ItemView);
        if (activeView?.getViewType() === 'canvas') {
            const canvas = (activeView as any).canvas;
            if (canvas?.file?.path) {
                return canvas.file.path;
            }
            if ((activeView as any).file?.path) {
                return (activeView as any).file.path;
            }
        }

        // 方法3: 从所有 leaves 中查找 canvas
        const canvasLeaves = this.app.workspace.getLeavesOfType('canvas');
        for (const leaf of canvasLeaves) {
            if (leaf.view?.getViewType() === 'canvas') {
                const canvas = (leaf.view as any).canvas;
                if (canvas?.file?.path) {
                    return canvas.file.path;
                }
                if ((leaf.view as any).file?.path) {
                    return (leaf.view as any).file.path;
                }
            }
        }

        // 方法4: 从设置中获取
        if (this.settings.canvasFilePath) {
            return this.settings.canvasFilePath;
        }

        return undefined;
    }

    /**
     * 从 CanvasView 获取文件路径
     */
    getCanvasFilePathFromView(canvasView: ItemView): string | undefined {
        if ((canvasView as any).canvas?.file?.path) {
            return (canvasView as any).canvas.file.path;
        }

        if ((canvasView as any).file?.path) {
            return (canvasView as any).file.path;
        }

        if (this.settings.canvasFilePath) {
            return this.settings.canvasFilePath;
        }

        return undefined;
    }

    /**
     * 读取 Canvas 文件数据
     */
    async readCanvasData(filePath: string): Promise<any | null> {
        const canvasFile = this.app.vault.getAbstractFileByPath(filePath);
        if (!(canvasFile instanceof TFile)) return null;

        try {
            const canvasContent = await this.app.vault.read(canvasFile);
            return JSON.parse(canvasContent);
        } catch (parseError) {
            log('[File] 解析失败:', parseError);
            return null;
        }
    }

    /**
     * 原子化修改 Canvas 文件数据
     * 使用 "读取 -> 合并 -> 写入" 模式，防止在修改期间数据被 Obsidian 覆盖
     */
    async modifyCanvasDataAtomic(
        filePath: string,
        updateCallback: (data: any) => boolean | Promise<boolean>
    ): Promise<boolean> {
        const canvasFile = this.app.vault.getAbstractFileByPath(filePath);
        if (!(canvasFile instanceof TFile)) return false;

        try {
            const content = await this.app.vault.read(canvasFile);
            const data = JSON.parse(content);

            const shouldModify = await updateCallback(data);
            log(`[File] 原子修改第一次检查: shouldModify=${shouldModify}`);

            if (shouldModify) {
                const latestContent = await this.app.vault.read(canvasFile);
                const latestData = JSON.parse(latestContent);
                
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

    /**
     * 保存 Canvas 数据到文件
     */
    async saveCanvasData(filePath: string, data: any): Promise<boolean> {
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
