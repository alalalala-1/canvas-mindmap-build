import { log, logVerbose } from '../../utils/logger';
import { CONSTANTS } from '../../constants';
import {
	getTouchDragScrollOwners,
	restoreInlineStyle,
} from './pointer-gesture-helpers';

// ============================================================================
// Types
// ============================================================================

type PointerGestureSnapshot = {
	pointerId: number;
	pointerType: string;
	nodeId: string | null;
	targetKind: string;
	startTarget: string;
	startChain: string;
	startSelection: string;
	startX: number;
	startY: number;
	moved: boolean;
	wasSelectedBeforeDown: boolean;
	at: number;
};

type TouchDragScrollOwnerSnapshot = {
	el: HTMLElement;
	overflowY: string;
	overflowYPriority: string;
	webkitOverflowScrolling: string;
	webkitOverflowScrollingPriority: string;
	overscrollBehavior: string;
	overscrollBehaviorPriority: string;
};

type PenLongPressSnapshot = {
	pointerId: number;
	nodeId: string | null;
	startedAt: number;
	timerId: number | null;
	triggered: boolean;
};

// ============================================================================
// Host Interface
// ============================================================================

export interface PointerGestureStateOrchestratorHost {
	handleFromLinkNavigationByNodeId(nodeId: string | null): Promise<void>;
	extractNodeIdFromElement(nodeEl: HTMLElement): string | null;
	isTouchLikePointer(pointerType: string | null | undefined): boolean;
	isPenPointer(pointerType: string | null | undefined): boolean;
	isTouchPointer(pointerType: string | null | undefined): boolean;
}

// ============================================================================
// Service
// ============================================================================

export class PointerGestureStateOrchestratorService {
	private host: PointerGestureStateOrchestratorHost;
	private activePointerGesture: PointerGestureSnapshot | null = null;
	private lastCompletedPointerGesture: PointerGestureSnapshot | null = null;
	private suppressFromLinkClickUntil: number = 0;
	private suppressFromLinkNodeId: string | null = null;
	private suppressFromLinkClickReason: string | null = null;
	private activeTouchDragSawCanvasNodeMove: boolean = false;
	private activeTouchDragNodeEl: HTMLElement | null = null;
	private activeTouchDragPointerId: number | null = null;
	private activeTouchDragScrollOwnerSnapshots: TouchDragScrollOwnerSnapshot[] = [];
	private activePenLongPress: PenLongPressSnapshot | null = null;
	private readonly touchDragArmedClass = 'cmb-touch-drag-armed';
	private readonly touchDragScrollOwnerSelectors: string[] = [
		'.canvas-node-content',
		'.canvas-node-content .markdown-preview-view',
		'.canvas-node-content .markdown-preview-sizer'
	];

	constructor(host: PointerGestureStateOrchestratorHost) {
		this.host = host;
	}

	// ========================================================================
	// Public Accessors
	// ========================================================================

	public getActivePointerGesture(): PointerGestureSnapshot | null {
		return this.activePointerGesture;
	}

	public setActivePointerGesture(gesture: PointerGestureSnapshot | null): void {
		this.activePointerGesture = gesture;
	}

	public getLastCompletedPointerGesture(): PointerGestureSnapshot | null {
		return this.lastCompletedPointerGesture;
	}

	public setLastCompletedPointerGesture(gesture: PointerGestureSnapshot | null): void {
		this.lastCompletedPointerGesture = gesture;
	}

	public getActiveTouchDragSawCanvasNodeMove(): boolean {
		return this.activeTouchDragSawCanvasNodeMove;
	}

	public setActiveTouchDragSawCanvasNodeMove(value: boolean): void {
		this.activeTouchDragSawCanvasNodeMove = value;
	}

	// ========================================================================
	// FromLink Click Suppression
	// ========================================================================

	public shouldSuppressFromLinkClick(targetEl: HTMLElement, findCanvasNodeElementFromTarget: (el: HTMLElement) => HTMLElement | null): boolean {
		const nodeEl = findCanvasNodeElementFromTarget(targetEl);
		if (!nodeEl) return false;

		const nodeId = this.host.extractNodeIdFromElement(nodeEl);
		const now = Date.now();
		if (
			now < this.suppressFromLinkClickUntil
			&& this.suppressFromLinkNodeId
			&& this.suppressFromLinkNodeId === nodeId
		) {
			logVerbose(`[Event] fromLink click suppressed: reason=${this.suppressFromLinkClickReason || 'recent-gesture'}, node=${nodeId || 'unknown'}`);
			return true;
		}

		const lastGesture = this.lastCompletedPointerGesture;
		if (!lastGesture) return false;
		if (now - lastGesture.at > CONSTANTS.TOUCH.FROM_LINK_SUPPRESS_MS_TOUCH_PEN) return false;
		if (lastGesture.nodeId !== nodeId) return false;

		const pointerType = lastGesture.pointerType;
		if (pointerType === CONSTANTS.TOUCH.TOUCH_POINTER_TYPE) {
			if (lastGesture.moved) {
				logVerbose(`[Event] fromLink click suppressed: reason=touch-moved, node=${nodeId || 'unknown'}`);
				return true;
			}

			if (!lastGesture.wasSelectedBeforeDown) {
				logVerbose(`[Event] fromLink click suppressed: reason=touch-first-tap-select, node=${nodeId || 'unknown'}`);
				return true;
			}

			logVerbose(`[Event] fromLink click suppressed: reason=touch-tap-reserved-for-drag, node=${nodeId || 'unknown'}`);
			return true;
		}

		if (pointerType === CONSTANTS.TOUCH.PEN_POINTER_TYPE) {
			if (lastGesture.moved) {
				logVerbose(`[Event] fromLink click suppressed: reason=pen-moved, node=${nodeId || 'unknown'}`);
				return true;
			}

			logVerbose(`[Event] fromLink click suppressed: reason=pen-short-tap-select-only, node=${nodeId || 'unknown'}`);
			return true;
		}

		return false;
	}

