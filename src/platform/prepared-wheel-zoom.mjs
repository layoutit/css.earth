import { projectSphereDrag } from "./sphere-drag.mjs";
import { WHEEL_ZOOM_SPEED_MULTIPLIER, WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER,
  WHEEL_ZOOM_USE_SCROLL_DISTANCE, wheelZoomInputKind } from "../../site/runtime-policy.mjs";

// Reference response from the isolated wheel-handler trace. The shared policy
// adds scroll-distance sensitivity; disabling it restores the timed response.
//
// Two wheel models share one controller. The scale camera zooms and holds the
// surface point under the cursor (the anchor). A perspective `dolly` moves
// the eye along its own axis toward the body's centre instead: each wheel
// event adds deltaY * stepPerDelta to the target log-distance, consumed
// evenly by the end of the same interval, and no surface anchor exists to
// hold, so the wheel never turns the scene. The dolly keeps its own prepared
// gain for every input kind; the shared scroll-distance multipliers belong to
// the scale camera's response.
export const PREPARED_WHEEL_ZOOM = Object.freeze({
  schema: "cssearth-prepared-wheel-zoom@1",
  intervalMilliseconds: 200,
  screenLogScalePerMillisecond: 0.00108,
  sourceFunctions: Object.freeze({
    wheelDispatch: "0x0090d752",
    cameraZoom: "0x0094a860",
    cameraStep: "0x005d1152",
  }),
});

