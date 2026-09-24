import type { RuntimePolicy, WheelInputKind, WheelZoomInertia } from './runtime-policy.js';
import { createOpacityClock } from '../stars/opacity-clock.js';
import type { NavigationCamera, CameraDelta, ControlsUpdate } from './types.js';
export interface PreparedWheelZoomOptions { inputSurface: HTMLElement; runtimePolicy: RuntimePolicy; camera: NavigationCamera; rotate(delta: CameraDelta): void; speedMultiplier?: number; dolly: { stepPerDelta: number }; inertia?: WheelZoomInertia | null; inertiaInputKinds?: readonly WheelInputKind[]; onError?: ((error: unknown) => void) | null; }
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
  const frameClock = createOpacityClock(windowTarget);
  const requestFrame = (callback: FrameRequestCallback) => frameClock.request(guard(callback), 'input');
  const cancelFrame = (id: number) => frameClock.cancel(id);
  let enabled = true;
  let frame: number | null = null;
  let direction = 0;
  let expiresAt = 0;
  let previousTimestamp: number | null = null;
  let targetDistance: number | null = null;
  let inputKind: WheelInputKind | null = null;
  let previousInputTimestamp = -Infinity;
  let events = 0;
  let frames = 0;
  // The rate the camera is actually travelling at, in log units per millisecond,
  // and the glide it is released into. Both are signed: negative approaches.
  // Seeding from the camera rather than from the commanded target keeps the
  // release continuous: a short gesture commands far more than it has run.
  let travelRate = 0;
  let gliding = false, glideRate = 0, releasedRate = 0, glidePrevious = 0;

  const stop = () => {
    if (frame !== null) cancelFrame(frame);
    frame = null;
    previousTimestamp = null;
    direction = 0;
    targetDistance = null;
    gliding = false;
    glideRate = 0;
    releasedRate = 0;
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
    if (glidePolicy === null) { frame = null; gliding = false; return; }
    const step = Math.max(0, timestamp - glidePrevious);
    glidePrevious = timestamp;
    glideRate *= Math.max(0, 1 - step / (glidePolicy.dampingSeconds * 1000));
    if (step > 0 && glideRate !== 0) {
      const distance = camera.state.distance * Math.exp(glideRate * step);
      rotate({ controlPitchDelta: 0, controlYawDelta: 0, distance });
      if (disposed) return;
      frames += 1;
      // A bound refused the step: the glide has nowhere left to travel.
      if (camera.state.distance !== distance) glideRate = 0;
    }
    // A glide ends when its own motion stops being visible, not when it falls to
    // a share of whatever rate released it: an eye reads distance change per frame,
    // so the absolute floor is what keeps the strongest gestures from snapping and
    // the gentlest from drifting invisibly. The ratio bounds an extreme fling.
    const stopRate = Math.max(glidePolicy.stopLogRatePerSecond / 1000,
      Math.abs(releasedRate) * glidePolicy.stopRateRatio);
    if (Math.abs(glideRate) > stopRate) {
      frame = requestFrame(glide);
    } else {
      frame = null;
      previousTimestamp = null;
      direction = 0;
      gliding = false;
      glideRate = 0;
    }
  };
  const animate = (timestamp: number) => {
    if (previousTimestamp === null) previousTimestamp = timestamp;
    const remaining = expiresAt - previousTimestamp;
    const elapsed = Math.max(0, Math.min(
      timestamp - previousTimestamp,
      expiresAt - previousTimestamp,
    ));
    // The commanded interval rarely ends on a frame boundary. Whatever is left
    // of this frame belongs to the glide, so the released gesture keeps moving
    // at its own rate instead of showing one short step at the handoff.
    const leftover = Math.max(0, timestamp - previousTimestamp - elapsed);
    previousTimestamp = timestamp;
    if (elapsed > 0 && direction !== 0) {
      // The dolly: the outstanding log-distance, spread over the interval.
      const previousDistance = camera.state.distance;
      const distance = previousDistance * Math.exp(
        Math.log(targetDistance! / previousDistance) * Math.min(1, elapsed / remaining));
      rotate({ controlPitchDelta: 0, controlYawDelta: 0, distance });
      if (disposed) return;
      frames += 1;
      recordTravel(camera.state.distance / previousDistance, elapsed);
      // A clamped dolly drops what the bound refused.
      if (camera.state.distance !== distance) targetDistance = camera.state.distance;
    }
    const continuing = timestamp < expiresAt && camera.state.distance !== targetDistance;
    if (continuing) {
      frame = requestFrame(animate);
      return;
    }
    // The commanded interval is spent. A gesture still carrying rate releases
    // into its glide instead of stopping dead at the target.
    if (glidePolicy !== null && direction !== 0 && travelRate !== 0 &&
        (inputKind === null || glideKinds.includes(inputKind))) {
      releasedRate = travelRate * glidePolicy.gain;
      glideRate = releasedRate;
      glidePrevious = timestamp - leftover;
      travelRate = 0;
      gliding = true;
      if (leftover > 0) { glide(timestamp); return; }
      frame = requestFrame(glide);
      return;
    }
    frame = null;
    previousTimestamp = null;
  };
  const onWheel = (event: WheelEvent) => {
    if (!enabled || !Number.isFinite(event.deltaY) || event.deltaY === 0 || event.defaultPrevented) return;
    event.preventDefault();
    // A new gesture owns the camera: any glide ends where it stands.
    if (gliding) {
      if (frame !== null) cancelFrame(frame);
      frame = null;
      gliding = false;
      glideRate = 0;
      releasedRate = 0;
      previousTimestamp = null;
      travelRate = 0;
    }
    const nextDirection = -Math.sign(event.deltaY);
    // A reversal has nothing in common with the travel behind it.
    if (direction !== 0 && nextDirection !== direction) travelRate = 0;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2
      ? inputSurface.clientHeight || windowTarget.innerHeight || 800 : 1;
    inputKind = runtimePolicy.wheelZoomInputKind(event, inputKind, previousInputTimestamp);
    previousInputTimestamp = event.timeStamp;
    const origin = frame !== null && direction === nextDirection ? targetDistance! : camera.state.distance;
    const inputSpeed = inputKind === "wheel" ? runtimePolicy.WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER
      : event.ctrlKey ? runtimePolicy.WHEEL_ZOOM_PINCH_SPEED_MULTIPLIER : speedMultiplier;
    targetDistance = origin * Math.exp(event.deltaY * unit * dolly.stepPerDelta * inputSpeed);
    direction = nextDirection;
    expiresAt = event.timeStamp + PREPARED_WHEEL_ZOOM.intervalMilliseconds;
    events += 1;
    if (frame === null) {
      previousTimestamp = event.timeStamp;
      frame = requestFrame(animate);
    }
  };
  const guardedWheel = guard(onWheel);
  inputSurface.addEventListener("wheel", guardedWheel, { passive:false });
  function destroy() {
    if (disposed) return;
    disposed = true;
    stop();
    frameClock.destroy();
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
    stats: () => Object.freeze({ active:frame !== null, gliding, events, frames, inputKind,
      model: "perspective-dolly" }),
  });
}
