import type { PointerDelta, TrackballMetrics, Quaternion } from './math-types.js';
import type { SphereDragInput } from './sphere-drag.js';
export interface DragSample { x: number; y: number; timestamp: number; pitch: number; yaw: number; }
export interface DragHistory { x: Float64Array; y: Float64Array; timestamp: Float64Array; pitch: Float64Array; yaw: Float64Array; length: number; next: number; }
export interface TrackballDeltaInput extends PointerDelta { centerX: number; centerY: number; radius: number; angularDegreesPerTrackballRadius?: number; }
export interface DragThrowVelocity { pitchDegreesPerMillisecond: number; yawDegreesPerMillisecond: number; initialSpeedDegreesPerMillisecond: number; }
export type DragThrow = NonNullable<ReturnType<typeof estimateDragThrow>>;
import { projectSphereDrag } from "./sphere-drag.js";

export const TRACKBALL_DRAG_INERTIA = Object.freeze({
  schema: "cssearth-trackball-throw@10",
  qualification:
    "REFERENCE_APP_7.3.7.1327_NATIVE_PROJECTION_AND_DECOMPILED_THROW",
  rendererSha256:
    "11c6efe1ea0a75535485ab3804a09fc6f2ad3dd7c43f8c7d695a48d928890cd0",
  historyCapacity: 16,
  averagingFrameCount: 5,
  // The normalized pointer spans two units across the viewport. Its release
  // threshold of five viewport-scaled units is 2.5 CSS pixels, not five.
  minimumThrowDisplacementPixels: 2.5,
  releaseFreshnessMilliseconds: 100,
  directAngularDegreesPerTrackballRadius: 47.5,
  directAngularResponseByZoom: Object.freeze({
    model: "linear-clamped-native-training-fit",
    interceptDegrees: 69.8238784558683,
    slopeDegreesPerZoom: -16.30629044362304,
    minimumDegrees: 40,
    maximumDegrees: 52.5,
  }),
  directPitchResponse: 1,
  directPitchResponseByZoom: Object.freeze({
    model: "linear-clamped-native-pure-vertical-fit",
    intercept: 0.9768198038991756,
    slopePerZoom: 0.21000705516484433,
    minimum: 1.2025381100738586,
    maximum: 1.3504854183805297,
  }),
  directPitchResponseEvidence: Object.freeze({
    model: "two-point-native-endpoint-to-browser-pure-vertical-fit",
    calibrationScenarios: Object.freeze([
      "training-baseline-high-vertical-near",
      "training-baseline-high-vertical-far",
    ]),
  }),
  maximumPitchVelocityDegreesPerSecond: 30,
  maximumYawVelocityDegreesPerSecond: 90,
  rotationalDampingSeconds: 1.2,
  stopVelocityRatio: 0.0033,
  sourceFunctions: Object.freeze({
    configuration: "0x005b93a0",
    trackballConstructor: "0x005ae654",
    directTrackballMove: "0x005aec2c+0x005d10a2+0x005d1d70",
    releaseThrow: "0x005ae6ea",
    velocityAverage: "0x005ae936",
    rotationalDecay: "0x005b082c+0x005d23cc",
  }),
});

export function interactionTrackball(metrics: TrackballMetrics) {
  if (!Number.isFinite(metrics?.viewportWidth) || metrics.viewportWidth <= 0) {
    throw new TypeError("Trackball interaction viewport is invalid.");
  }
  // The observed native horizontal projection is cot(30 degrees). Keep
  // input rays independent of the prepared texture camera's perspective.
  return Object.freeze({ ...metrics, renderFocalLength: metrics.focalLength,
    opticalCenterX: metrics.viewportCenterX ?? metrics.opticalCenterX,
    opticalCenterY: metrics.viewportCenterY ?? metrics.opticalCenterY,
    focalLength: metrics.viewportWidth * Math.sqrt(3) / 2 });
}

export function directAngularDegreesPerTrackballRadius(zoom: number) {
  if (!Number.isFinite(zoom) || zoom <= 0) {
    throw new TypeError("Direct angular response zoom is invalid.");
  }
  const response = TRACKBALL_DRAG_INERTIA.directAngularResponseByZoom;
  return clamp(
    response.interceptDegrees + response.slopeDegreesPerZoom * zoom,
    response.minimumDegrees,
    response.maximumDegrees,
  );
}

export function directPitchResponseForZoom(zoom: number) {
  if (!Number.isFinite(zoom) || zoom <= 0) {
    throw new TypeError("Direct pitch response zoom is invalid.");
  }
  const response = TRACKBALL_DRAG_INERTIA.directPitchResponseByZoom;
  return clamp(
    response.intercept + response.slopePerZoom * zoom,
    response.minimum,
    response.maximum,
  );
}

export function createDragHistory() {
  const capacity = TRACKBALL_DRAG_INERTIA.historyCapacity;
  return {
    x: new Float64Array(capacity),
    y: new Float64Array(capacity),
    timestamp: new Float64Array(capacity),
    pitch: new Float64Array(capacity),
    yaw: new Float64Array(capacity),
    length: 0,
    next: 0,
  };
}

