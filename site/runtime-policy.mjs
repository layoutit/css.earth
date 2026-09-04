export const MOBILE_VIEWPORT_MAX = 820;
export const DESKTOP_VIEWPORT_MIN = MOBILE_VIEWPORT_MAX + 1;
export const MOBILE_VIEWPORT_QUERY =
  `(max-width: ${MOBILE_VIEWPORT_MAX}px), (orientation: portrait)`;
export const MOBILE_TOUCH_ACTION = "pan-y";
export const CANONICAL_PREPARED_IMAGE_DENSITY = 2;

export function bindResponsiveOrbitPolicy({ controls, inputSurface, mediaQuery }) {
  if (typeof controls?.update !== "function" ||
      typeof inputSurface?.style?.removeProperty !== "function" ||
      typeof mediaQuery?.addEventListener !== "function") {
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
  mediaQuery.addEventListener("change", sync);
  sync();
  return Object.freeze({
    get mobile() {
      return mediaQuery.matches;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      mediaQuery.removeEventListener("change", sync);
      inputSurface.style.removeProperty("touch-action");
    },
  });
}
