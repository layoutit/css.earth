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
}

/** Camera commit and retained-world publication share one worker-planned frame. */
export function createApplicationWorldFrames({ layer, planner, moonLabels, lifetime, heliosphereEnabled }: WorldFramesOptions) {

  const queue = createWorldFrameQueue(async request => {
    const snapshot = layer.captureFrame(request.world, request.viewport);
    const frame = await planner.plan(snapshot.view);
    return { current: snapshot.current, commit(camera) {
      const { world, viewport } = request;
      layer.publish(world, viewport, frame, { heliosphere: heliosphereEnabled() });
      moonLabels.publish(world, viewport, layer.labelBudget());
      // Camera subscribers observe the complete view; they never publish it.
      camera();
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
      return { enable() {
        if (enabled || disposed || lifetime.disposed) return;
        enabled = true;
        queue.refresh();
      }, destroy() { disposed = true; },
        present(request: Parameters<typeof queue.present>[0], signal?: AbortSignal) {
          if (disposed || lifetime.disposed || signal?.aborted || !request.current()) return signal ? Promise.resolve(false) : undefined;
          const owned = { ...request, current: () => !disposed && !lifetime.disposed && request.current() };
          if (!enabled) { queue.remember(owned); request.commit(); return; }
          if (signal) return queue.presentAndWait(owned, signal);
          queue.present(owned);
        } };
    },
    destroy: queue.destroy,
  };
}
