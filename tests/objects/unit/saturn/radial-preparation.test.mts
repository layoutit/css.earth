import assert from 'node:assert/strict';
import test from 'node:test';
import { assertRadialPreparationParity } from '../../../../tools/objects/giant-layers/radial-parity.mts';

test('saturn source-owned radial recipes reproduce all four canonical ring lenses', async () => {
  assert.equal(await assertRadialPreparationParity('saturn'),4);
});
