import type { DisplayColorMatrix, VolumeRecipe } from './volume-recipe.ts';
import { type Axis, type Bounds3, type Vector3, readVolumeLayerPlan, readVolumeSlabInterval, type VolumeLayerGroup, type VolumeLayerPlan, type VolumeSlabInterval } from '@cssearth/objects';

const axes = ['x', 'y', 'z'] as const;

export interface VolumeSliceQuad {
  id: string; axis: Axis; sliceIndex: number; texturePath: string; widthPx: number; heightPx: number;
  /** Image top-left first: required by PolyCSS's image/projective backend. */
  vertices: [Vector3, Vector3, Vector3, Vector3];
  uvs: [[number, number], [number, number], [number, number], [number, number]];
  center: Vector3; normal: Vector3; bytes: number; alphaCoverage: number;
  slab?: VolumeSlabInterval;
}
export interface VolumeSlices {
  quads: VolumeSliceQuad[]; boundsUnits: Bounds3; provenance: unknown;
  approximation: { method: string; radialEmission: string; limitations: string[];
    samplesPerSlab: number; opticalWeight: number; exposureGain: number;
    displayColorMatrix?: DisplayColorMatrix; emissionTransfer?: VolumeRecipe['material']['emissionTransfer'];
    sliceCounts: Record<Axis, number>; slabPitchUnits: Record<Axis, number>;
    /** When present, pitch is only the mean; quad.slab defines the actual integration interval. */
    layerPlan?: VolumeLayerPlan };
}

/** Validate a retained plan against its physical quads before material replay. */
export function validateVolumeLayerSlices(slices: VolumeSlices): VolumeLayerPlan | undefined {
  if (slices.approximation.layerPlan === undefined) {
    if (slices.quads.some(q => q.slab !== undefined)) throw new TypeError('Physical slab intervals require a retained volume layer plan.');
    return undefined;
  }
  const plan = readVolumeLayerPlan(slices.approximation.layerPlan);
  if (slices.approximation.samplesPerSlab !== plan.referenceSamplesPerSlab ||
      slices.quads.length !== axes.reduce((n, axis) => n + plan.axes[axis].length, 0))
    throw new TypeError('Volume layer sampling differs from its retained plan.');
  for (const [axial, axis] of axes.entries()) {
    const min = slices.boundsUnits.min[axial]!, max = slices.boundsUnits.max[axial]!;
    if (!Number.isFinite(min) || !Number.isFinite(max) || !(max > min)) throw new TypeError('Invalid volume layer bounds.');
    const pitch = (max - min) / plan.referenceSliceCounts[axis], groups = plan.axes[axis];
    const quads = slices.quads.filter(q => q.axis === axis);
    if (slices.approximation.sliceCounts[axis] !== groups.length || quads.length !== groups.length ||
        new Set(quads.map(q => q.sliceIndex)).size !== groups.length)
      throw new TypeError('Volume layer axis counts differ from the retained plan.');
    const close = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) &&
      Math.abs(a - b) <= 1e-10 * Math.max(1, Math.abs(min), Math.abs(max));
    for (const q of quads) {
      const group = groups[q.sliceIndex], slab = readVolumeSlabInterval(q.slab);
      if (!group || slab.startCell !== group.startCell || slab.endCell !== group.endCell ||
          slab.samples !== (group.endCell - group.startCell) * plan.referenceSamplesPerSlab ||
          !close(slab.start, min + group.startCell * pitch) || !close(slab.end, min + group.endCell * pitch) ||
          !close(q.center[axial]!, (slab.start + slab.end) / 2) ||
          q.vertices.some(p => !close(p[axial]!, q.center[axial]!)))
        throw new TypeError('Physical slab interval, plane or samples differ from the retained volume layer plan.');
    }
  }
  return plan;
}
