import type { PointerDelta, Quaternion, Vector3 } from './math-types.js';
import { composeDragRotation } from './sphere-drag.js';

/** A body held to its own pole and turned as CesiumJS turns a globe about its constrained axis: a spin about the pole,
 * then a tilt about the screen axis across the pole. The pole keeps its direction on screen, so drags never roll the
 * body. The pan, the turn off the globe and the hold at the poles are adapted from CesiumJS ScreenSpaceCameraController
 * (pan3D, rotate3D) and Camera (rotateVertical), Apache-2.0, Copyright CesiumJS Contributors
 * (site/vendor/cesium-LICENSE.md):
 * https://github.com/CesiumGS/cesium/blob/1.145/packages/engine/Source/Scene/ScreenSpaceCameraController.js
 * https://github.com/CesiumGS/cesium/blob/1.145/packages/engine/Source/Scene/Camera.js
 * Cesium keeps north up the screen; here every screen direction is taken along and across the pole's own, so a leaning
 * pole turns as Cesium's upright one does. labs/experiments/drag-oracle replays drags on both and compares them.
 * All vectors are view directions in CSS axes: +x right, +y down, +z toward the eye. */
export interface PoleTurn { spin: number; tilt: number; }

// Cesium's hold at the poles: a pole may come POLE_STOP short of the line of sight and never cross it, and the eye counts
// as over a pole within POLE_NEAR of it (clampTilt).
const POLE_STOP = 1e-4, POLE_NEAR = 1e-2;
// Cesium's turn off the globe: the eye's height in radii, held between these, and a frame's share of the viewport.
const MINIMUM_VIEWPORT_RATE = 1 / 5000, MAXIMUM_VIEWPORT_RATE = 1.77, MAXIMUM_VIEWPORT_SHARE = .1;

/** The body as the eye sees it: its centre in CSS eye axes (the eye at the origin, looking down -z), its radius in the
 * same units, and the screen projection that draws it. */
export interface GrabSphere { center: Vector3; radius: number; opticalCenterX: number; opticalCenterY: number; focalLength: number; }

/** Cesium's pan: the spin is the longitude between the surface points under the two pointer positions and the tilt is
 * their difference in angle from the pole. It does not solve for the pointer: away from the eye's meridian the ground
 * lags it. Null when either position misses the body; the drag then turns by viewport share (poleViewportTurn). */
export function polePanTurn(pointer: PointerDelta, sphere: GrabSphere, pole: Vector3): PoleTurn | null {
  const { previousX, previousY, currentX, currentY } = pointer;
  if (![previousX, previousY, currentX, currentY].every(Number.isFinite)) throw new TypeError('Pole pan pointer is invalid.');
  const from = sphereHit(previousX, previousY, sphere), to = sphereHit(currentX, currentY, sphere);
  if (!from || !to) return null;
  const { pole: axis } = poleFrame(pole);
  const fromPole = Math.acos(Math.min(1, Math.max(-1, dot(axis, from)))), toPole = Math.acos(Math.min(1, Math.max(-1, dot(axis, to))));
  const u = reject(from, axis), v = reject(to, axis);
  const spin = Math.hypot(...u) < 1e-12 || Math.hypot(...v) < 1e-12 ? 0 : Math.atan2(dot(axis, cross(u, v)), dot(u, v));
  // Cesium's side test: is the point beyond the pole, seen from the eye?
  const eye = scale(sphere.center, -1 / Math.hypot(...sphere.center));
  const beyond = scale(reject(eye, axis), -1);
  const fromBeyond = dot(beyond, from) > 0, toBeyond = dot(beyond, to) > 0;
  // The eye's move away from the pole. A pointer that comes back over the pole carries the eye across it; one that goes
  // out over it does not, in Cesium.
  const away = fromBeyond && toBeyond ? toPole - fromPole
    : fromBeyond ? (dot(eye, axis) > 0 ? -fromPole - toPole : fromPole + toPole)
    : fromPole - toPole;
  return { spin, tilt: -away };
}

/** Cesium's turn off the globe: by the share of the viewport the pointer crosses in a frame, a full width for
 * 2 pi x rate about the pole and a full height for pi x rate across it, the rate being the eye's height in radii.
 * Cesium holds a frame's leftward and upward share to MAXIMUM_VIEWPORT_SHARE and leaves the other two directions free;
 * kept as it is. */
export function poleViewportTurn(pointer: PointerDelta, sphere: GrabSphere, viewport: { width: number; height: number }, pole: Vector3): PoleTurn {
  const { previousX, previousY, currentX, currentY } = pointer;
  if (![previousX, previousY, currentX, currentY].every(Number.isFinite) || !(viewport.width > 0) || !(viewport.height > 0)) {
    throw new TypeError('Pole viewport turn is invalid.');
  }
  const { up } = poleFrame(pole);
  const rate = Math.min(MAXIMUM_VIEWPORT_RATE, Math.max(MINIMUM_VIEWPORT_RATE, Math.hypot(...sphere.center) / sphere.radius - 1));
  const dx = currentX - previousX, dy = currentY - previousY;
  // Screen right of the pole is (-up.y, up.x).
  const leftward = Math.min(-(dx * -up[1]! + dy * up[0]!) / viewport.width, MAXIMUM_VIEWPORT_SHARE);
  const upward = Math.min((dx * up[0]! + dy * up[1]!) / viewport.height, MAXIMUM_VIEWPORT_SHARE);
  return { spin: leftward * 2 * Math.PI * rate, tilt: -upward * Math.PI * rate };
}

