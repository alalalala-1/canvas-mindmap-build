/**
 * 常量定义
 */

export const CONSTANTS = {
    BUTTON_CHECK_INTERVALS: [50, 100, 200, 300, 500, 800, 1200],

    MAX_MUTATION_RETRIES: 10,

    COLLAPSE_BUTTON_WIDTH: 20,
    COLLAPSE_BUTTON_WIDTH_MOBILE: 30,

    TYPOGRAPHY: {
        FONT_SIZE: 14,
        LINE_HEIGHT: 26,
        SAFETY_PADDING: 44,
        MIN_NODE_HEIGHT: 60 as number,
        MIN_HEADING_NODE_HEIGHT: 76 as number,  // 标题节点最低高度（标题渲染有更大的行高和字号，需要更多呼吸空间）
        DEFAULT_LINE_HEIGHT: 24,
        PADDING_EXTRA: 24,
        SCROLL_THRESHOLD: 20,
    },

    LAYOUT: {
        HORIZONTAL_SPACING: 200,
        VERTICAL_SPACING: 40,
        TEXT_NODE_WIDTH: 400,
        TEXT_NODE_MAX_HEIGHT: 800,
        IMAGE_NODE_WIDTH: 400,
        IMAGE_NODE_HEIGHT: 400,
        FORMULA_NODE_WIDTH: 400,
        FORMULA_NODE_HEIGHT: 80,
        HEIGHT_TOLERANCE: 4,
        POSITION_WRITE_EPSILON: 1,
        LOW_VISIBILITY_DOM_RATE: 0.6,       // 虚拟化节点文件高度信任阈值提升到 60%
        LOW_VISIBILITY_MIN_DOM_VISIBLE: 8,
        LOW_VISIBILITY_ALLOW_WRITE_MIN_CHANGED: 3,
        MAX_HEIGHT_SAMPLES: 20,
        DEFAULT_POSITION: 100,
    },

    EDGE_DETECTION: {
        DEFAULT_INTERVAL: 500,
        DEFAULT_MAX_CHECKS: 60,
        FLOATING_EXPIRY_MS: 3000,
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
        FROM_LINK_NAV_DEBOUNCE: 2000,
        /** 移动端 fromLink 跳转后的初始等待时间（墨水屏等慢速设备需要更长时间） */
        MOBILE_SELECTION_DELAY: 600,
        /** 移动端 fromLink 选区的重试延迟（防止视图动画完成后选区被重置） */
        MOBILE_SELECTION_RETRY_DELAY: 300,
        /** arrange 完成后的延迟边刷新时间（等待虚拟化节点 DOM 渲染完毕） */
        EDGE_REFRESH_DEFERRED_DELAY: 800,
        /** 移动端/墨水屏 arrange 完成后的延迟边刷新时间（更长，适应慢速设备） */
        EDGE_REFRESH_DEFERRED_DELAY_MOBILE: 1500,
        /** viewport 变化后的边刷新防抖时间（设备旋转/分屏切换时触发） */
        VIEWPORT_CHANGE_DEBOUNCE: 400,
        /** 移动端 viewport 变化后额外等待时间（等待系统完成旋转动画，墨水屏需要更长） */
        VIEWPORT_CHANGE_EXTRA_DELAY_MOBILE: 1000,
        /** 边几何 pass2 之间的等待时间（低置信度场景使用更长时间） */
        EDGE_REFRESH_PASS_INTERVAL: 50,
        /** 低置信度场景下 edge refresh 额外 pass 的等待间隔（墨水屏刷新慢需要更长） */
        EDGE_REFRESH_EXTRA_PASS_INTERVAL: 500,
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
