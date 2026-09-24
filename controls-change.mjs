// src/renderers/css/navigation/camera-input-options.ts
function validateDragControlsOptions({
  inputSurface,
  cameraMotion,
  trackballMetrics,
  flyToTrackballMetrics,
  rotate,
  surfaceFlyToState,
  surfaceFlyToHitTest,
  onPointerStart,
  onStart,
  onEnd,
  onError
}) {
  if (!cameraMotion || !(inputSurface instanceof HTMLElement) || typeof trackballMetrics !== "function" || typeof flyToTrackballMetrics !== "function" || typeof rotate !== "function" || surfaceFlyToState !== null && typeof surfaceFlyToState !== "function" || surfaceFlyToHitTest != null && typeof surfaceFlyToHitTest !== "function" || typeof onPointerStart !== "function" || typeof onStart !== "function" || typeof onEnd !== "function" || onError !== null && typeof onError !== "function") {
    throw new TypeError("Unbounded matrix drag controls are invalid.");
  }
}

// src/renderers/css/stars/opacity-clock.ts
var shared = /* @__PURE__ */ new WeakMap();
function createOpacityClock(window) {
  const entry = shared.get(window) ?? { clock: createFrameClock(window), owners: 0 };
  entry.owners++;
  shared.set(window, entry);
  let released = false;
  return Object.freeze({ ...entry.clock, destroy() {
    if (released) return;
    released = true;
    if (--entry.owners > 0) return;
    shared.delete(window);
    entry.clock.destroy();
  } });
}
function createFrameClock(window) {
  const lanes = { input: /* @__PURE__ */ new Map(), present: /* @__PURE__ */ new Map() };
  const callbacks = { get size() {
    return lanes.input.size + lanes.present.size;
  }, clear() {
    lanes.input.clear();
    lanes.present.clear();
  } };
  const dirty = /* @__PURE__ */ new Set(), active = /* @__PURE__ */ new Set();
  let next = 0, frame = null, depth = 0, presenting = false, destroyed = false;
  let timestamp = null;
  const now = () => timestamp ?? window.performance.now();
  const schedule = () => {
    const needed = callbacks.size > 0 || dirty.size > 0 || active.size > 0;
    if (destroyed || presenting) return;
    if (needed) frame ??= window.requestAnimationFrame(tick);
    else if (frame !== null) {
      window.cancelAnimationFrame(frame);
      frame = null;
    }
  };
  const flush = (advance = false) => {
    const pending = new Set(advance ? [...active, ...dirty] : dirty);
    dirty.clear();
    for (const publish of pending) {
      if (publish(now(), advance)) active.add(publish);
      else active.delete(publish);
    }
  };
  const tick = (time) => {
    frame = null;
    presenting = true;
    timestamp = time;
    const ready = [...lanes.input.values(), ...lanes.present.values()];
    lanes.input.clear();
    lanes.present.clear();
    try {
      for (const callback of ready) callback(time);
    } finally {
      try {
        flush(true);
      } finally {
        timestamp = null;
        presenting = false;
        schedule();
      }
    }
  };
  return {
    now,
    request(callback, lane = "present") {
      const id = ++next;
      if (!destroyed) {
        lanes[lane].set(id, callback);
        schedule();
      }
      return id;
    },
    cancel(id) {
      lanes.input.delete(id);
      lanes.present.delete(id);
      schedule();
    },
    changed(publish) {
      if (destroyed) return;
      dirty.add(publish);
      if (!presenting && depth === 0) flush();
      schedule();
    },
    remove(publish) {
      dirty.delete(publish);
      active.delete(publish);
      schedule();
    },
    batch(work) {
      depth++;
      try {
        return work();
      } finally {
        if (--depth === 0 && !presenting) {
          flush();
          schedule();
        }
      }
    },
    destroy() {
      destroyed = true;
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
      callbacks.clear();
      dirty.clear();
      active.clear();
    }
  };
}

