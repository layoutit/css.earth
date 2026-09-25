import { walkSilhouetteLevels, type PreparedSilhouetteSteps } from '../../rendering/prepared-silhouette-steps.ts';

/** Authored rule: hold `targetPixels` of outset on each leaf edge at every silhouette size. */
export interface SeamOutsetProfile { targetPixels: number; stepRatio: number; hysteresis: number; firstDiameter: number; lastDiameter: number; }
export interface PreparedSeamOutset extends PreparedSilhouetteSteps { property: string; targetPixels: number; }
export interface PreparedLeafSeamOutset { property: string; scale: readonly [number, number]; }

export const SURFACE_SEAM_OUTSET_PROPERTY = '--surface-seam-outset';

const significant = (value: number) => Number(value.toPrecision(6));

/** Silhouette steps whose value is the outset in body diameters. Step k spans
 * [d, d × stepRatio) and holds the target at the step's geometric centre, so the
 * projected outset stays within a factor √stepRatio of `targetPixels`. */
export function prepareSeamOutsetSteps({ targetPixels, stepRatio, hysteresis, firstDiameter, lastDiameter }: SeamOutsetProfile): PreparedSeamOutset {
  if (![targetPixels, stepRatio, hysteresis, firstDiameter, lastDiameter].every(Number.isFinite) || !(targetPixels > 0) ||
    !(stepRatio > 1) || !(hysteresis >= 0 && hysteresis < 1) || !(firstDiameter > 0) || !(lastDiameter > firstDiameter)) {
    throw new TypeError('Seam outset profile is invalid.');
  }
  // Below the first threshold the outset shrinks with the body instead of growing past the target.
  const levels = [{ minimumDiameter: 0, value: String(significant(targetPixels / firstDiameter)) }];
  for (let step = 0; ; step++) {
    const minimumDiameter = significant(firstDiameter * stepRatio ** step);
    if (minimumDiameter > lastDiameter) break;
    levels.push({ minimumDiameter, value: String(significant(targetPixels / (minimumDiameter * Math.sqrt(stepRatio)))) });
  }
  return { property: SURFACE_SEAM_OUTSET_PROPERTY, targetPixels, hysteresis, levels };
}

/** Per-axis scale of one projective leaf: `1 + outset × scale` about the leaf centre moves
 * each edge by `outset` body diameters in the leaf plane, whatever the leaf's own extent. */
export function prepareLeafSeamOutset(matrixValue: string, leafWidth: number, leafHeight: number, bodyDiameter: number): PreparedLeafSeamOutset {
  const m = String(matrixValue).split(',').map(Number);
  if (m.length !== 16 || m.some(value => !Number.isFinite(value)) || !(leafWidth > 0) || !(leafHeight > 0) || !(bodyDiameter > 0)) {
    throw new TypeError('Seam outset leaf is invalid.');
  }
  const point = (x: number, y: number) => {
    const w = m[3] * x + m[7] * y + m[15];
    if (!(Math.abs(w) > 1e-12)) throw new TypeError('Seam outset leaf leaves the projective plane.');
    return [(m[0] * x + m[4] * y + m[12]) / w, (m[1] * x + m[5] * y + m[13]) / w, (m[2] * x + m[6] * y + m[14]) / w];
  };
  const span = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const across = span(point(0, leafHeight / 2), point(leafWidth, leafHeight / 2));
  const down = span(point(leafWidth / 2, 0), point(leafWidth / 2, leafHeight));
  if (!(across > 0) || !(down > 0)) throw new TypeError('Seam outset leaf is degenerate.');
  return { property: SURFACE_SEAM_OUTSET_PROPERTY, scale: [significant(2 * bodyDiameter / across), significant(2 * bodyDiameter / down)] };
}

/** The value that stands on the body before the camera publishes a silhouette. */
export function seamOutsetInitialValue(outset: PreparedSeamOutset, diameter: number): string {
  return outset.levels[walkSilhouetteLevels(outset.levels, outset.hysteresis, diameter)].value;
}

/** The view binding that publishes the step for the current silhouette on a node above every outset leaf. */
export function seamOutsetBinding({ property, hysteresis, levels }: PreparedSeamOutset, target: number) {
  return { kind: 'silhouette-step-property' as const, target, property, hysteresis, levels };
}
