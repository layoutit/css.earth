import type { RuntimePolicy, WheelInputKind, WheelZoomInertia, WheelZoomPinch } from './runtime-policy.js';
import { opacityClockFor } from '../stars/opacity-clock.js';
import type { NavigationCamera, CameraDelta, ControlsUpdate } from './types.js';
export interface PreparedWheelZoomOptions { inputSurface: HTMLElement; runtimePolicy: RuntimePolicy; camera: NavigationCamera; rotate(delta: CameraDelta): void; speedMultiplier?: number; dolly: { stepPerDelta: number; minimumDistance?: () => number }; inertia?: WheelZoomInertia | null; inertiaInputKinds?: readonly WheelInputKind[]; onError?: ((error: unknown) => void) | null; }
export type PreparedWheelZoomControls = ReturnType<typeof createPreparedWheelZoomControls>;
// Each wheel event adds its magnitude and device gain to the target
// log-distance. The eye moves along its axis; wheel input never turns the scene.
export const PREPARED_WHEEL_ZOOM = Object.freeze({
  schema: "cssearth-prepared-wheel-zoom@1",
  intervalMilliseconds: 200,
  sourceFunctions: Object.freeze({
    wheelDispatch: "0x0090d752",
    cameraZoom: "0x0094a860",
    cameraStep: "0x005d1152",
  }),
});

/**
 * The distance a pinch moves the camera to. `fingerLogStep` is the natural log of the
 * finger-distance ratio; positive spreads the fingers and approaches. The pinch moves u,
 * the log distance left to the closest view plus one wheel notch (`notchLog`), so an
 * approach still arrives there at a finite pace and the closest view has room to pinch
 * out from. Near a body a full pinch keeps a fixed share of u; far out, where that share
 * would outgrow it, a fixed zoom.
 */
export function pinchTargetDistance(origin: number, closest: number, fingerLogStep: number,
  pinch: WheelZoomPinch, notchLog: number): number {
  // A restored observer inside the closest view pinches from where it stands.
  const floor = Math.min(closest, origin);
  const fullPinch = Math.log(pinch.fullPinchFingerRatio);
  const near = -Math.log(pinch.nearRemainingPerFullPinch) / fullPinch;
  const far = Math.log(pinch.farZoomPerFullPinch) / fullPinch;
  // Where the two rates meet: below it u decays, above it u falls at a fixed rate.
  const bend = far / near;
  let u = Math.log(origin / floor) + notchLog, left = Math.abs(fingerLogStep);
  if (fingerLogStep > 0) {
    if (u > bend) { const run = Math.min(left, (u - bend) / far); u -= run * far; left -= run; }
    u *= Math.exp(-near * left);
  } else {
    if (u < bend) { const run = Math.min(left, Math.log(bend / u) / near); u *= Math.exp(near * run); left -= run; }
    u += left * far;
  }
  return Math.max(floor, floor * Math.exp(u - notchLog));
}

