import type { DensityVolumeFrame } from '../contracts/volume-frame.ts';
import type { Bounds3, Vector3 } from '../contracts/volume-recipe.ts';
import type { EmissionBounds, EmissionVector3 } from '../contracts/emission.ts';
import { COMPILER_LONGEST_AXIS_SLICES } from '../contracts/compiler-bake.ts';

export function validCompilerBounds(bounds: EmissionBounds): boolean {
  return Array.isArray(bounds?.min) && Array.isArray(bounds?.max) && bounds.min.length === 3 && bounds.max.length === 3 &&
    bounds.min.every((n, i) => Number.isFinite(n) && Number.isFinite(bounds.max[i]) && n < bounds.max[i]!);
}

export function compilerFrame(bounds: EmissionBounds): { origin: EmissionVector3; localBounds: Bounds3; frame: DensityVolumeFrame } {
  if (!validCompilerBounds(bounds)) throw new TypeError('Compiler frame requires finite increasing west/north/away bounds.');
  const origin = bounds.min.map((n, i) => (n + bounds.max[i]!) / 2) as EmissionVector3;
  const localBounds: Bounds3 = { min: bounds.min.map((n, i) => n - origin[i]!) as Vector3,
    max: bounds.max.map((n, i) => n - origin[i]!) as Vector3 };
  return { origin, localBounds, frame: { referenceFrame: 'lab-sky-angular', epochJdTt: 2451545,
    originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1, boundsUnits: localBounds } };
}

/** Preserve one physical pitch across banks, with a bounded fine bank for thin structures. */
export function compilerSliceCounts(bounds: EmissionBounds, minimumFeatureScaleArcsec?: number) {
  if (!validCompilerBounds(bounds) || minimumFeatureScaleArcsec !== undefined && (!Number.isFinite(minimumFeatureScaleArcsec) || minimumFeatureScaleArcsec <= 0))
    throw new TypeError('Invalid compiler sampling extent or feature scale.');
  const spans = bounds.max.map((n, i) => n - bounds.min[i]!), longest = Math.max(...spans);
  const pitch = minimumFeatureScaleArcsec === undefined ? longest / 192 :
    Math.max(longest / COMPILER_LONGEST_AXIS_SLICES, Math.min(longest / 192, minimumFeatureScaleArcsec / 2));
  const count = (span: number) => Math.min(COMPILER_LONGEST_AXIS_SLICES, Math.max(1, Math.ceil(span / pitch)));
  return { x: count(spans[0]!), y: count(spans[1]!), z: count(spans[2]!) };
}
