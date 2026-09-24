// <define:import.meta.env>
var define_import_meta_env_default = { PROD: false, MODE: "test" };

// src/renderers/css/navigation/types.ts
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/renderers/css/rendering/retained-leaf-pool.ts
var retainedBlocks = /* @__PURE__ */ new WeakMap();
function createRetainedGeometrySnapshot(nodes) {
  const grouped = /* @__PURE__ */ new Map();
  const individual = [];
  let retainedLeaves = 0;
  for (const node of nodes) {
    const block = node.parentNode && retainedBlocks.get(node.parentNode);
    if (node.tagName !== "S" && !(node.tagName === "path" && block)) continue;
    retainedLeaves++;
    const leaf = node;
    if (!block) {
      individual.push(leaf);
      continue;
    }
    let members = grouped.get(block);
    if (!members) {
      members = [];
      grouped.set(block, members);
    }
    members.push(leaf);
  }
  const complete = [];
  for (const [block, members] of grouped) {
    if (members.length === block.size) complete.push(block);
    else individual.push(...members);
  }
  const retainedNodes = nodes.length;
  return () => ({
    retainedNodes,
    retainedLeaves,
    directlyHiddenLeaves: complete.reduce((sum, block) => sum + block.size - block.visible, 0) + individual.reduce((sum, leaf) => sum + Number(leaf.tagName === "path" ? !leaf.getAttribute("d") : leaf.style.visibility === "hidden"), 0)
  });
}

// src/renderers/css/runtime/object-diagnostics.ts
var publishedDiagnostics = /* @__PURE__ */ new WeakMap();
function publishObjectDiagnostics({ stage, definition, mounted, orbit, selection, controls, resources, playback, lifetime, context, initialSelection, startupDecodedAssets, surfaceFeatures = null, getCurrentView }) {
  const target = stage.ownerDocument.defaultView, key = `__${definition.id}`;
  if (!target) throw new Error("Object diagnostics require the mounted window.");
  const nodes = Object.freeze([...stage.querySelectorAll("*")]);
  let geometry = null;
  const observe = () => mounted.observe();
  const settings = (kind) => () => {
    const current = selection.state().committed ?? initialSelection;
    return Object.freeze(Object.fromEntries((definition.controls.settings?.controls ?? []).filter((control) => kind == null || control.kind === kind).map((control) => [control.name, current[control.name]])));
  };
  const options = Object.freeze({ state: settings("cycle") });
  const features = Object.freeze({ state: settings("toggle") });
  const parents = Object.freeze(nodes.map((node) => node.parentNode));
  const lensState = () => Object.freeze({
    id: selection.state().committed?.lensId ?? initialSelection.lensId,
    ready: selection.state().ready
  });
  const selectLens = (id) => selection.dispatch({ kind: "lens", id });
  const diagnostics = Object.freeze({
    ready: true,
    view: () => orbit.state(),
    setView: (state) => orbit.setState(state),
    lens: lensState,
    selectLens,
    camera: Object.freeze({
      state: orbit.state,
      setState: orbit.setState,
      flyToState: orbit.flyToState,
      stats: orbit.stats,
      publication: orbit.publicationState,
      captureWorldCamera: orbit.captureWorldCamera,
      applyWorldCamera: orbit.applyWorldCamera
    }),
    sky: Object.freeze({
      state: () => Object.freeze({
        ...orbit.skyState(),
        sunViewDirection: getCurrentView()?.sunViewDirection ?? null,
        skySunViewDirection: getCurrentView()?.skySunViewDirection ?? null
      }),
      // The prepared registrations the sky and Sun ride, for tests that
      // project them independently.
      sceneRegistration: definition.sky.sceneRegistration ?? null,
      sunLocalDirection: definition.sun?.localDirection ?? null
    }),
    lenses: Object.freeze({ state: lensState, select: selectLens }),
    options,
    settings: Object.freeze({ state: settings() }),
    features,
    renderStats: Object.freeze({
      selectedPreparedDensity: context.density,
      visibleAssetsDecodedBeforeMount: startupDecodedAssets,
      textureStats: Object.freeze({
        selectedPreparedDensity: context.density,
        get retainedInteractiveImageCount() {
          return resources.stats().images.entries.filter((entry) => entry.ready).length;
        },
        get pendingInteractiveImageCount() {
          return resources.stats().images.entries.filter((entry) => !entry.ready).length;
        }
      })
    }),
    dom: Object.freeze({
      retainedInitialNodeCount: nodes.length,
      retainedLeafCount: stage.querySelectorAll("b, s, u").length,
      runtimeDomGrowth: false,
      runtimeDomGrowthPolicy: "none"
    }),
    runtime: Object.freeze({
      geometry: () => (geometry ??= createRetainedGeometrySnapshot(nodes))(),
      lifetime: lifetime.stats,
      resources: resources.stats,
      playback: playback.stats,
      selection: selection.state,
      controls: controls.stats,
      view: getCurrentView,
      presentation: () => Object.freeze({ ...observe().presentation }),
      surfaceFeatures: () => surfaceFeatures?.stats() ?? null
    }),
    stableNodes: nodes,
    assertStableDomIdentity() {
      const current = [...stage.querySelectorAll("*")];
      if (current.length !== nodes.length || current.some((node, index) => node !== nodes[index] || node.parentNode !== parents[index])) throw new Error("Retained object DOM changed.");
      return true;
    },
    material: Object.freeze({ state: () => Object.freeze({ ...observe().materials }) })
  });
  Reflect.set(target, key, diagnostics);
  let entries = publishedDiagnostics.get(target);
  if (!entries) {
    entries = /* @__PURE__ */ new Map();
    publishedDiagnostics.set(target, entries);
  }
  entries.set(definition.id, diagnostics);
  context.own(() => {
    if (Reflect.get(target, key) === diagnostics) Reflect.deleteProperty(target, key);
    const current = publishedDiagnostics.get(target);
    if (current?.get(definition.id) === diagnostics) current.delete(definition.id);
    if (current?.size === 0) publishedDiagnostics.delete(target);
  });
  return diagnostics;
}

// src/renderers/css/rendering/prepared-object-assets.ts
var CANONICAL_PREPARED_IMAGE_DENSITY = 2;

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
function buildSelectionFlightCurve(startRangeM, endRangeM) {
  if (![startRangeM, endRangeM].every(Number.isFinite)) throw new TypeError("Selection flight ranges must be finite metres.");
  const start = Math.max(1e-3, startRangeM), end = Math.max(1e-3, endRangeM);
  const delta = Math.abs(start - end);
  const nonlinear = delta >= 0.01 * Math.max(start, end);
  if (!nonlinear) return Object.freeze({
    startRangeM: start,
    endRangeM: end,
    rangeDeltaM: delta,
    curveOffset: 0,
    curveSpan: 0,
    coshOffset: 1,
    sinhOffset: 0,
    nonlinear: false,
    durationS: 1.5
  });
  const scaledDelta = 1.96 * delta;
  const curveOffset = Math.asinh((start * start - end * end - scaledDelta * scaledDelta) / (2 * 1.96 * start * delta));
  const curveEnd = Math.asinh((start * start - end * end + scaledDelta * scaledDelta) / (2 * 1.96 * delta * Math.max(end, 1)));
  const curveSpan = (curveEnd - curveOffset) / 1.4;
  return Object.freeze({
    startRangeM: start,
    endRangeM: end,
    rangeDeltaM: delta,
    curveOffset,
    curveSpan,
    coshOffset: Math.cosh(curveOffset),
    sinhOffset: Math.sinh(curveOffset),
    nonlinear: true,
    durationS: Math.min(4.5, Math.max(1.5, curveSpan * (1 / 3.5)))
  });
}
function selectionFlightProgress(curve, time) {
  if (!Number.isFinite(time)) throw new TypeError("Selection flight time must be finite.");
  const t = clamp01(time);
  if (t === 0 || t === 1) return t;
  if (!curve.nonlinear) return smoothstep(t);
  const hyperbolic = Math.tanh(1.4 * curve.curveSpan * t + curve.curveOffset) * curve.coshOffset - curve.sinhOffset;
  return clamp01(curve.startRangeM / 1.96 * hyperbolic / curve.rangeDeltaM);
}
function selectionFlightEnds(curve, time) {
  const t = clamp01(time);
  if (t === 0 || t === 1) return { done: t, remaining: 1 - t };
  if (!curve.nonlinear) return { done: t * t * (3 - 2 * t), remaining: (1 - t) * (1 - t) * (1 + 2 * t) };
  const span = 1.4 * curve.curveSpan, x = span * t + curve.curveOffset, scale3 = Math.sinh(span) * Math.cosh(x);
  return {
    done: clamp01(Math.sinh(span * t) * Math.cosh(curve.curveOffset + span) / scale3),
    remaining: clamp01(Math.sinh(span * (1 - t)) * curve.coshOffset / scale3)
  };
}
function createSelectionFlight({ from, to, focusPositionM, durationS }) {
  validatePose(from);
  validatePose(to);
  validatePosition(focusPositionM);
  if (durationS !== void 0 && (!Number.isFinite(durationS) || durationS <= 0)) throw new TypeError("Flight duration must be positive seconds.");
  const fromOffset = subtract(from.positionM, focusPositionM), toOffset = subtract(to.positionM, focusPositionM);
  const startRangeM = Math.hypot(...fromOffset), endRangeM = Math.hypot(...toOffset);
  if (startRangeM < 1e-3 || endRangeM < 1e-3) throw new TypeError("A selection camera must be at least one millimetre from its focus.");
  const curve = buildSelectionFlightCurve(startRangeM, endRangeM);
  const positionDurationS = durationS ?? curve.durationS;
  return Object.freeze({
    from: copyPose(from),
    to: copyPose(to),
    focusPositionM: copyPosition(focusPositionM),
    fromViewDirection: viewDirection(fromOffset, startRangeM, from.orientationXyzw),
    toViewDirection: viewDirection(toOffset, endRangeM, to.orientationXyzw),
    curve,
    positionDurationS,
    orientationDurationS: positionDurationS,
    durationS: positionDurationS
  });
}
function createSelectionFlightSample() {
  return { positionM: [0, 0, 0], orientationXyzw: [0, 0, 0, 1], progress: 0, complete: false };
}
function sampleSelectionFlightInto(flight, elapsedS, out) {
  if (!Number.isFinite(elapsedS)) throw new TypeError("Flight elapsed time must be finite seconds.");
  const elapsed = Math.max(0, elapsedS);
  const progress = selectionFlightProgress(flight.curve, elapsed / flight.positionDurationS);
  const { done, remaining } = selectionFlightEnds(flight.curve, elapsed / flight.positionDurationS);
  slerpQuaternionInto(out.orientationXyzw, flight.from.orientationXyzw, flight.to.orientationXyzw, progress);
  if (done === 0) copy3Into(out.positionM, flight.from.positionM);
  else if (remaining === 0) copy3Into(out.positionM, flight.to.positionM);
  else {
    slerpDirectionInto(out.positionM, flight.fromViewDirection, flight.toViewDirection, progress);
    rotateVectorInto(out.positionM, out.orientationXyzw, out.positionM);
    const rangeM = done < 0.5 ? flight.curve.startRangeM + (flight.curve.endRangeM - flight.curve.startRangeM) * done : flight.curve.endRangeM + (flight.curve.startRangeM - flight.curve.endRangeM) * remaining;
    for (let axis = 0; axis < 3; axis++) out.positionM[axis] = flight.focusPositionM[axis] + out.positionM[axis] * rangeM;
  }
  out.progress = progress;
  out.complete = elapsed >= flight.durationS;
  return out;
}
function cameraPoseToReferenceFrame(pose, frame) {
  validatePose(pose);
  validateFrame(frame);
  const offset = rotateVector(frame.localToReferenceXyzw, pose.positionM);
  return Object.freeze({ positionM: add(frame.originM, offset), orientationXyzw: multiplyQuaternion(frame.localToReferenceXyzw, pose.orientationXyzw) });
}
function cameraPoseFromReferenceFrame(pose, frame) {
  validatePose(pose);
  validateFrame(frame);
  const [x, y, z, w] = frame.localToReferenceXyzw;
  const inverse = [-x, -y, -z, w];
  return Object.freeze({
    positionM: rotateVector(inverse, subtract(pose.positionM, frame.originM)),
    orientationXyzw: multiplyQuaternion(inverse, pose.orientationXyzw)
  });
}
function slerpDirectionInto(out, from, to, t) {
  const cosine = Math.max(-1, Math.min(1, from[0] * to[0] + from[1] * to[1] + from[2] * to[2]));
  if (cosine > 0.999999) {
    for (let axis = 0; axis < 3; axis++) out[axis] = from[axis] + (to[axis] - from[axis]) * t;
    const length2 = Math.hypot(...out);
    for (let axis = 0; axis < 3; axis++) out[axis] /= length2;
    return;
  }
  let x = to[0] - cosine * from[0], y = to[1] - cosine * from[1], z = to[2] - cosine * from[2];
  let length = Math.hypot(x, y, z);
  if (length < 1e-12) {
    const axis = Math.abs(from[0]) < 0.9 ? 0 : 1;
    const dot2 = from[axis];
    x = Number(axis === 0) - dot2 * from[0];
    y = Number(axis === 1) - dot2 * from[1];
    z = -dot2 * from[2];
    length = Math.hypot(x, y, z);
  }
  const angle = Math.acos(cosine) * t, forward = Math.cos(angle), lateral = Math.sin(angle) / length;
  out[0] = from[0] * forward + x * lateral;
  out[1] = from[1] * forward + y * lateral;
  out[2] = from[2] * forward + z * lateral;
}
function slerpQuaternionInto(out, from, to, t) {
  const dot2 = dot4(from, to), sign = dot2 < 0 ? -1 : 1;
  if (t === 0) {
    for (let axis = 0; axis < 4; axis++) out[axis] = from[axis];
    return;
  }
  if (t === 1) {
    for (let axis = 0; axis < 4; axis++) out[axis] = to[axis] * sign;
    return;
  }
  const cosine = Math.min(1, Math.abs(dot2));
  if (cosine > 0.999999) {
    for (let axis = 0; axis < 4; axis++) out[axis] = from[axis] + (to[axis] * sign - from[axis]) * t;
    const length = Math.hypot(...out);
    for (let axis = 0; axis < 4; axis++) out[axis] /= length;
    return;
  }
  const angle = Math.acos(cosine), sine = Math.sin(angle);
  const a = Math.sin((1 - t) * angle) / sine, b = Math.sin(t * angle) / sine * sign;
  for (let axis = 0; axis < 4; axis++) out[axis] = from[axis] * a + to[axis] * b;
}
function validatePosition(position) {
  if (position.length !== 3 || !position.every(Number.isFinite)) throw new TypeError("Camera coordinates must be three finite metres.");
}
function validateQuaternion(quaternion) {
  if (quaternion.length !== 4 || !quaternion.every(Number.isFinite) || Math.abs(Math.hypot(...quaternion) - 1) > 1e-9) throw new TypeError("Camera orientation must be a unit XYZW quaternion.");
}
function validatePose(pose) {
  validatePosition(pose.positionM);
  validateQuaternion(pose.orientationXyzw);
}
function validateFrame(frame) {
  validatePosition(frame.originM);
  validateQuaternion(frame.localToReferenceXyzw);
}
function copyPosition(value) {
  return Object.freeze([value[0], value[1], value[2]]);
}
function copyPose(pose) {
  const orientationXyzw = Object.freeze([pose.orientationXyzw[0], pose.orientationXyzw[1], pose.orientationXyzw[2], pose.orientationXyzw[3]]);
  return Object.freeze({ positionM: copyPosition(pose.positionM), orientationXyzw });
}
function copy3Into(out, value) {
  out[0] = value[0];
  out[1] = value[1];
  out[2] = value[2];
}
function subtract(a, b) {
  return Object.freeze([a[0] - b[0], a[1] - b[1], a[2] - b[2]]);
}
function add(a, b) {
  return Object.freeze([a[0] + b[0], a[1] + b[1], a[2] + b[2]]);
}
function scale(a, factor) {
  return Object.freeze([a[0] * factor, a[1] * factor, a[2] * factor]);
}
function viewDirection(offset, rangeM, orientation) {
  const [x, y, z, w] = orientation;
  return rotateVector([-x, -y, -z, w], scale(offset, 1 / rangeM));
}
function dot4(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}
function multiplyQuaternion(a, b) {
  const [x, y, z, w] = a, [i, j, k, r] = b;
  return Object.freeze([
    w * i + x * r + y * k - z * j,
    w * j - x * k + y * r + z * i,
    w * k + x * j - y * i + z * r,
    w * r - x * i - y * j - z * k
  ]);
}
function rotateVector(q, value) {
  const out = [0, 0, 0];
  rotateVectorInto(out, q, value);
  return Object.freeze(out);
}
function rotateVectorInto(out, q, value) {
  const [x, y, z, w] = q, [a, b, c] = value;
  const tx = 2 * (y * c - z * b), ty = 2 * (z * a - x * c), tz = 2 * (x * b - y * a);
  out[0] = a + w * tx + y * tz - z * ty;
  out[1] = b + w * ty + z * tx - x * tz;
  out[2] = c + w * tz + x * ty - y * tx;
}
function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
function smoothstep(value) {
  return value * value * (3 - 2 * value);
}
var MAX_CLEARANCE_FRACTION = 10 ** 0.1 - 1;
function preparedScenePitch(controlPitchDegrees, plan) {
  return plan.maximumScenePitchDegrees * (plan.maximumControlPitchDegrees - controlPitchDegrees) / plan.maximumControlPitchDegrees;
}
function conjugateRotation([x, y, z, w]) {
  return [-x, -y, -z, w];
}
function isTrackballMetrics(metrics) {
  return metrics !== null && typeof metrics === "object" && Number.isFinite(metrics.centerX) && Number.isFinite(metrics.centerY) && (metrics.opticalCenterX === void 0 || Number.isFinite(metrics.opticalCenterX)) && (metrics.opticalCenterY === void 0 || Number.isFinite(metrics.opticalCenterY)) && Number.isFinite(metrics.radius) && metrics.radius > 0 && (metrics.pitchResponse === void 0 || Number.isFinite(metrics.pitchResponse) && metrics.pitchResponse > 0);
}
function smoothstep2(minimum, maximum, value) {
  const progress = clamp((value - minimum) / (maximum - minimum), 0, 1);
  return progress * progress * (3 - 2 * progress);
}
function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
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
var smooth = (t) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};
var zoomBetween = (a, b, t) => a * (b / a) ** smooth(t);
function sampleDestinationFlight({ startZoom, targetZoom, overviewZoom, angularDistance }, progress) {
  if (![startZoom, targetZoom, overviewZoom].every((value) => Number.isFinite(value) && value > 0) || !Number.isFinite(angularDistance) || !Number.isFinite(progress)) throw new TypeError("Invalid destination flight.");
  const t = Math.max(0, Math.min(1, progress));
  const distant = angularDistance > 12;
  const endpointZoom = Math.min(startZoom, targetZoom);
  const pullback = endpointZoom > overviewZoom * 8 ? 4 ** smooth((angularDistance - 12) / 78) : 1;
  const controlZoom = endpointZoom / pullback;
  const u = smooth(t);
  const rotation = !distant ? u : startZoom <= targetZoom ? smooth(t / 0.7) : smooth(t ** 1.5);
  const zoom = !distant ? zoomBetween(startZoom, targetZoom, t) : Math.exp((1 - u) ** 2 * Math.log(startZoom) + 2 * u * (1 - u) * Math.log(controlZoom) + u ** 2 * Math.log(targetZoom));
  return { rotation, zoom: t === 0 ? startZoom : t === 1 ? targetZoom : zoom };
}
function rotationAxisAngle(m) {
  const trace = m.m11 + m.m22 + m.m33;
  let x, y, z, w;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    w = s / 4;
    x = (m.m23 - m.m32) / s;
    y = (m.m31 - m.m13) / s;
    z = (m.m12 - m.m21) / s;
  } else if (m.m11 > m.m22 && m.m11 > m.m33) {
    const s = Math.sqrt(1 + m.m11 - m.m22 - m.m33) * 2;
    w = (m.m23 - m.m32) / s;
    x = s / 4;
    y = (m.m21 + m.m12) / s;
    z = (m.m31 + m.m13) / s;
  } else if (m.m22 > m.m33) {
    const s = Math.sqrt(1 + m.m22 - m.m11 - m.m33) * 2;
    w = (m.m31 - m.m13) / s;
    x = (m.m21 + m.m12) / s;
    y = s / 4;
    z = (m.m32 + m.m23) / s;
  } else {
    const s = Math.sqrt(1 + m.m33 - m.m11 - m.m22) * 2;
    w = (m.m12 - m.m21) / s;
    x = (m.m31 + m.m13) / s;
    y = (m.m32 + m.m23) / s;
    z = s / 4;
  }
  if (w < 0) {
    x = -x;
    y = -y;
    z = -z;
    w = -w;
  }
  const length = Math.hypot(x, y, z);
  if (length < 1e-12) return { axis: [1, 0, 0], degrees: 0 };
  return { axis: [x / length, y / length, z / length], degrees: 2 * Math.atan2(length, w) * 180 / Math.PI };
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
function interactionTrackball(metrics) {
  if (!Number.isFinite(metrics?.viewportWidth) || metrics.viewportWidth <= 0) {
    throw new TypeError("Trackball interaction viewport is invalid.");
  }
  return Object.freeze({
    ...metrics,
    renderFocalLength: metrics.focalLength,
    opticalCenterX: metrics.viewportCenterX ?? metrics.opticalCenterX,
    opticalCenterY: metrics.viewportCenterY ?? metrics.opticalCenterY,
    focalLength: metrics.viewportWidth * Math.sqrt(3) / 2
  });
}
function directAngularDegreesPerTrackballRadius(zoom) {
  if (!Number.isFinite(zoom) || zoom <= 0) {
    throw new TypeError("Direct angular response zoom is invalid.");
  }
  const response = TRACKBALL_DRAG_INERTIA.directAngularResponseByZoom;
  return clamp2(
    response.interceptDegrees + response.slopeDegreesPerZoom * zoom,
    response.minimumDegrees,
    response.maximumDegrees
  );
}
function directPitchResponseForZoom(zoom) {
  if (!Number.isFinite(zoom) || zoom <= 0) {
    throw new TypeError("Direct pitch response zoom is invalid.");
  }
  const response = TRACKBALL_DRAG_INERTIA.directPitchResponseByZoom;
  return clamp2(
    response.intercept + response.slopePerZoom * zoom,
    response.minimum,
    response.maximum
  );
}
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

// src/renderers/css/runtime/scene-native-waits.ts
function waitForScenePaint(lifetime, windowTarget = window) {
  if (lifetime.disposed) return Promise.resolve();
  return new Promise((resolve) => {
    let frame = 0;
    lifetime.onDispose(() => {
      if (frame) windowTarget.cancelAnimationFrame(frame);
      frame = 0;
      resolve();
    });
    frame = windowTarget.requestAnimationFrame(() => {
      frame = 0;
      if (lifetime.disposed) return;
      frame = windowTarget.requestAnimationFrame(() => {
        frame = 0;
        resolve();
      });
    });
  });
}
function waitForSceneDocument(lifetime, documentTarget = document) {
  if (lifetime.disposed || documentTarget.readyState !== "loading") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      documentTarget.removeEventListener("DOMContentLoaded", done);
      resolve();
    };
    lifetime.onDispose(done);
    documentTarget.addEventListener("DOMContentLoaded", done, { once: true });
  });
}

