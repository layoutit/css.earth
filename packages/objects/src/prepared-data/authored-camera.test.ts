import assert from 'node:assert/strict';
import test from 'node:test';
import { parse } from '@cssearth/core/schema';
import { cameraFields } from './authored-camera.js';

test('paged and terrestrial writers admit only the shared silhouette LOD model', () => {
  const value = { model: 'silhouette-diameter-crossfade', billboardFadeStartDiscPixels: 100, billboardFullDiscPixels: 80, markerFadeStartDiscPixels: 60, markerFullDiscPixels: 40 };
  assert.deepEqual(parse(value, cameraFields.levelOfDetail), value);
  assert.throws(() => parse({ ...value, model: 'other' }, cameraFields.levelOfDetail));
});
