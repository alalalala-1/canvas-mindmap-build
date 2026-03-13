import { log, logVerbose } from '../../utils/logger';

export interface OpenEntryGuardHost {
	nodeMountedOpenProtectionUntil: number;
	nodeMountedOpenProtectionMs: number;
	nodeMountedBatchTimeoutId: number | null;
	nodeMountedPendingCount: number;
	nodeMountedPendingFilePath: string | null;
	nodeMountedLastFlushAt: number;
	nodeMountedInteractionActiveUntil: number;
	nodeMountedCooldownMs: number;
	nodeMountedDelayByInteractionCount: number;
	nodeMountedDelayByCooldownCount: number;
	nodeMountedBatchDebounceMs: number;
	currentCanvasFilePath: string | null;
	lastOpenEntryStabilizeAtByFilePath: Map<string, number>;
	openEntryDedupWindowMs: number;
	lastOpenStabilizeKickKey: string;
	lastOpenStabilizeKickAt: number;
	programmaticReloadSuppressUntilByFilePath: Map<string, number>;
	programmaticReloadDefaultHoldMs: number;
	suppressOpenEntryByFocusNormalizationUntil: number;
	suppressOpenEntryByFocusNormalizationContext: string | null;
	canvasManager: {
		scheduleOpenStabilization: (source: string) => void;
	};
}

export function markOpenProtectionWindow(host: OpenEntryGuardHost, reason: string): void {
	host.nodeMountedOpenProtectionUntil = Date.now() + host.nodeMountedOpenProtectionMs;
	logVerbose(`[Event] OpenStabilizeProtectWindow: reason=${reason}, holdMs=${host.nodeMountedOpenProtectionMs}`);
}

export function scheduleOpenStabilizationWithDedup(
	host: OpenEntryGuardHost,
	source: string,
	filePath: string | null,
): void {
	const dedupScope = source === 'active-leaf-change' || source === 'file-open' ? 'open-entry' : source;
	const key = `${dedupScope}:${filePath || 'unknown'}`;
	const now = Date.now();

	if (dedupScope === 'open-entry' && filePath) {
		const lastOpenEntryAt = host.lastOpenEntryStabilizeAtByFilePath.get(filePath) || 0;
		if (now - lastOpenEntryAt < host.openEntryDedupWindowMs) {
			logVerbose(`[Event] OpenEntryDedup: skip duplicate trigger, source=${source}, file=${filePath}`);
			return;
		}
		host.lastOpenEntryStabilizeAtByFilePath.set(filePath, now);
	}

	if (host.lastOpenStabilizeKickKey === key && now - host.lastOpenStabilizeKickAt < 600) {
		logVerbose(`[Event] OpenStabilizeDedup: skip duplicate trigger, source=${source}, file=${filePath || 'unknown'}`);
		return;
	}

	host.lastOpenStabilizeKickKey = key;
	host.lastOpenStabilizeKickAt = now;
	host.canvasManager.scheduleOpenStabilization(source);
}

export function markProgrammaticCanvasReload(
	host: OpenEntryGuardHost,
	filePath: string,
	holdMs: number = host.programmaticReloadDefaultHoldMs,
): void {
	if (!filePath) return;
	const until = Date.now() + Math.max(0, holdMs);
	host.programmaticReloadSuppressUntilByFilePath.set(filePath, until);
	log(`[Event] MarkProgrammaticReload: file=${filePath}, holdMs=${holdMs}`);
}

