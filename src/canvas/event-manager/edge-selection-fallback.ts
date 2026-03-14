/**
 * 边选择回退服务
 * 
 * 负责：
 * - 处理边选择失败时的回退逻辑
 * - 解析和同步边选择状态
 * - 管理边选择的防抖和去重
 * - DOM 类名同步和性能监控
 */

import { App, ItemView } from 'obsidian';
import type { CanvasLike, CanvasEdgeLike, CanvasNodeLike, CanvasViewLike } from '../types';
import {
	getCanvasView,
	getEdgesFromCanvas,
	getDirectSelectedNodes,
	extractEdgeNodeIds,
} from '../../utils/canvas-utils';
import { isVerboseCanvasDiagnosticsLoggingEnabled, log, logVerbose } from '../../utils/logger';
import {
	clearEdgeSelectionState,
	clearNodeSelectionState,
	getPrimarySelectedEdgeFromState,
	getSelectedEdgeCountFromState,
	setSingleSelectedEdgeState,
} from '../adapters/canvas-selection-adapter';

export interface EdgeSelectionFallbackHost {
	app: App;
	getCanvasFromView(view: ItemView): CanvasLike | null;
	describeEventTarget(target: EventTarget | null): string;
	describeEventTargetChain(target: EventTarget | null, maxDepth?: number): string;
	describeCanvasSelection(): string;
}

export class EdgeSelectionFallbackService {
	private host: EdgeSelectionFallbackHost;

	// 状态字段（从 CanvasEventManager 迁移）
	private edgeSelectionFallbackToken: number = 0;
	private lastEdgeSelectionFallbackKey: string = '';
	private lastEdgeSelectionFallbackAt: number = 0;

	// 常量配置
	private readonly edgeSelectionFallbackSlowLogThresholdMs: number = 12;
	private readonly edgeSelectionFallbackDedupWindowMs: number = 120;

	constructor(host: EdgeSelectionFallbackHost) {
		this.host = host;
	}

	/**
	 * 判断目标元素是否为边选择目标
	 */
	isCanvasEdgeSelectionTarget(target: EventTarget | null): boolean {
		return target instanceof Element && !!target.closest(
			'.canvas-edge, .canvas-edge-line-group, .canvas-edge-label, .canvas-edges, .canvas-interaction-path, .canvas-display-path'
		);
	}

	/**
	 * 从目标元素解析边对象
	 */
	resolveEdgeFromTarget(target: EventTarget | null): CanvasEdgeLike | null {
		if (!(target instanceof Element)) return null;

		const canvasView = getCanvasView(this.host.app);
		const canvas = canvasView ? this.host.getCanvasFromView(canvasView) : null;
		if (!canvas) return null;

		const targetGroup = target.closest('g');
		for (const edge of getEdgesFromCanvas(canvas)) {
			const edgeRecord = edge as CanvasEdgeLike & {
				pathEl?: Element;
				interactiveEl?: Element;
			};
			const lineGroupEl = edge.lineGroupEl as Element | undefined;
			const lineEndGroupEl = edge.lineEndGroupEl as Element | undefined;
			const pathEl = edgeRecord.pathEl;
			const interactiveEl = edgeRecord.interactiveEl;

			if (
				target === lineGroupEl
				|| target === lineEndGroupEl
				|| target === pathEl
				|| target === interactiveEl
			) {
				return edge;
			}

			if (lineGroupEl?.contains(target) || lineEndGroupEl?.contains(target)) {
				return edge;
			}

			if (targetGroup && (targetGroup === lineGroupEl || targetGroup === lineEndGroupEl)) {
				return edge;
			}
		}

		return null;
	}

