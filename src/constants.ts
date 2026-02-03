/**
 * 常量定义
 */

export const CONSTANTS = {
    // 防抖时间 (毫秒)
    DEBOUNCE_TIME: 300,

    // 按钮检查间隔 (毫秒)
    BUTTON_CHECK_INTERVALS: [50, 100, 200, 300, 500, 800, 1200],

    // MutationObserver 重试次数
    MAX_MUTATION_RETRIES: 10,

    // 默认节点尺寸
    DEFAULT_NODE_WIDTH: 250,
    DEFAULT_NODE_HEIGHT: 100,

    // 折叠按钮尺寸
    COLLAPSE_BUTTON_WIDTH: 20,
    COLLAPSE_BUTTON_WIDTH_MOBILE: 30,

    // 缓存过期时间 (毫秒)
    CACHE_TTL: 100,

    // 清理间隔 (毫秒)
    CLEANUP_INTERVAL: 300000, // 5分钟

    // 点击防抖过期时间 (毫秒)
    CLICK_DEBOUNCE_EXPIRY: 60000, // 1分钟

    // 触摸事件配置
    TOUCH: {
        // 触摸持续时间阈值 (毫秒)
        DURATION_THRESHOLD: 300,
        // 移动距离阈值 (像素)
        MOVE_THRESHOLD: 10,
        // 笔输入指针类型
        PEN_POINTER_TYPE: 'pen',
        // 触摸指针类型
        TOUCH_POINTER_TYPE: 'touch',
    },

    // 性能配置
    PERFORMANCE: {
        // 低端设备内存阈值 (GB)
        LOW_END_MEMORY: 4,
        // 低端设备核心数阈值
        LOW_END_CORES: 4,
        // 低端设备防抖时间 (毫秒)
        LOW_END_DEBOUNCE: 200,
        // 正常设备防抖时间 (毫秒)
        NORMAL_DEBOUNCE: 100,
    },

    // 平板设备配置 (13.3寸)
    TABLET: {
        // 最小宽度阈值
        MIN_WIDTH: 1024,
        // 按钮宽度
        BUTTON_WIDTH: 24,
        // 按钮最小高度
        BUTTON_MIN_HEIGHT: 44,
    },
} as const;

/**
 * CSS 变量名
 */
export const CSS_VARS = {
    COLLAPSE_BUTTON_COLOR: '--cmb-collapse-button-color',
} as const;

/**
 * 选择器
 */
export const SELECTORS = {
    CANVAS_NODE: '.canvas-node',
    CANVAS_NODE_CONTAINER: '.canvas-node-container',
    CANVAS_WRAPPER: '.canvas-wrapper',
    COLLAPSE_BUTTON: '.cmb-collapse-button',
    NODE_CONTENT: '.canvas-node-content',
} as const;

/**
 * 事件名称
 */
export const EVENTS = {
    EDGE_ADD: 'edge-add',
    EDGE_DELETE: 'edge-delete',
    NODE_SELECT: 'node-select',
    NODE_DESELECT: 'node-deselect',
} as const;
