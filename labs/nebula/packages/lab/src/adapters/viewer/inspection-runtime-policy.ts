import type { RuntimePolicy } from '@cssearth/renderer/navigation/runtime-policy.ts';
import { isSharedInputSurface } from '@cssearth/renderer';

const bindResponsiveOrbitPolicy: RuntimePolicy["bindResponsiveOrbitPolicy"] = ({
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
    // The retained shell declares touch-action in its stylesheet.
    if (isSharedInputSurface(inputSurface)) return;
    if (mediaQuery.matches) {
      inputSurface.style.touchAction = 'none';
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
    try { if (!isSharedInputSurface(inputSurface)) inputSurface.style.removeProperty("touch-action"); } catch (failure) { errors.push(failure); }
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
      if (!isSharedInputSurface(inputSurface)) inputSurface.style.removeProperty("touch-action");
  }
};


function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Inspection owns its input values. The site owns its separate production values.
export const runtimePolicy = {
  MOBILE_VIEWPORT_QUERY: '(max-width: 820px), (orientation: portrait)',
  SKYBOX_DRAG_ENABLED: true,
  FLIGHT_WHEEL_SPEEDUP: 6,
  WHEEL_ZOOM_SPEED_MULTIPLIER: 1,
  WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER: 1,
  WHEEL_ZOOM_PINCH: {
    wheelDeltaPerFingerLogStep: 100,
    touchWheelDeltaPerFingerLogStep: 217,
    fullPinchFingerRatio: 5,
    nearRemainingPerFullPinch: 0.6,
    farZoomPerFullPinch: 50,
  },
  WHEEL_ZOOM_INERTIA: {
    dampingSeconds: 0.088,
    stopLogRatePerSecond: 0.2,
    stopRateRatio: 0.02,
    gain: 1,
  },
  WHEEL_ZOOM_INERTIA_INPUT_KINDS: ['wheel'],
  sceneCursor: ({ surface, pressed, enabled }) => !enabled ? '' : pressed ? 'grabbing' : surface ? 'grab' : 'crosshair',
  isOrbitDragStart: ({ isPrimary, button }) => isPrimary && button === 0,
  wheelZoomInputKind(event, previousKind = null, previousTimestamp = -Infinity) {
    if (event.deltaMode === 1 || event.deltaMode === 2) return 'wheel';
    if (event.ctrlKey || event.deltaX) return 'trackpad';
    const magnitude = Math.abs(event.deltaY);
    const wheelQuantum = 4.000244140625;
    if (magnitude >= wheelQuantum &&
        Math.abs(magnitude / wheelQuantum - Math.round(magnitude / wheelQuantum)) < 1e-6) return 'wheel';
    if (magnitude < 40 || !Number.isInteger(magnitude)) return 'trackpad';
    if (previousKind === 'trackpad' && event.timeStamp >= previousTimestamp &&
        event.timeStamp - previousTimestamp < 400) return 'trackpad';
    return 'wheel';
  },
  bindResponsiveOrbitPolicy,
} satisfies RuntimePolicy;
