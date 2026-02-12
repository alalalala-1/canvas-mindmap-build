/**
 * 安全的JSON解析函数
 */
export function safeJsonParse<T>(str: string, defaultValue: T): T {
    if (!str) return defaultValue;
    
    // 检查是否是有效的JSON格式
    const trimmed = str.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
        return defaultValue;
    }
    
    try {
        return JSON.parse(str) as T;
    } catch {
        return defaultValue;
    }
}
