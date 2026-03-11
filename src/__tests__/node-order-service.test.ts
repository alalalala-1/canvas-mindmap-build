import { describe, expect, it } from 'vitest';
import { App, TFile } from 'obsidian';
import { NodeOrderService } from '../canvas/services/node-order-service';
import { CanvasDataLike, CanvasEdgeLike, CanvasNodeLike } from '../canvas/types';

function createMarkdownFile(path: string): TFile {
    const name = path.split('/').pop() || path;
    return Object.assign(new TFile(), {
        path,
        name,
        extension: 'md',
    });
}

function createAppWithMarkdown(path: string, content: string): App {
    return createAppWithMarkdownFiles({ [path]: content });
}

function createAppWithMarkdownFiles(filesByPath: Record<string, string>): App {
    const files = Object.entries(filesByPath).map(([path]) => createMarkdownFile(path));
    const fileMap = new Map(files.map(file => [file.path, file]));
    return Object.assign(new App(), {
        vault: {
            getAbstractFileByPath: (targetPath: string) => fileMap.get(targetPath) || null,
            getFiles: () => files,
            read: async (target: TFile) => filesByPath[target.path] || '',
        },
    }) as App;
}

function createNode(id: string, text: string): CanvasNodeLike {
    return {
        id,
        type: 'text',
        text,
        x: 0,
        y: 0,
        width: 400,
        height: 80,
    };
}

function withFromLink(text: string, file: string, line: number, ch = 0): string {
    return `${text}\n<!-- fromLink:${JSON.stringify({
        file,
        from: { line, ch },
        to: { line, ch: ch + text.length },
    })} -->`;
}

function createEdges(order: string[]): CanvasEdgeLike[] {
    return order.map((childId, index) => ({
        id: `edge-${index + 1}`,
        fromNode: 'parent',
        toNode: childId,
        fromSide: 'right',
        toSide: 'left',
    }));
}

function getChildOrder(data: CanvasDataLike): string[] {
    return (data.edges || []).map(edge => edge.toNode || '').filter(Boolean);
}

type NodeOrderServiceTestAccess = {
    applySortSiblingsByMarkdownOrder: (canvasData: CanvasDataLike) => Promise<{
        changedParents: number;
        changedEdges: number;
        updatedFromLinks: number;
    }>;
};

