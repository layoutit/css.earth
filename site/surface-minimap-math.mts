import { cross3 as cross } from '../src/platform/vector3.mts';
import { composeDragRotation } from '@cssearth/engine';
import type { PositionM, OrientationXyzw } from '@cssearth/engine';
import type { WorldCameraPose } from '../src/renderers/css/navigation/world-camera.js';
import { rotateWorldPosition, worldRotationFromQuaternion } from '../src/renderers/css/dist/navigation.js';
import { dotN as dot } from '../src/platform/vector3.mts';
import { clamp } from '../src/platform/math/scalar.mts';

export interface SurfaceAxes { prime: PositionM; east: PositionM; north: PositionM; }
export const wrapMapU = (u: number) => ((u % 1) + 1) % 1;
const unit = (v: PositionM): PositionM => { const length = Math.hypot(...v); return [v[0] / length, v[1] / length, v[2] / length]; };
const unitRotation = (v: readonly number[]): OrientationXyzw => { const length = Math.hypot(...v); return [v[0] / length, v[1] / length, v[2] / length, v[3] / length]; };


export function mapDirection(u: number, v: number, { prime, east, north }: SurfaceAxes): PositionM {
  const longitude = u * 2 * Math.PI, latitude = (.5 - v) * Math.PI;
  const component = (i: number) => Math.cos(latitude) * (prime[i] * Math.cos(longitude) + east[i] * Math.sin(longitude)) + north[i] * Math.sin(latitude);
  return [component(0), component(1), component(2)];
}

export function directionOnMap(direction: PositionM, { prime, east, north }: SurfaceAxes) {
  const d = unit(direction);
  return { u: wrapMapU(Math.atan2(dot(d, east), dot(d, prime)) / (2 * Math.PI)),
    v: .5 - Math.asin(clamp(dot(d, north), -1, 1)) / Math.PI };
}

// Camera navigation only: move the observer around the existing body and keep
// its camera axes with it, preserving distance, framing and roll.
export function orbitMapCamera(world: WorldCameraPose, origin: PositionM, targetDirection: PositionM): WorldCameraPose {
  const eye = world.pose.positionM;
  const relative: PositionM = [eye[0] - origin[0], eye[1] - origin[1], eye[2] - origin[2]];
  const from = unit(relative), to = unit(targetDirection);
  let rotation: OrientationXyzw = [...cross(from, to), 1 + dot(from, to)];
  if (Math.hypot(...rotation) < 1e-8) {
    rotation = [...unit(cross(from, Math.abs(from[0]) < .9 ? [1, 0, 0] : [0, 1, 0])), 0];
  } else rotation = unitRotation(rotation);
  const position = rotateWorldPosition(worldRotationFromQuaternion(rotation), relative);
  return { ...world, pose: { positionM: [position[0] + origin[0], position[1] + origin[1], position[2] + origin[2]],
    orientationXyzw: unitRotation(composeDragRotation(rotation, world.pose.orientationXyzw)) } };
}