export function createPreparedWheelZoomControls({
  inputSurface,
  camera,
  trackballMetrics,
  rotate,
  minimumZoom,
  maximumZoom,
  speedMultiplier = WHEEL_ZOOM_SPEED_MULTIPLIER,
  useScrollDistance = WHEEL_ZOOM_USE_SCROLL_DISTANCE,
  dolly = null,
  onError = null,
}) {
  if (!(inputSurface instanceof HTMLElement) ||
      typeof camera?.state !== "object" ||
      typeof trackballMetrics !== "function" || typeof rotate !== "function" ||
      ![minimumZoom, maximumZoom].every(Number.isFinite) ||
      minimumZoom <= 0 || maximumZoom < minimumZoom ||
      !Number.isFinite(speedMultiplier) || speedMultiplier <= 0 ||
      typeof useScrollDistance !== "boolean" ||
      (dolly !== null && !(dolly.stepPerDelta > 0)) ||
      (onError !== null && typeof onError !== "function")) {
    throw new TypeError("Prepared wheel zoom controls are invalid.");
  }
  const windowTarget = inputSurface.ownerDocument.defaultView;
  let disposed = false;
  const guard = callback => (...args) => {
    if (disposed) return;
    try { return callback(...args); } catch (error) {
      destroy();
      if (onError === null) throw error;
      onError(error);
    }
  };
  const requestFrame = callback => windowTarget.requestAnimationFrame(guard(callback));
  const cancelFrame = windowTarget.cancelAnimationFrame.bind(windowTarget);
  let enabled = true;
  let frame = null;
  let direction = 0;
  let expiresAt = 0;
  let previousTimestamp = null;
  let anchor = null;
  let targetZoom = null;
  let targetDistance = null;
  let inputKind = null;
  let previousInputTimestamp = -Infinity;
  let events = 0;
  let frames = 0;

  const stop = () => {
    if (frame !== null) cancelFrame(frame);
    frame = null;
    previousTimestamp = null;
    direction = 0;
    anchor = null;
    targetZoom = null;
    targetDistance = null;
  };
  const animate = timestamp => {
    if (previousTimestamp === null) previousTimestamp = timestamp;
    const remaining = expiresAt - previousTimestamp;
    const elapsed = Math.max(0, Math.min(
      timestamp - previousTimestamp,
      expiresAt - previousTimestamp,
    ));
    previousTimestamp = timestamp;
    if (elapsed > 0 && direction !== 0 && dolly !== null) {
      // The dolly: the outstanding log-distance, spread over the interval.
      const previousDistance = camera.state.distance;
      const distance = previousDistance * Math.exp(
        Math.log(targetDistance / previousDistance) * Math.min(1, elapsed / remaining));
      rotate({ controlPitchDelta: 0, controlYawDelta: 0, distance });
      if (disposed) return;
      frames += 1;
      // A clamped dolly drops what the bound refused.
      if (camera.state.distance !== distance) targetDistance = camera.state.distance;
    } else if (elapsed > 0 && direction !== 0) {
      const previousZoom = camera.state.zoom;
      const zoom = clamp(previousZoom * Math.exp(
        useScrollDistance
          ? Math.log(targetZoom / previousZoom) * Math.min(1, elapsed / remaining)
          : direction * PREPARED_WHEEL_ZOOM.screenLogScalePerMillisecond * speedMultiplier * elapsed,
      ), minimumZoom, maximumZoom);
      let rotation;
      if (anchor !== null && zoom !== previousZoom) {
        const trackball = trackballMetrics();
        const scale = zoom / previousZoom;
        rotation = direction < 0 ? zoomOutRayRotation(trackball, anchor, scale) : projectSphereDrag({
          ...trackball,
          radius: trackball.surfaceRadius,
          previousX: anchor.x,
          previousY: anchor.y,
          currentX: trackball.centerX +
            (anchor.x - trackball.centerX) / scale,
          currentY: trackball.centerY +
            (anchor.y - trackball.centerY) / scale,
        });
      }
      rotate({
        controlPitchDelta: 0,
        controlYawDelta: 0,
        zoom,
        ...(rotation === undefined ? {} : { rotation }),
      });
      if (disposed) return;
      frames += 1;
    }
    const continuing = dolly !== null
      ? timestamp < expiresAt && camera.state.distance !== targetDistance
      : timestamp < expiresAt && camera.state.zoom > minimumZoom &&
        camera.state.zoom < maximumZoom;
    if (continuing) {
      frame = requestFrame(animate);
    } else {
      frame = null;
      previousTimestamp = null;
    }
  };
  const onWheel = event => {
    if (!enabled || !Number.isFinite(event.deltaY) || event.deltaY === 0 || event.defaultPrevented) return;
    event.preventDefault();
    const nextDirection = -Math.sign(event.deltaY);
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2
      ? inputSurface.clientHeight || windowTarget.innerHeight || 800 : 1;
    if (dolly !== null) {
      inputKind = wheelZoomInputKind(event, inputKind, previousInputTimestamp);
      previousInputTimestamp = event.timeStamp;
      const origin = frame !== null && direction === nextDirection ? targetDistance : camera.state.distance;
      targetDistance = origin * Math.exp(event.deltaY * unit * dolly.stepPerDelta);
    } else if (useScrollDistance) {
      inputKind = wheelZoomInputKind(event, inputKind, previousInputTimestamp);
      previousInputTimestamp = event.timeStamp;
      const inputSpeed = inputKind === "wheel" ? WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER : speedMultiplier;
      const origin = frame !== null && direction === nextDirection ? targetZoom : camera.state.zoom;
      targetZoom = clamp(origin * Math.exp(-event.deltaY * unit / 100 *
        PREPARED_WHEEL_ZOOM.screenLogScalePerMillisecond * inputSpeed *
        PREPARED_WHEEL_ZOOM.intervalMilliseconds), minimumZoom, maximumZoom);
    }
    direction = nextDirection;
    // Native events may wait in Chromium's input queue longer than this
    // animation lasts. Use receipt time for motion; event time above still
    // classifies the device cadence.
    const receivedAt = windowTarget.performance.now();
    expiresAt = receivedAt + PREPARED_WHEEL_ZOOM.intervalMilliseconds;
    // A dolly has no surface anchor: the eye moves along its own axis.
    anchor = dolly === null ? { x:event.clientX, y:event.clientY } : null;
    events += 1;
    if (frame === null) {
      previousTimestamp = receivedAt;
      frame = requestFrame(animate);
    }
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
    update(options = {}) {
      if (disposed) return;
      if (options.wheel !== undefined) enabled = Boolean(options.wheel);
      if (!enabled) stop();
    },
    destroy,
    stats: () => Object.freeze({ active:frame !== null, events, frames, inputKind,
      model: dolly === null ? "scale-zoom-with-anchor" : "perspective-dolly" }),
  });
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

// Native zoom-out steers the viewing ray, while zoom-in holds the surface.
// Using the sphere tangent for both directions over-rotates zoom-out.
export function zoomOutRayRotation(trackball, anchor, scale) {
  const focal = trackball.focalLength;
  const distance = Math.hypot(1, focal / trackball.surfaceRadius);
  const nextDistance = Math.hypot(1, focal / (trackball.surfaceRadius * scale));
  const ratio = distance / nextDistance;
  const x = (anchor.x - trackball.centerX) / focal;
  const y = (anchor.y - trackball.centerY) / focal;
  const a = [x * ratio, y * ratio, 1], b = [x, y, 1];
  const aLength = Math.hypot(...a), bLength = Math.hypot(...b);
  const q = [a[1]-b[1], b[0]-a[0], a[0]*b[1]-a[1]*b[0],
    aLength*bLength+a[0]*b[0]+a[1]*b[1]+1];
  const length = Math.hypot(...q);
  return q.map(v => v / length);
}
