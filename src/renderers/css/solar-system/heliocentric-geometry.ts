import type { Vector2, Vector3, Matrix3, Matrix3dLike, VisibleRect } from './types.js';
import type { PreparedIllumination, SilhouetteEllipse } from './heliocentric-view.js';
export interface OffAxisFrame {radial:Vector2;sinTheta:number;cosTheta:number;tanTheta:number;}
// Distance at which the body's silhouette has the given on-screen radius
// across the off-axis direction (the tangential semi-axis).
export function distanceForSilhouetteRadius(
  bodyRadius:number,
  focal:number,
  screenRadius:number,
  principalOffset:Vector2 = [0, 0],
) {
  if (!positive(bodyRadius) || !positive(focal) || !positive(screenRadius)) {
    throw new TypeError("Silhouette framing arguments are invalid.");
  }
  const { cosTheta } = offAxisFrame(focal, principalOffset);
  const k = screenRadius / focal;
  const sinAlpha = k * cosTheta / Math.sqrt(1 + k * k);
  return bodyRadius / sinAlpha;
}

export function silhouetteRadiusAtDistance(
  bodyRadius:number,
  focal:number,
  distance:number,
  principalOffset:Vector2 = [0, 0],
) {
  return silhouetteEllipse(
    bodyRadius,
    focal,
    distance,
    offAxisFrame(focal, principalOffset),
  ).tangentialSemiAxis;
}

// The direction from the eye to the root's centre, `theta` off the view axis,
// and the unit screen direction from the principal point toward it.
export function offAxisFrame(focal:number, [ox, oy]:Vector2): OffAxisFrame {
  const offset = Math.hypot(ox, oy);
  const hypotenuse = Math.hypot(offset, focal);
  return Object.freeze({
    radial: offset > 1e-9 ? [-ox / offset, -oy / offset] : [0, 0],
    sinTheta: offset / hypotenuse,
    cosTheta: focal / hypotenuse,
    tanTheta: offset / focal,
  });
}

// The silhouette of a sphere `distance` from the eye, `theta` off the view
// axis, on the image plane `focal` away: semi-axes along and across the
// radial direction and the centre's outward shift from where the sphere's
// centre projects, all in CSS pixels.
export function silhouetteEllipse(bodyRadius:number, focal:number, distance:number, axis:OffAxisFrame): SilhouetteEllipse {
  const sinAlpha = bodyRadius / distance;
  const sin2Alpha = 2 * sinAlpha * Math.sqrt(1 - sinAlpha * sinAlpha);
  const sin2Theta = 2 * axis.sinTheta * axis.cosTheta;
  const denominator = axis.cosTheta * axis.cosTheta - sinAlpha * sinAlpha;
  if (!(denominator > 0)) {
    throw new RangeError("The body's silhouette leaves the image plane.");
  }
  const radialSemiAxis = focal * sin2Alpha / (2 * denominator);
  const tangentialSemiAxis = focal * sinAlpha / Math.sqrt(denominator);
  const centreShift = focal * sin2Theta / (2 * denominator) -
    focal * axis.tanTheta;
  return Object.freeze({
    radialSemiAxis,
    tangentialSemiAxis,
    // Unit screen direction of the radial axis (from the principal point).
    radial: Object.freeze([...axis.radial]),
    // Ellipse centre relative to the root's centre.
    centre: Object.freeze([
      centreShift * axis.radial[0],
      centreShift * axis.radial[1],
    ]),
  });
}

// Row-major 3x3 rotation from a CSS matrix3d (column-major m11.. m33): the
// linear part that maps a scene-frame direction into camera-root CSS space.
export function rotationFromMatrix3d(matrix: Matrix3dLike): Matrix3 {
  return Object.freeze([
    matrix.m11, matrix.m21, matrix.m31,
    matrix.m12, matrix.m22, matrix.m32,
    matrix.m13, matrix.m23, matrix.m33,
  ]);
}

// True when the ray from the eye to `eye` (eye-space point) enters the sphere
// at `center` before reaching the point.
export function rayHitsSphereBefore(eye:Vector3, center:Vector3, radius:number) {
  const a = dot(eye, eye);
  if (!(a > 0)) return false;
  const b = dot(eye, center);
  const c = dot(center, center) - radius * radius;
  const discriminant = b * b - a * c;
  if (discriminant < 0) return false;
  const t = (b - Math.sqrt(discriminant)) / a;
  return t > 0 && t < 1;
}

