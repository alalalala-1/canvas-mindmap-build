import { App, ItemView, Notice, TFile } from 'obsidian';
import { CanvasFileService } from './canvas-file-service';
import { CanvasDataLike, CanvasEdgeLike, CanvasLike, CanvasNodeLike } from '../types';
import {
    getCanvasView,
    getCurrentCanvasFilePath,
    getEdgeFromNodeId,
    getEdgeToNodeId,
    getSelectedNodeFromCanvas,
    parseFromLink,
    stripInvisibleMarkup,
} from '../../utils/canvas-utils';
import { log } from '../../utils/logger';

type MoveDirection = 'up' | 'down';

type EdgeEntry = {
    edge: CanvasEdgeLike;
    edgeIndex: number;
    childId: string;
    parentId: string;
};

type NodeOrderChangeSummary = {
    changedParents: number;
    changedEdges: number;
    updatedFromLinks: number;
};

type NormalizedLineEntry = {
    raw: string;
    normalized: string;
};

type LineCandidate = {
    line: number;
    startCh: number;
    endCh: number;
    score: number;
    method: string;
};

type ResolvedMarkdownPosition = {
    nodeId: string;
    file: string;
    line: number;
    ch: number;
    score: number;
    method: string;
    originalIndex: number;
    fromLinkUpdated: boolean;
};

type SourceDocument = {
    file: TFile;
    path: string;
    lines: string[];
    lineIndex: NormalizedLineEntry[];
};

export class NodeOrderService {
    constructor(
        private app: App,
        private canvasFileService: CanvasFileService
    ) {}

    async sortSiblingsByMarkdownOrder(): Promise<boolean> {
        const selectedFilePath = this.getActiveCanvasFilePath();
        if (!selectedFilePath) {
            new Notice('请先打开 Canvas 文件');
            return false;
        }

        let summary: NodeOrderChangeSummary = { changedParents: 0, changedEdges: 0, updatedFromLinks: 0 };
        const success = await this.canvasFileService.modifyCanvasDataAtomic(selectedFilePath, async (data) => {
            summary = await this.applySortSiblingsByMarkdownOrder(data);
            return summary.changedEdges > 0 || summary.updatedFromLinks > 0;
        });

        if (!success || (summary.changedEdges === 0 && summary.updatedFromLinks === 0)) {
            new Notice('同级节点顺序无需调整');
            return false;
        }

        if (summary.changedEdges > 0) {
            new Notice(`已按 Markdown 顺序重排：父节点 ${summary.changedParents} 个`);
        } else {
            new Notice(`已校正 fromLink 路径/定位：${summary.updatedFromLinks} 个节点`);
        }
        log(`[NodeOrder] SortByMarkdown: changedParents=${summary.changedParents}, changedEdges=${summary.changedEdges}, updatedFromLinks=${summary.updatedFromLinks}`);
        return true;
    }

    async moveSelectedNode(direction: MoveDirection): Promise<boolean> {
        const selectedNodeId = this.getSelectedNodeIdFromActiveCanvas();
        if (!selectedNodeId) {
            new Notice('请先选中一个节点');
            return false;
        }

        const selectedFilePath = this.getActiveCanvasFilePath();
        if (!selectedFilePath) {
            new Notice('请先打开 Canvas 文件');
            return false;
        }

        const outcomeRef: {
            value: 'changed' | 'edge' | 'top' | 'bottom' | 'multi-parent' | 'floating' | 'root'
        } = { value: 'edge' };

        const success = await this.canvasFileService.modifyCanvasDataAtomic(selectedFilePath, (data) => {
            const result = this.applyMoveSelectedNode(data, selectedNodeId, direction);
            outcomeRef.value = result.outcome;
            return result.changed;
        });

        const outcome = outcomeRef.value;

        if (success && outcome === 'changed') {
            new Notice(direction === 'up' ? '节点已上移' : '节点已下移');
            return true;
        }

        if (outcome === 'top') {
            new Notice('已在最上方，无法继续上移');
        } else if (outcome === 'bottom') {
            new Notice('已在最下方，无法继续下移');
        } else if (outcome === 'multi-parent') {
            new Notice('该节点存在多个父节点，已拒绝顺序调整');
        } else if (outcome === 'floating') {
            new Notice('浮动节点暂不支持该操作');
        } else if (outcome === 'root') {
            new Notice('根节点暂不支持此顺序调整');
        } else {
            new Notice('无法调整节点顺序');
        }

        return false;
    }

    async indentSelectedNode(): Promise<boolean> {
        const selectedNodeId = this.getSelectedNodeIdFromActiveCanvas();
        if (!selectedNodeId) {
            new Notice('请先选中一个节点');
            return false;
        }

        const selectedFilePath = this.getActiveCanvasFilePath();
        if (!selectedFilePath) {
            new Notice('请先打开 Canvas 文件');
            return false;
        }

        const outcomeRef: { value: 'changed' | 'guard' | 'noop' } = { value: 'noop' };
        const success = await this.canvasFileService.modifyCanvasDataAtomic(selectedFilePath, (data) => {
            const result = this.applyIndentSelectedNode(data, selectedNodeId);
            outcomeRef.value = result.outcome;
            return result.changed;
        });

        const outcome = outcomeRef.value;

        if (success && outcome === 'changed') {
            new Notice('节点已右移一级（缩进）');
            return true;
        }

        if (outcome === 'guard') {
            new Notice('当前结构不满足缩进条件（仅支持树状单父节点）');
        } else {
            new Notice('无法缩进：需要存在前一个同级节点');
        }

        return false;
    }

