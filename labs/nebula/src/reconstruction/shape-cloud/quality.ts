import type { ShapeCloudQuality } from './types.js';

/** Quality changes sampling only; both passes evaluate the same physical field and exposure. */
export function readShapeCloudQuality(value: unknown): ShapeCloudQuality {
  if (value === undefined) return 'detailed'; // Previously saved previews have detailed sampling.
  if (value !== 'draft' && value !== 'detailed') throw new TypeError('Unknown shape-cloud preview quality.');
  return value;
}
export function shapeCloudSampling(quality: ShapeCloudQuality) {
  return quality === 'draft' ? { width: 96, slabs: 12, samples: 2 } : { width: 192, slabs: 24, samples: 4 };
}
