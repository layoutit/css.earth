import type { DensityVolumeFrame } from '../contracts/volume-frame.ts';
import type { Bounds3, Vector3 } from '../contracts/volume-recipe.ts';
import type { EmissionBounds, EmissionVector3 } from '../contracts/emission.ts';
import { COMPILER_LONGEST_AXIS_SLICES } from '../contracts/compiler-bake.ts';
import { validateVolumeLayerSlices, type VolumeSlices } from '../contracts/volume-slices.ts';

/** Angular source axes west/north/away are left-handed. Prepared physical axes are west/north/toward. */
export const COMPILER_PHYSICAL_REFERENCE = 'lab-sky-west-north-toward';
export const compilerPreparedPoint = (point: readonly number[]): Vector3 => [point[0]!, point[1]!, -point[2]!];
export function compilerPreparedSlices(source: VolumeSlices): VolumeSlices {
  const plan = validateVolumeLayerSlices(source);
  const reflectGroup = (group: { startCell: number; endCell: number }) => ({
    startCell: plan!.referenceSliceCounts.z - group.endCell, endCell: plan!.referenceSliceCounts.z - group.startCell });
  return { ...source, boundsUnits: { min: [source.boundsUnits.min[0], source.boundsUnits.min[1], -source.boundsUnits.max[2]],
    max: [source.boundsUnits.max[0], source.boundsUnits.max[1], -source.boundsUnits.min[2]] },
    ...(plan ? { approximation: { ...source.approximation, layerPlan: { ...plan,
      axes: { ...plan.axes, z: [...plan.axes.z].reverse().map(reflectGroup) } } } } : {}),
    quads: source.quads.map(quad => ({ ...quad, center: compilerPreparedPoint(quad.center),
      ...(plan && quad.axis === 'z' ? { sliceIndex: plan.axes.z.length - 1 - quad.sliceIndex,
        slab: { ...quad.slab!, ...reflectGroup(quad.slab!), start: -quad.slab!.end, end: -quad.slab!.start } } : {}),
      normal: compilerPreparedPoint(quad.normal), vertices: quad.vertices.map(compilerPreparedPoint) as typeof quad.vertices })) };
}

export function validCompilerBounds(bounds: EmissionBounds): boolean {
  return Array.isArray(bounds?.min) && Array.isArray(bounds?.max) && bounds.min.length === 3 && bounds.max.length === 3 &&
    bounds.min.every((n, i) => Number.isFinite(n) && Number.isFinite(bounds.max[i]) && n < bounds.max[i]!);
}

export function compilerFrame(bounds: EmissionBounds, preparedPhysical = false): { origin: EmissionVector3; localBounds: Bounds3; frame: DensityVolumeFrame } {
  if (!validCompilerBounds(bounds)) throw new TypeError('Compiler frame requires finite increasing west/north/away bounds.');
  const origin = bounds.min.map((n, i) => (n + bounds.max[i]!) / 2) as EmissionVector3;
  const localBounds: Bounds3 = { min: bounds.min.map((n, i) => n - origin[i]!) as Vector3,
    max: bounds.max.map((n, i) => n - origin[i]!) as Vector3 };
  return { origin, localBounds, frame: { referenceFrame: preparedPhysical ? COMPILER_PHYSICAL_REFERENCE : 'lab-sky-angular', epochJdTt: 2451545,
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