	/**
	 * 调度边选择回退（带防抖去重）
	 */
	scheduleEdgeSelectionFallback(target: EventTarget | null, reason: string): void {
		if (!(target instanceof Element)) return;
		const targetEl = target;
		const canvasView = getCanvasView(this.host.app);
		const canvas = canvasView ? this.host.getCanvasFromView(canvasView) : null;
		const targetEdge = canvas ? this.resolveEdgeFromTarget(targetEl) : null;
		const edgeKey = targetEdge ? this.getEdgeSelectionFallbackKey(targetEdge) : this.host.describeEventTarget(targetEl);
		const dedupKey = `${reason}|${edgeKey}`;
		const now = Date.now();
		if (
			this.lastEdgeSelectionFallbackKey === dedupKey
			&& now - this.lastEdgeSelectionFallbackAt < this.edgeSelectionFallbackDedupWindowMs
		) {
			logVerbose(`[Event] EdgeSelectionFallbackDedup: reason=${reason}, status=skip-schedule-duplicate, edge=${edgeKey}`);
			return;
		}

		this.lastEdgeSelectionFallbackKey = dedupKey;
		this.lastEdgeSelectionFallbackAt = now;
		const scheduleToken = ++this.edgeSelectionFallbackToken;
		logVerbose(`[Event] EdgeSelectionFallbackDedup: reason=${reason}, status=scheduled, edge=${edgeKey}, token=${scheduleToken}`);

		requestAnimationFrame(() => {
			if (scheduleToken !== this.edgeSelectionFallbackToken) {
				logVerbose(`[Event] EdgeSelectionFallbackDedup: reason=${reason}, status=skip-stale-token, edge=${edgeKey}, token=${scheduleToken}`);
				return;
			}
			this.applyEdgeSelectionFallback(targetEl, `${reason}:raf`, scheduleToken);
		});
	}

