import { buildPolyCameraSceneTransform } from "@layoutit/polycss";

const DOLLY_WHEEL_STEP_PER_DELTA = 0.006;
const MINIMUM_DISTANCE_RADII = 1.2;
const ORBIT_LINE_FADE = Object.freeze({
  visibleBelowDiscHeightShare: 0.12,
  hiddenAboveDiscHeightShare: 0.3,
});
const LEVEL_OF_DETAIL = Object.freeze({
  model: "silhouette-diameter-crossfade",
  billboardFadeStartDiscPixels: 20,
  billboardFullDiscPixels: 14,
  markerFadeStartDiscPixels: 8,
  markerFullDiscPixels: 4.5,
});
const responsiveFit = Object.freeze({
  model: "continuous-aspect-smoothstep",
  portraitBaseWidthShare: 0.34,
  narrowPortraitWidthShareGain: 0.08,
  landscapeWidthShareGain: 0.02,
  narrowPortraitAspectRatio: 0.46,
  portraitAspectRatio: 0.75,
  squareAspectRatio: 1,
  maximumHeightShare: 0.61,
  maximumMobilePreviewShare: 0.925,
  minimumZoom: 0.42,
  maximumZoom: 2,
});

/** The shared responsive fit scaled for a body whose silhouette reaches past its volume-equivalent radius: `framingScale`
 * is that radius over the body's largest radius (1 for a sphere). */
export function scaledResponsiveFit(framingScale: number) {
  if (!Number.isFinite(framingScale) || framingScale <= 0 || framingScale > 1) {
    throw new TypeError(`Camera framing scale must be greater than zero and at most one, not ${framingScale}.`);
  }
  return framingScale === 1 ? responsiveFit : Object.freeze({
    ...responsiveFit,
    ...Object.fromEntries(([
      "portraitBaseWidthShare", "narrowPortraitWidthShareGain", "landscapeWidthShareGain",
      "maximumHeightShare", "maximumMobilePreviewShare", "minimumZoom",
    ] as const).map(key => [key, responsiveFit[key] * framingScale])),
  });
}

export function preparePerspectiveCamera({ sky, radius = 230, initialScenePitchDegrees = 40, defaultControlYawDegrees = 0, framingScale = 1 }: { sky: { projection: { horizontalFovDegrees: number; focalLengthOverViewportWidth: number; cssPerspective: string } }; radius?: number; initialScenePitchDegrees?: number; defaultControlYawDegrees?: number; framingScale?: number }) {
  // Elongated bodies need room beyond their volume-equivalent radius. Tune
  // the existing viewport fit at preparation time; keep physical scale intact.
  const fit = scaledResponsiveFit(framingScale);
  const defaultPitch = 89 * (1 - initialScenePitchDegrees / 65);
  return Object.freeze({
    state: Object.freeze({
      target: Object.freeze([0, 0, 0]),
      rotX: defaultPitch,
      rotY: defaultControlYawDegrees,
      zoom: 1.1,
      distance: 0,
    }),
    minimumControlPitchDegrees: 0,
    maximumControlPitchDegrees: 89,
    defaultControlPitchDegrees: defaultPitch,
    defaultControlYawDegrees: defaultControlYawDegrees,
    initialScenePitchDegrees: initialScenePitchDegrees,
    maximumScenePitchDegrees: 65,
    minimumZoom: 0.42,
    maximumZoom: 4,
    defaultZoom: 1.1,
    logicalBodyDiameter: radius * 2,
    responsiveFit: fit,
    // The phone framing, which sizes the body to its open area rather than by the fit's shares, scales by it too.
    ...(framingScale === 1 ? {} : { framingScale }),
    // PolyCSS leaves use 50 CSS units per world unit. Framing is already
    // owned by the dolly distance; scaling the mesh by defaultZoom here makes
    // its perspective silhouette disagree with lighting and occlusion.
    sceneScale: 1 / 50,
    horizontalOrbit: true,
    pitchBounded: false,
    yawBounded: false,
    cameraModel: "accumulated-matrix3d",
    defaultTransform: buildPolyCameraSceneTransform({
      target: [0, 0, 0],
      rotX: initialScenePitchDegrees,
      rotY: defaultControlYawDegrees,
      zoom: 1,
      distance: 0,
    }),
    projection: Object.freeze({
      model: "css-perspective-shared-with-sky",
      horizontalFovDegrees:
        sky.projection.horizontalFovDegrees,
      focalLengthOverViewportWidth:
        sky.projection.focalLengthOverViewportWidth,
      cssPerspective: sky.projection.cssPerspective,
      eyeOnCameraRootAxis: true,
      nearPlaneClipping: "javascript-before-publication",
    }),
    dolly: Object.freeze({
      model: "multiplicative-wheel-distance",
      wheelStepPerDelta: DOLLY_WHEEL_STEP_PER_DELTA,
      minimumDistanceRadii: MINIMUM_DISTANCE_RADII,
      maximumDistanceOverOrbitExtent: 4,
      zoomIsSilhouetteFraming: true,
    }),
    orbitLineFade: ORBIT_LINE_FADE,
    levelOfDetail: LEVEL_OF_DETAIL,
    drag: Object.freeze({ model: "screen-axis-tumble" }),
    runtimeGeometryDerivation: false,
  });
}