describe('NodeOrderService.sortSiblingsByMarkdownOrder', () => {
    it('should sort siblings by actual markdown position even when one node lacks fromLink', async () => {
        const sourcePath = 'docs/source.md';
        const sourceContent = ['Alpha concept', 'Beta concept', 'Gamma concept'].join('\n');
        const app = createAppWithMarkdown(sourcePath, sourceContent);
        const service = new NodeOrderService(app, {} as never);

        const canvasData: CanvasDataLike = {
            nodes: [
                createNode('parent', 'Parent'),
                createNode('beta', 'Beta concept'),
                createNode('alpha', withFromLink('Alpha concept', sourcePath, 0)),
                createNode('gamma', withFromLink('Gamma concept', sourcePath, 2)),
            ],
            edges: createEdges(['beta', 'alpha', 'gamma']),
        };

        const summary = await (service as unknown as NodeOrderServiceTestAccess).applySortSiblingsByMarkdownOrder(canvasData);

        expect(summary.changedParents).toBe(1);
        expect(summary.changedEdges).toBeGreaterThan(0);
        expect(getChildOrder(canvasData)).toEqual(['alpha', 'beta', 'gamma']);
    });

    it('should recover from stale fromLink and keep unresolved nodes in place', async () => {
        const sourcePath = 'docs/source.md';
        const sourceContent = ['Alpha section', 'Beta section', 'Gamma section'].join('\n');
        const app = createAppWithMarkdown(sourcePath, sourceContent);
        const service = new NodeOrderService(app, {} as never);

        const canvasData: CanvasDataLike = {
            nodes: [
                createNode('parent', 'Parent'),
                createNode('beta', withFromLink('Beta section', sourcePath, 99)),
                createNode('unknown', 'Text not present in markdown'),
                createNode('alpha', withFromLink('Alpha section', sourcePath, 88)),
            ],
            edges: createEdges(['beta', 'unknown', 'alpha']),
        };

        const summary = await (service as unknown as NodeOrderServiceTestAccess).applySortSiblingsByMarkdownOrder(canvasData);

        expect(summary.changedParents).toBe(1);
        expect(summary.changedEdges).toBeGreaterThan(0);
        expect(getChildOrder(canvasData)).toEqual(['alpha', 'unknown', 'beta']);
    });

    it('should resolve root-level markdown when fromLink path is stale and update fromLink metadata', async () => {
        const realSourcePath = '4-Optics.md';
        const staleSourcePath = 'Optics/4-Optics/4-Optics.md';
        const sourceContent = [
            '## 4.1 光的传播——简介',
            '> [!光的传播——简介]-',
            '>',
            '> ### 1. 三大宏观现象 (Macroscopic Phenomena)',
            '> 文中首先明确了光学研究的三个基本现象，它们是我们日常生活中最直观的观测对象：',
            '>',
            '> ### 2. 三大理论描述工具 (Theoretical Frameworks)',
            '> 为了解释上述现象，物理学提供了由浅入深的三套工具：',
            '>',
            '> ### 3. 核心微观机制：散射 (Scattering)',
            '> 这是本文最关键的洞察。',
        ].join('\n');
        const app = createAppWithMarkdownFiles({
            [realSourcePath]: sourceContent,
        });
        const service = new NodeOrderService(app, {} as never);

        const canvasData: CanvasDataLike = {
            nodes: [
                createNode('parent', '## 4.1 光的传播——简介'),
                createNode('n2', withFromLink('### 2. 三大理论描述工具 (Theoretical Frameworks)', staleSourcePath, 21, 2)),
                createNode('n3', withFromLink('### 3. 核心微观机制：散射 (Scattering)', staleSourcePath, 27, 2)),
                createNode('n1', withFromLink('### 1. 三大宏观现象 (Macroscopic Phenomena)', staleSourcePath, 15, 2)),
            ],
            edges: createEdges(['n2', 'n3', 'n1']),
        };

        const summary = await (service as unknown as NodeOrderServiceTestAccess).applySortSiblingsByMarkdownOrder(canvasData);

        expect(summary.changedParents).toBe(1);
        expect(summary.changedEdges).toBeGreaterThan(0);
        expect(summary.updatedFromLinks).toBe(3);
        expect(getChildOrder(canvasData)).toEqual(['n1', 'n2', 'n3']);
        expect(canvasData.nodes?.find(node => node.id === 'n1')?.text).toContain(`"file":"${realSourcePath}"`);
        expect(canvasData.nodes?.find(node => node.id === 'n2')?.text).toContain('"from":{"line":6');
        expect(canvasData.nodes?.find(node => node.id === 'n3')?.text).toContain('"from":{"line":9');
    });

    it('should clear stale unmatched flag when reliable fromLink is already correct', async () => {
        const sourcePath = 'docs/source.md';
        const sourceContent = ['Alpha concept', 'Beta concept'].join('\n');
        const app = createAppWithMarkdown(sourcePath, sourceContent);
        const service = new NodeOrderService(app, {} as never);

        const alpha = createNode('alpha', withFromLink('Alpha concept', sourcePath, 0));
        alpha.data = {
            fromLinkRepair: {
                unmatched: true,
                updatedAt: 1,
            },
        };

        const canvasData: CanvasDataLike = {
            nodes: [
                createNode('parent', 'Parent'),
                alpha,
                createNode('beta', withFromLink('Beta concept', sourcePath, 1)),
            ],
            edges: createEdges(['alpha', 'beta']),
        };

        const summary = await (service as unknown as NodeOrderServiceTestAccess).applySortSiblingsByMarkdownOrder(canvasData);

        expect(summary.changedEdges).toBe(0);
        expect(summary.updatedFromLinks).toBe(1);
        expect(canvasData.nodes?.find(node => node.id === 'alpha')?.data?.fromLinkRepair?.unmatched).toBe(false);
    });
});