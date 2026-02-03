/**
 * DOM 工具函数
 */

/**
 * 获取节点ID从DOM元素
 */
export function getNodeIdFromElement(el: Element, canvas: any): string | null {
    // 尝试从 data-node-id 获取
    const dataNodeId = el.getAttribute('data-node-id');
    if (dataNodeId) return dataNodeId;

    // 尝试从 Canvas 节点数据中匹配
    const nodes = Array.from(canvas.nodes.values()) as any[];
    for (const node of nodes) {
        const nodeAny = node as any;
        if (nodeAny.nodeEl === el || el.contains(nodeAny.nodeEl)) {
            return node.id;
        }
    }

    // 尝试从类名中提取
    const idMatch = el.className.match(/[a-zA-Z0-9]{8,}/);
    if (idMatch) return idMatch[0];

    return null;
}

/**
 * 检测移动设备
 */
export function detectMobileDevice(): boolean {
    // 检查 User Agent
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobileUA = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    
    // 检查触摸支持
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // 检查屏幕尺寸（平板和手机通常屏幕较小）
    const isSmallScreen = window.innerWidth <= 1024;
    
    // 检查指针事件支持（现代移动设备都支持）
    const hasPointerEvents = 'PointerEvent' in window;
    
    // 综合判断：如果满足以下任一条件，则认为是移动设备
    // 1. User Agent 明确标识为移动设备
    // 2. 有触摸支持且屏幕较小
    // 3. 有指针事件支持且屏幕较小
    return isMobileUA || (hasTouch && isSmallScreen) || (hasPointerEvents && isSmallScreen);
}