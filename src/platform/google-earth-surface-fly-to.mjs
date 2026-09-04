import { projectGoogleEarthTrackballDelta } from
  "./google-earth-drag-inertia.mjs";

export const GOOGLE_EARTH_SURFACE_FLY_TO = Object.freeze({
  schema: "cssearth-google-earth-pro-surface-fly-to@3",
  qualification: "GOOGLE_EARTH_PRO_7.3.7.1327_NATIVE_TRAINING_FIT",
  rendererSha256:
    "11c6efe1ea0a75535485ab3804a09fc6f2ad3dd7c43f8c7d695a48d928890cd0",
  durationMilliseconds: 4500,
  angularDurationMilliseconds: 2700,
  zoomPrimaryDurationMilliseconds: 3200,
  zoomPrimaryCompletion: 0.992,
  arrivalZoomMultiplier: 2.33,
  angularResponse: 0.75,
  wheelTargetResponse: 0.61,
  swoopOutThresholdDegrees: 12,
  swoopOutZoomFactor: 0.002,
  sourceFunctions: Object.freeze({
    configuration: "0x005c389a",
    targetOnSkyType: "earth::evll::SwoopMotionHandleTargetOnSky",
    motionConstructor: "0x005bfc70",
    motionStep: "0x005c0878",
  }),
  trainingEvidence: Object.freeze({
    corpus: "interaction-corpus-v1.json",
    comparison: "comparison-training/report.json",
    fixedTimeAlignmentHz: 60,
  }),
});

export function planGoogleEarthSurfaceFlyTo({
  clientX,
  clientY,
  trackball,
  currentZoom,
  minimumZoom,
  maximumZoom,
}) {
  const values = [
    clientX,
    clientY,
    trackball?.centerX,
    trackball?.centerY,
    trackball?.radius,
    currentZoom,
    minimumZoom,
    maximumZoom,
  ];
  if (values.some((value) => !Number.isFinite(value)) ||
      trackball.radius <= 0 || minimumZoom <= 0 ||
      maximumZoom < minimumZoom || currentZoom <= 0) {
    throw new TypeError("Google Earth surface fly-to inputs are invalid.");
  }
  const offsetX = clientX - trackball.centerX;
  const offsetY = clientY - trackball.centerY;
  if (Math.hypot(offsetX, offsetY) > trackball.radius) return null;

  const projected = projectGoogleEarthTrackballDelta({
    previousX: clientX,
    previousY: clientY,
    currentX: trackball.centerX,
    currentY: trackball.centerY,
    ...trackball,
  });
  const rawAngularDistanceDegrees = Math.hypot(
    projected.pitchDegrees,
    projected.yawDegrees,
  );
  const pitchDeltaDegrees = projected.pitchDegrees *
    GOOGLE_EARTH_SURFACE_FLY_TO.angularResponse;
  const yawDeltaDegrees = projected.yawDegrees *
    GOOGLE_EARTH_SURFACE_FLY_TO.angularResponse;
  const angularDistanceDegrees = rawAngularDistanceDegrees *
    GOOGLE_EARTH_SURFACE_FLY_TO.angularResponse;
  const targetZoom = clamp(
    currentZoom * GOOGLE_EARTH_SURFACE_FLY_TO.arrivalZoomMultiplier,
    minimumZoom,
    maximumZoom,
  );
  return Object.freeze({
    schema: GOOGLE_EARTH_SURFACE_FLY_TO.schema,
    pitchDeltaDegrees,
    yawDeltaDegrees,
    rawAngularDistanceDegrees,
    angularDistanceDegrees,
    startZoom: clamp(currentZoom, minimumZoom, maximumZoom),
    targetZoom,
    minimumZoom,
    maximumZoom,
    swoopOut: rawAngularDistanceDegrees >=
      GOOGLE_EARTH_SURFACE_FLY_TO.swoopOutThresholdDegrees,
  });
}

export function sampleGoogleEarthSurfaceFlyTo(plan, progress) {
  if (plan?.schema !== GOOGLE_EARTH_SURFACE_FLY_TO.schema ||
      !Number.isFinite(progress)) {
    throw new TypeError("Google Earth surface fly-to sample is invalid.");
  }
  const time = clamp(progress, 0, 1);
  const elapsedMilliseconds = time *
    GOOGLE_EARTH_SURFACE_FLY_TO.durationMilliseconds;
  const motionProgress = smoothstep(clamp(
    elapsedMilliseconds /
      GOOGLE_EARTH_SURFACE_FLY_TO.angularDurationMilliseconds,
    0,
    1,
  ));
  const primaryZoomTime = clamp(
    elapsedMilliseconds /
      GOOGLE_EARTH_SURFACE_FLY_TO.zoomPrimaryDurationMilliseconds,
    0,
    1,
  );
  const primaryZoomProgress = smootherstep(primaryZoomTime) *
    GOOGLE_EARTH_SURFACE_FLY_TO.zoomPrimaryCompletion;
  const tailZoomProgress = smoothstep(clamp(
    (elapsedMilliseconds -
      GOOGLE_EARTH_SURFACE_FLY_TO.zoomPrimaryDurationMilliseconds) /
      (GOOGLE_EARTH_SURFACE_FLY_TO.durationMilliseconds -
        GOOGLE_EARTH_SURFACE_FLY_TO.zoomPrimaryDurationMilliseconds),
    0,
    1,
  )) * (1 - GOOGLE_EARTH_SURFACE_FLY_TO.zoomPrimaryCompletion);
  const zoomProgress = primaryZoomProgress + tailZoomProgress;
  const directZoom = plan.startZoom * Math.pow(
    plan.targetZoom / plan.startZoom,
    zoomProgress,
  );
  const swoopOut = plan.swoopOut
    ? plan.startZoom * GOOGLE_EARTH_SURFACE_FLY_TO.swoopOutZoomFactor *
      Math.sin(Math.PI * time)
    : 0;
  const pitchDeltaDegrees = plan.pitchDeltaDegrees * motionProgress;
  const yawDeltaDegrees = plan.yawDeltaDegrees * motionProgress;
  return Object.freeze({
    pitchDeltaDegrees: Math.abs(pitchDeltaDegrees) < 1e-12
      ? 0
      : pitchDeltaDegrees,
    yawDeltaDegrees: Math.abs(yawDeltaDegrees) < 1e-12
      ? 0
      : yawDeltaDegrees,
    zoom: time === 1
      ? plan.targetZoom
      : clamp(directZoom - swoopOut, plan.minimumZoom, plan.maximumZoom),
    complete: time === 1,
  });
}

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

function smootherstep(value) {
  return value * value * value * (value * (value * 6 - 15) + 10);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
