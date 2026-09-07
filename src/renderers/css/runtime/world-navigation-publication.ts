import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import type { ObjectWorldNavigationListener } from './world-navigation-types.js';

export function createWorldNavigationPublicationHub(onError: (error: unknown) => void) {
  const listeners = new Set<ObjectWorldNavigationListener>();
  let latest: readonly [WorldCameraPose, WorldCameraViewport] | null = null;
  let disposed = false;
  return Object.freeze({
    publish(world: WorldCameraPose, viewport: WorldCameraViewport) {
      if (disposed) return;
      if (latest && samePublication(latest[0], latest[1], world, viewport)) return;
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

function samePublication(a: WorldCameraPose, av: WorldCameraViewport, b: WorldCameraPose, bv: WorldCameraViewport) {
  return a.referenceFrame === b.referenceFrame && a.epochJdTt === b.epochJdTt &&
    a.pose.positionM.every((value, axis) => value === b.pose.positionM[axis]) &&
    a.pose.orientationXyzw.every((value, axis) => value === b.pose.orientationXyzw[axis]) &&
    av.focalPixels === bv.focalPixels && av.widthPixels === bv.widthPixels && av.heightPixels === bv.heightPixels &&
    av.principalOffsetPixels[0] === bv.principalOffsetPixels[0] && av.principalOffsetPixels[1] === bv.principalOffsetPixels[1];
}