    async outdentSelectedNode(): Promise<boolean> {
        const selectedNodeId = this.getSelectedNodeIdFromActiveCanvas();
        if (!selectedNodeId) {
            new Notice('请先选中一个节点');
            return false;
        }

        const selectedFilePath = this.getActiveCanvasFilePath();
        if (!selectedFilePath) {
            new Notice('请先打开 Canvas 文件');
            return false;
        }

        const outcomeRef: { value: 'changed' | 'guard' | 'noop' } = { value: 'noop' };
        const success = await this.canvasFileService.modifyCanvasDataAtomic(selectedFilePath, (data) => {
            const result = this.applyOutdentSelectedNode(data, selectedNodeId);
            outcomeRef.value = result.outcome;
            return result.changed;
        });

        const outcome = outcomeRef.value;

        if (success && outcome === 'changed') {
            new Notice('节点已左移一级（提升层级）');
            return true;
        }

        if (outcome === 'guard') {
            new Notice('当前结构不满足提升层级条件（仅支持树状单父节点）');
        } else {
            new Notice('无法提升层级：当前父节点已是根级');
        }

        return false;
    }

    private async applySortSiblingsByMarkdownOrder(canvasData: CanvasDataLike): Promise<NodeOrderChangeSummary> {
        if (!Array.isArray(canvasData.edges) || !Array.isArray(canvasData.nodes)) {
            return { changedParents: 0, changedEdges: 0, updatedFromLinks: 0 };
        }

        const nodeById = new Map<string, CanvasNodeLike>();
        for (const node of canvasData.nodes) {
            if (typeof node?.id === 'string') nodeById.set(node.id, node);
        }

        const parentIds = this.collectParentIds(canvasData.edges);
        const inferredSourcePath = this.inferDominantSourceFilePath(canvasData);
        const documentCache = new Map<string, Promise<SourceDocument | null>>();
        let changedParents = 0;
        let changedEdges = 0;
        let updatedFromLinks = 0;
        const parentLogs: string[] = [];

        for (const parentId of parentIds) {
            const outgoing = this.getOutgoingEdgeEntries(canvasData, parentId);
            const childOrder = this.getUniqueChildOrder(outgoing);
            if (childOrder.length <= 1) continue;

            const resolvedEntries = await Promise.all(childOrder.map((childId, index) => {
                const node = nodeById.get(childId);
                return this.resolveNodeMarkdownPosition(node, inferredSourcePath, documentCache, index);
            }));

            for (const entry of resolvedEntries) {
                if (entry?.fromLinkUpdated) {
                    updatedFromLinks++;
                }
            }

            const resolvedMap = this.buildResolvedPositionMap(resolvedEntries);
            if (resolvedMap.size <= 1) continue;

            const sortedResolvedIds = [...resolvedMap.values()]
                .sort((a, b) => this.compareResolvedPositions(a, b))
                .map(position => position.nodeId);

            const sortedChildren = this.mergeResolvedChildrenPreservingUnresolvedSlots(
                childOrder,
                new Set(sortedResolvedIds),
                sortedResolvedIds
            );

            if (!this.isSameOrder(childOrder, sortedChildren)) {
                const moved = this.reorderParentEdgesByChildOrder(canvasData, parentId, sortedChildren);
                if (moved > 0) {
                    changedParents++;
                    changedEdges += moved;
                    if (parentLogs.length < 8) {
                        const resolvedSummary = [...resolvedMap.values()]
                            .sort((a, b) => a.originalIndex - b.originalIndex)
                            .map(position => `${position.nodeId}@${position.file}:${position.line}:${position.ch}[${position.method},${position.score}]`)
                            .join(' | ');
                        parentLogs.push(`parent=${parentId} before=${childOrder.join('|')} after=${sortedChildren.join('|')} resolved=${resolvedSummary}`);
                    }
                }
            }
        }

        if (parentLogs.length > 0) {
            log(`[NodeOrder] ParentMarkdownReorder: ${parentLogs.join(' || ')}`);
        }

        return { changedParents, changedEdges, updatedFromLinks };
    }

