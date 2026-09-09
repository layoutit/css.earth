export type PositionM = readonly [number, number, number];
export type OrientationXyzw = readonly [number, number, number, number];
type MutablePosition = [number, number, number];
type MutableOrientation = [number, number, number, number];

/** Camera-to-reference rotation; all positions share the caller's resolved frame. */
export interface PhysicalCameraPose {
  readonly positionM: PositionM;
  readonly orientationXyzw: OrientationXyzw;
}
export interface FocusFrame {
  readonly originM: PositionM;
  readonly localToReferenceXyzw: OrientationXyzw;
}
export interface SelectionFlightCurve {
  readonly startRangeM: number;
  readonly endRangeM: number;
  readonly rangeDeltaM: number;
  readonly curveOffset: number;
  readonly curveSpan: number;
  readonly coshOffset: number;
  readonly sinhOffset: number;
  readonly nonlinear: boolean;
  readonly durationS: number;
}
export interface SelectionFlight {
  readonly from: PhysicalCameraPose;
  readonly to: PhysicalCameraPose;
  readonly focusPositionM: PositionM;
  readonly fromViewDirection: PositionM;
  readonly toViewDirection: PositionM;
  readonly curve: SelectionFlightCurve;
  readonly positionDurationS: number;
  readonly orientationDurationS: number;
  readonly durationS: number;
}
export interface SelectionFlightSample {
  positionM: MutablePosition;
  orientationXyzw: MutableOrientation;
  progress: number;
  complete: boolean;
}

// Galaxio navigation/orbitMath.ts buildSelectionFlightCurve and
// selectionFlightProgress: measured range interpolation, including its metre
// denominator floor. Position and orientation share that progress so an
// oblique system arrival does not finish moving before it finishes turning.
// Source data and reference-frame resolution remain caller-owned.
export function buildSelectionFlightCurve(startRangeM: number, endRangeM: number): SelectionFlightCurve {
  if (![startRangeM, endRangeM].every(Number.isFinite)) throw new TypeError('Selection flight ranges must be finite metres.');
  const start = Math.max(.001, startRangeM), end = Math.max(.001, endRangeM);
  const delta = Math.abs(start - end);
  const nonlinear = delta >= .01 * Math.max(start, end);
  if (!nonlinear) return Object.freeze({ startRangeM: start, endRangeM: end, rangeDeltaM: delta,
    curveOffset: 0, curveSpan: 0, coshOffset: 1, sinhOffset: 0, nonlinear: false, durationS: 1.5 });
  const scaledDelta = 1.96 * delta;
  const curveOffset = Math.asinh((start * start - end * end - scaledDelta * scaledDelta) / (2 * 1.96 * start * delta));
  const curveEnd = Math.asinh((start * start - end * end + scaledDelta * scaledDelta) / (2 * 1.96 * delta * Math.max(end, 1)));
  const curveSpan = (curveEnd - curveOffset) / 1.4;
  return Object.freeze({ startRangeM: start, endRangeM: end, rangeDeltaM: delta,
    curveOffset, curveSpan, coshOffset: Math.cosh(curveOffset), sinhOffset: Math.sinh(curveOffset),
    nonlinear: true, durationS: Math.min(4.5, Math.max(1.5, curveSpan * (1 / 3.5))) });
}

export function selectionFlightProgress(curve: SelectionFlightCurve, time: number): number {
  if (!Number.isFinite(time)) throw new TypeError('Selection flight time must be finite.');
  const t = clamp01(time);
  if (t === 0 || t === 1) return t;
  if (!curve.nonlinear) return smoothstep(t);
  const hyperbolic = Math.tanh(1.4 * curve.curveSpan * t + curve.curveOffset) * curve.coshOffset - curve.sinhOffset;
  return clamp01((curve.startRangeM / 1.96) * hyperbolic / curve.rangeDeltaM);
}

export function createSelectionFlight({ from, to, focusPositionM, durationS }: {
  from: PhysicalCameraPose; to: PhysicalCameraPose; focusPositionM: PositionM; durationS?: number;
}): SelectionFlight {
  validatePose(from); validatePose(to); validatePosition(focusPositionM);
  if (durationS !== undefined && (!Number.isFinite(durationS) || durationS <= 0)) throw new TypeError('Flight duration must be positive seconds.');
  const fromOffset = subtract(from.positionM, focusPositionM), toOffset = subtract(to.positionM, focusPositionM);
  const startRangeM = Math.hypot(...fromOffset), endRangeM = Math.hypot(...toOffset);
  if (startRangeM < .001 || endRangeM < .001) throw new TypeError('A selection camera must be at least one millimetre from its focus.');
  const curve = buildSelectionFlightCurve(startRangeM, endRangeM);
  const positionDurationS = durationS ?? curve.durationS;
  return Object.freeze({ from: copyPose(from), to: copyPose(to), focusPositionM: copyPosition(focusPositionM),
    fromViewDirection: viewDirection(fromOffset, startRangeM, from.orientationXyzw),
    toViewDirection: viewDirection(toOffset, endRangeM, to.orientationXyzw), curve,
    positionDurationS, orientationDurationS: positionDurationS, durationS: positionDurationS });
}

