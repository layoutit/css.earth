import { projectSphereDrag } from "./sphere-drag.mjs";

// Fixed by the isolated wheel-handler trace and its rendered frame sequence.
// A wheel event selects a direction and extends one 200 ms motion interval;
// event magnitude does not multiply the velocity.
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
  onError = null,
}) {
  if (!(inputSurface instanceof HTMLElement) ||
      typeof camera?.state !== "object" ||
      typeof trackballMetrics !== "function" || typeof rotate !== "function" ||
      ![minimumZoom, maximumZoom].every(Number.isFinite) ||
      minimumZoom <= 0 || maximumZoom < minimumZoom ||
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
  let events = 0;
  let frames = 0;

  const stop = () => {
    if (frame !== null) cancelFrame(frame);
    frame = null;
    previousTimestamp = null;
    direction = 0;
    anchor = null;
  };
  const animate = timestamp => {
    if (previousTimestamp === null) previousTimestamp = timestamp;
    const elapsed = Math.max(0, Math.min(
      timestamp - previousTimestamp,
      expiresAt - previousTimestamp,
    ));
    previousTimestamp = timestamp;
    if (elapsed > 0 && direction !== 0) {
      const previousZoom = camera.state.zoom;
      const zoom = clamp(previousZoom * Math.exp(
        direction * PREPARED_WHEEL_ZOOM.screenLogScalePerMillisecond * elapsed,
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
    if (timestamp < expiresAt && camera.state.zoom > minimumZoom &&
        camera.state.zoom < maximumZoom) {
      frame = requestFrame(animate);
    } else {
      frame = null;
      previousTimestamp = null;
    }
  };
  const onWheel = event => {
    if (!enabled || event.deltaY === 0 || event.defaultPrevented) return;
    event.preventDefault();
    direction = -Math.sign(event.deltaY);
    expiresAt = event.timeStamp + PREPARED_WHEEL_ZOOM.intervalMilliseconds;
    anchor = { x:event.clientX, y:event.clientY };
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
    stats: () => Object.freeze({ active:frame !== null, events, frames }),
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
