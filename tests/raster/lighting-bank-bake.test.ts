import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { LIGHTING_BANKS, checkLightingBank } from '@cssearth/bake/raster';

const root = resolve(import.meta.dirname, '../..');

test('every tracked lighting bank is the bytes its recipe encodes today', async () => {
  for (const id of Object.keys(LIGHTING_BANKS)) {
    const result = await checkLightingBank(id, root);
    // 32 rows, the billboard and the two shadowless frames.
    assert.deepEqual(result, { files: 35, differing: [] }, id);
  }
});
