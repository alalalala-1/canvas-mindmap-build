import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CanvasEventManager } from '../canvas/canvas-event-manager';

class MockClassList {
	private classes: Set<string>;

	constructor(initial: string[] = []) {
		this.classes = new Set(initial);
	}

	contains(name: string): boolean {
		return this.classes.has(name);
	}

	add(...names: string[]): void {
		for (const name of names) this.classes.add(name);
	}

	remove(...names: string[]): void {
		for (const name of names) this.classes.delete(name);
	}

	toString(): string {
		return Array.from(this.classes).join(' ');
	}
}

class MockElement {
	public parentElement: MockElement | null = null;
	public classList: MockClassList;
	public tagName: string;
	private attributes: Map<string, string>;

	constructor(options?: { classes?: string[]; tagName?: string; attributes?: Record<string, string> }) {
		this.classList = new MockClassList(options?.classes || []);
		this.tagName = (options?.tagName || 'div').toUpperCase();
		this.attributes = new Map(Object.entries(options?.attributes || {}));
	}

	appendChild(child: MockElement): MockElement {
		child.parentElement = this;
		return child;
	}

	closest(selector: string): MockElement | null {
		const selectors = selector.split(',').map(token => token.trim()).filter(Boolean);
		let current: MockElement | null = this;
		while (current) {
			const currentNode = current;
			if (selectors.some(token => currentNode.matches(token))) {
				return current;
			}
			current = current.parentElement;
		}
		return null;
	}

	getAttribute(name: string): string | null {
		if (name === 'class') {
			return this.classList.toString();
		}
		return this.attributes.get(name) ?? null;
	}

	private matches(selector: string): boolean {
		if (!selector) return false;

		if (selector.startsWith('[') && selector.endsWith(']')) {
			const attributeName = selector.slice(1, -1).split('=')[0]?.trim();
			return !!attributeName && this.attributes.has(attributeName);
		}

		const parts = selector.split('.').filter(Boolean);
		const tagName = selector.startsWith('.') ? null : (parts.shift() || null);
		if (tagName && this.tagName.toLowerCase() !== tagName.toLowerCase()) {
			return false;
		}

		return parts.every(className => this.classList.contains(className));
	}
}

function createManager(): CanvasEventManager {
	const plugin = {} as never;
	const app = {} as never;
	const settings = {} as never;
	const collapseStateManager = {} as never;
	const canvasManager = {
		getFloatingNodeService: () => ({}) as never,
	} as never;

	return new CanvasEventManager(plugin, app, settings, collapseStateManager, canvasManager);
}

function createWrapperTarget(options?: {
	wrapperClasses?: string[];
	childClasses?: string[];
	attributes?: Record<string, string>;
}): MockElement {
	const wrapper = new MockElement({
		classes: ['canvas-wrapper', 'node-insert-event', ...(options?.wrapperClasses || [])],
	});
	const child = new MockElement({
		classes: options?.childClasses || [],
		attributes: options?.attributes,
	});
	wrapper.appendChild(child);
	return child;
}

function createNodeInsertTarget(): MockElement {
	const node = new MockElement({ classes: ['canvas-node'] });
	const insertEvent = new MockElement({ classes: ['node-insert-event'] });
	const child = new MockElement();
	node.appendChild(insertEvent);
	insertEvent.appendChild(child);
	return child;
}