// packages/engine/dist/index.js
var CANCELLED = Object.freeze({ cancelled: true });
function createSceneLifetime() {
  let disposed = false;
  const owners = [];
  const waiters = /* @__PURE__ */ new Set();
  return Object.freeze({
    get disposed() {
      return disposed;
    },
    onDispose(callback) {
      if (typeof callback !== "function") throw new TypeError("Cleanup must be a function.");
      if (disposed) return clean(callback);
      owners.push(callback);
      return [];
    },
    wait(promise) {
      return new Promise((resolve, reject) => {
        let settled = false;
        const claim = () => {
          if (settled) return false;
          settled = true;
          waiters.delete(cancel);
          return true;
        };
        const cancel = () => {
          if (claim()) resolve(CANCELLED);
        };
        if (disposed) cancel();
        else waiters.add(cancel);
        Promise.resolve(promise).then(
          (value) => {
            if (claim()) resolve({ cancelled: false, value });
          },
          (error) => {
            if (claim()) reject(error);
          }
        );
      });
    },
    destroy() {
      if (disposed) return [];
      disposed = true;
      for (const cancel of waiters) cancel();
      const errors = [];
      let owner;
      while (owner = owners.pop()) errors.push(...clean(owner));
      return errors;
    },
    stats() {
      return Object.freeze({ disposed, ownerCount: owners.length, waiterCount: waiters.size });
    }
  });
}
function clean(callback) {
  try {
    callback();
    return [];
  } catch (error) {
    return [error];
  }
}
var MAX_CLEARANCE_FRACTION = 10 ** 0.1 - 1;
function conjugateRotation([x, y, z, w]) {
  return [-x, -y, -z, w];
}
function isTrackballMetrics(metrics) {
  return metrics !== null && typeof metrics === "object" && Number.isFinite(metrics.centerX) && Number.isFinite(metrics.centerY) && (metrics.opticalCenterX === void 0 || Number.isFinite(metrics.opticalCenterX)) && (metrics.opticalCenterY === void 0 || Number.isFinite(metrics.opticalCenterY)) && Number.isFinite(metrics.radius) && metrics.radius > 0 && (metrics.pitchResponse === void 0 || Number.isFinite(metrics.pitchResponse) && metrics.pitchResponse > 0);
}
function projectSphereDrag({
  previousX,
  previousY,
  currentX,
  currentY,
  centerX,
  centerY,
  radius,
  focalLength,
  opticalCenterX = centerX,
  opticalCenterY = centerY
}) {
  if (![
    previousX,
    previousY,
    currentX,
    currentY,
    centerX,
    centerY,
    opticalCenterX,
    opticalCenterY,
    radius,
    focalLength
  ].every(Number.isFinite) || radius <= 0 || focalLength <= 0) {
    throw new TypeError("Sphere drag projection is invalid.");
  }
  const distance = Math.hypot(1, focalLength / radius);
  const project = (x2, y2) => {
    let u = (x2 - centerX) / focalLength;
    let v = (y2 - centerY) / focalLength;
    let radial = u * u + v * v;
    const limb = 1 / (distance * distance - 1);
    const onRim = radial >= limb * (1 - 1e-14);
    if (onRim) {
      const scale3 = Math.sqrt(limb / radial);
      u *= scale3;
      v *= scale3;
      radial = limb;
    }
    const t = onRim ? distance - 1 / distance : (distance - Math.sqrt(Math.max(
      0,
      1 - radial * (distance * distance - 1)
    ))) / (1 + radial);
    const point = [t * u, t * v, distance - t];
    const length2 = Math.hypot(...point);
    return point.map((value) => value / length2);
  };
  const a = project(previousX, previousY);
  const b = project(currentX, currentY);
  const rotation = [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
    1 + a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  ];
  const length = Math.hypot(...rotation);
  const result = rotation.map((value) => value / length);
  if (opticalCenterX === centerX && opticalCenterY === centerY) return result;
  const dx = centerX - opticalCenterX, dy = centerY - opticalCenterY;
  const distanceToEye = Math.hypot(dx, dy, focalLength);
  const vx = dy / distanceToEye, vy = -dx / distanceToEye;
  const [x, y, z, w] = result;
  const tx = vy * z, ty = -vx * z, tz = vx * y - vy * x;
  const divisor = 1 + focalLength / distanceToEye;
  return [
    x + tx + vy * tz / divisor,
    y + ty - vx * tz / divisor,
    z + tz + (vx * ty - vy * tx) / divisor,
    w
  ];
}
function composeDragRotation(next, previous) {
  const [x, y, z, w] = next;
  const [a, b, c, d] = previous;
  return [
    w * a + x * d + y * c - z * b,
    w * b - x * c + y * d + z * a,
    w * c + x * b - y * a + z * d,
    w * d - x * a - y * b - z * c
  ];
}
function rotationFromAngularVelocity(velocity, elapsedMilliseconds) {
  const speed = Math.hypot(...velocity);
  if (speed < 1e-12) return [0, 0, 0, 1];
  const halfAngle = speed * elapsedMilliseconds / 2;
  const scale3 = Math.sin(halfAngle) / speed;
  return [
    velocity[0] * scale3,
    velocity[1] * scale3,
    velocity[2] * scale3,
    Math.cos(halfAngle)
  ];
}
var TRACKBALL_DRAG_INERTIA = Object.freeze({
  schema: "cssearth-trackball-throw@10",
  qualification: "REFERENCE_APP_7.3.7.1327_NATIVE_PROJECTION_AND_DECOMPILED_THROW",
  rendererSha256: "11c6efe1ea0a75535485ab3804a09fc6f2ad3dd7c43f8c7d695a48d928890cd0",
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
    maximumDegrees: 52.5
  }),
  directPitchResponse: 1,
  directPitchResponseByZoom: Object.freeze({
    model: "linear-clamped-native-pure-vertical-fit",
    intercept: 0.9768198038991756,
    slopePerZoom: 0.21000705516484433,
    minimum: 1.2025381100738586,
    maximum: 1.3504854183805297
  }),
  directPitchResponseEvidence: Object.freeze({
    model: "two-point-native-endpoint-to-browser-pure-vertical-fit",
    calibrationScenarios: Object.freeze([
      "training-baseline-high-vertical-near",
      "training-baseline-high-vertical-far"
    ])
  }),
  maximumPitchVelocityDegreesPerSecond: 30,
  maximumYawVelocityDegreesPerSecond: 90,
  rotationalDampingSeconds: 1.2,
  stopVelocityRatio: 33e-4,
  sourceFunctions: Object.freeze({
    configuration: "0x005b93a0",
    trackballConstructor: "0x005ae654",
    directTrackballMove: "0x005aec2c+0x005d10a2+0x005d1d70",
    releaseThrow: "0x005ae6ea",
    velocityAverage: "0x005ae936",
    rotationalDecay: "0x005b082c+0x005d23cc"
  })
});
function createDragHistory() {
  const capacity = TRACKBALL_DRAG_INERTIA.historyCapacity;
  return {
    x: new Float64Array(capacity),
    y: new Float64Array(capacity),
    timestamp: new Float64Array(capacity),
    pitch: new Float64Array(capacity),
    yaw: new Float64Array(capacity),
    length: 0,
    next: 0
  };
}
function resetDragHistory(history) {
  validateHistory(history);
  history.length = 0;
  history.next = 0;
}
function recordDragSample(history, sample) {
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
    TRACKBALL_DRAG_INERTIA.historyCapacity
  );
  return history;
}
function projectTrackballDelta({
  previousX,
  previousY,
  currentX,
  currentY,
  centerX,
  centerY,
  radius,
  angularDegreesPerTrackballRadius = TRACKBALL_DRAG_INERTIA.directAngularDegreesPerTrackballRadius
}) {
  const values = [
    previousX,
    previousY,
    currentX,
    currentY,
    centerX,
    centerY,
    radius,
    angularDegreesPerTrackballRadius
  ];
  if (values.some((value) => !Number.isFinite(value)) || radius <= 0) {
    throw new TypeError("Trackball projection is invalid.");
  }
  const degreesPerPixel = angularDegreesPerTrackballRadius / radius;
  const pitchDegrees = (currentY - previousY) * degreesPerPixel;
  const yawDegrees = (currentX - previousX) * degreesPerPixel;
  return Object.freeze({
    pitchDegrees: Math.abs(pitchDegrees) < 1e-12 ? 0 : pitchDegrees,
    yawDegrees: Math.abs(yawDegrees) < 1e-12 ? 0 : yawDegrees
  });
}
function estimateDragThrow({
  history,
  releaseTimestamp,
  frameMilliseconds = 1e3 / 60,
  trackball,
  projectRotation = projectSphereDrag
}) {
  validateHistory(history);
  if (!Number.isFinite(releaseTimestamp) || !Number.isFinite(frameMilliseconds) || frameMilliseconds <= 0 || typeof projectRotation !== "function") {
    throw new TypeError("Drag throw inputs are invalid.");
  }
  if (history.length < 2) return null;
  const latestOffset = history.length - 1;
  const latestIndex = historyIndex(history, latestOffset);
  const freshness = releaseTimestamp - history.timestamp[latestIndex];
  if (freshness < 0 || freshness > TRACKBALL_DRAG_INERTIA.releaseFreshnessMilliseconds) {
    return null;
  }
  const gateOffset = Math.max(0, history.length - 3);
  const gateIndex = historyIndex(history, gateOffset);
  const previousIndex = historyIndex(history, latestOffset - 1);
  const beforeGateIndex = historyIndex(history, Math.max(0, gateOffset - 1));
  if (Math.hypot(
    history.x[latestIndex] - history.x[previousIndex] - (history.x[gateIndex] - history.x[beforeGateIndex]),
    history.y[latestIndex] - history.y[previousIndex] - (history.y[gateIndex] - history.y[beforeGateIndex])
  ) < TRACKBALL_DRAG_INERTIA.minimumThrowDisplacementPixels) {
    return null;
  }
  const averagingWindow = frameMilliseconds * TRACKBALL_DRAG_INERTIA.averagingFrameCount;
  let averageStartOffset = history.length - 2;
  let includedIntervals = 1;
  while (averageStartOffset > 0) {
    const elapsedToCurrentStart = releaseTimestamp - history.timestamp[historyIndex(history, averageStartOffset)];
    if (includedIntervals > 1 && elapsedToCurrentStart > averagingWindow) {
      break;
    }
    averageStartOffset -= 1;
    includedIntervals += 1;
  }
  const averageStartIndex = historyIndex(history, averageStartOffset);
  const elapsed = releaseTimestamp - history.timestamp[averageStartIndex];
  if (elapsed <= 0) return null;
  const maximumPitchVelocity = TRACKBALL_DRAG_INERTIA.maximumPitchVelocityDegreesPerSecond / 1e3;
  const maximumYawVelocity = TRACKBALL_DRAG_INERTIA.maximumYawVelocityDegreesPerSecond / 1e3;
  const pitch = clamp2(
    (history.pitch[latestIndex] - history.pitch[averageStartIndex]) / elapsed,
    -maximumPitchVelocity,
    maximumPitchVelocity
  );
  const yaw = clamp2(
    (history.yaw[latestIndex] - history.yaw[averageStartIndex]) / elapsed,
    -maximumYawVelocity,
    maximumYawVelocity
  );
  const speed = Math.hypot(pitch, yaw);
  if (speed === 0) return null;
  const delta = projectRotation({
    previousX: history.x[latestIndex],
    previousY: history.y[latestIndex],
    currentX: history.x[latestIndex] + (history.x[latestIndex] - history.x[averageStartIndex]) / elapsed * frameMilliseconds,
    currentY: history.y[latestIndex] + (history.y[latestIndex] - history.y[averageStartIndex]) / elapsed * frameMilliseconds,
    centerX: trackball?.centerX,
    centerY: trackball?.centerY,
    opticalCenterX: trackball?.opticalCenterX,
    opticalCenterY: trackball?.opticalCenterY,
    radius: trackball?.surfaceRadius,
    focalLength: trackball?.focalLength
  });
  const sine = Math.hypot(delta[0], delta[1], delta[2]);
  const angle = 2 * Math.atan2(sine, Math.abs(delta[3]));
  const scale3 = sine > 1e-12 ? angle / (sine * frameMilliseconds) * (delta[3] < 0 ? -1 : 1) : 0;
  return Object.freeze({
    pitchDegreesPerMillisecond: pitch,
    yawDegreesPerMillisecond: yaw,
    initialSpeedDegreesPerMillisecond: speed,
    averagingSampleCount: history.length - averageStartOffset,
    averagingMilliseconds: elapsed,
    launchRotation: Object.freeze(delta),
    angularVelocity: Object.freeze([
      delta[0] * scale3,
      delta[1] * scale3,
      delta[2] * scale3
    ])
  });
}
function advanceDragThrow({
  pitchDegreesPerMillisecond,
  yawDegreesPerMillisecond,
  initialSpeedDegreesPerMillisecond,
  elapsedMilliseconds
}) {
  const values = [
    pitchDegreesPerMillisecond,
    yawDegreesPerMillisecond,
    initialSpeedDegreesPerMillisecond,
    elapsedMilliseconds
  ];
  if (values.some((value) => !Number.isFinite(value)) || initialSpeedDegreesPerMillisecond <= 0 || elapsedMilliseconds < 0) {
    throw new TypeError("Drag throw step is invalid.");
  }
  const dampingMilliseconds = TRACKBALL_DRAG_INERTIA.rotationalDampingSeconds * 1e3;
  const multiplier = clamp2(
    1 - elapsedMilliseconds / dampingMilliseconds,
    0,
    1
  );
  const pitch = pitchDegreesPerMillisecond * multiplier;
  const yaw = yawDegreesPerMillisecond * multiplier;
  const speed = Math.hypot(pitch, yaw);
  return Object.freeze({
    pitchDegreesPerMillisecond: pitch,
    yawDegreesPerMillisecond: yaw,
    pitchDeltaDegrees: pitch * elapsedMilliseconds,
    yawDeltaDegrees: yaw * elapsedMilliseconds,
    active: speed > initialSpeedDegreesPerMillisecond * TRACKBALL_DRAG_INERTIA.stopVelocityRatio
  });
}
function historyIndex(history, offset) {
  const capacity = TRACKBALL_DRAG_INERTIA.historyCapacity;
  return (history.next - history.length + offset + capacity) % capacity;
}
function validateHistory(history) {
  const capacity = TRACKBALL_DRAG_INERTIA.historyCapacity;
  if (history === null || typeof history !== "object" || !(history.x instanceof Float64Array) || history.x.length !== capacity || !(history.y instanceof Float64Array) || history.y.length !== capacity || !(history.timestamp instanceof Float64Array) || history.timestamp.length !== capacity || !(history.pitch instanceof Float64Array) || history.pitch.length !== capacity || !(history.yaw instanceof Float64Array) || history.yaw.length !== capacity || !Number.isInteger(history.length) || history.length < 0 || history.length > capacity || !Number.isInteger(history.next) || history.next < 0 || history.next >= capacity) {
    throw new TypeError("Drag history is invalid.");
  }
}
function isSample(sample) {
  return sample !== null && typeof sample === "object" && Number.isFinite(sample.x) && Number.isFinite(sample.y) && Number.isFinite(sample.timestamp) && Number.isFinite(sample.pitch) && Number.isFinite(sample.yaw);
}
function clamp2(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
var ADAPTATION_LUMINANCE_CD_M2 = 0.052;
var EXPOSURE_SCALE = 2;
var STAR_LINEAR_SCALE = 1.0727;
var STAR_RADIUS_MAX_PX = 1.25;
var STAR_INTENSITY_MAX = 0.95;
var HALO_PEAK = 0.08;
var SCREEN_FACTOR_RANGE = Object.freeze([0.7, 1.5]);
var EXPOSURE_KNOBS = Object.freeze({
  adaptationLuminanceCdM2: ADAPTATION_LUMINANCE_CD_M2,
  exposureScale: EXPOSURE_SCALE,
  intensityMax: STAR_INTENSITY_MAX,
  maxRadiusPx: STAR_RADIUS_MAX_PX,
  haloPeak: HALO_PEAK,
  linearScale: STAR_LINEAR_SCALE
});
var STAR_LABEL_POLICY = Object.freeze({
  capPixels: 12,
  gapPixels: 7,
  spacingPixels: 4,
  boxHeightCaps: 2.2,
  poolSize: 1,
  maxAlpha: 0.55,
  maxAlphaStep: 0.1,
  capHeightEm: 0.72,
  magnitudeOffset: 0,
  color: "#f4f6fb",
  fontWeight: 500,
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
});
var DEFAULT_LABEL_POLICY = Object.freeze({
  model: "priority-declutter-cap-height-captions",
  // Height of a capital letter on screen: the shell's navigation labels
  // (14 px in the UI stack, cap height 0.72 em); the reference's own 12 px
  // is a session knob away (the runtime's label policy setter).
  capPixels: 10.08,
  // Gap between the marker's edge and the bottom of the caption.
  gapPixels: 7,
  // Clearance two captions must keep (the reference's LABEL_SPACING_PIXELS).
  spacingPixels: 4,
  // Box height in cap heights (ascenders and descenders included).
  boxHeightCaps: 2.2,
  // Retained slots; also the most captions ever visible at once.
  poolSize: 8,
  // Candidate capacity of the one pass.
  candidateCapacity: 64,
  // Alpha ceiling and the largest alpha change per publication.
  maxAlpha: 0.72,
  maxAlphaStep: 0.1,
  // Cap height of the shell's UI font stack as a share of the em: the
  // reference's own fallback for fonts without ink metrics (system-ui
  // faces measure 0.70-0.73); the acceptance test measures the painted
  // capitals against `capPixels` with that spread as its tolerance.
  capHeightEm: 0.72
});

// src/platform/vector3.mts
function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

// src/renderers/css/navigation/surface-fly-to.ts
var SURFACE_FLY_TO = Object.freeze({
  schema: "cssearth-surface-fly-to@4",
  qualification: "REFERENCE_APP_7.3.7.1327_NATIVE_TRAINING_FIT",
  rendererSha256: "11c6efe1ea0a75535485ab3804a09fc6f2ad3dd7c43f8c7d695a48d928890cd0",
  durationMilliseconds: 3652.3984590021428,
  angularDurationMilliseconds: 3652.3984590021428,
  zoomPrimaryDurationMilliseconds: 3652.3984590021428,
  zoomPrimaryCompletion: 1,
  targetRangeRatio: 0.25,
  angularResponse: 1.0050401414502155,
  perspectiveZoom: Object.freeze({
    referenceZoom: 0.5199,
    referenceDistanceRadii: 5.742498397827148,
    distanceScale: 2.9399086754878945
  }),
  swoopOutThresholdDegrees: 12,
  swoopOutZoomFactor: 2e-3,
  sourceFunctions: Object.freeze({
    configuration: "0x005c389a",
    targetOnSkyType: "earth::evll::SwoopMotionHandleTargetOnSky",
    motionConstructor: "0x005bfc70",
    motionStep: "0x005c0878"
  }),
  trainingEvidence: Object.freeze({
    corpus: "interaction-corpus-v1.json",
    comparison: "comparison-training/report.json",
    fixedTimeAlignmentHz: 60
  })
});
var FLY_TO_RESPONSE_KNOTS = Object.freeze([
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
  Object.freeze([1, 1, 1])
]);
var SOURCE_OBJECT_BASIS = Object.freeze([
  Object.freeze([
    -0.7418335167296961,
    -0.4253134980693789,
    0.5184507974061892
  ]),
  Object.freeze([
    -0.5735566096990734,
    0.0018513086810529322,
    -0.8191637819798022
  ]),
  Object.freeze([
    -0.34744164298186603,
    0.9050440627098558,
    0.245314506412372
  ])
]);
function planSurfaceFlyTo({
  clientX,
  clientY,
  trackball,
  currentZoom,
  minimumZoom,
  maximumZoom
}) {
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
    maximumZoom
  ];
  if (values.some((value) => !Number.isFinite(value)) || trackball.radius <= 0 || trackball.surfaceRadius <= 0 || trackball.focalLength <= 0 || minimumZoom <= 0 || maximumZoom < minimumZoom || currentZoom <= 0) {
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
    ...trackball
  });
  const rawAngularDistanceDegrees = Math.hypot(
    projected.pitchDegrees,
    projected.yawDegrees
  );
  const pitchDeltaDegrees = projected.pitchDegrees * SURFACE_FLY_TO.angularResponse;
  const yawDeltaDegrees = projected.yawDegrees * SURFACE_FLY_TO.angularResponse;
  const angularDistanceDegrees = rawAngularDistanceDegrees * SURFACE_FLY_TO.angularResponse;
  const targetRotation = surfaceTargetRotation({
    clientX,
    clientY,
    trackball
  });
  const { distance: startDistance, range } = surfaceIntersection(clientX, clientY, trackball);
  const desiredDistance = 1 + range * SURFACE_FLY_TO.targetRangeRatio;
  const targetZoom = clamp(
    currentZoom * Math.sqrt(
      (startDistance * startDistance - 1) / (desiredDistance * desiredDistance - 1)
    ),
    minimumZoom,
    maximumZoom
  );
  const targetDistance = Math.sqrt(1 + (startDistance * startDistance - 1) * (currentZoom / targetZoom) ** 2);
  return Object.freeze({
    schema: SURFACE_FLY_TO.schema,
    pitchDeltaDegrees,
    yawDeltaDegrees,
    rawAngularDistanceDegrees,
    angularDistanceDegrees,
    targetRotation,
    startZoom: clamp(currentZoom, minimumZoom, maximumZoom),
    targetZoom,
    startDistance,
    targetDistance,
    minimumZoom,
    maximumZoom,
    swoopOut: rawAngularDistanceDegrees >= SURFACE_FLY_TO.swoopOutThresholdDegrees
  });
}
function sampleSurfaceFlyTo(plan, progress) {
  if (plan?.schema !== SURFACE_FLY_TO.schema || !Number.isFinite(progress)) {
    throw new TypeError("Surface fly-to sample is invalid.");
  }
  const time = clamp(progress, 0, 1);
  const [motionProgress, zoomProgress] = responseAt(time);
  const distance = plan.startDistance + (plan.targetDistance - plan.startDistance) * zoomProgress;
  const directZoom = plan.startZoom * Math.sqrt(
    (plan.startDistance * plan.startDistance - 1) / (distance * distance - 1)
  );
  const pitchDeltaDegrees = plan.pitchDeltaDegrees * motionProgress;
  const yawDeltaDegrees = plan.yawDeltaDegrees * motionProgress;
  return Object.freeze({
    pitchDeltaDegrees: Math.abs(pitchDeltaDegrees) < 1e-12 ? 0 : pitchDeltaDegrees,
    yawDeltaDegrees: Math.abs(yawDeltaDegrees) < 1e-12 ? 0 : yawDeltaDegrees,
    rotation: quaternionPower(plan.targetRotation, motionProgress),
    zoom: time === 1 ? plan.targetZoom : clamp(directZoom, plan.minimumZoom, plan.maximumZoom),
    complete: time === 1
  });
}
function responseAt(progress) {
  const upperIndex = FLY_TO_RESPONSE_KNOTS.findIndex(
    ([time]) => time >= progress
  );
  if (upperIndex <= 0) return FLY_TO_RESPONSE_KNOTS[0].slice(1);
  const lower = FLY_TO_RESPONSE_KNOTS[upperIndex - 1];
  const upper = FLY_TO_RESPONSE_KNOTS[upperIndex];
  const amount = (progress - lower[0]) / (upper[0] - lower[0]);
  return [
    lower[1] + (upper[1] - lower[1]) * amount,
    lower[2] + (upper[2] - lower[2]) * amount
  ];
}
function surfaceIntersection(clientX, clientY, trackball) {
  const x = (clientX - trackball.centerX) / trackball.focalLength;
  const y = (clientY - trackball.centerY) / trackball.focalLength;
  const distance = Math.hypot(1, trackball.focalLength / trackball.surfaceRadius);
  const radial = x * x + y * y;
  const t = (distance - Math.sqrt(Math.max(0, 1 - radial * (distance * distance - 1)))) / (1 + radial);
  return { distance, range: t * Math.sqrt(1 + radial) };
}
function surfaceTargetRotation({ clientX, clientY, trackball }) {
  const scene = matrixRotation(trackball.sceneMatrix);
  const source = multiply3(multiply3(flipY(), scene), SOURCE_OBJECT_BASIS);
  const x = (clientX - trackball.centerX) / trackball.focalLength;
  const y = (clientY - trackball.centerY) / trackball.focalLength;
  const distance = Math.hypot(
    1,
    trackball.focalLength / trackball.surfaceRadius
  );
  const radial = x * x + y * y;
  const tangent = radial > 1 / (distance * distance - 1) ? distance - 1 / distance : (distance - Math.sqrt(Math.max(
    0,
    1 - radial * (distance * distance - 1)
  ))) / (1 + radial);
  const sourceNormal = normalize3([
    tangent * x,
    -tangent * y,
    distance - tangent
  ]);
  const localNormal = multiplyVector3(transpose3(source), sourceNormal);
  const currentFrame = surfaceFrame(source[2]);
  const heading = multiply3(source, transpose3(currentFrame));
  const target = multiply3(
    heading,
    surfaceFrame(localNormal, currentFrame[0])
  );
  const sourceDelta = multiply3(target, transpose3(source));
  const sceneDelta = multiply3(multiply3(flipY(), sourceDelta), flipY());
  return quaternionPower(
    matrixQuaternion(sceneDelta),
    SURFACE_FLY_TO.angularResponse
  );
}
function surfaceFrame(normal, fallbackRight = [1, 0, 0]) {
  const candidate = cross3([0, 1, 0], normal);
  const projectedFallback = fallbackRight.map((value, index) => value - normal[index] * fallbackRight.reduce((sum, component, offset) => sum + component * normal[offset], 0));
  const right = normalize3(Math.hypot(...candidate) > 1e-9 ? candidate : projectedFallback);
  return [right, cross3(normal, right), normal];
}
function matrixRotation(value) {
  const matrix = typeof value === "string" && value.startsWith("matrix3d(") ? value.slice(9, -1).split(",").map(Number) : value;
  if (!Array.isArray(matrix) || matrix.length !== 16 || matrix.some((component) => !Number.isFinite(component))) {
    throw new TypeError("Surface fly-to scene matrix is invalid.");
  }
  return [
    [matrix[0], matrix[4], matrix[8]],
    [matrix[1], matrix[5], matrix[9]],
    [matrix[2], matrix[6], matrix[10]]
  ];
}
function matrixQuaternion(matrix) {
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
    const axis = matrix[0][0] > matrix[1][1] ? matrix[0][0] > matrix[2][2] ? 0 : 2 : matrix[1][1] > matrix[2][2] ? 1 : 2;
    const first = axis;
    const second = (axis + 1) % 3;
    const third = (axis + 2) % 3;
    const scale = 2 * Math.sqrt(
      1 + matrix[first][first] - matrix[second][second] - matrix[third][third]
    );
    const components = [0, 0, 0];
    components[first] = scale / 4;
    components[second] = (matrix[second][first] + matrix[first][second]) / scale;
    components[third] = (matrix[third][first] + matrix[first][third]) / scale;
    [x, y, z] = components;
    w = (matrix[third][second] - matrix[second][third]) / scale;
  }
  return normalize4([x, y, z, w]);
}
function quaternionPower(rotation, amount) {
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
    Math.cos(angle)
  ];
}
function multiply3(first, second) {
  return first.map((row) => row.map((_, column) => row.reduce((sum, value, index) => sum + value * second[index][column], 0)));
}
function multiplyVector3(matrix, vector) {
  return matrix.map((row) => row.reduce((sum, value, index) => sum + value * vector[index], 0));
}
function transpose3(matrix) {
  return matrix[0].map((_, column) => matrix.map((row) => row[column]));
}
function flipY() {
  return [[1, 0, 0], [0, -1, 0], [0, 0, 1]];
}
function normalize3(vector) {
  const length = Math.hypot(...vector);
  if (length < 1e-12) {
    throw new TypeError("Surface fly-to target is singular.");
  }
  return vector.map((value) => value / length);
}
function normalize4(vector) {
  const length = Math.hypot(...vector);
  return vector.map((value) => value / length);
}
function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

