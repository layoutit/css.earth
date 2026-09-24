/** Common observed area, expressed in source pixels; unrelated photo margins are not calibration evidence. */
import { applyAffine, composeAffine, invertAffine, type Affine, type Point } from './affine.ts';
export interface ReferenceFootprint { width: number; height: number; imageToFrame: Affine }
export function registrationOverlap(width: number, height: number, imageToFrame: Affine, reference?: ReferenceFootprint): Point[] {
  if (!reference) return [[0, 0], [width, 0], [width, height], [0, height]];
  const transform = composeAffine(invertAffine(imageToFrame), reference.imageToFrame);
  let points: Point[] = [[0, 0], [reference.width, 0], [reference.width, reference.height], [0, reference.height]]
    .map(point => applyAffine(transform, point as Point));
  for (const [axis, limit, sign] of [[0, 0, 1], [0, width, -1], [1, 0, 1], [1, height, -1]] as const) {
    const input = points; points = [];
    for (let i = 0; i < input.length; i++) {
      const a = input[i]!, b = input[(i + 1) % input.length]!;
      const da = (a[axis] - limit) * sign, db = (b[axis] - limit) * sign;
      if (da >= 0) points.push(a);
      if ((da < 0) !== (db < 0)) {
        const t = da / (da - db); points.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      }
    }
  }
  if (points.length < 3) throw new Error('Observation footprints do not overlap.');
  return points;
}
