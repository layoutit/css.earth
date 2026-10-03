import assert from 'node:assert/strict';
import test from 'node:test';
import { WISE_BAND_NAMES } from '@cssearth/objects';
import { WISE_ATLAS_BANDS } from './wise-atlas-mosaic.ts';
test('WISE atlas metadata covers exactly the shared format bands', () => {
  assert.deepEqual(Object.keys(WISE_ATLAS_BANDS), [...WISE_BAND_NAMES]);
});
