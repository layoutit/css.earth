/** The preview subset of the published map-sphere dataset bank; rendering stays with consumers. */
import { requireRecord, requireArray, requireString } from '@cssearth/core';
export const MAP_SPHERE_DATASETS_SCHEMA = 'cssearth-map-sphere-datasets@2';
export function readMapSphereDatasetPreviews(value: unknown) {
  const record = requireRecord(value);
  if (record.schema !== MAP_SPHERE_DATASETS_SCHEMA) throw new TypeError('Invalid map-sphere datasets schema.');
  return { controls: requireArray(record.controls).map(value => {
    const control = requireRecord(value);
    return { id: requireString(control.id), thumbnailUrl: requireString(control.thumbnailUrl) };
  }) };
}
