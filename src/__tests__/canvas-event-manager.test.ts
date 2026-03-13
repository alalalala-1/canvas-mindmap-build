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
	const app = {
		workspace: {
			getActiveViewOfType: () => null,
			getLeavesOfType: () => [],
			activeEditor: null,
		},
	} as never;
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
	const originalWindow = (globalThis as Record<string, unknown>).window;
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
		(globalThis as Record<string, unknown>).window = globalThis as unknown as Window & typeof globalThis;
	});

	afterEach(() => {
		(globalThis as Record<string, unknown>).Element = originalElement;
		(globalThis as Record<string, unknown>).HTMLElement = originalHTMLElement;
		(globalThis as Record<string, unknown>).document = originalDocument;
		(globalThis as Record<string, unknown>).window = originalWindow;
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
					pointerType?: string;
					targetKind: string;
					startReason: string;
					nodeCreateSeen: boolean;
					anchorNodeId: string | null;
					placeholderSeen?: boolean;
					placeholderAddedCount?: number;
					wrapperDragSeen?: boolean;
				};
				nodeDelta: number;
				placeholderDelta: number;
				endReason: string;
				pointerDetail: number;
			}) => { allow: boolean; reason: string };
		};

		const result = manager.shouldCommitNativeInsertSession({
			session: {
				traceId: 'ni-test',
				pointerType: 'touch',
				targetKind: 'node-content',
				startReason: 'node-content',
				nodeCreateSeen: false,
				anchorNodeId: 'parent-1',
				placeholderSeen: true,
				placeholderAddedCount: 1,
				wrapperDragSeen: false,
			},
			nodeDelta: 0,
			placeholderDelta: 0,
			endReason: 'pointerup',
			pointerDetail: 1,
		});

		expect(result).toEqual({
			allow: true,
			reason: 'missing-native-create-with-anchor',
		});
	});

	it('should reject native insert fallback when evidence is insufficient', () => {
		const manager = createManager() as unknown as {
			shouldCommitNativeInsertSession: (input: {
				session: {
					traceId: string;
					pointerType?: string;
					targetKind: string;
					startReason: string;
					nodeCreateSeen: boolean;
					anchorNodeId: string | null;
					placeholderSeen?: boolean;
					placeholderAddedCount?: number;
					wrapperDragSeen?: boolean;
				};
				nodeDelta: number;
				placeholderDelta: number;
				endReason: string;
				pointerDetail: number;
			}) => { allow: boolean; reason: string };
		};

		expect(manager.shouldCommitNativeInsertSession({
			session: {
				traceId: 'ni-no-evidence',
				pointerType: 'mouse',
				targetKind: 'node-content',
				startReason: 'node-content',
				nodeCreateSeen: false,
				anchorNodeId: 'parent-1',
				placeholderSeen: false,
				placeholderAddedCount: 0,
				wrapperDragSeen: false,
			},
			nodeDelta: 0,
			placeholderDelta: 0,
			endReason: 'pointerup',
			pointerDetail: 1,
		})).toEqual({
			allow: false,
			reason: 'insufficient-evidence',
		});
	});

	it('should skip native insert fallback when node creation already happened or gesture was cancelled', () => {
		const manager = createManager() as unknown as {
			shouldCommitNativeInsertSession: (input: {
				session: {
					traceId: string;
					pointerType?: string;
					targetKind: string;
					startReason: string;
					nodeCreateSeen: boolean;
					anchorNodeId: string | null;
					placeholderSeen?: boolean;
					placeholderAddedCount?: number;
					wrapperDragSeen?: boolean;
				};
				nodeDelta: number;
				placeholderDelta: number;
				endReason: string;
				pointerDetail: number;
			}) => { allow: boolean; reason: string };
		};

		expect(manager.shouldCommitNativeInsertSession({
			session: {
				traceId: 'ni-created',
				pointerType: 'touch',
				targetKind: 'node-content',
				startReason: 'node-content',
				nodeCreateSeen: true,
				anchorNodeId: 'parent-1',
				placeholderSeen: true,
				placeholderAddedCount: 1,
				wrapperDragSeen: false,
			},
			nodeDelta: 1,
			placeholderDelta: 0,
			endReason: 'pointerup',
			pointerDetail: 1,
		})).toEqual({
			allow: false,
			reason: 'node-create-observed',
		});

		expect(manager.shouldCommitNativeInsertSession({
			session: {
				traceId: 'ni-cancel',
				pointerType: 'touch',
				targetKind: 'wrapper',
				startReason: 'wrapper-active',
				nodeCreateSeen: false,
				anchorNodeId: null,
				placeholderSeen: false,
				placeholderAddedCount: 0,
				wrapperDragSeen: true,
			},
			nodeDelta: 0,
			placeholderDelta: 0,
			endReason: 'pointercancel',
			pointerDetail: 1,
		})).toEqual({
			allow: false,
			reason: 'pointer-cancelled',
		});
	});

	it('should skip native insert fallback for multi-click session end', () => {
		const manager = createManager() as unknown as {
			shouldCommitNativeInsertSession: (input: {
				session: {
					traceId: string;
					pointerType?: string;
					targetKind: string;
					startReason: string;
					nodeCreateSeen: boolean;
					anchorNodeId: string | null;
					placeholderSeen?: boolean;
					placeholderAddedCount?: number;
					wrapperDragSeen?: boolean;
				};
				nodeDelta: number;
				placeholderDelta: number;
				endReason: string;
				pointerDetail: number;
			}) => { allow: boolean; reason: string };
		};

		expect(manager.shouldCommitNativeInsertSession({
			session: {
				traceId: 'ni-double-click',
				pointerType: 'mouse',
				targetKind: 'node-content',
				startReason: 'node-content',
				nodeCreateSeen: false,
				anchorNodeId: 'parent-1',
				placeholderSeen: true,
				placeholderAddedCount: 1,
				wrapperDragSeen: false,
			},
			nodeDelta: 0,
			placeholderDelta: 0,
			endReason: 'pointerup',
			pointerDetail: 2,
		})).toEqual({
			allow: false,
			reason: 'multi-click',
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
		const canvas = {
			nodes: [] as Array<{ id: string; type: 'text'; text: string; x: number; y: number; width: number; height: number }>,
			edges: [] as unknown[],
			createTextNode: vi.fn(() => ({ type: 'text', text: '', x: 10, y: 20 })),
			file: { path: 'test.canvas' },
		};
		const addNodeToCanvas = vi.fn(async () => {
			canvas.nodes.push({ id: 'created-1', type: 'text', text: '', x: 0, y: 0, width: 200, height: 80 });
		});
		const createTextNode = vi.fn(() => ({ type: 'text', text: '', x: 10, y: 20 }));
		canvas.createTextNode = createTextNode;
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
				lastPointerDetail: number;
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
			lastPointerDetail: 1,
		};

		await manager.flushPendingNativeInsertCommit('session-end:timeout-0');

		expect(addNodeToCanvas).toHaveBeenCalledWith('', null, {
			source: 'native-insert',
			parentNodeIdHint: 'parent-1',
			suppressSuccessNotice: true,
			skipFromLink: true,
			verifiedNativeInsert: true,
		});
		expect(createTextNode).not.toHaveBeenCalled();
		expect(manager.pendingNativeInsertCommit).toBeNull();
		expect(manager.lastNativeInsertCommitTraceId).toBe('ni-fallback');
		const messages = getRecentLogs().map(entry => entry.message);
		expect(messages.some(message => message.includes('NativeInsertCommitStart: trace=ni-fallback'))).toBe(true);
		expect(messages.some(message => message.includes('NativeInsertCommitDone: trace=ni-fallback') && message.includes('nodeCreate=observed') && message.includes('nodeDelta=1') && message.includes('edgeDelta=0'))).toBe(true);
	});

	it('should reject native insert fallback when node count already increased before flush', async () => {
		const addNodeToCanvas = vi.fn(async () => undefined);
		const canvas = {
			nodes: [{ id: 'existing-1', type: 'text', text: '', x: 0, y: 0, width: 200, height: 80 }],
			edges: [],
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
				lastPointerDetail: number;
			} | null;
			flushPendingNativeInsertCommit: (trigger: string) => Promise<void>;
		};

		manager.pendingNativeInsertCommit = {
			traceId: 'ni-resolved-upstream',
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
			lastPointerDetail: 1,
		};

		await manager.flushPendingNativeInsertCommit('session-end:timeout-0');

		expect(addNodeToCanvas).not.toHaveBeenCalled();
		expect(manager.pendingNativeInsertCommit).toBeNull();
		const messages = getRecentLogs().map(entry => entry.message);
		expect(messages.some(message => message.includes('NativeInsertCommitRejected: trace=ni-resolved-upstream') && message.includes('reason=node-count-increased'))).toBe(true);
	});

	it('should reject blank native insert fallback when only weak wrapper evidence exists without anchor', async () => {
		const addNodeToCanvas = vi.fn(async () => undefined);
		const canvas = {
			nodes: [] as Array<{ id: string; type?: string; text?: string }>,
			edges: [] as unknown[],
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
				lastPointerDetail: number;
				clickDetail?: number;
				clickClassified?: boolean;
				commitEligibleAt?: number;
				awaitingClickClassification?: boolean;
				evidenceFlags?: string[];
				blankCandidate?: boolean;
				queuedSelectionNodeCount?: number;
				queuedSelectionEdgeCount?: number;
				queuedSelectionKey?: string;
			} | null;
			flushPendingNativeInsertCommit: (trigger: string) => Promise<void>;
		};

		manager.pendingNativeInsertCommit = {
			traceId: 'ni-weak-evidence',
			pointerType: 'touch',
			startReason: 'wrapper-touch-like',
			targetKind: 'wrapper',
			anchorNodeId: null,
			initialNodeCount: 0,
			initialPlaceholderCount: 0,
			nodeDelta: 0,
			placeholderDelta: 0,
			endReason: 'pointerup',
			endedAt: Date.now(),
			engineAttempted: false,
			lastPointerDetail: 1,
			clickDetail: 0,
			clickClassified: false,
			commitEligibleAt: Date.now(),
			awaitingClickClassification: false,
			evidenceFlags: ['touch-like-wrapper'],
			blankCandidate: true,
			queuedSelectionNodeCount: 0,
			queuedSelectionEdgeCount: 0,
			queuedSelectionKey: 'nodes=none;edges=none;active=none',
		};

		await manager.flushPendingNativeInsertCommit('session-end:timeout-0');

		expect(addNodeToCanvas).not.toHaveBeenCalled();
		expect(manager.pendingNativeInsertCommit).toBeNull();
		const messages = getRecentLogs().map(entry => entry.message);
		expect(messages.some(message => message.includes('NativeInsertCommitRejected: trace=ni-weak-evidence') && message.includes('reason=blank-protection-weak-evidence-only'))).toBe(true);
		expect(messages.some(message => message.includes('NativeInsertTraceSummary: trace=ni-weak-evidence') && message.includes('blankCandidate=true') && message.includes('selectionStable=true') && message.includes('fallbackCommitted=false'))).toBe(true);
	});

	it('should reject blank native insert fallback when queued anchor selection drifts to another node', async () => {
		const addNodeToCanvas = vi.fn(async () => undefined);
		const parentNode = { id: 'parent-1', type: 'text', text: '' };
		const otherNode = { id: 'other-1', type: 'text', text: '' };
		const canvas = {
			nodes: [parentNode, otherNode],
			edges: [] as unknown[],
			selectedNodes: [otherNode],
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
				lastPointerDetail: number;
				clickDetail?: number;
				clickClassified?: boolean;
				commitEligibleAt?: number;
				awaitingClickClassification?: boolean;
				evidenceFlags?: string[];
				blankCandidate?: boolean;
				queuedSelectionNodeCount?: number;
				queuedSelectionEdgeCount?: number;
				queuedSelectionKey?: string;
			} | null;
			flushPendingNativeInsertCommit: (trigger: string) => Promise<void>;
		};

		manager.pendingNativeInsertCommit = {
			traceId: 'ni-selection-drift',
			pointerType: 'touch',
			startReason: 'wrapper-active',
			targetKind: 'wrapper:is-dragging',
			anchorNodeId: 'parent-1',
			initialNodeCount: 2,
			initialPlaceholderCount: 0,
			nodeDelta: 0,
			placeholderDelta: 1,
			endReason: 'pointerup',
			endedAt: Date.now(),
			engineAttempted: false,
			lastPointerDetail: 1,
			clickDetail: 0,
			clickClassified: false,
			commitEligibleAt: Date.now(),
			awaitingClickClassification: false,
			evidenceFlags: ['placeholder-delta', 'wrapper-active'],
			blankCandidate: true,
			queuedSelectionNodeCount: 1,
			queuedSelectionEdgeCount: 0,
			queuedSelectionKey: 'nodes=parent-1;edges=none;active=none',
		};

		await manager.flushPendingNativeInsertCommit('session-end:timeout-0');

		expect(addNodeToCanvas).not.toHaveBeenCalled();
		expect(manager.pendingNativeInsertCommit).toBeNull();
		const messages = getRecentLogs().map(entry => entry.message);
		expect(messages.some(message => message.includes('NativeInsertCommitRejected: trace=ni-selection-drift') && message.includes('reason=blank-protection-selection-mismatch'))).toBe(true);
		expect(messages.some(message => message.includes('NativeInsertTraceSummary: trace=ni-selection-drift') && message.includes('selectionNodes=1') && message.includes('selectionStable=false') && message.includes('fallbackCommitted=false'))).toBe(true);
	});

	it('should reject click-post-session commit when pending trace comes from multi-click', async () => {
		const addNodeToCanvas = vi.fn(async () => undefined);
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
				lastPointerDetail: number;
			} | null;
			flushPendingNativeInsertCommit: (trigger: string) => Promise<void>;
		};

		manager.pendingNativeInsertCommit = {
			traceId: 'ni-double-click',
			pointerType: 'mouse',
			startReason: 'node-content',
			targetKind: 'node-content',
			anchorNodeId: 'parent-1',
			initialNodeCount: 1,
			initialPlaceholderCount: 0,
			nodeDelta: 0,
			placeholderDelta: 0,
			endReason: 'pointerup',
			endedAt: Date.now(),
			engineAttempted: false,
			lastPointerDetail: 2,
		};

		await manager.flushPendingNativeInsertCommit('click-post-session');

		expect(addNodeToCanvas).not.toHaveBeenCalled();
		expect(manager.pendingNativeInsertCommit).toBeNull();
		const messages = getRecentLogs().map(entry => entry.message);
		expect(messages.some(message => message.includes('NativeInsertCommitRejected: trace=ni-double-click') && message.includes('reason=multi-click'))).toBe(true);
		expect(messages.filter(message => message.includes('NativeInsertTraceSummary: trace=ni-double-click'))).toHaveLength(1);
	});

	it('should wait for mouse click classification before fallback commit becomes eligible', async () => {
		const addNodeToCanvas = vi.fn(async () => undefined);
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
				lastPointerDetail: number;
				clickDetail?: number;
				clickClassified?: boolean;
				commitEligibleAt?: number;
				awaitingClickClassification?: boolean;
				evidenceFlags?: string[];
			} | null;
			flushPendingNativeInsertCommit: (trigger: string) => Promise<void>;
		};

		manager.pendingNativeInsertCommit = {
			traceId: 'ni-mouse-wait',
			pointerType: 'mouse',
			startReason: 'wrapper-active',
			targetKind: 'wrapper:is-dragging',
			anchorNodeId: 'parent-1',
			initialNodeCount: 0,
			initialPlaceholderCount: 0,
			nodeDelta: 0,
			placeholderDelta: 1,
			endReason: 'pointerup',
			endedAt: Date.now(),
			engineAttempted: false,
			lastPointerDetail: 1,
			clickDetail: 1,
			clickClassified: false,
			commitEligibleAt: Date.now() + 1000,
			awaitingClickClassification: true,
			evidenceFlags: ['wrapper-active', 'placeholder-delta'],
		};

		await manager.flushPendingNativeInsertCommit('session-end:mouse-classify-timeout');

		expect(addNodeToCanvas).not.toHaveBeenCalled();
		expect(manager.pendingNativeInsertCommit).not.toBeNull();
	});

	it('should dedup native insert selection probes per trace and only keep raf + timeout-120', async () => {
		updateLoggerConfig({ enableDebugLogging: true, enableVerboseCanvasDiagnostics: true });
		clearRecentLogs();
		vi.useFakeTimers();
		const originalRaf = globalThis.requestAnimationFrame;
		const originalCancelRaf = globalThis.cancelAnimationFrame;
		let rafIdSeq = 0;
		const rafCallbacks = new Map<number, FrameRequestCallback>();
		(globalThis as Record<string, unknown>).requestAnimationFrame = ((cb: FrameRequestCallback) => {
			const id = ++rafIdSeq;
			rafCallbacks.set(id, cb);
			return id;
		}) as unknown as typeof requestAnimationFrame;
		(globalThis as Record<string, unknown>).cancelAnimationFrame = ((id: number) => {
			rafCallbacks.delete(id);
		}) as unknown as typeof cancelAnimationFrame;

		try {
			const manager = createManager() as unknown as {
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
					lastPointerDetail: number;
				} | null;
				scheduleNativeInsertSelectionProbe: (traceId: string, reason: string) => void;
			};

			manager.pendingNativeInsertCommit = {
				traceId: 'ni-probe',
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
				lastPointerDetail: 1,
			};

			manager.scheduleNativeInsertSelectionProbe('ni-probe', 'session-end');
			manager.scheduleNativeInsertSelectionProbe('ni-probe', 'click-post-session');

			for (const [id, cb] of Array.from(rafCallbacks.entries())) {
				rafCallbacks.delete(id);
				cb(0);
			}
			await vi.runOnlyPendingTimersAsync();

			const probeMessages = getRecentLogs()
				.map(entry => entry.message)
				.filter(message => message.includes('NativeInsertSelectionProbe: trace=ni-probe'));

			expect(probeMessages).toHaveLength(2);
			expect(probeMessages.some(message => message.includes('phase=session-end:raf'))).toBe(true);
			expect(probeMessages.some(message => message.includes('timeout-120'))).toBe(true);
			expect(probeMessages.some(message => message.includes('timeout-0'))).toBe(false);
			const clickPostMessages = probeMessages.filter(message => message.includes('click-post-session'));
			expect(clickPostMessages).toHaveLength(0);
		} finally {
			(globalThis as Record<string, unknown>).requestAnimationFrame = originalRaf;
			(globalThis as Record<string, unknown>).cancelAnimationFrame = originalCancelRaf;
			vi.useRealTimers();
		}
	});

	it('should settle native insert reject once and clear scheduled work for the trace', async () => {
		updateLoggerConfig({ enableDebugLogging: true, enableVerboseCanvasDiagnostics: true });
		clearRecentLogs();
		vi.useFakeTimers();
		const originalRaf = globalThis.requestAnimationFrame;
		const originalCancelRaf = globalThis.cancelAnimationFrame;
		let rafIdSeq = 0;
		const rafCallbacks = new Map<number, FrameRequestCallback>();
		(globalThis as Record<string, unknown>).requestAnimationFrame = ((cb: FrameRequestCallback) => {
			const id = ++rafIdSeq;
			rafCallbacks.set(id, cb);
			return id;
		}) as unknown as typeof requestAnimationFrame;
		(globalThis as Record<string, unknown>).cancelAnimationFrame = ((id: number) => {
			rafCallbacks.delete(id);
		}) as unknown as typeof cancelAnimationFrame;

		try {
			const manager = createManager() as unknown as {
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
					lastPointerDetail: number;
					clickDetail?: number;
					clickClassified?: boolean;
					commitEligibleAt?: number;
					awaitingClickClassification?: boolean;
					evidenceFlags?: string[];
				} | null;
				scheduleNativeInsertSelectionProbe: (traceId: string, reason: string) => void;
				rejectPendingNativeInsertCommit: (trigger: string, reason: string, detail?: number) => boolean;
				nativeInsertTraceTimeouts: Map<string, Set<number>>;
				nativeInsertTraceRafs: Map<string, Set<number>>;
				nativeInsertProbePhasesByTrace: Map<string, Set<string>>;
				nativeInsertSettledTraceAt: Map<string, number>;
			};

			manager.pendingNativeInsertCommit = {
				traceId: 'ni-reject-once',
				pointerType: 'mouse',
				startReason: 'node-content',
				targetKind: 'node-content',
				anchorNodeId: 'parent-1',
				initialNodeCount: 1,
				initialPlaceholderCount: 0,
				nodeDelta: 0,
				placeholderDelta: 1,
				endReason: 'pointerup',
				endedAt: Date.now(),
				engineAttempted: false,
				lastPointerDetail: 2,
				clickDetail: 2,
				clickClassified: false,
				commitEligibleAt: Date.now() + 120,
				awaitingClickClassification: true,
				evidenceFlags: ['placeholder-delta'],
			};

			manager.scheduleNativeInsertSelectionProbe('ni-reject-once', 'session-end');
			expect(manager.nativeInsertTraceTimeouts.get('ni-reject-once')?.size ?? 0).toBeGreaterThan(0);
			expect(manager.nativeInsertTraceRafs.get('ni-reject-once')?.size ?? 0).toBeGreaterThan(0);

			expect(manager.rejectPendingNativeInsertCommit('click-post-session', 'multi-click', 2)).toBe(true);
			expect(manager.rejectPendingNativeInsertCommit('click-post-session', 'multi-click', 2)).toBe(false);

			for (const [id, cb] of Array.from(rafCallbacks.entries())) {
				rafCallbacks.delete(id);
				cb(0);
			}
			await vi.runOnlyPendingTimersAsync();

			expect(manager.pendingNativeInsertCommit).toBeNull();
			expect(manager.nativeInsertTraceTimeouts.has('ni-reject-once')).toBe(false);
			expect(manager.nativeInsertTraceRafs.has('ni-reject-once')).toBe(false);
			expect(manager.nativeInsertProbePhasesByTrace.has('ni-reject-once')).toBe(false);
			expect(manager.nativeInsertSettledTraceAt.has('ni-reject-once')).toBe(true);

			const messages = getRecentLogs().map(entry => entry.message);
			expect(messages.filter(message => message.includes('NativeInsertCommitRejected: trace=ni-reject-once'))).toHaveLength(1);
			expect(messages.filter(message => message.includes('NativeInsertTraceSummary: trace=ni-reject-once'))).toHaveLength(1);
		} finally {
			(globalThis as Record<string, unknown>).requestAnimationFrame = originalRaf;
			(globalThis as Record<string, unknown>).cancelAnimationFrame = originalCancelRaf;
			vi.useRealTimers();
		}
	});

	it('should emit one native insert trace summary and clear scheduler after successful fallback commit', async () => {
		updateLoggerConfig({ enableDebugLogging: true, enableVerboseCanvasDiagnostics: true });
		clearRecentLogs();
		vi.useFakeTimers();
		const originalRaf = globalThis.requestAnimationFrame;
		const originalCancelRaf = globalThis.cancelAnimationFrame;
		let rafIdSeq = 0;
		const rafCallbacks = new Map<number, FrameRequestCallback>();
		(globalThis as Record<string, unknown>).requestAnimationFrame = ((cb: FrameRequestCallback) => {
			const id = ++rafIdSeq;
			rafCallbacks.set(id, cb);
			return id;
		}) as unknown as typeof requestAnimationFrame;
		(globalThis as Record<string, unknown>).cancelAnimationFrame = ((id: number) => {
			rafCallbacks.delete(id);
		}) as unknown as typeof cancelAnimationFrame;

		try {
			const canvas = {
				nodes: [] as Array<{ id: string; type: 'text'; text: string; x: number; y: number; width: number; height: number }>,
				edges: [] as unknown[],
				file: { path: 'test.canvas' },
			};
			const addNodeToCanvas = vi.fn(async () => {
				canvas.nodes.push({ id: 'created-summary-1', type: 'text', text: '', x: 0, y: 0, width: 200, height: 80 });
			});
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
					lastPointerDetail: number;
					clickDetail?: number;
					clickClassified?: boolean;
					commitEligibleAt?: number;
					awaitingClickClassification?: boolean;
					evidenceFlags?: string[];
				} | null;
				scheduleNativeInsertSelectionProbe: (traceId: string, reason: string) => void;
				flushPendingNativeInsertCommit: (trigger: string) => Promise<void>;
				nativeInsertTraceTimeouts: Map<string, Set<number>>;
				nativeInsertTraceRafs: Map<string, Set<number>>;
				nativeInsertProbePhasesByTrace: Map<string, Set<string>>;
				nativeInsertSettledTraceAt: Map<string, number>;
			};

			manager.pendingNativeInsertCommit = {
				traceId: 'ni-summary-done',
				pointerType: 'touch',
				startReason: 'wrapper-touch-like',
				targetKind: 'wrapper',
				anchorNodeId: 'parent-1',
				initialNodeCount: 0,
				initialPlaceholderCount: 0,
				nodeDelta: 0,
				placeholderDelta: 1,
				endReason: 'pointerup',
				endedAt: Date.now(),
				engineAttempted: false,
				lastPointerDetail: 1,
				clickDetail: 0,
				clickClassified: false,
				commitEligibleAt: Date.now(),
				awaitingClickClassification: false,
				evidenceFlags: ['placeholder-delta', 'touch-like-wrapper'],
			};

			manager.scheduleNativeInsertSelectionProbe('ni-summary-done', 'session-end');
			await manager.flushPendingNativeInsertCommit('session-end:timeout-0');

			expect(addNodeToCanvas).toHaveBeenCalledTimes(1);
			expect(manager.pendingNativeInsertCommit).toBeNull();
			expect(manager.nativeInsertTraceTimeouts.has('ni-summary-done')).toBe(false);
			expect(manager.nativeInsertTraceRafs.has('ni-summary-done')).toBe(false);
			expect(manager.nativeInsertProbePhasesByTrace.has('ni-summary-done')).toBe(false);
			expect(manager.nativeInsertSettledTraceAt.has('ni-summary-done')).toBe(true);

			const messages = getRecentLogs().map(entry => entry.message);
			expect(messages.filter(message => message.includes('NativeInsertTraceSummary: trace=ni-summary-done'))).toHaveLength(1);
			expect(messages.some(message => (
				message.includes('NativeInsertTraceSummary: trace=ni-summary-done')
				&& message.includes('outcome=accepted')
				&& message.includes('blankCandidate=true')
				&& message.includes('selectionStable=true')
				&& message.includes('fallbackCommitted=true')
				&& message.includes('observedNodeDelta=1')
				&& message.includes('clearedTimeouts=1')
				&& message.includes('clearedRafs=1')
			))).toBe(true);
		} finally {
			(globalThis as Record<string, unknown>).requestAnimationFrame = originalRaf;
			(globalThis as Record<string, unknown>).cancelAnimationFrame = originalCancelRaf;
			vi.useRealTimers();
		}
	});

	it('should dedup open-entry stabilization across active-leaf-change and file-open for same file', () => {
		const scheduleOpenStabilization = vi.fn();
		const plugin = {} as never;
		const app = {} as never;
		const settings = {} as never;
		const collapseStateManager = {} as never;
		const canvasManager = {
			getFloatingNodeService: () => ({}) as never,
			scheduleOpenStabilization,
		} as never;
		const manager = new CanvasEventManager(plugin, app, settings, collapseStateManager, canvasManager) as unknown as {
			scheduleOpenStabilizationWithDedup: (source: string, filePath: string | null) => void;
		};

		manager.scheduleOpenStabilizationWithDedup('active-leaf-change', 'test.canvas');
		manager.scheduleOpenStabilizationWithDedup('file-open', 'test.canvas');

		expect(scheduleOpenStabilization).toHaveBeenCalledTimes(1);
		expect(scheduleOpenStabilization).toHaveBeenCalledWith('active-leaf-change');
	});

	it('should suppress open-entry stabilization during delete modal focus normalization window', () => {
		const manager = createManager() as unknown as {
			markSuppressOpenEntryByFocusNormalization: (
				phase: string,
				kind: 'node' | 'edge',
				targetId: string,
				holdMs?: number,
			) => void;
			shouldSuppressOpenStabilization: (source: string, filePath: string | null) => boolean;
		};

		manager.markSuppressOpenEntryByFocusNormalization('post-close', 'node', 'node-1', 1200);

		expect(manager.shouldSuppressOpenStabilization('active-leaf-change', 'test.canvas')).toBe(true);
		expect(manager.shouldSuppressOpenStabilization('node-mounted-idle-batch', 'test.canvas')).toBe(false);

		const messages = getRecentLogs().map(entry => entry.message);
		expect(messages.some(message => (
			message.includes('OpenEntrySuppressed: source=active-leaf-change')
			&& message.includes('reason=delete-modal-focus-normalization')
		))).toBe(true);
	});
});