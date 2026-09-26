import { cross3 as cross, dot3 as dot } from '@cssearth/core';
import { composeDragRotation } from '@cssearth/engine';
import type { OrientationXyzw, PositionM } from '@cssearth/engine';
import { rotateWorldPosition, worldRotationFromQuaternion } from '../navigation/world-camera-math.js';
import type { WorldCameraPose } from '../navigation/world-camera.js';
import type { ObjectWorldNavigation } from '../runtime/world-navigation-types.js';

const unit = (v: PositionM): PositionM => { const length = Math.hypot(...v); return [v[0] / length, v[1] / length, v[2] / length]; };
const unitQuaternion = (q: readonly number[]): OrientationXyzw => { const length = Math.hypot(...q); return [q[0]! / length, q[1]! / length, q[2]! / length, q[3]! / length]; };

/** The rotation that carries the observer from above one surface direction to above another,
 * the same navigation the shell minimap applies: distance, framing and roll are preserved. */
export function surfaceOrbitRotation(world: WorldCameraPose, originM: PositionM, targetDirection: PositionM): OrientationXyzw {
  const eye = world.pose.positionM;
  const from = unit([eye[0] - originM[0], eye[1] - originM[1], eye[2] - originM[2]]), to = unit(targetDirection);
  const rotation = [...cross(from, to), 1 + dot(from, to)];
  if (Math.hypot(...rotation) < 1e-8) return [...unit(cross(from, Math.abs(from[0]) < .9 ? [1, 0, 0] : [0, 1, 0])), 0];
  return unitQuaternion(rotation);
}

/** Pose after applying a fraction of the orbit rotation and a new eye distance. */
export function surfaceOrbitPose(world: WorldCameraPose, originM: PositionM, rotation: OrientationXyzw, share: number, distanceM: number): WorldCameraPose {
  const [x, y, z, w] = rotation, angle = 2 * Math.acos(Math.max(-1, Math.min(1, w)));
  const axisLength = Math.hypot(x, y, z);
  const partial: OrientationXyzw = axisLength < 1e-12 ? [0, 0, 0, 1]
    : [x / axisLength * Math.sin(share * angle / 2), y / axisLength * Math.sin(share * angle / 2), z / axisLength * Math.sin(share * angle / 2), Math.cos(share * angle / 2)];
  const eye = world.pose.positionM;
  const relative = unit([eye[0] - originM[0], eye[1] - originM[1], eye[2] - originM[2]]);
  const direction = rotateWorldPosition(worldRotationFromQuaternion(partial), relative);
  return { ...world, pose: {
    positionM: [originM[0] + direction[0] * distanceM, originM[1] + direction[1] * distanceM, originM[2] + direction[2] * distanceM],
    orientationXyzw: unitQuaternion(composeDragRotation(partial, world.pose.orientationXyzw)) } };
}

export interface SurfaceFlightOptions {
  readonly directionWorld: PositionM; readonly distanceM: number;
  readonly durationMilliseconds?: number; readonly reducedMotion?: boolean; readonly signal?: AbortSignal;
  readonly windowTarget: Pick<Window, 'requestAnimationFrame' | 'cancelAnimationFrame'> & { performance: { now(): number } };
}
export interface SurfaceFlightHandle { readonly done: Promise<{ completed: boolean }>; cancel(): void; }

/** Animate the world camera onto a surface direction. Any other camera write (a drag, a wheel
 * dolly, a restored view) ends the flight where it is; the observer is never fought for. */
export function flyToSurfaceDirection(navigation: ObjectWorldNavigation, { directionWorld, distanceM, durationMilliseconds = 900, reducedMotion = false, signal, windowTarget }: SurfaceFlightOptions): SurfaceFlightHandle {
  if (signal?.aborted) return { done: Promise.resolve({ completed: false }), cancel() {} };
  const origin = navigation.frame.originM;
  const start = navigation.capture();
  const rotation = surfaceOrbitRotation(start, origin, directionWorld);
  const startDistance = Math.hypot(start.pose.positionM[0] - origin[0], start.pose.positionM[1] - origin[1], start.pose.positionM[2] - origin[2]);
  const duration = reducedMotion ? 0 : Math.max(0, durationMilliseconds);
  const ease = (t: number) => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  const flight = navigation.motion.fly({ windowTarget, signal, durationMilliseconds: duration, sample(progress, signal) {
    const share = ease(progress);
    const pose = surfaceOrbitPose(start, origin, rotation, share, startDistance + (distanceM - startDistance) * share);
    return navigation.apply(pose, { signal });
  } });
  return { done: flight.finished, cancel: flight.cancel };
}