// src/renderers/css/navigation/camera-input-diagnostics.ts
function dragControlDiagnostics({ skyGesture, pointerActive, inertiaActive, flyToActive, surfaceFlyToEnabled, activeMode, pointerDragging, inertiaStarts, inertiaFrames, inertiaCancels, pointerCancels, interruptionCounts, lastInterruption, flyToStarts, flyToFrames, flyToCompletions, flyToCancels }) {
  return Object.freeze({
    schema: TRACKBALL_DRAG_INERTIA.schema,
    projection: skyGesture && (pointerActive || inertiaActive) ? "screen-plane-orbit" : "screen-space-sphere",
    historyStorage: "fixed-capacity-float64-ring",
    activeMode,
    activeMotionCount: Number(pointerDragging) + Number(inertiaActive) + Number(flyToActive),
    pendingPointer: pointerActive && !pointerDragging,
    active: inertiaActive,
    starts: inertiaStarts,
    frames: inertiaFrames,
    cancels: inertiaCancels,
    pointerCancels,
    interruptions: Object.freeze({ ...interruptionCounts }),
    lastInterruption,
    surfaceFlyTo: Object.freeze({
      schema: SURFACE_FLY_TO.schema,
      qualification: SURFACE_FLY_TO.qualification,
      enabled: surfaceFlyToEnabled,
      active: flyToActive,
      starts: flyToStarts,
      frames: flyToFrames,
      completions: flyToCompletions,
      cancels: flyToCancels
    })
  });
}