    private async resolveNodeMarkdownPosition(
        node: CanvasNodeLike | undefined,
        fallbackSourcePath: string | null,
        documentCache: Map<string, Promise<SourceDocument | null>>,
        originalIndex: number
    ): Promise<ResolvedMarkdownPosition | null> {
        const nodeId = typeof node?.id === 'string' ? node.id : null;
        if (!node || !nodeId) return null;

        const rawNodeText = (node?.text || '').replace(/<!--[\s\S]*?-->/g, '');
        const normalizedNode = this.normalizeForMatch(rawNodeText);
        if (!normalizedNode) return null;

        const fromLink = parseFromLink(node?.text, node?.color);
        const documents = await this.getCandidateSourceDocuments(fromLink?.file, fallbackSourcePath, documentCache);
        if (documents.length === 0) return null;

        const anchorLine = typeof fromLink?.from?.line === 'number' ? fromLink.from.line : null;
        let bestMatch: { document: SourceDocument; candidate: LineCandidate; method: string } | null = null;

        for (const document of documents) {
            const anchored = anchorLine !== null
                ? this.matchNodeAtSpecificLine(node, document.lines, document.lineIndex, anchorLine)
                : null;

            if (anchored && this.isReliableMatch(anchored, normalizedNode.length, true)) {
                bestMatch = this.pickBetterDocumentMatch(bestMatch, {
                    document,
                    candidate: anchored,
                    method: `validated-${anchored.method}`,
                }, fromLink?.file, fallbackSourcePath);
                continue;
            }

            const matched = this.matchNodeToSource(node, document.lines, document.lineIndex, anchorLine);
            if (!matched || !this.isReliableMatch(matched, normalizedNode.length, anchorLine !== null)) {
                continue;
            }

            bestMatch = this.pickBetterDocumentMatch(bestMatch, {
                document,
                candidate: matched,
                method: matched.method,
            }, fromLink?.file, fallbackSourcePath);
        }

        if (!bestMatch) return null;

        const fromLinkUpdated = this.updateNodeFromLinkIfNeeded(node, fromLink, bestMatch.document.path, bestMatch.candidate);

        return {
            nodeId,
            file: bestMatch.document.path,
            line: bestMatch.candidate.line,
            ch: bestMatch.candidate.startCh,
            score: bestMatch.candidate.score,
            method: bestMatch.method,
            originalIndex,
            fromLinkUpdated,
        };
    }

    private async getCandidateSourceDocuments(
        fromLinkPath: string | null | undefined,
        fallbackSourcePath: string | null,
        documentCache: Map<string, Promise<SourceDocument | null>>
    ): Promise<SourceDocument[]> {
        const files = this.resolveVaultMarkdownFiles(fromLinkPath, fallbackSourcePath);
        if (files.length === 0) return [];

        const documents = await Promise.all(files.map(file => this.getSourceDocument(file.path, documentCache)));
        return documents.filter((document): document is SourceDocument => !!document);
    }

    private pickBetterDocumentMatch(
        current: { document: SourceDocument; candidate: LineCandidate; method: string } | null,
        next: { document: SourceDocument; candidate: LineCandidate; method: string },
        fromLinkPath: string | null | undefined,
        fallbackSourcePath: string | null
    ): { document: SourceDocument; candidate: LineCandidate; method: string } {
        if (!current) return next;

        const currentPriority = this.getDocumentMatchPriority(current.document.path, fromLinkPath, fallbackSourcePath);
        const nextPriority = this.getDocumentMatchPriority(next.document.path, fromLinkPath, fallbackSourcePath);

        if (next.candidate.score !== current.candidate.score) {
            return next.candidate.score > current.candidate.score ? next : current;
        }

        if (nextPriority !== currentPriority) {
            return nextPriority > currentPriority ? next : current;
        }

        if (next.candidate.line !== current.candidate.line) {
            return next.candidate.line < current.candidate.line ? next : current;
        }

        return current;
    }

    private getDocumentMatchPriority(path: string, fromLinkPath: string | null | undefined, fallbackSourcePath: string | null): number {
        let priority = 0;
        if (fromLinkPath && path === fromLinkPath) priority += 6;
        if (fallbackSourcePath && path === fallbackSourcePath) priority += 5;

        const pathName = path.split('/').pop() || '';
        const fromLinkName = fromLinkPath?.split('/').pop() || '';
        const fallbackName = fallbackSourcePath?.split('/').pop() || '';

        if (fromLinkName && pathName === fromLinkName) priority += 3;
        if (fallbackName && pathName === fallbackName) priority += 2;
        if (!path.includes('/')) priority += 1;

        return priority;
    }

    private buildResolvedPositionMap(
        resolvedEntries: Array<ResolvedMarkdownPosition | null>
    ): Map<string, ResolvedMarkdownPosition> {
        const bestBySlot = new Map<string, ResolvedMarkdownPosition>();
        const byNodeId = new Map<string, ResolvedMarkdownPosition>();

        for (const entry of resolvedEntries) {
            if (!entry) continue;
            const slotKey = `${entry.file}:${entry.line}:${entry.ch}`;
            const previous = bestBySlot.get(slotKey);
            if (!previous) {
                bestBySlot.set(slotKey, entry);
                byNodeId.set(entry.nodeId, entry);
                continue;
            }

            const shouldReplace = entry.score > previous.score
                || (entry.score === previous.score && entry.originalIndex < previous.originalIndex);

            if (shouldReplace) {
                byNodeId.delete(previous.nodeId);
                bestBySlot.set(slotKey, entry);
                byNodeId.set(entry.nodeId, entry);
            }
        }

        return byNodeId;
    }

    private compareResolvedPositions(a: ResolvedMarkdownPosition, b: ResolvedMarkdownPosition): number {
        if (a.file === b.file) {
            if (a.line !== b.line) return a.line - b.line;
            if (a.ch !== b.ch) return a.ch - b.ch;
            if (a.score !== b.score) return b.score - a.score;
        }

        return a.originalIndex - b.originalIndex;
    }