export function resetDragHistory(history: DragHistory) {
  validateHistory(history);
  history.length = 0;
  history.next = 0;
}

export function recordDragSample(history: DragHistory, sample: DragSample) {
  validateHistory(history);
  if (!isSample(sample)) {
    throw new TypeError("Drag sample is invalid.");
  }
  const index = history.next;
  history.x[index] = sample.x;
  history.y[index] = sample.y;
  history.timestamp[index] = sample.timestamp;
  history.pitch[index] = sample.pitch;
  history.yaw[index] = sample.yaw;
  history.next = (index + 1) % TRACKBALL_DRAG_INERTIA.historyCapacity;
  history.length = Math.min(
    history.length + 1,
    TRACKBALL_DRAG_INERTIA.historyCapacity,
  );
  return history;
}

export function projectTrackballDelta({
  previousX,
  previousY,
  currentX,
  currentY,
  centerX,
  centerY,
  radius,
  angularDegreesPerTrackballRadius =
    TRACKBALL_DRAG_INERTIA.directAngularDegreesPerTrackballRadius,
}: TrackballDeltaInput) {
  const values = [
    previousX,
    previousY,
    currentX,
    currentY,
    centerX,
    centerY,
    radius,
    angularDegreesPerTrackballRadius,
  ];
  if (values.some((value) => !Number.isFinite(value)) || radius <= 0) {
    throw new TypeError("Trackball projection is invalid.");
  }
  const degreesPerPixel =
    angularDegreesPerTrackballRadius / radius;
  const pitchDegrees = (currentY - previousY) * degreesPerPixel;
  const yawDegrees = (currentX - previousX) * degreesPerPixel;
  return Object.freeze({
    pitchDegrees: Math.abs(pitchDegrees) < 1e-12 ? 0 : pitchDegrees,
    yawDegrees: Math.abs(yawDegrees) < 1e-12 ? 0 : yawDegrees,
  });
}

export function estimateDragThrow({
  history,
  releaseTimestamp,
  frameMilliseconds = 1000 / 60,
  trackball,
  projectRotation = projectSphereDrag,
}: { history: DragHistory; releaseTimestamp: number; frameMilliseconds?: number; trackball: TrackballMetrics; projectRotation?: (input: SphereDragInput) => Quaternion }) {
  validateHistory(history);
  if (!Number.isFinite(releaseTimestamp) ||
      !Number.isFinite(frameMilliseconds) || frameMilliseconds <= 0 ||
      typeof projectRotation !== "function") {
    throw new TypeError("Drag throw inputs are invalid.");
  }
  if (history.length < 2) return null;
  const latestOffset = history.length - 1;
  const latestIndex = historyIndex(history, latestOffset);
  const freshness = releaseTimestamp - history.timestamp[latestIndex];
  if (freshness < 0 ||
      freshness > TRACKBALL_DRAG_INERTIA.releaseFreshnessMilliseconds) {
    return null;
  }

  // Release compares movement deltas two samples apart, not pointer positions.
  // The press contributes a zero delta. Keep positions in the existing ring
  // and derive these two deltas without allocating another history buffer.
  const gateOffset = Math.max(0, history.length - 3);
  const gateIndex = historyIndex(history, gateOffset);
  const previousIndex = historyIndex(history, latestOffset - 1);
  const beforeGateIndex = historyIndex(history, Math.max(0, gateOffset - 1));
  if (Math.hypot(
    history.x[latestIndex] - history.x[previousIndex] -
      (history.x[gateIndex] - history.x[beforeGateIndex]),
    history.y[latestIndex] - history.y[previousIndex] -
      (history.y[gateIndex] - history.y[beforeGateIndex]),
  ) < TRACKBALL_DRAG_INERTIA.minimumThrowDisplacementPixels) {
    return null;
  }

  const averagingWindow = frameMilliseconds *
    TRACKBALL_DRAG_INERTIA.averagingFrameCount;
  let averageStartOffset = history.length - 2;
  let includedIntervals = 1;
  while (averageStartOffset > 0) {
    const elapsedToCurrentStart = releaseTimestamp -
      history.timestamp[historyIndex(history, averageStartOffset)];
    if (includedIntervals > 1 && elapsedToCurrentStart > averagingWindow) {
      break;
    }
    averageStartOffset -= 1;
    includedIntervals += 1;
  }
  const averageStartIndex = historyIndex(history, averageStartOffset);
  const elapsed = releaseTimestamp - history.timestamp[averageStartIndex];
  if (elapsed <= 0) return null;

  const maximumPitchVelocity =
    TRACKBALL_DRAG_INERTIA.maximumPitchVelocityDegreesPerSecond / 1000;
  const maximumYawVelocity =
    TRACKBALL_DRAG_INERTIA.maximumYawVelocityDegreesPerSecond / 1000;
  const pitch = clamp(
    (history.pitch[latestIndex] - history.pitch[averageStartIndex]) / elapsed,
    -maximumPitchVelocity,
    maximumPitchVelocity,
  );
  const yaw = clamp(
    (history.yaw[latestIndex] - history.yaw[averageStartIndex]) / elapsed,
    -maximumYawVelocity,
    maximumYawVelocity,
  );
  const speed = Math.hypot(pitch, yaw);
  if (speed === 0) return null;
  // Average pointer velocity, then project a forward step at the release
  // point. Averaging older rotations uses a different tangent and speed.
  const delta = projectRotation({
    previousX: history.x[latestIndex], previousY: history.y[latestIndex],
    currentX: history.x[latestIndex] +
      (history.x[latestIndex] - history.x[averageStartIndex]) / elapsed * frameMilliseconds,
    currentY: history.y[latestIndex] +
      (history.y[latestIndex] - history.y[averageStartIndex]) / elapsed * frameMilliseconds,
    centerX: trackball?.centerX, centerY: trackball?.centerY,
    opticalCenterX: trackball?.opticalCenterX, opticalCenterY: trackball?.opticalCenterY,
    radius: trackball?.surfaceRadius, focalLength: trackball?.focalLength,
  });
  const sine = Math.hypot(delta[0], delta[1], delta[2]);
  const angle = 2 * Math.atan2(sine, Math.abs(delta[3]));
  const scale = sine > 1e-12
    ? angle / (sine * frameMilliseconds) * (delta[3] < 0 ? -1 : 1)
    : 0;
  return Object.freeze({
    pitchDegreesPerMillisecond: pitch,
    yawDegreesPerMillisecond: yaw,
    initialSpeedDegreesPerMillisecond: speed,
    averagingSampleCount: history.length - averageStartOffset,
    averagingMilliseconds: elapsed,
    launchRotation: Object.freeze(delta),
    angularVelocity: Object.freeze([
      delta[0] * scale, delta[1] * scale, delta[2] * scale,
    ]),
  });
}

