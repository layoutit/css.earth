import type { Point3 } from './types.js';

/** Published hierarchy precision, in parsecs and magnitudes. Source rows stay exact.
 * Native pow/log/hypot can differ by an ulp across CPUs; their full binary64
 * tails are not meaningful precision for aggregates of float32 astrometry.
 */
export function hierarchyPosition(position: Point3): Point3 {
  const coordinate = (value: number) => Number(value.toFixed(10));
  return [coordinate(position[0]), coordinate(position[1]), coordinate(position[2])];
}
export function hierarchyMagnitude(value: number): number {
  // ≤0.5e-12 mag rounding keeps relative luminosity error below 4.7e-13.
  return Number(value.toFixed(12));
}
export function hierarchyRadius(radius: number): number {
  if (radius === 0) return 0;
  // Recompute from the published centre first. Adding one quantum after nearest
  // rounding encloses the original bound, including values on a decimal boundary.
  return Number((Number(radius.toFixed(10)) + 1e-10).toFixed(10));
}