    private mergeResolvedChildrenPreservingUnresolvedSlots(
        childOrder: string[],
        resolvedChildIds: Set<string>,
        sortedResolvedIds: string[]
    ): string[] {
        const iterator = sortedResolvedIds[Symbol.iterator]();

        return childOrder.map(childId => {
            if (!resolvedChildIds.has(childId)) return childId;
            return iterator.next().value ?? childId;
        });
    }

    private inferDominantSourceFilePath(canvasData: CanvasDataLike): string | null {
        const fileCounts = new Map<string, number>();

        for (const node of canvasData.nodes || []) {
            const parsed = parseFromLink(node.text, node.color);
            if (!parsed?.file) continue;
            fileCounts.set(parsed.file, (fileCounts.get(parsed.file) || 0) + 1);
        }

        let bestPath: string | null = null;
        let bestCount = -1;
        for (const [path, count] of fileCounts.entries()) {
            if (count > bestCount) {
                bestPath = path;
                bestCount = count;
            }
        }

        return bestPath;
    }

    private async getSourceDocument(
        pathHint: string | null | undefined,
        documentCache: Map<string, Promise<SourceDocument | null>>
    ): Promise<SourceDocument | null> {
        if (!pathHint) return null;

        const cacheKey = pathHint;
        const cached = documentCache.get(cacheKey);
        if (cached) return cached;

        const loading = (async () => {
            const file = this.resolveVaultMarkdownFile(pathHint);
            if (!(file instanceof TFile)) return null;

            const content = await this.app.vault.read(file);
            const lines = content.split('\n');
            return {
                file,
                path: file.path,
                lines,
                lineIndex: this.buildNormalizedLineIndex(lines),
            } satisfies SourceDocument;
        })();

        documentCache.set(cacheKey, loading);
        return loading;
    }

    private resolveVaultMarkdownFile(pathHint: string): TFile | null {
        return this.resolveVaultMarkdownFiles(pathHint)[0] ?? null;
    }

    private resolveVaultMarkdownFiles(...pathHints: Array<string | null | undefined>): TFile[] {
        const candidates: TFile[] = [];
        const seen = new Set<string>();
        const allFiles = this.app.vault.getFiles().filter(file => file.extension === 'md');

        const pushCandidate = (file: TFile | null | undefined): void => {
            if (!(file instanceof TFile) || file.extension !== 'md') return;
            if (seen.has(file.path)) return;
            seen.add(file.path);
            candidates.push(file);
        };

        for (const pathHint of pathHints) {
            if (!pathHint) continue;

            const direct = this.app.vault.getAbstractFileByPath(pathHint);
            if (direct instanceof TFile && direct.extension === 'md') {
                pushCandidate(direct);
            }

            const fileName = pathHint.split('/').pop() || '';
            const stem = fileName.replace(/\.md$/i, '');

            for (const file of allFiles) {
                if (file.path.endsWith(`/${pathHint}`)) {
                    pushCandidate(file);
                }
            }

            for (const file of allFiles) {
                if (fileName && file.name === fileName) {
                    pushCandidate(file);
                }
            }

            for (const file of allFiles) {
                if (stem && file.path.includes(stem)) {
                    pushCandidate(file);
                }
            }
        }

        return candidates;
    }

    private updateNodeFromLinkIfNeeded(
        node: CanvasNodeLike,
        fromLink: ReturnType<typeof parseFromLink>,
        filePath: string,
        candidate: LineCandidate
    ): boolean {
        if (!fromLink) return false;

        const nextRange = {
            file: filePath,
            from: { line: candidate.line, ch: candidate.startCh },
            to: { line: candidate.line, ch: candidate.endCh },
        };

        const unchanged = fromLink.file === nextRange.file
            && fromLink.from.line === nextRange.from.line
            && fromLink.from.ch === nextRange.from.ch
            && fromLink.to.line === nextRange.to.line
            && fromLink.to.ch === nextRange.to.ch;
        if (unchanged) return false;

        const serialized = JSON.stringify(nextRange);
        const nextComment = `<!-- fromLink:${serialized} -->`;
        const currentText = node.text || '';

        if (currentText.includes('<!-- fromLink:')) {
            const replaced = currentText.replace(/<!-- fromLink:[\s\S]*? -->/, nextComment);
            if (replaced !== currentText) {
                node.text = replaced;
                return true;
            }
        }

        const currentColor = node.color || '';
        if (currentColor.startsWith('fromLink:')) {
            const nextColor = `fromLink:${serialized}`;
            if (nextColor !== currentColor) {
                node.color = nextColor;
                return true;
            }
        }

        return false;
    }

