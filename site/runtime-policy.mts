import type { RuntimePolicy } from "../src/renderers/css/navigation/runtime-policy.js";
import type { AutomaticPlaybackInput, AutomaticPlaybackPolicy } from "./shell-contract-types.mts";

export const MOBILE_VIEWPORT_MAX = 820;
export const DESKTOP_VIEWPORT_MIN = MOBILE_VIEWPORT_MAX + 1;
export const MOBILE_VIEWPORT_QUERY =
  `(max-width: ${MOBILE_VIEWPORT_MAX}px), (orientation: portrait)`;
// Phones show the scene full screen, so one finger orbits and two fingers pinch.
export const MOBILE_TOUCH_ACTION = "none";
export { CANONICAL_PREPARED_IMAGE_DENSITY } from "../src/renderers/css/rendering/prepared-object-assets.ts";
export const SKYBOX_DRAG_ENABLED = true;
export const CENTER_SELECTION_DURATION_SECONDS = 0.35;
export const WHEEL_ZOOM_SPEED_MULTIPLIER = 4;
export const WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER = 1;
export const WHEEL_ZOOM_USE_SCROLL_DISTANCE = true;
// A released wheel gesture keeps the rate it commanded and decays it, as a
// thrown drag does. Damping is shorter than the trackball's: the wheel drives
// distance directly, so a glide outliving its gesture reads as drift.
export const WHEEL_ZOOM_INERTIA = Object.freeze({
  dampingSeconds: 0.25,
  // A third of a percent of distance per 60 Hz frame: about three pixels across a
  // thousand-pixel orbit, which is where a stop stops reading as a snap. Lower
  // costs a longer invisible tail; the ratio only bounds an extreme fling.
  stopLogRatePerSecond: 0.2,
  stopRateRatio: 0.02,
  gain: 1,
});

// Phones present information in a bottom sheet over the scene. Snap heights
// live in shell-layout.css; these values shape the drag between them.
export const MOBILE_SHEET_POLICY = Object.freeze({
  states: Object.freeze(["peek", "half", "full"] as const),
  dragSlopPixels: 6,
  flingPixelsPerMillisecond: 0.35,
  flingFreshnessMilliseconds: 80,
  overdragPixels: 24,
  overdragResistance: 0.18,
  // A browser toolbar sliding away shrinks the visual viewport too; only a
  // covering this deep is treated as a keyboard.
  keyboardMinimumPixels: 80,
});

/**
 * Pixels of the layout viewport that an on-screen keyboard covers. Phones keep
 * the sheet above it: the layout viewport does not shrink for a keyboard, so
 * the visual viewport is what says how much room is left.
 */
export function mobileSheetKeyboardInset({ layoutHeight, visualHeight, offsetTop = 0 }: {
  layoutHeight: number; visualHeight: number; offsetTop?: number;
}): number {
  if (![layoutHeight, visualHeight, offsetTop].every(value => Number.isFinite(value))) return 0;
  const covered = layoutHeight - visualHeight - offsetTop;
  return covered >= MOBILE_SHEET_POLICY.keyboardMinimumPixels ? Math.round(covered) : 0;
}

export const CONTEXT_ANNOTATION_PRIORITY = Object.freeze({
  planet: 3,
  'dwarf-planet': 2,
  comet: 1,
  asteroid: 0,
  'trans-neptunian': 1,
  interstellar: 1,
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

export const sceneCursor: RuntimePolicy["sceneCursor"] = ({ surface, pressed, enabled }) => {
  if (!enabled) return "";
  if (pressed) return "grabbing";
  return surface ? "grab" : "crosshair";
};

// WheelEvent has no device type. Infer discrete steps from line/page units or
// coarse pixel steps; keep accelerated packets on the current precision gesture.
export const wheelZoomInputKind: RuntimePolicy["wheelZoomInputKind"] = (
  event, previousKind = null, previousTimestamp = -Infinity,
) => {
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
};

export function automaticPlaybackPolicy({
  sceneState, motionRequested, documentHidden, reducedMotion,
}: AutomaticPlaybackInput): AutomaticPlaybackPolicy {
  const reason = sceneState !== "ready" ? "unavailable"
    : !motionRequested ? "motion-off"
      : documentHidden ? "hidden"
        : reducedMotion ? "reduced-motion" : "allowed";
  return Object.freeze({ allowed: reason === "allowed", reason });
}

export const bindResponsiveOrbitPolicy: RuntimePolicy["bindResponsiveOrbitPolicy"] = ({
  controls, inputSurface, mediaQuery, onError = null,
}) => {
  if (typeof controls?.update !== "function" ||
      typeof inputSurface?.style?.removeProperty !== "function" ||
      typeof mediaQuery?.addEventListener !== "function" ||
      (onError !== null && typeof onError !== "function")) {
    throw new TypeError("Responsive orbit policy requires controls, input, and media query.");
  }
  let destroyed = false;
  const sync = () => {
    if (destroyed) return;
    // No layout scrolls the page over the scene any more, so wheels always zoom.
    controls.update({ wheel: true });
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
        onError(new AggregateError([error, cleanupError], errorMessage(error), { cause: error }));
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
    if (errors.length > 1) throw new AggregateError(errors, errorMessage(error), { cause: error });
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
};

export const isOrbitDragStart: RuntimePolicy["isOrbitDragStart"] = ({ isPrimary, button }) => {
  return isPrimary && button === 0;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
