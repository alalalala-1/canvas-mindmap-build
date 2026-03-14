/**
 * 节点交互上下文管理服务
 * 
 * 负责：
 * - 记住最后点击的节点上下文（lastClickedNodeId, lastClickedCanvasFilePath）
 * - 清理过期的边选择状态（当节点交互时）
 * - 获取当前交互节点
 * - 管理失焦测量的防抖（focus-lost measurement debounce）
 * - 协调聚焦节点上下文（focus-reconciled）
 */

import { App, ItemView } from 'obsidian';
import type { CanvasLike, CanvasNodeLike, CanvasViewLike, PluginWithLastClicked } from '../types';
import { getCanvasView, getSelectedNodeFromCanvas, clearCanvasEdgeSelection } from '../../utils/canvas-utils';
import { logVerbose } from '../../utils/logger';

export interface NodeInteractionContextHost {
	app: App;
	plugin: PluginWithLastClicked;
	shouldSuppressSideEffectsForNativeInsert(): boolean;
	scheduleDeferredPostInsertMaintenance(reason: string): void;
	getCanvasFromView(view: ItemView): CanvasLike | null;
	describeCanvasSelection(): string;
	getDirectSelectedEdgeCount(canvas: CanvasLike): number;
}

export interface CanvasManagerForNodeContext {
	measureAndPersistTrustedHeight(nodeId: string): Promise<void>;
}

export class NodeInteractionContextService {
	private host: NodeInteractionContextHost;
	private canvasManager: CanvasManagerForNodeContext;

	// 状态字段（从 CanvasEventManager 迁移）
	private focusLostDebounceByNodeId: Map<string, number> = new Map();
	private lastFocusedNodeId: string | null = null;
	private deferredMeasureNodeIds: Set<string> = new Set();

	constructor(host: NodeInteractionContextHost, canvasManager: CanvasManagerForNodeContext) {
		this.host = host;
		this.canvasManager = canvasManager;
	}

	/**
	 * 记住节点交互上下文
	 * 更新 plugin.lastClickedNodeId, lastNavigationSourceNodeId, lastClickedCanvasFilePath
	 */
	rememberNodeInteractionContext(nodeId: string | null, reason: string, canvasView?: ItemView | null): void {
		if (!nodeId) return;

		const pluginWithContext = this.host.plugin;
		const targetCanvasView = canvasView ?? getCanvasView(this.host.app);
		const canvasFilePath = targetCanvasView
			? this.host.getCanvasFromView(targetCanvasView)?.file?.path || (targetCanvasView as CanvasViewLike).file?.path || null
			: null;

		const previousNodeId = pluginWithContext.lastClickedNodeId || null;
		const previousCanvasFilePath = pluginWithContext.lastClickedCanvasFilePath || null;

		pluginWithContext.lastClickedNodeId = nodeId;
		pluginWithContext.lastNavigationSourceNodeId = nodeId;
		if (canvasFilePath) {
			pluginWithContext.lastClickedCanvasFilePath = canvasFilePath;
		}

		if (previousNodeId !== nodeId || previousCanvasFilePath !== canvasFilePath) {
			logVerbose(
				`[Event] RememberNodeContext: reason=${reason}, node=${nodeId}, ` +
				`canvasFile=${canvasFilePath || 'none'}, prevNode=${previousNodeId || 'none'}, ` +
				`prevCanvasFile=${previousCanvasFilePath || 'none'}`
			);
		}
	}

	/**
	 * 清除过期的边选择状态（当节点交互时）
	 */
	clearStaleEdgeSelectionForNodeInteraction(reason: string, canvasView?: ItemView | null): void {
		const targetCanvasView = canvasView ?? getCanvasView(this.host.app);
		const canvas = targetCanvasView ? this.host.getCanvasFromView(targetCanvasView) : null;
		if (!canvas) return;

		const clearedState = clearCanvasEdgeSelection(canvas);
		if (!clearedState.cleared) return;

		logVerbose(
			`[Event] ClearStaleEdgeSelection: reason=${reason}, ` +
			`edges=${clearedState.clearedEdgeIds.join('|') || 'none'}, domCleared=${clearedState.domClearedCount}, ` +
			`selection=${this.host.describeCanvasSelection()}`
		);
	}