// src/renderers/css/navigation/camera-input-listeners.ts
function bindCameraInputListeners({
  inputSurface,
  windowTarget,
  lifetime,
  guardNative,
  onPointerDown,
  onPointerMove,
  endPointer,
  onMouseDown,
  onDoubleClick,
  onWheel,
  onMotionCommand
}) {
  const listen = (name, callback, options) => {
    const guarded = guardNative(callback);
    lifetime.onDispose(() => inputSurface.removeEventListener(name, guarded));
    inputSurface.addEventListener(name, guarded, options);
  };
  listen("pointerdown", onPointerDown);
  listen("pointermove", onPointerMove);
  listen("pointerup", endPointer);
  listen("pointercancel", endPointer);
  listen("lostpointercapture", endPointer);
  listen("mousedown", onMouseDown);
  listen("dblclick", onDoubleClick);
  listen("wheel", onWheel, { passive: false });
  lifetime.onDispose(() => inputSurface.style.removeProperty("user-select"));
  lifetime.onDispose(() => inputSurface.style.removeProperty("cursor"));
  for (const [target, type] of [[windowTarget, "keydown"], [inputSurface.ownerDocument, "visibilitychange"]]) {
    if (!target?.addEventListener || !target?.removeEventListener) continue;
    lifetime.onDispose(() => target.removeEventListener(type, onMotionCommand));
    target.addEventListener(type, onMotionCommand);
  }
}

