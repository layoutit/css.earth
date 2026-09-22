import type { OrientationXyzw, PositionM } from '@cssearth/engine';
import type { WorldRotation } from './world-camera-math.js';
import type { PreparedWorldCameraFrame } from './world-camera.js';

// The free camera is the shared camera, unlocked from the mounted body: it
// pans, turns and zooms, and keeps one world vertical at the elevation the
// viewer chose, from side-on to top-down, with no roll.

export type ViewMode = 'orbit' | 'free';
/** The shared camera's view: its mode and the elevation the free camera keeps (0 side-on, 90 top-down). */
export interface CameraViewState { readonly mode: ViewMode; readonly elevationDegrees: number }

/** The world vertical `up` (a reference-frame direction) in the object's scene-presentation frame. */
export function sceneUp(frame: PreparedWorldCameraFrame, up: readonly [number, number, number]): PositionM {
  // presentationToReference is orthonormal (a reflection): its transpose maps back.
  const p = frame.presentationToReference;
  return normalize([
    p[0]! * up[0] + p[3]! * up[1] + p[6]! * up[2],
    p[1]! * up[0] + p[4]! * up[1] + p[7]! * up[2],
    p[2]! * up[0] + p[5]! * up[1] + p[8]! * up[2],
  ]);
}

/** The free-camera orientation nearest `current`: the same heading, `up` shown at
 * `elevationDegrees` above the view direction's horizon, no roll. Rows are the
 * CSS eye axes (+x right, +y down, +z toward the eye) in presentation directions. */
export function heldRotation(current: WorldRotation, up: PositionM, elevationDegrees: number): WorldRotation {
  let right = reject([current[0]!, current[1]!, current[2]!], up);
  if (Math.hypot(...right) < 1e-6) {
    // Looking along the up axis rolled onto it: take the heading from the view direction.
    const toward = reject([current[6]!, current[7]!, current[8]!], up);
    right = cross(up, scale(toward, -1));
  }
  right = normalize(right);
  const elevation = elevationDegrees * Math.PI / 180;
  const away = cross(right, up);
  const toward = add(scale(away, -Math.cos(elevation)), scale(up, Math.sin(elevation)));
  const down = cross(toward, right);
  return [...right, ...down, ...toward];
}

/** Eye-space rotation by `degrees` about the eye-space image of `up`. */
export function turnAboutUp(rotation: WorldRotation, up: PositionM, degrees: number): WorldRotation {
  const axis = normalize(apply(rotation, up));
  const angle = degrees * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
  const [x, y, z] = axis as [number, number, number];
  return [
    t * x * x + c, t * x * y - s * z, t * x * z + s * y,
    t * x * y + s * z, t * y * y + c, t * y * z - s * x,
    t * x * z - s * y, t * y * z + s * x, t * z * z + c,
  ];
}

export function composeRotations(a: WorldRotation, b: WorldRotation): WorldRotation {
  const out: number[] = [];
  for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) {
    out.push(a[row * 3]! * b[column]! + a[row * 3 + 1]! * b[3 + column]! + a[row * 3 + 2]! * b[6 + column]!);
  }
  return out;
}

export function transposeRotation(r: WorldRotation): WorldRotation {
  return [r[0]!, r[3]!, r[6]!, r[1]!, r[4]!, r[7]!, r[2]!, r[5]!, r[8]!];
}

/** Normalized blend `t` of the way from one orientation to another, along the shorter arc. */
export function blendOrientations(from: OrientationXyzw, to: OrientationXyzw, t: number): OrientationXyzw {
  const sign = from[0] * to[0] + from[1] * to[1] + from[2] * to[2] + from[3] * to[3] < 0 ? -1 : 1;
  const blend = [0, 1, 2, 3].map(index => from[index]! * (1 - t) + sign * to[index]! * t);
  const length = Math.hypot(...blend);
  return [blend[0]! / length, blend[1]! / length, blend[2]! / length, blend[3]! / length];
}

export function rotationsDiffer(a: WorldRotation, b: WorldRotation, tolerance = 1e-12): boolean {
  return a.some((value, index) => Math.abs(value - b[index]!) > tolerance);
}

export function apply(rotation: WorldRotation, v: PositionM): PositionM {
  return [
    rotation[0]! * v[0] + rotation[1]! * v[1] + rotation[2]! * v[2],
    rotation[3]! * v[0] + rotation[4]! * v[1] + rotation[5]! * v[2],
    rotation[6]! * v[0] + rotation[7]! * v[1] + rotation[8]! * v[2],
  ];
}

const add = (a: PositionM, b: PositionM): PositionM => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: PositionM, k: number): PositionM => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: PositionM, b: PositionM) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const reject = (a: PositionM, n: PositionM): PositionM => add(a, scale(n, -dot(a, n)));
const cross = (a: PositionM, b: PositionM): PositionM =>
  [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function normalize(a: PositionM): PositionM {
  const length = Math.hypot(...a);
  if (!(length > 0)) throw new RangeError('Free camera direction is degenerate.');
  return scale(a, 1 / length);
}
