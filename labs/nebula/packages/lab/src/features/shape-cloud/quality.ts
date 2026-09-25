import type { ShapeCloudQuality } from './types.ts';
import type { Bounds3 } from '@cssearth/bake/volume';
export const SHAPE_CLOUD_PREPARATION_VERSION = 'ring-sectors@2';

/** Quality changes sampling only; both passes evaluate the same physical field and exposure. */
export function readShapeCloudQuality(value: unknown): ShapeCloudQuality {
  if (value === undefined) return 'detailed'; // Previously saved previews have detailed sampling.
  if (value !== 'draft' && value !== 'detailed') throw new TypeError('Unknown shape-cloud preview quality.');
  return value;
}
export function shapeCloudSampling(quality: ShapeCloudQuality, bounds: Bounds3) {
  const spans = bounds.max.map((value, axis) => value - bounds.min[axis]!);
  if (!spans.every(value => Number.isFinite(value) && value > 0)) throw new TypeError('Shape cloud sampling requires finite positive bounds.');
  const longestCount = quality === 'draft' ? 24 : 128, pitch = Math.max(...spans) / longestCount;
  const counts = spans.map(span => Math.max(4, Math.ceil(span / pitch)));
  return { width: quality === 'draft' ? 96 : 384, samples: quality === 'draft' ? 2 : 4,
    slices: { x: counts[0]!, y: counts[1]!, z: counts[2]! }, targetPitchUnits: pitch };
}
