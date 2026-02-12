/**
 * 设置验证和迁移
 */

import { CanvasMindmapBuildSettings, DEFAULT_SETTINGS } from './types';
import { log } from '../utils/logger';

/**
 * 验证设置数据
 */
export function validateSettings(data: unknown): Partial<CanvasMindmapBuildSettings> {
    const dataObj = (data && typeof data === 'object') ? (data as Record<string, unknown>) : {};
    const validated: Partial<CanvasMindmapBuildSettings> = {};

    // 验证 Canvas 文件路径
    if (typeof dataObj.canvasFilePath === 'string') {
        validated.canvasFilePath = dataObj.canvasFilePath;
    }

    // 验证文本节点设置
    if (typeof dataObj.enableTextAutoSize === 'boolean') {
        validated.enableTextAutoSize = dataObj.enableTextAutoSize;
    }
    if (typeof dataObj.textNodeWidth === 'number' && dataObj.textNodeWidth > 0) {
        validated.textNodeWidth = dataObj.textNodeWidth;
    }
    if (typeof dataObj.textNodeMaxHeight === 'number' && dataObj.textNodeMaxHeight > 0) {
        validated.textNodeMaxHeight = dataObj.textNodeMaxHeight;
    }

    // 验证图片节点设置
    if (typeof dataObj.imageNodeWidth === 'number' && dataObj.imageNodeWidth > 0) {
        validated.imageNodeWidth = dataObj.imageNodeWidth;
    }
    if (typeof dataObj.imageNodeHeight === 'number' && dataObj.imageNodeHeight > 0) {
        validated.imageNodeHeight = dataObj.imageNodeHeight;
    }

    // 验证公式节点设置
    if (typeof dataObj.enableFormulaDetection === 'boolean') {
        validated.enableFormulaDetection = dataObj.enableFormulaDetection;
    }
    if (typeof dataObj.formulaNodeWidth === 'number' && dataObj.formulaNodeWidth > 0) {
        validated.formulaNodeWidth = dataObj.formulaNodeWidth;
    }
    if (typeof dataObj.formulaNodeHeight === 'number' && dataObj.formulaNodeHeight > 0) {
        validated.formulaNodeHeight = dataObj.formulaNodeHeight;
    }

    // 验证间距设置
    if (typeof dataObj.horizontalSpacing === 'number' && dataObj.horizontalSpacing > 0) {
        validated.horizontalSpacing = dataObj.horizontalSpacing;
    }
    if (typeof dataObj.verticalSpacing === 'number' && dataObj.verticalSpacing > 0) {
        validated.verticalSpacing = dataObj.verticalSpacing;
    }

    // 验证折叠按钮颜色
    if (typeof dataObj.collapseButtonColor === 'string' && isValidColor(dataObj.collapseButtonColor)) {
        validated.collapseButtonColor = dataObj.collapseButtonColor;
    }

    // 验证调试设置
    if (typeof dataObj.enableDebugLogging === 'boolean') {
        validated.enableDebugLogging = dataObj.enableDebugLogging;
    }

    return validated;
}

/**
 * 验证颜色值是否有效
 */
function isValidColor(color: string): boolean {
    // 支持 hex、rgb、rgba、hsl、hsla
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    const rgbRegex = /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/;
    const rgbaRegex = /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/;
    const hslRegex = /^hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)$/;
    const hslaRegex = /^hsla\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*,\s*[\d.]+\s*\)$/;

    return hexRegex.test(color) ||
           rgbRegex.test(color) ||
           rgbaRegex.test(color) ||
           hslRegex.test(color) ||
           hslaRegex.test(color);
}

/**
 * 设置版本号
 */
const CURRENT_SETTINGS_VERSION = '1.2.0';

/**
 * 迁移设置
 */
export function migrateSettings(
    settings: CanvasMindmapBuildSettings
): CanvasMindmapBuildSettings {
    const version = settings.version || '1.0.0';

    if (version === CURRENT_SETTINGS_VERSION) {
        return settings;
    }

    log(`迁移设置从版本 ${version} 到 ${CURRENT_SETTINGS_VERSION}`);

    let migrated = { ...settings };

    // 1.0.0 -> 1.1.0 迁移
    if (version < '1.1.0') {
        migrated = migrateFrom100To110(migrated);
    }

    // 1.1.0 -> 1.2.0 迁移
    if (version < '1.2.0') {
        migrated = migrateFrom110To120(migrated);
    }

    // 更新版本号
    migrated.version = CURRENT_SETTINGS_VERSION;

    return migrated;
}

/**
 * 从 1.0.0 迁移到 1.1.0
 */
function migrateFrom100To110(settings: CanvasMindmapBuildSettings): CanvasMindmapBuildSettings {
    // 添加折叠按钮颜色设置（如果不存在）
    if (!settings.collapseButtonColor) {
        settings.collapseButtonColor = DEFAULT_SETTINGS.collapseButtonColor;
    }

    return settings;
}

/**
 * 从 1.1.0 迁移到 1.2.0
 */
function migrateFrom110To120(settings: CanvasMindmapBuildSettings): CanvasMindmapBuildSettings {
    // 确保所有新设置都有默认值
    const merged = { ...DEFAULT_SETTINGS, ...settings };
    return merged;
}

/**
 * 声明设置版本号属性
 */
declare module './types' {
    interface CanvasMindmapBuildSettings {
        version?: string;
    }
}
