import { logVerbose } from '../../utils/logger';

/**
 * 布局诊断统计器
 * 收集布局过程中的各项统计数据，仅在 debug 模式下输出
 */
export class LayoutDiagnostics {
    private counters = new Map<string, number>();
    private samples = new Map<string, string[]>();
    private maxSamples: number;

    constructor(maxSamples: number = 5) {
        this.maxSamples = maxSamples;
    }

    increment(key: string, amount: number = 1): void {
        this.counters.set(key, (this.counters.get(key) || 0) + amount);
    }

    get(key: string): number {
        return this.counters.get(key) || 0;
    }

    /**
     * 设置计数器的值（用于 max 等需要直接设置的值）
     */
    set(key: string, value: number): void {
        this.counters.set(key, value);
    }

    /**
     * 更新最大值
     */
    updateMax(key: string, value: number): void {
        const current = this.counters.get(key) || 0;
        if (value > current) {
            this.counters.set(key, value);
        }
    }

    /**
     * 累加到指定键（用于 sum）
     */
    addTo(key: string, value: number): void {
        this.counters.set(key, (this.counters.get(key) || 0) + value);
    }

    addSample(key: string, value: string): void {
        if (!this.samples.has(key)) {
            this.samples.set(key, []);
        }
        const arr = this.samples.get(key)!;
        if (arr.length < this.maxSamples) {
            arr.push(value);
        }
    }

    getSamples(key: string): string[] {
        return this.samples.get(key) || [];
    }

    hasSamples(key: string): boolean {
        const samples = this.samples.get(key);
        return samples !== undefined && samples.length > 0;
    }

    /** 输出所有收集的统计数据 */
    logSummary(visibleCount: number, canvasFilePath: string): void {
        // 高度统计
        const heights = this.get('heightSum') > 0 
            ? { sum: this.get('heightSum'), count: this.get('heightCount') }
            : null;
        
        if (heights && heights.count > 0) {
            const avgHeight = heights.sum / heights.count;
            logVerbose(`[LayoutData] 高度统计 count=${visibleCount}, min=${this.get('heightMin').toFixed(1)}, max=${this.get('heightMax').toFixed(1)}, avg=${avgHeight.toFixed(1)}, zero=${this.get('zeroHeightCount')}, dom覆盖=${this.get('domApplied')}, 无元素=${this.get('domMissing')}, 隐藏=${this.get('domHidden')}, 0高=${this.get('domZero')}`);
        }
        
        logVerbose(`[LayoutData] 高度来源 file=${this.get('dataFromFile')}, memory=${this.get('dataFromMemory')}, missing=${this.get('dataMissing')}, trusted=${this.get('trustedUsed')}, sigMatch=${this.get('sigMatched')}`);
        
        if (this.get('trustedUsed') > 0) {
            logVerbose(`[LayoutData] trustedHeight样例: ${this.getSamples('trusted').join('|')}`);
        }
        if (this.hasSamples('sigMatched')) {
            logVerbose(`[LayoutData] trusted签名匹配样例: ${this.getSamples('sigMatched').join('|')}`);
        }
        if (this.hasSamples('sigMismatch')) {
            logVerbose(`[LayoutData] trusted签名不匹配样例: ${this.getSamples('sigMismatch').join('|')}`);
        }
        if (this.hasSamples('filePreferred')) {
            logVerbose(`[LayoutData] 文件高度优先样例: ${this.getSamples('filePreferred').join('|')}`);
        }
        if (this.get('domDiff') > 0) {
            const avgDiff = this.get('domDiffSum') / this.get('domDiff');
            logVerbose(`[LayoutData] DOM高度差异 count=${this.get('domDiff')}, max=${this.get('domDiffMax').toFixed(1)}, avg=${avgDiff.toFixed(1)}, sample=${this.getSamples('domDiff').join('|')}`);
        }
        if (this.get('domZero') > 0) {
            logVerbose(`[LayoutData] DOM高度为0 count=${this.get('domZero')}, sample=${this.getSamples('domZero').join('|')}`);
            if (this.hasSamples('domZeroDetail')) {
                logVerbose(`[LayoutData] DOM高度为0详情 file=${canvasFilePath || 'unknown'}, sample=${this.getSamples('domZeroDetail').join('|')}`);
            }
        }
        if (this.get('domHidden') > 0) {
            logVerbose(`[LayoutData] DOM隐藏 sample=${this.getSamples('domHidden').join('|')}`);
        }
        if (this.get('domMissing') > 0) {
            logVerbose(`[LayoutData] DOM缺失 sample=${this.getSamples('domMissing').join('|')}`);
        }
    }

    /** 记录高度统计 */
    recordHeight(height: number): void {
        this.increment('heightCount');
        this.increment('heightSum', height);
        
        const currentMin = this.get('heightMin');
        const currentMax = this.get('heightMax');
        
        if (currentMin === 0 || height < currentMin) {
            this.counters.set('heightMin', height);
        }
        if (height > currentMax) {
            this.counters.set('heightMax', height);
        }
        if (height <= 0) {
            this.increment('zeroHeightCount');
        }
    }
}