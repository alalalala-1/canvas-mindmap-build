import { log } from '../../utils/logger';
import {
	markOpenProtectionWindow as markOpenProtectionWindowHelper,
	scheduleNodeMountedBatchFlush as scheduleNodeMountedBatchFlushHelper,
	queueNodeMountedStabilization as queueNodeMountedStabilizationHelper,
	flushNodeMountedBatch as flushNodeMountedBatchHelper,
	scheduleOpenStabilizationWithDedup as scheduleOpenStabilizationWithDedupHelper,
	markProgrammaticCanvasReload as markProgrammaticCanvasReloadHelper,
	shouldSuppressOpenStabilization as shouldSuppressOpenStabilizationHelper,
	type OpenEntryGuardHost,
} from './open-entry-guard';

/**
 * Open Stabilization Orchestrator Service
 * 
 * 职责：管理 Canvas open/reload 后的稳定化编排逻辑，包括：
 * - open-entry 稳定化调度与去重
 * - node-mounted 批量调度
 * - programmatic reload 抑制窗口
 * - 交互活跃期防抖
 */
export class OpenStabilizationOrchestratorService {
	// Open stabilization 去重
	private lastOpenStabilizeKickAt: number = 0;
	private lastOpenStabilizeKickKey: string = '';
	private lastOpenEntryStabilizeAtByFilePath: Map<string, number> = new Map();

	// Programmatic reload 抑制
	private programmaticReloadSuppressUntilByFilePath: Map<string, number> = new Map();
	private readonly programmaticReloadDefaultHoldMs: number = 1800;

	// Node-mounted 批量调度
	private nodeMountedBatchTimeoutId: number | null = null;
	private nodeMountedPendingCount: number = 0;
	private nodeMountedPendingFilePath: string | null = null;
	private nodeMountedLastFlushAt: number = 0;
	private nodeMountedInteractionActiveUntil: number = 0;
	private nodeMountedOpenProtectionUntil: number = 0;
	private nodeMountedDelayByInteractionCount: number = 0;
	private nodeMountedDelayByCooldownCount: number = 0;

	// Focus normalization 抑制
	private suppressOpenEntryByFocusNormalizationUntil: number = 0;
	private suppressOpenEntryByFocusNormalizationContext: string | null = null;

	// 常量配置
	private readonly nodeMountedBatchDebounceMs: number = 180;
	private readonly nodeMountedCooldownMs: number = 900;
	private readonly nodeMountedInteractionIdleMs: number = 280;
	private readonly nodeMountedOpenProtectionMs: number = 1000;
	private readonly openEntryDedupWindowMs: number = 1500;

	// Host 依赖（用于访问 currentCanvasFilePath 等）
	private host: OpenStabilizationOrchestratorHost;

	constructor(host: OpenStabilizationOrchestratorHost) {
		this.host = host;
	}

	markOpenProtectionWindow(reason: string): void {
		const asHost = this.asOpenEntryGuardHost();
		markOpenProtectionWindowHelper(asHost, reason);
		this.syncFromHost(asHost);
	}

	scheduleNodeMountedBatchFlush(delayMs: number, reason: string): void {
		const asHost = this.asOpenEntryGuardHost();
		scheduleNodeMountedBatchFlushHelper(asHost, delayMs, reason);
		this.syncFromHost(asHost);
	}

	queueNodeMountedStabilization(filePath: string | null, mountedCount: number): void {
		const asHost = this.asOpenEntryGuardHost();
		queueNodeMountedStabilizationHelper(asHost, filePath, mountedCount);
		this.syncFromHost(asHost);
	}

	flushNodeMountedBatch(reason: string): void {
		const asHost = this.asOpenEntryGuardHost();
		flushNodeMountedBatchHelper(asHost, reason);
		this.syncFromHost(asHost);
	}

	scheduleOpenStabilizationWithDedup(source: string, filePath: string | null): void {
		const asHost = this.asOpenEntryGuardHost();
		scheduleOpenStabilizationWithDedupHelper(asHost, source, filePath);
		this.syncFromHost(asHost);
	}

	markProgrammaticCanvasReload(filePath: string, holdMs: number = this.programmaticReloadDefaultHoldMs): void {
		const asHost = this.asOpenEntryGuardHost();
		markProgrammaticCanvasReloadHelper(asHost, filePath, holdMs);
		this.syncFromHost(asHost);
	}

	shouldSuppressOpenStabilization(source: string, filePath: string | null): boolean {
		const asHost = this.asOpenEntryGuardHost();
		const result = shouldSuppressOpenStabilizationHelper(asHost, source, filePath);
		this.syncFromHost(asHost);
		return result;
	}

