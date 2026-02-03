export interface CanvasMindmapBuildSettings {
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

    // Debug Settings
    enableDebugLogging: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
}

export const DEFAULT_SETTINGS: CanvasMindmapBuildSettings = {
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

    // Debug Settings
    enableDebugLogging: false,
    logLevel: 'info',
}
