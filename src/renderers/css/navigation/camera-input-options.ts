import type { RuntimePolicy } from './runtime-policy.js';
import type { TrackballMetrics, CameraDelta } from './types.js';
export interface MatrixDragControlsOptions { inputSurface: HTMLElement; runtimePolicy: RuntimePolicy; trackballMetrics(): TrackballMetrics; flyToTrackballMetrics?: () => TrackballMetrics; rotate(delta: CameraDelta): void; surfaceFlyToState?: (() => { zoom: number; minimumZoom: number; maximumZoom: number }) | null; surfaceFlyToHitTest?: ((clientX: number, clientY: number) => boolean) | null; onPointerStart?: () => void; onStart?: () => void; onEnd?: () => void; onError?: ((error: unknown) => void) | null; }
export function validateDragControlsOptions({ inputSurface, trackballMetrics, flyToTrackballMetrics,
  rotate, surfaceFlyToState, surfaceFlyToHitTest, onPointerStart, onStart, onEnd, onError }: MatrixDragControlsOptions): void {
  if (!(inputSurface instanceof HTMLElement) ||
      typeof trackballMetrics !== "function" ||
      typeof flyToTrackballMetrics !== "function" ||
      typeof rotate !== "function" ||
      (surfaceFlyToState !== null &&
        typeof surfaceFlyToState !== "function") ||
      (surfaceFlyToHitTest != null && typeof surfaceFlyToHitTest !== "function") ||
      typeof onPointerStart !== "function" ||
      typeof onStart !== "function" || typeof onEnd !== "function" ||
      (onError !== null && typeof onError !== "function")) {
    throw new TypeError("Unbounded matrix drag controls are invalid.");
  }
}
