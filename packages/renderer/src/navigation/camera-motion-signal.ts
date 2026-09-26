/**
 * Whether the camera moves, and whether it coasts, per input surface. A hand or the app drives it (a drag, a wheel or
 * pinch zoom, a surface fly-to); released, it coasts on inertia (a drag's throw, a zoom's glide). Each source reports its
 * own start and end. Every change is announced once as `objectmotionchange` `{ active, coasting }`, bubbling from the
 * input surface, and to subscribers.
 *
 * It exists for the runtime contract's inertia gate (docs/performance/motion-freezes-membership.md): while the camera
 * coasts nobody is steering, so retained DOM changes only transform and opacity and membership waits for the coast to
 * stop; driven motion keeps the view live.
 */
export type CameraMotionSource = 'drag' | 'inertia' | 'zoom' | 'glide' | 'fly-to';
export interface CameraMotionState { readonly active: boolean; readonly coasting: boolean }

export interface CameraMotionSignal extends CameraMotionState {
  begin(source: CameraMotionSource): void;
  end(source: CameraMotionSource): void;
  /** Called with every change; returns the unsubscribe. */
  subscribe(listener: (state: CameraMotionState) => void): () => void;
}

const COASTING: ReadonlySet<CameraMotionSource> = new Set(['inertia', 'glide']);
const signals = new WeakMap<EventTarget, CameraMotionSignal>();

/** The one motion signal of an input surface, shared by every input owner and publisher that reads it. */
export function cameraMotionSignalFor(inputSurface: EventTarget): CameraMotionSignal {
  const existing = signals.get(inputSurface);
  if (existing) return existing;
  const sources = new Set<CameraMotionSource>(), listeners = new Set<(state: CameraMotionState) => void>();
  // Coasting is inertia with no hand on the camera: a drag or zoom that takes over steers again.
  const read = (): CameraMotionState => ({ active: sources.size > 0,
    coasting: [...sources].some(source => COASTING.has(source)) && ![...sources].some(source => !COASTING.has(source)) });
  let announced = read();
  const change = () => {
    const state = read();
    if (state.active === announced.active && state.coasting === announced.coasting) return;
    announced = state;
    for (const listener of [...listeners]) listener(state);
    inputSurface.dispatchEvent(new CustomEvent('objectmotionchange', { bubbles: true, detail: state }));
  };
  const signal: CameraMotionSignal = Object.freeze({
    get active() { return announced.active; },
    get coasting() { return announced.coasting; },
    begin(source: CameraMotionSource) { if (!sources.has(source)) { sources.add(source); change(); } },
    end(source: CameraMotionSource) { if (sources.delete(source)) change(); },
    subscribe(listener: (state: CameraMotionState) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  });
  signals.set(inputSurface, signal);
  return signal;
}