	markSuppressOpenEntryByFocusNormalization(
		phase: string,
		kind: 'node' | 'edge',
		targetId: string,
		holdMs: number = 1200
	): void {
		const until = Date.now() + Math.max(0, holdMs);
		const context = `${phase}:${kind}:${targetId}`;
		this.suppressOpenEntryByFocusNormalizationUntil = until;
		this.suppressOpenEntryByFocusNormalizationContext = context;
		log(`[OpenStabilization] SuppressOpenEntryByFocusNormalization: context=${context}, until=${until}`);
	}

	clearAllDebounceTimers(): void {
		if (this.nodeMountedBatchTimeoutId !== null) {
			window.clearTimeout(this.nodeMountedBatchTimeoutId);
			this.nodeMountedBatchTimeoutId = null;
		}
	}

	// ========================================================================
	// 内部辅助方法
	// ========================================================================

	/**
	 * 将当前服务状态适配为 OpenEntryGuardHost 接口
	 */
	private asOpenEntryGuardHost(): OpenEntryGuardHost {
		return {
			currentCanvasFilePath: this.host.currentCanvasFilePath,
			lastOpenStabilizeKickAt: this.lastOpenStabilizeKickAt,
			lastOpenStabilizeKickKey: this.lastOpenStabilizeKickKey,
			programmaticReloadSuppressUntilByFilePath: this.programmaticReloadSuppressUntilByFilePath,
			programmaticReloadDefaultHoldMs: this.programmaticReloadDefaultHoldMs,
			nodeMountedBatchTimeoutId: this.nodeMountedBatchTimeoutId,
			nodeMountedPendingCount: this.nodeMountedPendingCount,
			nodeMountedPendingFilePath: this.nodeMountedPendingFilePath,
			nodeMountedLastFlushAt: this.nodeMountedLastFlushAt,
			nodeMountedInteractionActiveUntil: this.nodeMountedInteractionActiveUntil,
			nodeMountedOpenProtectionUntil: this.nodeMountedOpenProtectionUntil,
			nodeMountedDelayByInteractionCount: this.nodeMountedDelayByInteractionCount,
			nodeMountedDelayByCooldownCount: this.nodeMountedDelayByCooldownCount,
			nodeMountedBatchDebounceMs: this.nodeMountedBatchDebounceMs,
			nodeMountedCooldownMs: this.nodeMountedCooldownMs,
			nodeMountedOpenProtectionMs: this.nodeMountedOpenProtectionMs,
			lastOpenEntryStabilizeAtByFilePath: this.lastOpenEntryStabilizeAtByFilePath,
			suppressOpenEntryByFocusNormalizationUntil: this.suppressOpenEntryByFocusNormalizationUntil,
			suppressOpenEntryByFocusNormalizationContext: this.suppressOpenEntryByFocusNormalizationContext,
			openEntryDedupWindowMs: this.openEntryDedupWindowMs,
			canvasManager: this.host.canvasManager,
		};
	}

	/**
	 * 从 host 接口同步状态回服务实例
	 */
	private syncFromHost(host: OpenEntryGuardHost): void {
		this.lastOpenStabilizeKickAt = host.lastOpenStabilizeKickAt;
		this.lastOpenStabilizeKickKey = host.lastOpenStabilizeKickKey;
		this.nodeMountedBatchTimeoutId = host.nodeMountedBatchTimeoutId;
		this.nodeMountedPendingCount = host.nodeMountedPendingCount;
		this.nodeMountedPendingFilePath = host.nodeMountedPendingFilePath;
		this.nodeMountedLastFlushAt = host.nodeMountedLastFlushAt;
		this.nodeMountedInteractionActiveUntil = host.nodeMountedInteractionActiveUntil;
		this.nodeMountedOpenProtectionUntil = host.nodeMountedOpenProtectionUntil;
		this.nodeMountedDelayByInteractionCount = host.nodeMountedDelayByInteractionCount;
		this.nodeMountedDelayByCooldownCount = host.nodeMountedDelayByCooldownCount;
		this.suppressOpenEntryByFocusNormalizationUntil = host.suppressOpenEntryByFocusNormalizationUntil;
		this.suppressOpenEntryByFocusNormalizationContext = host.suppressOpenEntryByFocusNormalizationContext;
	}
}

/**
 * Host 依赖接口：OpenStabilizationOrchestrator 需要的外部依赖
 */
export interface OpenStabilizationOrchestratorHost {
	currentCanvasFilePath: string | null;
	canvasManager: {
		scheduleOpenStabilization: (source: string) => void;
	};
}