// src/renderers/css/rendering/prepared-image-store.ts
async function decodePreparedImage(image, selectedUrl) {
  if (typeof selectedUrl !== "string" || !selectedUrl || typeof image?.decode !== "function") {
    throw new TypeError("Prepared image decoding requires an image and selected URL.");
  }
  try {
    image.src = selectedUrl;
    await image.decode();
    if (!(image.naturalWidth > 0 && image.naturalHeight > 0)) {
      throw new Error("Decoded image has no pixels.");
    }
    return image;
  } catch (cause) {
    throw new Error(`Prepared image did not decode: ${selectedUrl}.`, { cause });
  }
}
function releasePreparedImage(image) {
  if (typeof image.removeAttribute !== "function") {
    image.src = "";
    return;
  }
  const errors = [];
  for (const attribute of ["srcset", "src"]) {
    try {
      image.removeAttribute(attribute);
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) throw new AggregateError(errors, "Prepared image release failed.");
}
function createPreparedImageStore({
  createImage = () => new Image(),
  decoding = "async",
  pools = []
} = {}) {
  const entries = /* @__PURE__ */ new Map(), leases = /* @__PURE__ */ new Set(), poolStates = /* @__PURE__ */ new Map();
  let destroyed = false, pumping = false, retiringOwners = 0, allocations = 0, releases = 0;
  for (const policy of [{ id: null, capacity: Infinity, concurrency: Infinity, reuse: false }, ...pools]) {
    if (poolStates.has(policy.id) || !(policy.capacity >= 1) || !(policy.concurrency >= 1) || policy.decoding !== void 0 && !["auto", "sync", "async"].includes(policy.decoding)) {
      throw new TypeError("Prepared image pool policy is invalid.");
    }
    poolStates.set(policy.id, { ...policy, active: 0, slots: [] });
  }
  function settle(entry, error, value = null) {
    for (const receipt of entry.owners.values()) {
      if (error) receipt.reject(error);
      else receipt.resolve(value);
    }
  }
  function retire(entry) {
    if (entries.get(entry.url) !== entry) return;
    entries.delete(entry.url);
    entry.retired = true;
    if (entry.started && !entry.ready) entry.pool.active--;
    const slot = entry.slot;
    if (!slot) return;
    slot.entry = null;
    releases++;
    if (entry.handedOff) {
      entry.pool.slots.splice(entry.pool.slots.indexOf(slot), 1);
      return;
    }
    try {
      releasePreparedImage(slot.image);
    } catch (error) {
      entry.pool.slots.splice(entry.pool.slots.indexOf(slot), 1);
      throw error;
    } finally {
      if (!entry.pool.reuse && entry.pool.slots.includes(slot)) {
        entry.pool.slots.splice(entry.pool.slots.indexOf(slot), 1);
      }
    }
  }
  function fail(entry, error) {
    if (entry.retired) return;
    try {
      retire(entry);
    } catch (cleanupError) {
      error = new AggregateError([error, cleanupError], error instanceof Error ? error.message : String(error), { cause: error });
    }
    settle(entry, error);
  }
  function pump() {
    if (pumping || destroyed || retiringOwners) return;
    pumping = true;
    try {
      for (const entry of entries.values()) {
        if (!entry.slot || [...entry.owners.values()].some((owner) => owner.pool === entry.pool)) continue;
        const destination = [...entry.owners.values()].map((owner) => owner.pool).find((pool) => pool.slots.filter((slot) => slot.entry !== null).length < pool.capacity && (entry.ready || pool.active < pool.concurrency));
        if (!destination) continue;
        const previous = entry.pool;
        previous.slots.splice(previous.slots.indexOf(entry.slot), 1);
        if (destination.slots.length >= destination.capacity) {
          destination.slots.splice(destination.slots.findIndex((slot) => slot.entry === null), 1);
        }
        destination.slots.push(entry.slot);
        if (entry.started && !entry.ready) {
          previous.active--;
          destination.active++;
        }
        entry.pool = destination;
      }
      for (const entry of entries.values()) {
        const pool = entry.pool;
        if (entry.started || pool.active >= pool.concurrency) continue;
        let slot = pool.slots.find((candidate) => candidate.entry === null);
        if (!slot && pool.slots.length >= pool.capacity) continue;
        try {
          if (!slot) {
            const image = createImage();
            slot = { image, entry: null };
            pool.slots.push(slot);
            allocations++;
          }
          slot.entry = entry;
          entry.slot = slot;
          slot.image.decoding = pool.decoding ?? decoding;
          entry.started = true;
          pool.active++;
          const activeSlot = slot;
          decodePreparedImage(activeSlot.image, entry.url).then((image) => {
            if (entry.retired || activeSlot.entry !== entry) return;
            entry.pool.active--;
            entry.ready = true;
            settle(entry, null, image);
            pump();
          }, (error) => {
            if (entry.retired || activeSlot.entry !== entry) return;
            fail(entry, error);
            pump();
          });
        } catch (error) {
          fail(entry, error);
        }
      }
    } finally {
      pumping = false;
    }
  }
  function createLease(role = "request") {
    if (typeof role !== "string" || !role) throw new TypeError("Prepared resource owner requires a role.");
    const owned = /* @__PURE__ */ new Map();
    let disposed = destroyed;
    const lease = Object.freeze({
      role,
      load(url, { pool: poolId = null } = {}) {
        if (disposed || destroyed) return Promise.resolve(null);
        if (typeof url !== "string" || !url) return Promise.reject(new TypeError("Prepared image URL is missing."));
        const pool = poolStates.get(poolId);
        if (!pool) return Promise.reject(new RangeError(`Unknown prepared image pool: ${poolId}.`));
        let entry = entries.get(url);
        const previous = owned.get(url);
        if (entry && previous?.entry === entry) return previous.promise;
        if (!entry) {
          entry = { url, pool, owners: /* @__PURE__ */ new Map(), started: false, ready: false, retired: false, slot: null };
          entries.set(url, entry);
        }
        let resolveReceipt, rejectReceipt;
        const promise = new Promise((resolve, reject) => {
          resolveReceipt = resolve;
          rejectReceipt = reject;
        });
        const receipt = { entry, pool, promise, resolve: resolveReceipt, reject: rejectReceipt };
        receipt.promise.catch(() => {
        });
        owned.set(url, receipt);
        entry.owners.set(lease, receipt);
        if (entry.ready && entry.slot) receipt.resolve(entry.slot.image);
        pump();
        return receipt.promise;
      },
      handoff(url) {
        const receipt = owned.get(url);
        if (!receipt || !receipt.entry.ready || receipt.entry.retired) {
          throw new Error("Only an owned decoded resource can be handed to retained CSS.");
        }
        receipt.entry.handedOff = true;
        return lease.release(url);
      },
      release(url) {
        const receipt = owned.get(url);
        if (!receipt) return false;
        owned.delete(url);
        const entry = receipt.entry;
        entry.owners.delete(lease);
        receipt.resolve(null);
        try {
          if (!entry.owners.size) retire(entry);
        } finally {
          pump();
        }
        return true;
      },
      destroy() {
        if (disposed) return;
        disposed = true;
        leases.delete(lease);
        const errors = [];
        retiringOwners++;
        try {
          for (const url of owned.keys()) {
            try {
              lease.release(url);
            } catch (error) {
              errors.push(error);
            }
          }
        } finally {
          retiringOwners--;
          pump();
        }
        if (errors.length) throw new AggregateError(errors, "Prepared resource owner cleanup failed.");
      },
      keys: () => Object.freeze([...owned.keys()])
    });
    if (!destroyed) leases.add(lease);
    return lease;
  }
  return Object.freeze({
    createLease,
    // Retire a complete demand set before opening native decode slots again.
    // Individual releases must not start queued work that the same replacement
    // is about to cancel (for example, the remaining pages of a hidden bank).
    batch(callback) {
      if (typeof callback !== "function" || /Async|Generator/.test(callback.constructor?.name)) {
        throw new TypeError("Prepared image batch requires synchronous ownership changes.");
      }
      retiringOwners++;
      try {
        const result = callback();
        if (result && (typeof result === "object" || typeof result === "function") && "then" in result && typeof result.then === "function") {
          Promise.resolve(result).catch(() => {
          });
          throw new TypeError("Prepared image batch cannot return asynchronous work.");
        }
        return result;
      } finally {
        retiringOwners--;
        pump();
      }
    },
    has: (url) => entries.get(url)?.ready === true,
    read: (url) => {
      const entry = entries.get(url);
      return entry?.ready ? entry.slot?.image ?? null : null;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      const errors = [];
      for (const lease of leases) {
        try {
          lease.destroy();
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length) throw new AggregateError(errors, "Prepared image cleanup failed.");
    },
    stats() {
      let retainedCount = 0;
      for (const entry of entries.values()) if (entry.ready) retainedCount++;
      return Object.freeze({ retainedCount, pendingCount: entries.size - retainedCount });
    },
    ownershipStats() {
      return Object.freeze({
        allocations,
        releases,
        entries: Object.freeze([...entries.values()].map((entry) => Object.freeze({
          url: entry.url,
          ready: entry.ready,
          started: entry.started,
          owners: Object.freeze([...entry.owners.keys()].map(({ role }) => role))
        }))),
        pools: Object.freeze([...poolStates.values()].filter(({ id }) => id !== null).map((pool) => Object.freeze({
          id: pool.id,
          active: pool.active,
          slots: pool.slots.length,
          occupied: pool.slots.filter(({ entry }) => entry !== null).length
        })))
      });
    }
  });
}

// src/renderers/css/rendering/prepared-asset-origin.ts
var SCENE_ADDRESS = /^\/scenes\/[a-z][a-z0-9-]*\/(.+)$/u;
var SHA256 = /^[a-f0-9]{64}$/u;
function resolvePreparedAssetUrl(address, assetOrigin, sha256) {
  if (!assetOrigin) return address;
  const match = SCENE_ADDRESS.exec(address);
  if (!match) return address;
  const filename = match[1];
  const fromMap = assetOrigin.assets?.[filename];
  if (sha256 !== void 0 && fromMap !== void 0 && sha256 !== fromMap) {
    throw new Error(`Prepared asset hash disagreement for ${address}.`);
  }
  const digest = sha256 ?? fromMap;
  if (!digest || !SHA256.test(digest)) throw new Error(`No published asset hash for ${address}.`);
  return `${assetOrigin.origin}/runtime-assets/${digest}/${filename}`;
}
var STYLE_SCENE_URL = /url\(\s*(["']?)(\/scenes\/[a-z][a-z0-9-]*\/[^\s"')]+)\1\s*\)/gu;
function rewritePreparedStyleUrls(style, assetOrigin) {
  if (!assetOrigin || !style) return style;
  return style.replace(STYLE_SCENE_URL, (_match, quote, address) => `url(${quote}${resolvePreparedAssetUrl(address, assetOrigin)}${quote})`);
}

// src/renderers/css/rendering/prepared-residency.ts
function createPreparedResidency({
  assets,
  createImage,
  onReady = () => {
  },
  onWarmError = () => {
  },
  onCleanupError = onWarmError,
  schedule = setTimeout,
  unschedule = clearTimeout,
  assetOrigin
}) {
  const catalog = new Map(assets.entries.map((entry) => [
    entry.key,
    assetOrigin ? { ...entry, url: resolvePreparedAssetUrl(entry.url, assetOrigin) } : entry
  ]));
  const policies = new Map(assets.pools.map((pool) => [pool.id, pool]));
  const images = createPreparedImageStore({ pools: assets.pools, ...createImage ? { createImage } : {} });
  const cache = /* @__PURE__ */ new Map(), mount = /* @__PURE__ */ new Set(), warmed = /* @__PURE__ */ new Set(), tickets = /* @__PURE__ */ new WeakMap();
  let committed = /* @__PURE__ */ new Set(), used = /* @__PURE__ */ new Set(), startup = /* @__PURE__ */ new Set(), warm = [];
  let pending = null, destroyed = false, frameReads = null, sequence = 0, decodes = 0;
  function assetFor(key) {
    const entry = catalog.get(key);
    if (!entry) throw new RangeError(`Undeclared prepared resource: ${key}.`);
    return entry;
  }
  function policyFor(id) {
    const pool = policies.get(id);
    if (!pool) throw new RangeError(`Unknown prepared resource pool: ${id}.`);
    return pool;
  }
  function requireKeys(values) {
    if (!Array.isArray(values) || new Set(values).size !== values.length || values.some((key) => !catalog.has(key))) {
      throw new TypeError("Residency demand requires unique declared resource keys.");
    }
    return new Set(values);
  }
  function protectedKeys(required = pending?.required ?? []) {
    return /* @__PURE__ */ new Set([...mount, ...committed, ...used, ...startup, ...required]);
  }
  function urls(keys, poolId) {
    return new Set([...keys].filter((key) => !warmed.has(key) && assetFor(key).pool === poolId).map((key) => assetFor(key).url));
  }
  function requireCapacity(keys) {
    for (const pool of policies.values()) if (!fits(keys, pool)) {
      throw new RangeError(`Protected prepared resources exceed ${pool.id} capacity ${pool.capacity}.`);
    }
  }
  function decodedBytes(keys, poolId) {
    const sizes = /* @__PURE__ */ new Map();
    for (const key of keys) {
      const asset = assetFor(key);
      if (asset.pool === poolId && !warmed.has(key)) sizes.set(asset.url, asset.decodedBytes ?? 0);
    }
    return [...sizes.values()].reduce((sum, size) => sum + size, 0);
  }
  function fits(keys, pool) {
    const list = [...keys];
    return urls(list, pool.id).size <= pool.capacity && (pool.maximumDecodedBytes === void 0 || decodedBytes(list, pool.id) <= pool.maximumDecodedBytes);
  }
  function release(key, handoff = false) {
    const entry = cache.get(key);
    if (!entry) return;
    cache.delete(key);
    entry.retired = true;
    if (entry.timer !== null) unschedule(entry.timer);
    entry.resolve(null);
    if (handoff) entry.lease.handoff(assetFor(key).url);
    entry.lease.destroy();
  }
  function releaseWarmed(keys) {
    const errors = [];
    for (const key of keys) if (policyFor(assetFor(key).pool).retention === "warm" && ready(key)) {
      warmed.add(key);
      try {
        release(key, true);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw new AggregateError(errors, "Prepared warm resource release failed.");
  }
  function start(key, stabilize) {
    if (cache.has(key) || warmed.has(key)) return;
    const asset = assetFor(key), policy = policyFor(asset.pool);
    let resolveEntry, rejectEntry;
    const promise = new Promise((resolve, reject) => {
      resolveEntry = resolve;
      rejectEntry = reject;
    });
    const entry = {
      key,
      lease: images.createLease("residency"),
      ready: false,
      retired: false,
      timer: null,
      order: sequence++,
      promise,
      resolve: resolveEntry,
      reject: rejectEntry
    };
    entry.promise.catch(() => {
    });
    cache.set(key, entry);
    const load = () => {
      entry.timer = null;
      if (entry.retired || destroyed) return;
      entry.lease.load(asset.url, { pool: asset.pool }).then((image) => {
        if (entry.retired || destroyed) return;
        if (!image) throw new Error(`Prepared resource retired before readiness: ${key}.`);
        if (asset.decodedBytes !== void 0 && image.naturalWidth * image.naturalHeight * 4 !== asset.decodedBytes)
          throw new Error(`Prepared image dimensions differ from the byte budget: ${key}.`);
        entry.ready = true;
        decodes++;
        if (policy.retention === "mount") mount.add(key);
        entry.resolve(image);
        onReady(key);
      }).catch((error) => {
        if (entry.retired || destroyed) return;
        entry.reject(error);
        try {
          release(key);
        } catch (cleanupError) {
          onCleanupError(cleanupError);
        }
        if (!pending?.required.has(key) && !startup.has(key)) onWarmError(error);
      });
    };
    const delay = stabilize ? policy.stabilityMilliseconds ?? 0 : 0;
    if (delay) entry.timer = schedule(load, delay);
    else load();
  }
  function reconcile({ stabilize = false } = {}) {
    if (destroyed) return;
    return images.batch(() => reconcileDemand(stabilize));
  }
  function reconcileDemand(stabilize) {
    const protectedSet = protectedKeys();
    requireCapacity(protectedSet);
    const desired = /* @__PURE__ */ new Set([...protectedSet, ...warm]);
    const errors = [];
    for (const [key, entry] of cache) {
      if (!desired.has(key) && (!entry.ready || policyFor(assetFor(key).pool).eviction !== "capacity")) {
        try {
          release(key);
        } catch (error) {
          errors.push(error);
        }
      }
    }
    for (const key of desired) {
      if (cache.has(key) || warmed.has(key)) continue;
      const asset = assetFor(key), policy = policyFor(asset.pool);
      const admits = () => fits([...cache.keys(), key], policy);
      if (!admits()) {
        const victims = [...cache.values()].filter((entry) => assetFor(entry.key).pool === asset.pool && !protectedSet.has(entry.key) && (!warm.includes(entry.key) || protectedSet.has(key))).sort((a, b) => a.order - b.order);
        for (const victim of victims) {
          try {
            release(victim.key);
          } catch (error) {
            errors.push(error);
          }
          if (admits()) break;
        }
      }
      if (admits()) start(key, stabilize);
      else if (protectedSet.has(key)) throw new Error(`Prepared resource capacity could not admit ${key}.`);
    }
    if (errors.length) throw new AggregateError(errors, "Prepared residency release failed.");
  }
  const ready = (key) => warmed.has(key) || cache.get(key)?.ready === true;
  const awaitKeys = (keys) => Promise.all([...keys].map((key) => warmed.has(key) ? Promise.resolve(true) : cache.get(key)?.promise ?? Promise.reject(new Error(`Unacquired resource: ${key}.`))));
  function retirePending() {
    if (!pending) return;
    const previous = pending;
    pending = null;
    previous.retired = true;
    previous.resolve(null);
  }
  const resources = Object.freeze({
    has: ready,
    read(key) {
      if (!catalog.has(key)) throw new RangeError(`Undeclared prepared resource: ${key}.`);
      if (!ready(key)) return null;
      frameReads?.add(key);
      return images.read(assetFor(key).url);
    },
    url(key) {
      if (!catalog.has(key)) throw new RangeError(`Undeclared prepared resource: ${key}.`);
      if (!ready(key)) return null;
      frameReads?.add(key);
      return assetFor(key).url;
    },
    readyKeys: () => Object.freeze([.../* @__PURE__ */ new Set([...warmed, ...cache.keys()])].filter(ready))
  });
  return Object.freeze({
    resources,
    async prepareStartup() {
      if (destroyed) return null;
      startup = requireKeys(assets.startup);
      requireCapacity(protectedKeys());
      reconcile();
      const result = await awaitKeys(startup);
      return destroyed || result.some((value) => value === null) ? null : true;
    },
    finishStartup() {
      warm = [...startup].filter((key) => policyFor(assetFor(key).pool).retention !== "warm");
      try {
        releaseWarmed(startup);
      } finally {
        startup.clear();
      }
    },
    request(plan, { stabilize = false } = {}) {
      if (destroyed) throw new Error("Prepared residency is destroyed.");
      const required = requireKeys(plan.required), prewarm = [...requireKeys(plan.prewarm ?? [])];
      requireCapacity(protectedKeys(required));
      retirePending();
      let resolveState;
      const promise = new Promise((resolve) => {
        resolveState = resolve;
      });
      const state = { required, prewarm, ready: false, retired: false, resolve: resolveState };
      let rejectTicket;
      const failure = new Promise((_, reject) => {
        rejectTicket = reject;
      });
      const ticket = Object.freeze({ required: Object.freeze([...required]), ready: Promise.race([promise, failure]) });
      ticket.ready.catch(() => {
      });
      tickets.set(ticket, state);
      pending = state;
      try {
        reconcile({ stabilize });
      } catch (error) {
        retirePending();
        rejectTicket(error);
        throw error;
      }
      awaitKeys(required).then((values) => {
        if (state.retired || pending !== state || destroyed) return;
        if (values.some((value) => value === null)) throw new Error("Current prepared demand was retired.");
        state.ready = true;
        state.resolve(ticket);
        warm = state.prewarm;
        try {
          reconcile();
        } catch (error) {
          onCleanupError(error);
        }
      }).catch((error) => {
        if (state.retired || pending !== state || destroyed) return;
        state.retired = true;
        pending = null;
        rejectTicket(error);
        try {
          reconcile();
        } catch (cleanupError) {
          onCleanupError(cleanupError);
        }
      });
      return ticket;
    },
    commit(ticket) {
      const state = tickets.get(ticket);
      if (destroyed || pending !== state || !state?.ready || state.retired) {
        throw new Error("Prepared residency commit is stale or unprepared.");
      }
      committed = new Set(state.required);
      pending = null;
      warm = state.prewarm;
      releaseWarmed(committed);
      reconcile();
    },
    discard(ticket) {
      if (pending !== tickets.get(ticket)) return;
      retirePending();
      warm = [];
      reconcile();
    },
    beginFrame() {
      if (frameReads) throw new Error("Prepared resource frame reads are already open.");
      frameReads = /* @__PURE__ */ new Set();
    },
    endFrame() {
      if (!frameReads) throw new Error("Prepared resource frame reads are not open.");
      used = frameReads;
      frameReads = null;
    },
    stats() {
      return Object.freeze({
        decodes,
        committed: Object.freeze([...committed]),
        pending: Object.freeze([...pending?.required ?? []]),
        used: Object.freeze([...used]),
        warmed: Object.freeze([...warmed]),
        pools: Object.freeze([...policies.values()].map((policy) => Object.freeze({
          ...policy,
          keys: Object.freeze([...cache.keys()].filter((key) => assetFor(key).pool === policy.id)),
          resident: urls(cache.keys(), policy.id).size,
          ...policy.maximumDecodedBytes === void 0 ? {} : { decodedBytes: decodedBytes(cache.keys(), policy.id) },
          ready: urls([...cache.keys()].filter(ready), policy.id).size,
          pending: urls([...cache.keys()].filter((key) => !ready(key)), policy.id).size,
          nativeSlots: images.ownershipStats().pools.find((pool) => pool.id === policy.id)?.slots ?? 0
        }))),
        images: images.ownershipStats()
      });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      retirePending();
      const errors = [];
      images.batch(() => {
        for (const key of cache.keys()) {
          try {
            release(key);
          } catch (error) {
            errors.push(error);
          }
        }
      });
      try {
        images.destroy();
      } catch (error) {
        errors.push(error);
      }
      startup.clear();
      committed.clear();
      used.clear();
      mount.clear();
      warmed.clear();
      if (errors.length) throw new AggregateError(errors, "Prepared residency cleanup failed.");
    }
  });
}

// src/platform/math/matrix.mts
function requirePreparedMatrix4(value) {
  if (!Array.isArray(value) || value.length !== 16 || !value.every(Number.isFinite)) {
    throw new TypeError("Prepared projection requires a finite matrix.");
  }
  return value;
}
function readPreparedMatrix4(value) {
  if (Array.isArray(value)) return requirePreparedMatrix4(value);
  const match = typeof value === "string" && value.match(/^matrix3d\(([^)]+)\)$/u);
  if (!match) throw new TypeError("Prepared projection requires a matrix3d view.");
  return requirePreparedMatrix4(match[1].split(",").map(Number));
}
function multiplyPreparedMatrix4(left, right) {
  const product = new Array(16).fill(0);
  for (let column = 0; column < 4; column++) for (let row = 0; row < 4; row++) for (let index = 0; index < 4; index++) {
    product[column * 4 + row] += left[index * 4 + row] * right[column * 4 + index];
  }
  return product;
}
function preparedRotationMatrix4(axis, degrees2) {
  const radians = degrees2 * Math.PI / 180, cosine = Math.cos(radians), sine = Math.sin(radians);
  if (axis === "x") return [1, 0, 0, 0, 0, cosine, sine, 0, 0, -sine, cosine, 0, 0, 0, 0, 1];
  if (axis === "y") return [cosine, 0, -sine, 0, 0, 1, 0, 0, sine, 0, cosine, 0, 0, 0, 0, 1];
  if (axis === "z") return [cosine, sine, 0, 0, -sine, cosine, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  throw new TypeError("Prepared rotation axis is invalid.");
}
function invertPreparedAffineMatrix4(matrix) {
  const [a, d, g, , b, e, h, , c, f, i] = matrix;
  const determinant = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) throw new RangeError("Prepared material parent became singular.");
  const inverse = [
    (e * i - f * h) / determinant,
    (f * g - d * i) / determinant,
    (d * h - e * g) / determinant,
    0,
    (c * h - b * i) / determinant,
    (a * i - c * g) / determinant,
    (b * g - a * h) / determinant,
    0,
    (b * f - c * e) / determinant,
    (c * d - a * f) / determinant,
    (a * e - b * d) / determinant,
    0,
    0,
    0,
    0,
    1
  ];
  const translation = transformPreparedPoint(inverse, matrix[12], matrix[13], matrix[14], 0);
  inverse[12] = -translation.x;
  inverse[13] = -translation.y;
  inverse[14] = -translation.z;
  return inverse;
}
function transformPreparedPoint(matrix, x, y, z, w) {
  return {
    x: matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12] * w,
    y: matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13] * w,
    z: matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14] * w
  };
}
function serializePreparedMatrix4(matrix) {
  return `matrix3d(${matrix.map((value) => Math.abs(value) < 1e-12 ? 0 : Number(value.toFixed(12))).join(",")})`;
}

// src/renderers/css/rendering/prepared-interior-disc.ts
var PREPARED_INTERIOR_DISC_SIZE = 512;
function createPreparedInteriorDisc(plan) {
  if (plan.sceneFromBody.length !== 16 || !plan.sceneFromBody.every(Number.isFinite) || [3, 7, 11].some((index) => plan.sceneFromBody[index] !== 0) || plan.sceneFromBody[15] !== 1 || plan.radii.length !== 3 || !plan.radii.every((radius) => Number.isFinite(radius) && radius > 0) || !Number.isFinite(plan.inset) || !(plan.inset > 0 && plan.inset < 1)) {
    throw new TypeError("Prepared interior disc requires an affine body frame, positive radii and an inset below one.");
  }
  const [a, b, c] = plan.radii.map((radius) => radius * plan.inset);
  const sphere = multiplyPreparedMatrix4(plan.sceneFromBody, [a, 0, 0, 0, 0, b, 0, 0, 0, 0, c, 0, 0, 0, 0, 1]);
  return (projection) => {
    const inverse = invertPreparedAffineMatrix4(multiplyPreparedMatrix4(projection.eyeFromScene, sphere));
    const eye = [inverse[12], inverse[13], inverse[14]];
    const distance = Math.hypot(...eye);
    if (!(distance > 1)) return null;
    const n = eye.map((value) => value / distance);
    const axis = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const dot2 = axis[0] * n[0] + axis[1] * n[1] + axis[2] * n[2];
    const tangent = axis.map((value, index) => value - dot2 * n[index]);
    const length = Math.hypot(...tangent);
    const x = tangent.map((value) => value / length);
    const y = [n[1] * x[2] - n[2] * x[1], n[2] * x[0] - n[0] * x[2], n[0] * x[1] - n[1] * x[0]];
    const radius = Math.sqrt(1 - 1 / distance ** 2);
    const u = x.map((value) => value * radius), v = y.map((value) => value * radius);
    const pixelScale = 2 / PREPARED_INTERIOR_DISC_SIZE;
    const center = n.map((value) => value / distance);
    return serializePreparedMatrix4(multiplyPreparedMatrix4(sphere, [
      ...u.map((value) => value * pixelScale),
      0,
      ...v.map((value) => value * pixelScale),
      0,
      ...n,
      0,
      center[0] - u[0] - v[0],
      center[1] - u[1] - v[1],
      center[2] - u[2] - v[2],
      1
    ]));
  };
}

// src/renderers/css/rendering/style-access.ts
function readPreparedStyle(style, name) {
  if (name.startsWith("--")) return style.getPropertyValue(name);
  const value = Reflect.get(style, name);
  if (typeof value !== "string") throw new TypeError(`Unknown prepared style property: ${name}.`);
  return value;
}
function writePreparedStyle(style, name, value) {
  if (name.startsWith("--")) style.setProperty(name, value);
  else Reflect.set(style, name, value);
}

// src/renderers/css/rendering/prepared-tree.ts
function createPreparedNode(tree, index, document2, assetOrigin) {
  const record2 = tree.nodes[index];
  const node = document2.createElement(record2.tag);
  if (record2.className !== null) node.className = record2.className;
  if (record2.style) node.style.cssText = rewritePreparedStyleUrls(record2.style, assetOrigin);
  for (const propertyId of record2.properties) {
    const property = tree.properties[propertyId];
    const value = rewritePreparedStyleUrls(property.value, assetOrigin);
    if (property.custom) node.style.setProperty(property.name, value);
    else writePreparedStyle(node.style, property.name, value);
  }
  for (const [name, value] of Object.entries(record2.attributes)) node.setAttribute(name, value);
  return node;
}
function builder(tree, document2, own, assetOrigin) {
  const nodes = [], roots = [];
  return {
    get complete() {
      return nodes.length === tree.nodes.length;
    },
    append() {
      const record2 = tree.nodes[nodes.length];
      const node = createPreparedNode(tree, nodes.length, document2, assetOrigin);
      nodes.push(node);
      if (record2.parent === -1) {
        roots.push(node);
        own(() => node.remove());
      }
      if (record2.parent !== -1) nodes[record2.parent].appendChild(node);
    },
    result: { nodes, roots }
  };
}
function adoptPreparedTree(tree, stage, own, hiddenSubtrees = /* @__PURE__ */ new Set(), assetOrigin) {
  if (!stage.dataset.preparedObject) return null;
  if (stage.dataset.preparedObject !== stage.dataset.objectId) throw new TypeError("Initial prepared tree belongs to another object.");
  const existing = [...stage.querySelectorAll("[data-prepared-node]")];
  const indexed = new Map(existing.map((node) => [node.dataset.preparedNode, node]));
  const nodes = tree.nodes.map((_, index) => indexed.get(String(index)));
  const emptyHidden = new Set([...hiddenSubtrees].filter((root) => nodes[root] && !tree.nodes.some((child, at) => child.parent === root && nodes[at])));
  const built = /* @__PURE__ */ new Set();
  for (const [index, record2] of tree.nodes.entries()) if (!nodes[index]) {
    if (!emptyHidden.has(record2.parent) && !built.has(record2.parent)) throw new TypeError("Initial prepared tree has invalid node identities.");
    nodes[index] = createPreparedNode(tree, index, stage.ownerDocument, assetOrigin);
    built.add(index);
  }
  if (indexed.size !== existing.length || existing.length + built.size !== tree.nodes.length) throw new TypeError("Initial prepared tree has a different node count.");
  for (const index of built) nodes[tree.nodes[index].parent].appendChild(nodes[index]);
  const owned = nodes.filter((node) => node !== void 0);
  const children = tree.nodes.map(() => []);
  for (const [index, record2] of tree.nodes.entries()) if (record2.parent !== -1) children[record2.parent].push(owned[index]);
  const roots = [];
  for (const [index, node] of owned.entries()) {
    const record2 = tree.nodes[index];
    if (!built.has(index) && node.dataset.preparedNode !== String(index) || node.localName !== record2.tag || node.parentElement !== (record2.parent === -1 ? stage : nodes[record2.parent]) || node.children.length !== children[index].length || [...node.children].some((child, indexInParent) => child !== children[index][indexInParent])) {
      throw new TypeError(`Initial prepared tree differs at node ${index}.`);
    }
    if (record2.parent === -1) roots.push(node);
  }
  for (const root of roots) own(() => root.remove());
  delete stage.dataset.preparedObject;
  return { nodes: owned, roots };
}
function buildPreparedTree(tree, document2, own, stage, assetOrigin, hiddenSubtrees) {
  const existing = stage ? adoptPreparedTree(tree, stage, own, hiddenSubtrees, assetOrigin) : null;
  if (existing) return existing;
  const build = builder(tree, document2, own, assetOrigin);
  while (!build.complete) build.append();
  return build.result;
}

// src/platform/vector3.mts
function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

// src/renderers/css/navigation/prepared-surface-hit.ts
var sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
var dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function rayHitsPreparedTriangles(origin, direction, triangles, frontFace, range) {
  const start = range?.start ?? 0, end = start + (range?.count ?? triangles.length);
  for (let index = start; index < end; index++) {
    const [a, b, c] = triangles[index];
    const ab = sub(b, a), ac = sub(c, a), p = cross3(direction, ac), determinant = dot(ab, p);
    if (Math.abs(determinant) < 1e-12) continue;
    if (frontFace === "clockwise" && determinant > 0 || frontFace === "counter-clockwise" && determinant < 0) continue;
    const t = sub(origin, a), u = dot(t, p) / determinant;
    if (u < 0 || u > 1) continue;
    const q = cross3(t, ab), v = dot(direction, q) / determinant;
    if (v >= 0 && u + v <= 1 && dot(ac, q) / determinant >= 0) return true;
  }
  return false;
}
function bindPreparedSurfaceHit(plan, target, scene, camera, selectedLens) {
  if (!target || !scene.contains(target) || !Number.isSafeInteger(plan.target) || !Array.isArray(plan.triangles) || plan.frontFace !== void 0 && !["clockwise", "counter-clockwise"].includes(plan.frontFace) || plan.triangles.length === 0 || plan.triangles.length > 1e4 || plan.triangles.some((triangle) => !Array.isArray(triangle) || triangle.length !== 3 || triangle.some((point) => !Array.isArray(point) || point.length !== 3 || point.some((n) => !Number.isFinite(n))))) throw new TypeError("Invalid prepared surface hit mesh.");
  if (plan.lensRanges && (!selectedLens || !plan.lensRanges.length || plan.lensRanges.some((range) => !Number.isSafeInteger(range.start) || range.start < 0 || !Number.isSafeInteger(range.count) || range.count < 1 || range.start + range.count > plan.triangles.length))) throw new TypeError("Invalid prepared surface lens ranges.");
  return (clientX, clientY) => {
    const range = plan.lensRanges?.find((range2) => range2.lensId === selectedLens?.());
    if (plan.lensRanges && !range) return false;
    const bounds = camera.getBoundingClientRect(), style = getComputedStyle(camera), focal = parseFloat(style.perspective);
    const principal = style.perspectiveOrigin.split(" ").map(parseFloat);
    if (!(focal > 0) || principal.length !== 2 || principal.some((n) => !Number.isFinite(n))) return false;
    let matrix = new DOMMatrix(), node = target;
    while (node && node !== camera) {
      matrix = new DOMMatrix(getComputedStyle(node).transform).multiply(matrix);
      node = node.parentElement;
    }
    if (node !== camera) return false;
    const inverse = matrix.inverse(), offset = [principal[0] - bounds.width / 2, principal[1] - bounds.height / 2];
    const eye = inverse.transformPoint(new DOMPoint(offset[0], offset[1], focal));
    const ray = inverse.transformPoint(new DOMPoint(clientX - bounds.x - principal[0], clientY - bounds.y - principal[1], -focal, 0));
    return rayHitsPreparedTriangles([eye.x, eye.y, eye.z], [ray.x, ray.y, ray.z], plan.triangles, plan.frontFace, range);
  };
}

// src/renderers/css/rendering/prepared-facing.ts
function sceneObserver(projection) {
  const m = projection.eyeFromScene;
  const a = m[0], b = m[4], c = m[8], d = m[1], e = m[5], f = m[9], g = m[2], h = m[6], i = m[10];
  const determinant = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (!Number.isFinite(determinant) || determinant === 0) return null;
  const x = -m[12], y = -m[13], z = -m[14];
  const eye = [
    (x * (e * i - f * h) + y * (c * h - b * i) + z * (b * f - c * e)) / determinant,
    (x * (f * g - d * i) + y * (a * i - c * g) + z * (c * d - a * f)) / determinant,
    (x * (d * h - e * g) + y * (b * g - a * h) + z * (a * e - b * d)) / determinant
  ];
  return { eye, toleranceScale: projection.focalPixels / (determinant * determinant) };
}
function sceneEye(projection) {
  return sceneObserver(projection)?.eye ?? null;
}
function frontFacing(plane, eye, grazingMargin = 0) {
  const a = plane[0] * eye[0], b = plane[1] * eye[1], c = plane[2] * eye[2], d = plane[3];
  return a + b + c + d >= -grazingMargin - 1e-6 * (1 + Math.abs(a) + Math.abs(b) + Math.abs(c) + Math.abs(d));
}
function createPreparedFacing(plans, nodes) {
  const faces = plans.map((plan) => ({ ...plan, node: nodes[plan.target], visibility: nodes[plan.target].style.visibility, visible: true }));
  return (projection) => {
    const observer = sceneObserver(projection);
    const eye = observer?.eye ?? null;
    const grazingMargin = eye ? 2 * Math.hypot(...eye) / projection.focalPixels : 0;
    for (const face of faces) {
      const visible = eye === null || frontFacing(face.plane, eye, Math.max(grazingMargin, face.tolerance * observer.toleranceScale));
      if (visible === face.visible) continue;
      face.node.style.visibility = visible ? face.visibility : "hidden";
      face.visible = visible;
    }
  };
}

// src/renderers/css/rendering/prepared-depth-partitions.ts
function createPreparedDepthPartitions(plan, nodes, scene) {
  if (!plan) return (_projection) => {
  };
  const groups = plan.groups.map((group) => ({ root: nodes[group.root], scene: nodes[group.scene], rank: -1 }));
  const dependsOnEye = (order) => "plane" in order || "sequence" in order && order.sequence.some(dependsOnEye);
  const changingOrder = dependsOnEye(plan.order);
  let ordered = false;
  let transform = null, hidden = null;
  return (projection) => {
    const nextTransform = scene.style.transform, nextHidden = scene.hidden;
    if (transform !== nextTransform || hidden !== nextHidden) {
      for (const group of groups) {
        if (transform !== nextTransform) group.scene.style.transform = nextTransform;
        if (hidden !== nextHidden) group.scene.hidden = nextHidden;
      }
      transform = nextTransform;
      hidden = nextHidden;
    }
    if (ordered && !changingOrder) return;
    const eye = sceneEye(projection);
    if (!eye) return;
    let rank = 0;
    function visit(node) {
      if ("group" in node) {
        const group = groups[node.group];
        if (group.rank !== rank) {
          group.root.style.zIndex = String(rank);
          group.rank = rank;
        }
        rank++;
      } else if ("sequence" in node) {
        for (const entry of node.sequence) visit(entry);
      } else {
        const p = node.plane;
        const front = p[0] * eye[0] + p[1] * eye[1] + p[2] * eye[2] + p[3] >= 0;
        visit(front ? node.back : node.front);
        visit(front ? node.front : node.back);
      }
    }
    visit(plan.order);
    ordered = true;
  };
}

// src/renderers/css/rendering/prepared-silhouette-steps.ts
function walkSilhouetteLevels(levels, hysteresis, diameter, previous = 0) {
  let level = Math.min(Math.max(previous, 0), levels.length - 1);
  while (level + 1 < levels.length && diameter >= levels[level + 1].minimumDiameter) level++;
  while (level > 0 && diameter < levels[level].minimumDiameter * (1 - hysteresis)) level--;
  return level;
}
function selectPreparedSilhouetteStep(steps, diameter, previous) {
  if (diameter == null || !Number.isFinite(diameter)) return previous;
  return walkSilhouetteLevels(steps.levels, steps.hysteresis, diameter, previous);
}

// src/renderers/css/rendering/prepared-texture-levels.ts
function selectPreparedTextureLevel(levels, diameter, previous, initial = false) {
  if (initial) return 0;
  if (levels.fixedLevel !== void 0) return levels.fixedLevel;
  if (diameter == null || !Number.isFinite(diameter)) return levels.levels.length - 1;
  return walkSilhouetteLevels(levels.levels, levels.hysteresis, diameter, previous);
}

// src/renderers/css/prepared-data/physical-projection.ts
function physicalProjectionFromCamera(rotation, center, scale2, viewport) {
  return Object.freeze({
    focalPixels: viewport.focalPixels,
    principalOffsetPixels: viewport.principalOffsetPixels,
    eyeFromScene: Object.freeze([
      rotation[0] * scale2,
      rotation[3] * scale2,
      rotation[6] * scale2,
      0,
      rotation[1] * scale2,
      rotation[4] * scale2,
      rotation[7] * scale2,
      0,
      rotation[2] * scale2,
      rotation[5] * scale2,
      rotation[8] * scale2,
      0,
      center[0],
      center[1],
      center[2],
      1
    ])
  });
}
function requirePhysicalProjection(value) {
  if (!(value.focalPixels > 0) || !Number.isFinite(value.focalPixels) || value.principalOffsetPixels.length !== 2 || !value.principalOffsetPixels.every(Number.isFinite) || value.eyeFromScene.length !== 16 || !value.eyeFromScene.every(Number.isFinite)) {
    throw new TypeError("Physical projection requires a finite eye transform and positive focal length.");
  }
  return value;
}
function projectEyeEllipsoid(center, directions, radii, focal) {
  const q = (a, b) => directions.reduce((sum, direction, i) => sum + direction[a] * direction[b] * radii[i] ** 2, 0);
  const xx = q("x", "x"), xy = q("x", "y"), yy = q("y", "y");
  const xz = q("x", "z"), yz = q("y", "z"), zz = q("z", "z");
  if (center.z + Math.sqrt(Math.max(0, zz)) >= 0) return null;
  const denominator = center.z ** 2 - zz;
  const x = focal * (xz - center.x * center.z) / denominator;
  const y = focal * (yz - center.y * center.z) / denominator;
  const factor = focal * focal / (denominator * denominator);
  return { center: [x, y], covariance: {
    xx: factor * (xx * denominator + center.x ** 2 * zz - 2 * center.x * center.z * xz + xz * xz),
    xy: factor * (xy * denominator + center.x * center.y * zz - (center.x * yz + center.y * xz) * center.z + xz * yz),
    yy: factor * (yy * denominator + center.y ** 2 * zz - 2 * center.y * center.z * yz + yz * yz)
  } };
}

// src/renderers/css/prepared-data/prepared-ellipsoid-projection.ts
function createPreparedEllipsoidProjection({ projection, width, height = width }) {
  if (!(width > 0) || !(height > 0) || !Number.isFinite(width) || !Number.isFinite(height) || !["equatorialRadius", "polarRadius", "coverageScale"].every((key) => Number.isFinite(projection?.[key]) && projection[key] > 0)) {
    throw new TypeError("Prepared ellipsoid dimensions must be positive and finite.");
  }
  const matrices = {
    bodySystemMatrix: Object.freeze([...requirePreparedMatrix4(projection.bodySystemMatrix)]),
    bodyMeshMatrix: Object.freeze([...requirePreparedMatrix4(projection.bodyMeshMatrix)]),
    materialSystemMatrix: Object.freeze([...requirePreparedMatrix4(projection.materialSystemMatrix)]),
    materialMeshMatrix: Object.freeze([...requirePreparedMatrix4(projection.materialMeshMatrix)]),
    baseProjection: Object.freeze([...requirePreparedMatrix4(projection.baseProjection)]),
    centerTranslation: Object.freeze([...requirePreparedMatrix4(projection.centerTranslation)]),
    inverseCenterTranslation: Object.freeze([...requirePreparedMatrix4(projection.inverseCenterTranslation)])
  };
  const counterTransport = Object.freeze({
    ...projection.counterPrecision === void 0 ? {} : { counterPrecision: projection.counterPrecision },
    ...projection.counterFractionDigits === void 0 ? {} : { counterFractionDigits: projection.counterFractionDigits },
    ...projection.counterFractionScale === void 0 ? {} : { counterFractionScale: projection.counterFractionScale }
  });
  const precision = (value) => Number.isInteger(value) && value !== void 0 && value >= 1 && value <= 16;
  if (counterTransport.counterPrecision !== void 0 && !precision(counterTransport.counterPrecision) || counterTransport.counterFractionDigits !== void 0 && (!precision(counterTransport.counterPrecision) || !precision(counterTransport.counterFractionDigits) || !(counterTransport.counterFractionScale !== void 0 && counterTransport.counterFractionScale > 0) || !Number.isFinite(counterTransport.counterFractionScale)) || counterTransport.counterFractionScale !== void 0 && counterTransport.counterFractionDigits === void 0) {
    throw new TypeError("Prepared matrix transport precision is invalid.");
  }
  const equatorialRadius = projection.equatorialRadius * projection.coverageScale;
  const polarRadius = projection.polarRadius * projection.coverageScale;
  const textureCenter = projection.textureEllipse?.center ?? [width / 2, height / 2];
  const [xx, xy, yy] = projection.textureEllipse?.covariance ?? [(width / 2) ** 2, 0, (height / 2) ** 2];
  if (!textureCenter.every(Number.isFinite) || ![xx, xy, yy].every(Number.isFinite) || !(xx > 0) || !(xx * yy - xy * xy > 0)) {
    throw new TypeError("Prepared texture ellipse must be finite and positive definite.");
  }
  const textureX = Math.sqrt(xx), textureSkew = xy / textureX, textureY = Math.sqrt(yy - textureSkew ** 2);
  const textureFrame = [textureX, textureSkew, 0, 0, 0, textureY, 0, 0, 0, 0, 1, 0, textureCenter[0], textureCenter[1], 0, 1];
  return ({ degrees: degrees2, counterMatrix, projection: physical }) => {
    if (!Number.isFinite(degrees2)) {
      throw new TypeError("Prepared ellipsoid view must be finite.");
    }
    const localRotation = multiplyPreparedMatrix4(
      matrices.centerTranslation,
      multiplyPreparedMatrix4(preparedRotationMatrix4("z", degrees2), matrices.inverseCenterTranslation)
    );
    const materialProjection = multiplyPreparedMatrix4(matrices.baseProjection, localRotation);
    const scene = requirePhysicalProjection(physical).eyeFromScene;
    const counter = readPreparedCounterMatrix(counterMatrix, counterTransport);
    const body = multiplyPreparedMatrix4(multiplyPreparedMatrix4(scene, matrices.bodySystemMatrix), matrices.bodyMeshMatrix);
    const parent = multiplyPreparedMatrix4(multiplyPreparedMatrix4(
      multiplyPreparedMatrix4(scene, matrices.materialSystemMatrix),
      counter
    ), matrices.materialMeshMatrix);
    const material = multiplyPreparedMatrix4(parent, materialProjection);
    const target = projectEyeEllipsoid(transformPreparedPoint(body, 0, 0, 0, 1), [
      transformPreparedPoint(body, 1, 0, 0, 0),
      transformPreparedPoint(body, 0, 1, 0, 0),
      transformPreparedPoint(body, 0, 0, 1, 0)
    ], [equatorialRadius, equatorialRadius, polarRadius], physical.focalPixels);
    const texture = multiplyPreparedMatrix4(material, textureFrame);
    const source = projectEyeEllipsoid(transformPreparedPoint(texture, 0, 0, 0, 1), [
      transformPreparedPoint(texture, 1, 0, 0, 0),
      transformPreparedPoint(texture, 0, 1, 0, 0)
    ], [1, 1], physical.focalPixels);
    if (!target || !source) {
      const tangent = tangentDisc(body, texture, [equatorialRadius, equatorialRadius, polarRadius]);
      if (!tangent) return serializePreparedMatrix4(materialProjection);
      return serializePreparedMatrix4(multiplyPreparedMatrix4(multiplyPreparedMatrix4(
        invertPreparedAffineMatrix4(parent),
        tangent
      ), invertPreparedAffineMatrix4(textureFrame)));
    }
    const covarianceScale = Math.max(target.covariance.xx, target.covariance.yy, source.covariance.xx, source.covariance.yy);
    const normalized = (value) => ({ xx: value.xx / covarianceScale, xy: value.xy / covarianceScale, yy: value.yy / covarianceScale });
    const correction = multiplyMatrix2(covarianceSquareRoot(normalized(target.covariance)), invertMatrix2(covarianceSquareRoot(normalized(source.covariance)), 0));
    const tx = target.center[0] - correction[0][0] * source.center[0] - correction[0][1] * source.center[1];
    const ty = target.center[1] - correction[1][0] * source.center[0] - correction[1][1] * source.center[1];
    const screenCorrection = [
      correction[0][0],
      correction[1][0],
      0,
      0,
      correction[0][1],
      correction[1][1],
      0,
      0,
      -tx / physical.focalPixels,
      -ty / physical.focalPixels,
      1,
      0,
      0,
      0,
      0,
      1
    ];
    return serializePreparedMatrix4(multiplyPreparedMatrix4(
      multiplyPreparedMatrix4(invertPreparedAffineMatrix4(parent), screenCorrection),
      material
    ));
  };
}
function tangentDisc(body, texture, radii) {
  const sphere = body.map((value, index) => index < 12 ? value * radii[Math.floor(index / 4)] : value);
  const inverse = invertPreparedAffineMatrix4(sphere), eye = [inverse[12], inverse[13], inverse[14]];
  const distance = Math.hypot(...eye);
  if (!(distance > 1)) return null;
  const normal = eye.map((value) => value / distance);
  const dot2 = (a2, b2) => a2.reduce((sum, value, i) => sum + value * b2[i], 0);
  const direction = (column) => {
    const p = transformPreparedPoint(inverse, texture[column], texture[column + 1], texture[column + 2], 0);
    return [p.x, p.y, p.z];
  };
  const sourceX = direction(0), sourceY = direction(4);
  let x = sourceX.map((value, i) => value - normal[i] * dot2(sourceX, normal));
  if (Math.hypot(...x) < 1e-10) x = sourceY.map((value, i) => value - normal[i] * dot2(sourceY, normal));
  const length = Math.hypot(...x);
  x = x.map((value) => value / length);
  let y = [normal[1] * x[2] - normal[2] * x[1], normal[2] * x[0] - normal[0] * x[2], normal[0] * x[1] - normal[1] * x[0]];
  if (dot2(y, sourceY) < 0) y = y.map((value) => -value);
  const radius = Math.sqrt(1 - 1 / (distance * distance));
  const center = transformPreparedPoint(sphere, normal[0] / distance, normal[1] / distance, normal[2] / distance, 1);
  const a = transformPreparedPoint(sphere, x[0] * radius, x[1] * radius, x[2] * radius, 0);
  const b = transformPreparedPoint(sphere, y[0] * radius, y[1] * radius, y[2] * radius, 0);
  const bodyRadius = Math.max(...[0, 4, 8].map((i) => Math.hypot(sphere[i], sphere[i + 1], sphere[i + 2])));
  const clearance = Math.hypot(body[12], body[13], body[14]) - bodyRadius;
  const extent = Math.hypot(center.x, center.y, center.z) + Math.hypot(a.x, a.y, a.z) + Math.hypot(b.x, b.y, b.z);
  const scale2 = clearance > 0 ? Math.min(1, clearance / (4 * extent)) : 1;
  return [
    a.x * scale2,
    a.y * scale2,
    a.z * scale2,
    0,
    b.x * scale2,
    b.y * scale2,
    b.z * scale2,
    0,
    normal[0],
    normal[1],
    normal[2],
    0,
    center.x * scale2,
    center.y * scale2,
    center.z * scale2,
    1
  ];
}
function readPreparedCounterMatrix(value, projection) {
  const values = readPreparedMatrix4(value);
  if (projection.counterPrecision === void 0) return values;
  const components = typeof value === "string" ? value.slice(9, -1).split(",").map((value2) => value2.trim()) : values.map(String);
  const fastDecimal = projection.counterFractionDigits !== void 0 && !components.some((value2) => /e/iu.test(value2));
  return values.map((number, index) => {
    const fraction = components[index].split(".")[1];
    if (fastDecimal && fraction !== void 0 && projection.counterFractionDigits !== void 0 && fraction.length >= projection.counterFractionDigits) {
      number = Math.sign(number) * (Math.trunc(Math.abs(number)) + Number(fraction.slice(0, projection.counterFractionDigits)) * (projection.counterFractionScale ?? 1));
    }
    return Number(number.toPrecision(projection.counterPrecision));
  });
}
function covarianceSquareRoot(matrix) {
  const determinantRoot = Math.sqrt(Math.max(0, matrix.xx * matrix.yy - matrix.xy ** 2));
  const divisor = Math.sqrt(Math.max(Number.EPSILON, matrix.xx + matrix.yy + 2 * determinantRoot));
  return [
    [(matrix.xx + determinantRoot) / divisor, matrix.xy / divisor],
    [matrix.xy / divisor, (matrix.yy + determinantRoot) / divisor]
  ];
}
function invertMatrix2(matrix, minimumDeterminant = 1e-12) {
  const determinant = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
  if (!Number.isFinite(determinant) || determinant === 0 || Math.abs(determinant) < minimumDeterminant) throw new RangeError("Prepared material projection became singular.");
  return [[matrix[1][1] / determinant, -matrix[0][1] / determinant], [-matrix[1][0] / determinant, matrix[0][0] / determinant]];
}
function multiplyMatrix2(left, right) {
  return [
    [left[0][0] * right[0][0] + left[0][1] * right[1][0], left[0][0] * right[0][1] + left[0][1] * right[1][1]],
    [left[1][0] * right[0][0] + left[1][1] * right[1][0], left[1][0] * right[0][1] + left[1][1] * right[1][1]]
  ];
}

// src/renderers/css/rendering/prepared-material.ts
var degrees = (angle) => (angle % 360 + 540) % 360 - 180;
function preparedMaterialFrame(mapping, view) {
  if (!view.sunViewDirection) throw new TypeError("Prepared material requires a published Sun direction.");
  const phase = view.sunViewDirection[2];
  let low = 0, high = mapping.thresholds.length;
  while (low < high) {
    const middle = low + high >>> 1;
    if (phase < mapping.thresholds[middle]) high = middle;
    else low = middle + 1;
  }
  return mapping.indices[low];
}
function preparedMaterialState(track, selected, view) {
  const calculatedFrame = preparedMaterialFrame(track.frame, view);
  const frame = selected.frameOverride ?? calculatedFrame + (selected.frameOffset ?? 0);
  const direction = view.sunViewDirection;
  if (!direction) throw new TypeError("Prepared material requires a published Sun direction.");
  const reference = view.reference?.sunViewDirection ?? direction;
  const useDefault = view.sceneMatrix === view.reference?.sceneMatrix && direction.every((value, i) => Math.abs(value - reference[i]) < 1e-9);
  const far = track.farBank !== void 0 && (view.levelOfDetail?.stage ?? "geometry") !== "geometry";
  const bank = track.banks.find((bank2) => bank2.id === (far ? track.farBank : selected.bank));
  if (!bank) throw new TypeError(`Unprepared material bank: ${selected.bank}.`);
  const mode = selected.mode === "fixed" ? selected.fixedMode : useDefault && bank.default ? "default" : "directional";
  const address = selected.mode === "fixed" ? bank.fixed : useDefault && bank.default ? bank.default : bank.frames[frame];
  return {
    frame,
    calculatedFrame,
    useDefault,
    bank,
    address,
    row: address?.row ?? null,
    mode,
    enabled: selected.enabled,
    rotationEnabled: selected.rotationEnabled,
    sunViewDirection: direction,
    referenceDirection: reference
  };
}
function preparedMaterialAddress(state, resources) {
  const address = state.address;
  return address && (address.resource === null || resources.has(address.resource)) ? address : null;
}
function createPreparedMaterialPublisher(track, element) {
  let lastAddress = null;
  let state = {
    bank: null,
    frame: track.defaultFrame,
    calculatedFrame: track.defaultFrame,
    appliedFrame: null,
    appliedRow: null,
    row: null,
    mode: null,
    lightRollDegrees: 0,
    addressWrites: 0,
    transformWrites: 0,
    enabled: false,
    rotationEnabled: false,
    sunViewDirection: null
  };
  const rotation = track.rotation;
  const projection = rotation?.physical ?? (rotation?.kind === "ellipsoid" ? rotation : null);
  if (rotation?.kind === "planar" && !projection) throw new TypeError("Planar materials require a prepared physical projection.");
  const project = projection ? createPreparedEllipsoidProjection(projection) : null;
  const write = (name, value) => {
    const current = readPreparedStyle(element.style, name);
    if (current === value) return false;
    writePreparedStyle(element.style, name, value);
    return true;
  };
  return Object.freeze({
    publish(selected, view, resources) {
      const next = preparedMaterialState(track, selected, view);
      state = {
        ...state,
        bank: next.bank.id,
        frame: next.frame,
        calculatedFrame: next.calculatedFrame,
        row: next.row,
        mode: selected.modeLabel ?? next.mode,
        enabled: next.enabled,
        rotationEnabled: next.rotationEnabled,
        sunViewDirection: next.sunViewDirection
      };
      const address = preparedMaterialAddress(next, resources);
      const publishHidden = selected.publishWhenHidden ?? "always";
      const publishAddress = next.enabled || publishHidden === "always" || publishHidden === "static" && next.mode !== "directional";
      let addressPublished = false;
      if (!next.enabled && selected.clearWhenHidden) {
        if (write("backgroundImage", "none")) state.addressWrites++;
        lastAddress = null;
      } else if (address && publishAddress) {
        const url = address.resource === null ? null : resources.url(address.resource);
        if (address.resource !== null && !url) throw new Error("A ready prepared material has no decoded URL.");
        const signature = JSON.stringify([
          next.bank.id,
          next.mode,
          selected.mode === "fixed" ? null : next.frame,
          url,
          address.backgroundPosition,
          address.backgroundSize
        ]);
        if (signature !== lastAddress) {
          if (url !== null && write("backgroundImage", track.quoted ? `url(${JSON.stringify(url)})` : `url(${url})`)) state.addressWrites++;
          for (const name of ["backgroundPosition", "backgroundSize"]) if (write(name, address[name])) state.addressWrites++;
          lastAddress = signature;
        }
        state.appliedFrame = address.frame;
        state.appliedRow = address.row;
        addressPublished = true;
        for (const binding of selected.addressAttributes ?? []) {
          const value = binding.source === "frame" ? String(next.frame) : binding.source === "mode" ? next.mode : binding.source === "mode-or-frame" ? next.mode === "directional" ? String(next.frame) : next.mode : binding.value;
          if (value === null) element.removeAttribute(binding.name);
          else element.setAttribute(binding.name, value);
        }
      }
      if (track.rotation && (!track.rotation.onlyWhenEnabled || next.enabled) && (!track.rotation.publishWithAddress || addressPublished)) {
        const rotation2 = track.rotation;
        const direction = next.sunViewDirection;
        const reference = next.referenceDirection;
        const base = rotation2.reference === "initial" ? Math.atan2(reference[1], reference[0]) * 180 / Math.PI : rotation2.baseDegrees;
        const angle = !selected.rotationEnabled ? 0 : rotation2.polePolicy !== "azimuth" && Math.hypot(direction[0], direction[1]) < 1e-9 ? rotation2.zeroAtPole ? 0 : state.lightRollDegrees : degrees(Math.atan2(direction[1], direction[0]) * 180 / Math.PI - base);
        if (project && projection) {
          const transform = project({
            degrees: angle,
            projection: view.projection,
            counterMatrix: view.counterRotationFor(projection.systemTransform)
          });
          if (rotation2.physical) {
            element.style.removeProperty("rotate");
            if (write("transformOrigin", "0 0")) state.transformWrites++;
          }
          if (write("transform", transform)) state.transformWrites++;
        } else if (rotation2.kind === "angle") {
          if (Math.abs(angle - state.lightRollDegrees) >= 1e-9 || !selected.rotationEnabled || rotation2.publishWithAddress) {
            if (write(rotation2.property, `${angle}deg`)) state.transformWrites++;
          }
        } else throw new TypeError("Unknown prepared material rotation.");
        state.lightRollDegrees = angle;
      }
      if (track.frameAttribute) element.setAttribute(track.frameAttribute, String(state.frame));
      if (track.modeAttribute) element.setAttribute(track.modeAttribute, String(state.mode));
    },
    observe: () => Object.freeze({ ...state })
  });
}

// src/renderers/css/stars/opacity-clock.ts
var shared = /* @__PURE__ */ new WeakMap();
function createOpacityClock(window2) {
  const entry = shared.get(window2) ?? { clock: createFrameClock(window2), owners: 0 };
  entry.owners++;
  shared.set(window2, entry);
  let released = false;
  return Object.freeze({ ...entry.clock, destroy() {
    if (released) return;
    released = true;
    if (--entry.owners > 0) return;
    shared.delete(window2);
    entry.clock.destroy();
  } });
}
function createFrameClock(window2) {
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
  const now = () => timestamp ?? window2.performance.now();
  const schedule = () => {
    const needed = callbacks.size > 0 || dirty.size > 0 || active.size > 0;
    if (destroyed || presenting) return;
    if (needed) frame ??= window2.requestAnimationFrame(tick);
    else if (frame !== null) {
      window2.cancelAnimationFrame(frame);
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
      if (frame !== null) window2.cancelAnimationFrame(frame);
      frame = null;
      callbacks.clear();
      dirty.clear();
      active.clear();
    }
  };
}

// src/renderers/css/rendering/prepared-activation.ts
var ACTIVATION_PAINTS = 6;
function prepareConnectedActivation(groups, own) {
  if (!groups.length) return () => Promise.resolve();
  const window2 = groups[0][0].ownerDocument.defaultView;
  const clock = window2 && createOpacityClock(window2);
  if (!window2) throw new Error("Prepared activation requires a window.");
  const leaves = groups.reduce((sum, group) => sum + group.length, 0);
  const budget = Math.ceil(leaves / ACTIVATION_PAINTS);
  const entries = [];
  for (const group of groups) {
    const batch = entries[entries.length - 1];
    const next = group.map((node) => ({ node, display: node.style.display }));
    if (batch && batch.length + next.length <= budget) batch.push(...next);
    else entries.push(next);
  }
  for (const group of entries) for (const { node } of group) node.style.display = "none";
  let frame = null, disposed = false, promise = null;
  let resolve = null;
  own(() => {
    disposed = true;
    if (frame !== null) clock.cancel(frame);
    frame = null;
    resolve?.();
  });
  return () => promise ??= new Promise((done) => {
    resolve = done;
    let index = 0;
    function next() {
      frame = null;
      if (disposed) {
        done();
        return;
      }
      for (const entry of entries[index++]) entry.node.style.display = entry.display;
      if (index === entries.length) frame = clock.request(() => {
        frame = null;
        done();
      });
      else frame = clock.request(next);
    }
    if (disposed) done();
    else frame = clock.request(next);
  });
}

// src/renderers/css/rendering/prepared-material-demand.ts
function resolvePreparedMaterialDemand(track, selected, view) {
  const state = preparedMaterialState(track, selected, view);
  const address = state.address;
  const needsAddress = state.enabled || selected.publishWhenHidden === "static" && state.mode !== "directional";
  return {
    required: needsAddress && address?.resource != null ? [address.resource] : [],
    prewarm: state.enabled ? address?.prewarm ?? [] : [],
    frame: state.frame,
    row: state.row,
    mode: state.mode,
    bank: state.bank.id
  };
}

// src/renderers/css/rendering/prepared-presentation.ts
var matches = (variant, selection) => Object.entries(variant.when).every(([name, value]) => selection[name] === value);
function selectedPreparedVariant(definition, selection) {
  const variant = definition.variants.find((variant2) => matches(variant2, selection));
  if (!variant) throw new TypeError("The selected presentation was not prepared.");
  return variant;
}
function resolvePreparedPresentation(definition, { selection, view, previousPlan, initial = false }) {
  const variant = selectedPreparedVariant(definition, selection);
  const textureLevel = definition.textureLevels ? selectPreparedTextureLevel(
    definition.textureLevels,
    view?.levelOfDetail?.silhouetteDiameter,
    previousPlan?.textureLevel,
    initial
  ) : void 0;
  const textureResources = textureLevel === void 0 ? void 0 : definition.textureLevels.levels[textureLevel].resources;
  const content = variant.required.map((key) => textureResources?.[key] ?? key);
  const deferredTextures = (view?.levelOfDetail?.stage ?? "geometry") === "marker";
  const required = new Set(definition.resourceOrder === "materials-first" || deferredTextures ? [] : content);
  const prewarm = /* @__PURE__ */ new Set(), materials = {};
  for (const selected of variant.materials) {
    if (!view) throw new TypeError("Prepared material demand requires a view.");
    const track = definition.materials.find((track2) => track2.id === selected.track);
    if (!track) throw new TypeError(`Unprepared material track: ${selected.track}.`);
    const state = resolvePreparedMaterialDemand(track, selected, view);
    for (const key of state.required) required.add(key);
    for (const key of state.prewarm) prewarm.add(key);
    materials[track.id] = state;
  }
  if (definition.resourceOrder === "materials-first" && !deferredTextures) for (const key of content) required.add(key);
  return {
    required: [...required],
    prewarm: [...prewarm].filter((key) => !required.has(key)),
    materials,
    pressedLenses: [selection.lensId],
    ...deferredTextures ? { deferredTextures } : {},
    ...textureLevel === void 0 ? {} : { textureLevel, textureResources },
    ...variant.navigation ? { navigation: variant.navigation } : {}
  };
}
var datasetKey = (name) => name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
function readAttribute(element, name) {
  return name.startsWith("data-") ? element.dataset[datasetKey(name)] ?? null : element.getAttribute(name);
}
function writeAttribute(element, name, value) {
  if (name.startsWith("data-")) {
    if (value === null) delete element.dataset[datasetKey(name)];
    else element.dataset[datasetKey(name)] = value;
  } else if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}
var styleValue = (element, name) => readPreparedStyle(element.style, name);
function writeStyle(element, name, value) {
  writePreparedStyle(element.style, name, value);
}
function mountPreparedPresentation(stage, context, definition, preparedTree, initialProjection, progressiveActivation = false) {
  const { nodes, roots } = preparedTree ? preparedTree.claim(definition.tree, stage.ownerDocument, context.own) : buildPreparedTree(
    definition.tree,
    stage.ownerDocument,
    context.own,
    stage,
    definition.assetOrigin,
    new Set(definition.variants.flatMap((variant) => variant.hiddenSubtrees ?? []))
  );
  const cameraElement = nodes[definition.tree.camera], sceneElement = nodes[definition.tree.scene];
  const owned = () => roots.some((root) => root.parentNode === stage);
  const stageBindings = /* @__PURE__ */ new Map();
  for (const variant of definition.variants) for (const binding of variant.writes) {
    if (binding.target === -1) stageBindings.set(`${binding.kind}:${binding.name}`, binding);
  }
  for (const binding of stageBindings.values()) {
    const previous = binding.kind === "attribute" ? readAttribute(stage, binding.name) : binding.kind === "class" ? stage.classList.contains(binding.name) : styleValue(stage, binding.name);
    context.own(() => {
      if (!owned()) return;
      if (binding.kind === "attribute") writeAttribute(stage, binding.name, typeof previous === "string" ? previous : null);
      else if (binding.kind === "class") stage.classList.toggle(binding.name, previous === true);
      else writeStyle(stage, binding.name, String(previous));
    });
  }
  for (const name of definition.tree.stageClasses) {
    const previous = stage.classList.contains(name);
    context.own(() => {
      if (owned()) stage.classList.toggle(name, previous);
    });
  }
  if (progressiveActivation && !definition.tree.activationGroups) throw new TypeError("Flight activation requires prepared groups.");
  const activate = prepareConnectedActivation(preparedTree && progressiveActivation ? (definition.tree.activationGroups ?? []).map((group) => group.map((index) => nodes[index])) : [], context.own);
  const revealGroups = Object.freeze((definition.tree.activationGroups ?? []).map((group) => Object.freeze(group.map((index) => nodes[index]))));
  for (const plan of [...definition.motion ?? [], ...definition.animations]) nodes[plan.target].style.animation = "none";
  const motion = (definition.motion ?? []).map((plan) => {
    const animation = nodes[plan.target].animate(plan.keyframes, { duration: plan.duration, iterations: Infinity, easing: "linear", fill: "both" });
    animation.id = plan.id;
    context.registerAnimation(animation, { mode: "motion", initialTime: 0 });
    return { animation, plan, duration: plan.duration };
  });
  for (const root of roots) stage.appendChild(root);
  if (roots.some((root) => root.parentNode !== stage)) throw new Error("Prepared roots must belong to the mounted stage.");
  for (const name of definition.tree.stageClasses) stage.classList.add(name);
  const animations = definition.animations.map((plan) => {
    const animation = nodes[plan.target].animate(plan.keyframes, { duration: plan.duration, easing: "linear", fill: "both" });
    animation.id = plan.id;
    context.registerAnimation(animation, { mode: plan.mode });
    return { animation, plan };
  });
  const framePublisher = createPreparedFramePublisher(definition, stage, nodes, sceneElement, (controlPitch) => {
    for (const { animation, plan } of animations) context.seekAnimation(
      animation,
      Math.max(0, Math.min(plan.duration, (controlPitch - plan.sourceMinimum) * plan.millisecondsPerDegree))
    );
  }, initialProjection);
  let selectionPublications = 0, styleWrites = 0;
  let selectedTextures = /* @__PURE__ */ new Map();
  const styleKey = (binding) => `${binding.target}:${binding.name.startsWith("--") ? binding.name : binding.name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
  const target = (index) => index === -1 ? stage : nodes[index];
  return Object.freeze({
    cameraElement,
    sceneElement,
    activate,
    revealGroups,
    ...definition.surfaceHit ? { surfaceHitTest: bindPreparedSurfaceHit(definition.surfaceHit, nodes[definition.surfaceHit.target], sceneElement, cameraElement, () => stage.dataset.lens) } : {},
    ...definition.motionFrame ? { motionFrame: Object.freeze(definition.motionFrame.map((index) => nodes[index])) } : {},
    ...definition.features ? { featureTarget: nodes[definition.features.target] } : {},
    commitSelection({ selection, resources, plan }) {
      const variant = selectedPreparedVariant(definition, selection);
      const writes = variant.writes.map((binding) => {
        if (binding.kind !== "texture") return binding;
        const url = binding.resource === null ? null : resources.url(plan?.textureResources?.[binding.resource] ?? binding.resource);
        if (binding.resource !== null && !url && !plan?.deferredTextures) throw new Error(`Prepared selection texture is not ready: ${binding.resource}`);
        return { kind: "style", target: binding.target, name: binding.name, value: url === null ? "none" : binding.quoted ? `url(${JSON.stringify(url)})` : `url(${url})` };
      });
      const nextStyles = new Set(writes.filter((binding) => binding.kind === "style").map(styleKey));
      const profileDisplay = (binding, value) => binding.kind === "style" && binding.name.startsWith("--") && binding.name.endsWith("-display") && binding.value === value;
      const hiddenProfiles = writes.filter((binding) => profileDisplay(binding, "none"));
      const shownProfiles = writes.filter((binding) => profileDisplay(binding, "block"));
      const contentWrites = writes.filter((binding) => !profileDisplay(binding, "none") && !profileDisplay(binding, "block"));
      const publish = (binding) => {
        const element = target(binding.target);
        if (binding.kind === "attribute") writeAttribute(element, binding.name, binding.value);
        else if (binding.kind === "class") element.classList.toggle(binding.name, binding.value);
        else {
          writeStyle(element, binding.name, binding.value);
          styleWrites++;
        }
      };
      for (const binding of hiddenProfiles) publish(binding);
      for (const [key, binding] of selectedTextures) if (!nextStyles.has(key)) {
        writeStyle(target(binding.target), binding.name, "none");
        styleWrites++;
      }
      for (const binding of contentWrites) publish(binding);
      for (const binding of shownProfiles) publish(binding);
      selectedTextures = new Map(variant.writes.filter((binding) => binding.kind === "texture").map((binding) => [styleKey(binding), binding]));
      for (const entry of motion) {
        const duration = entry.plan.timings.find((timing) => Object.entries(timing.when).every(([name, value]) => selection[name] === value))?.duration ?? entry.plan.duration;
        if (duration !== entry.duration) {
          entry.animation.effect.updateTiming({ duration });
          entry.duration = duration;
        }
      }
      selectionPublications++;
    },
    publishFrame: framePublisher.publish,
    observe() {
      const frame = framePublisher.observe();
      return {
        presentation: {
          nodes: nodes.length,
          roots: roots.length,
          selectionPublications,
          framePublications: frame.framePublications,
          styleWrites: styleWrites + frame.styleWrites,
          transformWrites: frame.transformWrites
        },
        materials: frame.materials
      };
    }
  });
}
function createPreparedFramePublisher(definition, stage, nodes, sceneElement, seekPose = () => {
}, initialProjection) {
  const publishFacing = createPreparedFacing(definition.facing ?? [], nodes);
  const publishDepth = createPreparedDepthPartitions(definition.depthPartitions, nodes, sceneElement);
  if (initialProjection) {
    publishFacing(initialProjection);
    publishDepth(initialProjection);
  }
  const materials = new Map(definition.materials.map((track) => [
    track.id,
    createPreparedMaterialPublisher(track, nodes[track.target])
  ]));
  let framePublications = 0, styleWrites = 0, transformWrites = 0;
  const round = (value, precision) => precision === null ? value : Math.round(value * 10 ** precision) / 10 ** precision;
  const formatNumber2 = (value) => Math.abs(value) < 1e-9 ? "0" : Number(value.toFixed(6)).toString();
  const target = (index) => index === -1 ? stage : nodes[index];
  const silhouetteSteps = /* @__PURE__ */ new Map();
  const interiorDiscs = new Map(definition.viewBindings.flatMap((binding) => binding.kind === "interior-disc" ? [[binding.target, createPreparedInteriorDisc(binding)]] : []));
  return {
    publish({ selection, view, resources }) {
      publishDepth(view.projection);
      publishFacing(view.projection);
      const levelOfDetail = view.levelOfDetail;
      for (const binding of definition.viewBindings) {
        const element = target(binding.target);
        if (binding.kind === "view-attribute") {
          let value = binding.source === "scene-pitch" ? preparedScenePitch(view.controlPitch, definition.camera) : binding.source === "control-yaw" ? view.controlYaw : binding.source === "zoom" ? view.zoom : binding.source === "level-of-detail-stage" ? levelOfDetail.stage : view.sceneMatrix;
          if (binding.precision !== null) {
            const scale2 = 10 ** binding.precision;
            value = Math.round(Number(value) * scale2) / scale2;
          }
          if (readAttribute(element, binding.property) !== String(value)) writeAttribute(element, binding.property, String(value));
        } else if (binding.kind === "view-property") {
          const value = formatNumber2(round(binding.source === "billboard-opacity" ? levelOfDetail.billboardOpacity : levelOfDetail.markerOpacity, binding.precision));
          if (styleValue(element, binding.property) !== value) {
            writeStyle(element, binding.property, value);
            styleWrites++;
          }
        } else if (binding.kind === "interior-disc") {
          const transform = interiorDiscs.get(binding.target)(view.projection);
          const visibility = transform ? "visible" : "hidden";
          if (element.style.visibility !== visibility) {
            element.style.visibility = visibility;
            styleWrites++;
          }
          if (transform && element.style.transform !== transform) {
            element.style.transform = transform;
            transformWrites++;
          }
        } else if (binding.kind === "silhouette-fit") {
          const silhouette = view.body.silhouette;
          element.style.visibility = view.body.visible === false ? "hidden" : "";
          if (silhouette) {
            element.style.scale = "1";
            element.style.transformOrigin = "50% 50%";
            const radialAngle = Math.atan2(silhouette.radial[1], silhouette.radial[0]) * 180 / Math.PI;
            const radial = Math.max(silhouette.radialSemiAxis, binding.minimumRadius);
            const tangential = Math.max(silhouette.tangentialSemiAxis, binding.minimumRadius);
            const shiftX = view.stageViewport.principalOffsetPixels[0] - view.principalOffset[0];
            const shiftY = view.stageViewport.principalOffsetPixels[1] - view.principalOffset[1];
            const transform = `translate(${formatNumber2(silhouette.centre[0] + shiftX)}px, ${formatNumber2(silhouette.centre[1] + shiftY)}px) rotate(${formatNumber2(radialAngle)}deg) scale(${formatNumber2(radial * binding.unitScale)}, ${formatNumber2(tangential * binding.unitScale)}) rotate(${formatNumber2(-radialAngle)}deg)`;
            if (element.style.transform !== transform) {
              element.style.transform = transform;
              transformWrites++;
            }
          }
        } else if (binding.kind === "silhouette-step-property") {
          const level = selectPreparedSilhouetteStep(binding, levelOfDetail.silhouetteDiameter, silhouetteSteps.get(binding));
          if (level !== void 0) {
            silhouetteSteps.set(binding, level);
            const value = binding.levels[level].value;
            if (styleValue(element, binding.property) !== value) {
              writeStyle(element, binding.property, value);
              styleWrites++;
            }
          }
        } else {
          const counter = binding.systemTransform === null ? view.counterRotation : view.counterRotationFor(binding.systemTransform);
          if (element.style.transform !== counter) {
            element.style.transform = counter;
            transformWrites++;
          }
        }
      }
      seekPose(view.controlPitch);
      if (materials.size) for (const selected of selectedPreparedVariant(definition, selection).materials) {
        const material = materials.get(selected.track);
        if (!material) throw new TypeError(`Unprepared material track: ${selected.track}.`);
        material.publish(selected, view, resources);
      }
      framePublications++;
    },
    observe() {
      return {
        framePublications,
        styleWrites,
        transformWrites,
        materials: Object.fromEntries([...materials].map(([id, material]) => [id, material.observe()]))
      };
    }
  };
}

// src/renderers/css/rendering/object-feature-controls.ts
var OBJECT_SPEED_STATES = Object.freeze([
  Object.freeze({ label: "off", value: 0 }),
  Object.freeze({ label: "normal", value: 1 }),
  Object.freeze({ label: "fast", value: 2 }),
  Object.freeze({ label: "fastest", value: 3 }),
  Object.freeze({ label: "superfast", value: 4 })
]);

// src/renderers/css/runtime/object-contract.ts
var OBJECT_RUNTIME_SCHEMA = "cssearth-object-runtime@4";
var nonempty = (value) => typeof value === "string" && value.length > 0;
function requireObjectControls(content, objectId = "unknown") {
  if (!content || typeof content !== "object" || !Object.hasOwn(content, "lenses") || !Object.hasOwn(content, "settings")) {
    throw new TypeError(`Object ${objectId} must export its lenses and settings content.`);
  }
  for (const name of ["lenses", "settings"]) {
    if (content[name] != null && !Array.isArray(content[name]?.controls)) {
      throw new TypeError(`Object ${objectId} ${name} controls must be an array.`);
    }
  }
  const lensControls = content.lenses?.controls ?? [], lensIds = lensControls.map((lens) => lens.id);
  if (lensIds.some((id) => !nonempty(id)) || new Set(lensIds).size !== lensIds.length || lensIds.length && !lensIds.includes(content.lenses.defaultLens)) {
    throw new TypeError(`Object ${objectId} lens IDs/default are invalid.`);
  }
  const surfaceIds = lensControls.filter((lens) => lens.volume === void 0 || lens.volume.surface === lens.id).map((lens) => lens.id);
  for (const lens of lensControls) {
    if (lens.volume === void 0) continue;
    const volume = lens.volume;
    if (!volume || typeof volume !== "object" || !nonempty(volume.objectId) || !nonempty(volume.lensId) || !surfaceIds.includes(volume.surface)) {
      throw new TypeError(`Object ${objectId} lens ${lens.id} must name a cloud object, its dataset and a prepared surface lens.`);
    }
  }
  if (lensControls.length && !surfaceIds.length) throw new TypeError(`Object ${objectId} has no prepared surface lens.`);
  const settings = content.settings?.controls ?? [], names = settings.map((setting) => setting.name);
  if (names.some((name) => !nonempty(name) || ["motion", "heliosphere", "illustrationModels", "surfaceLabels", "minimap", "threeDStars"].includes(name)) || new Set(names).size !== names.length || settings.some((setting) => !["toggle", "cycle"].includes(setting.kind) || !nonempty(setting.label) || (setting.kind === "toggle" ? typeof setting.checked !== "boolean" : !nonempty(setting.state)))) {
    throw new TypeError(`Object ${objectId} settings controls are invalid.`);
  }
  return content;
}
function selectedLensVolume(controls, lensId) {
  if (lensId === null) return null;
  return (controls.lenses?.controls ?? []).find((lens) => lens.id === lensId)?.volume ?? null;
}
function objectCycleStates(control) {
  const states = control.states ?? (control.name === "speed" ? OBJECT_SPEED_STATES : null);
  if (!Array.isArray(states) || !states.length || states.some((state) => !nonempty(state.label) || !Number.isFinite(state.value)) || new Set(states.map((state) => state.label)).size !== states.length || new Set(states.map((state) => state.value)).size !== states.length || !states.some((state) => state.label === control.state)) {
    throw new TypeError(`Cycle ${control.name} requires its actual states and default.`);
  }
  return states;
}
function initialObjectSelection(controls, lensId, settings) {
  requireObjectControls(controls);
  if (lensId !== void 0) requireObjectAction(controls, { kind: "lens", id: lensId });
  const selection = { lensId: lensId ?? controls.lenses?.defaultLens ?? null };
  for (const control of controls.settings?.controls ?? []) {
    if (control.kind === "toggle") selection[control.name] = control.checked;
    else {
      const state = objectCycleStates(control).find((state2) => state2.label === control.state);
      if (!state) throw new TypeError(`Cycle ${control.name} has no initial state.`);
      selection[control.name] = state.value;
    }
  }
  if (settings !== void 0) {
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) throw new TypeError("Initial settings must be a record.");
    for (const [name, value] of Object.entries(settings)) {
      const control = controls.settings?.controls.find((control2) => control2.name === name);
      if (!control || (control.kind === "toggle" ? typeof value !== "boolean" : typeof value !== "number")) throw new TypeError(`Invalid initial setting: ${name}.`);
      requireObjectAction(controls, control.kind === "toggle" ? { kind: "toggle", name, value } : { kind: "cycle", name, value });
      selection[name] = value;
    }
  }
  return Object.freeze(selection);
}
function requireObjectAction(controls, action) {
  if (!action || typeof action !== "object" || Array.isArray(action)) throw new TypeError("Object action must be a record.");
  if (action.kind === "lens") {
    if (!(controls.lenses?.controls ?? []).some((lens) => lens.id === action.id)) throw new RangeError(`Unknown object lens: ${action.id}.`);
  } else {
    const control = (controls.settings?.controls ?? []).find((control2) => control2.name === action.name);
    if (!control || control.kind !== action.kind || (control.kind === "toggle" ? typeof action.value !== "boolean" : !objectCycleStates(control).some((state) => state.value === action.value))) throw new RangeError(`Unknown object control action: ${action.name}.`);
  }
  return Object.freeze({ ...action });
}
function reduceObjectSelection(selection, action) {
  return Object.freeze(action.kind === "lens" ? { ...selection, lensId: action.id } : { ...selection, [action.name]: action.value });
}
function requireObjectRuntimeDefinition(definition, { objectId = definition?.id, controls } = {}) {
  if (definition?.schema !== OBJECT_RUNTIME_SCHEMA) throw new TypeError("Object runtime requires the data-only prepared definition.");
  if (!/^[a-z][a-z0-9-]*$/.test(definition.id ?? "") || definition.id !== objectId) throw new TypeError(`Object runtime identity does not match ${objectId}.`);
  if (controls !== void 0 && definition.controls !== controls) throw new TypeError(`${objectId} must supply its actual control-content export.`);
  return definition;
}

// src/renderers/css/rendering/object-selection-runtime.ts
var sameKeys = (a, b) => a.length === b.length && a.every((key, index) => key === b[index]);
var sameDemand = (a, b) => sameKeys(a.required, b.required) && sameKeys(a.prewarm, b.prewarm);
function createObjectSelectionRuntime({
  definition,
  presentation,
  residency,
  lifetime,
  initialLens,
  initialSettings,
  onChange = () => {
  },
  prepareSelection,
  onCommit = () => {
  },
  onFatalError,
  onMaterialError = () => {
  },
  deferTextureRefinement = false
}) {
  const initialSelection = initialObjectSelection(definition.controls, initialLens, initialSettings);
  let desired = initialSelection, committed = null, committedPlan = null, view = null;
  let committedBy = null;
  let active = null, destroyed = false, started = false, error = null;
  let requests = 0, passes = 0, commits = 0, framePublications = 0;
  let textureRefinement = !deferTextureRefinement;
  const live = () => !destroyed && !lifetime.disposed;
  const state = () => Object.freeze({
    desired,
    committed,
    plan: committedPlan,
    committedBy,
    pending: active !== null && active.intent.kind !== "frame",
    loadingMaterial: active?.intent.kind === "frame",
    ready: committed !== null && live(),
    error,
    viewRevision: view?.revision ?? null
  });
  const notify = () => {
    if (live()) onChange(state());
  };
  function resolve(selection) {
    try {
      if (!view) throw new Error("Prepared selection requires a published view.");
      return resolvePreparedPresentation(definition, { selection, view, previousPlan: committedPlan, initial: !committed || !textureRefinement });
    } catch (failure) {
      if (live()) onFatalError(failure);
      throw failure;
    }
  }
  function frame(nextSelection = committed) {
    if (!live() || !nextSelection || !view) return;
    residency.beginFrame();
    try {
      presentation.publishFrame({ selection: nextSelection, view, resources: residency.resources });
      framePublications++;
    } finally {
      residency.endFrame();
    }
  }
  function discard(request) {
    if (!request?.ticket) return;
    const ticket = request.ticket;
    request.ticket = null;
    residency.discard(ticket);
  }
  function releaseDemand(request) {
    discard(request);
    discard(request.previous);
  }
  function endRequest(request) {
    releaseDemand(request);
    active = null;
    desired = committed ?? initialSelection;
  }
  function planFor(request) {
    if (!request.plan) throw new Error("Prepared selection request has no demand plan.");
    return request.plan;
  }
  function preparePass(request, plan) {
    passes++;
    request.plan = plan;
    request.ticket = residency.request(plan, { stabilize: request.intent.kind === "frame" });
    request.previous = null;
    return request.ticket;
  }
  function run(selection, kind, signal, frameCamera = true) {
    if (!live() || signal?.aborted) return Promise.resolve(false);
    const superseded = active;
    let previous = active;
    while (previous && !previous.ticket) previous = previous.previous;
    const request = { selection, intent: { kind, frameCamera }, controller: new AbortController(), ticket: null, plan: null, previous };
    active = request;
    superseded?.controller.abort();
    const operationSignal = signal ? AbortSignal.any([signal, request.controller.signal]) : request.controller.signal;
    desired = selection;
    error = null;
    requests++;
    const current = () => live() && active === request;
    let cancel;
    const cancelled = new Promise((resolve2) => {
      cancel = () => resolve2({ cancelled: true });
    });
    const abort = () => {
      cancel();
      if (!current()) return;
      endRequest(request);
      notify();
    };
    operationSignal.addEventListener("abort", abort, { once: true });
    const work = (async () => {
      try {
        notify();
      } catch (failure) {
        if (current()) onFatalError(failure);
        throw failure;
      }
      await Promise.resolve();
      let prepared = false;
      let preparation;
      while (current()) {
        let ticket;
        try {
          const plan = resolve(selection);
          ticket = request.ticket && request.plan && sameDemand(plan, planFor(request)) ? request.ticket : preparePass(request, plan);
          if (!prepared && kind === "selection" && prepareSelection) {
            preparation = Promise.resolve(prepareSelection(selection, operationSignal));
            prepared = true;
          }
          const ready = preparation ? Promise.all([ticket.ready, preparation]).then(([value]) => value) : ticket.ready;
          const result = await Promise.race([lifetime.wait(ready), cancelled]);
          if (!current() || result.cancelled) {
            discard(request);
            return false;
          }
          if (!result.value || request.ticket !== ticket) continue;
        } catch (failure) {
          if (!current()) {
            discard(request);
            return false;
          }
          endRequest(request);
          error = failure instanceof Error ? failure.message : String(failure);
          try {
            notify();
          } catch (publicationFailure) {
            onFatalError(publicationFailure);
            throw publicationFailure;
          }
          throw failure;
        }
        try {
          const plan = resolve(selection);
          if (!sameDemand(plan, planFor(request)) || plan.required.some((key) => !residency.resources.has(key))) {
            preparePass(request, plan);
            continue;
          }
          request.plan = plan;
          residency.beginFrame();
          try {
            presentation.commitSelection({ selection, plan, view, resources: residency.resources });
          } finally {
            residency.endFrame();
          }
          if (!current()) {
            discard(request);
            return false;
          }
          residency.commit(ticket);
          request.ticket = null;
          frame(selection);
          if (!current()) return false;
          onCommit(selection, plan, request.intent);
          if (!current()) return false;
          committed = selection;
          committedPlan = plan;
          committedBy = request.intent;
          commits++;
          endRequest(request);
          notify();
          return live();
        } catch (failure) {
          if (current()) onFatalError(failure);
          throw failure;
        }
      }
      discard(request);
      return false;
    })();
    work.catch(() => {
    });
    return work.then((value) => live() && value).finally(() => {
      operationSignal.removeEventListener("abort", abort);
      request.controller.abort();
    });
  }
  return Object.freeze({
    start() {
      if (!live()) return Promise.resolve(false);
      if (started) throw new Error("Initial object selection may start only once.");
      if (!view) throw new Error("Initial object selection requires the shared camera publication.");
      started = true;
      return run(desired, "initial");
    },
    dispatch(action, options = {}) {
      if (!live() || !committed) return Promise.resolve(false);
      const valid = requireObjectAction(definition.controls, action);
      const next = reduceObjectSelection(desired, valid);
      return run(next, "selection", options.signal, options.frameCamera);
    },
    setView(next) {
      if (!live()) return;
      view = next;
      try {
        const plan = committed ? resolve(committed) : null;
        const prepared = plan && committedPlan && sameDemand(plan, committedPlan) && plan.required.every((key) => residency.resources.has(key));
        frame(committed);
        if (prepared && live()) committedPlan = plan;
        if (active) {
          if (active.ticket) {
            const plan2 = resolve(active.selection);
            if (!sameKeys(plan2.required, planFor(active).required)) preparePass(active, plan2);
          }
          return;
        }
        if (!committed) return;
        if (prepared) return;
        run(committed, "frame").catch((failure) => {
          if (live()) onMaterialError(failure);
        });
      } catch (failure) {
        if (live()) onFatalError(failure);
        throw failure;
      }
    },
    refineTextures() {
      if (!live()) return;
      textureRefinement = true;
      if (view) this.setView(view);
    },
    state,
    stats: () => Object.freeze({ ...state(), requests, passes, commits, framePublications, destroyed }),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      active?.controller.abort();
      if (active) releaseDemand(active);
      active = null;
    }
  });
}

// src/renderers/css/rendering/object-control-binding.ts
var isInput = (element) => element.tagName === "INPUT";
function publishDatasetSelection(buttons, details, contexts, pressed) {
  for (const button of buttons) button.setAttribute("aria-pressed", String(pressed.has(button.getAttribute("value") ?? "")));
  const active = buttons.find((button) => pressed.has(button.getAttribute("value") ?? ""))?.getAttribute("value");
  const groups = /* @__PURE__ */ new Map();
  for (const button of buttons) {
    const group = button.closest("[data-step-group]")?.dataset.stepGroup;
    if (group) groups.set(group, groups.get(group) === true || pressed.has(button.getAttribute("value") ?? ""));
  }
  for (const button of buttons) {
    const option = button.closest("[data-step-group]");
    if (option?.dataset.stepListed === "true") button.setAttribute("aria-pressed", String(groups.get(option.dataset.stepGroup) === true));
  }
  for (const { id, panel } of details) if (panel.hidden !== (id !== active)) panel.hidden = id !== active;
  for (const context of contexts) {
    const hidden = context.dataset.datasetContext !== active;
    if (context.hidden !== hidden) context.hidden = hidden;
  }
}
function createObjectControlBinding({ stage, controls, initialSelection, getState, onAction, onError }) {
  requireObjectControls(controls);
  if (!stage?.ownerDocument || [getState, onAction, onError].some((callback) => typeof callback !== "function")) {
    throw new TypeError("Object controls require the mounted document and shared selection endpoint.");
  }
  const document2 = stage.ownerDocument;
  const information = document2.querySelector(".object-information-panel");
  const lensForm = information?.querySelector("form[data-dataset-form]");
  const lensRoot = lensForm?.closest(".object-lenses");
  const settingsRoot = document2.querySelector(".object-settings");
  const formButtons = [...lensForm?.elements ?? []].filter((input) => input.tagName === "BUTTON" && input.getAttribute("name") === "dataset");
  const lensInputs = formButtons.filter((input) => !input.hasAttribute("data-dataset-step"));
  const stepInputs = formButtons.filter((input) => input.hasAttribute("data-dataset-step"));
  const settingsInputs = [...settingsRoot?.querySelectorAll("input[name], button[name]") ?? []].filter((input) => !["motion", "heliosphere", "illustrationModels", "surfaceLabels", "threeDStars"].includes(input.name));
  const details = lensInputs.map((input) => {
    const id = input.getAttribute("aria-controls");
    const panel = id ? document2.getElementById(id) : null;
    if (!panel) throw new Error(`Rendered dataset details are missing: ${input.value}.`);
    return { id: input.value, panel };
  });
  const contexts = [...information?.querySelectorAll("[data-dataset-context]") ?? []];
  const busyRoots = new Set([lensRoot, settingsRoot].filter((root) => !!root));
  const lenses = new Map(lensInputs.map((input) => [input.value, input]));
  const settings = new Map(settingsInputs.map((input) => [input.name, input]));
  function settingInput(name) {
    const input = settings.get(name);
    if (!input) throw new Error(`Rendered object control is missing: ${name}.`);
    return input;
  }
  function invalidCycle() {
    throw new Error("A cycle requires prepared cycle content.");
  }
  const lensPlans = controls.lenses?.controls ?? [], settingPlans = controls.settings?.controls ?? [];
  if (lenses.size !== lensInputs.length || lenses.size !== lensPlans.length || lensPlans.some((lens) => !lenses.has(lens.id)) || settings.size !== settingsInputs.length || settings.size !== settingPlans.length || settingPlans.some((control) => !settings.has(control.name))) {
    throw new Error("Rendered object controls do not match their actual package content.");
  }
  for (const control of settingPlans) {
    const input = settingInput(control.name);
    if (control.kind === "toggle" ? input.type !== "checkbox" : input.tagName !== "BUTTON" && input.type !== "range") throw new Error(`Rendered ${control.name} control has the wrong input type.`);
    if (control.kind === "cycle") {
      const states = objectCycleStates(control);
      if (isInput(input) && input.type === "range") {
        const values = states.map((state) => state.value).sort((a, b) => a - b);
        const minimum = Number(input.min), maximum = Number(input.max), step = Number(input.step);
        if (minimum !== values[0] || maximum !== values.at(-1) || !(step > 0) || values.some((value, index) => value !== minimum + index * step)) {
          throw new Error(`Rendered ${control.name} range does not match its declared states.`);
        }
      }
    }
  }
  let ready = false, destroyed = false, lastState = null, actions = 0;
  const nativeChanges = /* @__PURE__ */ new Map();
  const listeners = [];
  function listen(input, event, callback) {
    input.addEventListener(event, callback);
    listeners.push(() => input.removeEventListener(event, callback));
  }
  function publish(next = getState()) {
    if (destroyed) return;
    lastState = next;
    const committed = next.committed ?? initialSelection;
    const shown = next.pending ? next.desired : committed;
    const pressed = new Set(next.plan?.pressedLenses ?? [committed.lensId]);
    for (const input of lensInputs) {
      const root = input.closest(".object-lenses");
      if (root) busyRoots.add(root);
    }
    for (const root of busyRoots) {
      root.classList.toggle("is-loading", !ready || next.pending === true);
      root.setAttribute("aria-busy", String(!ready || next.pending === true));
    }
    for (const input of lensInputs) {
      input.disabled = input.type === "submit" ? false : !ready;
    }
    publishDatasetSelection(lensInputs, details, contexts, pressed);
    for (const control of settingPlans) {
      const input = settingInput(control.name);
      if (nativeChanges.has(control.name)) continue;
      if (control.kind === "toggle" && isInput(input)) input.checked = shown[control.name] === true;
      else {
        const selected = objectCycleStates(control.kind === "cycle" ? control : invalidCycle()).find((state) => state.value === shown[control.name]);
        if (!selected) throw new Error(`Selected ${control.name} is not declared by its content.`);
        if (isInput(input) && input.type === "range") input.value = String(selected.value);
        input.dataset.state = selected.label;
        input.setAttribute("aria-label", `${control.label}: ${selected.label}`);
      }
      if (control.name === "speed") {
        input.dataset.runtimeReady = String(ready);
        if (!ready) input.disabled = true;
      } else input.disabled = input.hasAttribute("form") ? false : !ready;
    }
  }
  function act(action) {
    if (destroyed) return;
    if (!ready) {
      if (action.kind !== "lens" && settings.get(action.name)?.hasAttribute("form")) {
        nativeChanges.set(action.name, requireObjectAction(controls, action));
      } else publish();
      return;
    }
    try {
      const validated = requireObjectAction(controls, action);
      actions++;
      Promise.resolve(onAction(validated)).catch((error) => {
        if (destroyed) return;
        publish();
        onError(error);
      });
    } catch (error) {
      if (!destroyed) {
        publish();
        onError(error);
      }
    }
  }
  try {
    publish();
    for (const [id, input] of lenses) listen(input, "click", (event) => {
      if (!ready) return;
      event.preventDefault();
      act({ kind: "lens", id });
    });
    for (const input of stepInputs) {
      if (input.disabled && !input.dataset.datasetStep) continue;
      if (!lenses.has(input.value)) throw new Error(`A dataset step names an unknown dataset: ${input.value}.`);
      listen(input, "click", (event) => {
        if (!ready) return;
        event.preventDefault();
        act({ kind: "lens", id: input.value });
      });
    }
    for (const control of settingPlans) {
      const input = settingInput(control.name);
      const event = control.kind === "toggle" ? "change" : input.type === "range" ? "input" : "click";
      listen(input, event, () => {
        const states = control.kind === "cycle" ? objectCycleStates(control) : null;
        const current = (getState().desired ?? initialSelection)[control.name];
        if (control.kind === "toggle") {
          if (!isInput(input)) throw new Error("A toggle requires an input element.");
          act({ kind: "toggle", name: control.name, value: input.checked });
        } else {
          if (!states) throw new Error("A cycle requires its prepared states.");
          const value = input.type === "range" ? Number(input.value) : states[(states.findIndex((state) => state.value === current) + 1) % states.length].value;
          act({ kind: "cycle", name: control.name, value });
        }
      });
    }
  } catch (error) {
    const errors = cleanup();
    throw errors.length ? new AggregateError([error, ...errors], error instanceof Error ? error.message : String(error), { cause: error }) : error;
  }
  function cleanup() {
    destroyed = true;
    ready = false;
    const errors = [];
    for (const remove of listeners.splice(0)) {
      try {
        remove();
      } catch (error) {
        errors.push(error);
      }
    }
    for (const input of [...lensInputs, ...settingsInputs]) {
      try {
        input.disabled = input.type !== "submit" && !input.hasAttribute("form");
        if (input.name === "speed") {
          input.disabled = true;
          input.dataset.runtimeReady = "false";
        }
      } catch (error) {
        errors.push(error);
      }
    }
    for (const root of busyRoots) {
      try {
        root.classList.remove("is-loading");
        root.setAttribute("aria-busy", "false");
      } catch (error) {
        errors.push(error);
      }
    }
    return errors;
  }
  return Object.freeze({
    publish,
    setReady(value = true) {
      if (destroyed) return;
      ready = value === true;
      if (ready) {
        for (const action of nativeChanges.values()) act(action);
        nativeChanges.clear();
      }
      publish();
    },
    stats: () => Object.freeze({
      ready,
      destroyed,
      actions,
      listenerCount: listeners.length,
      lensIds: Object.freeze([...lenses.keys()]),
      settings: Object.freeze([...settings.keys()]),
      state: lastState
    }),
    destroy() {
      if (destroyed) return;
      const errors = cleanup();
      if (errors.length) throw new AggregateError(errors, "Object control cleanup failed.");
    }
  });
}

// src/renderers/css/rendering/prepared-playback.ts
function createPreparedPlayback() {
  const handles = /* @__PURE__ */ new Map();
  let allowed = false, ready = false, destroyed = false, selection = Object.freeze({ speed: 1 });
  const enabled = (rules) => Object.entries(rules).every(([name, expected]) => Array.isArray(expected) ? expected.includes(selection[name]) : Object.is(selection[name], expected));
  function apply2(entry) {
    const { animation, mode, rate, enabledWhen } = entry;
    const speed = speedOf(selection);
    const nextRate = mode === "pose" ? rate : rate * speed;
    const running = mode === "motion" && ready && allowed && speed !== 0 && enabled(enabledWhen);
    if (entry.appliedRate !== nextRate) {
      animation.playbackRate = nextRate;
      entry.appliedRate = nextRate;
    }
    if (entry.running !== running) {
      if (running) animation.play();
      else animation.pause();
      entry.running = running;
    }
  }
  function applyAll() {
    if (destroyed) return;
    const errors = [];
    for (const entry of handles.values()) {
      try {
        apply2(entry);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw new AggregateError(errors, "Prepared native playback publication failed.");
  }
  return Object.freeze({
    register(animation, { mode = "motion", rate = 1, enabledWhen = {}, initialTime } = {}) {
      if (!animation || ["play", "pause", "cancel"].some((name) => typeof animation[name] !== "function") || !["motion", "pose"].includes(mode) || !Number.isFinite(rate) || initialTime !== void 0 && !Number.isFinite(initialTime) || !enabledWhen || typeof enabledWhen !== "object" || Array.isArray(enabledWhen)) {
        throw new TypeError("Prepared playback requires a native animation and valid prepared role.");
      }
      if (destroyed) {
        animation.cancel();
        return animation;
      }
      if (handles.has(animation)) return animation;
      const entry = { animation, mode, rate, enabledWhen: Object.freeze({ ...enabledWhen }), running: null, appliedRate: null };
      handles.set(animation, entry);
      if (initialTime !== void 0) animation.currentTime = initialTime;
      apply2(entry);
      return animation;
    },
    seek(animation, time) {
      if (destroyed) return;
      const entry = handles.get(animation);
      if (entry?.mode !== "pose" || !Number.isFinite(time)) throw new TypeError("Prepared pose seek requires a registered pose animation and finite time.");
      animation.currentTime = time;
    },
    resetMotion() {
      if (destroyed) return;
      for (const { animation, mode } of handles.values()) if (mode === "motion") animation.currentTime = 0;
    },
    captureMotion() {
      return [...handles.values()].filter((entry) => entry.mode === "motion").map(({ animation }) => Number(animation.currentTime ?? 0));
    },
    validateMotion(times) {
      if (!Array.isArray(times) || times.length !== [...handles.values()].filter((entry) => entry.mode === "motion").length || times.some((time) => !Number.isFinite(time) || time < 0)) {
        throw new TypeError("Saved playback does not match this prepared scene.");
      }
    },
    restoreMotion(times) {
      if (destroyed) return;
      this.validateMotion(times);
      let index = 0;
      for (const { animation, mode } of handles.values()) if (mode === "motion") animation.currentTime = times[index++];
    },
    setAllowed(value) {
      if (destroyed) return;
      allowed = value === true;
      applyAll();
    },
    setReady(value = true) {
      if (destroyed) return;
      ready = value === true;
      applyAll();
    },
    setSelection(next) {
      if (destroyed) return;
      speedOf(next);
      selection = Object.freeze({ ...next });
      applyAll();
    },
    stats() {
      return Object.freeze({
        allowed,
        ready,
        destroyed,
        speed: speedOf(selection),
        registeredCount: handles.size,
        animations: Object.freeze([...handles.values()].map(({ animation, mode, running, appliedRate }) => Object.freeze({
          mode,
          running,
          rate: appliedRate,
          currentTime: animation.currentTime,
          playState: animation.playState
        })))
      });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      allowed = false;
      ready = false;
      const owned = [...handles.keys()];
      handles.clear();
      const errors = [];
      for (const animation of owned) {
        try {
          animation.cancel();
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length) throw new AggregateError(errors, "Prepared native animation cleanup failed.");
    }
  });
}
function speedOf(selection) {
  const speed = selection?.speed ?? 1;
  if (!selection || typeof speed !== "number" || !Number.isFinite(speed) || speed < 0) throw new TypeError("Prepared speed must be a finite nonnegative rate.");
  return speed;
}

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
  const targetZoom = clamp3(
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
    startZoom: clamp3(currentZoom, minimumZoom, maximumZoom),
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
  const time = clamp3(progress, 0, 1);
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
    zoom: time === 1 ? plan.targetZoom : clamp3(directZoom, plan.minimumZoom, plan.maximumZoom),
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
    const scale2 = 2 * Math.sqrt(trace + 1);
    x = (matrix[2][1] - matrix[1][2]) / scale2;
    y = (matrix[0][2] - matrix[2][0]) / scale2;
    z = (matrix[1][0] - matrix[0][1]) / scale2;
    w = scale2 / 4;
  } else {
    const axis = matrix[0][0] > matrix[1][1] ? matrix[0][0] > matrix[2][2] ? 0 : 2 : matrix[1][1] > matrix[2][2] ? 1 : 2;
    const first = axis;
    const second = (axis + 1) % 3;
    const third = (axis + 2) % 3;
    const scale2 = 2 * Math.sqrt(
      1 + matrix[first][first] - matrix[second][second] - matrix[third][third]
    );
    const components = [0, 0, 0];
    components[first] = scale2 / 4;
    components[second] = (matrix[second][first] + matrix[first][second]) / scale2;
    components[third] = (matrix[third][first] + matrix[first][third]) / scale2;
    [x, y, z] = components;
    w = (matrix[third][second] - matrix[second][third]) / scale2;
  }
  return normalize4([x, y, z, w]);
}
function quaternionPower(rotation, amount) {
  if (amount <= 0) return [0, 0, 0, 1];
  if (amount >= 1) return [...rotation];
  const vectorLength = Math.hypot(rotation[0], rotation[1], rotation[2]);
  if (vectorLength < 1e-12) return [0, 0, 0, 1];
  const angle = Math.atan2(vectorLength, rotation[3]) * amount;
  const scale2 = Math.sin(angle) / vectorLength;
  return [
    rotation[0] * scale2,
    rotation[1] * scale2,
    rotation[2] * scale2,
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
function clamp3(value, minimum, maximum) {
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
function setHoverCursor(surface, cursor) {
  const state = stateFor(surface);
  state.hover = cursor;
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

// src/renderers/css/navigation/prepared-wheel-zoom.ts
var PREPARED_WHEEL_ZOOM = Object.freeze({
  schema: "cssearth-prepared-wheel-zoom@1",
  intervalMilliseconds: 200,
  sourceFunctions: Object.freeze({
    wheelDispatch: "0x0090d752",
    cameraZoom: "0x0094a860",
    cameraStep: "0x005d1152"
  })
});
function createPreparedWheelZoomControls({
  inputSurface,
  runtimePolicy,
  camera,
  rotate,
  speedMultiplier = runtimePolicy.WHEEL_ZOOM_SPEED_MULTIPLIER,
  dolly,
  inertia = runtimePolicy.WHEEL_ZOOM_INERTIA,
  inertiaInputKinds = runtimePolicy.WHEEL_ZOOM_INERTIA_INPUT_KINDS,
  onError = null
}) {
  const glidePolicy = inertia ?? null;
  const glideKinds = Object.freeze([...inertiaInputKinds]);
  if (!(inputSurface instanceof HTMLElement) || typeof camera?.state !== "object" || typeof rotate !== "function" || !Number.isFinite(speedMultiplier) || speedMultiplier <= 0 || !(dolly?.stepPerDelta > 0) || glidePolicy !== null && !(glidePolicy.dampingSeconds > 0 && glidePolicy.gain > 0 && glidePolicy.stopLogRatePerSecond > 0 && glidePolicy.stopRateRatio > 0 && glidePolicy.stopRateRatio < 1) || !glideKinds.every((kind) => kind === "wheel" || kind === "trackpad") || onError !== null && typeof onError !== "function") {
    throw new TypeError("Prepared wheel zoom controls are invalid.");
  }
  const windowTarget = inputSurface.ownerDocument.defaultView;
  if (!windowTarget) throw new Error("Input document has no window.");
  let disposed = false;
  const guard = (callback) => (...args) => {
    if (disposed) return;
    try {
      return callback(...args);
    } catch (error) {
      destroy();
      if (onError === null) throw error;
      onError(error);
    }
  };
  const frameClock = createOpacityClock(windowTarget);
  const requestFrame = (callback) => frameClock.request(guard(callback), "input");
  const cancelFrame = (id) => frameClock.cancel(id);
  let enabled = true;
  let frame = null;
  let direction = 0;
  let expiresAt = 0;
  let previousTimestamp = null;
  let targetDistance = null;
  let inputKind = null;
  let previousInputTimestamp = -Infinity;
  let events = 0;
  let frames = 0;
  let travelRate = 0;
  let gliding = false, glideRate = 0, releasedRate = 0, glidePrevious = 0;
  const stop = () => {
    if (frame !== null) cancelFrame(frame);
    frame = null;
    previousTimestamp = null;
    direction = 0;
    targetDistance = null;
    gliding = false;
    glideRate = 0;
    releasedRate = 0;
    travelRate = 0;
  };
  const recordTravel = (ratio, elapsed) => {
    if (!(elapsed > 0) || !(ratio > 0)) return;
    const applied = Math.log(ratio) / elapsed;
    travelRate = travelRate === 0 ? applied : travelRate * 0.6 + applied * 0.4;
  };
  const glide = (timestamp) => {
    if (glidePolicy === null) {
      frame = null;
      gliding = false;
      return;
    }
    const step = Math.max(0, timestamp - glidePrevious);
    glidePrevious = timestamp;
    glideRate *= Math.max(0, 1 - step / (glidePolicy.dampingSeconds * 1e3));
    if (step > 0 && glideRate !== 0) {
      const distance = camera.state.distance * Math.exp(glideRate * step);
      rotate({ controlPitchDelta: 0, controlYawDelta: 0, distance });
      if (disposed) return;
      frames += 1;
      if (camera.state.distance !== distance) glideRate = 0;
    }
    const stopRate = Math.max(
      glidePolicy.stopLogRatePerSecond / 1e3,
      Math.abs(releasedRate) * glidePolicy.stopRateRatio
    );
    if (Math.abs(glideRate) > stopRate) {
      frame = requestFrame(glide);
    } else {
      frame = null;
      previousTimestamp = null;
      direction = 0;
      gliding = false;
      glideRate = 0;
    }
  };
  const animate = (timestamp) => {
    if (previousTimestamp === null) previousTimestamp = timestamp;
    const remaining = expiresAt - previousTimestamp;
    const elapsed = Math.max(0, Math.min(
      timestamp - previousTimestamp,
      expiresAt - previousTimestamp
    ));
    const leftover = Math.max(0, timestamp - previousTimestamp - elapsed);
    previousTimestamp = timestamp;
    if (elapsed > 0 && direction !== 0) {
      const previousDistance = camera.state.distance;
      const distance = previousDistance * Math.exp(
        Math.log(targetDistance / previousDistance) * Math.min(1, elapsed / remaining)
      );
      rotate({ controlPitchDelta: 0, controlYawDelta: 0, distance });
      if (disposed) return;
      frames += 1;
      recordTravel(camera.state.distance / previousDistance, elapsed);
      if (camera.state.distance !== distance) targetDistance = camera.state.distance;
    }
    const continuing = timestamp < expiresAt && camera.state.distance !== targetDistance;
    if (continuing) {
      frame = requestFrame(animate);
      return;
    }
    if (glidePolicy !== null && direction !== 0 && travelRate !== 0 && (inputKind === null || glideKinds.includes(inputKind))) {
      releasedRate = travelRate * glidePolicy.gain;
      glideRate = releasedRate;
      glidePrevious = timestamp - leftover;
      travelRate = 0;
      gliding = true;
      if (leftover > 0) {
        glide(timestamp);
        return;
      }
      frame = requestFrame(glide);
      return;
    }
    frame = null;
    previousTimestamp = null;
  };
  const onWheel = (event) => {
    if (!enabled || !Number.isFinite(event.deltaY) || event.deltaY === 0 || event.defaultPrevented) return;
    event.preventDefault();
    if (gliding) {
      if (frame !== null) cancelFrame(frame);
      frame = null;
      gliding = false;
      glideRate = 0;
      releasedRate = 0;
      previousTimestamp = null;
      travelRate = 0;
    }
    const nextDirection = -Math.sign(event.deltaY);
    if (direction !== 0 && nextDirection !== direction) travelRate = 0;
    const unit2 = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? inputSurface.clientHeight || windowTarget.innerHeight || 800 : 1;
    inputKind = runtimePolicy.wheelZoomInputKind(event, inputKind, previousInputTimestamp);
    previousInputTimestamp = event.timeStamp;
    const origin = frame !== null && direction === nextDirection ? targetDistance : camera.state.distance;
    const inputSpeed = inputKind === "wheel" ? runtimePolicy.WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER : event.ctrlKey ? runtimePolicy.WHEEL_ZOOM_PINCH_SPEED_MULTIPLIER : speedMultiplier;
    targetDistance = origin * Math.exp(event.deltaY * unit2 * dolly.stepPerDelta * inputSpeed);
    direction = nextDirection;
    expiresAt = event.timeStamp + PREPARED_WHEEL_ZOOM.intervalMilliseconds;
    events += 1;
    if (frame === null) {
      previousTimestamp = event.timeStamp;
      frame = requestFrame(animate);
    }
  };
  const guardedWheel = guard(onWheel);
  inputSurface.addEventListener("wheel", guardedWheel, { passive: false });
  function destroy() {
    if (disposed) return;
    disposed = true;
    stop();
    frameClock.destroy();
    inputSurface.removeEventListener("wheel", guardedWheel);
  }
  return Object.freeze({
    stop,
    update(options = {}) {
      if (disposed) return;
      if (options.wheel !== void 0) enabled = Boolean(options.wheel);
      if (!enabled) stop();
    },
    destroy,
    stats: () => Object.freeze({
      active: frame !== null,
      gliding,
      events,
      frames,
      inputKind,
      model: "perspective-dolly"
    })
  });
}

// src/renderers/css/navigation/object-interaction-controls.ts
function createObjectInteractionControls({
  inputSurface,
  cameraMotion,
  runtimePolicy,
  camera,
  trackballMetrics,
  sceneMatrix,
  rotate,
  minimumZoom,
  maximumZoom,
  dolly,
  surfaceFlyToHitTest = null,
  onStart,
  onEnd,
  onError = null
}, services = {}) {
  const { createUnboundedMatrixDragControls: createUnboundedMatrixDragControls2 = createUnboundedMatrixDragControls, createPreparedWheelZoomControls: createPreparedWheelZoomControls2 = createPreparedWheelZoomControls } = services;
  if (typeof sceneMatrix !== "function") {
    throw new TypeError("Object interaction controls require the current scene matrix.");
  }
  const lifetime = createSceneLifetime();
  const fail = (error) => {
    const cleanup = lifetime.destroy();
    const failure = cleanup.length ? new AggregateError([error, ...cleanup], errorMessage(error), { cause: error }) : error;
    if (onError === null) throw failure;
    onError(failure);
  };
  try {
    const interactionTrackballMetrics = () => interactionTrackball(trackballMetrics());
    const dragControls = createUnboundedMatrixDragControls2({
      inputSurface,
      cameraMotion,
      runtimePolicy,
      onError: fail,
      trackballMetrics: () => Object.freeze({
        ...interactionTrackballMetrics(),
        angularDegreesPerTrackballRadius: directAngularDegreesPerTrackballRadius(camera.state.zoom),
        pitchResponse: directPitchResponseForZoom(camera.state.zoom)
      }),
      flyToTrackballMetrics: () => Object.freeze({
        ...interactionTrackballMetrics(),
        sceneMatrix: sceneMatrix()
      }),
      surfaceFlyToState: () => Object.freeze({
        zoom: camera.state.zoom,
        minimumZoom,
        maximumZoom
      }),
      surfaceFlyToHitTest,
      onPointerStart: () => wheelControls.stop(),
      onStart,
      onEnd,
      rotate
    });
    lifetime.onDispose(() => dragControls.destroy());
    const wheelControls = createPreparedWheelZoomControls2({
      inputSurface,
      runtimePolicy,
      onError: fail,
      camera,
      rotate(delta) {
        rotate(delta);
        dragControls.invalidateTrackball();
      },
      dolly
    });
    lifetime.onDispose(() => wheelControls.destroy());
    return Object.freeze({
      update(options) {
        if (lifetime.disposed) return;
        wheelControls.update(options);
        dragControls.update(options);
      },
      stop() {
        wheelControls.stop();
        dragControls.stop();
      },
      stats: () => Object.freeze({
        ...dragControls.stats(),
        wheelZoom: wheelControls.stats()
      }),
      destroy() {
        const errors = lifetime.destroy();
        if (errors.length) throw new AggregateError(errors, "Object input cleanup failed.");
      }
    });
  } catch (error) {
    const cleanup = lifetime.destroy();
    if (cleanup.length) throw new AggregateError([error, ...cleanup], errorMessage(error), { cause: error });
    throw error;
  }
}

// src/renderers/css/navigation/screen-picking.ts
var registries = /* @__PURE__ */ new WeakMap();
function createRegistry() {
  const publications = /* @__PURE__ */ new Map();
  const listeners = /* @__PURE__ */ new Set();
  return {
    publish(owner, targets) {
      publications.set(owner, targets);
      for (const listener of listeners) listener();
    },
    remove(owner) {
      if (publications.delete(owner)) for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    pick(x, y) {
      let direct = null;
      for (const targets of publications.values()) for (const target of targets) {
        if (target.shape.kind === "segments") continue;
        if (target.element.ariaDisabled === "true") continue;
        if (direct && direct.rank > target.rank) continue;
        if (!hitsScreenShape(target.shape, x, y)) continue;
        direct = target;
      }
      if (direct) return direct.element;
      let orbit = null;
      for (const targets of publications.values()) for (const target of targets) {
        if (target.shape.kind !== "segments" || target.element.ariaDisabled === "true" || orbit && orbit.rank > target.rank) continue;
        if (hitsScreenShape(target.shape, x, y)) orbit = target;
      }
      return orbit?.element ?? null;
    }
  };
}
function screenPicking(host) {
  let registry = registries.get(host);
  if (!registry) {
    registry = createRegistry();
    registries.set(host, registry);
  }
  return registry;
}
function hitsScreenShape(shape, x, y) {
  if (shape.kind === "rect") return x >= shape.left && x <= shape.right && y >= shape.top && y <= shape.bottom;
  if (shape.kind === "circle") return (x - shape.x) ** 2 + (y - shape.y) ** 2 <= shape.radius ** 2;
  const bounds = shape.bounds;
  if (bounds === null || bounds && (x < bounds.left - shape.halfWidth || x > bounds.right + shape.halfWidth || y < bounds.top - shape.halfWidth || y > bounds.bottom + shape.halfWidth)) return false;
  for (const [x0, y0, x1, y1, opacity] of shape.segments) {
    if (opacity <= 0.1 || x < Math.min(x0, x1) - shape.halfWidth || x > Math.max(x0, x1) + shape.halfWidth || y < Math.min(y0, y1) - shape.halfWidth || y > Math.max(y0, y1) + shape.halfWidth) continue;
    const dx = x1 - x0, dy = y1 - y0, lengthSquared = dx * dx + dy * dy;
    const along = ((x - x0) * dx + (y - y0) * dy) / lengthSquared;
    if (along < 0 || along > 1 || lengthSquared === 0) continue;
    const cross = (x - x0) * dy - (y - y0) * dx;
    if (cross * cross <= shape.halfWidth ** 2 * lengthSquared) return true;
  }
  return false;
}

// src/renderers/css/navigation/world-camera-picking.ts
var gestures = /* @__PURE__ */ new WeakMap();
var DOUBLE_CLICK_MILLISECONDS = 500;
var CLICK_SLOP_PIXELS = 5;
function bindWorldCameraPicking(inputSurface, host, readBounds, detailOccludes) {
  const document2 = inputSurface.ownerDocument;
  const windowTarget = document2.defaultView;
  if (!windowTarget) throw new Error("World picking requires a mounted window.");
  const gesture = gestures.get(inputSurface) ?? { selected: null, second: null, consumeRelease: false };
  gestures.set(inputSurface, gesture);
  let pointer = null;
  let hovered = null;
  const registry = screenPicking(host);
  const pick = (event) => {
    const bounds = readBounds();
    const target = registry.pick(
      event.clientX - bounds.left - bounds.width / 2,
      event.clientY - bounds.top - bounds.height / 2
    );
    return target && target.dataset.surfacePick !== "true" && detailOccludes?.(event.clientX, event.clientY) ? null : target;
  };
  let hoveredGroup = null;
  const setHovered = (target, interactive) => {
    if (target === hovered) return;
    if (hovered) delete hovered.dataset.objectHovered;
    if (hoveredGroup) delete hoveredGroup.dataset.objectHovered;
    hoveredGroup = target?.closest("[data-context-group]") ?? (target?.dataset.objectNavigate ? host.querySelector(`[data-context-group="${target.dataset.objectNavigate}"]`) : null);
    if (hoveredGroup) hoveredGroup.dataset.objectHovered = "true";
    if (target) {
      target.dataset.objectHovered = "true";
      setHoverCursor(inputSurface, target.dataset.objectNavigate ? "pointer" : null);
    } else {
      setHoverCursor(inputSurface, null);
    }
    hovered = target;
    host.dispatchEvent(new CustomEvent("objecthoverchange", { detail: { interactive } }));
  };
  const frameClock = createOpacityClock(windowTarget);
  let hoverPoint = null, hoverFrame = null;
  let hoverInteractive = false;
  const scheduleHover = (interactive = false) => {
    hoverInteractive ||= interactive;
    if (!hoverPoint || hoverFrame !== null) return;
    hoverFrame = frameClock.request(() => {
      hoverFrame = null;
      const interactive2 = hoverInteractive;
      hoverInteractive = false;
      setHovered(hoverPoint ? pick(hoverPoint) : null, interactive2);
    });
  };
  const unsubscribe = registry.subscribe(scheduleHover);
  const clearHover = (event) => {
    hoverPoint = null;
    if (hoverFrame !== null) frameClock.cancel(hoverFrame);
    hoverFrame = null;
    hoverInteractive = false;
    setHovered(null, event?.type === "pointerleave");
  };
  const matchesSelection = (event) => {
    const selected = gesture.selected;
    return selected !== null && event.timeStamp >= selected.timestamp && event.timeStamp - selected.timestamp <= DOUBLE_CLICK_MILLISECONDS && Math.hypot(event.clientX - selected.x, event.clientY - selected.y) <= CLICK_SLOP_PIXELS;
  };
  const consume = (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const down = (event) => {
    clearHover();
    if (event.target !== inputSurface || !event.isPrimary || event.button !== 0) return;
    if (event.pointerType === "mouse" && matchesSelection(event)) {
      gesture.second = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        x: event.clientX,
        y: event.clientY
      };
      gesture.consumeRelease = true;
      consume(event);
      return;
    }
    gesture.selected = null;
    gesture.second = null;
    gesture.consumeRelease = false;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false };
  };
  const move = (event) => {
    if (event.target === inputSurface && event.buttons === 0 && event.pointerType !== "touch") {
      hoverPoint = event;
      scheduleHover(true);
    } else clearHover();
    const second = gesture.second;
    if (second?.pointerId === event.pointerId) {
      if (Math.hypot(event.clientX - second.x, event.clientY - second.y) <= CLICK_SLOP_PIXELS) {
        consume(event);
        return;
      }
      gesture.selected = null;
      gesture.second = null;
      gesture.consumeRelease = false;
      inputSurface.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerId: second.pointerId,
        pointerType: second.pointerType,
        isPrimary: true,
        button: 0,
        buttons: 1,
        clientX: second.x,
        clientY: second.y
      }));
    }
    if (pointer?.id === event.pointerId && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > CLICK_SLOP_PIXELS) pointer.dragged = true;
  };
  const up = (event) => {
    if (gesture.second?.pointerId !== event.pointerId) return;
    gesture.second = null;
    consume(event);
  };
  const mouseDown = (event) => {
    if (event.target === inputSurface && gesture.consumeRelease && matchesSelection(event)) consume(event);
  };
  const click = (event) => {
    if (event.target === inputSurface && gesture.consumeRelease && matchesSelection(event)) {
      consume(event);
      return;
    }
    if (event.button !== 0 || pointer?.dragged || event.target !== inputSurface) {
      pointer = null;
      return;
    }
    pointer = null;
    const target = pick(event);
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.objectNavigateActivation === "dblclick") {
      consume(event);
      return;
    }
    gesture.selected = {
      x: event.clientX,
      y: event.clientY,
      timestamp: event.timeStamp,
      objectId: target.dataset.objectNavigate
    };
    event.preventDefault();
    event.stopPropagation();
    target.click();
  };
  const doubleClick = (event) => {
    if (event.target !== inputSurface) return;
    if (gesture.consumeRelease && matchesSelection(event)) {
      gesture.selected = null;
      gesture.second = null;
      gesture.consumeRelease = false;
      consume(event);
      return;
    }
    const target = pick(event);
    if (event.button !== 0 || target?.dataset.objectNavigateActivation !== "dblclick") return;
    consume(event);
    target.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, button: 0 }));
  };
  const cancel = () => {
    clearHover();
    pointer = null;
    gesture.second = null;
    gesture.consumeRelease = false;
  };
  windowTarget.addEventListener("pointerdown", down, { capture: true });
  windowTarget.addEventListener("pointermove", move, { capture: true });
  windowTarget.addEventListener("pointerup", up, { capture: true });
  windowTarget.addEventListener("pointercancel", cancel, { capture: true });
  windowTarget.addEventListener("mousedown", mouseDown, { capture: true });
  windowTarget.addEventListener("click", click, { capture: true });
  windowTarget.addEventListener("dblclick", doubleClick, { capture: true });
  windowTarget.addEventListener("blur", clearHover);
  windowTarget.addEventListener("wheel", clearHover, { capture: true });
  inputSurface.addEventListener("pointerleave", clearHover);
  return () => {
    clearHover();
    unsubscribe();
    windowTarget.removeEventListener("pointerdown", down, { capture: true });
    windowTarget.removeEventListener("pointermove", move, { capture: true });
    windowTarget.removeEventListener("pointerup", up, { capture: true });
    windowTarget.removeEventListener("pointercancel", cancel, { capture: true });
    windowTarget.removeEventListener("mousedown", mouseDown, { capture: true });
    windowTarget.removeEventListener("click", click, { capture: true });
    windowTarget.removeEventListener("dblclick", doubleClick, { capture: true });
    windowTarget.removeEventListener("blur", clearHover);
    windowTarget.removeEventListener("wheel", clearHover, { capture: true });
    inputSurface.removeEventListener("pointerleave", clearHover);
  };
}

// src/renderers/css/navigation/world-camera-hit.ts
function hitsProjectedBody(clientX, clientY, body, cameraBounds, markerBounds = null, physical) {
  if (body.silhouette === null && physical) {
    const { focalPixels: focal, principalOffsetPixels: offset, bodyRadiusUnits: radius } = physical;
    const ray = [
      clientX - cameraBounds.x - cameraBounds.width / 2 - offset[0],
      clientY - cameraBounds.y - cameraBounds.height / 2 - offset[1],
      -focal
    ];
    const center = [body.translate[0] - offset[0], body.translate[1] - offset[1], body.translate[2] - focal];
    const lengthSquared = ray.reduce((sum, value) => sum + value * value, 0);
    const along = ray.reduce((sum, value, axis) => sum + value * center[axis], 0);
    const outside = center.reduce((sum, value) => sum + value * value, 0) - radius * radius;
    return focal > 0 && radius > 0 && along > 0 && along * along - lengthSquared * outside >= 0;
  }
  if (!body.visible || body.silhouette === null) return false;
  const ellipse = body.silhouette;
  const x = clientX - cameraBounds.x - cameraBounds.width / 2 - ellipse.centre[0];
  const y = clientY - cameraBounds.y - cameraBounds.height / 2 - ellipse.centre[1];
  const length = Math.hypot(...ellipse.radial);
  const ux = length > 0 ? ellipse.radial[0] / length : 1;
  const uy = length > 0 ? ellipse.radial[1] / length : 0;
  const radial = (x * ux + y * uy) / ellipse.radialSemiAxis;
  const tangential = (-x * uy + y * ux) / ellipse.tangentialSemiAxis;
  if (radial * radial + tangential * tangential <= 1) return true;
  if (markerBounds && markerBounds.width > 0 && markerBounds.height > 0) {
    const mx = (clientX - markerBounds.x - markerBounds.width / 2) / (markerBounds.width / 2);
    const my = (clientY - markerBounds.y - markerBounds.height / 2) / (markerBounds.height / 2);
    return mx * mx + my * my <= 1;
  }
  return false;
}

// src/renderers/css/navigation/surface-target.ts
function prepareSurfaceTargetRotation(bodyCenterUnits) {
  if (bodyCenterUnits.length !== 3 || bodyCenterUnits.some((value) => !Number.isFinite(value))) {
    throw new TypeError("A surface target requires a finite physical body centre.");
  }
  const scale2 = Math.max(...bodyCenterUnits.map(Math.abs));
  if (scale2 === 0) throw new TypeError("A surface target cannot be centred on the eye.");
  const scaled = bodyCenterUnits.map((value) => -value / scale2);
  const length = Math.hypot(...scaled);
  const [x, y, z] = scaled.map((value) => value / length);
  const sine = Math.hypot(x, y);
  if (sine === 0) return Object.freeze(z >= 0 ? [1, 0, 0, 0, 1, 0, 0, 0, 1] : [1, 0, 0, 0, -1, 0, 0, 0, -1]);
  const axisX = -y / sine, axisY = x / sine, versine = 1 - z;
  return Object.freeze([
    z + axisX * axisX * versine,
    axisX * axisY * versine,
    x,
    axisX * axisY * versine,
    z + axisY * axisY * versine,
    y,
    -x,
    -y,
    z
  ]);
}

// src/renderers/css/navigation/world-camera-math.ts
function validateWorldRotation(rotation) {
  orthonormal(rotation, 1);
}
function validateWorldReflection(reflection) {
  orthonormal(reflection, -1);
}
function orthonormal(rotation, determinant) {
  if (rotation.length !== 9 || !rotation.every(Number.isFinite)) throw new TypeError("World rotation must contain nine finite components.");
  for (let row = 0; row < 3; row++) for (let other = 0; other < 3; other++) {
    let dot2 = 0;
    for (let column = 0; column < 3; column++) dot2 += rotation[row * 3 + column] * rotation[other * 3 + column];
    if (Math.abs(dot2 - Number(row === other)) > 1e-9) throw new TypeError("World rotation must be orthonormal.");
  }
  const [a, b, c, d, e, f, g, h, i] = rotation;
  if (Math.abs(a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g) - determinant) > 1e-9) {
    throw new TypeError(determinant === 1 ? "World rotation must preserve handedness." : "A map between CSS and a reference frame must reverse handedness.");
  }
}
function cssCameraAxesFromOrientation(orientation) {
  const r = worldRotationFromQuaternion(orientation);
  return [r[0], -r[1], r[2], r[3], -r[4], r[5], r[6], -r[7], r[8]];
}
function flipWorldRotationY(m) {
  return [m[0], -m[1], m[2], -m[3], m[4], -m[5], m[6], -m[7], m[8]];
}
function referenceRotationFromPresentation(m) {
  return [m[0], -m[1], m[2], m[3], -m[4], m[5], m[6], -m[7], m[8]];
}
function validateWorldPosition(value) {
  if (value.length !== 3 || !value.every(Number.isFinite)) throw new TypeError("World position must contain three finite components.");
}
function transposeWorldRotation(m) {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}
function rotateWorldPosition(m, p) {
  return [
    m[0] * p[0] + m[1] * p[1] + m[2] * p[2],
    m[3] * p[0] + m[4] * p[1] + m[5] * p[2],
    m[6] * p[0] + m[7] * p[1] + m[8] * p[2]
  ];
}
function scaleWorldPosition(p, scale2) {
  return [p[0] * scale2, p[1] * scale2, p[2] * scale2];
}
function worldQuaternionFromRotation(m) {
  const trace = m[0] + m[4] + m[8];
  let x, y, z, w;
  if (trace > 0) {
    const s = 2 * Math.sqrt(trace + 1);
    w = s / 4;
    x = (m[7] - m[5]) / s;
    y = (m[2] - m[6]) / s;
    z = (m[3] - m[1]) / s;
  } else if (m[0] > m[4] && m[0] > m[8]) {
    const s = 2 * Math.sqrt(1 + m[0] - m[4] - m[8]);
    w = (m[7] - m[5]) / s;
    x = s / 4;
    y = (m[1] + m[3]) / s;
    z = (m[2] + m[6]) / s;
  } else if (m[4] > m[8]) {
    const s = 2 * Math.sqrt(1 + m[4] - m[0] - m[8]);
    w = (m[2] - m[6]) / s;
    x = (m[1] + m[3]) / s;
    y = s / 4;
    z = (m[5] + m[7]) / s;
  } else {
    const s = 2 * Math.sqrt(1 + m[8] - m[0] - m[4]);
    w = (m[3] - m[1]) / s;
    x = (m[2] + m[6]) / s;
    y = (m[5] + m[7]) / s;
    z = s / 4;
  }
  const length = Math.hypot(x, y, z, w);
  return [x / length, y / length, z / length, w / length];
}
function worldRotationFromQuaternion([x, y, z, w]) {
  return [
    1 - 2 * (y * y + z * z),
    2 * (x * y - z * w),
    2 * (x * z + y * w),
    2 * (x * y + z * w),
    1 - 2 * (x * x + z * z),
    2 * (y * z - x * w),
    2 * (x * z - y * w),
    2 * (y * z + x * w),
    1 - 2 * (x * x + y * y)
  ];
}
function worldRotationCss(m) {
  return `matrix3d(${[m[0], m[3], m[6], 0, m[1], m[4], m[7], 0, m[2], m[5], m[8], 0, 0, 0, 0, 1].map((value) => Number(value.toFixed(12))).join(",")})`;
}

// src/renderers/css/solar-system/heliocentric-geometry.ts
function distanceForSilhouetteRadius(bodyRadius, focal, screenRadius, principalOffset = [0, 0]) {
  if (!positive(bodyRadius) || !positive(focal) || !positive(screenRadius)) {
    throw new TypeError("Silhouette framing arguments are invalid.");
  }
  const { cosTheta } = offAxisFrame(focal, principalOffset);
  const k = screenRadius / focal;
  const sinAlpha = k * cosTheta / Math.sqrt(1 + k * k);
  return bodyRadius / sinAlpha;
}
function silhouetteRadiusAtDistance(bodyRadius, focal, distance, principalOffset = [0, 0]) {
  return silhouetteEllipse(
    bodyRadius,
    focal,
    distance,
    offAxisFrame(focal, principalOffset)
  ).tangentialSemiAxis;
}
function offAxisFrame(focal, [ox, oy]) {
  const offset = Math.hypot(ox, oy);
  const hypotenuse = Math.hypot(offset, focal);
  return Object.freeze({
    radial: offset > 1e-9 ? [-ox / offset, -oy / offset] : [0, 0],
    sinTheta: offset / hypotenuse,
    cosTheta: focal / hypotenuse,
    tanTheta: offset / focal
  });
}
function silhouetteEllipse(bodyRadius, focal, distance, axis) {
  const sinAlpha = bodyRadius / distance;
  const sin2Alpha = 2 * sinAlpha * Math.sqrt(1 - sinAlpha * sinAlpha);
  const sin2Theta = 2 * axis.sinTheta * axis.cosTheta;
  const denominator = axis.cosTheta * axis.cosTheta - sinAlpha * sinAlpha;
  if (!(denominator > 0)) {
    throw new RangeError("The body's silhouette leaves the image plane.");
  }
  const radialSemiAxis = focal * sin2Alpha / (2 * denominator);
  const tangentialSemiAxis = focal * sinAlpha / Math.sqrt(denominator);
  const centreShift = focal * sin2Theta / (2 * denominator) - focal * axis.tanTheta;
  return Object.freeze({
    radialSemiAxis,
    tangentialSemiAxis,
    // Unit screen direction of the radial axis (from the principal point).
    radial: Object.freeze([...axis.radial]),
    // Ellipse centre relative to the root's centre.
    centre: Object.freeze([
      centreShift * axis.radial[0],
      centreShift * axis.radial[1]
    ])
  });
}
function rotationFromMatrix3d(matrix) {
  return Object.freeze([
    matrix.m11,
    matrix.m21,
    matrix.m31,
    matrix.m12,
    matrix.m22,
    matrix.m32,
    matrix.m13,
    matrix.m23,
    matrix.m33
  ]);
}
function positive(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

// src/renderers/css/navigation/selection-target.ts
function createWorldSelectionTarget(from, frame, viewport) {
  if (from.referenceFrame !== frame.referenceFrame || from.epochJdTt !== frame.epochJdTt) {
    throw new TypeError("Selection requires a common reference frame and prepared epoch.");
  }
  const sourceRotation = cssCameraAxesFromOrientation(from.pose.orientationXyzw);
  const direction = unit(rotateWorldPosition(
    sourceRotation,
    [viewport.principalOffsetPixels[0], viewport.principalOffsetPixels[1], viewport.focalPixels]
  ));
  const radius = viewport.framingRadiusPixels;
  const range = distanceForSilhouetteRadius(
    frame.bodyRadiusM,
    viewport.focalPixels,
    radius,
    viewport.principalOffsetPixels
  );
  return Object.freeze({
    referenceFrame: frame.referenceFrame,
    epochJdTt: frame.epochJdTt,
    pose: Object.freeze({
      positionM: Object.freeze([
        frame.originM[0] + direction[0] * range,
        frame.originM[1] + direction[1] * range,
        frame.originM[2] + direction[2] * range
      ]),
      orientationXyzw: Object.freeze([...from.pose.orientationXyzw])
    })
  });
}
function unit(a) {
  const length = Math.hypot(...a);
  if (!(length > 0)) throw new TypeError("Selection direction is undefined.");
  return [a[0] / length, a[1] / length, a[2] / length];
}

// src/renderers/css/navigation/prepared-focus.ts
function prepareFocusFlight(camera, focus, frame, viewport, milliseconds) {
  const checked = validatePreparedNavigationFocus(focus);
  if (milliseconds !== void 0 && (!Number.isFinite(milliseconds) || milliseconds <= 0)) throw new TypeError("Focus flight duration must be positive.");
  const from = camera.capture(frame);
  if (frame.referenceFrame !== "sun-icrf") throw new TypeError(`Prepared focus ${checked.id} needs a Sun-centred frame for its line of sight, not ${frame.referenceFrame}.`);
  const sightline = { ...from, pose: { ...from.pose, orientationXyzw: sightlineOrientation(checked.positionM, checked.upReference, viewport) } };
  const target = createWorldSelectionTarget(sightline, {
    ...frame,
    originM: checked.positionM,
    bodyRadiusM: checked.framingRadiusM,
    orbitUpReference: checked.upReference
  }, viewport);
  const offset = subtract2(target.pose.positionM, checked.positionM);
  const distance = Math.hypot(...offset);
  const arrival = Math.max(
    checked.limits.minimumDistanceM,
    Math.min(checked.limits.maximumDistanceM, checked.arrivalDistanceM ?? distance)
  );
  const to = { ...target.pose, positionM: add2(checked.positionM, scaleWorldPosition(offset, arrival / distance)) };
  const flight = createSelectionFlight({
    from: from.pose,
    to,
    focusPositionM: checked.positionM,
    ...milliseconds === void 0 ? {} : { durationS: milliseconds / 1e3 }
  });
  const value = createSelectionFlightSample();
  const sample = (progress) => {
    sampleSelectionFlightInto(flight, progress * flight.durationS, value);
    camera.adopt({ ...from, pose: { positionM: value.positionM, orientationXyzw: value.orientationXyzw } }, frame);
  };
  return { focus: checked, sample, durationMilliseconds: flight.durationS * 1e3 };
}
function validatePreparedNavigationFocus(focus) {
  if (!focus || typeof focus.id !== "string" || !/^[a-z0-9][a-z0-9:._+-]{0,127}$/iu.test(focus.id) || !Number.isFinite(focus.framingRadiusM) || focus.framingRadiusM <= 0 || !Number.isFinite(focus.limits?.minimumDistanceM) || focus.limits.minimumDistanceM <= 0 || !Number.isFinite(focus.limits?.maximumDistanceM) || focus.limits.maximumDistanceM <= focus.limits.minimumDistanceM || focus.arrivalDistanceM !== void 0 && (!Number.isFinite(focus.arrivalDistanceM) || focus.arrivalDistanceM <= 0)) {
    throw new TypeError("Prepared navigation focus metadata is invalid.");
  }
  validateWorldPosition(focus.positionM);
  if (focus.upReference !== void 0) {
    validateWorldPosition(focus.upReference);
    if (Math.abs(Math.hypot(...focus.upReference) - 1) > 1e-9) throw new TypeError("Prepared focus up must be a unit reference direction.");
  }
  return Object.freeze({
    ...focus,
    positionM: Object.freeze([...focus.positionM]),
    limits: Object.freeze({ ...focus.limits }),
    ...focus.upReference === void 0 ? {} : { upReference: Object.freeze([...focus.upReference]) }
  });
}
function sightlineOrientation(positionM, up = [0, 0, 1], viewport = { principalOffsetPixels: [0, 0], focalPixels: 1 }) {
  const length = Math.hypot(...positionM);
  if (!(length > 0)) throw new RangeError("A focus at the Sun has no line of sight.");
  const eye = scaleWorldPosition(positionM, -1 / length);
  const upward = Math.hypot(...cross3(up, eye)) > 1e-9 ? up : [1, 0, 0];
  const right = normalize(cross3(upward, eye)), top = cross3(eye, right);
  const axes = [right[0], top[0], eye[0], right[1], top[1], eye[1], right[2], top[2], eye[2]];
  const [x, y] = viewport.principalOffsetPixels;
  const ray = normalize([x, -y, viewport.focalPixels]);
  const axis = cross3(ray, [0, 0, 1]), sine = Math.hypot(...axis), cosine = ray[2];
  if (!(sine > 1e-12)) return worldQuaternionFromRotation(axes);
  const [kx, ky, kz] = scaleWorldPosition(axis, 1 / sine), c = 1 - cosine;
  const turn = [
    cosine + kx * kx * c,
    kx * ky * c - kz * sine,
    kx * kz * c + ky * sine,
    ky * kx * c + kz * sine,
    cosine + ky * ky * c,
    ky * kz * c - kx * sine,
    kz * kx * c - ky * sine,
    kz * ky * c + kx * sine,
    cosine + kz * kz * c
  ];
  return worldQuaternionFromRotation([0, 1, 2].flatMap((row) => [0, 1, 2].map((column) => axes[row * 3] * turn[column] + axes[row * 3 + 1] * turn[3 + column] + axes[row * 3 + 2] * turn[6 + column])));
}
function normalize(a) {
  return scaleWorldPosition(a, 1 / Math.hypot(...a));
}
function add2(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function subtract2(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

// src/renderers/css/solar-system/directional-sun-coordinate.ts
function viewSunDirectionToPhysicalLightDirection(direction) {
  validateViewDirection(direction);
  return Object.freeze([direction[0], -direction[1], direction[2]]);
}
function validateViewDirection(direction) {
  if (!Array.isArray(direction) || direction.length !== 3 || direction.some((value) => !Number.isFinite(value)) || Math.abs(Math.hypot(...direction) - 1) > 1e-9) {
    throw new TypeError("Directional Sun view direction is invalid.");
  }
}

// src/renderers/css/navigation/world-camera.ts
function worldCameraSilhouetteDiameter(presentation, radiusUnits) {
  return 2 * (presentation.silhouette?.tangentialSemiAxis ?? (presentation.depthUnits > -radiusUnits ? Infinity : 0));
}
function worldCameraFromCenteredPresentation(local, frame, viewport) {
  validateViewport(viewport);
  if (!Number.isFinite(local.distanceUnits) || local.distanceUnits <= 0) throw new TypeError("Camera distance must be positive scene units.");
  const axis = offAxisFrame(viewport.focalPixels, viewport.principalOffsetPixels);
  return worldCameraFromPresentation({ rotation: local.rotation, bodyCenterUnits: [
    local.distanceUnits * axis.sinTheta * axis.radial[0],
    local.distanceUnits * axis.sinTheta * axis.radial[1],
    -local.distanceUnits * axis.cosTheta
  ] }, frame);
}
function worldCameraFromPresentation(local, frame) {
  const focus = focusFrame(frame);
  validateWorldRotation(local.rotation);
  validateWorldPosition(local.bodyCenterUnits);
  const cameraToPresentation = transposeWorldRotation(local.rotation);
  const [x, y, z] = scaleWorldPosition(rotateWorldPosition(cameraToPresentation, local.bodyCenterUnits), -frame.metersPerUnit);
  const pose = cameraPoseToReferenceFrame({
    positionM: [x, -y, z],
    orientationXyzw: worldQuaternionFromRotation(flipWorldRotationY(cameraToPresentation))
  }, focus);
  return Object.freeze({ referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt, pose });
}
function presentWorldCamera(world, frame, viewport) {
  validateViewport(viewport);
  const focus = focusFrame(frame);
  if (world.referenceFrame !== frame.referenceFrame || world.epochJdTt !== frame.epochJdTt) {
    throw new TypeError("World camera and object must share a resolved reference frame and prepared epoch.");
  }
  const local = cameraPoseFromReferenceFrame(world.pose, focus);
  const rotation = flipWorldRotationY(transposeWorldRotation(worldRotationFromQuaternion(local.orientationXyzw)));
  const [px, py, pz] = local.positionM;
  const bodyCenterUnits = scaleWorldPosition(rotateWorldPosition(rotation, [px, -py, pz]), -1 / frame.metersPerUnit);
  const [x, y, z] = bodyCenterUnits;
  const distanceUnits = Math.hypot(x, y, z), depthUnits = -z;
  const [ox, oy] = viewport.principalOffsetPixels;
  const focal = viewport.focalPixels;
  const centerPixels = depthUnits > 0 ? [ox + focal * x / depthUnits, oy + focal * y / depthUnits] : null;
  const radiusUnits = frame.bodyRadiusM / frame.metersPerUnit;
  let silhouette = null;
  if (depthUnits > radiusUnits && centerPixels !== null) {
    const radialLength = Math.hypot(x, y);
    const ellipse = silhouetteEllipse(radiusUnits, focal, distanceUnits, {
      radial: radialLength > 0 ? [x / radialLength, y / radialLength] : [0, 0],
      sinTheta: radialLength / distanceUnits,
      cosTheta: depthUnits / distanceUnits,
      tanTheta: radialLength / depthUnits
    });
    silhouette = Object.freeze({
      ...ellipse,
      centre: [centerPixels[0] + ellipse.centre[0], centerPixels[1] + ellipse.centre[1]]
    });
  }
  const translateCssPixels = [ox + x, oy + y, focal + z];
  return Object.freeze({
    rotation,
    bodyCenterUnits,
    sceneMatrix: worldRotationCss(rotation),
    translateCssPixels,
    distanceUnits,
    distanceM: distanceUnits * frame.metersPerUnit,
    depthUnits,
    centerPixels,
    silhouette
  });
}
function focusFrame(frame) {
  if (typeof frame.referenceFrame !== "string" || frame.referenceFrame.length === 0 || !Number.isFinite(frame.epochJdTt) || !Number.isFinite(frame.metersPerUnit) || frame.metersPerUnit <= 0 || !Number.isFinite(frame.bodyRadiusM) || frame.bodyRadiusM <= 0) throw new TypeError("Prepared world frame metadata is invalid.");
  validateWorldPosition(frame.originM);
  validateWorldReflection(frame.presentationToReference);
  return { originM: frame.originM, localToReferenceXyzw: worldQuaternionFromRotation(referenceRotationFromPresentation(frame.presentationToReference)) };
}
function validateViewport(viewport) {
  if (!Number.isFinite(viewport.focalPixels) || viewport.focalPixels <= 0 || viewport.principalOffsetPixels.length !== 2 || !viewport.principalOffsetPixels.every(Number.isFinite)) {
    throw new TypeError("World camera viewport must contain a positive focal length and finite principal point.");
  }
}

// src/renderers/css/solar-system/solar-view-direction.ts
function cssDirectionToViewDirection([x, y, z]) {
  return [x, -y, z];
}

// src/renderers/css/navigation/prepared-camera-basis.ts
function preparedSceneMatrix(camera, pitch, yaw) {
  return multiplyPreparedMatrix4(preparedRotationMatrix4("x", preparedScenePitch(pitch, camera)), preparedRotationMatrix4("y", yaw));
}

// src/renderers/css/navigation/camera-orientation.ts
function createCameraOrientation({
  controlPitch,
  controlYaw,
  cameraPlan,
  sunDirection = null
}) {
  if (sunDirection !== null && (!Array.isArray(sunDirection) || sunDirection.length !== 3 || sunDirection.some((component) => !Number.isFinite(component)) || Math.abs(Math.hypot(...sunDirection) - 1) > 1e-9)) {
    throw new TypeError("Camera Sun direction is invalid.");
  }
  const referenceSceneMatrix = createSceneMatrix(
    cameraPlan.materialReferenceControlPitchDegrees ?? controlPitch,
    cameraPlan.materialReferenceControlYawDegrees ?? controlYaw,
    cameraPlan
  );
  let sceneMatrix;
  let scenePresentation = null;
  let sunViewDirection;
  let counterMatrix = null;
  const invalidatePresentations = () => {
    scenePresentation = null;
    sunViewDirection = void 0;
    counterMatrix = null;
  };
  const reset = ({ controlPitch: nextPitch, controlYaw: nextYaw }) => {
    sceneMatrix = createSceneMatrix(nextPitch, nextYaw, cameraPlan);
    invalidatePresentations();
  };
  reset({ controlPitch, controlYaw });
  return Object.freeze({
    reset,
    setSceneRotation(rotation) {
      validateWorldRotation(rotation);
      sceneMatrix = new DOMMatrix([
        rotation[0],
        rotation[3],
        rotation[6],
        0,
        rotation[1],
        rotation[4],
        rotation[7],
        0,
        rotation[2],
        rotation[5],
        rotation[8],
        0,
        0,
        0,
        0,
        1
      ]);
      invalidatePresentations();
    },
    rebaseScene(change) {
      sceneMatrix = sceneMatrix.multiply(change);
      invalidatePresentations();
    },
    prepareFlight(target, targetCorrection) {
      const from = sceneMatrix;
      reset(target);
      if (targetCorrection) sceneMatrix = targetCorrection.multiply(sceneMatrix);
      const to = sceneMatrix;
      sceneMatrix = from;
      invalidatePresentations();
      const { axis, degrees: degrees2 } = rotationAxisAngle(to.multiply(from.inverse()));
      return Object.freeze({
        angularDistance: degrees2,
        sample(progress) {
          sceneMatrix = progress === 0 ? from : progress === 1 ? to : new DOMMatrix().rotateAxisAngle(...axis, degrees2 * progress).multiply(from);
          invalidatePresentations();
        }
      });
    },
    snapshot() {
      return Object.freeze({ schema: "cssearth-camera-pose@2", scene: formatMatrix3d(sceneMatrix) });
    },
    restore(snapshot) {
      if (snapshot?.schema !== "cssearth-camera-pose@2") throw new TypeError("Physical camera pose is invalid.");
      sceneMatrix = parseCameraPoseMatrix(snapshot.scene, "scene");
      invalidatePresentations();
    },
    rotate({ renderedPitchDelta, yawDelta, rotation }) {
      if (rotation) {
        sceneMatrix = dragRotationMatrix(rotation).multiply(sceneMatrix);
        invalidatePresentations();
        return;
      }
      sceneMatrix = new DOMMatrix().rotateAxisAngle(1, 0, 0, renderedPitchDelta).rotateAxisAngle(0, 1, 0, yawDelta).multiply(sceneMatrix);
      invalidatePresentations();
    },
    scene() {
      scenePresentation ??= formatMatrix3d(sceneMatrix);
      return scenePresentation;
    },
    // The accumulated scene rotation itself, for consumers that project
    // scene-frame geometry with the same camera in JavaScript.
    sceneMatrix() {
      return sceneMatrix;
    },
    /** A deferred frame must not consult a later input rotation. */
    captureCounterRotation() {
      counterMatrix ??= sceneMatrix.inverse().multiply(referenceSceneMatrix);
      const captured = counterMatrix;
      const presentations = /* @__PURE__ */ new Map();
      return (localMatrix = null) => {
        const cached = presentations.get(localMatrix);
        if (cached !== void 0) return cached;
        const local = typeof localMatrix === "string" ? new DOMMatrix(localMatrix) : localMatrix;
        if (local !== null && !(local instanceof DOMMatrix)) throw new TypeError("Camera local counter basis is invalid.");
        const value = formatMatrix3d(local === null ? captured : local.inverse().multiply(captured).multiply(local));
        presentations.set(localMatrix, value);
        return value;
      };
    },
    sunViewDirection() {
      if (sunViewDirection === void 0) sunViewDirection = sunDirection === null ? null : Object.freeze(cssDirectionToViewDirection(transformDirection(sceneMatrix, sunDirection)));
      return sunViewDirection;
    }
  });
}
function formatMatrix3d(matrix) {
  return `matrix3d(${[
    matrix.m11,
    matrix.m12,
    matrix.m13,
    matrix.m14,
    matrix.m21,
    matrix.m22,
    matrix.m23,
    matrix.m24,
    matrix.m31,
    matrix.m32,
    matrix.m33,
    matrix.m34,
    matrix.m41,
    matrix.m42,
    matrix.m43,
    matrix.m44
  ].map((value) => Math.abs(value) < 1e-12 ? 0 : Number(value.toFixed(12))).join(",")})`;
}
function parseCameraPoseMatrix(value, label) {
  if (typeof value !== "string" || !/^matrix3d\([^()]+\)$/u.test(value)) {
    throw new TypeError(`Camera camera ${label} matrix is invalid.`);
  }
  const components = value.slice(9, -1).split(",").map(Number);
  if (components.length !== 16 || components.some((component) => !Number.isFinite(component))) {
    throw new TypeError(`Camera camera ${label} matrix is invalid.`);
  }
  const matrix = new DOMMatrix(components);
  const values = [
    matrix.m11,
    matrix.m12,
    matrix.m13,
    matrix.m14,
    matrix.m21,
    matrix.m22,
    matrix.m23,
    matrix.m24,
    matrix.m31,
    matrix.m32,
    matrix.m33,
    matrix.m34,
    matrix.m41,
    matrix.m42,
    matrix.m43,
    matrix.m44
  ];
  if (values.some((component) => !Number.isFinite(component))) {
    throw new TypeError(`Camera camera ${label} matrix is invalid.`);
  }
  return matrix;
}
function createSceneMatrix(controlPitch, controlYaw, cameraPlan) {
  return new DOMMatrix([...preparedSceneMatrix(cameraPlan, controlPitch, controlYaw)]);
}
function transformDirection(matrix, direction) {
  const transformed = [
    matrix.m11 * direction[0] + matrix.m21 * direction[1] + matrix.m31 * direction[2],
    matrix.m12 * direction[0] + matrix.m22 * direction[1] + matrix.m32 * direction[2],
    matrix.m13 * direction[0] + matrix.m23 * direction[1] + matrix.m33 * direction[2]
  ];
  const length = Math.hypot(...transformed);
  return transformed.map((value) => value / length);
}
function dragRotationMatrix([x, y, z, w]) {
  return new DOMMatrix([
    1 - 2 * (y * y + z * z),
    2 * (x * y + z * w),
    2 * (x * z - y * w),
    0,
    2 * (x * y - z * w),
    1 - 2 * (x * x + z * z),
    2 * (y * z + x * w),
    0,
    2 * (x * z + y * w),
    2 * (y * z - x * w),
    1 - 2 * (x * x + y * y),
    0,
    0,
    0,
    0,
    1
  ]);
}

// src/renderers/css/navigation/prepared-camera.ts
function createPreparedCamera(cameraPlan, worldContext, optics, sunDirection, createOrientation = createCameraOrientation) {
  const bodyRadius = worldContext.bodyRadiusUnits, kilometersPerUnit = worldContext.kilometersPerUnit;
  const maximumDistance = cameraPlan.dolly.maximumDistanceOverOrbitExtent * worldContext.maximumExtentUnits;
  const framingReferenceZoom = worldContext.framingReferenceZoom ?? cameraPlan.defaultZoom;
  const orientation = createOrientation({
    cameraPlan,
    controlPitch: cameraPlan.defaultControlPitchDegrees,
    controlYaw: cameraPlan.defaultControlYawDegrees,
    sunDirection
  });
  const readRotation = () => rotationFromMatrix3d(orientation.sceneMatrix());
  const cameraState = {
    rotX: cameraPlan.defaultControlPitchDegrees,
    rotY: cameraPlan.defaultControlYawDegrees,
    distance: 0
  };
  let bodyCenter = null;
  let zoomOutCentering = false;
  let aliasZoom = null;
  let aliasDistance = null;
  const zoomToDistance = (zoom) => distanceForSilhouetteRadius(
    bodyRadius,
    optics().focalPixels,
    zoom / framingReferenceZoom * cameraPlan.logicalBodyDiameter / 2,
    optics().principalOffsetPixels
  );
  const distanceToZoom = (distance) => {
    if (bodyCenter !== null && distance < minimumDistance()) return distanceToZoom(minimumDistance());
    const zoom = silhouetteRadiusAtDistance(bodyRadius, optics().focalPixels, distance, optics().principalOffsetPixels) * 2 / cameraPlan.logicalBodyDiameter * framingReferenceZoom;
    return Math.abs(zoom - cameraPlan.maximumZoom) < 1e-9 ? cameraPlan.maximumZoom : zoom;
  };
  const texelAltitude = () => cameraPlan.dolly.surfaceArcPerCssPixelRadians === void 0 ? 0 : bodyRadius * cameraPlan.dolly.surfaceArcPerCssPixelRadians * optics().focalPixels;
  const minimumDistance = () => Math.max(
    cameraPlan.dolly.minimumDistanceRadii * bodyRadius,
    bodyRadius + texelAltitude(),
    zoomToDistance(cameraPlan.maximumZoom)
  );
  const clampDistance = (distance) => clamp4(distance, minimumDistance(), maximumDistance);
  const minimumZoom = () => distanceToZoom(maximumDistance);
  const maximumZoom = () => cameraPlan.maximumZoom;
  cameraState.distance = clampDistance(zoomToDistance(cameraPlan.defaultZoom));
  function detailState() {
    return Object.freeze({
      rotX: cameraState.rotX,
      rotY: cameraState.rotY,
      distance: cameraState.distance,
      zoom: aliasZoom !== null && cameraState.distance === aliasDistance ? aliasZoom : distanceToZoom(cameraState.distance)
    });
  }
  function updateDetail(partial) {
    const previousDistance = cameraState.distance;
    const constrain = bodyCenter === null ? clampDistance : (distance) => clamp4(
      distance,
      Math.min(minimumDistance(), previousDistance),
      Math.max(maximumDistance, previousDistance)
    );
    if (partial.rotX !== void 0) cameraState.rotX = partial.rotX;
    if (partial.rotY !== void 0) cameraState.rotY = partial.rotY;
    if (partial.distanceKilometers !== void 0) {
      cameraState.distance = constrain(partial.distanceKilometers / kilometersPerUnit);
    } else if (partial.distance !== void 0) {
      cameraState.distance = constrain(partial.distance);
    } else if (partial.zoom !== void 0) {
      const clampedZoom = clamp4(partial.zoom, minimumZoom(), maximumZoom());
      const requested = zoomToDistance(clampedZoom);
      cameraState.distance = constrain(requested);
      aliasZoom = cameraState.distance === requested ? clampedZoom : null;
      aliasDistance = cameraState.distance;
    }
    if (bodyCenter !== null && cameraState.distance !== previousDistance) {
      if (zoomOutCentering && cameraState.distance > previousDistance) {
        const { focalPixels: focal, principalOffsetPixels: principalOffset } = optics();
        const axisLength = Math.hypot(principalOffset[0], principalOffset[1], focal);
        const axis = [-principalOffset[0] / axisLength, -principalOffset[1] / axisLength, -focal / axisLength];
        const along = bodyCenter.reduce((sum, value, index) => sum + value * axis[index], 0);
        if (along > 0) {
          const across = [
            bodyCenter[0] - axis[0] * along,
            bodyCenter[1] - axis[1] * along,
            bodyCenter[2] - axis[2] * along
          ];
          const nextAlong = Math.sqrt(Math.max(0, cameraState.distance ** 2 - Math.hypot(...across) ** 2));
          bodyCenter = [across[0] + axis[0] * nextAlong, across[1] + axis[1] * nextAlong, across[2] + axis[2] * nextAlong];
        } else bodyCenter = scaleWorldPosition(bodyCenter, cameraState.distance / previousDistance);
      } else bodyCenter = scaleWorldPosition(bodyCenter, cameraState.distance / previousDistance);
    }
  }
  function setBodyCenter(next) {
    validateWorldPosition(next);
    const distance = Math.hypot(...next);
    if (distance <= bodyRadius) throw new RangeError("The world camera is inside the focused body.");
    bodyCenter = [next[0], next[1], next[2]];
    cameraState.distance = distance;
    aliasZoom = null;
  }
  let active = null;
  function capture(frame) {
    const rotation = readRotation(), bodyCenterUnits = bodyCenter;
    return bodyCenterUnits === null ? worldCameraFromCenteredPresentation({ rotation, distanceUnits: detailState().distance }, frame, optics()) : worldCameraFromPresentation({ rotation, bodyCenterUnits }, frame);
  }
  function adopt(world, frame) {
    const presentation = presentWorldCamera(world, frame, optics());
    setBodyCenter(presentation.bodyCenterUnits);
    orientation.setSceneRotation(presentation.rotation);
    if (active) {
      active.rotatedOffset = rotateWorldPosition(presentation.rotation, active.offsetUnits);
      active.centerUnits = add3(presentation.bodyCenterUnits, active.rotatedOffset);
    }
  }
  function preservePivot() {
    if (!active) return;
    const nextOffset = rotateWorldPosition(readRotation(), active.offsetUnits);
    if (nextOffset.some((value, axis) => value !== active.rotatedOffset[axis])) {
      setBodyCenter(add3(bodyCenter, subtract3(active.rotatedOffset, nextOffset)));
      active.rotatedOffset = nextOffset;
    }
  }
  function set(focus, frame) {
    if (focus === null) {
      active = null;
      return;
    }
    const validated = validatePreparedNavigationFocus(focus);
    const presentation = presentWorldCamera(capture(frame), frame, optics());
    const offsetUnits = scaleWorldPosition(rotateWorldPosition(
      transposeWorldRotation(frame.presentationToReference),
      subtract3(validated.positionM, frame.originM)
    ), 1 / frame.metersPerUnit);
    const rotatedOffset = rotateWorldPosition(presentation.rotation, offsetUnits);
    const centerUnits = add3(presentation.bodyCenterUnits, rotatedOffset);
    if (!(Math.hypot(...centerUnits) > 0)) throw new RangeError("The observer cannot orbit from the prepared focus centre.");
    setBodyCenter(presentation.bodyCenterUnits);
    active = { focus: validated, frame, offsetUnits, rotatedOffset, centerUnits };
    preservePivot();
  }
  const focusZoom = () => {
    if (!active) return detailState().zoom;
    const distanceM = Math.hypot(...active.centerUnits) * active.frame.metersPerUnit;
    return Math.min(cameraPlan.maximumZoom, optics().focalPixels * active.focus.framingRadiusM / distanceM * 2 / cameraPlan.logicalBodyDiameter * framingReferenceZoom);
  };
  function inputState() {
    return active ? { ...detailState(), distance: Math.hypot(...active.centerUnits), zoom: focusZoom() } : detailState();
  }
  function updateInput(partial) {
    if (!active) {
      updateDetail(partial);
      return;
    }
    const oldDistance = Math.hypot(...active.centerUnits);
    const requested = partial.distanceKilometers !== void 0 ? partial.distanceKilometers * 1e3 / active.frame.metersPerUnit : partial.distance ?? (partial.zoom === void 0 ? oldDistance : oldDistance * focusZoom() / partial.zoom);
    if (!Number.isFinite(requested) || requested <= 0) throw new TypeError("Prepared focus distance must be positive and finite.");
    const { minimumDistanceM, maximumDistanceM } = active.focus.limits;
    if (requested !== oldDistance) {
      const next = Math.max(
        Math.min(minimumDistanceM / active.frame.metersPerUnit, oldDistance),
        Math.min(Math.max(maximumDistanceM / active.frame.metersPerUnit, oldDistance), requested)
      );
      const nextCenter = scaleWorldPosition(active.centerUnits, next / oldDistance);
      setBodyCenter(add3(bodyCenter, subtract3(nextCenter, active.centerUnits)));
      active.centerUnits = nextCenter;
    }
    updateDetail({
      ...partial.rotX === void 0 ? {} : { rotX: partial.rotX },
      ...partial.rotY === void 0 ? {} : { rotY: partial.rotY }
    });
  }
  return Object.freeze({
    get state() {
      return inputState();
    },
    dolly(update) {
      updateInput(update);
    },
    rotate(delta) {
      const previousPitch = inputState().rotX;
      updateInput({
        rotX: previousPitch + delta.controlPitchDelta,
        rotY: inputState().rotY + delta.controlYawDelta,
        zoom: delta.zoom,
        distance: delta.distance
      });
      orientation.rotate({
        renderedPitchDelta: preparedScenePitch(inputState().rotX, cameraPlan) - preparedScenePitch(previousPitch, cameraPlan),
        yawDelta: delta.controlYawDelta,
        rotation: delta.rotation
      });
      preservePivot();
    },
    rebaseScene(change) {
      orientation.rebaseScene(change);
      preservePivot();
    },
    prepareFlight(target, correction) {
      const flight = orientation.prepareFlight(target, correction);
      return {
        angularDistance: flight.angularDistance,
        sample(progress, update) {
          updateInput(update);
          flight.sample(progress);
          preservePivot();
        }
      };
    },
    restore(update, pose, bodyCenterKilometers) {
      active = null;
      const resetsOrientation = update.rotX !== void 0 || update.rotY !== void 0;
      if (resetsOrientation || pose !== void 0) bodyCenter = null;
      updateDetail(update);
      if (pose !== void 0) orientation.restore(pose);
      else if (resetsOrientation) orientation.reset({ controlPitch: cameraState.rotX, controlYaw: cameraState.rotY });
      if (bodyCenterKilometers !== void 0) setBodyCenter([bodyCenterKilometers[0] / kilometersPerUnit, bodyCenterKilometers[1] / kilometersPerUnit, bodyCenterKilometers[2] / kilometersPerUnit]);
    },
    snapshot: orientation.snapshot,
    scene: orientation.scene,
    bodyCenter: () => bodyCenter,
    setZoomOutCentering(enabled) {
      zoomOutCentering = enabled;
    },
    minimumZoom,
    maximumZoom,
    minimumDistance,
    maximumDistance,
    /** Only the original centred framing follows a resize; a restored observer stays put. */
    reframe(zoom) {
      if (bodyCenter === null) updateDetail({ zoom });
    },
    detailState() {
      return {
        ...detailState(),
        ...bodyCenter === null ? {} : { bodyCenterKilometers: scaleWorldPosition(bodyCenter, kilometersPerUnit) }
      };
    },
    capture,
    captureFrame() {
      const world = capture(worldContext.frame);
      return {
        world,
        rotation: readRotation(),
        scenePresentation: orientation.scene(),
        distance: cameraState.distance,
        controlPitch: inputState().rotX,
        controlYaw: inputState().rotY,
        zoom: inputState().zoom,
        sunDirection: orientation.sunViewDirection(),
        counterRotationFor: orientation.captureCounterRotation()
      };
    },
    adopt,
    setFocus: set,
    focus: () => active?.focus ?? null,
    clearFocus() {
      active = null;
    },
    trackball(base) {
      if (!active) return base;
      const [x, y, z] = active.centerUnits, depth = -z;
      const visible = depth > 0;
      const radius = Math.max(base.viewportWidth / 5, Math.min(
        base.viewportWidth,
        visible ? base.focalLength * active.focus.framingRadiusM / active.frame.metersPerUnit / depth : 0
      ));
      return {
        ...base,
        centerX: visible ? (base.opticalCenterX ?? base.centerX) + base.focalLength * x / depth : base.viewportCenterX ?? base.centerX,
        centerY: visible ? (base.opticalCenterY ?? base.centerY) + base.focalLength * y / depth : base.viewportCenterY ?? base.centerY,
        radius,
        surfaceRadius: radius
      };
    }
  });
}
function clamp4(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
function add3(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function subtract3(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

// src/renderers/css/navigation/perspective-dolly.ts
var PERSPECTIVE_PROJECTION_MODEL = "css-perspective-shared-with-sky";
function assertPerspectiveCameraPlan(plan) {
  if (plan?.projection?.model !== PERSPECTIVE_PROJECTION_MODEL || typeof plan.projection.cssPerspective !== "string" || !plan.projection.cssPerspective || plan.dolly?.model !== "multiplicative-wheel-distance" || !Number.isFinite(plan.dolly.wheelStepPerDelta) || !Number.isFinite(plan.dolly.minimumDistanceRadii) || !Number.isFinite(plan.dolly.maximumDistanceOverOrbitExtent) || plan.drag !== void 0 && plan.drag?.model !== "screen-axis-tumble" || !plan.orbitLineFade || !Number.isFinite(plan.orbitLineFade.visibleBelowDiscHeightShare) || !Number.isFinite(plan.orbitLineFade?.hiddenAboveDiscHeightShare) || !(plan.orbitLineFade.hiddenAboveDiscHeightShare > plan.orbitLineFade.visibleBelowDiscHeightShare) || plan.levelOfDetail?.model !== "silhouette-diameter-crossfade" || !(plan.levelOfDetail.billboardFadeStartDiscPixels > plan.levelOfDetail.billboardFullDiscPixels) || !(plan.levelOfDetail.billboardFullDiscPixels > plan.levelOfDetail.markerFadeStartDiscPixels) || !(plan.levelOfDetail.markerFadeStartDiscPixels > plan.levelOfDetail.markerFullDiscPixels) || !(plan.levelOfDetail.markerFullDiscPixels > 0) || !Number.isFinite(plan.logicalBodyDiameter) || !(plan.defaultZoom > 0) || !(plan.maximumZoom > 0) || !Number.isFinite(plan.sceneScale)) {
    throw new TypeError("Perspective camera contract drifted.");
  }
}
function validatePerspectiveCameraPlan(plan) {
  assertPerspectiveCameraPlan(plan);
  return plan;
}
function levelOfDetailFor(levelOfDetail, silhouetteDiameter) {
  const proxyOpacity = clamp5(
    (levelOfDetail.billboardFadeStartDiscPixels - silhouetteDiameter) / (levelOfDetail.billboardFadeStartDiscPixels - levelOfDetail.billboardFullDiscPixels),
    0,
    1
  );
  const markerOpacity = clamp5(
    (levelOfDetail.markerFadeStartDiscPixels - silhouetteDiameter) / (levelOfDetail.markerFadeStartDiscPixels - levelOfDetail.markerFullDiscPixels),
    0,
    1
  );
  const stage = markerOpacity >= 1 ? "marker" : "geometry";
  return Object.freeze({
    stage,
    silhouetteDiameter,
    billboardOpacity: 0,
    markerOpacity,
    proxyOpacity
  });
}
function createPerspectiveDolly({
  cameraPlan: unvalidatedCameraPlan,
  worldContext,
  cameraElement,
  sceneElement,
  stage,
  viewport,
  revealGroups = [],
  canReveal,
  sunDirection
}, createOrientation = createCameraOrientation) {
  const cameraPlan = validatePerspectiveCameraPlan(unvalidatedCameraPlan);
  if (!worldContext) throw new TypeError("Perspective dolly requires a prepared physical camera context.");
  const bodyRadius = worldContext.bodyRadiusUnits;
  const kilometersPerUnit = worldContext.kilometersPerUnit;
  const maximumExtent = worldContext.maximumExtentUnits;
  if (!(bodyRadius > 0) || !(kilometersPerUnit > 0) || !(maximumExtent > 0) || !cameraElement?.style || !sceneElement?.style || !viewport || !stage) {
    throw new TypeError("Perspective dolly requires a prepared physical camera context.");
  }
  const levelOfDetail = cameraPlan.levelOfDetail;
  const framingReferenceZoom = worldContext.framingReferenceZoom ?? cameraPlan.defaultZoom;
  if (!(framingReferenceZoom > 0)) throw new TypeError("Perspective framing reference zoom must be positive.");
  if (Math.abs(worldContext.frame.metersPerUnit / (kilometersPerUnit * 1e3) - 1) > 1e-9 || Math.abs(worldContext.frame.bodyRadiusM / (bodyRadius * kilometersPerUnit * 1e3) - 1) > 1e-9) {
    throw new TypeError("Perspective world context units disagree with its prepared frame.");
  }
  cameraElement.style.perspective = cameraPlan.projection.cssPerspective;
  cameraElement.style.scale = "1";
  let focal = 0;
  let viewportWidth = 1;
  let viewportHeight = 1;
  let principalOffset = Object.freeze([0, 0]);
  let stageViewport;
  let visibleRect = null;
  let projectedBody = null;
  let lod = levelOfDetailFor(levelOfDetail, Number.POSITIVE_INFINITY);
  let publishedSceneTransform = null;
  let transformWrites = 0;
  const measure = () => {
    const snapshot = viewport.read(cameraPlan.projection.cssPerspective);
    focal = snapshot.focalPixels;
    viewportWidth = snapshot.bounds.width;
    viewportHeight = snapshot.bounds.height;
    const open = snapshot.openArea;
    const offsetY = open ? (open.top + open.bottom) / 2 - (snapshot.bounds.top + viewportHeight / 2) : 0;
    principalOffset = Object.freeze([0, 0]);
    stageViewport = Object.freeze({
      focalPixels: focal,
      widthPixels: viewportWidth,
      heightPixels: viewportHeight,
      principalOffsetPixels: [0, offsetY],
      ...snapshot.coveredTopPixels ? { coveredTopPixels: snapshot.coveredTopPixels } : {}
    });
    visibleRect = Object.freeze({
      left: -viewportWidth / 2,
      right: viewportWidth / 2,
      top: -viewportHeight / 2 - offsetY,
      bottom: viewportHeight / 2 - offsetY
    });
    cameraElement.style.perspectiveOrigin = "50% 50%";
    cameraElement.style.translate = offsetY ? `0 ${formatNumber(offsetY)}px` : "";
  };
  measure();
  const camera = createPreparedCamera(
    cameraPlan,
    worldContext,
    () => ({ focalPixels: focal, principalOffsetPixels: [principalOffset[0], principalOffset[1]] }),
    sunDirection,
    createOrientation
  );
  const REVEAL_LEAVES_PER_FRAME = 128;
  const revealView = cameraElement.ownerDocument.defaultView;
  const revealClock = revealView && createOpacityClock(revealView);
  const revealed = new Uint8Array(revealGroups.length).fill(1);
  let revealCount = revealGroups.length, revealFrame = null;
  const revealTo = (count, reset = false) => {
    revealCount = count;
    for (let group = 0; group < revealed.length; group++) {
      const show = group < count ? 1 : 0;
      if (!reset && revealed[group] === show) continue;
      revealed[group] = show;
      const display = show ? "" : "none";
      for (const node of revealGroups[group]) if (node.style.display !== display) node.style.display = display;
    }
  };
  const continueReveal = () => {
    revealFrame = null;
    if (sceneElement.hidden || revealCount >= revealGroups.length) return;
    let count = revealCount, leaves = 0;
    do
      leaves += revealGroups[count++].length;
    while (count < revealGroups.length && leaves + revealGroups[count].length <= REVEAL_LEAVES_PER_FRAME);
    revealTo(count);
    if (revealCount < revealGroups.length) revealFrame = revealClock.request(continueReveal);
  };
  function publishPresentation(snapshot) {
    const {
      distance,
      rotation,
      focal: focal2,
      viewportWidth: viewportWidth2,
      viewportHeight: viewportHeight2,
      principalOffset: principalOffset2,
      stageViewport: stageViewport2,
      scenePresentation,
      world: publishedWorld
    } = snapshot;
    const viewport2 = { focalPixels: focal2, principalOffsetPixels: [principalOffset2[0], principalOffset2[1]] };
    const genericPresentation = presentWorldCamera(publishedWorld, worldContext.frame, viewport2);
    const [bodyX, bodyY, bodyZ] = genericPresentation.translateCssPixels;
    worldContext.onWorldPublish?.(publishedWorld, { focalPixels: focal2, principalOffsetPixels: stageViewport2.principalOffsetPixels });
    const genericBody = genericBodyProjection(genericPresentation, bodyRadius, focal2);
    projectedBody = genericBody;
    lod = levelOfDetailFor(levelOfDetail, genericBody.silhouetteDiameter);
    const hidden = lod.stage === "marker" || canReveal !== void 0 && !canReveal();
    if (!hidden) {
      const transform = `translate3d(${formatNumber(bodyX)}px, ${formatNumber(bodyY)}px, ${formatNumber(bodyZ)}px) scale3d(${cameraPlan.sceneScale}, ${cameraPlan.sceneScale}, ${cameraPlan.sceneScale}) ${scenePresentation}`;
      if (transform !== publishedSceneTransform) {
        sceneElement.style.transform = transform;
        publishedSceneTransform = transform;
        transformWrites += 1;
      }
    }
    if (revealGroups.length && revealView) {
      if (hidden && revealFrame !== null) {
        revealClock.cancel(revealFrame);
        revealFrame = null;
      }
      if (!hidden && sceneElement.hidden) {
        revealTo(0, true);
        revealFrame = revealClock.request(continueReveal);
      }
    }
    if (sceneElement.hidden !== hidden) sceneElement.hidden = hidden;
    const scale2 = cameraPlan.sceneScale;
    const physicalProjection = physicalProjectionFromCamera(
      rotation,
      [bodyX - principalOffset2[0], bodyY - principalOffset2[1], bodyZ - focal2],
      scale2,
      viewport2
    );
    return Object.freeze({
      distance,
      projection: physicalProjection,
      stageViewport: stageViewport2,
      focal: focal2,
      viewportWidth: viewportWidth2,
      viewportHeight: viewportHeight2,
      principalOffset: principalOffset2,
      body: genericBody,
      levelOfDetail: lod
    });
  }
  function preparePresentation() {
    const captured = camera.captureFrame();
    const snapshot = { ...captured, focal, viewportWidth, viewportHeight, principalOffset, stageViewport };
    return { ...captured, viewport: stageViewport, commit: () => publishPresentation(snapshot) };
  }
  return Object.freeze({
    camera,
    viewport() {
      return { focalPixels: focal, principalOffsetPixels: [principalOffset[0], principalOffset[1]] };
    },
    remeasure() {
      const zoom = camera.state.zoom;
      measure();
      camera.reframe(zoom);
    },
    prepare: preparePresentation,
    // The drag trackball: the projected silhouette. A small body still orbits
    // comfortably: the trackball never shrinks below a fifth of the
    // viewport's short side, and the sphere the drag rides is that disc.
    trackball() {
      const sharedBounds = viewport.read(cameraPlan.projection.cssPerspective).bounds;
      const bounds = sharedBounds;
      const stageBounds = sharedBounds;
      const silhouette = projectedBody?.silhouette;
      const centerX = bounds.x + bounds.width / 2 + (silhouette?.centre[0] ?? 0);
      const centerY = bounds.y + bounds.height / 2 + (silhouette?.centre[1] ?? 0);
      const radius = Math.max(
        Number.isFinite(projectedBody?.silhouetteRadius) ? projectedBody.silhouetteRadius : Math.hypot(viewportWidth, viewportHeight),
        Math.min(viewportWidth, viewportHeight) / 5
      );
      return camera.trackball(Object.freeze({
        centerX,
        centerY,
        opticalCenterX: bounds.x + bounds.width / 2 + principalOffset[0],
        opticalCenterY: bounds.y + bounds.height / 2 + principalOffset[1],
        radius,
        surfaceRadius: radius,
        focalLength: focal,
        viewportWidth: stageBounds.width,
        viewportCenterX: (stageBounds.left ?? 0) + stageBounds.width / 2,
        viewportCenterY: (stageBounds.top ?? 0) + stageBounds.height / 2,
        // Pointer samples are re-based to the centre: tumble everywhere.
        tumbleOnly: cameraPlan.drag?.model === "screen-axis-tumble"
      }));
    },
    state() {
      const { distance, bodyCenterKilometers } = camera.detailState();
      return Object.freeze({
        distance,
        distanceKilometers: distance * kilometersPerUnit,
        distanceRadii: distance / bodyRadius,
        levelOfDetail: lod,
        focal,
        principalOffset,
        visibleRect,
        offAxisDegrees: projectedBody?.offAxisDegrees ?? null,
        silhouetteRadius: projectedBody?.silhouetteRadius ?? null,
        ...bodyCenterKilometers === void 0 ? {} : { bodyCenterKilometers }
      });
    },
    levelOfDetail: () => lod,
    stats({ wheelDollies = 0 } = {}) {
      const { maximumDistance } = camera;
      return Object.freeze({
        projection: cameraPlan.projection,
        dolly: Object.freeze({
          ...cameraPlan.dolly,
          minimumDistance: camera.minimumDistance(),
          maximumDistance,
          minimumDistanceKilometers: camera.minimumDistance() * kilometersPerUnit,
          maximumDistanceKilometers: maximumDistance * kilometersPerUnit,
          maximumDistanceOverOrbitExtentEffective: maximumDistance / maximumExtent,
          // The wheel is multiplicative: the whole range in log-distance,
          // and the mouse notches (100 delta units each) it takes end to end.
          logDistanceRange: Math.log(maximumDistance / camera.minimumDistance()),
          wheelNotchesEndToEnd: Math.log(maximumDistance / camera.minimumDistance()) / (cameraPlan.dolly.wheelStepPerDelta * 100),
          wheelDollies
        }),
        levelOfDetail,
        orbitLineFade: cameraPlan.orbitLineFade,
        drag: cameraPlan.drag ?? null,
        // Nothing on any input path clamps the pitch or the yaw; the
        // control pitch anchors only calibrate the control-to-scene map.
        rotationBounds: "none",
        sceneTransformWrites: transformWrites
      });
    }
  });
}
function genericBodyProjection(presentation, bodyRadius, focal) {
  const silhouette = presentation.silhouette;
  const distance = presentation.distanceUnits;
  const depth = presentation.depthUnits;
  const silhouetteRadius = worldCameraSilhouetteDiameter(presentation, bodyRadius) / 2;
  const offAxisDegrees = Math.acos(Math.max(-1, Math.min(1, depth / distance))) * 180 / Math.PI;
  return Object.freeze({
    distance,
    depth,
    visible: silhouette !== null,
    screen: presentation.centerPixels,
    offAxisDegrees,
    silhouetteRadius,
    silhouetteDiameter: 2 * silhouetteRadius,
    silhouette,
    orthographicRadius: focal * bodyRadius / distance,
    translate: presentation.translateCssPixels
  });
}
function formatNumber(value) {
  return Math.abs(value) < 1e-9 ? "0" : Number(value.toFixed(6)).toString();
}
function clamp5(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

// src/renderers/css/navigation/camera-layout.ts
var MOBILE_OPEN_AREA_SHARE = 0.75;
function selectPreparedResponsiveZoom({
  plan,
  mobile,
  framingReferenceZoom = plan.defaultZoom,
  viewport
}) {
  const fit = plan.responsiveFit;
  const numericFields = [
    fit?.portraitBaseWidthShare,
    fit?.narrowPortraitWidthShareGain,
    fit?.landscapeWidthShareGain,
    fit?.narrowPortraitAspectRatio,
    fit?.portraitAspectRatio,
    fit?.squareAspectRatio,
    fit?.maximumHeightShare,
    fit?.maximumMobilePreviewShare,
    fit?.minimumZoom,
    fit?.maximumZoom,
    plan.logicalBodyDiameter,
    framingReferenceZoom
  ];
  if (fit?.model !== "continuous-aspect-smoothstep" || numericFields.some((value) => !Number.isFinite(value)) || fit.narrowPortraitAspectRatio >= fit.portraitAspectRatio || fit.portraitAspectRatio >= fit.squareAspectRatio || fit.maximumMobilePreviewShare <= 0 || fit.maximumMobilePreviewShare > 1) {
    throw new TypeError("Continuous responsive planet fit is invalid.");
  }
  if (!plan.projection) throw new TypeError("Responsive framing requires a physical camera.");
  const measured = viewport.read(plan.projection.cssPerspective);
  const stageBounds = measured.bounds;
  const aspectRatio = stageBounds.width / stageBounds.height;
  const narrowPortraitProgress = smoothstep2(
    fit.narrowPortraitAspectRatio,
    fit.portraitAspectRatio,
    aspectRatio
  );
  const landscapeProgress = smoothstep2(
    fit.portraitAspectRatio,
    fit.squareAspectRatio,
    aspectRatio
  );
  const widthShare = fit.portraitBaseWidthShare + fit.narrowPortraitWidthShareGain * (1 - narrowPortraitProgress) + fit.landscapeWidthShareGain * landscapeProgress;
  const mobilePreviewBounds = mobile ? { top: measured.previewTop ?? 0 } : null;
  const maximumMobileDiameter = mobile && mobilePreviewBounds && mobilePreviewBounds.top > 0 ? mobilePreviewBounds.top * fit.maximumMobilePreviewShare : Number.POSITIVE_INFINITY;
  const openHeight = mobile && measured.openArea ? measured.openArea.bottom - measured.openArea.top : null;
  const targetDiameter = openHeight !== null ? Math.min(stageBounds.width * Math.max(widthShare, MOBILE_OPEN_AREA_SHARE), openHeight * MOBILE_OPEN_AREA_SHARE) : Math.min(
    stageBounds.width * widthShare,
    stageBounds.height * fit.maximumHeightShare,
    maximumMobileDiameter
  );
  const framingRatio = targetDiameter / plan.logicalBodyDiameter;
  const zoom = framingRatio * framingReferenceZoom;
  return Object.freeze({ model: fit.model, widthShare, zoom });
}

// src/renderers/css/navigation/object-orbit.ts
var nativeServices = { createCameraOrientation, selectPreparedResponsiveZoom, createUnboundedMatrixDragControls, createPreparedWheelZoomControls, createPerspectiveDolly };
function createRetainedCubicSkyOrbit({
  stage,
  runtimePolicy,
  inputSurface,
  cameraMotion,
  cameraElement,
  sceneElement,
  revealGroups,
  canReveal,
  directionalSunPlan = null,
  // A physical world context gives the orbit its perspective camera, which
  // frames by dolly (cameraPlan.projection); the Sun's direction in
  // directionalSunPlan is observed, so it rides the scene.
  worldContext,
  framePresenter,
  preparedSurfaceHitTest,
  cameraPlan: unvalidatedCameraPlan,
  viewport,
  objectId,
  onPublish = () => {
  },
  onInteractionStart = () => {
  },
  onInteractionEnd = () => {
  },
  onError
}, services = {}) {
  const { createCameraOrientation: createCameraOrientation2 = nativeServices.createCameraOrientation, bindResponsiveOrbitPolicy = runtimePolicy.bindResponsiveOrbitPolicy, selectPreparedResponsiveZoom: selectPreparedResponsiveZoom2 = nativeServices.selectPreparedResponsiveZoom, HTMLElement: HTMLElement2 = globalThis.HTMLElement, matchMedia = (query) => {
    const view = stage.ownerDocument.defaultView;
    if (!view) throw new Error("Orbit document has no window.");
    return view.matchMedia(query);
  }, createPerspectiveDolly: createPerspectiveDolly2 = nativeServices.createPerspectiveDolly } = services;
  const cameraPlan = validatePerspectiveCameraPlan(unvalidatedCameraPlan);
  if (!worldContext || !viewport || !framePresenter || !cameraMotion) throw new TypeError("Object orbit requires its shared world and viewport.");
  const numericFields = [
    cameraPlan?.minimumControlPitchDegrees,
    cameraPlan?.maximumControlPitchDegrees,
    cameraPlan?.defaultControlPitchDegrees,
    cameraPlan?.defaultControlYawDegrees,
    cameraPlan?.initialScenePitchDegrees,
    cameraPlan?.maximumScenePitchDegrees,
    cameraPlan?.minimumZoom,
    cameraPlan?.maximumZoom,
    cameraPlan?.defaultZoom,
    cameraPlan?.sceneScale,
    cameraPlan?.logicalBodyDiameter
  ];
  if (!(stage instanceof HTMLElement2) || !(inputSurface instanceof HTMLElement2) || !(cameraElement instanceof HTMLElement2) || !(sceneElement instanceof HTMLElement2) || cameraPlan?.cameraModel !== "accumulated-matrix3d" || cameraPlan?.pitchBounded !== false || cameraPlan?.yawBounded !== false || numericFields.some((value) => !Number.isFinite(value)) || !/^[a-z][a-z0-9-]*$/u.test(objectId) || typeof onPublish !== "function" || typeof onError !== "function" || typeof onInteractionStart !== "function" || typeof onInteractionEnd !== "function") {
    throw new TypeError("Shared retained cubic-sky orbit is invalid.");
  }
  const lifetime = createSceneLifetime();
  const flightScope = new AbortController();
  lifetime.onDispose(() => flightScope.abort());
  let constructing = true;
  const retireFailure = (error) => {
    if (constructing) throw error;
    if (lifetime.disposed) return;
    const cleanupErrors = lifetime.destroy();
    onError(cleanupErrors.length ? new AggregateError([error, ...cleanupErrors], errorMessage(error), { cause: error }) : error);
  };
  const guardNative = (callback) => (...args) => {
    if (lifetime.disposed) return;
    try {
      return callback(...args);
    } catch (error) {
      retireFailure(error);
    }
  };
  try {
    const perspective = createPerspectiveDolly2({
      cameraPlan,
      worldContext,
      cameraElement,
      sceneElement,
      sunDirection: directionalSunPlan?.localDirection,
      stage,
      viewport,
      ...revealGroups ? { revealGroups } : {},
      ...canReveal ? { canReveal } : {}
    }, createCameraOrientation2);
    const validateWorldFrame = (frame) => {
      if (Math.abs(frame.metersPerUnit / (worldContext.kilometersPerUnit * 1e3) - 1) > 1e-9 || Math.abs(frame.bodyRadiusM / (worldContext.bodyRadiusUnits * worldContext.kilometersPerUnit * 1e3) - 1) > 1e-9) {
        throw new TypeError("World frame units disagree with the mounted presentation.");
      }
    };
    const camera = perspective.camera;
    const minimumZoom = () => camera.minimumZoom();
    const maximumZoom = () => camera.maximumZoom();
    let publications = 0;
    let interactionStarts = 0;
    let interactionEnds = 0;
    let skySunViewDirection = directionalSunPlan?.referenceViewDirection ?? null;
    let responsiveFit;
    let projected = null;
    let viewportEpoch = 0, requestedPublication = 0, presentedPublication = 0;
    let presentedWorld = null;
    const publicationState = () => ({ requestedRevision: requestedPublication, presentedRevision: presentedPublication, presentedWorld });
    const publish = (signal) => {
      if (lifetime.disposed) return;
      const captured = perspective.prepare();
      const { scenePresentation: sceneMatrix, sunDirection, zoom, controlPitch, controlYaw, counterRotationFor } = captured;
      const revision = ++requestedPublication, epoch = viewportEpoch;
      const current = () => !lifetime.disposed && epoch === viewportEpoch;
      const commit = () => {
        if (!current()) return;
        projected = captured.commit();
        skySunViewDirection = sunDirection;
        const materialSunViewDirection = skySunViewDirection === null ? null : viewSunDirectionToPhysicalLightDirection(skySunViewDirection);
        presentedPublication = revision;
        presentedWorld = captured.world;
        onPublish(Object.freeze({
          sceneMatrix,
          sunViewDirection: materialSunViewDirection,
          skySunViewDirection,
          counterRotation: counterRotationFor(),
          counterRotationFor,
          worldCamera: captured.world,
          controlPitch,
          controlYaw,
          zoom,
          // The dolly's facts: the eye, the projected body and its level of
          // detail, for presentations that fit overlays to the silhouette and
          // choose their material source from the stage.
          distance: projected.distance,
          projection: projected.projection,
          focal: projected.focal,
          viewportWidth: projected.viewportWidth,
          viewportHeight: projected.viewportHeight,
          stageViewport: projected.stageViewport,
          principalOffset: projected.principalOffset,
          body: projected.body,
          levelOfDetail: projected.levelOfDetail
        }));
        publications += 1;
      };
      return framePresenter.present({
        world: captured.world,
        viewport: captured.viewport,
        commit,
        current,
        fail: retireFailure
      }, signal);
    };
    const adoptWorldCamera = (world, frame, signal) => {
      if (lifetime.disposed) return;
      try {
        validateWorldFrame(frame);
        controls.stop();
        camera.adopt(world, frame);
        return publish(signal);
      } catch (error) {
        retireFailure(error);
        throw error;
      }
    };
    const mobileQuery = matchMedia(runtimePolicy.MOBILE_VIEWPORT_QUERY);
    const publishCameraDelta = (delta, signal) => {
      camera.rotate(delta);
      return publish(signal);
    };
    const surfaceHitTest = (clientX, clientY) => {
      if (preparedSurfaceHitTest && stage.dataset.lod !== "marker" && stage.dataset.lod !== "billboard") return preparedSurfaceHitTest(clientX, clientY);
      const body = projected?.body;
      if (!body) return false;
      const radius = worldContext.bodyRadiusUnits;
      const cameraBounds = viewport.read(cameraPlan.projection.cssPerspective).bounds;
      return hitsProjectedBody(
        clientX,
        clientY,
        body,
        cameraBounds,
        null,
        projected && radius ? {
          focalPixels: projected.focal,
          principalOffsetPixels: [projected.principalOffset[0], projected.principalOffset[1]],
          bodyRadiusUnits: radius
        } : void 0
      );
    };
    lifetime.onDispose(bindWorldCameraPicking(
      inputSurface,
      stage,
      () => viewport.read(cameraPlan.projection.cssPerspective).bounds,
      (x, y) => stage.dataset.lod === "geometry" && surfaceHitTest(x, y)
    ));
    const controls = createObjectInteractionControls({
      inputSurface,
      cameraMotion,
      runtimePolicy,
      onError: retireFailure,
      camera,
      trackballMetrics: () => perspective.trackball(),
      sceneMatrix: () => camera.scene(),
      rotate: publishCameraDelta,
      minimumZoom: minimumZoom(),
      maximumZoom: maximumZoom(),
      surfaceFlyToHitTest: (clientX, clientY) => !camera.focus() && surfaceHitTest(clientX, clientY),
      // The prepared wheel dolly: the eye moves along its axis, with no
      // surface anchor to hold.
      dolly: Object.freeze({ stepPerDelta: cameraPlan.dolly.wheelStepPerDelta }),
      onStart() {
        interactionStarts += 1;
        onInteractionStart();
      },
      onEnd() {
        interactionEnds += 1;
        onInteractionEnd();
      }
    }, services);
    lifetime.onDispose(() => controls.destroy());
    const inputPolicy = bindResponsiveOrbitPolicy({
      controls,
      inputSurface,
      mediaQuery: mobileQuery,
      onError: retireFailure
    });
    lifetime.onDispose(() => inputPolicy.destroy());
    responsiveFit = selectPreparedResponsiveZoom2({
      plan: cameraPlan,
      mobile: inputPolicy.mobile,
      framingReferenceZoom: worldContext.framingReferenceZoom,
      viewport
    });
    camera.dolly({ zoom: responsiveFit.zoom });
    const initialResponsiveZoom = responsiveFit.zoom;
    const windowTarget = stage.ownerDocument.defaultView;
    if (!windowTarget) throw new Error("Orbit document has no window.");
    const flyCamera = (sample, durationMilliseconds, signal) => {
      if (lifetime.disposed || signal?.aborted) return Promise.resolve({ completed: false });
      interactionStarts++;
      onInteractionStart();
      const flight = cameraMotion.fly({
        windowTarget,
        durationMilliseconds,
        signal: signal ? AbortSignal.any([flightScope.signal, signal]) : flightScope.signal,
        inputSpeedUp: runtimePolicy.FLIGHT_WHEEL_SPEEDUP,
        sample(progress, signal2) {
          sample(progress);
          return publish(signal2);
        },
        onFinish: guardNative(() => {
          interactionEnds++;
          onInteractionEnd();
        })
      });
      return flight.finished.catch((error) => {
        retireFailure(error);
        return { completed: false };
      });
    };
    const handleViewportResize = guardNative(() => {
      viewportEpoch++;
      perspective.remeasure();
      responsiveFit = selectPreparedResponsiveZoom2({
        plan: cameraPlan,
        mobile: inputPolicy.mobile,
        framingReferenceZoom: worldContext.framingReferenceZoom,
        viewport
      });
      publish();
    });
    lifetime.onDispose(viewport.subscribe(handleViewportResize));
    publish();
    constructing = false;
    return Object.freeze({
      publicationState,
      mobilePageFlow: () => inputPolicy.mobile,
      initialResponsiveZoom: () => initialResponsiveZoom,
      currentResponsiveZoom: () => responsiveFit.zoom,
      setZoomOutCentering(enabled) {
        camera.setZoomOutCentering(enabled);
      },
      preparedFocus: () => camera.focus() ?? null,
      setPreparedFocus(focus, frame) {
        if (lifetime.disposed) return;
        validateWorldFrame(frame);
        cameraMotion.cancel();
        controls.stop();
        camera.setFocus(focus, frame);
        publish();
      },
      async flyToPreparedFocus(focus, frame, viewport2, options = {}) {
        if (lifetime.disposed) return Promise.resolve({ completed: false });
        validateWorldFrame(frame);
        if (options.signal?.aborted) return Promise.resolve({ completed: false });
        const plan = prepareFocusFlight(camera, focus, frame, viewport2, options.durationMilliseconds);
        cameraMotion.cancel();
        controls.stop();
        camera.setFocus(plan.focus, frame);
        publish();
        const reduced = options.reducedMotion ?? windowTarget.matchMedia("(prefers-reduced-motion: reduce)").matches;
        return flyCamera(plan.sample, reduced ? 0 : plan.durationMilliseconds, options.signal);
      },
      captureWorldCamera(frame) {
        validateWorldFrame(frame);
        return camera.capture(frame);
      },
      /** Flight writes carry their cancellation signal and acknowledge presentation. */
      applyWorldCamera(world, frame, signal) {
        if (signal?.aborted) return Promise.resolve(false);
        if (!signal) cameraMotion.cancel();
        return adoptWorldCamera(world, frame, signal);
      },
      rebaseScene(change) {
        if (lifetime.disposed) return;
        try {
          camera.rebaseScene(change);
          publish();
        } catch (error) {
          retireFailure(error);
          throw error;
        }
      },
      flyToState({ controlPitch, controlYaw, controlRoll = 0, zoom, transition }, { surfaceTarget = false, signal } = {}) {
        if (lifetime.disposed || signal?.aborted) return Promise.resolve({ completed: false });
        try {
          if (![controlPitch, controlYaw, controlRoll, zoom].every(Number.isFinite)) throw new TypeError("Invalid prepared camera destination.");
          cameraMotion.cancel();
          controls.stop();
          camera.clearFocus();
          const start = { ...camera.state };
          const targetZoom = transition?.preserveZoom ? start.zoom : clamp(zoom, minimumZoom(), maximumZoom());
          const viewport2 = perspective.viewport();
          const targetRotation = surfaceTarget ? prepareSurfaceTargetRotation(camera.bodyCenter() ?? [-viewport2.principalOffsetPixels[0], -viewport2.principalOffsetPixels[1], -viewport2.focalPixels]) : void 0;
          const targetCorrection = targetRotation && new DOMMatrix([
            targetRotation[0],
            targetRotation[3],
            targetRotation[6],
            0,
            targetRotation[1],
            targetRotation[4],
            targetRotation[7],
            0,
            targetRotation[2],
            targetRotation[5],
            targetRotation[8],
            0,
            0,
            0,
            0,
            1
          ]);
          const roll = new DOMMatrix().rotateAxisAngle(0, 0, 1, controlRoll);
          const correction = targetCorrection ? targetCorrection.multiply(roll) : roll;
          const flight = camera.prepareFlight({ controlPitch, controlYaw }, correction);
          const sample = (progress) => {
            const ease = progress * progress * (3 - 2 * progress);
            const frame = transition ? { rotation: ease, zoom: start.zoom * (targetZoom / start.zoom) ** ease } : sampleDestinationFlight({
              startZoom: start.zoom,
              targetZoom,
              overviewZoom: cameraPlan.defaultZoom,
              angularDistance: flight.angularDistance
            }, progress);
            flight.sample(frame.rotation, {
              rotX: start.rotX + (controlPitch - start.rotX) * frame.rotation,
              rotY: start.rotY + (controlYaw - start.rotY) * frame.rotation,
              zoom: frame.zoom
            });
          };
          if (transition?.durationMilliseconds === 0 || windowTarget.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            return flyCamera(sample, 0, signal);
          }
          return flyCamera(sample, transition?.durationMilliseconds ?? 4500, signal);
        } catch (error) {
          retireFailure(error);
          throw error;
        }
      },
      // Native cache notifications report failures through the same fatal owner.
      invalidate: guardNative(publish),
      refresh() {
        if (lifetime.disposed) return;
        try {
          publish();
        } catch (error) {
          retireFailure(error);
          throw error;
        }
      },
      setState({ pitch, controlPitch = pitch, controlYaw, zoom, distance, distanceKilometers, bodyCenterKilometers, pose } = {}) {
        if (lifetime.disposed) return this.state();
        try {
          cameraMotion.cancel();
          controls.stop();
          camera.restore({
            ...controlPitch === void 0 ? {} : { rotX: controlPitch },
            ...controlYaw === void 0 ? {} : { rotY: controlYaw },
            ...distanceKilometers !== void 0 ? { distanceKilometers } : distance !== void 0 ? { distance } : zoom === void 0 ? {} : { zoom }
          }, pose, bodyCenterKilometers);
          publish();
        } catch (error) {
          retireFailure(error);
          throw error;
        }
        return this.state();
      },
      state() {
        const pose = camera.snapshot();
        const state = {
          pose,
          pitch: camera.state.rotX,
          controlPitch: camera.state.rotX,
          controlYaw: camera.state.rotY,
          zoom: camera.state.zoom,
          ...perspective.state()
        };
        return Object.freeze(state);
      },
      sharedState() {
        const state = this.state();
        const bodyCenterKilometers = state.bodyCenterKilometers;
        return {
          distanceKilometers: state.distanceKilometers,
          pose: state.pose,
          ...bodyCenterKilometers === void 0 ? {} : { bodyCenterKilometers }
        };
      },
      skyState() {
        return Object.freeze({
          sunViewDirection: skySunViewDirection === null ? null : Object.freeze([...skySunViewDirection]),
          sunVisible: skySunViewDirection === null ? false : skySunViewDirection[2] < 0
        });
      },
      stats() {
        return Object.freeze({
          owner: "shared-retained-cubic-sky-orbit",
          inputMode: "event-driven-unbounded-matrix-drag-wheel-pinch",
          enabledAxes: "unbounded-pitch-and-yaw",
          cameraModel: cameraPlan.cameraModel,
          pitchBounded: false,
          yawBounded: false,
          minimumPitchDegrees: cameraPlan.minimumControlPitchDegrees,
          maximumPitchDegrees: cameraPlan.maximumControlPitchDegrees,
          defaultControlPitchDegrees: cameraPlan.defaultControlPitchDegrees,
          defaultControlYawDegrees: cameraPlan.defaultControlYawDegrees,
          minimumZoom: minimumZoom(),
          maximumZoom: maximumZoom(),
          defaultZoom: cameraPlan.defaultZoom,
          responsiveFitModel: responsiveFit.model,
          responsiveWidthShare: responsiveFit.widthShare,
          responsiveBaseZoom: responsiveFit.zoom,
          publications,
          preparedFocusId: camera.focus()?.id ?? null,
          flightActive: cameraMotion.signal !== void 0,
          framePublication: publicationState(),
          interactionStarts,
          interactionEnds,
          dragInertia: controls.stats(),
          runtimeGeometryPreparation: false,
          ...perspective.stats({ wheelDollies: controls.stats().wheelZoom?.events ?? 0 })
        });
      },
      destroy() {
        const errors = lifetime.destroy();
        if (errors.length) throw new AggregateError(errors, "Cubic-sky orbit cleanup failed.");
      }
    });
  } catch (error) {
    const errors = lifetime.destroy();
    if (errors.length) throw new AggregateError([error, ...errors], "Cubic-sky orbit construction failed.", { cause: error });
    throw error;
  }
}

// src/renderers/css/navigation/view-url.ts
function invalid(key = "v") {
  throw new Error(`Invalid \u201C${key}\u201D in this view link.`);
}
function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}
var SHARED_VERSION = 5;
var MAX_SHARED_BYTES = 4096;
var MINIMAL_POSE_SCHEMA = "cssearth-camera-pose@2";
var MATRIX_INDICES = [0, 1, 2, 4, 5, 6, 8, 9, 10];
function record(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !keys.includes(key))) invalid(label);
}
function poseMatrix(value) {
  if (typeof value !== "string" || value.length > 1024) invalid("pose");
  const match = /^matrix3d\(([^)]+)\)$/u.exec(value);
  if (!match) invalid("pose");
  const fields = match[1].split(",").map((field) => field.trim());
  if (fields.length !== 16 || fields.some((field) => !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/iu.test(field))) invalid("pose");
  const matrix = fields.map(Number);
  if (!matrix.every(Number.isFinite) || [3, 7, 11, 12, 13, 14].some((index) => Math.abs(matrix[index]) > 1e-9) || Math.abs(matrix[15] - 1) > 1e-9) invalid("pose");
  for (let a = 0; a < 3; a += 1) for (let b = a; b < 3; b += 1) {
    const dot2 = matrix[a * 4] * matrix[b * 4] + matrix[a * 4 + 1] * matrix[b * 4 + 1] + matrix[a * 4 + 2] * matrix[b * 4 + 2];
    if (Math.abs(dot2 - (a === b ? 1 : 0)) > 1e-4) invalid("pose");
  }
  const determinant = matrix[0] * (matrix[5] * matrix[10] - matrix[6] * matrix[9]) - matrix[4] * (matrix[1] * matrix[10] - matrix[2] * matrix[9]) + matrix[8] * (matrix[1] * matrix[6] - matrix[2] * matrix[5]);
  if (Math.abs(determinant - 1) > 1e-4) invalid("pose");
  return matrix;
}
function validateShared(view) {
  record(view, ["camera", "preparedEpochJdTt", "playback"], "view");
  const camera = view.camera, playback = view.playback;
  record(camera, ["distanceKilometers", "pose", "bodyCenterKilometers"], "camera");
  if (typeof camera.distanceKilometers !== "number" || !Number.isFinite(camera.distanceKilometers) || camera.distanceKilometers <= 0) invalid("camera");
  if (camera.bodyCenterKilometers !== void 0) {
    const centre = camera.bodyCenterKilometers;
    if (!Array.isArray(centre) || centre.length !== 3 || ![0, 1, 2].every((index) => typeof centre[index] === "number" && Number.isFinite(centre[index])) || Math.abs(Math.hypot(...centre) - camera.distanceKilometers) > camera.distanceKilometers * 1e-12) invalid("camera");
  }
  const pose = camera.pose;
  record(pose, ["schema", "scene"], "pose");
  if (pose.schema !== MINIMAL_POSE_SCHEMA) invalid("pose");
  poseMatrix(pose.scene);
  if (view.preparedEpochJdTt !== null && (typeof view.preparedEpochJdTt !== "number" || !Number.isFinite(view.preparedEpochJdTt))) invalid("preparedEpochJdTt");
  record(playback, ["times", "speed", "motionRequested"], "playback");
  if (!Array.isArray(playback.times) || typeof playback.speed !== "number" || !Number.isFinite(playback.speed) || playback.speed < 0 || typeof playback.motionRequested !== "boolean") invalid("playback");
  for (const time of playback.times) if (typeof time !== "number" || !Number.isFinite(time) || time < 0) invalid("playback");
}
function parseSharedView(search) {
  const query = new URLSearchParams(search);
  if (query.size === 0) return null;
  if (query.size !== 1 || !query.has("v")) invalid();
  const token = query.get("v");
  if (token === null) invalid();
  if (!/^[A-Za-z0-9_-]+$/u.test(token) || token.length < 3 || token.length > Math.ceil(MAX_SHARED_BYTES * 4 / 3) || token.length % 4 === 1) invalid();
  let bytes;
  try {
    bytes = Uint8Array.from(atob(token.replaceAll("-", "+").replaceAll("_", "/")), (char) => char.charCodeAt(0));
    if (bytes.length > MAX_SHARED_BYTES || base64url(bytes) !== token) invalid();
  } catch {
    invalid();
  }
  if (bytes.length < 2) invalid();
  if (new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(0) >>> 12 !== SHARED_VERSION) {
    throw new Error("This shared view link uses an unsupported version.");
  }
  return parseCurrentShared(bytes);
}
function formatSharedView(view) {
  validateShared(view);
  const camera = view.camera;
  let flags = SHARED_VERSION << 12;
  if (camera.bodyCenterKilometers) flags |= 1;
  const values = camera.bodyCenterKilometers ? [...camera.bodyCenterKilometers] : [camera.distanceKilometers], playback = view.playback;
  if (view.preparedEpochJdTt !== null) {
    flags |= 2;
    values.push(view.preparedEpochJdTt);
  }
  if (playback.speed !== 1) {
    flags |= 8;
    values.push(playback.speed);
  }
  if (playback.motionRequested) flags |= 16;
  const matrix = poseMatrix(view.camera.pose.scene), quaternion = matrixQuaternion2(matrix);
  let largest = 0;
  for (let i = 1; i < 4; i += 1) if (Math.abs(quaternion[i]) > Math.abs(quaternion[largest])) largest = i;
  const sign = quaternion[largest] < 0 ? -1 : 1;
  const small = quaternion.filter((_, i) => i !== largest).map((value) => value * sign);
  const reconstructed = quaternionMatrix(expandQuaternion(small, largest));
  if (MATRIX_INDICES.some((i) => Math.abs(matrix[i] - reconstructed[i]) > 1e-12)) {
    flags |= 32;
    values.push(...MATRIX_INDICES.map((i) => matrix[i]));
  } else {
    flags |= largest << 6;
    values.push(...small);
  }
  const length = 4 + 8 * (values.length + playback.times.length);
  if (length > MAX_SHARED_BYTES) invalid();
  const bytes = new Uint8Array(length), data = new DataView(bytes.buffer);
  data.setUint16(0, flags);
  let offset = 2;
  for (const value of values) {
    data.setFloat64(offset, value);
    offset += 8;
  }
  data.setUint16(offset, playback.times.length);
  offset += 2;
  for (const time of playback.times) {
    data.setFloat64(offset, time);
    offset += 8;
  }
  return `v=${base64url(bytes)}`;
}
function parseCurrentShared(bytes) {
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), flags = data.getUint16(0);
  if (flags & 3844 || flags & 32 && flags & 192) invalid();
  let offset = 2;
  const read = () => {
    if (offset + 8 > bytes.length) invalid();
    const value = data.getFloat64(offset);
    offset += 8;
    if (!Number.isFinite(value)) invalid();
    return value;
  };
  const bodyCenterKilometers = flags & 1 ? [read(), read(), read()] : void 0;
  const view = {
    preparedEpochJdTt: null,
    camera: bodyCenterKilometers ? { distanceKilometers: Math.hypot(...bodyCenterKilometers), bodyCenterKilometers } : { distanceKilometers: read() }
  };
  if (flags & 2) view.preparedEpochJdTt = read();
  const speed = flags & 8 ? read() : 1;
  let matrix;
  if (flags & 32) {
    matrix = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
    for (const index of MATRIX_INDICES) matrix[index] = read();
  } else matrix = quaternionMatrix(expandQuaternion([read(), read(), read()], flags >> 6 & 3));
  view.camera.pose = { schema: MINIMAL_POSE_SCHEMA, scene: serializeMatrix(matrix) };
  if (offset + 2 > bytes.length) invalid();
  const count = data.getUint16(offset);
  offset += 2;
  if (offset + count * 8 !== bytes.length) invalid();
  view.playback = { times: Array.from({ length: count }, read), speed, motionRequested: Boolean(flags & 16) };
  validateShared(view);
  return view;
}
function expandQuaternion(small, largest) {
  const sum = small.reduce((total, value) => total + value * value, 0);
  if (!Number.isFinite(sum) || sum > 0.75 + 1e-12) invalid("pose");
  const omitted = Math.sqrt(1 - sum);
  if (small.some((value) => Math.abs(value) > omitted + 1e-12)) invalid("pose");
  const quaternion = [...small];
  quaternion.splice(largest, 0, omitted);
  return quaternion;
}
function serializeMatrix(matrix) {
  return `matrix3d(${matrix.map((value) => Math.abs(value) < 1e-12 ? 0 : Number(value.toFixed(12))).join(",")})`;
}
function quaternionMatrix([x, y, z, w]) {
  return [
    1 - 2 * (y * y + z * z),
    2 * (x * y + z * w),
    2 * (x * z - y * w),
    0,
    2 * (x * y - z * w),
    1 - 2 * (x * x + z * z),
    2 * (y * z + x * w),
    0,
    2 * (x * z + y * w),
    2 * (y * z - x * w),
    1 - 2 * (x * x + y * y),
    0,
    0,
    0,
    0,
    1
  ];
}
function matrixQuaternion2(m) {
  const trace = m[0] + m[5] + m[10];
  let x, y, z, w;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    w = s / 4;
    x = (m[6] - m[9]) / s;
    y = (m[8] - m[2]) / s;
    z = (m[1] - m[4]) / s;
  } else if (m[0] > m[5] && m[0] > m[10]) {
    const s = Math.sqrt(1 + m[0] - m[5] - m[10]) * 2;
    w = (m[6] - m[9]) / s;
    x = s / 4;
    y = (m[4] + m[1]) / s;
    z = (m[8] + m[2]) / s;
  } else if (m[5] > m[10]) {
    const s = Math.sqrt(1 + m[5] - m[0] - m[10]) * 2;
    w = (m[8] - m[2]) / s;
    x = (m[4] + m[1]) / s;
    y = s / 4;
    z = (m[9] + m[6]) / s;
  } else {
    const s = Math.sqrt(1 + m[10] - m[0] - m[5]) * 2;
    w = (m[1] - m[4]) / s;
    x = (m[8] + m[2]) / s;
    y = (m[9] + m[6]) / s;
    z = s / 4;
  }
  const norm = Math.hypot(x, y, z, w);
  return [x / norm, y / norm, z / norm, w / norm];
}

// src/renderers/css/navigation/saved-world-camera.ts
function savedWorldCamera(saved, frame, viewport) {
  const view = parseSharedView(formatSharedView(saved));
  if (view.preparedEpochJdTt !== frame.epochJdTt) throw new TypeError("Saved camera has a different prepared epoch.");
  const camera = view.camera;
  const components = camera.pose.scene.slice(9, -1).split(",").map(Number);
  const rotation = [
    components[0],
    components[4],
    components[8],
    components[1],
    components[5],
    components[9],
    components[2],
    components[6],
    components[10]
  ];
  if (camera.bodyCenterKilometers) {
    const units = camera.bodyCenterKilometers.map((value) => value * 1e3 / frame.metersPerUnit);
    return worldCameraFromPresentation({ rotation, bodyCenterUnits: [units[0], units[1], units[2]] }, frame);
  }
  return worldCameraFromCenteredPresentation({
    rotation,
    distanceUnits: camera.distanceKilometers * 1e3 / frame.metersPerUnit
  }, frame, viewport);
}

// src/renderers/css/runtime/world-navigation-publication.ts
function createWorldNavigationPublicationHub(onError) {
  const listeners = /* @__PURE__ */ new Set();
  let latest = null;
  let disposed = false;
  return Object.freeze({
    publish(world, viewport) {
      if (disposed) return;
      if (latest && samePublication(latest[0], latest[1], world, viewport)) return;
      latest = [world, viewport];
      for (const listener of listeners) {
        try {
          listener(world, viewport);
        } catch (error) {
          disposed = true;
          listeners.clear();
          onError(error);
          return;
        }
      }
    },
    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("World navigation listener must be callable.");
      if (disposed) return () => {
      };
      listeners.add(listener);
      if (latest !== null) listener(latest[0], latest[1]);
      return () => listeners.delete(listener);
    },
    destroy() {
      disposed = true;
      listeners.clear();
      latest = null;
    }
  });
}
function samePublication(a, av, b, bv) {
  return a.referenceFrame === b.referenceFrame && a.epochJdTt === b.epochJdTt && a.pose.positionM.every((value, axis) => value === b.pose.positionM[axis]) && a.pose.orientationXyzw.every((value, axis) => value === b.pose.orientationXyzw[axis]) && av.focalPixels === bv.focalPixels && av.widthPixels === bv.widthPixels && av.heightPixels === bv.heightPixels && av.principalOffsetPixels[0] === bv.principalOffsetPixels[0] && av.principalOffsetPixels[1] === bv.principalOffsetPixels[1];
}

// src/renderers/css/runtime/object-runtime.ts
var nativeServices2 = Object.freeze({
  createLifetime: createSceneLifetime,
  createResources: createPreparedResidency,
  createPlayback: createPreparedPlayback,
  createSelection: createObjectSelectionRuntime,
  createControls: createObjectControlBinding,
  createOrbit: createRetainedCubicSkyOrbit,
  waitDocument: waitForSceneDocument,
  waitPaint: waitForScenePaint
});
function createObjectRuntime(definition, services = {}) {
  requireObjectRuntimeDefinition(definition);
  if (!Array.isArray(definition.motion)) throw new TypeError("Object motion bindings must be prepared before mount.");
  const environment = { ...nativeServices2, ...services };
  return function mountObject(stage, { onError, onMotionRequest = () => {
  }, onFeatureSelect, datasetEffects, inputSurface, runtimePolicy, diagnostics = false, capabilities = {}, worldContext, cameraMotion, framePresenter, viewport, preparedResources, preparedTree, initialWorldCamera, initialProjection, onNavigationReady, progressiveActivation = false, arrivingByFlight = false, deferTextureRefinement = false }) {
    if (stage?.dataset?.objectId !== definition.id) throw new TypeError("Object runtime identity does not match the registered stage.");
    if (stage?.nodeType !== 1 || !stage.ownerDocument || typeof onError !== "function" || typeof onMotionRequest !== "function") {
      throw new TypeError("Object mount requires the registered stage and error owner.");
    }
    if (!worldContext || !viewport || !framePresenter || !cameraMotion) throw new TypeError("Object mount requires its shared world, viewport and frame presenter.");
    const worldFrame = worldContext.frame;
    const initialLens = stage.dataset.preparedDataset;
    if (stage.dataset.preparedView) {
      const saved = parseSharedView(`v=${stage.dataset.preparedView}`);
      if (!saved) throw new TypeError("A prepared view requires its shared world frame.");
      initialWorldCamera ??= savedWorldCamera(saved, worldFrame, { focalPixels: 1, principalOffsetPixels: [0, 0] });
      delete stage.dataset.preparedView;
    }
    const initialSettings = {};
    for (const control of definition.controls.settings?.controls ?? []) {
      const input = [...stage.ownerDocument.querySelectorAll(".object-settings input[form][name]")].find((input2) => input2.name === control.name);
      if (input) initialSettings[control.name] = control.kind === "toggle" ? input.checked : Number(input.value);
    }
    if (stage.dataset.preparedSettings) initialObjectSelection(definition.controls, initialLens, JSON.parse(stage.dataset.preparedSettings));
    const initialSelection = initialObjectSelection(definition.controls, initialLens, initialSettings);
    delete stage.dataset.preparedDataset;
    delete stage.dataset.preparedSettings;
    if (definition.destinations && !capabilities.createDestinations) throw new TypeError("Prepared destinations require an injected runtime capability.");
    if (definition.features && !capabilities.mountSurfaceFeatures) throw new TypeError("Prepared surface features require an injected runtime capability.");
    const lifetime = environment.createLifetime();
    let phase = "mounting";
    let resolveReady, rejectReady;
    const ready = new Promise((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    ready.catch(() => {
    });
    const live = () => phase === "ready" && !lifetime.disposed;
    let mounted = null, orbit = null;
    let currentView = null, reference = null, previousPublication = null;
    let surfaceFeatures = null, featuresInFlight = arrivingByFlight;
    let allowed = false, navigatedLens = null, maximumZoom = definition.camera.maximumZoom;
    const cameraPlan = Object.freeze({ ...definition.camera, get maximumZoom() {
      return maximumZoom;
    } });
    let startupDecodedAssets = 0;
    let revision = 0, selection = null, controls = null;
    const viewListeners = /* @__PURE__ */ new Set();
    const datasetListeners = /* @__PURE__ */ new Set();
    const worldPublication = createWorldNavigationPublicationHub(fatal);
    let latestWorldPublication = null;
    const notifyView = () => {
      if (phase === "ready") for (const listener of viewListeners) listener();
    };
    lifetime.onDispose(() => {
      viewListeners.clear();
      datasetListeners.clear();
      worldPublication.destroy();
    });
    const playback = environment.createPlayback();
    lifetime.onDispose(() => playback.destroy());
    if (preparedTree) lifetime.onDispose(() => preparedTree.destroy());
    let resources;
    try {
      const resourceOptions = {
        assets: definition.assets,
        onReady() {
          guarded(() => orbit?.invalidate());
        },
        onWarmError(error) {
          if (!lifetime.disposed) console.error(error);
        },
        onCleanupError: fatal,
        ...definition.assetOrigin ? { assetOrigin: definition.assetOrigin } : {}
      };
      resources = preparedResources ? preparedResources.claim(definition.assets, resourceOptions) : environment.createResources(resourceOptions);
    } catch (error) {
      const errors = lifetime.destroy();
      throw errors.length ? new AggregateError([error, ...errors], errorMessage(error), { cause: error }) : error;
    }
    lifetime.onDispose(() => resources.destroy());
    const context = Object.freeze({
      density: CANONICAL_PREPARED_IMAGE_DENSITY,
      resources: resources.resources,
      own(disposer) {
        const errors = lifetime.onDispose(disposer);
        if (errors.length) throw new AggregateError(errors, "Late presentation cleanup failed.");
      },
      registerAnimation: playback.register,
      seekAnimation: playback.seek
    });
    const destinations = definition.destinations && capabilities.createDestinations ? capabilities.createDestinations({
      plan: definition.destinations,
      ready,
      lifetime,
      navigate: (camera, options) => {
        alignMotionFrame();
        return getOrbit().flyToState(camera, { ...options, surfaceTarget: true });
      },
      reset: (options) => getOrbit().flyToState({
        controlPitch: definition.camera.defaultControlPitchDegrees,
        controlYaw: definition.camera.defaultControlYawDegrees,
        zoom: getOrbit().initialResponsiveZoom()
      }, options)
    }) : null;
    const preparedEpochJdTt = worldFrame.epochJdTt;
    let restoreVersion = 0;
    const sharedView = Object.freeze({
      capture(motionRequested = false) {
        if (phase !== "ready") return null;
        const camera = getOrbit().sharedState();
        return {
          camera,
          preparedEpochJdTt,
          playback: { times: playback.captureMotion(), speed: playback.stats().speed, motionRequested }
        };
      },
      async restore(saved) {
        const view = parseSharedView(formatSharedView(saved));
        if (!view) throw new TypeError("A saved object view is required.");
        const version = ++restoreVersion;
        if (!live()) return false;
        if (view.preparedEpochJdTt !== preparedEpochJdTt) {
          throw new TypeError("This view uses a different prepared astronomical date.");
        }
        playback.validateMotion(view.playback.times);
        const speed = definition.controls.settings?.controls.find((control) => control.name === "speed");
        if (view.playback.speed !== playback.stats().speed) {
          if (!speed || !await getSelection().dispatch({ kind: "cycle", name: "speed", value: view.playback.speed })) {
            throw new TypeError("This view uses an unsupported playback speed.");
          }
        }
        if (lifetime.disposed || version !== restoreVersion) return false;
        playback.restoreMotion(view.playback.times);
        getOrbit().setState(view.camera);
        return true;
      },
      subscribe(listener) {
        viewListeners.add(listener);
        return () => viewListeners.delete(listener);
      }
    });
    const navigation = Object.freeze({
      frame: worldFrame,
      motion: cameraMotion,
      setZoomOutCentering(enabled) {
        if (!lifetime.disposed) getOrbit().setZoomOutCentering(enabled);
      },
      capture() {
        return getOrbit().captureWorldCamera(worldFrame);
      },
      apply(pose, options) {
        if (lifetime.disposed || options?.signal.aborted) return options ? Promise.resolve(false) : void 0;
        setAllowed(false);
        return getOrbit().applyWorldCamera(pose, worldFrame, options?.signal);
      },
      preparedFocus() {
        return getOrbit().preparedFocus();
      },
      // Every prepared group is connected and painted once: an arriving flight
      // may resume before the remaining readiness bookkeeping settles.
      detailActivated() {
        return phase !== "mounting" && !lifetime.disposed;
      },
      setPreparedFocus(focus) {
        if (!lifetime.disposed) getOrbit().setPreparedFocus(focus, worldFrame);
      },
      flyToPreparedFocus(focus, options) {
        if (lifetime.disposed) return Promise.resolve({ completed: false });
        setAllowed(false);
        return getOrbit().flyToPreparedFocus(focus, worldFrame, this.optics(), options);
      },
      optics() {
        const state = getOrbit().state();
        return {
          focalPixels: state.focal,
          principalOffsetPixels: [state.principalOffset[0], state.principalOffset[1]],
          visibleRect: state.visibleRect ?? null,
          widthPixels: latestWorldPublication?.stageViewport.widthPixels,
          heightPixels: latestWorldPublication?.stageViewport.heightPixels,
          detailHandoffDiameterPixels: definition.camera.levelOfDetail.billboardFullDiscPixels,
          framingRadiusPixels: getOrbit().currentResponsiveZoom() / definition.camera.defaultZoom * definition.camera.logicalBodyDiameter / 2
        };
      },
      subscribe(listener) {
        return worldPublication.subscribe(listener);
      }
    });
    const datasets = definition.controls.lenses && definition.controls.lenses.controls.length ? Object.freeze({
      ids: Object.freeze(definition.controls.lenses.controls.map((item) => item.id)),
      defaultId: definition.controls.lenses.defaultLens,
      volumes: Object.freeze(definition.controls.lenses.controls.flatMap((item) => item.volume ? [item.volume] : [])),
      volumeOf: (id) => selectedLensVolume(definition.controls, id),
      current: () => lifetime.disposed ? null : selection?.state().committed?.lensId ?? null,
      async select(id, options = {}) {
        if (!live() || options.signal?.aborted) return false;
        return getSelection().dispatch({ kind: "lens", id }, { ...options, frameCamera: false });
      },
      subscribe(listener) {
        if (!lifetime.disposed) datasetListeners.add(listener);
        return () => {
          datasetListeners.delete(listener);
        };
      }
    }) : void 0;
    const features = definition.features ? Object.freeze({
      catalog: () => surfaceFeatures?.catalog() ?? null,
      loaded: () => ready.then(() => {
        if (!surfaceFeatures) throw new Error("Surface features are not mounted.");
        return surfaceFeatures.loaded();
      }),
      lensIds: definition.features.lensIds,
      select: (id, options) => ready.then(() => surfaceFeatures?.select(id, options) ?? { completed: false }),
      selected: () => surfaceFeatures?.selected() ?? null,
      clear: () => surfaceFeatures?.clear(),
      setNavigationInFlight: (active, landed = true) => {
        featuresInFlight = active;
        surfaceFeatures?.setNavigationInFlight?.(active, landed);
      }
    }) : void 0;
    const controller = Object.freeze({
      ready,
      sharedView,
      ...destinations ? { destinations } : {},
      ...features ? { features } : {},
      // Only the native owner knows when these capabilities can use its camera and selection.
      get navigation() {
        return live() ? navigation : void 0;
      },
      get datasets() {
        return live() ? datasets : void 0;
      },
      refineTextures() {
        if (!lifetime.disposed) guarded(() => selection?.refineTextures());
      },
      refinesWithoutInput: definition.textureLevels !== void 0,
      pause() {
        if (!lifetime.disposed) guarded(() => setAllowed(false));
      },
      resume() {
        if (!lifetime.disposed) guarded(() => setAllowed(true));
      },
      destroy() {
        resolveReady();
        const errors = lifetime.destroy();
        if (errors.length) throw new AggregateError(errors, "Object cleanup failed.");
      }
    });
    start().catch(fatal);
    return controller;
    function getOrbit() {
      if (!orbit) throw new Error("Object camera is not mounted.");
      return orbit;
    }
    function getSelection() {
      if (!selection) throw new Error("Object selection is not mounted.");
      return selection;
    }
    function syncPagePlayback(speed = selection?.state().committed?.speed ?? initialSelection.speed) {
      surfaceFeatures?.setPlaying(allowed && (speed ?? 1) !== 0);
    }
    function setAllowed(value) {
      allowed = value;
      playback.setAllowed(value);
      syncPagePlayback();
    }
    function stopMotion() {
      onMotionRequest(false);
      setAllowed(false);
    }
    function alignMotionFrame() {
      const elements = mounted?.motionFrame;
      if (!elements?.length) return;
      const window2 = stage.ownerDocument.defaultView;
      if (!window2) throw new Error("Object motion requires the mounted window.");
      const frame = () => elements.reduce((matrix, element) => matrix.multiply(
        new window2.DOMMatrix(window2.getComputedStyle(element).transform)
      ), new window2.DOMMatrix());
      const before = frame();
      playback.resetMotion();
      getOrbit().rebaseScene(before.multiply(frame().inverse()));
    }
    function publishSelection(state) {
      controls?.publish(state);
      if (state.committed && !state.pending) notifyView();
      if (!state.committed || state.pending || !orbit || state.committed.lensId === navigatedLens) return;
      navigatedLens = state.committed.lensId;
      if (phase === "ready" && navigatedLens !== null) for (const listener of datasetListeners) listener(navigatedLens);
      const navigation2 = state.plan?.navigation;
      if (!navigation2) return;
      maximumZoom = navigation2.maximumZoom;
      const intent = state.committedBy;
      if (!intent?.frameCamera || intent.kind === "initial" && initialWorldCamera) return;
      if (navigation2.camera) {
        stopMotion();
        alignMotionFrame();
      }
      orbit.setState({ zoom: Math.min(orbit.state().zoom, maximumZoom) });
      if (navigation2.camera) orbit.flyToState(navigation2.camera, { surfaceTarget: true });
    }
    function fatal(error) {
      if (lifetime.disposed) return;
      const errors = lifetime.destroy();
      const failure = errors.length ? new AggregateError([error, ...errors], errorMessage(error), { cause: error }) : error;
      if (phase === "ready") onError(failure);
      else rejectReady(failure);
    }
    function guarded(callback) {
      if (lifetime.disposed) return;
      try {
        return callback();
      } catch (error) {
        fatal(error);
      }
    }
    function publish(publication) {
      if (lifetime.disposed) return;
      reference ??= publication;
      currentView = Object.freeze({ ...publication, reference, previous: previousPublication, revision: ++revision });
      previousPublication = publication;
      selection?.setView(currentView);
      surfaceFeatures?.publish(currentView);
      latestWorldPublication = publication;
      publishWorldSnapshot(publication);
      notifyView();
    }
    function publishWorldSnapshot(publication) {
      if (orbit === null) return;
      worldPublication.publish(publication.worldCamera, publication.stageViewport);
    }
    async function start() {
      await lifetime.wait(environment.waitDocument(lifetime, stage.ownerDocument));
      if (lifetime.disposed) return;
      controls = environment.createControls({
        stage,
        controls: definition.controls,
        initialSelection,
        getState: () => selection?.state() ?? { desired: initialSelection, committed: null, committedBy: null, pending: true, plan: null, loadingMaterial: false, ready: false, error: null, viewRevision: null },
        onAction: async (action) => {
          const before = selection?.state().committed?.lensId;
          const committed = await (selection?.dispatch(action) ?? false);
          if (committed && action.kind === "lens" && action.id === before && !lifetime.disposed) {
            for (const listener of datasetListeners) listener(action.id);
          }
          return committed;
        },
        onError: (error) => datasetEffects ? datasetEffects.error(error) : console.error(error)
      });
      context.own(() => controls?.destroy());
      const startup = await lifetime.wait(preparedResources ? preparedResources.ready : Promise.resolve(true));
      if (lifetime.disposed || startup.cancelled) return;
      viewport.read(cameraPlan.projection.cssPerspective);
      mounted = mountPreparedPresentation(stage, context, definition, preparedTree, initialProjection, progressiveActivation);
      if (lifetime.disposed) return;
      syncPagePlayback();
      if (inputSurface?.nodeType !== 1) throw new Error("Shared object input surface is missing.");
      selection = environment.createSelection({
        definition,
        presentation: mounted,
        residency: resources,
        lifetime,
        deferTextureRefinement,
        initialLens,
        initialSettings,
        prepareSelection: datasetEffects && ((next, signal) => datasetEffects.prepare(selectedLensVolume(definition.controls, next.lensId), signal)),
        onCommit: (next, _plan, intent) => {
          if (intent.kind === "selection") datasetEffects?.commit(selectedLensVolume(definition.controls, next.lensId));
          playback.setSelection(next);
          surfaceFeatures?.setLens({ id: next.lensId });
          syncPagePlayback(next.speed ?? 1);
        },
        onFatalError: fatal,
        onChange: (state) => publishSelection(state),
        onMaterialError: (error) => console.error(error)
      });
      context.own(() => selection?.destroy());
      if (definition.features) {
        if (!capabilities.mountSurfaceFeatures || !mounted.featureTarget) throw new TypeError("Prepared surface features require an injected runtime capability.");
        const featureOrigin = definition.assetOrigin, featurePlan = definition.features;
        surfaceFeatures = capabilities.mountSurfaceFeatures({
          host: stage,
          plan: featurePlan,
          objectId: definition.id,
          target: mounted.featureTarget,
          scene: mounted.sceneElement,
          zoomRange: () => ({ minimum: definition.camera.minimumZoom, maximum: cameraPlan.maximumZoom }),
          navigation,
          flightLimits: () => ({ minimumDistanceM: definition.camera.dolly.minimumDistanceRadii * worldFrame.bodyRadiusM }),
          onSelect: onFeatureSelect,
          onFlight: () => {
            stopMotion();
          },
          ...featureOrigin ? { transport: (url, init) => fetch(resolvePreparedAssetUrl(url, featureOrigin, featurePlan.catalog.sha256), init) } : {},
          lifetime,
          pickingHost: stage,
          inputSurface,
          onError: (error) => console.error(error)
        });
        context.own(() => surfaceFeatures?.destroy());
        if (featuresInFlight) surfaceFeatures.setNavigationInFlight?.(true);
        surfaceFeatures.setLens({ id: initialSelection.lensId });
      }
      orbit = environment.createOrbit({
        stage,
        inputSurface,
        runtimePolicy,
        cameraElement: mounted.cameraElement,
        sceneElement: mounted.sceneElement,
        ...mounted.revealGroups ? { revealGroups: mounted.revealGroups } : {},
        // An undrawn mesh commits no textures; it stays hidden until it has them.
        canReveal: () => selection?.state().plan?.deferredTextures !== true,
        directionalSunPlan: definition.sun ?? null,
        worldContext,
        cameraPlan,
        viewport,
        cameraMotion,
        framePresenter,
        objectId: definition.id,
        preparedSurfaceHitTest: mounted.surfaceHitTest,
        onPublish: (publication) => guarded(() => publish(publication)),
        onError: fatal
      });
      context.own(() => orbit?.destroy());
      if (latestWorldPublication !== null) publishWorldSnapshot(latestWorldPublication);
      if (lifetime.disposed) return;
      startupDecodedAssets = resources.stats().decodes;
      if (initialWorldCamera) {
        void orbit.applyWorldCamera(initialWorldCamera, worldFrame, cameraMotion.signal);
      }
      if (!preparedResources) resources.finishStartup();
      const initialized = await lifetime.wait(selection.start());
      if (lifetime.disposed || initialized.cancelled) return;
      if (!initialized.value) throw new Error("Initial object selection did not commit.");
      if (navigation) onNavigationReady?.(navigation);
      await lifetime.wait(mounted.activate());
      if (lifetime.disposed) return;
      phase = "activated";
      playback.setReady();
      await lifetime.wait(environment.waitPaint(lifetime, stage.ownerDocument.defaultView ?? window));
      if (lifetime.disposed) return;
      controls.setReady();
      phase = "ready";
      if ((define_import_meta_env_default?.PROD !== true || define_import_meta_env_default?.MODE === "performance") && diagnostics) publishObjectDiagnostics({ stage, definition, mounted, orbit, selection, controls, resources, playback, lifetime, context, initialSelection, startupDecodedAssets, surfaceFeatures, getCurrentView: () => currentView });
      resolveReady();
      if (definition.textureLevels && !deferTextureRefinement) selection.refineTextures();
    }
  };
}
export {
  createObjectRuntime,
  createObjectSelectionRuntime
};
