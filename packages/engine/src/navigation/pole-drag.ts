import type { Quaternion, Vector3 } from './math-types.js';
import { composeDragRotation } from './sphere-drag.js';

/** A body tumble held to the body's own pole, as Cesium holds a globe to its constrained axis: sideways drags turn the
 * body about its pole and drags along the pole tilt it about the screen axis across the pole. The pole keeps its
 * direction on screen, so drags never roll the body. On the body the turn keeps the grabbed ground under the pointer
 * (poleGrabTurn); off it the angles come from the screen-axis tumble, which it equals with the pole upright. All vectors are view directions in CSS axes: +x right, +y down, +z toward the eye. */
export interface PoleTurn { spin: number; tilt: number; }

// The pole may reach the line of sight but not cross it: crossing would turn the body upside down.
const POLE_TILT_MARGIN = 1e-6;
// The grab's spin eases out near the pole while the pole is within POLE_NEAR of the line of sight, inside POLE_PIVOT_REACH
// of the pole as a share of the body's radius. Both chosen by feel, not measured.
const POLE_NEAR = 5 * Math.PI / 180, POLE_PIVOT_REACH = .25;

/** The tumble's screen angles (yaw for rightward, pitch for downward pointer motion) as radians about the pole and across
 * it, measured along the pole's own screen direction rather than the screen's. */
export function poleTumbleTurn({ pitchDegrees, yawDegrees }: { pitchDegrees: number; yawDegrees: number }, pole: Vector3): PoleTurn {
  if (!Number.isFinite(pitchDegrees) || !Number.isFinite(yawDegrees)) throw new TypeError('Pole tumble angles are invalid.');
  const { up } = poleFrame(pole);
  const radians = Math.PI / 180;
  // Screen right of the pole is (-up.y, up.x): a rightward drag there turns the near side right, about the pole.
  const along = yawDegrees * -up[1]! + pitchDegrees * up[0]!;
  const toward = yawDegrees * up[0]! + pitchDegrees * up[1]!;
  return { spin: -along * radians, tilt: -toward * radians };
}

/** The body as the eye sees it: its centre in CSS eye axes (the eye at the origin, looking down -z), its radius in the
 * same units, and the screen projection that draws it. */
export interface GrabSphere { center: Vector3; radius: number; opticalCenterX: number; opticalCenterY: number; focalLength: number; }

/** The pole turn that carries the surface point under the previous pointer to the point under the current one, as
 * Cesium's pan3D does about its constrained axis: the grabbed ground stays under the pointer while the pole keeps its
 * screen direction. Null when either pointer misses the body; the caller then turns by angle. Where no turn reaches the
 * pointer (a sideways drag close to the pole), the tilt goes as far as it can and the spin follows. Where the tilt is held
 * (the pole at the line of sight), the spin is measured with the tilt the turn is given and eases out near the pole. */
export function poleGrabTurn({ previousX, previousY, currentX, currentY }: { previousX: number; previousY: number; currentX: number; currentY: number },
  sphere: GrabSphere, pole: Vector3): PoleTurn | null {
  if (![previousX, previousY, currentX, currentY].every(Number.isFinite)) throw new TypeError('Pole grab pointer is invalid.');
  const from = sphereHit(previousX, previousY, sphere), to = sphereHit(currentX, currentY, sphere);
  if (!from || !to) return null;
  const frame = poleFrame(pole), { pole: axis, east } = frame;
  // A tilt by t about east followed by nothing else must bring the target to the source's height along the pole:
  // rotating `to` by a = -t about east gives it height A cos a + B sin a; solve for the smallest |a|.
  const height = dot(axis, from);
  const across = cross(axis, east);
  const A = dot(axis, to), B = dot(across, to);
  const reach = Math.hypot(A, B);
  const phase = Math.atan2(B, A);
  const spread = reach > 1e-12 ? Math.acos(Math.min(1, Math.max(-1, height / reach))) : 0;
  const a = [phase - spread, phase + spread].map(wrap).reduce((best, value) => Math.abs(value) < Math.abs(best) ? value : best);
  // The tilt the turn is given (poleTurnRotation): the pole may reach the line of sight, not cross it.
  const tilt = clampTilt(-a, frame);
  const lifted = rotateVector(axisAngle(east, -tilt), to);
  // The spin about the pole between the source and the lifted target, both seen down the pole.
  const u = reject(from, axis), v = reject(lifted, axis), fromPole = Math.min(Math.hypot(...u), Math.hypot(...v));
  const spin = fromPole < 1e-12 ? 0 : Math.atan2(dot(axis, cross(u, v)), dot(u, v));
  // With the pole at the line of sight the ground cannot follow a pointer that crosses the pole: the spin that would keep
  // it there turns half a circle within a pixel of the pole (172 degrees in one frame of a straight drag down Earth,
  // 2026-10-02). Within POLE_NEAR of the line of sight the spin eases out inside POLE_PIVOT_REACH of the pole, fully at the
  // line of sight itself: that drag stops at the pole, and a drag around the pole still turns the body.
  const fromEye = poleFromEye(frame);
  if (fromEye >= POLE_NEAR) return { spin, tilt };
  const free = smoothstep(fromEye / POLE_NEAR), pivot = smoothstep(fromPole / POLE_PIVOT_REACH);
  return { spin: spin * (free + (1 - free) * pivot), tilt };
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

export function poleTurnRotation({ spin, tilt }: PoleTurn, pole: Vector3): Quaternion {
  if (!Number.isFinite(spin) || !Number.isFinite(tilt)) throw new TypeError('Pole turn is invalid.');
  const frame = poleFrame(pole);
  return composeDragRotation(axisAngle(frame.east, clampTilt(tilt, frame)), axisAngle(frame.pole, spin));
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
// A tilt by t about `east` moves the pole's angle from the eye from b to b - t; keep it within (0, pi).
function clampTilt(tilt: number, frame: { pole: Vector3; up: Vector3 }) {
  const fromEye = poleFromEye(frame);
  return Math.min(Math.max(tilt, fromEye - Math.PI + POLE_TILT_MARGIN), fromEye - POLE_TILT_MARGIN);
}
function axisAngle(axis: Vector3, angle: number): Quaternion {
  const s = Math.sin(angle / 2);
  return [axis[0]! * s, axis[1]! * s, axis[2]! * s, Math.cos(angle / 2)];
}
function scale(a: Vector3, s: number): Vector3 { return [a[0]! * s, a[1]! * s, a[2]! * s]; }
function dot(a: Vector3, b: Vector3) { return a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!; }
function cross(a: Vector3, b: Vector3): Vector3 { return [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!]; }
function reject(a: Vector3, axis: Vector3): Vector3 { const d = dot(a, axis); return [a[0]! - axis[0]! * d, a[1]! - axis[1]! * d, a[2]! - axis[2]! * d]; }
function wrap(angle: number) { return Math.atan2(Math.sin(angle), Math.cos(angle)); }
function smoothstep(value: number) { const t = Math.min(1, Math.max(0, value)); return t * t * (3 - 2 * t); }
