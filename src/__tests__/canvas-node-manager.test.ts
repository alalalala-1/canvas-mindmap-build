import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CanvasNodeManager } from '../canvas/canvas-node-manager';

function createManager() {
    const app = {} as never;
    const plugin = {} as never;
    const settings = {
        textNodeWidth: 400,
        textNodeMaxHeight: 800,
        formulaNodeWidth: 400,
        formulaNodeHeight: 80,
        enableFormulaDetection: true,
        enableDebugLogging: false,
        enableVerboseCanvasDiagnostics: false,
    } as never;
    const collapseStateManager = {} as never;
    const canvasFileService = {} as never;
    return new CanvasNodeManager(app, plugin, settings, collapseStateManager, canvasFileService);
}

describe('CanvasNodeManager virtualization-aware scheduling', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('should park missing node DOM after retry exhaustion and resume on notify', async () => {
        const manager = createManager();
        const scheduleSpy = vi.spyOn(manager, 'scheduleNodeHeightAdjustment').mockImplementation(() => undefined);

        const fakeNode = { nodeEl: undefined } as never;
        const service = {
            adjustNodeHeight: vi.fn().mockResolvedValue(60),
            syncMemoryNodeHeight: vi.fn(),
            getCanvasNodeElement: vi.fn().mockReturnValue(fakeNode),
        };
        (manager as unknown as { nodeHeightService: typeof service }).nodeHeightService = service;

        await manager.adjustNodeHeightAfterRender('node-1');
        await manager.adjustNodeHeightAfterRender('node-1');
        await manager.adjustNodeHeightAfterRender('node-1');
        await manager.adjustNodeHeightAfterRender('node-1');

        expect((manager as unknown as { parkedNodeHeightAdjustByNodeId: Map<string, unknown> }).parkedNodeHeightAdjustByNodeId.has('node-1')).toBe(true);

        manager.notifyNodeMountedVisible('node-1', 'node-mounted-visible');

        expect((manager as unknown as { parkedNodeHeightAdjustByNodeId: Map<string, unknown> }).parkedNodeHeightAdjustByNodeId.has('node-1')).toBe(false);
        expect(scheduleSpy).toHaveBeenLastCalledWith('node-1', 100, 'node-mounted-visible');
    });
});
