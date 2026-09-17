import { invertPreparedAffineMatrix4 } from '../solar-system/prepared-ellipsoid-projection.js';
import type { Matrix4 } from '../solar-system/types.js';
import type { PhysicalProjection } from './physical-projection.js';
import { sceneEye } from './prepared-facing.js';

export interface PreparedInteriorSlices {
  readonly sceneFromBody: Matrix4;
  /** Prepared slices of an irregular body's own mesh; each lists its retained leaves. */
  readonly slices: readonly { readonly normal: readonly [number, number, number]; readonly nodes: readonly number[] }[];
}

/** The slice whose normal is nearest the direction from the body origin to the eye; -1 without a view. No geometry is derived here. */
export function createPreparedInteriorSliceSelection(plan: PreparedInteriorSlices) {
  if (plan.sceneFromBody.length !== 16 || !plan.sceneFromBody.every(Number.isFinite) || [3, 7, 11].some(index => plan.sceneFromBody[index] !== 0) ||
      plan.sceneFromBody[15] !== 1 || !plan.slices.length || plan.slices.some(slice => slice.normal.length !== 3 || Math.abs(Math.hypot(...slice.normal) - 1) > 1e-6 || !slice.nodes.length)) {
    throw new TypeError('Prepared interior slices require an affine body frame and unit slice normals.');
  }
  const bodyFromScene = invertPreparedAffineMatrix4(plan.sceneFromBody);
  return (projection: PhysicalProjection | undefined): number => {
    const eye = projection ? sceneEye(projection) : null;
    if (!eye) return -1;
    const local = [0, 1, 2].map(i => bodyFromScene[i] * eye[0] + bodyFromScene[4 + i] * eye[1] + bodyFromScene[8 + i] * eye[2] + bodyFromScene[12 + i]);
    let best = -1, bestAlignment = -1;
    plan.slices.forEach((slice, index) => {
      const alignment = Math.abs(slice.normal[0] * local[0] + slice.normal[1] * local[1] + slice.normal[2] * local[2]);
      if (alignment > bestAlignment) { bestAlignment = alignment; best = index; }
    });
    return best;
  };
}
