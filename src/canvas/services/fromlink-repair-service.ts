import { App, Notice, TFile } from 'obsidian';
import { CanvasFileService } from './canvas-file-service';
import { CanvasDataLike, CanvasEdgeLike, CanvasNodeLike } from '../types';
import { getCanvasView, getEdgeFromNodeId, getEdgeToNodeId, stripInvisibleMarkup } from '../../utils/canvas-utils';
import { log, logVerbose } from '../../utils/logger';
import {
    buildNormalizedLineIndex as buildFromLinkNormalizedLineIndex,
    matchNodeToSource as matchNodeToSourceWithFormatting,
    normalizeForMatch as normalizeFromLinkMatch,
    setNodeFromLinkRepairUnmatched,
} from './fromlink-matcher';

type FromLinkRange = {
    file: string;
    from: { line: number; ch: number };
    to: { line: number; ch: number };
};

type LineCandidate = {
    line: number;
    startCh: number;
    endCh: number;
    toLine: number;
    toCh: number;
    score: number;
    method: string;
};

export class FromLinkRepairService {
    private app: App;
    private canvasFileService: CanvasFileService;

    constructor(app: App, canvasFileService: CanvasFileService) {
        this.app = app;
        this.canvasFileService = canvasFileService;
    }

    async repairFromLinksForCurrentCanvas(): Promise<void> {
        const canvasFilePath = this.canvasFileService.getCurrentCanvasFilePath();
        if (!canvasFilePath) {
            new Notice('未找到当前 canvas 文件，请先打开 canvas');
            return;
        }

        const canvasData = await this.canvasFileService.readCanvasData(canvasFilePath);
        if (!canvasData) {
            new Notice('读取 canvas 文件失败');
            return;
        }

        const allNodes = (canvasData.nodes || []);
        const targetNodes = allNodes.filter((node) => this.isRepairableTextNode(node));
        if (targetNodes.length === 0) {
            new Notice('没有需要修复 from link 的节点');
            return;
        }

        const sourcePathHint = this.inferSourceFilePath(canvasData);
        const sourceFile = await this.resolveVaultFile(sourcePathHint, targetNodes);
        if (!sourceFile) {
            new Notice(`未找到源 Markdown 文件: ${sourcePathHint || '未知'}`);
            return;
        }

        const sourceContent = await this.app.vault.read(sourceFile);
        const sourceLines = sourceContent.split('\n');

        log(`[FromLinkRepair] sourceHint=${sourcePathHint || 'none'}, resolved=${sourceFile.path}, lines=${sourceLines.length}, totalNodes=${allNodes.length}, targetNodes=${targetNodes.length}`);
        const sampleNodes = targetNodes.slice(0, 3).map((n) => `${n.id || 'unknown'}:${this.normalizeForMatch((n.text || '').slice(0, 80))}`);
        if (sampleNodes.length > 0) {
            log(`[FromLinkRepair] sampleTargets=${sampleNodes.join(' | ')}`);
        }

        const parentMap = this.buildParentMap(canvasData.edges || []);
        const lineIndex = this.buildNormalizedLineIndex(sourceLines);

        let repairedCount = 0;
        let unmatchedCount = 0;
        const unmatchedSamples: string[] = [];
        const unmatchedIds = new Set<string>();
        const matchedIds = new Set<string>();
        const repairedSamples: string[] = [];

        const updates = new Map<string, FromLinkRange>();
        const existingRanges = this.collectExistingRanges(allNodes);
        const pathFixes = this.collectPathFixes(allNodes, sourceFile.path);

        for (const node of targetNodes) {
            const nodeId = node.id || '';
            const anchorLine = this.getAnchorLine(nodeId, parentMap, existingRanges);
            const match = this.matchNodeToSource(node, sourceLines, lineIndex, anchorLine);
            if (!match) {
                unmatchedCount++;
                if (nodeId) unmatchedIds.add(nodeId);
                if (unmatchedSamples.length < 8) {
                    unmatchedSamples.push(`${nodeId}:${(node.text || '').slice(0, 24)}`);
                }
                continue;
            }

            if (nodeId) matchedIds.add(nodeId);

            updates.set(nodeId, {
                file: sourceFile.path,
                from: { line: match.line, ch: match.startCh },
                to: { line: match.toLine, ch: match.toCh }
            });

            existingRanges.set(nodeId, {
                file: sourceFile.path,
                from: { line: match.line, ch: match.startCh },
                to: { line: match.toLine, ch: match.toCh }
            });

            if (repairedSamples.length < 20) {
                repairedSamples.push(`${nodeId}->L${match.line}:${match.startCh}-${match.endCh}(${match.method},${match.score})`);
            }
            repairedCount++;
        }

        if (updates.size > 0 || unmatchedIds.size > 0 || pathFixes.size > 0 || matchedIds.size > 0) {
            const changed = await this.canvasFileService.modifyCanvasDataAtomic(canvasFilePath, (data) => {
                let modified = false;
                for (const node of data.nodes || []) {
                    if (!node.id) continue;
                    const range = updates.get(node.id);
                    const pathFix = pathFixes.get(node.id);
                    const isText = !node.type || node.type === 'text';
                    if (!isText) continue;

                    if (pathFix) {
                        const fixedJson = JSON.stringify(pathFix);
                        if ((node.text || '').includes('<!-- fromLink:')) {
                            const replacedText = (node.text || '').replace(/<!-- fromLink:[\s\S]*? -->/, `<!-- fromLink:${fixedJson} -->`);
                            if (replacedText !== node.text) {
                                node.text = replacedText;
                                modified = true;
                            }
                        } else if ((node.color || '').startsWith('fromLink:')) {
                            const nextColor = `fromLink:${fixedJson}`;
                            if (nextColor !== (node.color || '')) {
                                node.color = nextColor;
                                modified = true;
                            }
                        }
                    }

                    if (!range) continue;

                    const fromLinkJson = JSON.stringify(range);
                    const linkComment = `<!-- fromLink:${fromLinkJson} -->`;
                    const text = node.text || '';
                    if (text.includes('<!-- fromLink:')) {
                        const replacedText = text.replace(/<!-- fromLink:[\s\S]*? -->/, linkComment);
                        if (replacedText !== text) {
                            node.text = replacedText;
                            modified = true;
                        }
                        continue;
                    }

                    node.text = text.endsWith('\n') ? `${text}${linkComment}` : `${text}\n${linkComment}`;
                    modified = true;

                    if (setNodeFromLinkRepairUnmatched(node, unmatchedIds.has(node.id))) {
                        modified = true;
                    }
                    continue;
                }

                for (const node of data.nodes || []) {
                    if (!node.id) continue;
                    const isText = !node.type || node.type === 'text';
                    if (!isText) continue;

                    if (setNodeFromLinkRepairUnmatched(node, unmatchedIds.has(node.id))) {
                        modified = true;
                    }
                }
                return modified;
            });

            if (!changed) {
                log('[FromLinkRepair] 未写入变更（可能被并发更新覆盖或无实际差异）');
            }
        }

        this.applyUnmatchedStyleToRuntime(unmatchedIds);

        if (pathFixes.size > 0) {
            log(`[FromLinkRepair] pathFixed=${pathFixes.size}`);
        }
        if (repairedSamples.length > 0) {
            logVerbose(`[FromLinkRepair] repairedSamples=${repairedSamples.join(' | ')}`);
        }
        log(`[FromLinkRepair] 完成: repaired=${repairedCount}, unmatched=${unmatchedCount}, source=${sourceFile.path}, samples=${unmatchedSamples.join(' | ') || 'none'}`);
        new Notice(`fromLink 修复完成：成功 ${repairedCount}，未匹配 ${unmatchedCount}`);
    }

