import { cameraPoseFromReferenceFrame } from './selection-flight.js';
import type { FocusFrame, OrientationXyzw, PhysicalCameraPose, PositionM } from './selection-flight.js';

/** A prepared local coordinate volume rooted in the shared physical reference frame. */
export interface AxisAlignedBounds {
  readonly min: PositionM;
  readonly max: PositionM;
}

export interface ScaledFocusFrame extends FocusFrame {
  /** Physical metres represented by one local volume unit. */
  readonly metersPerUnit: number;
  readonly boundsUnits: AxisAlignedBounds;
}

/** Camera axes remain physical; only its local position is expressed in volume units. */
export interface ScaledCameraPose {
  readonly positionUnits: PositionM;
  readonly orientationXyzw: OrientationXyzw;
}

/**
 * Presents the canonical physical observer in a prepared volume's right-handed local coordinates.
 * This is deliberately one-way: volume units never become application camera state.
 */
export function presentPhysicalPoseInVolume(pose: PhysicalCameraPose, frame: ScaledFocusFrame): ScaledCameraPose {
  validateScaledFocusFrame(frame);
  const local = cameraPoseFromReferenceFrame(pose, frame);
  return Object.freeze({
    positionUnits: copyPosition(scale(local.positionM, 1 / frame.metersPerUnit)),
    orientationXyzw: copyOrientation(local.orientationXyzw),
  });
}

/** Bounds are descriptive prepared coverage, not a navigation clamp. */
export function containsScaledFocusPosition(frame: ScaledFocusFrame, positionUnits: PositionM): boolean {
  validateScaledFocusFrame(frame);
  validatePosition(positionUnits, 'Scaled position');
  return positionUnits.every((value, axis) => value >= frame.boundsUnits.min[axis]! && value <= frame.boundsUnits.max[axis]!);
}

function validateScaledFocusFrame(frame: ScaledFocusFrame): void {
  if (!Number.isFinite(frame.metersPerUnit) || frame.metersPerUnit <= 0) throw new TypeError('Scaled focus frame needs positive metres per unit.');
  validatePosition(frame.originM, 'Scaled focus origin');
  validateOrientation(frame.localToReferenceXyzw, 'Scaled focus rotation');
  validatePosition(frame.boundsUnits.min, 'Scaled focus minimum bound');
  validatePosition(frame.boundsUnits.max, 'Scaled focus maximum bound');
  for (let axis = 0; axis < 3; axis++) if (!(frame.boundsUnits.min[axis]! < frame.boundsUnits.max[axis]!)) {
    throw new TypeError('Scaled focus bounds must have positive extent.');
  }
}

function validatePosition(position: PositionM, name: string): void {
  if (position.length !== 3 || !position.every(Number.isFinite)) throw new TypeError(`${name} must contain three finite values.`);
}
function validateOrientation(orientation: OrientationXyzw, name: string): void {
  if (orientation.length !== 4 || !orientation.every(Number.isFinite) || Math.abs(Math.hypot(...orientation) - 1) > 1e-9) {
    throw new TypeError(`${name} must be a unit quaternion.`);
  }
}
function scale(position: PositionM, factor: number): PositionM {
  return [position[0] * factor, position[1] * factor, position[2] * factor];
}
function copyPosition(position: PositionM): PositionM { return Object.freeze([position[0], position[1], position[2]]); }
function copyOrientation(orientation: OrientationXyzw): OrientationXyzw {
  return Object.freeze([orientation[0], orientation[1], orientation[2], orientation[3]]);
}