// src/renderers/css/navigation/types.ts
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/renderers/css/navigation/cursor-state.ts
var cursors = /* @__PURE__ */ new WeakMap();
function stateFor(surface) {
  const existing = cursors.get(surface);
  if (existing) return existing;
  const state = { base: "", hover: null };
  cursors.set(surface, state);
  return state;
}
function apply(surface, state) {
  surface.style.cursor = state.hover ?? state.base;
}
function setBaseCursor(surface, cursor) {
  const state = stateFor(surface);
  state.base = cursor;
  apply(surface, state);
}
function clearCursor(surface) {
  cursors.delete(surface);
  surface.style.cursor = "";
}

// src/renderers/css/navigation/camera-input.ts
var POINTER_POSITION_EPSILON = 1e-6;
function createUnboundedMatrixDragControls({
  inputSurface,
  cameraMotion,
  runtimePolicy,
  trackballMetrics,
  flyToTrackballMetrics = trackballMetrics,
  rotate,
  surfaceFlyToState = null,
  surfaceFlyToHitTest = null,
  onPointerStart = () => {
  },
  onStart = () => {
  },
  onEnd = () => {
  },
  onError = null
}) {
  validateDragControlsOptions({
    inputSurface,
    cameraMotion,
    runtimePolicy,
    trackballMetrics,
    flyToTrackballMetrics,
    rotate,
    surfaceFlyToState,
    surfaceFlyToHitTest,
    onPointerStart,
    onStart,
    onEnd,
    onError
  });
  const lifetime = createSceneLifetime();
  const guardNative = (callback) => (...args) => {
    if (lifetime.disposed) return;
    try {
      return callback(...args);
    } catch (error) {
      if (onError === null) throw error;
      const cleanupErrors = lifetime.destroy();
      onError(cleanupErrors.length ? new AggregateError([error, ...cleanupErrors], errorMessage(error), { cause: error }) : error);
    }
  };
  let drag = true, wheel = true;
  let press = null;
  const IDLE = Object.freeze({ kind: "idle" });
  let motion = IDLE;
  const announceRotation = (active) => inputSurface.dispatchEvent(new CustomEvent("objectrotationchange", { bubbles: true, detail: { active } }));
  const projectSkyRotation = (trackball, pointer) => {
    const projected = projectTrackballDelta({ ...trackball, ...pointer, radius: trackball.radius });
    return rotationFromAngularVelocity([
      -projected.pitchDegrees * Math.PI / 180,
      projected.yawDegrees * Math.PI / 180,
      0
    ], 1);
  };
  const history = createDragHistory();
  let inertiaStarts = 0, inertiaFrames = 0, inertiaCancels = 0;
  let pointerCancels = 0;
  const surfaceFlightScope = new AbortController();
  lifetime.onDispose(() => surfaceFlightScope.abort());
  const surfaceFlightActive = () => cameraMotion.owns(surfaceFlightScope.signal);
  const currentMode = () => surfaceFlightActive() ? "fly-to" : motion.kind === "fly-to" ? "idle" : motion.kind;
  let flyToStarts = 0, flyToFrames = 0, flyToCompletions = 0, flyToCancels = 0;
  const interruptionCounts = {
    drag: 0,
    pointer: 0,
    wheel: 0,
    "fly-to": 0,
    programmatic: 0,
    disabled: 0,
    destroy: 0
  };
  let lastInterruption = null;
  const windowTarget = inputSurface.ownerDocument.defaultView;
  if (!windowTarget) throw new Error("Input document has no window.");
  const frameClock = createOpacityClock(windowTarget);
  lifetime.onDispose(() => frameClock.destroy());
  const requestFrame = (callback) => frameClock.request(guardNative(callback), "input");
  const cancelFrame = (id) => frameClock.cancel(id);
  const flushPendingDrag = () => {
    const update = press?.pending;
    if (!update) return;
    press.pending = null;
    rotate(update);
  };
  const measureCadence = (timestamp) => {
    const current = press;
    if (current === null) return;
    if (current.cadenceTimestamp !== null && timestamp > current.cadenceTimestamp) {
      current.frameMilliseconds = timestamp - current.cadenceTimestamp;
    }
    current.cadenceTimestamp = timestamp;
    flushPendingDrag();
    if (lifetime.disposed || press !== current) return;
    current.cadenceFrame = requestFrame(measureCadence);
  };
  const endPress = (current) => {
    if (current.cadenceFrame !== null) cancelFrame(current.cadenceFrame);
    if (press === current) press = null;
  };
  let pointerPosition = null;
  const overSurface = (x, y) => {
    if (surfaceFlyToHitTest) return surfaceFlyToHitTest(x, y);
    const metrics = trackballMetrics();
    return Math.hypot(x - metrics.centerX, y - metrics.centerY) <= metrics.surfaceRadius;
  };
  const syncCursor = () => {
    if (lifetime.disposed) return;
    const pressed = press !== null;
    const surface = press !== null ? press.surface : pointerPosition !== null && overSurface(pointerPosition.x, pointerPosition.y);
    const cursor = runtimePolicy.sceneCursor({ surface, pressed, enabled: drag });
    setBaseCursor(inputSurface, cursor ?? "");
  };
  const startMotion = (next) => {
    const idle = motion.kind === "idle";
    motion = next;
    if (idle) onStart();
  };
  const finishInteraction = () => {
    if (motion.kind === "idle") return;
    const rotated = motion.kind === "drag" || motion.kind === "inertia";
    motion = IDLE;
    if (rotated) announceRotation(false);
    onEnd();
  };
  const cancelInertia = () => {
    if (motion.kind !== "inertia") return;
    cancelFrame(motion.frame);
    inertiaCancels += 1;
  };
  const cancelFlyTo = () => cameraMotion.cancel(surfaceFlightScope.signal);
  const cancelPointer = () => {
    const current = press;
    if (current === null) return;
    endPress(current);
    resetDragHistory(history);
    if (inputSurface.hasPointerCapture(current.pointerId)) {
      inputSurface.releasePointerCapture(current.pointerId);
    }
    pointerCancels += 1;
    syncCursor();
  };
  const interruptMotion = (nextMode) => {
    const previousMode = currentMode();
    if (previousMode === "idle" && press === null) return false;
    cancelInertia();
    cancelFlyTo();
    cancelPointer();
    finishInteraction();
    if (previousMode !== "idle") {
      interruptionCounts[nextMode] += 1;
      lastInterruption = Object.freeze({
        from: previousMode,
        to: nextMode
      });
    }
    return true;
  };
  let completedDoublePress = null;
  const beginSurfaceFlyTo = (event) => {
    if (!drag || surfaceFlyToState === null || event.button !== 0) return;
    if (surfaceFlyToHitTest !== null && !surfaceFlyToHitTest(event.clientX, event.clientY)) return false;
    const measuredTrackball = flyToTrackballMetrics();
    if (!isTrackballMetrics(measuredTrackball)) {
      throw new TypeError("Unbounded matrix drag trackball is invalid.");
    }
    const cameraState = surfaceFlyToState();
    const plan = planSurfaceFlyTo({
      clientX: event.clientX,
      clientY: event.clientY,
      trackball: measuredTrackball,
      currentZoom: cameraState?.zoom,
      minimumZoom: cameraState?.minimumZoom,
      maximumZoom: cameraState?.maximumZoom
    });
    if (plan === null) return false;
    event.preventDefault();
    cancelPointer();
    interruptMotion("fly-to");
    flyToStarts += 1;
    startMotion({ kind: "fly-to" });
    if (lifetime.disposed) return;
    let previousPitchDelta = 0, previousYawDelta = 0;
    let previousRotation = [0, 0, 0, 1];
    const flight = cameraMotion.fly({
      windowTarget,
      signal: surfaceFlightScope.signal,
      durationMilliseconds: SURFACE_FLY_TO.durationMilliseconds,
      onFinish(completed) {
        if (completed) flyToCompletions++;
        else flyToCancels++;
        guardNative(finishInteraction)();
      },
      sample(progress, signal) {
        const sample = sampleSurfaceFlyTo(plan, progress);
        const publication = rotate({
          controlPitchDelta: sample.pitchDeltaDegrees - previousPitchDelta,
          controlYawDelta: sample.yawDeltaDegrees - previousYawDelta,
          zoom: sample.zoom,
          rotation: composeDragRotation(sample.rotation, conjugateRotation(previousRotation))
        }, signal);
        previousPitchDelta = sample.pitchDeltaDegrees;
        previousYawDelta = sample.yawDeltaDegrees;
        previousRotation = sample.rotation;
        flyToFrames++;
        return publication;
      }
    });
    void flight.finished.catch(guardNative((error) => {
      throw error;
    }));
    return true;
  };
  const onMouseDown = (event) => {
    if (event.detail !== 2 || event.button !== 0) return;
    if (beginSurfaceFlyTo(event)) completedDoublePress = {
      x: event.clientX,
      y: event.clientY,
      timestamp: event.timeStamp
    };
  };
  const onDoubleClick = (event) => {
    const prior = completedDoublePress;
    completedDoublePress = null;
    if (prior && event.clientX === prior.x && event.clientY === prior.y && event.timeStamp >= prior.timestamp && event.timeStamp - prior.timestamp < 1e3) {
      event.preventDefault();
      return;
    }
    beginSurfaceFlyTo(event);
  };
  const animateInertia = (timestamp) => {
    const inertia = motion;
    if (inertia.kind !== "inertia") return;
    const inertiaState = inertia.state;
    const elapsedMilliseconds = Math.max(
      0,
      timestamp - inertiaState.previousTimestamp
    );
    const step = advanceDragThrow({
      pitchDegreesPerMillisecond: inertiaState.pitchDegreesPerMillisecond,
      yawDegreesPerMillisecond: inertiaState.yawDegreesPerMillisecond,
      initialSpeedDegreesPerMillisecond: inertiaState.initialSpeedDegreesPerMillisecond,
      elapsedMilliseconds
    });
    inertiaState.previousTimestamp = timestamp;
    inertiaState.pitchDegreesPerMillisecond = step.pitchDegreesPerMillisecond;
    inertiaState.yawDegreesPerMillisecond = step.yawDegreesPerMillisecond;
    if (step.pitchDeltaDegrees !== 0 || step.yawDeltaDegrees !== 0) {
      rotate({
        controlPitchDelta: step.pitchDeltaDegrees,
        controlYawDelta: step.yawDeltaDegrees,
        rotation: rotationFromAngularVelocity(
          inertiaState.angularVelocity,
          elapsedMilliseconds * Math.hypot(
            step.pitchDegreesPerMillisecond,
            step.yawDegreesPerMillisecond
          ) / inertiaState.initialSpeedDegreesPerMillisecond
        )
      });
      if (lifetime.disposed || motion !== inertia) return;
      inertiaFrames += 1;
    }
    if (step.active) inertia.frame = requestFrame(animateInertia);
    else finishInteraction();
  };
  const startInertia = (throwState, released, releaseTimestamp, releaseFrameTimestamp) => {
    const { frameMilliseconds } = released;
    const firstStep = advanceDragThrow({
      ...throwState,
      elapsedMilliseconds: frameMilliseconds
    });
    rotate({
      rotation: composeDragRotation(
        rotationFromAngularVelocity(
          throwState.angularVelocity,
          frameMilliseconds * Math.hypot(
            firstStep.pitchDegreesPerMillisecond,
            firstStep.yawDegreesPerMillisecond
          ) / throwState.initialSpeedDegreesPerMillisecond
        ),
        throwState.launchRotation
      ),
      controlPitchDelta: throwState.pitchDegreesPerMillisecond * frameMilliseconds + firstStep.pitchDeltaDegrees,
      controlYawDelta: throwState.yawDegreesPerMillisecond * frameMilliseconds + firstStep.yawDeltaDegrees
    });
    if (lifetime.disposed) return false;
    const state = {
      ...throwState,
      pitchDegreesPerMillisecond: firstStep.pitchDegreesPerMillisecond,
      yawDegreesPerMillisecond: firstStep.yawDegreesPerMillisecond,
      previousTimestamp: releaseFrameTimestamp ?? releaseTimestamp
    };
    inertiaStarts += 1;
    motion = { kind: "inertia", sky: released.sky, state, frame: requestFrame(animateInertia) };
    return true;
  };
  const touches = /* @__PURE__ */ new Map();
  let pinchDistance = null;
  const touchSpread = () => {
    const [a, b] = [...touches.values()];
    return { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  const abandonOrbit = () => {
    const current = press;
    if (current === null) return;
    endPress(current);
    syncCursor();
    if (current.dragging) finishInteraction();
  };
  const onPointerDown = (event) => {
    if (event.pointerType === "touch") touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size === 2 && wheel && pinchDistance === null) {
      event.preventDefault();
      abandonOrbit();
      if (lifetime.disposed) return;
      pinchDistance = touchSpread().distance;
      inputSurface.setPointerCapture(event.pointerId);
      return;
    }
    if (!drag || press !== null || !runtimePolicy.isOrbitDragStart(event)) return;
    if (cameraMotion.hurryForInput()) {
      event.preventDefault();
      return;
    }
    const measuredTrackball = trackballMetrics();
    if (!isTrackballMetrics(measuredTrackball)) {
      throw new TypeError("Unbounded matrix drag trackball is invalid.");
    }
    const startsOnSky = Math.hypot(
      event.clientX - measuredTrackball.centerX,
      event.clientY - measuredTrackball.centerY
    ) > measuredTrackball.surfaceRadius;
    const tumbleOnly = measuredTrackball.tumbleOnly === true;
    if (!runtimePolicy.SKYBOX_DRAG_ENABLED && startsOnSky && !tumbleOnly) return;
    if (event.pointerType !== "mouse") event.preventDefault();
    onPointerStart();
    if (lifetime.disposed) return;
    interruptMotion("pointer");
    cameraMotion.cancel();
    if (lifetime.disposed) return;
    const surface = overSurface(event.clientX, event.clientY);
    pointerPosition = { x: event.clientX, y: event.clientY };
    const current = press = {
      pointerId: event.pointerId,
      dragging: false,
      sky: startsOnSky || tumbleOnly,
      surface,
      trackball: measuredTrackball,
      trackballInvalidated: false,
      x: event.clientX,
      y: event.clientY,
      timestamp: event.timeStamp,
      pitch: 0,
      yaw: 0,
      pending: null,
      cadenceFrame: null,
      cadenceTimestamp: null,
      frameMilliseconds: 1e3 / 60
    };
    current.cadenceFrame = requestFrame(measureCadence);
    resetDragHistory(history);
    recordDragSample(history, { x: event.clientX, y: event.clientY, timestamp: event.timeStamp, pitch: 0, yaw: 0 });
    syncCursor();
    inputSurface.setPointerCapture(event.pointerId);
  };
  const applyPointerSamples = (current, event) => {
    const coalesced = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [];
    const sampleEvents = coalesced.length > 0 ? coalesced : [event];
    let pitchDelta = 0;
    let yawDelta = 0;
    let rotation = [0, 0, 0, 1];
    for (const sampleEvent of sampleEvents) {
      if (Math.abs(sampleEvent.clientX - current.x) <= POINTER_POSITION_EPSILON && Math.abs(sampleEvent.clientY - current.y) <= POINTER_POSITION_EPSILON) {
        continue;
      }
      if (!current.dragging) {
        current.dragging = true;
        startMotion({ kind: "drag" });
        if (lifetime.disposed) return;
        announceRotation(true);
      }
      if (current.trackballInvalidated) {
        const measuredTrackball = trackballMetrics();
        if (!isTrackballMetrics(measuredTrackball)) {
          throw new TypeError("Unbounded matrix drag trackball is invalid.");
        }
        current.trackball = measuredTrackball;
        current.trackballInvalidated = false;
        resetDragHistory(history);
        current.pitch = 0;
        current.yaw = 0;
      }
      const { trackball } = current;
      const pointer = { previousX: current.x, previousY: current.y, currentX: sampleEvent.clientX, currentY: sampleEvent.clientY };
      const projected = projectTrackballDelta({ ...pointer, ...trackball });
      const fittedPitch = projected.pitchDegrees * (current.sky ? 1 : trackball.pitchResponse ?? TRACKBALL_DRAG_INERTIA.directPitchResponse);
      const spherePointer = {
        ...pointer,
        centerX: trackball.centerX,
        centerY: trackball.centerY,
        opticalCenterX: trackball.opticalCenterX,
        opticalCenterY: trackball.opticalCenterY,
        radius: trackball.surfaceRadius,
        focalLength: trackball.focalLength
      };
      const sampleRotation = current.sky ? projectSkyRotation(trackball, spherePointer) : projectSphereDrag(spherePointer);
      rotation = composeDragRotation(sampleRotation, rotation);
      pitchDelta += fittedPitch;
      yawDelta += projected.yawDegrees;
      current.pitch += fittedPitch;
      current.yaw += projected.yawDegrees;
      current.x = sampleEvent.clientX;
      current.y = sampleEvent.clientY;
      current.timestamp = sampleEvent.timeStamp;
      recordDragSample(history, { x: current.x, y: current.y, timestamp: current.timestamp, pitch: current.pitch, yaw: current.yaw });
    }
    if (pitchDelta !== 0 || yawDelta !== 0 || Math.abs(rotation[0]) + Math.abs(rotation[1]) + Math.abs(rotation[2]) > 1e-12) {
      const update = {
        controlPitchDelta: pitchDelta,
        controlYawDelta: yawDelta,
        rotation
      };
      const pending = current.pending;
      current.pending = pending === null ? update : {
        controlPitchDelta: pending.controlPitchDelta + pitchDelta,
        controlYawDelta: pending.controlYawDelta + yawDelta,
        rotation: composeDragRotation(rotation, pending.rotation)
      };
      return update;
    }
    return null;
  };
  const onPointerMove = (event) => {
    if (touches.has(event.pointerId)) touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinchDistance !== null && touches.size === 2 && touches.has(event.pointerId)) {
      event.preventDefault();
      const spread = touchSpread();
      if (spread.distance > 0 && pinchDistance > 0 && spread.distance !== pinchDistance) {
        const deltaY = -Math.log(spread.distance / pinchDistance) * runtimePolicy.TOUCH_PINCH_WHEEL_DELTA;
        pinchDistance = spread.distance;
        inputSurface.dispatchEvent(new windowTarget.WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          deltaY,
          deltaMode: 0,
          clientX: spread.x,
          clientY: spread.y
        }));
      }
      return;
    }
    if (event.isPrimary && event.pointerType !== "touch") {
      pointerPosition = { x: event.clientX, y: event.clientY };
      syncCursor();
    }
    if (!drag || press === null || event.pointerId !== press.pointerId) return;
    event.preventDefault();
    applyPointerSamples(press, event);
  };
  const endPointer = (event) => {
    if (touches.delete(event.pointerId) && pinchDistance !== null) {
      if (touches.size < 2) pinchDistance = null;
      if (inputSurface.hasPointerCapture(event.pointerId)) inputSurface.releasePointerCapture(event.pointerId);
      return;
    }
    const current = press;
    if (current === null || event.pointerId !== current.pointerId) return;
    pointerPosition = { x: event.clientX, y: event.clientY };
    const releaseAge = event.timeStamp - current.timestamp;
    const freshRelease = releaseAge >= 0 && releaseAge <= TRACKBALL_DRAG_INERTIA.releaseFreshnessMilliseconds;
    const { trackball } = current;
    const throwState = current.dragging && event.type === "pointerup" && freshRelease ? estimateDragThrow({
      history,
      releaseTimestamp: event.timeStamp,
      trackball,
      frameMilliseconds: current.frameMilliseconds,
      projectRotation: current.sky ? (pointer) => projectSkyRotation(trackball, pointer) : void 0
    }) : null;
    if (throwState !== null) flushPendingDrag();
    else current.pending = null;
    if (lifetime.disposed) return;
    const releaseFrameTimestamp = current.cadenceTimestamp;
    endPress(current);
    syncCursor();
    if (inputSurface.hasPointerCapture(event.pointerId)) {
      inputSurface.releasePointerCapture(event.pointerId);
    }
    if (throwState !== null && startInertia(throwState, current, event.timeStamp, releaseFrameTimestamp)) return;
    if (current.dragging) finishInteraction();
  };
  const onWheel = (event) => {
    if (!wheel || event.deltaY === 0) return;
    if (press !== null) {
      event.preventDefault();
      interruptMotion("wheel");
      return;
    }
    if (cameraMotion.hurryForInput()) {
      event.preventDefault();
      return;
    }
    interruptMotion("wheel");
    cameraMotion.cancel();
  };
  lifetime.onDispose(() => {
    interruptMotion("destroy");
    clearCursor(inputSurface);
  });
  try {
    bindCameraInputListeners({
      inputSurface,
      windowTarget,
      lifetime,
      guardNative,
      onPointerDown,
      onPointerMove,
      endPointer,
      onMouseDown,
      onDoubleClick,
      onWheel,
      onMotionCommand: guardNative((event) => {
        if ("key" in event && event.key === "Escape") cameraMotion.hurryForInput();
        else if (inputSurface.ownerDocument.hidden) cameraMotion.arrive();
      })
    });
    inputSurface.style.userSelect = "none";
    syncCursor();
  } catch (error) {
    const errors = lifetime.destroy();
    if (errors.length) throw new AggregateError([error, ...errors], "Drag controls construction failed.", { cause: error });
    throw error;
  }
  return Object.freeze({
    update(options) {
      if (lifetime.disposed) return;
      if (options.drag !== void 0) drag = options.drag;
      if (options.wheel !== void 0) wheel = options.wheel;
      if (!drag) interruptMotion("disabled");
      syncCursor();
    },
    stop() {
      if (lifetime.disposed) return;
      interruptMotion("programmatic");
    },
    invalidateTrackball() {
      if (press !== null) press.trackballInvalidated = true;
      syncCursor();
    },
    stats() {
      return dragControlDiagnostics({
        skyGesture: press?.sky ?? (motion.kind === "inertia" && motion.sky),
        pointerActive: press !== null,
        inertiaActive: motion.kind === "inertia",
        flyToActive: surfaceFlightActive(),
        surfaceFlyToEnabled: surfaceFlyToState !== null,
        activeMode: currentMode(),
        pointerDragging: press?.dragging ?? false,
        inertiaStarts,
        inertiaFrames,
        inertiaCancels,
        pointerCancels,
        interruptionCounts,
        lastInterruption,
        flyToStarts,
        flyToFrames,
        flyToCompletions,
        flyToCancels
      });
    },
    destroy() {
      const errors = lifetime.destroy();
      if (errors.length) throw new AggregateError(errors, "Drag controls cleanup failed.");
    }
  });
}

