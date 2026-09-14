import type { PreparedCubicSkyPlan } from "../../src/platform/cubic-sky-contract.mts";
import { CUBIC_SKY_CAMERA_PRESENTATION_STANDARD } from "../../src/platform/cubic-sky-contract.mts";

function skyFieldOfView(sky: PreparedCubicSkyPlan) {
  const camera = sky.cameraContract;
  if (camera && typeof camera === "object" && Number.isFinite(camera.horizontalFovDegrees) && camera.horizontalFovDegrees > 0) {
    return camera.horizontalFovDegrees;
  }
  const projectionFov = sky.projection?.horizontalFovDegrees;
  return Number.isFinite(projectionFov) && projectionFov! > 0
    ? projectionFov!
    : CUBIC_SKY_CAMERA_PRESENTATION_STANDARD.horizontalFovDegrees;
}

/** An object camera without its own projection shares its sky's. A fixed 1000000px perspective gave
 * Earth a million-pixel focal length while every other body frames with 0.87 of the viewport width. */
export function focusedCameraProjection(sky: PreparedCubicSkyPlan) {
  const horizontalFovDegrees = skyFieldOfView(sky);
  const shared = sky.projection?.horizontalFovDegrees === horizontalFovDegrees ? sky.projection : undefined;
  const focalLengthOverViewportWidth = shared?.focalLengthOverViewportWidth ?? 1 / (2 * Math.tan(horizontalFovDegrees * Math.PI / 360));
  return Object.freeze({ model: "css-perspective-shared-with-sky", horizontalFovDegrees, focalLengthOverViewportWidth,
    cssPerspective: shared?.cssPerspective ?? `${focalLengthOverViewportWidth * 100}cqw`,
    eyeOnCameraRootAxis: true, nearPlaneClipping: "javascript-before-publication" });
}

/** Give an object whose camera has no projection the shared perspective camera world navigation drives: the sky's
 * projection, the wheel dolly, and the level-of-detail and orbit-line fades. */
export function withFocusedCamera<T extends { camera: object }>(presentation: T, sky: PreparedCubicSkyPlan): T {
  if ("projection" in presentation.camera && presentation.camera.projection) return presentation;
  return {
    ...presentation,
    camera: {
      ...presentation.camera,
      projection: focusedCameraProjection(sky),
      dolly: { model: "multiplicative-wheel-distance", wheelStepPerDelta: 0.006,
        minimumDistanceRadii: 1.2, maximumDistanceOverOrbitExtent: 4, zoomIsSilhouetteFraming: true },
      levelOfDetail: { model: "silhouette-diameter-crossfade", billboardFadeStartDiscPixels: 20,
        billboardFullDiscPixels: 14, markerFadeStartDiscPixels: 8, markerFullDiscPixels: 4.5 },
      orbitLineFade: { visibleBelowDiscHeightShare: 0.12, hiddenAboveDiscHeightShare: 0.3 },
    },
  };
}