    private isRepairableTextNode(node: CanvasNodeLike): boolean {
        if (node.type && node.type !== 'text') return false;
        const normalized = this.normalizeForMatch((node.text || '').replace(/<!--[\s\S]*?-->/g, ''));
        return normalized.length > 0;
    }

    private applyUnmatchedStyleToRuntime(unmatchedIds: Set<string>): void {
        const canvasView = getCanvasView(this.app) as ({ canvas?: { nodes?: Map<string, CanvasNodeLike> | Record<string, CanvasNodeLike>; requestUpdate?: () => void } } | null);
        const canvas = canvasView?.canvas;
        const nodes = canvas?.nodes;

        if (nodes) {
            const runtimeNodes = nodes instanceof Map ? Array.from(nodes.values()) : Object.values(nodes);
            for (const node of runtimeNodes) {
                const nodeId = node.id || '';
                if (!nodeId) continue;

                const rawData = (node.data && typeof node.data === 'object')
                    ? (node.data as Record<string, unknown>)
                    : {};
                const repair = (rawData.fromLinkRepair && typeof rawData.fromLinkRepair === 'object')
                    ? (rawData.fromLinkRepair as Record<string, unknown>)
                    : {};
                const shouldUnmatched = unmatchedIds.has(nodeId);
                if (repair.unmatched === shouldUnmatched) continue;

                node.data = {
                    ...(rawData as CanvasNodeLike['data']),
                    fromLinkRepair: {
                        ...repair,
                        unmatched: shouldUnmatched,
                        updatedAt: Date.now()
                    }
                };
                node.update?.();
            }
            canvas.requestUpdate?.();
        }

        const allNodeEls = document.querySelectorAll('.canvas-node');
        for (const el of Array.from(allNodeEls)) {
            const nodeId = el.getAttribute('data-node-id');
            if (!nodeId) continue;
            el.classList.toggle('cmb-fromlink-unmatched', unmatchedIds.has(nodeId));
        }
    }