export function createSelectionFlightSample(): SelectionFlightSample {
  return { positionM: [0, 0, 0], orientationXyzw: [0, 0, 0, 1], progress: 0, complete: false };
}

/** Call with the last painted sample as `from` when another selection interrupts. */
export function sampleSelectionFlightInto(flight: SelectionFlight, elapsedS: number, out: SelectionFlightSample): SelectionFlightSample {
  if (!Number.isFinite(elapsedS)) throw new TypeError('Flight elapsed time must be finite seconds.');
  const elapsed = Math.max(0, elapsedS);
  const progress = selectionFlightProgress(flight.curve, elapsed / flight.positionDurationS);
  slerpQuaternionInto(out.orientationXyzw, flight.from.orientationXyzw, flight.to.orientationXyzw, progress);
  if (progress === 0) copy3Into(out.positionM, flight.from.positionM);
  else if (progress === 1) copy3Into(out.positionM, flight.to.positionM);
  else {
    // Interpolate the focus direction in the camera frame. Its on-screen
    // position then approaches the destination without swinging off-screen
    // while the camera rotates around it.
    slerpDirectionInto(out.positionM, flight.fromViewDirection, flight.toViewDirection, progress);
    rotateVectorInto(out.positionM, out.orientationXyzw, out.positionM);
    const rangeM = flight.curve.startRangeM + (flight.curve.endRangeM - flight.curve.startRangeM) * progress;
    for (let axis = 0; axis < 3; axis++) out.positionM[axis] = flight.focusPositionM[axis] + out.positionM[axis] * rangeM;
  }
  out.progress = progress;
  out.complete = elapsed >= flight.durationS;
  return out;
}

export function sampleSelectionFlight(flight: SelectionFlight, elapsedS: number): SelectionFlightSample {
  return sampleSelectionFlightInto(flight, elapsedS, createSelectionFlightSample());
}

export function cameraPoseToReferenceFrame(pose: PhysicalCameraPose, frame: FocusFrame): PhysicalCameraPose {
  validatePose(pose); validateFrame(frame);
  const offset = rotateVector(frame.localToReferenceXyzw, pose.positionM);
  return Object.freeze({ positionM: add(frame.originM, offset), orientationXyzw: multiplyQuaternion(frame.localToReferenceXyzw, pose.orientationXyzw) });
}

export function cameraPoseFromReferenceFrame(pose: PhysicalCameraPose, frame: FocusFrame): PhysicalCameraPose {
  validatePose(pose); validateFrame(frame);
  const [x, y, z, w] = frame.localToReferenceXyzw;
  const inverse: OrientationXyzw = [-x, -y, -z, w];
  return Object.freeze({ positionM: rotateVector(inverse, subtract(pose.positionM, frame.originM)),
    orientationXyzw: multiplyQuaternion(inverse, pose.orientationXyzw) });
}

function slerpDirectionInto(out: MutablePosition, from: PositionM, to: PositionM, t: number): void {
  const cosine = Math.max(-1, Math.min(1, from[0] * to[0] + from[1] * to[1] + from[2] * to[2]));
  if (cosine > .999999) {
    for (let axis = 0; axis < 3; axis++) out[axis] = from[axis] + (to[axis] - from[axis]) * t;
    const length = Math.hypot(...out);
    for (let axis = 0; axis < 3; axis++) out[axis] /= length;
    return;
  }
  let x = to[0] - cosine * from[0], y = to[1] - cosine * from[1], z = to[2] - cosine * from[2];
  let length = Math.hypot(x, y, z);
  if (length < 1e-12) {
    // Antipodes have many shortest arcs. A stable perpendicular avoids the
    // undefined midpoint of the ordinary sine-weight formulation.
    const axis = Math.abs(from[0]) < .9 ? 0 : 1;
    const dot = from[axis];
    x = Number(axis === 0) - dot * from[0]; y = Number(axis === 1) - dot * from[1]; z = -dot * from[2];
    length = Math.hypot(x, y, z);
  }
  const angle = Math.acos(cosine) * t, forward = Math.cos(angle), lateral = Math.sin(angle) / length;
  out[0] = from[0] * forward + x * lateral; out[1] = from[1] * forward + y * lateral; out[2] = from[2] * forward + z * lateral;
}

