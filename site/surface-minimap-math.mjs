import { composeDragRotation } from '@cssearth/engine';
import { rotateWorldPosition, worldRotationFromQuaternion } from '../src/renderers/css/dist/navigation.js';

export const wrapMapU = u => ((u % 1) + 1) % 1;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const unit = v => { const length = Math.hypot(...v); return v.map(x => x / length); };
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function mapDirection(u, v, { prime, east, north }) {
  const longitude = u * 2 * Math.PI, latitude = (.5 - v) * Math.PI;
  return prime.map((x, i) => Math.cos(latitude) * (x * Math.cos(longitude) + east[i] * Math.sin(longitude)) + north[i] * Math.sin(latitude));
}

export function directionOnMap(direction, { prime, east, north }) {
  const d = unit(direction);
  return { u: wrapMapU(Math.atan2(dot(d, east), dot(d, prime)) / (2 * Math.PI)),
    v: .5 - Math.asin(clamp(dot(d, north), -1, 1)) / Math.PI };
}

// Camera navigation only: move the observer around the existing body and keep
// its camera axes with it, preserving distance, framing and roll.
export function orbitMapCamera(world, origin, targetDirection) {
  const relative = world.pose.positionM.map((x, i) => x - origin[i]);
  const from = unit(relative), to = unit(targetDirection);
  let rotation = [...cross(from, to), 1 + dot(from, to)];
  if (Math.hypot(...rotation) < 1e-8) {
    rotation = [...unit(cross(from, Math.abs(from[0]) < .9 ? [1, 0, 0] : [0, 1, 0])), 0];
  } else rotation = unit(rotation);
  const position = rotateWorldPosition(worldRotationFromQuaternion(rotation), relative);
  return { ...world, pose: { positionM: position.map((x, i) => x + origin[i]),
    orientationXyzw: unit(composeDragRotation(rotation, world.pose.orientationXyzw)) } };
}
