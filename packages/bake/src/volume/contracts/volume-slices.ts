import type { Axis, Bounds3, DisplayColorMatrix, Vector3, VolumeRecipe } from './volume-recipe.ts';

/** Contiguous reference cells, including startCell and excluding endCell. */
export interface VolumeLayerGroup { startCell: number; endCell: number }
/** Offline thinning merges cells, never their integration samples. */
export interface VolumeLayerPlan {
  schema: 'cssearth-volume-layer-plan@1';
  referenceSliceCounts: Record<Axis, number>;
  referenceSamplesPerSlab: number;
  axes: Record<Axis, readonly VolumeLayerGroup[]>;
}
/** The integrated interval in the same physical units and frame as the quad. */
export interface VolumeSlabInterval extends VolumeLayerGroup { start: number; end: number; samples: number }
const axes = ['x', 'y', 'z'] as const;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;

export function readVolumeLayerPlan(value: unknown): VolumeLayerPlan {
  if (!record(value) || value.schema !== 'cssearth-volume-layer-plan@1' || !record(value.referenceSliceCounts) ||
      !integer(value.referenceSamplesPerSlab, 1, 1024) || !record(value.axes))
    throw new TypeError('Invalid volume layer plan reference grid.');
  const counts: Record<Axis, number> = { x: 0, y: 0, z: 0 };
  const groups: Record<Axis, VolumeLayerGroup[]> = { x: [], y: [], z: [] };
  let total = 0;
  for (const axis of axes) {
    const count = value.referenceSliceCounts[axis], input = value.axes[axis];
    if (!integer(count, 1, 512) || !Array.isArray(input) || input.length < 1 || input.length > count)
      throw new TypeError('Invalid volume layer plan axis.');
    counts[axis] = count;
    let next = 0;
    for (const group of input) {
      if (!record(group) || !integer(group.startCell, 0, count - 1) || !integer(group.endCell, 1, count) ||
          group.startCell !== next || group.endCell <= group.startCell ||
          (group.endCell - group.startCell) * value.referenceSamplesPerSlab > 4096)
        throw new TypeError('Volume layer intervals must partition reference cells and contain at most 4096 samples.');
      groups[axis].push({ startCell: group.startCell, endCell: group.endCell });
      next = group.endCell;
    }
    if (next !== count) throw new TypeError('Volume layer intervals must cover the full reference extent.');
    total += input.length;
  }
  if (total > 500) throw new TypeError('A volume layer plan must retain at most 500 layers across XYZ.');
  return { schema: value.schema, referenceSliceCounts: counts, referenceSamplesPerSlab: value.referenceSamplesPerSlab, axes: groups };
}

export function readVolumeSlabInterval(value: unknown): VolumeSlabInterval {
  if (!record(value) || typeof value.start !== 'number' || !Number.isFinite(value.start) ||
      typeof value.end !== 'number' || !Number.isFinite(value.end) || value.end <= value.start ||
      !integer(value.startCell, 0, 511) || !integer(value.endCell, 1, 512) || value.endCell <= value.startCell ||
      !integer(value.samples, 1, 4096)) throw new TypeError('Invalid physical volume slab interval.');
  return { start: value.start, end: value.end, samples: value.samples, startCell: value.startCell, endCell: value.endCell };
}

export interface VolumeSliceQuad {
  id: string; axis: Axis; sliceIndex: number; texturePath: string; widthPx: number; heightPx: number;
  /** Image top-left first: required by PolyCSS's image/projective backend. */
  vertices: [Vector3, Vector3, Vector3, Vector3];
  uvs: [[number, number], [number, number], [number, number], [number, number]];
  center: Vector3; normal: Vector3; sha256: string; bytes: number; alphaCoverage: number;
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
