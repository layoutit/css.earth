import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { checkLightingBank } from './prepare-lighting-bank.js';
import { LIGHTING_BANKS } from '../../src/preparation/raster/lighting-banks.js';

const root = resolve(import.meta.dirname, '../..');

test('every tracked lighting bank is the bytes its recipe encodes today', async () => {
  for (const id of Object.keys(LIGHTING_BANKS)) {
    const result = await checkLightingBank(id, root);
    assert.deepEqual(result, { files: 33, differing: [] }, id);
  }
});
