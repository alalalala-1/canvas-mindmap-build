import { App, ItemView, Notice, Platform, TFile } from 'obsidian';
import { CONSTANTS } from '../../constants';
import {
    findCanvasNodeElementFromTarget,
    getCanvasNodeByElement,
    getCanvasView,
    getNodesFromCanvas,
    parseFromLink,
    shouldBypassCanvasNodeGestureTarget,
} from '../../utils/canvas-utils';
import { log } from '../../utils/logger';
import type { CanvasLike, CanvasNodeLike, MarkdownViewLike } from '../types';

type FromLinkInfo = {
    file: string;
    from: { line: number; ch: number };
    to: { line: number; ch: number };
};

export interface FromLinkNavigationHost {
    app: App;
    lastFromLinkNavAt: number;
    lastFromLinkNavKey: string;
    isNativeInsertSessionActive(): boolean;
    getCanvasFromView(view: ItemView): CanvasLike | null;
    rememberNodeInteractionContext(nodeId: string | null, reason: string, canvasView?: ItemView | null): void;
    setActiveLeafSafe(leaf: unknown, options: { focus: boolean }): boolean;
}

export async function handleFromLinkClick(
    host: FromLinkNavigationHost,
    targetEl: HTMLElement,
    canvasView: ItemView,
): Promise<void> {
    if (host.isNativeInsertSessionActive()) return;
    if (shouldBypassCanvasNodeGestureTarget(targetEl)) return;

    const nodeEl = findCanvasNodeElementFromTarget(targetEl);
    if (!nodeEl) return;

    const canvas = host.getCanvasFromView(canvasView);
    if (!canvas?.nodes) return;

    const clickedNode = getCanvasNodeByElement(canvas, nodeEl);
    if (!clickedNode) return;

    await navigateToFromLink(host, clickedNode);
}

export async function handleFromLinkNavigationByNodeId(
    host: FromLinkNavigationHost,
    nodeId: string | null,
): Promise<void> {
    if (!nodeId) return;

    const canvasView = getCanvasView(host.app);
    if (!canvasView) return;

    const canvas = host.getCanvasFromView(canvasView);
    if (!canvas?.nodes) return;

    const clickedNode = getNodesFromCanvas(canvas).find(node => node.id === nodeId) || null;
    if (!clickedNode) {
        log(`[Event] fromLink 跳转失败: 找不到节点 ${nodeId}`);
        return;
    }

    await navigateToFromLink(host, clickedNode);
}

export async function navigateToFromLink(
    host: FromLinkNavigationHost,
    clickedNode: CanvasNodeLike,
): Promise<void> {
    const canvasView = getCanvasView(host.app);
    if (!canvasView) return;

    host.rememberNodeInteractionContext(clickedNode.id || null, 'fromlink-navigate', canvasView);

    const fromLink = parseFromLink(clickedNode.text, clickedNode.color) as FromLinkInfo | null;
    if (!fromLink) {
        if (clickedNode.text?.includes('fromLink:')) {
            log(`[Event] fromLink 解析失败: text`);
        } else if (clickedNode.color?.startsWith('fromLink:')) {
            log(`[Event] fromLink (color) 解析失败`);
        }
        return;
    }

    const now = Date.now();
    const navKey = `${clickedNode.id || 'unknown'}|${fromLink.file}|${fromLink.from.line}:${fromLink.from.ch}-${fromLink.to.line}:${fromLink.to.ch}`;
    if (
        host.lastFromLinkNavKey === navKey
        && now - host.lastFromLinkNavAt < CONSTANTS.TIMING.FROM_LINK_NAV_DEBOUNCE
    ) {
        log(`[Event] fromLink 跳转防抖: skip duplicate within ${CONSTANTS.TIMING.FROM_LINK_NAV_DEBOUNCE}ms -> ${fromLink.file}`);
        return;
    }

    host.lastFromLinkNavKey = navKey;
    host.lastFromLinkNavAt = now;

    log(`[Event] UI: 跳转 fromLink -> ${fromLink.file}`);
    try {
        let sourceFile = host.app.vault.getAbstractFileByPath(fromLink.file);

        if (!(sourceFile instanceof TFile)) {
            const fileName = fromLink.file.split('/').pop();
            if (fileName) {
                const allFiles = host.app.vault.getFiles();
                sourceFile = allFiles.find(file => file.path.endsWith(`/${fromLink.file}`))
                    ?? allFiles.find(file => file.name === fileName)
                    ?? sourceFile;
            }
        }

        if (!(sourceFile instanceof TFile)) {
            log(`[Event] fromLink 找不到源文件: ${fromLink.file}`);
            new Notice(`找不到源文件: ${fromLink.file}`);
            return;
        }

        let mdLeaf = host.app.workspace.getLeavesOfType('markdown').find(
            leaf => (leaf.view as MarkdownViewLike).file?.path === sourceFile.path,
        );
        if (!mdLeaf) {
            mdLeaf = host.app.workspace.getLeaf('split', 'vertical');
            await mdLeaf.openFile(sourceFile);
        } else {
            host.setActiveLeafSafe(mdLeaf, { focus: true });
        }

        const view = mdLeaf.view as MarkdownViewLike;
        const initialDelay = Platform.isMobile
            ? CONSTANTS.TIMING.MOBILE_SELECTION_DELAY
            : CONSTANTS.TIMING.SCROLL_DELAY;

        const applySelection = () => {
            const editor = view.editor;
            if (!editor) return;
            editor.focus?.();
            editor.setSelection(fromLink.from, fromLink.to);
            editor.scrollIntoView({ from: fromLink.from, to: fromLink.to }, true);
            log(`[Event] fromLink 选区已应用: L${fromLink.from.line}:${fromLink.from.ch}-${fromLink.to.ch}`);
        };

        setTimeout(() => {
            applySelection();
            if (Platform.isMobile) {
                setTimeout(applySelection, CONSTANTS.TIMING.MOBILE_SELECTION_RETRY_DELAY);
            }
        }, initialDelay);
    } catch (err) {
        log(`[Event] UI: 跳转失败: ${String(err)}`);
    }
}