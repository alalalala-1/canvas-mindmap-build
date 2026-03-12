import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasEventManager } from '../canvas/canvas-event-manager';
import { clearRecentLogs, getRecentLogs, updateLoggerConfig } from '../utils/logger';

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
		updateLoggerConfig({ enableDebugLogging: true, enableVerboseCanvasDiagnostics: false });
		clearRecentLogs();
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
			activeNativeInsertSession: unknown;
			nativeInsertSideEffectsSuppressUntil: number;
		};
		const target = createWrapperTarget({ childClasses: ['canvas-node-connection-point'] });

		const result = manager.evaluateNativeInsertSessionStart('mouse', target as unknown as EventTarget);

		expect(result).toEqual({
			candidate: true,
			allow: false,
			reason: 'edge-connect',
			targetKind: 'edge-connect',
		});
		expect(manager.activeNativeInsertSession).toBeNull();
		expect(manager.nativeInsertSideEffectsSuppressUntil).toBe(0);
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

	it('should commit native insert fallback when session ends without node creation', () => {
		const manager = createManager() as unknown as {
			shouldCommitNativeInsertSession: (input: {
				session: {
					traceId: string;
					targetKind: string;
					startReason: string;
					nodeCreateSeen: boolean;
					anchorNodeId: string | null;
				};
				nodeDelta: number;
				placeholderDelta: number;
				endReason: string;
			}) => { allow: boolean; reason: string };
		};

		const result = manager.shouldCommitNativeInsertSession({
			session: {
				traceId: 'ni-test',
				targetKind: 'node-content',
				startReason: 'node-content',
				nodeCreateSeen: false,
				anchorNodeId: 'parent-1',
			},
			nodeDelta: 0,
			placeholderDelta: 0,
			endReason: 'pointerup',
		});

		expect(result).toEqual({
			allow: true,
			reason: 'missing-native-create-with-anchor',
		});
	});

	it('should skip native insert fallback when node creation already happened or gesture was cancelled', () => {
		const manager = createManager() as unknown as {
			shouldCommitNativeInsertSession: (input: {
				session: {
					traceId: string;
					targetKind: string;
					startReason: string;
					nodeCreateSeen: boolean;
					anchorNodeId: string | null;
				};
				nodeDelta: number;
				placeholderDelta: number;
				endReason: string;
			}) => { allow: boolean; reason: string };
		};

		expect(manager.shouldCommitNativeInsertSession({
			session: {
				traceId: 'ni-created',
				targetKind: 'node-content',
				startReason: 'node-content',
				nodeCreateSeen: true,
				anchorNodeId: 'parent-1',
			},
			nodeDelta: 1,
			placeholderDelta: 0,
			endReason: 'pointerup',
		})).toEqual({
			allow: false,
			reason: 'node-create-observed',
		});

		expect(manager.shouldCommitNativeInsertSession({
			session: {
				traceId: 'ni-cancel',
				targetKind: 'wrapper',
				startReason: 'wrapper-active',
				nodeCreateSeen: false,
				anchorNodeId: null,
			},
			nodeDelta: 0,
			placeholderDelta: 0,
			endReason: 'pointercancel',
		})).toEqual({
			allow: false,
			reason: 'pointer-cancelled',
		});
	});

	it('should log generic canvas engine events when addNode runs outside native insert session', () => {
		const plugin = {} as never;
		const app = {
			workspace: {
				getActiveViewOfType: () => null,
				getLeavesOfType: () => [],
			},
		} as never;
		const settings = {} as never;
		const collapseStateManager = {} as never;
		const canvasManager = {
			getFloatingNodeService: () => ({}) as never,
		} as never;
		const manager = new CanvasEventManager(plugin, app, settings, collapseStateManager, canvasManager) as unknown as {
			installNativeInsertEngineDiagnostics: (canvas: { addNode: () => string }) => void;
		};
		const canvas = {
			addNode: () => 'created-node',
		};

		manager.installNativeInsertEngineDiagnostics(canvas);
		canvas.addNode();

		const messages = getRecentLogs().map(entry => entry.message);
		expect(messages.some(message => message.includes('CanvasEngineCall: trace=none, source=command-or-external, method=addNode'))).toBe(true);
		expect(messages.some(message => message.includes('CanvasEngineReturn: trace=none, source=command-or-external, method=addNode'))).toBe(true);
		expect(messages.some(message => message.includes('NativeInsertEngineCall'))).toBe(false);
	});

	it('should flush native insert commit via file fallback without runtime create', async () => {
		const addNodeToCanvas = vi.fn(async () => undefined);
		const createTextNode = vi.fn(() => ({ type: 'text', text: '', x: 10, y: 20 }));
		const canvas = {
			nodes: [],
			createTextNode,
			file: { path: 'test.canvas' },
		};
		const canvasView = {
			getViewType: () => 'canvas',
			canvas,
			file: { path: 'test.canvas' },
			contentEl: {},
		};
		const plugin = {} as never;
		const app = {
			workspace: {
				getActiveViewOfType: () => canvasView,
				getLeavesOfType: () => [],
			},
		} as never;
		const settings = {} as never;
		const collapseStateManager = {} as never;
		const canvasManager = {
			getFloatingNodeService: () => ({}) as never,
			addNodeToCanvas,
		} as never;
		const manager = new CanvasEventManager(plugin, app, settings, collapseStateManager, canvasManager) as unknown as {
			pendingNativeInsertCommit: {
				traceId: string;
				pointerType: string;
				startReason: string;
				targetKind: string;
				anchorNodeId: string | null;
				initialNodeCount: number;
				initialPlaceholderCount: number;
				nodeDelta: number;
				placeholderDelta: number;
				endReason: string;
				endedAt: number;
				engineAttempted: boolean;
			} | null;
			flushPendingNativeInsertCommit: (trigger: string) => Promise<void>;
			lastNativeInsertCommitTraceId: string | null;
		};

		manager.pendingNativeInsertCommit = {
			traceId: 'ni-fallback',
			pointerType: 'touch',
			startReason: 'wrapper-touch-like',
			targetKind: 'wrapper',
			anchorNodeId: 'parent-1',
			initialNodeCount: 0,
			initialPlaceholderCount: 0,
			nodeDelta: 0,
			placeholderDelta: 0,
			endReason: 'pointerup',
			endedAt: Date.now(),
			engineAttempted: false,
		};

		await manager.flushPendingNativeInsertCommit('session-end:timeout-0');

		expect(addNodeToCanvas).toHaveBeenCalledWith('', null, {
			source: 'native-insert',
			parentNodeIdHint: 'parent-1',
			suppressSuccessNotice: true,
			skipFromLink: true,
		});
		expect(createTextNode).not.toHaveBeenCalled();
		expect(manager.pendingNativeInsertCommit).toBeNull();
		expect(manager.lastNativeInsertCommitTraceId).toBe('ni-fallback');
	});
});