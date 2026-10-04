import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAP_SPHERE_DATASETS_SCHEMA, readMapSphereDatasetPreviews } from './map-sphere-datasets.js';
test('map sphere preview admission retains its historical id and rejects malformed fields', () => {
  assert.equal(MAP_SPHERE_DATASETS_SCHEMA, 'cssearth-map-sphere-datasets@2');
  const value = { schema: 'cssearth-map-sphere-datasets@2', controls: [{ id: 'full', thumbnailUrl: 'full.webp' }] };
  assert.deepEqual(readMapSphereDatasetPreviews(value), { controls: value.controls });
  assert.throws(() => readMapSphereDatasetPreviews({ ...value, schema: 'wrong' }));
  assert.throws(() => readMapSphereDatasetPreviews({ ...value, controls: [{ id: 'full', thumbnailUrl: 1 }] }));
});
