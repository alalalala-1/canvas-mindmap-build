import { describe, expect, it } from 'vitest';
import { arrangeLayout } from '../canvas/layout';
import { CanvasArrangerSettings, CanvasDataLike, CanvasEdgeLike, CanvasNodeLike } from '../canvas/types';

const SETTINGS: CanvasArrangerSettings = {
    horizontalSpacing: 200,
    verticalSpacing: 40,
    textNodeWidth: 400,
    textNodeMaxHeight: 800,
    imageNodeWidth: 400,
    imageNodeHeight: 400,
    formulaNodeWidth: 400,
    formulaNodeHeight: 80,
};

function createNode(id: string): CanvasNodeLike {
    return {
        id,
        type: 'text',
        text: id,
        x: 0,
        y: 0,
        width: 200,
        height: 80,
    };
}

describe('arrangeLayout child order', () => {
    it('should respect persistent edge array order instead of edge.id order', () => {
        const nodes = new Map<string, CanvasNodeLike>([
            ['p', createNode('p')],
            ['c1', createNode('c1')],
            ['c2', createNode('c2')],
            ['c3', createNode('c3')],
        ]);

        // 持久化顺序：c2 -> c1 -> c3（故意让 edge.id 排序冲突）
        const edges: CanvasEdgeLike[] = [
            { id: 'z-edge', fromNode: 'p', toNode: 'c2', fromSide: 'right', toSide: 'left' },
            { id: 'a-edge', fromNode: 'p', toNode: 'c1', fromSide: 'right', toSide: 'left' },
            { id: 'b-edge', fromNode: 'p', toNode: 'c3', fromSide: 'right', toSide: 'left' },
        ];

        const canvasData: CanvasDataLike = {
            nodes: [
                { id: 'p' },
                { id: 'c1' },
                { id: 'c2' },
                { id: 'c3' },
            ],
            edges,
        };

        const result = arrangeLayout(nodes, edges, SETTINGS, edges, nodes, canvasData);

        const orderedByY = ['c1', 'c2', 'c3']
            .map((id) => ({ id, y: result.get(id)?.y ?? Number.MAX_SAFE_INTEGER }))
            .sort((a, b) => a.y - b.y)
            .map((entry) => entry.id);

        expect(orderedByY).toEqual(['c2', 'c1', 'c3']);
    });

    it('should prefer stable originalEdges snapshot when runtime edge order is polluted', () => {
        const nodes = new Map<string, CanvasNodeLike>([
            ['p', createNode('p')],
            ['c1', createNode('c1')],
            ['c2', createNode('c2')],
            ['c3', createNode('c3')],
        ]);

        const stableOriginalEdges: CanvasEdgeLike[] = [
            { id: 'stable-1', fromNode: 'p', toNode: 'c2', fromSide: 'right', toSide: 'left' },
            { id: 'stable-2', fromNode: 'p', toNode: 'c1', fromSide: 'right', toSide: 'left' },
            { id: 'stable-3', fromNode: 'p', toNode: 'c3', fromSide: 'right', toSide: 'left' },
        ];

        const pollutedRuntimeEdges: CanvasEdgeLike[] = [
            { id: 'stable-2', fromNode: 'p', toNode: 'c1', fromSide: 'right', toSide: 'left' },
            { id: 'stable-3', fromNode: 'p', toNode: 'c3', fromSide: 'right', toSide: 'left' },
            { id: 'stable-1', fromNode: 'p', toNode: 'c2', fromSide: 'right', toSide: 'left' },
        ];

        const stableCanvasData: CanvasDataLike = {
            nodes: [
                { id: 'p' },
                { id: 'c1' },
                { id: 'c2' },
                { id: 'c3' },
            ],
            edges: stableOriginalEdges,
        };

        const result = arrangeLayout(nodes, pollutedRuntimeEdges, SETTINGS, stableOriginalEdges, nodes, stableCanvasData);

        const orderedByY = ['c1', 'c2', 'c3']
            .map((id) => ({ id, y: result.get(id)?.y ?? Number.MAX_SAFE_INTEGER }))
            .sort((a, b) => a.y - b.y)
            .map((entry) => entry.id);

        expect(orderedByY).toEqual(['c2', 'c1', 'c3']);
    });
});
