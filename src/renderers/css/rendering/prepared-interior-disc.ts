import { invertPreparedAffineMatrix4, multiplyPreparedMatrix4, serializePreparedMatrix4 } from '@cssearth/core';
import type { Matrix4 } from '../solar-system/types.js';
import type { PhysicalProjection } from '../prepared-data/physical-projection.js';

/** The disc's CSS box. It is one flat colour whose edge stays inside the globe, so its box only sets the backing store a
 * browser allocates for its 3D layer: 512 px was 9.4 MB at 3x on every body page, 128 px is 0.6 MB. */
export const PREPARED_INTERIOR_DISC_SIZE = 128;

export interface PreparedInteriorDisc {
  readonly sceneFromBody: Matrix4;
  readonly radii: readonly [number, number, number];
  /** A smaller ellipsoid keeps the complete disc within the prepared mesh. */
  readonly inset: number;
}

/** A retained CSS disc in the inner ellipsoid's limb plane.
 * Every point stays inside the globe in 3D; depth sorting belongs to the scene. */
export function createPreparedInteriorDisc(plan: PreparedInteriorDisc) {
  if (plan.sceneFromBody.length !== 16 || !plan.sceneFromBody.every(Number.isFinite) ||
      [3, 7, 11].some(index => plan.sceneFromBody[index] !== 0) || plan.sceneFromBody[15] !== 1 ||
      plan.radii.length !== 3 || !plan.radii.every(radius => Number.isFinite(radius) && radius > 0) ||
      !Number.isFinite(plan.inset) || !(plan.inset > 0 && plan.inset < 1)) {
    throw new TypeError('Prepared interior disc requires an affine body frame, positive radii and an inset below one.');
  }
  const [a, b, c] = plan.radii.map(radius => radius * plan.inset);
  const sphere = multiplyPreparedMatrix4(plan.sceneFromBody, [a,0,0,0, 0,b,0,0, 0,0,c,0, 0,0,0,1]);
  return (projection: PhysicalProjection): string | null => {
    const inverse = invertPreparedAffineMatrix4(multiplyPreparedMatrix4(projection.eyeFromScene, sphere));
    const eye = [inverse[12], inverse[13], inverse[14]];
    const distance = Math.hypot(...eye);
    if (!(distance > 1)) return null;
    const n = eye.map(value => value / distance);
    const axis = Math.abs(n[0]) < .9 ? [1, 0, 0] : [0, 1, 0];
    const dot = axis[0] * n[0] + axis[1] * n[1] + axis[2] * n[2];
    const tangent = axis.map((value, index) => value - dot * n[index]);
    const length = Math.hypot(...tangent);
    const x = tangent.map(value => value / length);
    const y = [n[1]*x[2]-n[2]*x[1], n[2]*x[0]-n[0]*x[2], n[0]*x[1]-n[1]*x[0]];
    const radius = Math.sqrt(1 - 1 / distance ** 2);
    const u = x.map(value => value * radius), v = y.map(value => value * radius);
    const pixelScale = 2 / PREPARED_INTERIOR_DISC_SIZE;
    const center = n.map(value => value / distance);
    return serializePreparedMatrix4(multiplyPreparedMatrix4(sphere, [
      ...u.map(value => value * pixelScale), 0, ...v.map(value => value * pixelScale), 0, ...n, 0,
      center[0]-u[0]-v[0], center[1]-u[1]-v[1], center[2]-u[2]-v[2], 1,
    ]));
  };
}