	/**
	 * 获取当前画布交互节点（选中的节点）
	 */
	getCurrentCanvasInteractionNode(canvasView?: ItemView | null): CanvasNodeLike | null {
		const targetCanvasView = canvasView ?? getCanvasView(this.host.app);
		const canvas = targetCanvasView ? this.host.getCanvasFromView(targetCanvasView) : null;
		if (!canvas) return null;
		return getSelectedNodeFromCanvas(canvas);
	}

	/**
	 * 取消失焦测量的防抖定时器
	 */
	cancelFocusLostMeasurement(nodeId?: string | null): void {
		if (!nodeId) return;
		const timerId = this.focusLostDebounceByNodeId.get(nodeId);
		if (timerId === undefined) return;
		window.clearTimeout(timerId);
		this.focusLostDebounceByNodeId.delete(nodeId);
	}

	/**
	 * 调度失焦测量（500ms 防抖）
	 * 如果在 native-insert 期间，则推迟到 post-insert maintenance
	 */
	scheduleFocusLostMeasurement(nodeId: string, reason: string): void {
		this.cancelFocusLostMeasurement(nodeId);

		if (this.host.shouldSuppressSideEffectsForNativeInsert()) {
			this.deferredMeasureNodeIds.add(nodeId);
			this.host.scheduleDeferredPostInsertMaintenance(`${reason}:${nodeId}`);
			logVerbose(`[Event] NativeInsertDeferredTrustedHeight: node=${nodeId}, reason=${reason}`);
			return;
		}

		const timerId = window.setTimeout(() => {
			this.focusLostDebounceByNodeId.delete(nodeId);
			void this.canvasManager.measureAndPersistTrustedHeight(nodeId);
		}, 500);

		this.focusLostDebounceByNodeId.set(nodeId, timerId);
	}

	/**
	 * 协调聚焦节点上下文
	 * 返回当前聚焦的节点 ID
	 */
	reconcileFocusedNodeContext(reason: string, canvasView?: ItemView | null): string | null {
		const targetCanvasView = canvasView ?? getCanvasView(this.host.app);
		const canvas = targetCanvasView ? this.host.getCanvasFromView(targetCanvasView) : null;
		const currentNode = this.getCurrentCanvasInteractionNode(targetCanvasView);
		const currentNodeId = currentNode?.id || null;
		if (!currentNodeId) return null;

		if (
			currentNodeId === this.lastFocusedNodeId
			&& reason === 'focus-reconciled'
			&& (!canvas || this.host.getDirectSelectedEdgeCount(canvas) === 0)
		) {
			this.cancelFocusLostMeasurement(currentNodeId);
			return currentNodeId;
		}

		this.lastFocusedNodeId = currentNodeId;
		this.cancelFocusLostMeasurement(currentNodeId);
		this.clearStaleEdgeSelectionForNodeInteraction(reason, targetCanvasView);
		this.rememberNodeInteractionContext(currentNodeId, reason, targetCanvasView);
		return currentNodeId;
	}

	/**
	 * 获取延迟测量的节点 ID 集合（供 post-insert maintenance 使用）
	 */
	getDeferredMeasureNodeIds(): Set<string> {
		return this.deferredMeasureNodeIds;
	}

	/**
	 * 清空延迟测量的节点 ID 集合
	 */
	clearDeferredMeasureNodeIds(): void {
		this.deferredMeasureNodeIds.clear();
	}

	/**
	 * 重置 lastFocusedNodeId
	 */
	resetLastFocusedNodeId(): void {
		this.lastFocusedNodeId = null;
	}

	/**
	 * 清理所有防抖定时器（unload 时调用）
	 */
	clearAllDebounceTimers(): void {
		for (const timerId of this.focusLostDebounceByNodeId.values()) {
			window.clearTimeout(timerId);
		}
		this.focusLostDebounceByNodeId.clear();
	}
}
