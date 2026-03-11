import { describe, expect, it } from 'vitest';
import {
    buildNormalizedLineIndex,
    matchNodeAtSpecificLine,
    matchNodeToSource,
    normalizeForMatch,
} from '../canvas/services/fromlink-matcher';
import { CanvasNodeLike } from '../canvas/types';

function createNode(text: string): CanvasNodeLike {
    return {
        id: 'node-1',
        type: 'text',
        text,
        x: 0,
        y: 0,
        width: 400,
        height: 80,
    };
}

describe('fromlink matcher', () => {
    it('normalizes markdown emphasis while preserving formulas', () => {
        const normalized = normalizeForMatch('把上式中的求和部分 $\\sum n_i s_i$ 定义为总的**光程 (OPL)**。');
        expect(normalized).toContain('$\\sum n_i s_i$');
        expect(normalized).toContain('总的光程 (opl)。');
        expect(normalized).not.toContain('**');
    });

    it('matches single-line content despite markdown emphasis differences', () => {
        const node = createNode('把上式中的求和部分 $\\sum n_i s_i$ 定义为总的**光程 (OPL)**。');
        const sourceLines = [
            '我们把上式中的求和部分 $\\sum n_i s_i$ 定义为总的光程 (OPL)。',
        ];

        const candidate = matchNodeToSource(node, sourceLines, buildNormalizedLineIndex(sourceLines), 0);

        expect(candidate).not.toBeNull();
        expect(candidate?.line).toBe(0);
        expect(candidate?.score).toBeGreaterThanOrEqual(100);
    });

    it('matches multi-line blocks despite differing markdown emphasis markers', () => {
        const node = createNode([
            '**光程的物理本质是什么？**',
            '**光程 (OPL) 是光在折射率为 $n$ 的介质中走过距离 $s$ 时，等效于在真空中走过的距离**。',
        ].join('\n'));
        const sourceLines = [
            '前文铺垫。',
            '**光程的物理本质是什么？**',
            '***光程 (OPL) 是光在折射率为 $n$ 的介质中走过距离 $s$ 时，等效于在真空中走过的距离。***',
            '后续解释。',
        ];
        const lineIndex = buildNormalizedLineIndex(sourceLines);

        const anchored = matchNodeAtSpecificLine(node, sourceLines, lineIndex, 1);
        const candidate = matchNodeToSource(node, sourceLines, lineIndex, 1);

        expect(anchored).not.toBeNull();
        expect(anchored?.line).toBe(1);
        expect(anchored?.toLine).toBe(2);
        expect(anchored?.method.startsWith('B')).toBe(true);

        expect(candidate).not.toBeNull();
        expect(candidate?.line).toBe(1);
        expect(candidate?.toLine).toBe(2);
    });
});