	/**
	 * 应用边选择回退逻辑
	 */
	applyEdgeSelectionFallback(targetEl: Element, reason: string, scheduleToken?: number): void {
		const startedAt = performance.now();
		if (!this.isCanvasEdgeSelectionTarget(targetEl)) return;

		const canvasView = getCanvasView(this.host.app);
		const canvas = canvasView ? this.host.getCanvasFromView(canvasView) : null;
		if (!canvas) return;
		if (!canvasView) return;

		const resolveStartedAt = performance.now();
		const edge = this.resolveEdgeFromTarget(targetEl);
		const resolveEdgeMs = performance.now() - resolveStartedAt;
		if (!edge) {
			log(
				`[Event] EdgeSelectionFallbackMiss: reason=${reason}, target=${this.host.describeEventTarget(targetEl)}, ` +
				`chain=${this.host.describeEventTargetChain(targetEl)}, selection=${this.host.describeCanvasSelection()}`
			);
			return;
		}

		const targetEdgeKey = this.getEdgeSelectionFallbackKey(edge);
		const selectedEdge = this.getDirectSelectedEdge(canvas);
		if (selectedEdge && this.isSameEdgeForFallback(selectedEdge, edge)) {
			this.ensureEdgeSelectionFallbackClasses(edge);
			this.syncSelectedEdgeState(canvas, edge);
			logVerbose(`[Event] EdgeSelectionFallbackDedup: reason=${reason}, status=skip-target-already-selected, edge=${targetEdgeKey}, token=${scheduleToken ?? 'na'}`);
			this.maybeLogEdgeSelectionFallbackPerf({
				reason,
				edgeKey: targetEdgeKey,
				scheduleToken,
				resolveEdgeMs,
				clearSelectionMs: 0,
				applySelectionMs: 0,
				totalMs: performance.now() - startedAt,
				nodeSelectionCount: this.getDirectSelectedNodeCount(canvas),
				edgeSelectionCount: this.getDirectSelectedEdgeCount(canvas),
				domNodeCleared: 0,
				domEdgeCleared: 0,
				status: 'already-selected'
			});
			return;
		}

		if (!selectedEdge && this.isEdgeSelectionFallbackDomSelected(edge)) {
			this.syncSelectedEdgeState(canvas, edge);
			logVerbose(`[Event] EdgeSelectionFallbackDedup: reason=${reason}, status=sync-dom-selected, edge=${targetEdgeKey}, token=${scheduleToken ?? 'na'}`);
			this.maybeLogEdgeSelectionFallbackPerf({
				reason,
				edgeKey: targetEdgeKey,
				scheduleToken,
				resolveEdgeMs,
				clearSelectionMs: 0,
				applySelectionMs: 0,
				totalMs: performance.now() - startedAt,
				nodeSelectionCount: this.getDirectSelectedNodeCount(canvas),
				edgeSelectionCount: 1,
				domNodeCleared: 0,
				domEdgeCleared: 0,
				status: 'sync-dom-selected'
			});
			return;
		}

		const nodeSelectionCount = this.getDirectSelectedNodeCount(canvas);
		const edgeSelectionCount = this.getDirectSelectedEdgeCount(canvas);

		const clearStartedAt = performance.now();
		this.clearDirectNodeSelectionState(canvas);
		const domNodeCleared = this.clearSelectionFallbackDomClasses(
			canvasView.contentEl,
			'.canvas-node.is-selected, .canvas-node.is-focused'
		);
		this.clearDirectEdgeSelectionState(canvas);
		const domEdgeCleared = this.clearSelectionFallbackDomClasses(
			canvasView.contentEl,
			'.canvas-edge-line-group.is-selected, .canvas-edge-line-group.is-focused, .canvas-edge.is-selected, .canvas-edge.is-focused'
		);
		const clearSelectionMs = performance.now() - clearStartedAt;

		const applyStartedAt = performance.now();
		this.syncSelectedEdgeState(canvas, edge);
		this.ensureEdgeSelectionFallbackClasses(edge);
		const applySelectionMs = performance.now() - applyStartedAt;
		const totalMs = performance.now() - startedAt;

		if (selectedEdge && !this.isSameEdgeForFallback(selectedEdge, edge)) {
			logVerbose(
				`[Event] EdgeSelectionFallbackDedup: reason=${reason}, status=replaced-selection, ` +
				`from=${this.getEdgeSelectionFallbackKey(selectedEdge)}, to=${targetEdgeKey}, token=${scheduleToken ?? 'na'}`
			);
		}

		const { fromId, toId } = extractEdgeNodeIds(edge);
		log(
			`[Event] EdgeSelectionFallbackApplied: reason=${reason}, edge=${edge.id || 'unknown'}, ` +
			`from=${fromId || 'unknown'}, to=${toId || 'unknown'}, clearedNodes=${nodeSelectionCount}, ` +
			`selection=${this.host.describeCanvasSelection()}`
		);
		this.maybeLogEdgeSelectionFallbackPerf({
			reason,
			edgeKey: targetEdgeKey,
			scheduleToken,
			resolveEdgeMs,
			clearSelectionMs,
			applySelectionMs,
			totalMs,
			nodeSelectionCount,
			edgeSelectionCount,
			domNodeCleared,
			domEdgeCleared,
			status: 'applied'
		});
	}

	/**
	 * 获取直接选中的边
	 */
	getDirectSelectedEdge(canvas: CanvasLike): CanvasEdgeLike | null {
		return getPrimarySelectedEdgeFromState(canvas);
	}

	/**
	 * 获取直接选中的边数量
	 */
	getDirectSelectedEdgeCount(canvas: CanvasLike): number {
		return getSelectedEdgeCountFromState(canvas);
	}

	/**
	 * 获取直接选中的节点数量
	 */
	getDirectSelectedNodeCount(canvas: CanvasLike): number {
		return getDirectSelectedNodes(canvas).length;
	}

	/**
	 * 清除直接节点选择状态
	 */
	clearDirectNodeSelectionState(canvas: CanvasLike): void {
		clearNodeSelectionState(canvas);
	}

	/**
	 * 清除直接边选择状态
	 */
	clearDirectEdgeSelectionState(canvas: CanvasLike): void {
		clearEdgeSelectionState(canvas);
	}

