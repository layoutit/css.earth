import { BASE_TILE } from "@layoutit/polycss";

const cameraZoomScales = new WeakMap();

// The viewport fit is independent of the user's current zoom. Before the first
// publication the camera still has its unzoomed, object-owned mount styles.
export function preparedCameraZoomScale(cameraElement) {
  return cameraZoomScales.get(cameraElement) ?? 1;
}

// Geometry, material billboards and rings were prepared for the mounted
// perspective. Scale the entire camera for zoom so their relative projection
// stays fixed. Object packages still own their prepared scale and perspective.
export function createPreparedCameraPublisher({
  cameraElement,
  sceneElement,
  objectId,
  defaultZoom,
  sceneScale = defaultZoom / BASE_TILE,
}) {
  if (!cameraElement?.style || !sceneElement?.style ||
      !/^[a-z][a-z0-9-]*$/u.test(objectId) ||
      [defaultZoom, sceneScale].some((value) =>
        !Number.isFinite(value) || value <= 0)) {
    throw new TypeError("Prepared camera publication is invalid.");
  }
  let publishedMatrix = null;
  let publishedZoom = null;
  return ({ sceneMatrix, zoom }) => {
    if (typeof sceneMatrix !== "string" || !sceneMatrix ||
        !Number.isFinite(zoom) || zoom <= 0) {
      throw new TypeError("Prepared camera state is invalid.");
    }
    if (sceneMatrix !== publishedMatrix) {
      sceneElement.style.transform = `scale(${sceneScale}) ${sceneMatrix}`;
      publishedMatrix = sceneMatrix;
    }
    if (zoom !== publishedZoom) {
      cameraElement.style.scale =
        `calc(var(--${objectId}-shell-scale) / (` +
        `var(--planet-viewport-zoom-divisor) / ${zoom / defaultZoom}))`;
      cameraZoomScales.set(cameraElement, zoom / defaultZoom);
      publishedZoom = zoom;
    }
  };
}