describe('CanvasEventManager native insert gating', () => {
	const originalElement = globalThis.Element;
	const originalHTMLElement = globalThis.HTMLElement;
	const originalDocument = globalThis.document;
	let placeholderPresent = false;

	beforeEach(() => {
		placeholderPresent = false;
		(globalThis as Record<string, unknown>).Element = MockElement;
		(globalThis as Record<string, unknown>).HTMLElement = MockElement;
		(globalThis as Record<string, unknown>).document = {
			querySelector: (selector: string) => {
				if (selector === '.canvas-node-placeholder' && placeholderPresent) {
					return new MockElement({ classes: ['canvas-node-placeholder'] });
				}
				return null;
			},
			querySelectorAll: () => [],
			activeElement: null,
			body: null,
		} as unknown as Document;
	});

	afterEach(() => {
		(globalThis as Record<string, unknown>).Element = originalElement;
		(globalThis as Record<string, unknown>).HTMLElement = originalHTMLElement;
		(globalThis as Record<string, unknown>).document = originalDocument;
	});

	it('should reject edge connect gesture before native insert session starts', () => {
		const manager = createManager() as unknown as {
			evaluateNativeInsertSessionStart: (pointerType: string, target: EventTarget | null) => {
				candidate: boolean;
				allow: boolean;
				reason: string;
				targetKind: string;
			};
		};
		const target = createWrapperTarget({ childClasses: ['canvas-node-connection-point'] });

		const result = manager.evaluateNativeInsertSessionStart('mouse', target as unknown as EventTarget);

		expect(result).toEqual({
			candidate: true,
			allow: false,
			reason: 'edge-connect',
			targetKind: 'edge-connect',
		});
	});

	it('should reject idle wrapper mouse click as empty-wrapper-idle', () => {
		const manager = createManager() as unknown as {
			evaluateNativeInsertSessionStart: (pointerType: string, target: EventTarget | null) => {
				candidate: boolean;
				allow: boolean;
				reason: string;
				targetKind: string;
			};
		};
		const target = createWrapperTarget();

		const result = manager.evaluateNativeInsertSessionStart('mouse', target as unknown as EventTarget);

		expect(result).toMatchObject({
			candidate: true,
			allow: false,
			reason: 'empty-wrapper-idle',
			targetKind: 'wrapper',
		});
	});

	it('should allow wrapper touch-like gesture to preserve native insert flow', () => {
		const manager = createManager() as unknown as {
			evaluateNativeInsertSessionStart: (pointerType: string, target: EventTarget | null) => {
				candidate: boolean;
				allow: boolean;
				reason: string;
				targetKind: string;
			};
		};
		const target = createWrapperTarget();

		const result = manager.evaluateNativeInsertSessionStart('touch', target as unknown as EventTarget);

		expect(result).toMatchObject({
			candidate: true,
			allow: true,
			reason: 'wrapper-touch-like',
			targetKind: 'wrapper',
		});
	});

	it('should allow node-insert-event inside canvas node as node-content', () => {
		const manager = createManager() as unknown as {
			evaluateNativeInsertSessionStart: (pointerType: string, target: EventTarget | null) => {
				candidate: boolean;
				allow: boolean;
				reason: string;
				targetKind: string;
			};
		};
		const target = createNodeInsertTarget();

		const result = manager.evaluateNativeInsertSessionStart('mouse', target as unknown as EventTarget);

		expect(result).toMatchObject({
			candidate: true,
			allow: true,
			reason: 'node-content',
			targetKind: 'node-content',
		});
	});

	it('should allow wrapper mouse gesture when placeholder already exists', () => {
		placeholderPresent = true;
		const manager = createManager() as unknown as {
			evaluateNativeInsertSessionStart: (pointerType: string, target: EventTarget | null) => {
				candidate: boolean;
				allow: boolean;
				reason: string;
				targetKind: string;
			};
		};
		const target = createWrapperTarget();

		const result = manager.evaluateNativeInsertSessionStart('mouse', target as unknown as EventTarget);

		expect(result).toMatchObject({
			candidate: true,
			allow: true,
			reason: 'wrapper-placeholder-present',
			targetKind: 'wrapper',
		});
	});

	it('should allow wrapper mouse gesture when wrapper is already dragging', () => {
		const manager = createManager() as unknown as {
			evaluateNativeInsertSessionStart: (pointerType: string, target: EventTarget | null) => {
				candidate: boolean;
				allow: boolean;
				reason: string;
				targetKind: string;
			};
		};
		const target = createWrapperTarget({ wrapperClasses: ['is-dragging'] });

		const result = manager.evaluateNativeInsertSessionStart('mouse', target as unknown as EventTarget);

		expect(result).toMatchObject({
			candidate: true,
			allow: true,
			reason: 'wrapper-active',
			targetKind: 'wrapper:is-dragging',
		});
	});
});