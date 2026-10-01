import type { Axis } from './coordinates.js';

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