export function createPreparedWheelZoomControls({
  inputSurface,
  runtimePolicy,
  camera,
  rotate,
  speedMultiplier = runtimePolicy.WHEEL_ZOOM_SPEED_MULTIPLIER,
  dolly,
  inertia = runtimePolicy.WHEEL_ZOOM_INERTIA,
  inertiaInputKinds = runtimePolicy.WHEEL_ZOOM_INERTIA_INPUT_KINDS,
  onError = null,
}: PreparedWheelZoomOptions) {
  const glidePolicy = inertia ?? null;
  const glideKinds = Object.freeze([...inertiaInputKinds]);
  if (!(inputSurface instanceof HTMLElement) ||
      typeof camera?.state !== "object" ||
      typeof rotate !== "function" ||
      !Number.isFinite(speedMultiplier) || speedMultiplier <= 0 ||
      !(dolly?.stepPerDelta > 0) ||
      (dolly.minimumDistance !== undefined && typeof dolly.minimumDistance !== "function") ||
      !(runtimePolicy.WHEEL_ZOOM_PINCH.wheelDeltaPerFingerLogStep > 0 &&
        runtimePolicy.WHEEL_ZOOM_PINCH.touchWheelDeltaPerFingerLogStep > 0 &&
        runtimePolicy.WHEEL_ZOOM_PINCH.fullPinchFingerRatio > 1 &&
        runtimePolicy.WHEEL_ZOOM_PINCH.nearRemainingPerFullPinch > 0 &&
        runtimePolicy.WHEEL_ZOOM_PINCH.nearRemainingPerFullPinch < 1 &&
        runtimePolicy.WHEEL_ZOOM_PINCH.farZoomPerFullPinch > 1) ||
      (glidePolicy !== null && !(glidePolicy.dampingSeconds > 0 && glidePolicy.gain > 0 &&
        glidePolicy.stopLogRatePerSecond > 0 &&
        glidePolicy.stopRateRatio > 0 && glidePolicy.stopRateRatio < 1)) ||
      !glideKinds.every(kind => kind === "wheel" || kind === "trackpad") ||
      (onError !== null && typeof onError !== "function")) {
    throw new TypeError("Prepared wheel zoom controls are invalid.");
  }
  const windowTarget = inputSurface.ownerDocument.defaultView;
  if (!windowTarget) throw new Error("Input document has no window.");
  let disposed = false;
  const guard = <Args extends unknown[], Result>(callback: (...args: Args) => Result) => (...args: Args) => {
    if (disposed) return;
    try { return callback(...args); } catch (error) {
      destroy();
      if (onError === null) throw error;
      onError(error);
    }
  };
  // The zoom glide moves the camera, so it belongs to the same input lane as a
  // thrown drag: one clock, and the glide always resolves before the publication
  // that reads its distance.
  const frameClock = opacityClockFor(windowTarget);
  const requestFrame = (callback: FrameRequestCallback) => frameClock.request(guard(callback), 'input');
  const cancelFrame = (id: number) => frameClock.cancel(id);
  let enabled = true;
  let inputKind: WheelInputKind | null = null;
  let previousInputTimestamp = -Infinity;
  let events = 0;
  let frames = 0;
  /**
   * What the wheel is doing to the camera: nothing, a dolly toward a commanded distance until its interval expires,
   * or a glide on the rate the released gesture was travelling at. Rates are log units per millisecond, signed:
   * negative approaches.
   */
  type Motion =
    | { readonly kind: 'idle' }
    | { readonly kind: 'dolly'; frame: number; previousTimestamp: number | null; targetDistance: number; expiresAt: number }
    | { readonly kind: 'glide'; frame: number | null; rate: number; readonly releasedRate: number; previous: number };
  const IDLE: Motion = Object.freeze({ kind: 'idle' });
  let motion: Motion = IDLE;
  // The gesture behind the motion: its direction and the rate the camera actually travelled at. Seeding the glide
  // from the camera rather than from the commanded target keeps the release continuous: a short gesture commands
  // far more than it has run. Both outlive a dolly that ends without a glide (trackpad input does not glide), so a
  // wheel notch that follows in the same direction releases from the speed the camera was already travelling at;
  // a reversal or a stop resets them.
  let direction = 0, travelRate = 0;

  const cancelMotion = () => {
    if (motion.kind !== 'idle' && motion.frame !== null) cancelFrame(motion.frame);
    motion = IDLE;
  };
  const stop = () => {
    cancelMotion();
    direction = 0;
    travelRate = 0;
  };
  // The camera's own recent speed, averaged over the frames it just travelled.
  const recordTravel = (ratio: number, elapsed: number) => {
    if (!(elapsed > 0) || !(ratio > 0)) return;
    const applied = Math.log(ratio) / elapsed;
    travelRate = travelRate === 0 ? applied : travelRate * .6 + applied * .4;
  };
  // The released gesture keeps its rate and decays it toward zero. The wheel
  // commands log-distance, so the glide is exponential in the gesture's own
  // units; a bound, a new event or a stop ends it at once.
  const glide = (timestamp: number) => {
    const current = motion;
    if (current.kind !== 'glide') return;
    if (glidePolicy === null) { motion = IDLE; return; }
    const step = Math.max(0, timestamp - current.previous);
    current.previous = timestamp;
    current.rate *= Math.max(0, 1 - step / (glidePolicy.dampingSeconds * 1000));
    if (step > 0 && current.rate !== 0) {
      const distance = camera.state.distance * Math.exp(current.rate * step);
      rotate({ controlPitchDelta: 0, controlYawDelta: 0, distance });
      if (disposed || motion !== current) return;
      frames += 1;
      // A bound refused the step: the glide has nowhere left to travel.
      if (camera.state.distance !== distance) current.rate = 0;
    }
    // A glide ends when its own motion stops being visible, not when it falls to
    // a share of whatever rate released it: an eye reads distance change per frame,
    // so the absolute floor is what keeps the strongest gestures from snapping and
    // the gentlest from drifting invisibly. The ratio bounds an extreme fling.
    const stopRate = Math.max(glidePolicy.stopLogRatePerSecond / 1000,
      Math.abs(current.releasedRate) * glidePolicy.stopRateRatio);
    if (Math.abs(current.rate) > stopRate) {
      current.frame = requestFrame(glide);
    } else {
      motion = IDLE;
      direction = 0;
    }
  };
  const animate = (timestamp: number) => {
    const dolly = motion;
    if (dolly.kind !== 'dolly') return;
    if (dolly.previousTimestamp === null) dolly.previousTimestamp = timestamp;
    const previousTimestamp = dolly.previousTimestamp;
    const remaining = dolly.expiresAt - previousTimestamp;
    const elapsed = Math.max(0, Math.min(
      timestamp - previousTimestamp,
      dolly.expiresAt - previousTimestamp,
    ));
    // The commanded interval rarely ends on a frame boundary. Whatever is left
    // of this frame belongs to the glide, so the released gesture keeps moving
    // at its own rate instead of showing one short step at the handoff.
    const leftover = Math.max(0, timestamp - previousTimestamp - elapsed);
    dolly.previousTimestamp = timestamp;
    if (elapsed > 0 && direction !== 0) {
      // The dolly: the outstanding log-distance, spread over the interval.
      const previousDistance = camera.state.distance;
      const distance = previousDistance * Math.exp(
        Math.log(dolly.targetDistance / previousDistance) * Math.min(1, elapsed / remaining));
      rotate({ controlPitchDelta: 0, controlYawDelta: 0, distance });
      if (disposed || motion !== dolly) return;
      frames += 1;
      recordTravel(camera.state.distance / previousDistance, elapsed);
      // A clamped dolly drops what the bound refused.
      if (camera.state.distance !== distance) dolly.targetDistance = camera.state.distance;
    }
    const continuing = timestamp < dolly.expiresAt && camera.state.distance !== dolly.targetDistance;
    if (continuing) {
      dolly.frame = requestFrame(animate);
      return;
    }
    // The commanded interval is spent. A gesture still carrying rate releases
    // into its glide instead of stopping dead at the target.
    if (glidePolicy !== null && direction !== 0 && travelRate !== 0 &&
        (inputKind === null || glideKinds.includes(inputKind))) {
      const releasedRate = travelRate * glidePolicy.gain;
      travelRate = 0;
      const gliding: Extract<Motion, { kind: 'glide' }> = { kind: 'glide', frame: null, rate: releasedRate, releasedRate, previous: timestamp - leftover };
      motion = gliding;
      if (leftover > 0) { glide(timestamp); return; }
      gliding.frame = requestFrame(glide);
      return;
    }
    motion = IDLE;
  };
  const onWheel = (event: WheelEvent) => {
    if (!enabled || !Number.isFinite(event.deltaY) || event.deltaY === 0 || event.defaultPrevented) return;
    event.preventDefault();
    // A new gesture owns the camera: any glide ends where it stands.
    if (motion.kind === 'glide') {
      cancelMotion();
      travelRate = 0;
    }
    const nextDirection = -Math.sign(event.deltaY);
    // A reversal has nothing in common with the travel behind it.
    if (direction !== 0 && nextDirection !== direction) travelRate = 0;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2
      ? inputSurface.clientHeight || windowTarget.innerHeight || 800 : 1;
    inputKind = runtimePolicy.wheelZoomInputKind(event, inputKind, previousInputTimestamp);
    previousInputTimestamp = event.timeStamp;
    const origin = motion.kind === 'dolly' && direction === nextDirection ? motion.targetDistance : camera.state.distance;
    // A pinch is a ctrlKey wheel. It moves by its own rule once the camera names its closest view.
    const closest = event.ctrlKey ? dolly.minimumDistance?.() : undefined;
    const pinch = runtimePolicy.WHEEL_ZOOM_PINCH;
    const inputSpeed = inputKind === "wheel" ? runtimePolicy.WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER : speedMultiplier;
    const targetDistance = closest !== undefined && Number.isFinite(closest) && closest > 0
      ? pinchTargetDistance(origin, closest, -event.deltaY * unit / pinch.wheelDeltaPerFingerLogStep, pinch,
        dolly.stepPerDelta * 100)
      : origin * Math.exp(event.deltaY * unit * dolly.stepPerDelta * inputSpeed);
    direction = nextDirection;
    const expiresAt = event.timeStamp + PREPARED_WHEEL_ZOOM.intervalMilliseconds;
    events += 1;
    // A running dolly takes the new command; otherwise a dolly starts from this event.
    if (motion.kind === 'dolly') { motion.targetDistance = targetDistance; motion.expiresAt = expiresAt; }
    else motion = { kind: 'dolly', frame: requestFrame(animate), previousTimestamp: event.timeStamp, targetDistance, expiresAt };
  };
  const guardedWheel = guard(onWheel);
  inputSurface.addEventListener("wheel", guardedWheel, { passive:false });
  function destroy() {
    if (disposed) return;
    disposed = true;
    stop();
    inputSurface.removeEventListener("wheel", guardedWheel);
  }
  return Object.freeze({
    stop,
    update(options: ControlsUpdate = {}) {
      if (disposed) return;
      if (options.wheel !== undefined) enabled = Boolean(options.wheel);
      if (!enabled) stop();
    },
    destroy,
    stats: () => Object.freeze({ active: motion.kind !== 'idle', gliding: motion.kind === 'glide', events, frames, inputKind,
      model: "perspective-dolly" }),
  });
}