    private inferSourceFilePath(canvasData: CanvasDataLike): string {
        const fileCount = new Map<string, number>();
        for (const node of canvasData.nodes || []) {
            const parsed = this.parseNodeFromLink(node);
            if (!parsed?.file) continue;
            fileCount.set(parsed.file, (fileCount.get(parsed.file) || 0) + 1);
        }

        let bestPath = '';
        let bestCount = 0;
        for (const [path, count] of fileCount.entries()) {
            if (count > bestCount) {
                bestPath = path;
                bestCount = count;
            }
        }

        return bestPath;
    }

    private async resolveVaultFile(pathHint: string, targetNodes: CanvasNodeLike[]): Promise<TFile | null> {
        const allFiles = this.app.vault.getFiles().filter((f) => f.extension === 'md');
        if (allFiles.length === 0) return null;

        const candidateMap = new Map<string, TFile>();

        if (pathHint) {
            const direct = this.app.vault.getAbstractFileByPath(pathHint);
            if (direct instanceof TFile) {
                candidateMap.set(direct.path, direct);
            }
        }

        if (pathHint) {
            const fileName = pathHint.split('/').pop() || '';
            for (const file of allFiles) {
                if (file.path.endsWith(`/${pathHint}`)) candidateMap.set(file.path, file);
                if (fileName && file.name === fileName) candidateMap.set(file.path, file);
                if (fileName && file.path.includes(fileName.replace('.md', ''))) candidateMap.set(file.path, file);
            }
        }

        if (candidateMap.size === 0) {
            for (const file of allFiles) {
                candidateMap.set(file.path, file);
            }
        }

        const candidates = Array.from(candidateMap.values());
        const sampledTargets = targetNodes
            .slice(0, 6)
            .map((node) => ({ ...node, text: (node.text || '').replace(/<!--[\s\S]*?-->/g, '') }))
            .filter((node) => this.normalizeForMatch(node.text || '').length >= 6);

        type CandidateScore = { file: TFile; score: number; lines: number; matchedSamples: number };
        const scored: CandidateScore[] = [];

        for (const file of candidates) {
            let score = 0;

            if (pathHint && file.path === pathHint) score += 1000;
            if (pathHint && file.path.endsWith(`/${pathHint}`)) score += 600;
            if (pathHint) {
                const fileName = pathHint.split('/').pop() || '';
                if (fileName && file.name === fileName) score += 300;
            }

            let lines: string[] = [];
            try {
                const content = await this.app.vault.read(file);
                lines = content.split('\n');
            } catch {
                continue;
            }

            if (lines.length > 0) score += Math.min(80, Math.floor(lines.length / 80));

            const lineIndex = this.buildNormalizedLineIndex(lines);
            let matchedSamples = 0;
            let sampleScore = 0;

            for (const node of sampledTargets) {
                const match = this.matchNodeToSource(node, lines, lineIndex, null);
                if (match) {
                    matchedSamples++;
                    sampleScore += match.score;
                }
            }

            score += matchedSamples * 220 + sampleScore;
            scored.push({ file, score, lines: lines.length, matchedSamples });
        }

        if (scored.length === 0) return null;

        scored.sort((a, b) => b.score - a.score);
        const topLog = scored.slice(0, 3).map((s) => `${s.file.path}(score=${s.score},samples=${s.matchedSamples},lines=${s.lines})`).join(' | ');
        log(`[FromLinkRepair] resolve candidates top=${topLog || 'none'}`);

        return scored[0]?.file || null;
    }

