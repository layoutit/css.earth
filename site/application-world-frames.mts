import type { SceneLifetime } from '@cssearth/engine';
import { createWorldFrameQueue } from '../src/renderers/css/dist/universe.js';
import type { WorldCameraPose, WorldCameraViewport } from '../src/renderers/css/navigation/world-camera.js';
import type { ApplicationWorldLayer, ApplicationWorldPlanner, ApplicationWorldMinimap, ApplicationWorldMoonLabels } from './application-world-types.mts';

interface WorldFramesOptions {
  layer: ApplicationWorldLayer;
  planner: ApplicationWorldPlanner;
  minimap: ApplicationWorldMinimap;
  moonLabels: ApplicationWorldMoonLabels;
  lifetime: SceneLifetime;
  heliosphereEnabled(): boolean;
}

/** Camera commit and retained-world publication share one worker-planned frame. */
export function createApplicationWorldFrames({ layer, planner, minimap, moonLabels, lifetime, heliosphereEnabled }: WorldFramesOptions) {
  let publication: { world: WorldCameraPose; viewport: WorldCameraViewport } | null = null;
  let rotating = false, flying = false, minimapFrame = 0;

  const queue = createWorldFrameQueue(async request => {
    const snapshot = layer.captureFrame(request.world, request.viewport);
    const frame = await planner.plan(snapshot.view);
    return { current: snapshot.current, commit(camera) {
      const { world, viewport } = request;
      publication = { world, viewport };
      layer.publish(world, viewport, { heliosphere: heliosphereEnabled() }, frame);
      moonLabels.publish(world, viewport, layer.labelBudget());
      // The decorative minimap follows drags at half rate and waits out flights.
      if (!flying && (!rotating || (minimapFrame++ & 1) === 0)) minimap.publish(world, viewport);
      // Camera subscribers observe the complete view; they never publish it.
      camera();
    } };
  }, layer.opacityClock);

  function publishMinimap() {
    if (!lifetime.disposed && publication) minimap.publish(publication.world, publication.viewport);
  }

  return {
    publishMinimap, stats: queue.stats,
    refresh: () => !lifetime.disposed && queue.refresh(),
    setRotationActive(active: boolean) {
      if (lifetime.disposed) return;
      layer.setRotationActive(active);
      rotating = active;
      if (!active) publishMinimap();
    },
    setNavigationInFlight(active: boolean) {
      if (lifetime.disposed) return;
      layer.setNavigationInFlight(active);
      if (flying === active) return;
      flying = active;
      if (!active) publishMinimap();
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
          if (!enabled) { queue.remember(owned); request.commit(); return signal ? Promise.resolve(true) : undefined; }
          if (signal) return queue.presentAndWait(owned, signal);
          queue.present(owned);
        } };
    },
    destroy() {
      publication = null;
      queue.destroy();
    },
  };
}
