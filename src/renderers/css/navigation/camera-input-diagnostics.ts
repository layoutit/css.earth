import { TRACKBALL_DRAG_INERTIA } from "@cssearth/engine";
import { SURFACE_FLY_TO } from './surface-fly-to.js';
export type ActiveMode = 'idle' | 'drag' | 'inertia' | 'fly-to';
export type InterruptionMode = 'drag' | 'pointer' | 'wheel' | 'fly-to' | 'programmatic' | 'disabled' | 'destroy';
interface DragDiagnostics {
  skyGesture: boolean; pointerActive: boolean; inertiaActive: boolean; flyToActive: boolean;
  surfaceFlyToEnabled: boolean; activeMode: ActiveMode; pointerDragging: boolean;
  inertiaStarts: number; inertiaFrames: number; inertiaCancels: number; pointerCancels: number;
  interruptionCounts: Record<InterruptionMode, number>; lastInterruption: { from: ActiveMode; to: InterruptionMode } | null;
  flyToStarts: number; flyToFrames: number; flyToCompletions: number; flyToCancels: number;
}
export function dragControlDiagnostics({ skyGesture, pointerActive, inertiaActive, flyToActive, surfaceFlyToEnabled, activeMode, pointerDragging, inertiaStarts, inertiaFrames, inertiaCancels, pointerCancels, interruptionCounts, lastInterruption, flyToStarts, flyToFrames, flyToCompletions, flyToCancels }: DragDiagnostics) {
      return Object.freeze({
        schema: TRACKBALL_DRAG_INERTIA.schema,
        projection: skyGesture && (pointerActive || inertiaActive)
          ? "screen-plane-orbit" : "screen-space-sphere",
        historyStorage: "fixed-capacity-float64-ring",
        activeMode,
        activeMotionCount:
          Number(pointerDragging) + Number(inertiaActive) +
          Number(flyToActive),
        pendingPointer: pointerActive && !pointerDragging,
        active: inertiaActive,
        starts: inertiaStarts,
        frames: inertiaFrames,
        cancels: inertiaCancels,
        pointerCancels,
        interruptions: Object.freeze({ ...interruptionCounts }),
        lastInterruption,
        surfaceFlyTo: Object.freeze({
          schema: SURFACE_FLY_TO.schema,
          qualification: SURFACE_FLY_TO.qualification,
          enabled: surfaceFlyToEnabled,
          active: flyToActive,
          starts: flyToStarts,
          frames: flyToFrames,
          completions: flyToCompletions,
          cancels: flyToCancels,
        }),
      });
}
