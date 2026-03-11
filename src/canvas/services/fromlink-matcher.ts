import { stripInvisibleMarkup } from '../../utils/canvas-utils';
import { CanvasNodeLike } from '../types';

export type NormalizedLineEntry = {
    raw: string;
    normalized: string;
};

export type FromLinkMatchCandidate = {
    line: number;
    startCh: number;
    endCh: number;
    toLine: number;
    toCh: number;
    score: number;
    method: string;
};

type LogicalNodeLine = {
    raw: string;
    normalized: string;
};

type RawRange = {
    startCh: number;
    endCh: number;
};

type ScoredLineMatch = {
    score: number;
    method: string;
};

export function setNodeFromLinkRepairUnmatched(node: CanvasNodeLike, unmatched: boolean): boolean {
    const rawData = (node.data && typeof node.data === 'object')
        ? (node.data as Record<string, unknown>)
        : {};
    const repair = (rawData.fromLinkRepair && typeof rawData.fromLinkRepair === 'object')
        ? (rawData.fromLinkRepair as Record<string, unknown>)
        : {};

    const currentUnmatched = repair.unmatched === true;
    if (currentUnmatched === unmatched) return false;

    node.data = {
        ...rawData,
        fromLinkRepair: {
            ...repair,
            unmatched,
            updatedAt: Date.now(),
        },
    };
    return true;
}