    private parseNodeFromLink(node: CanvasNodeLike): FromLinkRange | null {
        const text = node.text || '';
        const match = text.match(/<!-- fromLink:(.*?) -->/);
        if (match?.[1]) {
            try {
                return JSON.parse(match[1]) as FromLinkRange;
            } catch {
                return null;
            }
        }

        const color = node.color || '';
        if (color.startsWith('fromLink:')) {
            try {
                return JSON.parse(color.substring('fromLink:'.length)) as FromLinkRange;
            } catch {
                return null;
            }
        }
        return null;
    }

    private buildParentMap(edges: CanvasEdgeLike[]): Map<string, string> {
        const parentMap = new Map<string, string>();
        for (const edge of edges) {
            const from = getEdgeFromNodeId(edge);
            const to = getEdgeToNodeId(edge);
            if (from && to && !parentMap.has(to)) {
                parentMap.set(to, from);
            }
        }
        return parentMap;
    }

    private collectExistingRanges(nodes: CanvasNodeLike[]): Map<string, FromLinkRange> {
        const ranges = new Map<string, FromLinkRange>();
        for (const node of nodes) {
            if (!node.id) continue;
            const parsed = this.parseNodeFromLink(node);
            if (parsed) ranges.set(node.id, parsed);
        }
        return ranges;
    }

    private collectPathFixes(nodes: CanvasNodeLike[], resolvedPath: string): Map<string, FromLinkRange> {
        const fixes = new Map<string, FromLinkRange>();
        const resolvedName = resolvedPath.split('/').pop() || '';
        for (const node of nodes) {
            if (!node.id) continue;
            const parsed = this.parseNodeFromLink(node);
            if (!parsed?.file || parsed.file === resolvedPath) continue;

            const oldName = parsed.file.split('/').pop() || '';
            const exists = this.isVaultFileExists(parsed.file);
            if (!exists && oldName && resolvedName && oldName === resolvedName) {
                fixes.set(node.id, {
                    ...parsed,
                    file: resolvedPath
                });
            }
        }
        return fixes;
    }

    private isVaultFileExists(path: string): boolean {
        if (!path) return false;
        const file = this.app.vault.getAbstractFileByPath(path);
        return file instanceof TFile;
    }

