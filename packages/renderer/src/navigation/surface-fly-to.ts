import { cross3 } from '@cssearth/core';
import type { TrackballMetrics, Vector3, Quaternion, Matrix3 } from './types.js';
export interface SurfaceFlyToInput { clientX: number; clientY: number; trackball: TrackballMetrics; currentZoom: number; minimumZoom: number; maximumZoom: number; }
export type SurfaceFlyToPlan = NonNullable<ReturnType<typeof planSurfaceFlyTo>>;
import { projectTrackballDelta } from
  "@cssearth/engine";

export const SURFACE_FLY_TO = Object.freeze({
  schema: "cssearth-surface-fly-to@4",
  qualification: "REFERENCE_APP_7.3.7.1327_NATIVE_TRAINING_FIT",
  rendererSha256:
    "11c6efe1ea0a75535485ab3804a09fc6f2ad3dd7c43f8c7d695a48d928890cd0",
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

// Prepared from the complete 123-frame rest trace. The third channel is
// normalized camera distance, recovered from the reference projection.
const FLY_TO_RESPONSE_KNOTS = Object.freeze([
  Object.freeze([0, 0, 0]),
  Object.freeze([0.068448173, 0.03115829, 0.0225609891594]),
  Object.freeze([0.136896345, 0.099756208, 0.0827672197068]),
  Object.freeze([0.205344518, 0.19798825, 0.173580868285]),
  Object.freeze([0.27379269, 0.317398774, 0.287581461913]),
  Object.freeze([0.342240863, 0.444453759, 0.412030395565]),
  Object.freeze([0.410689035, 0.582987156, 0.550939820443]),
  Object.freeze([0.479137208, 0.712244736, 0.683658363571]),
  Object.freeze([0.547585381, 0.825189737, 0.802468268809]),
  Object.freeze([0.616033553, 0.919183471, 0.904328450039]),
  Object.freeze([0.684481726, 0.97809128, 0.971275044604]),
  Object.freeze([0.752929898, 0.995371615, 0.992718149755]),
  Object.freeze([0.821378071, 0.99903749, 0.998013402168]),
  Object.freeze([0.889826243, 0.999803312, 0.999410879427]),
  Object.freeze([0.958274416, 0.999973364, 0.999856396375]),
  Object.freeze([1, 1, 1]),
]);

// One static renderer-registration basis keeps the runtime path to matrix
// transport and a small response-table lookup.
const SOURCE_OBJECT_BASIS = Object.freeze([
  Object.freeze([-0.7418335167296961, -0.4253134980693789,
    0.5184507974061892]),
  Object.freeze([-0.5735566096990734, 0.0018513086810529322,
    -0.8191637819798022]),
  Object.freeze([-0.34744164298186603, 0.9050440627098558,
    0.245314506412372]),
]);

export function planSurfaceFlyTo({
  clientX,
  clientY,
  trackball,
  currentZoom,
  minimumZoom,
  maximumZoom,
}: SurfaceFlyToInput) {
  const values = [
    clientX,
    clientY,
    trackball?.centerX,
    trackball?.centerY,
    trackball?.radius,
    trackball?.surfaceRadius,
    trackball?.focalLength,
    currentZoom,
    minimumZoom,
    maximumZoom,
  ];
  if (values.some((value) => !Number.isFinite(value)) ||
      trackball.radius <= 0 || trackball.surfaceRadius <= 0 ||
      trackball.focalLength <= 0 || minimumZoom <= 0 ||
      maximumZoom < minimumZoom || currentZoom <= 0) {
    throw new TypeError("Surface fly-to inputs are invalid.");
  }
  const offsetX = clientX - trackball.centerX;
  const offsetY = clientY - trackball.centerY;
  if (Math.hypot(offsetX, offsetY) > trackball.radius) return null;

  const projected = projectTrackballDelta({
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
    SURFACE_FLY_TO.angularResponse;
  const yawDeltaDegrees = projected.yawDegrees *
    SURFACE_FLY_TO.angularResponse;
  const angularDistanceDegrees = rawAngularDistanceDegrees *
    SURFACE_FLY_TO.angularResponse;
  const targetRotation = surfaceTargetRotation({
    clientX,
    clientY,
    trackball,
  });
  const { distance: startDistance, range } = surfaceIntersection(clientX, clientY, trackball);
  const desiredDistance = 1 + range * SURFACE_FLY_TO.targetRangeRatio;
  const targetZoom = clamp(currentZoom * Math.sqrt(
    (startDistance * startDistance - 1) / (desiredDistance * desiredDistance - 1)),
    minimumZoom, maximumZoom);
  const targetDistance = Math.sqrt(1 + (startDistance * startDistance - 1) *
    (currentZoom / targetZoom) ** 2);
  return Object.freeze({
    schema: SURFACE_FLY_TO.schema,
    pitchDeltaDegrees,
    yawDeltaDegrees,
    rawAngularDistanceDegrees,
    angularDistanceDegrees,
    targetRotation,
    startZoom: clamp(currentZoom, minimumZoom, maximumZoom),
    targetZoom,
    startDistance, targetDistance,
    minimumZoom,
    maximumZoom,
    swoopOut: rawAngularDistanceDegrees >=
      SURFACE_FLY_TO.swoopOutThresholdDegrees,
  });
}

export function sampleSurfaceFlyTo(plan: SurfaceFlyToPlan, progress: number) {
  if (plan?.schema !== SURFACE_FLY_TO.schema ||
      !Number.isFinite(progress)) {
    throw new TypeError("Surface fly-to sample is invalid.");
  }
  const time = clamp(progress, 0, 1);
  const [motionProgress, zoomProgress] = responseAt(time);
  const distance = plan.startDistance +
    (plan.targetDistance - plan.startDistance) * zoomProgress;
  const directZoom = plan.startZoom * Math.sqrt(
    (plan.startDistance * plan.startDistance - 1) / (distance * distance - 1));
  const pitchDeltaDegrees = plan.pitchDeltaDegrees * motionProgress;
  const yawDeltaDegrees = plan.yawDeltaDegrees * motionProgress;
  return Object.freeze({
    pitchDeltaDegrees: Math.abs(pitchDeltaDegrees) < 1e-12
      ? 0
      : pitchDeltaDegrees,
    yawDeltaDegrees: Math.abs(yawDeltaDegrees) < 1e-12
      ? 0
      : yawDeltaDegrees,
    rotation: quaternionPower(plan.targetRotation, motionProgress),
    zoom: time === 1
      ? plan.targetZoom
      : clamp(directZoom, plan.minimumZoom, plan.maximumZoom),
    complete: time === 1,
  });
}

function responseAt(progress: number) {
  const upperIndex = FLY_TO_RESPONSE_KNOTS.findIndex(
    ([time]) => time >= progress,
  );
  if (upperIndex <= 0) return FLY_TO_RESPONSE_KNOTS[0].slice(1);
  const lower = FLY_TO_RESPONSE_KNOTS[upperIndex - 1];
  const upper = FLY_TO_RESPONSE_KNOTS[upperIndex];
  const amount = (progress - lower[0]) / (upper[0] - lower[0]);
  return [
    lower[1] + (upper[1] - lower[1]) * amount,
    lower[2] + (upper[2] - lower[2]) * amount,
  ];
}

function surfaceIntersection(clientX: number, clientY: number, trackball: TrackballMetrics) {
  const x = (clientX - trackball.centerX) / trackball.focalLength;
  const y = (clientY - trackball.centerY) / trackball.focalLength;
  const distance = Math.hypot(1, trackball.focalLength / trackball.surfaceRadius);
  const radial = x*x + y*y;
  const t = (distance - Math.sqrt(Math.max(0, 1-radial*(distance*distance-1)))) / (1+radial);
  return { distance, range:t*Math.sqrt(1+radial) };
}

function surfaceTargetRotation({ clientX, clientY, trackball }: Pick<SurfaceFlyToInput, "clientX" | "clientY" | "trackball">) {
  const scene = matrixRotation(trackball.sceneMatrix);
  const source = multiply3(multiply3(flipY(), scene), SOURCE_OBJECT_BASIS);
  const x = (clientX - trackball.centerX) / trackball.focalLength;
  const y = (clientY - trackball.centerY) / trackball.focalLength;
  const distance = Math.hypot(1,
    trackball.focalLength / trackball.surfaceRadius);
  const radial = x * x + y * y;
  const tangent = radial > 1 / (distance * distance - 1)
    ? distance - 1 / distance
    : (distance - Math.sqrt(Math.max(
      0,
      1 - radial * (distance * distance - 1),
    ))) / (1 + radial);
  const sourceNormal = normalize3([
    tangent * x,
    -tangent * y,
    distance - tangent,
  ]);
  const localNormal = multiplyVector3(transpose3(source), sourceNormal);
  const currentFrame = surfaceFrame(source[2]);
  const heading = multiply3(source, transpose3(currentFrame));
  const target = multiply3(
    heading,
    surfaceFrame(localNormal, currentFrame[0]),
  );
  const sourceDelta = multiply3(target, transpose3(source));
  const sceneDelta = multiply3(multiply3(flipY(), sourceDelta), flipY());
  return quaternionPower(
    matrixQuaternion(sceneDelta),
    SURFACE_FLY_TO.angularResponse,
  );
}

function surfaceFrame(normal: Vector3, fallbackRight: Vector3 = [1, 0, 0]): Matrix3 {
  const candidate = cross3([0, 1, 0], normal);
  const projectedFallback = fallbackRight.map((value, index) =>
    value - normal[index] * fallbackRight.reduce((sum, component, offset) =>
      sum + component * normal[offset], 0));
  const right = normalize3(Math.hypot(...candidate) > 1e-9
    ? candidate
    : projectedFallback);
  return [right, cross3(normal, right), normal];
}

function matrixRotation(value: TrackballMetrics["sceneMatrix"]): Matrix3 {
  const matrix = typeof value === "string" && value.startsWith("matrix3d(")
    ? value.slice(9, -1).split(",").map(Number)
    : value;
  if (!Array.isArray(matrix) || matrix.length !== 16 ||
      matrix.some((component) => !Number.isFinite(component))) {
    throw new TypeError("Surface fly-to scene matrix is invalid.");
  }
  return [
    [matrix[0], matrix[4], matrix[8]],
    [matrix[1], matrix[5], matrix[9]],
    [matrix[2], matrix[6], matrix[10]],
  ];
}

function matrixQuaternion(matrix: Matrix3): Quaternion {
  const trace = matrix[0][0] + matrix[1][1] + matrix[2][2];
  let x;
  let y;
  let z;
  let w;
  if (trace > 0) {
    const scale = 2 * Math.sqrt(trace + 1);
    x = (matrix[2][1] - matrix[1][2]) / scale;
    y = (matrix[0][2] - matrix[2][0]) / scale;
    z = (matrix[1][0] - matrix[0][1]) / scale;
    w = scale / 4;
  } else {
    const axis = matrix[0][0] > matrix[1][1]
      ? (matrix[0][0] > matrix[2][2] ? 0 : 2)
      : (matrix[1][1] > matrix[2][2] ? 1 : 2);
    const first = axis;
    const second = (axis + 1) % 3;
    const third = (axis + 2) % 3;
    const scale = 2 * Math.sqrt(
      1 + matrix[first][first] - matrix[second][second] -
        matrix[third][third],
    );
    const components = [0, 0, 0];
    components[first] = scale / 4;
    components[second] =
      (matrix[second][first] + matrix[first][second]) / scale;
    components[third] =
      (matrix[third][first] + matrix[first][third]) / scale;
    [x, y, z] = components;
    w = (matrix[third][second] - matrix[second][third]) / scale;
  }
  return normalize4([x, y, z, w]);
}

function quaternionPower(rotation: Quaternion, amount: number): Quaternion {
  if (amount <= 0) return [0, 0, 0, 1];
  if (amount >= 1) return [...rotation];
  const vectorLength = Math.hypot(rotation[0], rotation[1], rotation[2]);
  if (vectorLength < 1e-12) return [0, 0, 0, 1];
  const angle = Math.atan2(vectorLength, rotation[3]) * amount;
  const scale = Math.sin(angle) / vectorLength;
  return [
    rotation[0] * scale,
    rotation[1] * scale,
    rotation[2] * scale,
    Math.cos(angle),
  ];
}

function multiply3(first: Matrix3, second: Matrix3): Matrix3 {
  return first.map((row) => row.map((_, column) =>
    row.reduce((sum, value, index) =>
      sum + value * second[index][column], 0)));
}

function multiplyVector3(matrix: Matrix3, vector: Vector3): Vector3 {
  return matrix.map((row) => row.reduce((sum, value, index) =>
    sum + value * vector[index], 0));
}

function transpose3(matrix: Matrix3): Matrix3 {
  return matrix[0].map((_, column) => matrix.map((row) => row[column]));
}

function flipY(): Matrix3 {
  return [[1, 0, 0], [0, -1, 0], [0, 0, 1]];
}

function normalize3(vector: Vector3): Vector3 {
  const length = Math.hypot(...vector);
  if (length < 1e-12) {
    throw new TypeError("Surface fly-to target is singular.");
  }
  return vector.map((value) => value / length);
}

function normalize4(vector: Quaternion): Quaternion {
  const length = Math.hypot(...vector);
  return vector.map((value) => value / length);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
