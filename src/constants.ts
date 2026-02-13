/**
 * 常量定义
 */

export const CONSTANTS = {
    DEBOUNCE_TIME: 300,

    BUTTON_CHECK_INTERVALS: [50, 100, 200, 300, 500, 800, 1200],

    MAX_MUTATION_RETRIES: 10,

    DEFAULT_NODE_WIDTH: 250,
    DEFAULT_NODE_HEIGHT: 100,

    COLLAPSE_BUTTON_WIDTH: 20,
    COLLAPSE_BUTTON_WIDTH_MOBILE: 30,

    CACHE_TTL: 100,

    CLEANUP_INTERVAL: 300000,

    CLICK_DEBOUNCE_EXPIRY: 60000,

    TYPOGRAPHY: {
        FONT_SIZE: 14,
        LINE_HEIGHT: 26,
        SAFETY_PADDING: 44,
        MIN_NODE_HEIGHT: 60,
    },

    TIMING: {
        RENDER_DELAY: 500,
        HEIGHT_ADJUST_DELAY: 300,
        BUTTON_REFRESH_DELAY: 200,
        SCROLL_DELAY: 100,
        EDGE_DETECTION_INTERVAL: 500,
        RETRY_DELAY: 500,
        ARRANGE_DEBOUNCE: 100,
        BUTTON_CHECK_DEBOUNCE: 50,
        CLICK_DEBOUNCE: 300,
        DEBOUNCE_EXPIRY: 60000,
        STYLE_APPLY_DELAY: 200,
        HEIGHT_RECHECK_DELAY: 800,
        RETRY_DELAY_SHORT: 300,
        RETRY_DELAY_MEDIUM: 600,
        RETRY_DELAY_LONG: 1000,
    },

    TOUCH: {
        DURATION_THRESHOLD: 300,
        MOVE_THRESHOLD: 10,
        PEN_POINTER_TYPE: 'pen',
        TOUCH_POINTER_TYPE: 'touch',
    },

    PERFORMANCE: {
        LOW_END_MEMORY: 4,
        LOW_END_CORES: 4,
        LOW_END_DEBOUNCE: 200,
        NORMAL_DEBOUNCE: 100,
    },

    TABLET: {
        MIN_WIDTH: 1024,
        BUTTON_WIDTH: 24,
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
