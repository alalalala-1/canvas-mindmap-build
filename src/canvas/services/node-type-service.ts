
import { CanvasMindmapBuildSettings } from '../../settings/types';
import { CanvasNodeLike } from '../types';
import { log } from '../../utils/logger';
import { isFormulaContent, isImageContent } from '../../utils/canvas-utils';

export type NodeType = 'text' | 'image' | 'formula';

export interface NodeDimensions {
    type: NodeType;
    width: number;
    height: number;
}

export class NodeTypeService {
    private settings: CanvasMindmapBuildSettings;

    constructor(settings: CanvasMindmapBuildSettings) {
        this.settings = settings;
    }

    /**
     * 检测内容类型并获取节点尺寸
     * @param content 节点内容
     * @returns 节点类型和尺寸
     */
    getNodeDimensions(content: string): NodeDimensions {
        const trimmedContent = content.trim();

        if (this.isFormula(trimmedContent)) {
            return {
                type: 'formula',
                width: this.settings.formulaNodeWidth || 400,
                height: this.settings.formulaNodeHeight || 80
            };
        }

        if (this.isImage(trimmedContent)) {
            return {
                type: 'image',
                width: this.settings.imageNodeWidth || 400,
                height: this.settings.imageNodeHeight || 400
            };
        }

        return {
            type: 'text',
            width: this.settings.textNodeWidth || 400,
            height: 0
        };
    }

    /**
     * 检测是否为公式内容
     */
    isFormula(content: string): boolean {
        if (!content) return false;
        const trimmed = content.trim();
        return this.settings.enableFormulaDetection &&
            trimmed.startsWith('$$') &&
            trimmed.endsWith('$$') &&
            trimmed.length > 4;
    }

    /**
     * 检测是否为图片内容
     */
    isImage(content: string): boolean {
        return isImageContent(content);
    }

    /**
     * 检测是否为公式内容（使用正则）
     */
    isFormulaContent(content: string): boolean {
        return isFormulaContent(content);
    }

    /**
     * 为节点设置类型和尺寸
     * @param node 节点对象
     * @param content 节点内容
     */
    applyNodeDimensions(node: CanvasNodeLike, content: string): void {
        const dimensions = this.getNodeDimensions(content);
        
        node.type = dimensions.type === 'image' ? 'file' : 'text';
        node.width = dimensions.width;
        
        if (dimensions.type !== 'text') {
            node.height = dimensions.height;
        }

        log(`[NodeType] 节点类型: ${dimensions.type}, 尺寸: ${dimensions.width}x${dimensions.height}`);
    }

    /**
     * 获取公式节点的固定尺寸
     */
    getFormulaDimensions(): { width: number; height: number } {
        return {
            width: this.settings.formulaNodeWidth || 400,
            height: this.settings.formulaNodeHeight || 80
        };
    }

    /**
     * 获取图片节点的固定尺寸
     */
    getImageDimensions(): { width: number; height: number } {
        return {
            width: this.settings.imageNodeWidth || 400,
            height: this.settings.imageNodeHeight || 400
        };
    }

    /**
     * 获取文本节点的配置尺寸
     */
    getTextDimensions(): { width: number; maxHeight: number } {
        return {
            width: this.settings.textNodeWidth || 400,
            maxHeight: this.settings.textNodeMaxHeight || 800
        };
    }
}

