import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import type { ObjectWorldNavigationListener } from './world-navigation-types.js';

export function createWorldNavigationPublicationHub(onError: (error: unknown) => void) {
  const listeners = new Set<ObjectWorldNavigationListener>();
  let latest: readonly [WorldCameraPose, WorldCameraViewport] | null = null;
  let disposed = false;
  return Object.freeze({
    publish(world: WorldCameraPose, viewport: WorldCameraViewport) {
      if (disposed) return;
      latest = [world, viewport];
      for (const listener of listeners) {
        try { listener(world, viewport); }
        catch (error) {
          disposed = true;
          listeners.clear();
          onError(error);
          return;
        }
      }
    },
    subscribe(listener: ObjectWorldNavigationListener) {
      if (typeof listener !== 'function') throw new TypeError('World navigation listener must be callable.');
      if (disposed) return () => {};
      listeners.add(listener);
      if (latest !== null) listener(latest[0], latest[1]);
      return () => listeners.delete(listener);
    },
    destroy() { disposed = true; listeners.clear(); latest = null; },
  });
}
