import type { Matrix } from '../observations/models/model';

/** Orthographic projection of the source's z=0 plane through shapeCloudCamera, about the source-image center. */
export function shapeCloudPhotoPose(width: number, height: number, yawDegrees: number, pitchDegrees: number): Matrix {
  if (![width, height].every(value => Number.isFinite(value) && value > 0) || ![yawDegrees, pitchDegrees].every(Number.isFinite))
    throw new TypeError('Photo projection requires finite pose and positive dimensions.');
  const yaw = yawDegrees * Math.PI / 180, pitch = pitchDegrees * Math.PI / 180;
  const a = Math.cos(yaw), b = Math.sin(pitch) * Math.sin(yaw), d = Math.cos(pitch);
  return [a, b, 0, d, width / 2 * (1 - a), height / 2 * (1 - d) - b * width / 2];
}
export interface ImageAxis { id: 'x' | 'y' | 'earth'; label: string; color: string; screen: [number, number]; towardEye: number }
/** Image X is physical +X, Image Y is physical −Y, and toward Earth is prepared physical +Z. */
export function shapeCloudImageAxes(yawDegrees: number, pitchDegrees: number, registration: Matrix): ImageAxis[] {
  const yaw = yawDegrees * Math.PI / 180, pitch = pitchDegrees * Math.PI / 180;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch);
  const scale = Math.sqrt(Math.abs(registration[0] * registration[3] - registration[1] * registration[2]));
  if (!Number.isFinite(scale) || scale <= 0 || ![yawDegrees, pitchDegrees].every(Number.isFinite)) throw new TypeError('Invalid orientation triad frame.');
  const project = (x: number, y: number): [number, number] => [(registration[0] * x + registration[2] * y) / scale, (registration[1] * x + registration[3] * y) / scale];
  return [
    { id: 'x', label: 'Image X', color: '#e4aaa4', screen: project(cy, sx * sy), towardEye: -cx * sy },
    { id: 'y', label: 'Image Y', color: '#a9cdb3', screen: project(0, cx), towardEye: sx },
    { id: 'earth', label: 'Toward Earth', color: '#a8bfdc', screen: project(sy, -sx * cy), towardEye: cx * cy },
  ];
}