export function normalizeForMatch(text: string): string {
    return stripMarkdownFormattingPreservingMath(stripInvisibleMarkup(text || ''))
        .replace(/\r/g, '')
        .replace(/^\s*>+\s?/gm, '')
        .replace(/^\s*(?:[-*+]\s+|\d+\.\s+)/gm, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

export function buildNormalizedLineIndex(lines: string[]): NormalizedLineEntry[] {
    return lines.map(raw => ({ raw, normalized: normalizeForMatch(raw) }));
}

export function matchNodeAtSpecificLine(
    node: CanvasNodeLike,
    sourceLines: string[],
    lineIndex: NormalizedLineEntry[],
    line: number
): FromLinkMatchCandidate | null {
    if (line < 0 || line >= sourceLines.length) return null;

    const rawNodeText = getRawNodeText(node);
    const normalizedNode = normalizeForMatch(rawNodeText);
    if (!normalizedNode) return null;

    const logicalNodeLines = getLogicalNodeLines(rawNodeText);
    if (logicalNodeLines.length >= 2) {
        const blockCandidate = matchNodeBlockNearLine(logicalNodeLines, sourceLines, lineIndex, line);
        if (blockCandidate) return blockCandidate;
    }

    const normalized = lineIndex[line]?.normalized || '';
    const raw = sourceLines[line] || '';
    if (!normalized) return null;

    const longestLine = logicalNodeLines.reduce((longest, current) => {
        return current.normalized.length > longest.length ? current.normalized : longest;
    }, '');

    let score = 0;
    let method = '';
    if (normalized === normalizedNode) {
        score = 180;
        method = 'L0-exact';
    } else if (normalized.includes(normalizedNode)) {
        score = 132;
        method = 'L1-contains';
    } else if (longestLine && normalized.includes(longestLine) && longestLine.length >= 12) {
        score = 104;
        method = 'L3-longest-line';
    }

    if (score <= 0) return null;

    const rawRange = findRawRangeInLine(raw, rawNodeText);
    return createSingleLineCandidate(line, raw, score + (rawRange ? 12 : 0), method, rawRange);
}

export function matchNodeToSource(
    node: CanvasNodeLike,
    sourceLines: string[],
    lineIndex: NormalizedLineEntry[],
    anchorLine: number | null
): FromLinkMatchCandidate | null {
    const rawNodeText = getRawNodeText(node);
    const normalizedNode = normalizeForMatch(rawNodeText);
    if (!normalizedNode) return null;

    const logicalNodeLines = getLogicalNodeLines(rawNodeText);
    const longestLine = logicalNodeLines.reduce((longest, current) => {
        return current.normalized.length > longest.length ? current.normalized : longest;
    }, '');
    const candidates: FromLinkMatchCandidate[] = [];
    const keyPhrase = pickKeyPhrase(normalizedNode);
    const isShortNode = normalizedNode.length < 8;

    if (logicalNodeLines.length >= 2) {
        for (let i = 0; i < lineIndex.length; i++) {
            const blockCandidate = matchNodeBlockFromLine(logicalNodeLines, sourceLines, lineIndex, i, anchorLine);
            if (blockCandidate) {
                candidates.push(blockCandidate);
            }
        }
    }

    for (let i = 0; i < lineIndex.length; i++) {
        const raw = sourceLines[i] || '';
        const normalized = lineIndex[i]?.normalized || '';
        if (!normalized) continue;

        const lineMatch = scoreSingleLineMatch(normalizedNode, normalized, longestLine, keyPhrase);
        if (!lineMatch) continue;

        let score = lineMatch.score;
        if (isShortNode && lineMatch.method !== 'L0-exact') {
            score = Math.min(score, 80);
        }

        const rawRange = findRawRangeInLine(raw, rawNodeText);
        if (rawRange) {
            score += 12;
        }

        if (anchorLine !== null) {
            score += getAnchorBonus(i, anchorLine);
        }

        if (/^#{1,6}\s+/.test(rawNodeText.trim())) {
            const heading = normalizeForMatch(rawNodeText.trim().replace(/^#{1,6}\s+/, ''));
            const lineHeading = normalizeForMatch(raw.match(/^\s*>*\s*#{1,6}\s+(.*)$/)?.[1] || '');
            if (lineHeading && (lineHeading.includes(heading) || heading.includes(lineHeading))) {
                score += 14;
            }
        }

        candidates.push(createSingleLineCandidate(i, raw, score, lineMatch.method, rawRange));
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (anchorLine !== null) {
            return Math.abs(a.line - anchorLine) - Math.abs(b.line - anchorLine);
        }
        if (a.line !== b.line) return a.line - b.line;
        return a.startCh - b.startCh;
    });

    return candidates[0] || null;
}

export function isReliableMatch(candidate: FromLinkMatchCandidate, normalizedLength: number, hasAnchor: boolean): boolean {
    if (normalizedLength < 4) return false;
    if (candidate.method === 'L0-exact' || candidate.method === 'B0-block-exact') return true;

    if (candidate.method.startsWith('B')) {
        return candidate.score >= (hasAnchor ? 180 : 204);
    }

    if (candidate.method === 'L1-contains') {
        return normalizedLength >= 6 && candidate.score >= (hasAnchor ? 100 : 108);
    }

    if (candidate.method === 'L3-longest-line') {
        return candidate.score >= (hasAnchor ? 104 : 112);
    }

    return candidate.score >= (hasAnchor ? 112 : 120);
}

function getRawNodeText(node: CanvasNodeLike): string {
    return (node.text || '').replace(/<!--[\s\S]*?-->/g, '');
}

function stripMarkdownFormattingPreservingMath(text: string): string {
    if (!text) return '';

    const protectedSegments: string[] = [];
    let protectedText = text.replace(/\$\$[\s\S]*?\$\$|\$(?:\\.|[^$\n])+\$/g, (segment) => {
        const token = `@@CMB_MATH_${protectedSegments.length}@@`;
        protectedSegments.push(segment);
        return token;
    });

    let previous = '';
    while (previous !== protectedText) {
        previous = protectedText;
        protectedText = protectedText
            .replace(/\*\*\*([\s\S]+?)\*\*\*/g, '$1')
            .replace(/___([\s\S]+?)___/g, '$1')
            .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
            .replace(/__([\s\S]+?)__/g, '$1')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/\*([^*\n]+)\*/g, '$1')
            .replace(/(^|[^\w])_([^_\n]+)_($|[^\w])/g, '$1$2$3');
    }

    return protectedText.replace(/@@CMB_MATH_(\d+)@@/g, (_match, index) => {
        return protectedSegments[Number(index)] || '';
    });
}

function getLogicalNodeLines(rawNodeText: string): LogicalNodeLine[] {
    return rawNodeText
        .split('\n')
        .map(raw => ({ raw: raw.trim(), normalized: normalizeForMatch(raw) }))
        .filter(entry => entry.normalized.length > 0);
}

function scoreSingleLineMatch(
    normalizedNode: string,
    normalizedSource: string,
    longestLine: string,
    keyPhrase: string
): ScoredLineMatch | null {
    if (normalizedSource === normalizedNode) {
        return { score: 150, method: 'L0-exact' };
    }

    if (normalizedSource.includes(normalizedNode)) {
        const lengthRatio = normalizedNode.length / Math.max(1, normalizedSource.length);
        return {
            score: 100 + Math.floor(Math.max(0, Math.min(1, lengthRatio)) * 30),
            method: 'L1-contains',
        };
    }

    if (normalizedNode.includes(normalizedSource) && normalizedSource.length >= 20) {
        return { score: 86, method: 'L2-reverse-contains' };
    }

    if (longestLine && normalizedSource.includes(longestLine) && longestLine.length >= 12) {
        return { score: 80, method: 'L3-longest-line' };
    }

    if (keyPhrase && normalizedSource.includes(keyPhrase)) {
        return { score: 72, method: 'L4-key-phrase' };
    }

    return null;
}

function scoreBlockLineMatch(normalizedNodeLine: string, normalizedSourceLine: string): ScoredLineMatch | null {
    if (!normalizedNodeLine || !normalizedSourceLine) return null;

    if (normalizedSourceLine === normalizedNodeLine) {
        return { score: 156, method: 'exact' };
    }

    if (normalizedSourceLine.includes(normalizedNodeLine)) {
        const lengthRatio = normalizedNodeLine.length / Math.max(1, normalizedSourceLine.length);
        return {
            score: 126 + Math.floor(Math.max(0, Math.min(1, lengthRatio)) * 18),
            method: 'contains',
        };
    }

    if (normalizedNodeLine.includes(normalizedSourceLine) && normalizedSourceLine.length >= 12) {
        return { score: 112, method: 'reverse-contains' };
    }

    return null;
}

function matchNodeBlockNearLine(
    logicalNodeLines: LogicalNodeLine[],
    sourceLines: string[],
    lineIndex: NormalizedLineEntry[],
    line: number
): FromLinkMatchCandidate | null {
    const candidates: FromLinkMatchCandidate[] = [];

    for (let start = line; start <= Math.min(line + 2, lineIndex.length - 1); start++) {
        const candidate = matchNodeBlockFromLine(logicalNodeLines, sourceLines, lineIndex, start, null);
        if (candidate) {
            candidates.push(candidate);
        }
        const normalized = lineIndex[start]?.normalized || '';
        if (normalized) break;
    }

    candidates.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.line - b.line;
    });
    return candidates[0] || null;
}

function matchNodeBlockFromLine(
    logicalNodeLines: LogicalNodeLine[],
    sourceLines: string[],
    lineIndex: NormalizedLineEntry[],
    startLine: number,
    anchorLine: number | null
): FromLinkMatchCandidate | null {
    if (logicalNodeLines.length < 2 || startLine < 0 || startLine >= lineIndex.length) return null;

    const matched: Array<{ sourceLine: number; line: LogicalNodeLine; match: ScoredLineMatch }> = [];
    let sourceLine = startLine;
    let blankSkips = 0;

    for (const nodeLine of logicalNodeLines) {
        while (sourceLine < lineIndex.length && !lineIndex[sourceLine]?.normalized) {
            sourceLine++;
            blankSkips++;
            if (blankSkips > 2) return null;
        }

        if (sourceLine >= lineIndex.length) return null;

        const lineMatch = scoreBlockLineMatch(nodeLine.normalized, lineIndex[sourceLine]?.normalized || '');
        if (!lineMatch) return null;

        matched.push({ sourceLine, line: nodeLine, match: lineMatch });
        sourceLine++;
    }

    if (matched.length < 2) return null;

    const first = matched[0]!;
    const last = matched[matched.length - 1]!;
    const firstRange = findRawRangeInLine(sourceLines[first.sourceLine] || '', first.line.raw);
    const lastRange = findRawRangeInLine(sourceLines[last.sourceLine] || '', last.line.raw);
    const scoreBase = matched.reduce((sum, entry) => sum + entry.match.score, 0);
    const hasContains = matched.some(entry => entry.match.method !== 'exact');
    let score = scoreBase + 24 + (matched.length - 1) * 18;

    if (anchorLine !== null) {
        score += getAnchorBonus(first.sourceLine, anchorLine);
    }

    return {
        line: first.sourceLine,
        startCh: firstRange?.startCh ?? 0,
        endCh: first.sourceLine === last.sourceLine
            ? (lastRange?.endCh ?? (sourceLines[last.sourceLine] || '').length)
            : (firstRange?.endCh ?? (sourceLines[first.sourceLine] || '').length),
        toLine: last.sourceLine,
        toCh: lastRange?.endCh ?? (sourceLines[last.sourceLine] || '').length,
        score,
        method: hasContains ? 'B1-block-linewise' : 'B0-block-exact',
    };
}

function getAnchorBonus(line: number, anchorLine: number): number {
    const distance = Math.abs(line - anchorLine);
    if (distance <= 30) return 30;
    if (distance <= 60) return 20;
    if (distance <= 120) return 8;
    return 0;
}

function createSingleLineCandidate(
    line: number,
    rawLine: string,
    score: number,
    method: string,
    rawRange: RawRange | null
): FromLinkMatchCandidate {
    return {
        line,
        startCh: rawRange?.startCh ?? 0,
        endCh: rawRange?.endCh ?? rawLine.length,
        toLine: line,
        toCh: rawRange?.endCh ?? rawLine.length,
        score,
        method,
    };
}

function findRawRangeInLine(rawLine: string, rawNodeText: string): RawRange | null {
    const { content, offset } = stripLinePrefixWithOffset(rawLine);
    const { stripped, rawIndices } = stripHtmlTagsWithMapping(content);
    const strippedNodeText = stripInvisibleMarkup(rawNodeText || '').trim();
    if (!strippedNodeText) return null;

    const fullNeedle = strippedNodeText
        .replace(/\r/g, '')
        .replace(/\n+/g, '')
        .trim();

    const fullNeedleVariants = [fullNeedle, trimTrailingPunctuation(fullNeedle)]
        .filter((value, index, self) => value.length >= 6 && self.indexOf(value) === index);

    for (const variant of fullNeedleVariants) {
        const fullIdx = stripped.indexOf(variant);
        const fullRange = mapRawRangeFromStrippedIndex(fullIdx, variant.length, rawIndices, offset);
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
        const variants = [needle, trimTrailingPunctuation(needle)]
            .filter((value, index, self) => value.length >= 3 && self.indexOf(value) === index);

        for (const variant of variants) {
            const index = stripped.indexOf(variant);
            const partRange = mapRawRangeFromStrippedIndex(index, variant.length, rawIndices, offset);
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

function trimTrailingPunctuation(text: string): string {
    return (text || '').replace(/[：:。.、，,；;！!？?…·]+$/u, '').trimEnd();
}

function mapRawRangeFromStrippedIndex(
    strippedIndex: number,
    length: number,
    rawIndices: number[],
    offset: number
): RawRange | null {
    if (strippedIndex < 0 || length <= 0) return null;
    const rawStart = rawIndices[strippedIndex];
    const rawEnd = rawIndices[strippedIndex + length - 1];
    if (rawStart === undefined || rawEnd === undefined) return null;

    return {
        startCh: offset + rawStart,
        endCh: offset + rawEnd + 1,
    };
}

function stripHtmlTagsWithMapping(text: string): { stripped: string; rawIndices: number[] } {
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

function stripLinePrefixWithOffset(rawLine: string): { content: string; offset: number } {
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

function pickKeyPhrase(text: string): string {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length < 12) return clean;
    if (clean.length <= 32) return clean;
    return clean.slice(0, 32).trim();
}