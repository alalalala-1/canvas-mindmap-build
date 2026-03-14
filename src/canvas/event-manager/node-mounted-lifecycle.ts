import { ItemView, Platform } from 'obsidian';
import { CanvasLike } from '../types';
import { log, logVerbose } from '../../utils/logger';

export interface NodeMountedLifecycleHost {
    currentCanvasFilePath: string | null;
    deferredAdjustNodeIds: Set<string>;
    shouldSuppressSideEffectsForNativeInsert(): boolean;
    scheduleDeferredPostInsertMaintenance(reason: string): void;
    canvasManager: {
        checkAndAddCollapseButtons(): Promise<void>;
        notifyNodeMountedVisible?(nodeId: string, reason?: string): void;
        reapplyCurrentCollapseVisibility(canvas: CanvasLike, reason: string): number;
        syncScrollableStateForMountedNodes(): number;
    };
    getCanvasView(): ItemView | null;
    getCanvasFromView(view: ItemView): CanvasLike | null;
    queueNodeMountedStabilization(filePath: string | null, mountedCount: number): void;
}

export function handleMountedNodeBatch(
    host: NodeMountedLifecycleHost,
    mountedNodeIds: Set<string>,
    mountedNodeCount: number
): void {
    if (host.shouldSuppressSideEffectsForNativeInsert()) {
        for (const mountedNodeId of mountedNodeIds) {
            host.deferredAdjustNodeIds.add(mountedNodeId);
        }
        logVerbose(`[Event] NativeInsertSuppressedSideEffects: reason=node-mounted, mountedNodeCount=${mountedNodeCount}`);
        host.scheduleDeferredPostInsertMaintenance(`node-mounted:${mountedNodeCount}`);
        return;
    }

    void host.canvasManager.checkAndAddCollapseButtons();
    for (const mountedNodeId of mountedNodeIds) {
        host.canvasManager.notifyNodeMountedVisible?.(mountedNodeId, 'node-mounted-visible');
    }

    const activeCanvasView = host.getCanvasView();
    const activeCanvas = activeCanvasView ? host.getCanvasFromView(activeCanvasView) : null;
    if (activeCanvas) {
        const hiddenCount = host.canvasManager.reapplyCurrentCollapseVisibility(
            activeCanvas,
            `node-mounted:${mountedNodeCount}`
        );
        if (hiddenCount > 0) {
            log(`[Event] NodeMountedReapplyCollapseVisibility: hidden=${hiddenCount}, mountedNodeCount=${mountedNodeCount}`);
        }
    }

    const scrollSyncDelay = Platform.isMobile ? 120 : 60;
    window.setTimeout(() => {
        const updated = host.canvasManager.syncScrollableStateForMountedNodes();
        if (updated > 0) {
            log(`[Event] NodeMountedScrollSync: updated=${updated}, mountedNodeCount=${mountedNodeCount}`);
        }
    }, scrollSyncDelay);

    const filePath = (activeCanvas?.file?.path || host.currentCanvasFilePath);
    host.queueNodeMountedStabilization(filePath || null, mountedNodeCount);
}