// src/renderers/css/navigation/camera-flight.ts
function createCameraFlight({ windowTarget, signal, paused = false, advance, onFinish = () => {
} }) {
  const controller = new AbortController();
  let frame = null, previousTime = null;
  let elapsedS = 0, speed = 1, settled = false, publishing = false;
  let resolve, reject;
  const finished = new Promise((done, fail2) => {
    resolve = done;
    reject = fail2;
  });
  void finished.catch(() => {
  });
  function settle(completed, failure, reason) {
    if (settled) return;
    settled = true;
    if (frame !== null) windowTarget.cancelAnimationFrame(frame);
    frame = null;
    signal?.removeEventListener("abort", abort);
    try {
      onFinish(completed);
    } catch (error) {
      failure ??= { error };
    }
    if (failure) {
      controller.abort(failure.error);
      reject(failure.error);
    } else {
      if (!completed) controller.abort(reason);
      resolve({ completed });
    }
  }
  function cancel(reason = new DOMException("Camera flight was cancelled.", "AbortError")) {
    settle(false, void 0, reason);
  }
  function fail(error) {
    settle(false, { error });
  }
  function complete() {
    settle(true);
  }
  function abort() {
    cancel(signal?.reason);
  }
  function schedule() {
    if (!settled && !paused && !publishing && frame === null) frame = windowTarget.requestAnimationFrame(paint);
  }
  function accept(result, asynchronous) {
    publishing = false;
    if (settled) return;
    if (result === "complete") {
      complete();
      return;
    }
    if (asynchronous && result === "presented" && !paused) paint(windowTarget.performance.now());
    else schedule();
  }
  function paint(time) {
    frame = null;
    if (settled || paused) return;
    const stepS = previousTime === null ? 0 : Math.max(0, time - previousTime) / 1e3 * speed;
    previousTime = time;
    elapsedS += stepS;
    try {
      const result = advance(elapsedS, stepS);
      if (typeof result === "string") accept(result, false);
      else {
        publishing = true;
        void result.then((value) => accept(value, true), fail);
      }
    } catch (error) {
      fail(error);
    }
  }
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  else schedule();
  return Object.freeze({
    finished,
    signal: controller.signal,
    cancel,
    complete,
    /** Request the final sample, retaining the outstanding presentation acknowledgement. */
    finish() {
      if (settled) return;
      elapsedS = Infinity;
      paused = false;
      if (frame !== null) windowTarget.cancelAnimationFrame(frame);
      frame = null;
      if (!publishing) paint(windowTarget.performance.now());
    },
    hurry(multiplier) {
      speed = multiplier;
    },
    /** Hold at the acknowledged curve position while assets catch up. */
    hold(atElapsedS) {
      paused = true;
      elapsedS = atElapsedS;
      previousTime = null;
      if (frame !== null) windowTarget.cancelAnimationFrame(frame);
      frame = null;
    },
    resume() {
      paused = false;
      schedule();
    }
  });
}