export function advanceDragThrow({
  pitchDegreesPerMillisecond,
  yawDegreesPerMillisecond,
  initialSpeedDegreesPerMillisecond,
  elapsedMilliseconds,
}: DragThrowVelocity & { elapsedMilliseconds: number }) {
  const values = [
    pitchDegreesPerMillisecond,
    yawDegreesPerMillisecond,
    initialSpeedDegreesPerMillisecond,
    elapsedMilliseconds,
  ];
  if (values.some((value) => !Number.isFinite(value)) ||
      initialSpeedDegreesPerMillisecond <= 0 || elapsedMilliseconds < 0) {
    throw new TypeError("Drag throw step is invalid.");
  }
  const dampingMilliseconds =
    TRACKBALL_DRAG_INERTIA.rotationalDampingSeconds * 1000;
  const multiplier = clamp(
    1 - elapsedMilliseconds / dampingMilliseconds,
    0,
    1,
  );
  const pitch = pitchDegreesPerMillisecond * multiplier;
  const yaw = yawDegreesPerMillisecond * multiplier;
  const speed = Math.hypot(pitch, yaw);
  return Object.freeze({
    pitchDegreesPerMillisecond: pitch,
    yawDegreesPerMillisecond: yaw,
    pitchDeltaDegrees: pitch * elapsedMilliseconds,
    yawDeltaDegrees: yaw * elapsedMilliseconds,
    active: speed > initialSpeedDegreesPerMillisecond *
      TRACKBALL_DRAG_INERTIA.stopVelocityRatio,
  });
}

function historyIndex(history: DragHistory, offset: number) {
  const capacity = TRACKBALL_DRAG_INERTIA.historyCapacity;
  return (history.next - history.length + offset + capacity) % capacity;
}

function validateHistory(history: DragHistory) {
  const capacity = TRACKBALL_DRAG_INERTIA.historyCapacity;
  if (history === null || typeof history !== "object" ||
      !(history.x instanceof Float64Array) || history.x.length !== capacity ||
      !(history.y instanceof Float64Array) || history.y.length !== capacity ||
      !(history.timestamp instanceof Float64Array) ||
        history.timestamp.length !== capacity ||
      !(history.pitch instanceof Float64Array) ||
        history.pitch.length !== capacity ||
      !(history.yaw instanceof Float64Array) || history.yaw.length !== capacity ||
      !Number.isInteger(history.length) || history.length < 0 ||
        history.length > capacity ||
      !Number.isInteger(history.next) || history.next < 0 ||
        history.next >= capacity) {
    throw new TypeError("Drag history is invalid.");
  }
}

function isSample(sample: DragSample) {
  return sample !== null && typeof sample === "object" &&
    Number.isFinite(sample.x) && Number.isFinite(sample.y) &&
    Number.isFinite(sample.timestamp) && Number.isFinite(sample.pitch) &&
    Number.isFinite(sample.yaw);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