    private getAnchorLine(nodeId: string, parentMap: Map<string, string>, ranges: Map<string, FromLinkRange>): number | null {
        let current = parentMap.get(nodeId);
        let depth = 0;
        while (current && depth < 8) {
            const parentRange = ranges.get(current);
            if (parentRange) return parentRange.from.line;
            current = parentMap.get(current);
            depth++;
        }
        return null;
    }

    private normalizeForMatch(text: string): string {
        return normalizeFromLinkMatch(text);
    }

    private buildNormalizedLineIndex(lines: string[]): Array<{ raw: string; normalized: string }> {
        return buildFromLinkNormalizedLineIndex(lines);
    }

    private matchNodeToSource(
        node: CanvasNodeLike,
        sourceLines: string[],
        lineIndex: Array<{ raw: string; normalized: string }>,
        anchorLine: number | null
    ): LineCandidate | null {
        return matchNodeToSourceWithFormatting(node, sourceLines, lineIndex, anchorLine);
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
            .map((p) => p.trim())
            .filter((p) => p.length >= 4)
            .sort((a, b) => b.length - a.length);

        let minStart = Number.POSITIVE_INFINITY;
        let maxEnd = Number.NEGATIVE_INFINITY;
        let matchedParts = 0;

        for (const needle of needles) {
            const variants = [needle, this.trimTrailingPunctuation(needle)]
                .filter((value, index, self) => value.length >= 3 && self.indexOf(value) === index);

            for (const variant of variants) {
                const idx = stripped.indexOf(variant);
                const partRange = this.mapRawRangeFromStrippedIndex(idx, variant.length, rawIndices, offset);
                if (!partRange) continue;

                matchedParts++;
                minStart = Math.min(minStart, partRange.startCh);
                maxEnd = Math.max(maxEnd, partRange.endCh);
                break;
            }
        }

        if (matchedParts > 0 && Number.isFinite(minStart) && Number.isFinite(maxEnd) && maxEnd > minStart) {
            return {
                startCh: minStart,
                endCh: maxEnd
            };
        }

        return null;
    }

    private trimTrailingPunctuation(text: string): string {
        return (text || '').replace(/[：:。.、，,；;！!？?…·]+$/u, '').trimEnd();
    }

    private mapRawRangeFromStrippedIndex(
        strippedIdx: number,
        length: number,
        rawIndices: number[],
        offset: number
    ): { startCh: number; endCh: number } | null {
        if (strippedIdx < 0 || length <= 0) return null;
        const rawStart = rawIndices[strippedIdx];
        const rawEnd = rawIndices[strippedIdx + length - 1];
        if (rawStart === undefined || rawEnd === undefined) return null;
        return {
            startCh: offset + rawStart,
            endCh: offset + rawEnd + 1
        };
    }

    private stripHtmlTagsWithMapping(text: string): { stripped: string; rawIndices: number[] } {
        const raw = text || '';
        const chars: string[] = [];
        const rawIndices: number[] = [];

        let i = 0;
        while (i < raw.length) {
            const ch = raw.charAt(i);
            if (ch === '<') {
                const closeIdx = raw.indexOf('>', i + 1);
                if (closeIdx >= 0) {
                    i = closeIdx + 1;
                    continue;
                }
            }

            chars.push(ch);
            rawIndices.push(i);
            i++;
        }

        return {
            stripped: chars.join(''),
            rawIndices
        };
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

    private findBestRawNeedle(text: string): string {
        const stripped = stripInvisibleMarkup(text || '').trim();
        if (!stripped) return '';
        const pieces = stripped
            .split('\n')
            .map((p) => p.trim())
            .filter((p) => p.length >= 8)
            .sort((a, b) => b.length - a.length);
        return pieces[0] || stripped;
    }

    private pickKeyPhrase(text: string): string {
        const clean = text.replace(/\s+/g, ' ').trim();
        if (clean.length < 12) return clean;
        if (clean.length <= 32) return clean;
        return clean.slice(0, 32).trim();
    }
}