// Cuts a segment into the pieces the sphere does not hide, by sampling and
// bisecting each visibility change.
export function splitVisible(start:Vector3, end:Vector3, hidden:(point:Vector3)=>boolean): (readonly [Vector3,Vector3])[] {
  const samples = 16;
  const flags = [];
  for (let index = 0; index <= samples; index += 1) {
    flags.push(hidden(lerp(start, end, index / samples)));
  }
  if (flags.every((flag) => !flag)) return [[start, end]];
  if (flags.every(Boolean)) return [];
  const pieces: (readonly [Vector3,Vector3])[] = [];
  let openAt = flags[0] ? null : 0;
  for (let index = 0; index < samples; index += 1) {
    if (flags[index] === flags[index + 1]) continue;
    let low = index / samples;
    let high = (index + 1) / samples;
    for (let step = 0; step < 20; step += 1) {
      const middle = (low + high) / 2;
      if (hidden(lerp(start, end, middle)) === flags[index]) {
        low = middle;
      } else {
        high = middle;
      }
    }
    const boundary = (low + high) / 2;
    if (flags[index]) {
      openAt = boundary;
    } else {
      pieces.push([lerp(start, end, openAt!), lerp(start, end, boundary)]);
      openAt = null;
    }
  }
  if (openAt !== null) pieces.push([lerp(start, end, openAt!), end]);
  return pieces;
}

export function validVisibleRect(rect:VisibleRect) {
  return rect !== null && typeof rect === "object" &&
    [rect.left, rect.top, rect.right, rect.bottom].every(Number.isFinite) &&
    rect.right > rect.left && rect.bottom > rect.top;
}

// Liang-Barsky against |x| <= clipX, |y| <= clipY; returns the screen-space
// parameter window or null.
export function clipSegmentToRectangle(start:Vector2, end:Vector2, clipX:number, clipY:number): Vector2 | null {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  let t0 = 0;
  let t1 = 1;
  const edges = [
    [-dx, start[0] + clipX],
    [dx, clipX - start[0]],
    [-dy, start[1] + clipY],
    [dy, clipY - start[1]],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  return [t0, t1];
}

// A fraction along the projected segment corresponds to this fraction along
// the eye-space segment.
export function eyeFraction(screenFraction:number, startDepth:number, endDepth:number) {
  if (screenFraction <= 0) return 0;
  if (screenFraction >= 1) return 1;
  return screenFraction * startDepth /
    (endDepth + screenFraction * (startDepth - endDepth));
}

export function lerp(a:Vector3, b:Vector3, t:number): number[] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

export function determinant(basis:readonly Vector3[]) {
  const [a, b, c] = basis;
  return dot(a, cross(b, c));
}

export function dot(a:Vector3, b:Vector3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a:Vector3, b:Vector3): number[] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function add(a:Vector3, b:Vector3): number[] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function scale(vector:Vector3, factor:number): number[] {
  return [vector[0] * factor, vector[1] * factor, vector[2] * factor];
}

export function magnitude(vector:Vector3) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

export function normalize(vector:Vector3): Vector3 {
  const length = magnitude(vector);
  if (!(length > 0)) throw new RangeError("Direction has no magnitude.");
  return Object.freeze([vector[0] / length, vector[1] / length, vector[2] / length]);
}

export function round(value:number) {
  return Number(value.toFixed(6));
}

export function positive(value:number | undefined | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function vector(value:Vector3 | undefined | null): value is Vector3 {
  return Array.isArray(value) && value.length === 3 &&
    value.every(Number.isFinite);
}

// Prepared illumination from the observer's vantage: a phase, the light's
// view depth for the lighting atlas, and the marker's brightness as opacity.
export function validIllumination(illumination:PreparedIllumination) {
  return Number.isFinite(illumination?.phaseAngleDegrees) &&
    illumination.phaseAngleDegrees >= 0 && illumination.phaseAngleDegrees <= 180 &&
    Number.isFinite(illumination.illuminatedFraction) &&
    illumination.illuminatedFraction >= 0 && illumination.illuminatedFraction <= 1 &&
    Number.isFinite(illumination.lightViewZ) && Math.abs(illumination.lightViewZ) <= 1 &&
    positive(illumination.markerOpacity) && illumination.markerOpacity <= 1;
}

export function validBehindTurns(turns:readonly number[], vertexCount:number) {
  return Array.isArray(turns) && turns.length === vertexCount &&
    turns.every((turn) => Number.isFinite(turn) && turn >= 0 && turn < 1) &&
    turns[turns.length - 1] < turns[0];
}

// One weight per chord, each in [0, 1], the last chord (the one returning
// to the body) at full strength and at least one chord weightless: a trail,
// never a closed loop.
export function validTrail(trail:readonly number[], vertexCount:number) {
  return Array.isArray(trail) && trail.length === vertexCount &&
    trail.every((weight) => Number.isFinite(weight) && weight >= 0 && weight <= 1) &&
    trail[trail.length - 1] > 0.9 && trail.some((weight) => weight === 0);
}

export function unit(value:Vector3 | undefined | null) {
  return vector(value) && Math.abs(Math.hypot(...value) - 1) < 1e-9;
}
