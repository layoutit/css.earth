import assert from 'node:assert/strict';
import test from 'node:test';
import { assertRadialPreparationParity } from '../../../../tools/objects/giant-layers/radial-parity.mts';

test('neptune source-owned radial recipes reproduce every accepted ring lens and density', async () => {
  assert.equal(await assertRadialPreparationParity('neptune'),2);
});
