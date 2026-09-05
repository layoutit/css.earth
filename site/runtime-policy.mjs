export const MOBILE_VIEWPORT_MAX = 820;
export const DESKTOP_VIEWPORT_MIN = MOBILE_VIEWPORT_MAX + 1;
export const MOBILE_VIEWPORT_QUERY =
  `(max-width: ${MOBILE_VIEWPORT_MAX}px), (orientation: portrait)`;
export const MOBILE_TOUCH_ACTION = "pan-y";
export const CANONICAL_PREPARED_IMAGE_DENSITY = 2;

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
