export interface CanvasMindmapBuildSettings {
    // 设置版本号
    version?: string;

    canvasFilePath: string;

    // Text Node Settings
    enableTextAutoSize: boolean;
    textNodeWidth: number;
    textNodeMaxHeight: number;

    // Image Node Settings
    imageNodeWidth: number;
    imageNodeHeight: number;

    // Formula Node Settings
    enableFormulaDetection: boolean;
    formulaNodeWidth: number;
    formulaNodeHeight: number;

    // Node Spacing
    horizontalSpacing: number;
    verticalSpacing: number;

    // Collapse Button Settings
    collapseButtonColor: string;

    // Debug Settings
    enableDebugLogging: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
}

export const DEFAULT_SETTINGS: CanvasMindmapBuildSettings = {
    // 设置版本号
    version: '1.2.0',

    canvasFilePath: '',

    enableTextAutoSize: true,
    textNodeWidth: 400,
    textNodeMaxHeight: 800,

    imageNodeWidth: 400,
    imageNodeHeight: 400,

    enableFormulaDetection: true,
    formulaNodeWidth: 400,
    formulaNodeHeight: 80,

    horizontalSpacing: 200,
    verticalSpacing: 40,

    // Collapse Button Settings
    collapseButtonColor: '#e74c3c',

    // Debug Settings
    enableDebugLogging: false,
    logLevel: 'info',
}
