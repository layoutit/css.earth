export const GOOGLE_EARTH_DRAG_INERTIA = Object.freeze({
  schema: "cssearth-google-earth-pro-trackball-throw@5",
  qualification:
    "GOOGLE_EARTH_PRO_7.3.7.1327_DECOMPILED_THROW_AND_NATIVE_DIRECT_FIT",
  rendererSha256:
    "11c6efe1ea0a75535485ab3804a09fc6f2ad3dd7c43f8c7d695a48d928890cd0",
  historyCapacity: 16,
  averagingFrameCount: 5,
  minimumThrowDisplacementPixels: 5,
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

export function googleEarthDirectAngularDegreesPerTrackballRadius(zoom) {
  if (!Number.isFinite(zoom) || zoom <= 0) {
    throw new TypeError("Google Earth direct angular response zoom is invalid.");
  }
  const response = GOOGLE_EARTH_DRAG_INERTIA.directAngularResponseByZoom;
  return clamp(
    response.interceptDegrees + response.slopeDegreesPerZoom * zoom,
    response.minimumDegrees,
    response.maximumDegrees,
  );
}

export function createGoogleEarthDragHistory() {
  const capacity = GOOGLE_EARTH_DRAG_INERTIA.historyCapacity;
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

export function resetGoogleEarthDragHistory(history) {
  validateHistory(history);
  history.length = 0;
  history.next = 0;
}

export function recordGoogleEarthDragSample(history, sample) {
  validateHistory(history);
  if (!isSample(sample)) {
    throw new TypeError("Google Earth drag sample is invalid.");
  }
  const index = history.next;
  history.x[index] = sample.x;
  history.y[index] = sample.y;
  history.timestamp[index] = sample.timestamp;
  history.pitch[index] = sample.pitch;
  history.yaw[index] = sample.yaw;
  history.next = (index + 1) % GOOGLE_EARTH_DRAG_INERTIA.historyCapacity;
  history.length = Math.min(
    history.length + 1,
    GOOGLE_EARTH_DRAG_INERTIA.historyCapacity,
  );
  return history;
}

export function projectGoogleEarthTrackballDelta({
  previousX,
  previousY,
  currentX,
  currentY,
  centerX,
  centerY,
  radius,
  angularDegreesPerTrackballRadius =
    GOOGLE_EARTH_DRAG_INERTIA.directAngularDegreesPerTrackballRadius,
}) {
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
    throw new TypeError("Google Earth trackball projection is invalid.");
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

export function estimateGoogleEarthDragThrow({
  history,
  releaseTimestamp,
  frameMilliseconds = 1000 / 60,
}) {
  validateHistory(history);
  if (!Number.isFinite(releaseTimestamp) ||
      !Number.isFinite(frameMilliseconds) || frameMilliseconds <= 0) {
    throw new TypeError("Google Earth drag throw inputs are invalid.");
  }
  if (history.length < 2) return null;
  const latestOffset = history.length - 1;
  const latestIndex = historyIndex(history, latestOffset);
  const freshness = releaseTimestamp - history.timestamp[latestIndex];
  if (freshness < 0 ||
      freshness > GOOGLE_EARTH_DRAG_INERTIA.releaseFreshnessMilliseconds) {
    return null;
  }

  // Google checks the last two pointer intervals before it launches a throw.
  const gateOffset = Math.max(0, history.length - 3);
  const gateIndex = historyIndex(history, gateOffset);
  if (Math.hypot(
    history.x[latestIndex] - history.x[gateIndex],
    history.y[latestIndex] - history.y[gateIndex],
  ) < GOOGLE_EARTH_DRAG_INERTIA.minimumThrowDisplacementPixels) {
    return null;
  }

  const averagingWindow = frameMilliseconds *
    GOOGLE_EARTH_DRAG_INERTIA.averagingFrameCount;
  let averageStartOffset = history.length - 2;
  while (averageStartOffset > 0) {
    const candidateIndex = historyIndex(history, averageStartOffset - 1);
    if (history.timestamp[latestIndex] - history.timestamp[candidateIndex] >
        averagingWindow) break;
    averageStartOffset -= 1;
  }
  averageStartOffset = Math.min(
    averageStartOffset,
    Math.max(0, history.length - 3),
  );
  const averageStartIndex = historyIndex(history, averageStartOffset);
  const elapsed = history.timestamp[latestIndex] -
    history.timestamp[averageStartIndex];
  if (elapsed <= 0) return null;

  const maximumPitchVelocity =
    GOOGLE_EARTH_DRAG_INERTIA.maximumPitchVelocityDegreesPerSecond / 1000;
  const maximumYawVelocity =
    GOOGLE_EARTH_DRAG_INERTIA.maximumYawVelocityDegreesPerSecond / 1000;
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
  return Object.freeze({
    pitchDegreesPerMillisecond: pitch,
    yawDegreesPerMillisecond: yaw,
    initialSpeedDegreesPerMillisecond: speed,
    averagingSampleCount: history.length - averageStartOffset,
    averagingMilliseconds: elapsed,
  });
}

export function advanceGoogleEarthDragThrow({
  pitchDegreesPerMillisecond,
  yawDegreesPerMillisecond,
  initialSpeedDegreesPerMillisecond,
  elapsedMilliseconds,
}) {
  const values = [
    pitchDegreesPerMillisecond,
    yawDegreesPerMillisecond,
    initialSpeedDegreesPerMillisecond,
    elapsedMilliseconds,
  ];
  if (values.some((value) => !Number.isFinite(value)) ||
      initialSpeedDegreesPerMillisecond <= 0 || elapsedMilliseconds < 0) {
    throw new TypeError("Google Earth drag throw step is invalid.");
  }
  const dampingMilliseconds =
    GOOGLE_EARTH_DRAG_INERTIA.rotationalDampingSeconds * 1000;
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
      GOOGLE_EARTH_DRAG_INERTIA.stopVelocityRatio,
  });
}

function historyIndex(history, offset) {
  const capacity = GOOGLE_EARTH_DRAG_INERTIA.historyCapacity;
  return (history.next - history.length + offset + capacity) % capacity;
}

function validateHistory(history) {
  const capacity = GOOGLE_EARTH_DRAG_INERTIA.historyCapacity;
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
    throw new TypeError("Google Earth drag history is invalid.");
  }
}

function isSample(sample) {
  return sample !== null && typeof sample === "object" &&
    Number.isFinite(sample.x) && Number.isFinite(sample.y) &&
    Number.isFinite(sample.timestamp) && Number.isFinite(sample.pitch) &&
    Number.isFinite(sample.yaw);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