export function shouldSuppressOpenStabilization(
	host: OpenEntryGuardHost,
	source: string,
	filePath: string | null,
): boolean {
	const now = Date.now();
	const isOpenEntrySource = source === 'active-leaf-change' || source === 'file-open';

	if (isOpenEntrySource) {
		if (host.suppressOpenEntryByFocusNormalizationUntil > now) {
			log(
				`[Event] OpenEntrySuppressed: source=${source}, file=${filePath || 'unknown'}, ` +
					`reason=delete-modal-focus-normalization, remaining=${host.suppressOpenEntryByFocusNormalizationUntil - now}ms, ` +
					`context=${host.suppressOpenEntryByFocusNormalizationContext || 'none'}`,
			);
			return true;
		}

		if (host.suppressOpenEntryByFocusNormalizationUntil > 0) {
			host.suppressOpenEntryByFocusNormalizationUntil = 0;
			host.suppressOpenEntryByFocusNormalizationContext = null;
		}
	}

	if (!filePath) return false;

	const until = host.programmaticReloadSuppressUntilByFilePath.get(filePath) || 0;
	if (until > now) {
		log(`[Event] OpenStabilizeSuppressed: source=${source}, file=${filePath}, remaining=${until - now}ms`);
		return true;
	}

	if (until > 0) {
		host.programmaticReloadSuppressUntilByFilePath.delete(filePath);
	}

	return false;
}

export function scheduleNodeMountedBatchFlush(host: OpenEntryGuardHost, delayMs: number, reason: string): void {
	if (host.nodeMountedBatchTimeoutId !== null) {
		window.clearTimeout(host.nodeMountedBatchTimeoutId);
	}

	host.nodeMountedBatchTimeoutId = window.setTimeout(() => {
		host.nodeMountedBatchTimeoutId = null;
		flushNodeMountedBatch(host, reason);
	}, Math.max(0, delayMs));
}

export function queueNodeMountedStabilization(
	host: OpenEntryGuardHost,
	filePath: string | null,
	mountedCount: number,
): void {
	host.nodeMountedPendingCount += Math.max(1, mountedCount);
	if (!host.nodeMountedPendingFilePath && filePath) {
		host.nodeMountedPendingFilePath = filePath;
	}
	scheduleNodeMountedBatchFlush(host, host.nodeMountedBatchDebounceMs, 'debounce');
}

export function flushNodeMountedBatch(host: OpenEntryGuardHost, reason: string): void {
	if (host.nodeMountedPendingCount <= 0) return;

	const now = Date.now();
	const cooldownRemaining = Math.max(0, host.nodeMountedCooldownMs - (now - host.nodeMountedLastFlushAt));
	const interactionRemaining = Math.max(0, host.nodeMountedInteractionActiveUntil - now);
	const protectionRemaining = Math.max(0, host.nodeMountedOpenProtectionUntil - now);
	const deferBy = Math.max(cooldownRemaining, interactionRemaining, protectionRemaining);

	if (deferBy > 0) {
		if (interactionRemaining >= cooldownRemaining && interactionRemaining >= protectionRemaining) {
			host.nodeMountedDelayByInteractionCount++;
		} else {
			host.nodeMountedDelayByCooldownCount++;
		}
		scheduleNodeMountedBatchFlush(host, deferBy + 30, `defer-${reason}`);
		return;
	}

	const batchSize = host.nodeMountedPendingCount;
	const filePath = host.nodeMountedPendingFilePath || host.currentCanvasFilePath;
	const delayedByInteraction = host.nodeMountedDelayByInteractionCount;
	const delayedByCooldown = host.nodeMountedDelayByCooldownCount;

	host.nodeMountedPendingCount = 0;
	host.nodeMountedPendingFilePath = null;
	host.nodeMountedDelayByInteractionCount = 0;
	host.nodeMountedDelayByCooldownCount = 0;
	host.nodeMountedLastFlushAt = now;

	log(
		`[Event] OpenStabilizeNodeMountedBatch: source=node-mounted-idle-batch, batchSize=${batchSize}, ` +
			`delayedByInteraction=${delayedByInteraction}, delayedByCooldown=${delayedByCooldown}, reason=${reason}, file=${filePath || 'unknown'}`,
	);

	if (shouldSuppressOpenStabilization(host, 'node-mounted-idle-batch', filePath || null)) {
		log(
			`[Event] OpenStabilizeNodeMountedBatchSuppressed: source=node-mounted-idle-batch, batchSize=${batchSize}, ` +
				`reason=${reason}, file=${filePath || 'unknown'}, by=programmatic-reload-window`,
		);
		return;
	}

	scheduleOpenStabilizationWithDedup(host, 'node-mounted-idle-batch', filePath || null);
}