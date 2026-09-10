export const MOBILE_VIEWPORT_MAX = 820;
export const DESKTOP_VIEWPORT_MIN = MOBILE_VIEWPORT_MAX + 1;
export const MOBILE_VIEWPORT_QUERY =
  `(max-width: ${MOBILE_VIEWPORT_MAX}px), (orientation: portrait)`;
export const MOBILE_TOUCH_ACTION = "pan-y";
export { CANONICAL_PREPARED_IMAGE_DENSITY } from "../src/platform/prepared-object-assets.mjs";
export const SKYBOX_DRAG_ENABLED = true;
export const CENTER_SELECTION_DURATION_SECONDS = 0.35;
export const WHEEL_ZOOM_SPEED_MULTIPLIER = 4;
export const WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER = 1;
export const WHEEL_ZOOM_USE_SCROLL_DISTANCE = true;

export const CONTEXT_ANNOTATION_PRIORITY = Object.freeze({
  planet: 3,
  'dwarf-planet': 2,
  comet: 1,
  asteroid: 0,
  'trans-neptunian': 1,
});

// Initial system framing follows the larger moons; small distant satellites
// remain available without forcing the main moon system into a few pixels.
export const SYSTEM_FRAMING_MIN_MOON_RADIUS_SHARE = 0.2;
export const SYSTEM_FRAMING_PADDING_PIXELS = 48;
// Prepare oriented bounds for each system. Runtime projects those bounds
// at the current viewing angle to fit the complete primary orbits.
export const SYSTEM_FRAMING_ANGLES = Object.freeze({
  elevationsDegrees: Object.freeze([30, 45, 60]),
  azimuthStepDegrees: 15,
});

// Leave a body only once the observer has reached the scale of its orbit.
// A much larger Sun disc is required to show its card again on approach.
export const OVERVIEW_SELECTION_POLICY = Object.freeze({
  orbitDistanceFactor: 1.5,
  minimumDistanceRadii: 128,
  enterSunDiameterPixels: 48,
  centerRadiusPixels: 160,
  settleMilliseconds: 180,
});

export function sceneCursor({ surface, pressed, enabled }) {
  if (!enabled) return "";
  if (pressed) return "grabbing";
  return surface ? "grab" : "crosshair";
}

// WheelEvent has no device type. Infer discrete steps from line/page units or
// coarse pixel steps; keep accelerated packets on the current precision gesture.
export function wheelZoomInputKind(event, previousKind = null, previousTimestamp = -Infinity) {
  if (event.deltaMode === 1 || event.deltaMode === 2) return "wheel";
  if (event.ctrlKey || event.deltaX) return "trackpad";
  const magnitude = Math.abs(event.deltaY);
  // Some desktop wheel drivers emit this fractional pixel quantum per notch.
  const wheelQuantum = 4.000244140625;
  if (magnitude >= wheelQuantum &&
      Math.abs(magnitude / wheelQuantum - Math.round(magnitude / wheelQuantum)) < 1e-6) return "wheel";
  if (magnitude < 40 || !Number.isInteger(magnitude)) return "trackpad";
  if (previousKind === "trackpad" && event.timeStamp >= previousTimestamp &&
      event.timeStamp - previousTimestamp < 400) return "trackpad";
  return "wheel";
}

export function automaticPlaybackPolicy({ sceneState, motionRequested, documentHidden, reducedMotion }) {
  const reason = sceneState !== "ready" ? "unavailable"
    : !motionRequested ? "motion-off"
      : documentHidden ? "hidden"
        : reducedMotion ? "reduced-motion" : "allowed";
  return Object.freeze({ allowed: reason === "allowed", reason });
}

export function bindResponsiveOrbitPolicy({ controls, inputSurface, mediaQuery, onError = null }) {
  if (typeof controls?.update !== "function" ||
      typeof inputSurface?.style?.removeProperty !== "function" ||
      typeof mediaQuery?.addEventListener !== "function" ||
      (onError !== null && typeof onError !== "function")) {
    throw new TypeError("Responsive orbit policy requires controls, input, and media query.");
  }
  let destroyed = false;
  const sync = () => {
    if (destroyed) return;
    controls.update({ wheel: !mediaQuery.matches });
    if (mediaQuery.matches) {
      inputSurface.style.touchAction = MOBILE_TOUCH_ACTION;
    } else {
      inputSurface.style.removeProperty("touch-action");
    }
  };
  const onChange = () => {
    try { sync(); } catch (error) {
      if (onError === null) throw error;
      try { destroy(); } catch (cleanupError) {
        onError(new AggregateError([error, cleanupError], error.message, { cause: error }));
        return;
      }
      onError(error);
    }
  };
  mediaQuery.addEventListener("change", onChange);
  try { sync(); } catch (error) {
    destroyed = true;
    const errors = [error];
    try { mediaQuery.removeEventListener("change", onChange); } catch (failure) { errors.push(failure); }
    try { inputSurface.style.removeProperty("touch-action"); } catch (failure) { errors.push(failure); }
    if (errors.length > 1) throw new AggregateError(errors, error.message, { cause: error });
    throw error;
  }
  return Object.freeze({
    get mobile() {
      return mediaQuery.matches;
    },
    destroy,
  });
  function destroy() {
      if (destroyed) return;
      destroyed = true;
      mediaQuery.removeEventListener("change", onChange);
      inputSurface.style.removeProperty("touch-action");
  }
}

export function isOrbitDragStart({ isPrimary, button }) {
  return isPrimary && button === 0;
}
