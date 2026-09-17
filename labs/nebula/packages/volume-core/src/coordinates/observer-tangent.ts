/**
 * Observer-ray adapter between physical kpc and the compiler's angular tangent frame.
 *
 * Relocated from the lab so bake-time replay shares one coordinate convention. The arithmetic and the
 * perspective sign conventions are unchanged.
 */
import type { EmissionBounds, EmissionVector3 } from '../contracts/emission.ts';
export const ARCSECONDS_PER_RADIAN = 180 * 3600 / Math.PI;
export function angularScale(distanceKpc: number): number {
  if (!Number.isFinite(distanceKpc) || distanceKpc <= 0) throw new TypeError('Observer distance must be positive kpc.');
  return ARCSECONDS_PER_RADIAN / distanceKpc;
}
function finitePoint(point: readonly number[]): void {
  if (point.length !== 3 || point.some(value => !Number.isFinite(value))) throw new TypeError('Expected a finite XYZ point.');
}
export function physicalToField(point: readonly number[], distanceKpc: number): EmissionVector3 {
  finitePoint(point);
  const scale = angularScale(distanceKpc), denominator = distanceKpc + point[2]!;
  if (denominator <= 0) throw new TypeError('Emission must remain in front of the observer.');
  return [point[0]! * distanceKpc / denominator * scale, point[1]! * distanceKpc / denominator * scale, point[2]! * scale];
}
export function fieldToPhysical(point: readonly number[], distanceKpc: number): EmissionVector3 {
  finitePoint(point);
  const scale = angularScale(distanceKpc), z = point[2]! / scale;
  if (distanceKpc + z <= 0) throw new TypeError('Emission must remain in front of the observer.');
  const perspective = (distanceKpc + z) / distanceKpc;
  return [point[0]! / scale * perspective, point[1]! / scale * perspective, z];
}
/** The bilinear x/z and y/z mappings reach their extrema at box corners. */
export function physicalBounds(bounds: EmissionBounds, distanceKpc: number): EmissionBounds {
  finitePoint(bounds.min); finitePoint(bounds.max);
  if (bounds.min.some((value, axis) => value >= bounds.max[axis]!)) throw new TypeError('Expected increasing field bounds.');
  const min: EmissionVector3 = [Infinity, Infinity, Infinity], max: EmissionVector3 = [-Infinity, -Infinity, -Infinity];
  for (const x of [bounds.min[0], bounds.max[0]]) for (const y of [bounds.min[1], bounds.max[1]]) for (const z of [bounds.min[2], bounds.max[2]]) {
    const point = fieldToPhysical([x, y, z], distanceKpc);
    for (let axis = 0; axis < 3; axis++) { min[axis] = Math.min(min[axis]!, point[axis]!); max[axis] = Math.max(max[axis]!, point[axis]!); }
  }
  return { min, max };
}