	public markSuppressFromLinkClick(nodeId: string | null, holdMs: number, reason: string): void {
		this.suppressFromLinkClickUntil = Date.now() + Math.max(0, holdMs);
		this.suppressFromLinkNodeId = nodeId;
		this.suppressFromLinkClickReason = reason;
	}

	// ========================================================================
	// Pen Long Press
	// ========================================================================

	public armPenLongPress(pointerId: number, nodeId: string | null): void {
		this.clearPenLongPress();
		if (!nodeId) return;

		const startedAt = Date.now();
		const timerId = window.setTimeout(() => {
			void this.triggerPenLongPressNavigation(pointerId, nodeId, startedAt);
		}, CONSTANTS.TOUCH.PEN_LONG_PRESS_MS);

		this.activePenLongPress = {
			pointerId,
			nodeId,
			startedAt,
			timerId,
			triggered: false
		};
	}

	public clearPenLongPress(pointerId?: number): void {
		if (
			typeof pointerId === 'number'
			&& this.activePenLongPress
			&& this.activePenLongPress.pointerId !== pointerId
		) {
			return;
		}

		const activePenLongPress = this.activePenLongPress;
		if (activePenLongPress?.timerId !== null && activePenLongPress?.timerId !== undefined) {
			window.clearTimeout(activePenLongPress.timerId);
		}

		this.activePenLongPress = null;
	}

	public async triggerPenLongPressNavigation(pointerId: number, nodeId: string | null, startedAt: number): Promise<void> {
		const activePenLongPress = this.activePenLongPress;
		const activeGesture = this.activePointerGesture;
		if (!activePenLongPress || activePenLongPress.pointerId !== pointerId || activePenLongPress.nodeId !== nodeId) {
			return;
		}
		if (!activeGesture || activeGesture.pointerId !== pointerId || activeGesture.nodeId !== nodeId || activeGesture.moved) {
			return;
		}

		activePenLongPress.triggered = true;
		activePenLongPress.timerId = null;
		this.markSuppressFromLinkClick(nodeId, CONSTANTS.TOUCH.PEN_LONG_PRESS_CLICK_SUPPRESS_MS, 'pen-long-press');
		log(`[Event] PenLongPressNavigate: node=${nodeId || 'unknown'}, duration=${Date.now() - startedAt}ms`);
		await this.host.handleFromLinkNavigationByNodeId(nodeId);
	}

	// ========================================================================
	// Touch Drag Node
	// ========================================================================

	public armTouchDragNode(nodeEl: HTMLElement, pointerId: number): void {
		if (this.activeTouchDragNodeEl === nodeEl && this.activeTouchDragPointerId === pointerId) {
			return;
		}

		this.clearTouchDragNodeArm();

		this.activeTouchDragNodeEl = nodeEl;
		this.activeTouchDragPointerId = pointerId;
		nodeEl.classList.add(this.touchDragArmedClass);

		const owners = getTouchDragScrollOwners(nodeEl, this.touchDragScrollOwnerSelectors);
		this.activeTouchDragScrollOwnerSnapshots = owners.map((el) => ({
			el,
			overflowY: el.style.getPropertyValue('overflow-y'),
			overflowYPriority: el.style.getPropertyPriority('overflow-y'),
			webkitOverflowScrolling: el.style.getPropertyValue('-webkit-overflow-scrolling'),
			webkitOverflowScrollingPriority: el.style.getPropertyPriority('-webkit-overflow-scrolling'),
			overscrollBehavior: el.style.getPropertyValue('overscroll-behavior'),
			overscrollBehaviorPriority: el.style.getPropertyPriority('overscroll-behavior')
		}));

		for (const el of owners) {
			el.setCssProps({
				'overflow-y': 'hidden',
				'-webkit-overflow-scrolling': 'auto',
				'overscroll-behavior': 'none'
			});
		}
	}

	public clearTouchDragNodeArm(pointerId?: number): void {
		if (
			typeof pointerId === 'number'
			&& this.activeTouchDragPointerId !== null
			&& pointerId !== this.activeTouchDragPointerId
		) {
			return;
		}

		if (this.activeTouchDragNodeEl) {
			this.activeTouchDragNodeEl.classList.remove(this.touchDragArmedClass);
		}

		for (const snapshot of this.activeTouchDragScrollOwnerSnapshots) {
			restoreInlineStyle(snapshot.el, 'overflow-y', snapshot.overflowY, snapshot.overflowYPriority);
			restoreInlineStyle(
				snapshot.el,
				'-webkit-overflow-scrolling',
				snapshot.webkitOverflowScrolling,
				snapshot.webkitOverflowScrollingPriority
			);
			restoreInlineStyle(
				snapshot.el,
				'overscroll-behavior',
				snapshot.overscrollBehavior,
				snapshot.overscrollBehaviorPriority
			);
		}

		this.activeTouchDragNodeEl = null;
		this.activeTouchDragPointerId = null;
		this.activeTouchDragScrollOwnerSnapshots = [];
	}

	// ========================================================================
	// Cleanup
	// ========================================================================

	public clearAllTimers(): void {
		this.clearPenLongPress();
		this.clearTouchDragNodeArm();
	}
}
