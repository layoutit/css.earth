export const SURFACE_FLY_TO_SCHEMA = "cssearth-surface-fly-to@4";
export const SURFACE_FLY_TO = Object.freeze({
  schema: SURFACE_FLY_TO_SCHEMA,
  qualification: "REFERENCE_APP_7.3.7.1327_NATIVE_TRAINING_FIT",
  durationMilliseconds: 3652.3984590021428,
  angularDurationMilliseconds: 3652.3984590021428,
  zoomPrimaryDurationMilliseconds: 3652.3984590021428,
  zoomPrimaryCompletion: 1,
  targetRangeRatio: 0.25,
  angularResponse: 1.0050401414502155,
  perspectiveZoom: Object.freeze({
    referenceZoom: 0.5199,
    referenceDistanceRadii: 5.742498397827148,
    distanceScale: 2.9399086754878945,
  }),
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
