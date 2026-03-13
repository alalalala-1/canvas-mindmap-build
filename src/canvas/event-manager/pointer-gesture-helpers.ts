import { CONSTANTS } from '../../constants';
import {
	findCanvasNodeElementFromTarget,
	findDeleteButton,
	findZoomToFitButton,
	isCanvasEdgeConnectGestureTarget,
	isCanvasNativeInsertGestureTarget,
} from '../../utils/canvas-utils';

export function isTouchPointer(pointerType: string | null | undefined): boolean {
	return pointerType === CONSTANTS.TOUCH.TOUCH_POINTER_TYPE;
}

export function isPenPointer(pointerType: string | null | undefined): boolean {
	return pointerType === CONSTANTS.TOUCH.PEN_POINTER_TYPE;
}

export function isTouchLikePointer(pointerType: string | null | undefined): boolean {
	return isTouchPointer(pointerType) || isPenPointer(pointerType);
}

export function describeEventTarget(target: EventTarget | null): string {
	if (!(target instanceof Element)) return 'non-element';
	const className = (target.getAttribute('class') || '').trim().replace(/\s+/g, '.');
	return `${target.tagName.toLowerCase()}${className ? '.' + className : ''}`;
}

export function describeEventTargetChain(target: EventTarget | null, maxDepth = 5): string {
	if (!(target instanceof Element)) return 'non-element';

	const parts: string[] = [];
	let current: Element | null = target;
	let depth = 0;

	while (current && depth < maxDepth) {
		parts.push(describeEventTarget(current));
		current = current.parentElement;
		depth++;
	}

	return parts.join(' <- ');
}

export function getMoveThresholdForPointer(pointerType: string | null | undefined): number {
	if (isPenPointer(pointerType)) {
		return CONSTANTS.TOUCH.MOVE_THRESHOLD_PEN;
	}
	if (isTouchPointer(pointerType)) {
		return CONSTANTS.TOUCH.MOVE_THRESHOLD_TOUCH;
	}
	return CONSTANTS.TOUCH.MOVE_THRESHOLD;
}

export function restoreInlineStyle(el: HTMLElement, property: string, value: string, priority: string): void {
	if (value) {
		el.style.setProperty(property, value, priority || '');
		return;
	}
	el.style.removeProperty(property);
}

export function describePointerEventState(event: MouseEvent | PointerEvent): string {
	const detail = typeof event.detail === 'number' ? event.detail : 'n/a';
	const button = typeof event.button === 'number' ? event.button : 'n/a';
	const buttons = typeof event.buttons === 'number' ? event.buttons : 'n/a';
	return [
		`defaultPrevented=${event.defaultPrevented}`,
		`cancelable=${event.cancelable}`,
		`button=${button}`,
		`buttons=${buttons}`,
		`detail=${detail}`,
		`trusted=${event.isTrusted}`,
	].join(',');
}

export function describeNativeInsertTargetKind(target: EventTarget | null): string {
	if (!(target instanceof Element)) return 'non-element';
	if (target.closest('.canvas-node-placeholder')) return 'placeholder';

	const nodeInsertEventEl = target.closest('.node-insert-event');
	if (nodeInsertEventEl instanceof HTMLElement && nodeInsertEventEl.closest('.canvas-node')) {
		const selected = !!target.closest('.canvas-node.is-selected, .canvas-node.is-focused');
		return selected ? 'node-content:selected' : 'node-content';
	}

	const insertWrapper = target.closest('.canvas-wrapper.node-insert-event');
	if (insertWrapper instanceof HTMLElement) {
		const states = ['is-dragging', 'mod-animating', 'mod-zoomed-out']
			.filter((className) => insertWrapper.classList.contains(className));
		return states.length > 0 ? `wrapper:${states.join('+')}` : 'wrapper';
	}

	return 'other';
}

export function describeCanvasPointerTargetKind(target: EventTarget | null): string {
	if (!(target instanceof Element)) return 'non-element';
	if (isCanvasEdgeConnectGestureTarget(target)) return 'edge-connect';
	if (isCanvasNativeInsertGestureTarget(target)) return `native-insert:${describeNativeInsertTargetKind(target)}`;
	if (findCanvasNodeElementFromTarget(target)) return 'node';
	if (target.closest('.cmb-collapse-button')) return 'collapse-button';
	if (findDeleteButton(target)) return 'delete-button';
	if (findZoomToFitButton(target)) return 'zoom-to-fit';
	if (target.closest('.canvas-control-item')) return 'canvas-control';
	if (target.closest('.canvas-edge-label')) return 'canvas-edge-label';
	if (target.closest('.canvas-edge-line-group, .canvas-edge')) return 'canvas-edge';
	if (target instanceof SVGElement && target.closest('svg')) return 'canvas-svg';
	if (target.closest('.canvas-wrapper, .canvas')) return 'canvas-surface';
	return 'other';
}

export function getTouchDragScrollOwners(nodeEl: HTMLElement, selectors: string[]): HTMLElement[] {
	const owners: HTMLElement[] = [];
	const seen = new Set<HTMLElement>();

	for (const selector of selectors) {
		const elements = nodeEl.querySelectorAll(selector);
		for (const el of Array.from(elements)) {
			if (!(el instanceof HTMLElement)) continue;
			if (seen.has(el)) continue;
			seen.add(el);
			owners.push(el);
		}
	}

	return owners;
}