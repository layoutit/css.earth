import { createSceneLifetime } from "@cssearth/engine";
import { createUnboundedMatrixDragControls as createMatrixDragControls } from './camera-input.js';
import { createPreparedWheelZoomControls as createWheelZoomControls } from './prepared-wheel-zoom.js';
import { interactionTrackball, directAngularDegreesPerTrackballRadius, directPitchResponseForZoom } from "@cssearth/engine";
import { errorMessage } from './types.js';
import type { RuntimePolicy } from './runtime-policy.js';
import type { NavigationCamera, TrackballMetrics, CameraDelta, ControlsUpdate } from './types.js';
export interface ObjectInteractionOptions { inputSurface: HTMLElement; cameraMotion: import('./camera-motion.js').CameraMotion; runtimePolicy: RuntimePolicy; camera: NavigationCamera; trackballMetrics(): TrackballMetrics; sceneMatrix(): string; rotate(delta: CameraDelta, signal?: AbortSignal): void | Promise<boolean>; minimumZoom: number; maximumZoom: number; dolly: { stepPerDelta: number }; surfaceFlyToHitTest?: ((clientX: number, clientY: number) => boolean) | null; onStart(): void; onEnd(): void; onError?: ((error: unknown) => void) | null; }
export interface InteractionServices { createUnboundedMatrixDragControls?: typeof createMatrixDragControls; createPreparedWheelZoomControls?: typeof createWheelZoomControls; }
export function createObjectInteractionControls({
  inputSurface,
  cameraMotion,
  runtimePolicy,
  camera,
  trackballMetrics,
  sceneMatrix,
  rotate,
  minimumZoom,
  maximumZoom,
  dolly,
  surfaceFlyToHitTest = null,
  onStart,
  onEnd,
  onError = null,
}: ObjectInteractionOptions, services: InteractionServices = {}) {
  const { createUnboundedMatrixDragControls: createUnboundedMatrixDragControls = createMatrixDragControls, createPreparedWheelZoomControls: createPreparedWheelZoomControls = createWheelZoomControls } = services;
  if (typeof sceneMatrix !== "function") {
    throw new TypeError("Object interaction controls require the current scene matrix.");
  }
  const lifetime = createSceneLifetime();
  const fail = (error: unknown) => {
    const cleanup = lifetime.destroy();
    const failure = cleanup.length ? new AggregateError([error, ...cleanup], errorMessage(error), { cause:error }) : error;
    if (onError === null) throw failure;
    onError(failure);
  };
  try {
  const interactionTrackballMetrics = () =>
    interactionTrackball(trackballMetrics());
  const dragControls = createUnboundedMatrixDragControls({
    inputSurface,
    cameraMotion,
    runtimePolicy,
    onError: fail,
    trackballMetrics: () => Object.freeze({
      ...interactionTrackballMetrics(),
      angularDegreesPerTrackballRadius:
        directAngularDegreesPerTrackballRadius(camera.state.zoom),
      pitchResponse: directPitchResponseForZoom(camera.state.zoom),
    }),
    flyToTrackballMetrics: () => Object.freeze({
      ...interactionTrackballMetrics(),
      sceneMatrix: sceneMatrix(),
    }),
    surfaceFlyToState: () => Object.freeze({
      zoom: camera.state.zoom,
      minimumZoom,
      maximumZoom,
    }),
    surfaceFlyToHitTest,
    onPointerStart: () => wheelControls.stop(),
    onStart,
    onEnd,
    rotate,
  });
  lifetime.onDispose(() => dragControls.destroy());
  // The motion observer must receive each wheel event before zoom starts.
  const wheelControls = createPreparedWheelZoomControls({
    inputSurface,
    runtimePolicy,
    onError: fail,
    camera,
    rotate(delta) {
      rotate(delta);
      // Measure the changed camera only if a held pointer moves again.
      dragControls.invalidateTrackball();
    },
    dolly,
  });
  lifetime.onDispose(() => wheelControls.destroy());
  return Object.freeze({
    update(options: ControlsUpdate) {
      if (lifetime.disposed) return;
      wheelControls.update(options);
      dragControls.update(options);
    },
    stop() {
      wheelControls.stop();
      dragControls.stop();
    },
    stats: () => Object.freeze({
      ...dragControls.stats(),
      wheelZoom: wheelControls.stats(),
    }),
    destroy() {
      const errors = lifetime.destroy();
      if (errors.length) throw new AggregateError(errors, "Object input cleanup failed.");
    },
  });
  } catch (error) {
    const cleanup = lifetime.destroy();
    if (cleanup.length) throw new AggregateError([error, ...cleanup], errorMessage(error), { cause:error });
    throw error;
  }
}