    private normalizeForMatch(text: string): string {
        return stripInvisibleMarkup(text || '')
            .replace(/\r/g, '')
            .replace(/^\s*>+\s?/gm, '')
            .replace(/^\s*(?:[-*+]\s+|\d+\.\s+)/gm, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    private buildNormalizedLineIndex(lines: string[]): NormalizedLineEntry[] {
        return lines.map(raw => ({ raw, normalized: this.normalizeForMatch(raw) }));
    }

    private matchNodeAtSpecificLine(
        node: CanvasNodeLike,
        sourceLines: string[],
        lineIndex: NormalizedLineEntry[],
        line: number
    ): LineCandidate | null {
        if (line < 0 || line >= sourceLines.length) return null;
        const rawNodeText = (node.text || '').replace(/<!--[\s\S]*?-->/g, '');
        const normalizedNode = this.normalizeForMatch(rawNodeText);
        const normalized = lineIndex[line]?.normalized || '';
        const raw = sourceLines[line] || '';
        if (!normalized || !normalizedNode) return null;

        let score = 0;
        let method = '';
        if (normalized === normalizedNode) {
            score = 180;
            method = 'L0-exact';
        } else if (normalized.includes(normalizedNode)) {
            score = 132;
            method = 'L1-contains';
        } else {
            const longestLine = rawNodeText
                .split('\n')
                .map(part => this.normalizeForMatch(part))
                .filter(Boolean)
                .reduce((longest, current) => current.length > longest.length ? current : longest, '');
            if (longestLine && normalized.includes(longestLine) && longestLine.length >= 12) {
                score = 104;
                method = 'L3-longest-line';
            }
        }

        if (score <= 0) return null;

        const rawRange = this.findRawRangeInLine(raw, rawNodeText);
        return {
            line,
            startCh: rawRange?.startCh ?? 0,
            endCh: rawRange?.endCh ?? raw.length,
            score: rawRange ? score + 12 : score,
            method,
        };
    }

    private matchNodeToSource(
        node: CanvasNodeLike,
        sourceLines: string[],
        lineIndex: NormalizedLineEntry[],
        anchorLine: number | null
    ): LineCandidate | null {
        const rawNodeText = (node.text || '').replace(/<!--[\s\S]*?-->/g, '');
        const normalizedNode = this.normalizeForMatch(rawNodeText);
        if (!normalizedNode) return null;

        const nodeLines = rawNodeText.split('\n').map(line => this.normalizeForMatch(line)).filter(Boolean);
        const longestLine = nodeLines.reduce((longest, current) => current.length > longest.length ? current : longest, '');
        const candidates: LineCandidate[] = [];
        const keyPhrase = this.pickKeyPhrase(normalizedNode);
        const isShortNode = normalizedNode.length < 8;

        for (let i = 0; i < lineIndex.length; i++) {
            const raw = sourceLines[i] || '';
            const normalized = lineIndex[i]?.normalized || '';
            if (!normalized) continue;

            let score = 0;
            let startCh = 0;
            let endCh = raw.length;
            let method = '';

            if (normalized === normalizedNode) {
                score = 150;
                method = 'L0-exact';
            } else if (normalized.includes(normalizedNode)) {
                const lengthRatio = normalizedNode.length / Math.max(1, normalized.length);
                score = 100 + Math.floor(Math.max(0, Math.min(1, lengthRatio)) * 30);
                method = 'L1-contains';
            } else if (normalizedNode.includes(normalized) && normalized.length >= 20) {
                score = 86;
                method = 'L2-reverse-contains';
            } else if (longestLine && normalized.includes(longestLine) && longestLine.length >= 12) {
                score = 80;
                method = 'L3-longest-line';
            } else if (keyPhrase && normalized.includes(keyPhrase)) {
                score = 72;
                method = 'L4-key-phrase';
            }

            if (score <= 0) continue;
            if (isShortNode && method !== 'L0-exact') {
                score = Math.min(score, 80);
            }

            const rawRange = this.findRawRangeInLine(raw, rawNodeText);
            if (rawRange) {
                startCh = rawRange.startCh;
                endCh = rawRange.endCh;
                score += 12;
            }

            if (anchorLine !== null) {
                const distance = Math.abs(i - anchorLine);
                if (distance <= 30) score += 30;
                else if (distance <= 60) score += 20;
                else if (distance <= 120) score += 8;
            }

            if (/^#{1,6}\s+/.test(rawNodeText.trim())) {
                const heading = rawNodeText.trim().replace(/^#{1,6}\s+/, '').toLowerCase();
                const lineHeading = (raw.match(/^\s*>*\s*#{1,6}\s+(.*)$/)?.[1] || '').toLowerCase();
                if (lineHeading.includes(heading) || heading.includes(lineHeading)) {
                    score += 14;
                }
            }

            candidates.push({ line: i, startCh, endCh, score, method });
        }

        if (candidates.length === 0) return null;

        candidates.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (anchorLine !== null) {
                return Math.abs(a.line - anchorLine) - Math.abs(b.line - anchorLine);
            }
            return a.line - b.line;
        });

        return candidates[0] || null;
    }

    private isReliableMatch(candidate: LineCandidate, normalizedLength: number, hasAnchor: boolean): boolean {
        if (normalizedLength < 4) return false;
        if (candidate.method === 'L0-exact') return true;

        if (candidate.method === 'L1-contains') {
            return normalizedLength >= 6 && candidate.score >= (hasAnchor ? 100 : 108);
        }

        if (candidate.method === 'L3-longest-line') {
            return candidate.score >= (hasAnchor ? 104 : 112);
        }

        return candidate.score >= (hasAnchor ? 112 : 120);
    }

    private findRawRangeInLine(rawLine: string, rawNodeText: string): { startCh: number; endCh: number } | null {
        const { content, offset } = this.stripLinePrefixWithOffset(rawLine);
        const { stripped, rawIndices } = this.stripHtmlTagsWithMapping(content);
        const strippedNodeText = stripInvisibleMarkup(rawNodeText || '').trim();
        if (!strippedNodeText) return null;

        const fullNeedle = strippedNodeText
            .replace(/\r/g, '')
            .replace(/\n+/g, '')
            .trim();

        const fullNeedleVariants = [fullNeedle, this.trimTrailingPunctuation(fullNeedle)]
            .filter((value, index, self) => value.length >= 6 && self.indexOf(value) === index);

        for (const variant of fullNeedleVariants) {
            const fullIdx = stripped.indexOf(variant);
            const fullRange = this.mapRawRangeFromStrippedIndex(fullIdx, variant.length, rawIndices, offset);
            if (fullRange) return fullRange;
        }

        const needles = strippedNodeText
            .split('\n')
            .map(part => part.trim())
            .filter(part => part.length >= 4)
            .sort((a, b) => b.length - a.length);

        let minStart = Number.POSITIVE_INFINITY;
        let maxEnd = Number.NEGATIVE_INFINITY;
        let matchedParts = 0;

        for (const needle of needles) {
            const variants = [needle, this.trimTrailingPunctuation(needle)]
                .filter((value, index, self) => value.length >= 3 && self.indexOf(value) === index);

            for (const variant of variants) {
                const index = stripped.indexOf(variant);
                const partRange = this.mapRawRangeFromStrippedIndex(index, variant.length, rawIndices, offset);
                if (!partRange) continue;

                matchedParts++;
                minStart = Math.min(minStart, partRange.startCh);
                maxEnd = Math.max(maxEnd, partRange.endCh);
                break;
            }
        }

        if (matchedParts > 0 && Number.isFinite(minStart) && Number.isFinite(maxEnd) && maxEnd > minStart) {
            return { startCh: minStart, endCh: maxEnd };
        }

        return null;
    }

    private trimTrailingPunctuation(text: string): string {
        return (text || '').replace(/[：:。\.、，,；;！!？?…·]+$/u, '').trimEnd();
    }

    private mapRawRangeFromStrippedIndex(
        strippedIndex: number,
        length: number,
        rawIndices: number[],
        offset: number
    ): { startCh: number; endCh: number } | null {
        if (strippedIndex < 0 || length <= 0) return null;
        const rawStart = rawIndices[strippedIndex];
        const rawEnd = rawIndices[strippedIndex + length - 1];
        if (rawStart === undefined || rawEnd === undefined) return null;
        return {
            startCh: offset + rawStart,
            endCh: offset + rawEnd + 1,
        };
    }

    private stripHtmlTagsWithMapping(text: string): { stripped: string; rawIndices: number[] } {
        const raw = text || '';
        const chars: string[] = [];
        const rawIndices: number[] = [];

        let index = 0;
        while (index < raw.length) {
            const ch = raw.charAt(index);
            if (ch === '<') {
                const closeIndex = raw.indexOf('>', index + 1);
                if (closeIndex >= 0) {
                    index = closeIndex + 1;
                    continue;
                }
            }

            chars.push(ch);
            rawIndices.push(index);
            index++;
        }

        return { stripped: chars.join(''), rawIndices };
    }

    private stripLinePrefixWithOffset(rawLine: string): { content: string; offset: number } {
        let content = rawLine || '';
        let offset = 0;

        while (true) {
            const quotePrefix = content.match(/^\s*>+\s?/);
            if (!quotePrefix?.[0]) break;
            offset += quotePrefix[0].length;
            content = content.slice(quotePrefix[0].length);
        }

        const listPrefix = content.match(/^\s*(?:[-*+]\s+|\d+\.\s+)/);
        if (listPrefix?.[0]) {
            offset += listPrefix[0].length;
            content = content.slice(listPrefix[0].length);
        }

        return { content, offset };
    }

    private pickKeyPhrase(text: string): string {
        const clean = text.replace(/\s+/g, ' ').trim();
        if (clean.length < 12) return clean;
        if (clean.length <= 32) return clean;
        return clean.slice(0, 32).trim();
    }

    private applyMoveSelectedNode(
        canvasData: CanvasDataLike,
        selectedNodeId: string,
        direction: MoveDirection
    ): { changed: boolean; outcome: 'changed' | 'edge' | 'top' | 'bottom' | 'multi-parent' | 'floating' | 'root' } {
        const nodeById = this.buildNodeMap(canvasData);
        if (this.isFloatingNode(nodeById.get(selectedNodeId))) {
            return { changed: false, outcome: 'floating' };
        }

        const incoming = this.getIncomingEdgeEntries(canvasData, selectedNodeId);
        if (incoming.length > 1) {
            return { changed: false, outcome: 'multi-parent' };
        }
        if (incoming.length === 0) {
            return { changed: false, outcome: 'root' };
        }

        const parentId = incoming[0]?.parentId;
        if (!parentId) {
            return { changed: false, outcome: 'edge' };
        }
        if (this.isFloatingNode(nodeById.get(parentId))) {
            return { changed: false, outcome: 'floating' };
        }

        const outgoing = this.getOutgoingEdgeEntries(canvasData, parentId);
        const childOrder = this.getUniqueChildOrder(outgoing);
        const currentIndex = childOrder.indexOf(selectedNodeId);

        if (currentIndex < 0) {
            return { changed: false, outcome: 'edge' };
        }

        if (direction === 'up' && currentIndex === 0) {
            return { changed: false, outcome: 'top' };
        }

        if (direction === 'down' && currentIndex === childOrder.length - 1) {
            return { changed: false, outcome: 'bottom' };
        }

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        const targetId = childOrder[targetIndex];
        if (!targetId) {
            return { changed: false, outcome: 'edge' };
        }

        childOrder[targetIndex] = selectedNodeId;
        childOrder[currentIndex] = targetId;

        const moved = this.reorderParentEdgesByChildOrder(canvasData, parentId, childOrder);
        return { changed: moved > 0, outcome: moved > 0 ? 'changed' : 'edge' };
    }

    private applyIndentSelectedNode(
        canvasData: CanvasDataLike,
        selectedNodeId: string
    ): { changed: boolean; outcome: 'changed' | 'guard' | 'noop' } {
        const nodeById = this.buildNodeMap(canvasData);
        if (this.isFloatingNode(nodeById.get(selectedNodeId))) {
            return { changed: false, outcome: 'guard' };
        }

        const selectedIncoming = this.getIncomingEdgeEntries(canvasData, selectedNodeId);
        if (selectedIncoming.length !== 1) {
            return { changed: false, outcome: 'guard' };
        }

        const selectedIncomingEdge = selectedIncoming[0]?.edge;
        const parentId = selectedIncoming[0]?.parentId;
        if (!selectedIncomingEdge || !parentId) {
            return { changed: false, outcome: 'guard' };
        }

        if (this.isFloatingNode(nodeById.get(parentId))) {
            return { changed: false, outcome: 'guard' };
        }

        const siblings = this.getUniqueChildOrder(this.getOutgoingEdgeEntries(canvasData, parentId));
        const selectedIndex = siblings.indexOf(selectedNodeId);
        if (selectedIndex <= 0) {
            return { changed: false, outcome: 'noop' };
        }

        const newParentId = siblings[selectedIndex - 1];
        if (!newParentId || this.isFloatingNode(nodeById.get(newParentId))) {
            return { changed: false, outcome: 'guard' };
        }

        const parentReassigned = this.setEdgeFromNodeId(selectedIncomingEdge, newParentId);

        const newParentChildren = this.getUniqueChildOrder(this.getOutgoingEdgeEntries(canvasData, newParentId));
        const normalizedChildren = newParentChildren.filter(id => id !== selectedNodeId);
        normalizedChildren.push(selectedNodeId);

        let moved = 0;
        moved += this.reorderParentEdgesByChildOrder(canvasData, newParentId, normalizedChildren);
        moved += this.reorderParentEdgesByChildOrder(
            canvasData,
            parentId,
            this.getUniqueChildOrder(this.getOutgoingEdgeEntries(canvasData, parentId))
        );

        const changed = parentReassigned || moved > 0;
        return { changed, outcome: changed ? 'changed' : 'guard' };
    }

    private applyOutdentSelectedNode(
        canvasData: CanvasDataLike,
        selectedNodeId: string
    ): { changed: boolean; outcome: 'changed' | 'guard' | 'noop' } {
        const nodeById = this.buildNodeMap(canvasData);
        if (this.isFloatingNode(nodeById.get(selectedNodeId))) {
            return { changed: false, outcome: 'guard' };
        }

        const selectedIncoming = this.getIncomingEdgeEntries(canvasData, selectedNodeId);
        if (selectedIncoming.length !== 1) {
            return { changed: false, outcome: 'guard' };
        }

        const selectedIncomingEdge = selectedIncoming[0]?.edge;
        const parentId = selectedIncoming[0]?.parentId;
        if (!selectedIncomingEdge || !parentId) {
            return { changed: false, outcome: 'guard' };
        }

        const parentIncoming = this.getIncomingEdgeEntries(canvasData, parentId);
        if (parentIncoming.length !== 1) {
            return { changed: false, outcome: parentIncoming.length === 0 ? 'noop' : 'guard' };
        }

        const grandParentId = parentIncoming[0]?.parentId;
        if (!grandParentId) {
            return { changed: false, outcome: 'noop' };
        }

        if (this.isFloatingNode(nodeById.get(parentId)) || this.isFloatingNode(nodeById.get(grandParentId))) {
            return { changed: false, outcome: 'guard' };
        }

        const grandChildren = this.getUniqueChildOrder(this.getOutgoingEdgeEntries(canvasData, grandParentId));
        const normalized = grandChildren.filter(id => id !== selectedNodeId);
        const parentIndex = normalized.indexOf(parentId);
        if (parentIndex < 0) {
            return { changed: false, outcome: 'guard' };
        }

        const parentReassigned = this.setEdgeFromNodeId(selectedIncomingEdge, grandParentId);

        normalized.splice(parentIndex + 1, 0, selectedNodeId);
        const moved = this.reorderParentEdgesByChildOrder(canvasData, grandParentId, normalized);

        const changed = parentReassigned || moved > 0;
        return { changed, outcome: changed ? 'changed' : 'guard' };
    }

    private reorderParentEdgesByChildOrder(canvasData: CanvasDataLike, parentId: string, childOrder: string[]): number {
        if (!Array.isArray(canvasData.edges)) return 0;

        const entries = this.getOutgoingEdgeEntries(canvasData, parentId);
        if (entries.length <= 1) return 0;

        const rankByChild = new Map<string, number>();
        childOrder.forEach((childId, idx) => rankByChild.set(childId, idx));

        const sortedEntries = [...entries].sort((a, b) => {
            const rankA = rankByChild.get(a.childId) ?? Number.MAX_SAFE_INTEGER;
            const rankB = rankByChild.get(b.childId) ?? Number.MAX_SAFE_INTEGER;
            if (rankA !== rankB) return rankA - rankB;
            return a.edgeIndex - b.edgeIndex;
        });

        const targetIndexes = entries.map(entry => entry.edgeIndex).sort((a, b) => a - b);
        let moved = 0;

        for (let i = 0; i < targetIndexes.length; i++) {
            const targetIndex = targetIndexes[i];
            const nextEdge = sortedEntries[i]?.edge;
            if (targetIndex === undefined || !nextEdge) continue;

            const prevEdge = canvasData.edges[targetIndex];
            if (prevEdge !== nextEdge) moved++;
            canvasData.edges[targetIndex] = nextEdge;
        }

        return moved;
    }

    private getOutgoingEdgeEntries(canvasData: CanvasDataLike, parentId: string): EdgeEntry[] {
        if (!Array.isArray(canvasData.edges)) return [];

        const entries: EdgeEntry[] = [];
        for (let i = 0; i < canvasData.edges.length; i++) {
            const edge = canvasData.edges[i];
            const fromId = getEdgeFromNodeId(edge);
            const toId = getEdgeToNodeId(edge);
            if (!edge || !fromId || !toId) continue;
            if (fromId !== parentId) continue;

            entries.push({ edge, edgeIndex: i, childId: toId, parentId: fromId });
        }
        return entries;
    }

    private getIncomingEdgeEntries(canvasData: CanvasDataLike, childId: string): EdgeEntry[] {
        if (!Array.isArray(canvasData.edges)) return [];

        const entries: EdgeEntry[] = [];
        for (let i = 0; i < canvasData.edges.length; i++) {
            const edge = canvasData.edges[i];
            const fromId = getEdgeFromNodeId(edge);
            const toId = getEdgeToNodeId(edge);
            if (!edge || !fromId || !toId) continue;
            if (toId !== childId) continue;

            entries.push({ edge, edgeIndex: i, childId: toId, parentId: fromId });
        }
        return entries;
    }

    private collectParentIds(edges: CanvasEdgeLike[] | undefined): Set<string> {
        const parentIds = new Set<string>();
        if (!Array.isArray(edges)) return parentIds;

        for (const edge of edges) {
            const fromId = getEdgeFromNodeId(edge);
            if (fromId) parentIds.add(fromId);
        }
        return parentIds;
    }

    private getUniqueChildOrder(entries: EdgeEntry[]): string[] {
        const seen = new Set<string>();
        const order: string[] = [];

        for (const entry of entries) {
            if (seen.has(entry.childId)) continue;
            seen.add(entry.childId);
            order.push(entry.childId);
        }
        return order;
    }

    private setEdgeFromNodeId(edge: CanvasEdgeLike, fromId: string): boolean {
        const prevFromNode = getEdgeFromNodeId(edge);
        let changed = prevFromNode !== fromId;
        edge.fromNode = fromId;

        if (typeof edge.from === 'string') {
            changed = changed || edge.from !== fromId;
            edge.from = fromId;
            return changed;
        }

        if (edge.from && typeof edge.from === 'object') {
            const fromRecord = edge.from as Record<string, unknown>;
            if ('nodeId' in fromRecord || typeof fromRecord.nodeId === 'string') {
                changed = changed || fromRecord.nodeId !== fromId;
                fromRecord.nodeId = fromId;
            }
            if (fromRecord.node && typeof fromRecord.node === 'object') {
                changed = changed || (fromRecord.node as Record<string, unknown>).id !== fromId;
                (fromRecord.node as Record<string, unknown>).id = fromId;
            }
        }

        return changed;
    }

    private buildNodeMap(canvasData: CanvasDataLike): Map<string, CanvasNodeLike> {
        const map = new Map<string, CanvasNodeLike>();
        for (const node of canvasData.nodes || []) {
            if (typeof node?.id === 'string') map.set(node.id, node);
        }
        return map;
    }

    private isFloatingNode(node: CanvasNodeLike | undefined): boolean {
        return node?.data?.isFloating === true;
    }

    private isSameOrder(a: string[], b: string[]): boolean {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    private getSelectedNodeIdFromActiveCanvas(): string | null {
        const canvasView = this.getCanvasView();
        if (!canvasView) return null;

        const canvas = (canvasView as ItemView & { canvas?: CanvasLike }).canvas;
        if (!canvas) return null;

        const selectedNode = getSelectedNodeFromCanvas(canvas);
        return selectedNode?.id || null;
    }

    private getActiveCanvasFilePath(): string | undefined {
        const canvasView = this.getCanvasView();
        if (canvasView) {
            const canvas = (canvasView as ItemView & { canvas?: CanvasLike }).canvas;
            if (canvas?.file?.path) return canvas.file.path;
            const viewFilePath = (canvasView as ItemView & { file?: { path?: string } }).file?.path;
            if (viewFilePath) return viewFilePath;
        }

        return getCurrentCanvasFilePath(this.app);
    }

    private getCanvasView(): ItemView | null {
        return getCanvasView(this.app);
    }
}