function slerpQuaternionInto(out: MutableOrientation, from: OrientationXyzw, to: OrientationXyzw, t: number): void {
  const dot = dot4(from, to), sign = dot < 0 ? -1 : 1;
  if (t === 0) { for (let axis = 0; axis < 4; axis++) out[axis] = from[axis]; return; }
  if (t === 1) { for (let axis = 0; axis < 4; axis++) out[axis] = to[axis] * sign; return; }
  const cosine = Math.min(1, Math.abs(dot));
  if (cosine > .999999) {
    for (let axis = 0; axis < 4; axis++) out[axis] = from[axis] + (to[axis] * sign - from[axis]) * t;
    const length = Math.hypot(...out);
    for (let axis = 0; axis < 4; axis++) out[axis] /= length;
    return;
  }
  const angle = Math.acos(cosine), sine = Math.sin(angle);
  const a = Math.sin((1 - t) * angle) / sine, b = Math.sin(t * angle) / sine * sign;
  for (let axis = 0; axis < 4; axis++) out[axis] = from[axis] * a + to[axis] * b;
}

function validatePosition(position: PositionM): void {
  if (position.length !== 3 || !position.every(Number.isFinite)) throw new TypeError('Camera coordinates must be three finite metres.');
}
function validateQuaternion(quaternion: OrientationXyzw): void {
  if (quaternion.length !== 4 || !quaternion.every(Number.isFinite) || Math.abs(Math.hypot(...quaternion) - 1) > 1e-9) throw new TypeError('Camera orientation must be a unit XYZW quaternion.');
}
function validatePose(pose: PhysicalCameraPose): void { validatePosition(pose.positionM); validateQuaternion(pose.orientationXyzw); }
function validateFrame(frame: FocusFrame): void { validatePosition(frame.originM); validateQuaternion(frame.localToReferenceXyzw); }
function copyPosition(value: PositionM): PositionM { return Object.freeze([value[0], value[1], value[2]]); }
function copyPose(pose: PhysicalCameraPose): PhysicalCameraPose {
  const orientationXyzw: OrientationXyzw = Object.freeze([pose.orientationXyzw[0], pose.orientationXyzw[1], pose.orientationXyzw[2], pose.orientationXyzw[3]]);
  return Object.freeze({ positionM: copyPosition(pose.positionM), orientationXyzw });
}
function copy3Into(out: MutablePosition, value: PositionM): void { out[0] = value[0]; out[1] = value[1]; out[2] = value[2]; }
function subtract(a: PositionM, b: PositionM): PositionM { return Object.freeze([a[0] - b[0], a[1] - b[1], a[2] - b[2]]); }
function add(a: PositionM, b: PositionM): PositionM { return Object.freeze([a[0] + b[0], a[1] + b[1], a[2] + b[2]]); }
function scale(a: PositionM, factor: number): PositionM { return Object.freeze([a[0] * factor, a[1] * factor, a[2] * factor]); }
function viewDirection(offset: PositionM, rangeM: number, orientation: OrientationXyzw): PositionM {
  const [x, y, z, w] = orientation;
  return rotateVector([-x, -y, -z, w], scale(offset, 1 / rangeM));
}
function dot4(a: OrientationXyzw, b: OrientationXyzw): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; }
function multiplyQuaternion(a: OrientationXyzw, b: OrientationXyzw): OrientationXyzw {
  const [x, y, z, w] = a, [i, j, k, r] = b;
  return Object.freeze([w * i + x * r + y * k - z * j, w * j - x * k + y * r + z * i,
    w * k + x * j - y * i + z * r, w * r - x * i - y * j - z * k]);
}
function rotateVector(q: OrientationXyzw, value: PositionM): PositionM {
  const out: MutablePosition = [0, 0, 0];
  rotateVectorInto(out, q, value);
  return Object.freeze(out);
}
function rotateVectorInto(out: MutablePosition, q: OrientationXyzw, value: PositionM): void {
  const [x, y, z, w] = q, [a, b, c] = value;
  const tx = 2 * (y * c - z * b), ty = 2 * (z * a - x * c), tz = 2 * (x * b - y * a);
  out[0] = a + w * tx + y * tz - z * ty;
  out[1] = b + w * ty + z * tx - x * tz;
  out[2] = c + w * tz + x * ty - y * tx;
}
function clamp01(value: number): number { return Math.max(0, Math.min(1, value)); }
function smoothstep(value: number): number { return value * value * (3 - 2 * value); }