function sphereHit(x: number, y: number, { center, radius, opticalCenterX, opticalCenterY, focalLength }: GrabSphere): Vector3 | null {
  if (!Array.isArray(center) || center.length !== 3 || !center.every(Number.isFinite) || !(radius > 0) ||
      ![opticalCenterX, opticalCenterY, focalLength].every(Number.isFinite) || !(focalLength > 0)) {
    throw new TypeError('Pole grab sphere is invalid.');
  }
  const ray = [x - opticalCenterX, y - opticalCenterY, -focalLength];
  const length = Math.hypot(...ray);
  const direction = scale(ray, 1 / length);
  const along = dot(direction, center);
  const discriminant = along * along - (dot(center, center) - radius * radius);
  if (discriminant < 0) return null;
  const t = along - Math.sqrt(discriminant);
  if (t <= 0) return null;
  return scale([direction[0]! * t - center[0]!, direction[1]! * t - center[1]!, direction[2]! * t - center[2]!], 1 / radius);
}

/** The turn as a rotation: the spin about the pole, then the tilt across it, held at the poles. `meridian` is the body's
 * +x axis as a view direction: Cesium's hold at a pole depends on the eye's position in the body's own axes. */
export function poleTurnRotation({ spin, tilt }: PoleTurn, pole: Vector3, meridian: Vector3): Quaternion {
  if (!Number.isFinite(spin) || !Number.isFinite(tilt)) throw new TypeError('Pole turn is invalid.');
  if (!Array.isArray(meridian) || meridian.length !== 3 || !meridian.every(Number.isFinite)) throw new TypeError('Pole meridian is invalid.');
  const frame = poleFrame(pole), spun = axisAngle(frame.pole, spin);
  // Cesium spins first and tests the hold where that leaves the eye.
  return composeDragRotation(axisAngle(frame.east, clampTilt(tilt, frame, rotateVector(spun, meridian))), spun);
}

export function rotateVector([x, y, z, w]: Quaternion, [a, b, c]: Vector3): Vector3 {
  const tx = 2 * (y! * c! - z! * b!), ty = 2 * (z! * a! - x! * c!), tz = 2 * (x! * b! - y! * a!);
  return [a! + w! * tx + y! * tz - z! * ty, b! + w! * ty + z! * tx - x! * tz, c! + w! * tz + x! * ty - y! * tx];
}

/** The pole, its screen direction and the tilt axis across it on screen. */
function poleFrame(pole: Vector3) {
  if (!Array.isArray(pole) || pole.length !== 3 || !pole.every(Number.isFinite) || Math.abs(Math.hypot(...pole) - 1) > 1e-6) {
    throw new TypeError('Pole direction must be a finite unit vector.');
  }
  const unit = scale(pole, 1 / Math.hypot(...pole));
  // Along the sightline the pole has no screen direction; screen up stands in for it.
  const up = Math.hypot(unit[0]!, unit[1]!) < 1e-9 ? [0, -1, 0] : scale([unit[0]!, unit[1]!, 0], 1 / Math.hypot(unit[0]!, unit[1]!));
  return { pole: unit, up, east: [up[1]!, -up[0]!, 0] };
}

/** The pole's angle from the eye, measured along its screen direction. */
function poleFromEye({ pole, up }: { pole: Vector3; up: Vector3 }) { return Math.atan2(pole[0]! * up[0]! + pole[1]! * up[1]!, pole[2]!); }
// A tilt by t about `east` moves the pole's angle from the eye from b to b - t. Cesium's hold: a tilt that would carry a
// pole past the line of sight stops POLE_STOP short of it; with the eye over a pole, a tilt toward it does nothing and a
// tilt away from it is free. "Over a pole" is Cesium's test on the eye's position in the body's axes, each coordinate
// within POLE_NEAR of the pole's: a square about the pole, set by the meridian, reaching 0.57 degrees to a side and 0.81
// to a corner.
function clampTilt(tilt: number, frame: { pole: Vector3; up: Vector3 }, meridian: Vector3) {
  const fromEye = poleFromEye(frame), toFar = Math.PI - fromEye, { pole } = frame;
  // The eye is +z; its coordinates in the body's axes are the z components of those axes.
  const over = Math.abs(meridian[2]!) <= POLE_NEAR && Math.abs(cross(pole, meridian)[2]!) <= POLE_NEAR && 1 - Math.abs(pole[2]!) <= POLE_NEAR;
  if (over) return (pole[2]! > 0 ? tilt < 0 : tilt > 0) ? Math.min(Math.max(tilt, -toFar + POLE_STOP), fromEye - POLE_STOP) : 0;
  return tilt > fromEye ? fromEye - POLE_STOP : -tilt > toFar ? -toFar + POLE_STOP : tilt;
}
function axisAngle(axis: Vector3, angle: number): Quaternion {
  const s = Math.sin(angle / 2);
  return [axis[0]! * s, axis[1]! * s, axis[2]! * s, Math.cos(angle / 2)];
}
function scale(a: Vector3, s: number): Vector3 { return [a[0]! * s, a[1]! * s, a[2]! * s]; }
function dot(a: Vector3, b: Vector3) { return a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!; }
function cross(a: Vector3, b: Vector3): Vector3 { return [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!]; }
function reject(a: Vector3, axis: Vector3): Vector3 { const d = dot(a, axis); return [a[0]! - axis[0]! * d, a[1]! - axis[1]! * d, a[2]! - axis[2]! * d]; }