	/**
	 * 同步选中边状态
	 */
	syncSelectedEdgeState(canvas: CanvasLike, edge: CanvasEdgeLike): void {
		setSingleSelectedEdgeState(canvas, edge);
	}

	/**
	 * 清除选择回退 DOM 类名
	 */
	clearSelectionFallbackDomClasses(root: ParentNode | null | undefined, selector: string): number {
		if (!root) return 0;
		const elements = root.querySelectorAll(selector);
		let cleared = 0;
		for (const el of Array.from(elements)) {
			if (!(el instanceof Element)) continue;
			const hadSelected = el.classList.contains('is-selected') || el.classList.contains('is-focused');
			el.classList.remove('is-selected', 'is-focused');
			if (hadSelected) cleared++;
		}
		return cleared;
	}

	/**
	 * 判断边是否在 DOM 中被选中
	 */
	isEdgeSelectionFallbackDomSelected(edge: CanvasEdgeLike): boolean {
		return !!(
			edge.lineGroupEl?.classList.contains('is-selected')
			|| edge.lineGroupEl?.classList.contains('is-focused')
			|| edge.lineEndGroupEl?.classList.contains('is-selected')
			|| edge.lineEndGroupEl?.classList.contains('is-focused')
		);
	}

	/**
	 * 确保边选择回退类名存在
	 */
	ensureEdgeSelectionFallbackClasses(edge: CanvasEdgeLike): void {
		edge.lineGroupEl?.classList.add('is-selected', 'is-focused');
		edge.lineEndGroupEl?.classList.add('is-selected');
		edge.lineEndGroupEl?.classList.remove('is-focused');
	}

	/**
	 * 获取边选择回退键
	 */
	getEdgeSelectionFallbackKey(edge: CanvasEdgeLike): string {
		const edgeId = edge.id;
		if (edgeId) return edgeId;
		const { fromId, toId } = extractEdgeNodeIds(edge);
		return `${fromId || 'unknown'}->${toId || 'unknown'}`;
	}

	/**
	 * 判断两条边是否相同
	 */
	isSameEdgeForFallback(left: CanvasEdgeLike | null | undefined, right: CanvasEdgeLike | null | undefined): boolean {
		if (!left || !right) return false;
		if (left === right) return true;
		return this.getEdgeSelectionFallbackKey(left) === this.getEdgeSelectionFallbackKey(right);
	}

	/**
	 * 可能记录边选择回退性能日志
	 */
	maybeLogEdgeSelectionFallbackPerf(params: {
		reason: string;
		edgeKey: string;
		scheduleToken?: number;
		resolveEdgeMs: number;
		clearSelectionMs: number;
		applySelectionMs: number;
		totalMs: number;
		nodeSelectionCount: number;
		edgeSelectionCount: number;
		domNodeCleared: number;
		domEdgeCleared: number;
		status: 'applied' | 'already-selected' | 'sync-dom-selected';
	}): void {
		const shouldLogSlow = params.totalMs >= this.edgeSelectionFallbackSlowLogThresholdMs;
		const shouldLogVerbose = isVerboseCanvasDiagnosticsLoggingEnabled();
		if (!shouldLogSlow && !shouldLogVerbose) return;

		const message =
			`[Event] EdgeFallbackPerf: reason=${params.reason}, status=${params.status}, edge=${params.edgeKey}, ` +
			`token=${params.scheduleToken ?? 'na'}, selectedNodes=${params.nodeSelectionCount}, ` +
			`selectedEdges=${params.edgeSelectionCount}, domNodeCleared=${params.domNodeCleared}, ` +
			`domEdgeCleared=${params.domEdgeCleared}, resolve=${params.resolveEdgeMs.toFixed(2)}ms, ` +
			`clear=${params.clearSelectionMs.toFixed(2)}ms, apply=${params.applySelectionMs.toFixed(2)}ms, ` +
			`total=${params.totalMs.toFixed(2)}ms`;

		if (shouldLogSlow) {
			log(message);
			return;
		}

		logVerbose(message);
	}
}
