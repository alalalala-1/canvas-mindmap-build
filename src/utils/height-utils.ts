/**
 * 高度计算相关工具函数
 */

const heightCache = new Map<string, number>();
const HEIGHT_CACHE_MAX_SIZE = 100;

/**
 * 生成文本内容签名（用于检测内容是否变化）
 * @param content 文本内容
 * @param width 节点宽度
 * @returns 签名字符串，格式: "长度:哈希:宽度"
 */
export function generateTextSignature(content: string, width: number): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        hash = (hash * 31 + content.charCodeAt(i)) >>> 0;
    }
    return `${content.length}:${hash}:${width}`;
}

/**
 * 估算文本节点高度（带缓存）
 * 用于布局计算和节点高度调整
 * 
 * [修复v3] 精确估算标题和格式化文本的高度
 */
export function estimateTextNodeHeight(content: string, width: number, maxHeight: number = 800): number {
    const cacheKey = `${width}:${maxHeight}:${content}`;
    const cached = heightCache.get(cacheKey);
    if (cached !== undefined) {
        return cached;
    }

    // 基础参数
    const contentWidth = width - 16;  // 左右各8px padding
    const baseFontSize = 14;  // Obsidian Canvas默认字体大小
    const normalLineHeight = 20;  // 普通文本行高
    
    const chineseCharRegex = /[\u4e00-\u9fa5]/;
    let totalHeight = 0;
    const textLines = content.split('\n');

    for (const line of textLines) {
        const trimmedLine = line.trim();
        if (trimmedLine === '') {
            totalHeight += normalLineHeight;  // 空行
            continue;
        }

        // 检测标题级别
        const headingMatch = trimmedLine.match(/^(#{1,6})\s+/);
        let currentFontSize = baseFontSize;
        let currentLineHeight = normalLineHeight;
        let marginTop = 0;
        let marginBottom = 0;
        
        if (headingMatch && headingMatch[1]) {
            const level = headingMatch[1].length;
            // 根据标题级别设置不同的字体大小和间距
            switch (level) {
                case 1: // H1
                    currentFontSize = baseFontSize * 1.8;  // ~25px
                    currentLineHeight = currentFontSize * 1.4;  // ~35px
                    marginTop = 20;
                    marginBottom = 12;
                    break;
                case 2: // H2
                    currentFontSize = baseFontSize * 1.6;  // ~22px
                    currentLineHeight = currentFontSize * 1.35;  // ~30px
                    marginTop = 16;
                    marginBottom = 10;
                    break;
                case 3: // H3
                    currentFontSize = baseFontSize * 1.4;  // ~20px
                    currentLineHeight = currentFontSize * 1.3;  // ~26px
                    marginTop = 12;
                    marginBottom = 8;
                    break;
                case 4: // H4
                    currentFontSize = baseFontSize * 1.25;  // ~18px
                    currentLineHeight = currentFontSize * 1.25;  // ~22px
                    marginTop = 10;
                    marginBottom = 6;
                    break;
                case 5: // H5
                case 6: // H6
                    currentFontSize = baseFontSize * 1.15;  // ~16px
                    currentLineHeight = currentFontSize * 1.2;  // ~19px
                    marginTop = 8;
                    marginBottom = 4;
                    break;
            }
        } else {
            // 非标题的格式化文本
            const hasBold = /\*\*|__/.test(trimmedLine);
            const hasCode = /`/.test(trimmedLine);
            if (hasBold || hasCode) {
                currentLineHeight = 24;  // 格式化文本稍高
            }
        }

        // 清理Markdown标记计算实际文本宽度
        const cleanLine = trimmedLine
            .replace(/^#{1,6}\s+/, '')
            .replace(/\*\*|\*|__|_|`/g, '');

        let pixelWidth = 0;
        for (const char of cleanLine) {
            if (chineseCharRegex.test(char)) {
                pixelWidth += currentFontSize;
            } else if (char === ' ') {
                pixelWidth += currentFontSize * 0.3;
            } else {
                pixelWidth += currentFontSize * 0.55;
            }
        }

        const linesNeeded = Math.max(1, Math.ceil(pixelWidth / contentWidth));
        totalHeight += marginTop + (linesNeeded * currentLineHeight) + marginBottom;
    }

    // 上下padding: 16px
    const actualPadding = 16;
    const calculatedHeight = Math.ceil(totalHeight + actualPadding);
    const result = Math.max(60, Math.min(calculatedHeight, maxHeight));
    
    if (heightCache.size >= HEIGHT_CACHE_MAX_SIZE) {
        const firstKey = heightCache.keys().next().value;
        if (firstKey) heightCache.delete(firstKey);
    }
    heightCache.set(cacheKey, result);
    
    return result;
}

/**
 * 清除高度缓存
 */
export function clearHeightCache(): void {
    heightCache.clear();
}