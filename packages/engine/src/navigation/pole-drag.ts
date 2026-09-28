import type { Quaternion, Vector3 } from './math-types.js';
import { composeDragRotation } from './sphere-drag.js';

/** A body tumble held to the body's own pole, as Cesium holds a globe to its constrained axis: sideways drags turn the
 * body about its pole and drags along the pole tilt it about the screen axis across the pole. The pole keeps its
 * direction on screen, so drags never roll the body. With the pole upright on screen this is the plain screen-axis
 * tumble. All vectors are view directions in CSS axes: +x right, +y down, +z toward the eye. */
export interface PoleTurn { spin: number; tilt: number; }

// The pole may reach the line of sight but not cross it: crossing would turn the body upside down.
const POLE_TILT_MARGIN = 1e-6;

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

// A tilt by t about `east` moves the pole's angle from the eye from b to b - t; keep it within (0, pi).
function clampTilt(tilt: number, { pole, up }: { pole: Vector3; up: Vector3 }) {
  const fromEye = Math.atan2(pole[0]! * up[0]! + pole[1]! * up[1]!, pole[2]!);
  return Math.min(Math.max(tilt, fromEye - Math.PI + POLE_TILT_MARGIN), fromEye - POLE_TILT_MARGIN);
}
function axisAngle(axis: Vector3, angle: number): Quaternion {
  const s = Math.sin(angle / 2);
  return [axis[0]! * s, axis[1]! * s, axis[2]! * s, Math.cos(angle / 2)];
}
function scale(a: Vector3, s: number): Vector3 { return [a[0]! * s, a[1]! * s, a[2]! * s]; }