// src/renderers/css/navigation/camera-motion.ts
function createCameraMotion() {
  let active = null;
  const motion = Object.freeze({
    get signal() {
      return active?.flight?.signal;
    },
    owns(signal) {
      return active?.sourceSignal === signal;
    },
    cancel(signal) {
      if (signal && !motion.owns(signal)) return;
      const owner = active;
      active = null;
      owner?.flight?.cancel();
    },
    /** Destination input accelerates arrival; other input can take over. */
    hurryForInput() {
      if (!active?.inputSpeedUp || !active.flight) return false;
      active.flight.hurry(active.inputSpeedUp);
      return true;
    },
    arrive() {
      if (active?.inputSpeedUp) active.flight?.finish();
    },
    start(options) {
      const previous = active, owner = { sourceSignal: options.signal, inputSpeedUp: options.inputSpeedUp };
      active = owner;
      previous?.flight?.cancel();
      const flight = createCameraFlight({ ...options, onFinish(completed) {
        if (active === owner) active = null;
        options.onFinish?.(completed);
      } });
      owner.flight = flight;
      if (active !== owner) flight.cancel();
      return flight;
    },
    fly({ windowTarget, sample, durationMilliseconds, signal, inputSpeedUp, onFinish }) {
      if (!Number.isFinite(durationMilliseconds) || durationMilliseconds < 0) throw new TypeError("Invalid camera flight duration.");
      const clock = createOpacityClock(windowTarget);
      const flight = motion.start({ signal, inputSpeedUp, windowTarget: {
        requestAnimationFrame: (callback) => clock.request(callback, "input"),
        cancelAnimationFrame: (id) => clock.cancel(id),
        performance: { now: clock.now }
      }, onFinish(completed) {
        clock.destroy();
        onFinish?.(completed);
      }, advance(elapsedS) {
        const progress = durationMilliseconds === 0 ? 1 : Math.min(1, elapsedS * 1e3 / durationMilliseconds);
        const acknowledge = (shown = true) => !shown || flight.signal.aborted ? "idle" : progress === 1 ? "complete" : "presented";
        const publication = sample(progress, flight.signal);
        return publication && typeof publication.then === "function" ? publication.then(acknowledge) : acknowledge();
      } });
      if (durationMilliseconds === 0) flight.finish();
      return flight;
    }
  });
  return motion;
}
export {
  createCameraMotion,
  createUnboundedMatrixDragControls
};
