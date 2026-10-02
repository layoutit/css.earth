import type { SceneLifetime } from '@cssearth/engine';
import { createWorldFrameQueue } from '@cssearth/renderer/universe';
import type { WorldCameraPose, WorldCameraViewport } from '@cssearth/renderer/navigation/world-camera.ts';
import type { ApplicationWorldLayer, ApplicationWorldPlanner, ApplicationWorldMoonLabels } from './application-world-types.mts';

interface WorldFramesOptions {
  layer: ApplicationWorldLayer;
  planner: ApplicationWorldPlanner;
  moonLabels: ApplicationWorldMoonLabels;
  lifetime: SceneLifetime;
  heliosphereEnabled(): boolean;
  /** Called with each published frame's camera. */
  onFrame?(world: WorldCameraPose): void;
}

/** Camera commit and retained-world publication share one worker-planned frame. */
export function createApplicationWorldFrames({ layer, planner, moonLabels, lifetime, heliosphereEnabled, onFrame }: WorldFramesOptions) {

  const queue = createWorldFrameQueue(async request => {
    const snapshot = layer.captureFrame(request.world, request.viewport);
    const frame = await planner.plan(snapshot.view);
    return { current: snapshot.current, commit(camera) {
      const { world, viewport } = request;
      layer.publish(world, viewport, frame, { heliosphere: heliosphereEnabled() });
      moonLabels.publish(world, viewport, layer.labelBudget());
      // Camera subscribers observe the complete view; they never publish it.
      camera();
      onFrame?.(world);
    } };
  }, layer.opacityClock);

  return {
    stats: queue.stats,
    refresh: () => !lifetime.disposed && queue.refresh(),
    setRotationActive(active: boolean) {
      if (lifetime.disposed) return;
      layer.setRotationActive(active);
    },
    setCoasting(active: boolean) {
      if (lifetime.disposed) return;
      layer.setCoasting(active);
      moonLabels.setCoasting(active);
    },
    setNavigationInFlight(active: boolean) {
      if (lifetime.disposed) return;
      layer.setNavigationInFlight(active);
    },
    present(world: WorldCameraPose, viewport: WorldCameraViewport, { signal, commit = () => {} }: { signal: AbortSignal; commit?: () => void }) {
      return queue.presentAndWait({ world, viewport, commit, current: () => !lifetime.disposed, fail() {} }, signal);
    },
    createFramePresenter() {
      let enabled = false, disposed = false;
      let pending: Parameters<typeof queue.present>[0] | null = null;
      return { enable() {
        if (enabled || disposed || lifetime.disposed) return;
        enabled = true;
        if (pending) { queue.remember(pending); pending = null; }
        queue.refresh();
      },
        /** Plan the world for the camera this mounting scene holds, before `enable` asks for it: a covered startup
         * plans behind its paint gate instead of after it. The plan is used only if that camera, and everything the
         * planner read, are still the same when the scene enables; otherwise `enable` plans as before. It is asked for at
         * once, not a frame later: the detail's first paint holds the main thread (125 ms on the iPad), and a plan
         * requested after it started at the end of the gate (reveal 60 to 90 ms after the paint, against 26 to 42 ms,
         * 2026-10-02). The selected body's caption is measured by the next layout (selected-body-label.ts), so the
         * world's labels keep clear of it from the plan that follows the reveal. */
        warm() {
          if (enabled || disposed || lifetime.disposed || !pending) return false;
          queueMicrotask(() => { if (!enabled && !disposed && !lifetime.disposed && pending) queue.warm(pending); });
          return true;
        },
        destroy() { disposed = true; pending = null; },
        present(request: Parameters<typeof queue.present>[0], signal?: AbortSignal) {
          if (disposed || lifetime.disposed || signal?.aborted || !request.current()) return signal ? Promise.resolve(false) : undefined;
          const owned = { ...request, current: () => !disposed && !lifetime.disposed && request.current() };
          // Resource/label refreshes may run while detail is still mounting.
          // Keep its camera local until the selected scene is connected.
          if (!enabled) { pending = owned; request.commit(); return; }
          if (signal) return queue.presentAndWait(owned, signal);
          queue.present(owned);
        } };
    },
    destroy: queue.destroy,
  };
}
