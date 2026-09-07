import { GOOGLE_EARTH_DRAG_INERTIA } from "@cssearth/engine";
import { GOOGLE_EARTH_SURFACE_FLY_TO } from './google-earth-surface-fly-to.js';
export type ActiveMode = 'idle' | 'drag' | 'inertia' | 'fly-to';
export type InterruptionMode = 'drag' | 'pointer' | 'wheel' | 'fly-to' | 'programmatic' | 'disabled' | 'destroy';
interface DragDiagnostics {
  skyGesture: boolean; pointerActive: boolean; inertiaActive: boolean; flyToActive: boolean;
  destinationActive: boolean; surfaceFlyToEnabled: boolean; activeMode: ActiveMode; pointerDragging: boolean;
  inertiaStarts: number; inertiaFrames: number; inertiaCancels: number; pointerCancels: number;
  interruptionCounts: Record<InterruptionMode, number>; lastInterruption: { from: ActiveMode; to: InterruptionMode } | null;
  flyToStarts: number; flyToFrames: number; flyToCompletions: number; flyToCancels: number;
  destinationFlight: { starts: number; frames: number; completions: number; cancels: number };
}
export function dragControlDiagnostics({ skyGesture, pointerActive, inertiaActive, flyToActive, destinationActive, surfaceFlyToEnabled, activeMode, pointerDragging, inertiaStarts, inertiaFrames, inertiaCancels, pointerCancels, interruptionCounts, lastInterruption, flyToStarts, flyToFrames, flyToCompletions, flyToCancels, destinationFlight }: DragDiagnostics) {
      return Object.freeze({
        schema: GOOGLE_EARTH_DRAG_INERTIA.schema,
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
          schema: GOOGLE_EARTH_SURFACE_FLY_TO.schema,
          qualification: GOOGLE_EARTH_SURFACE_FLY_TO.qualification,
          enabled: surfaceFlyToEnabled,
          active: flyToActive && !destinationActive,
          starts: flyToStarts,
          frames: flyToFrames,
          completions: flyToCompletions,
          cancels: flyToCancels,
        }),
        destinationFlyTo: Object.freeze({ ...destinationFlight, active: destinationActive }),
      });
}
