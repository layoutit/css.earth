import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertMaterialPreparationParity} from '../../../../tools/objects/giant-layers/material-parity.mts';
test('source-derived oblate material preparation reproduces all accepted fixed and orbit products',async()=>{
  const result=await assertMaterialPreparationParity('uranus');assert.equal(result.assets.length,60);
  const accepted=JSON.parse(await readFile(new URL('./fixtures/accepted-source-reference.json',import.meta.url),'utf8'));
  for(const [id,lens]of Object.entries(accepted.lenses))for(const field of['frameRawSha256','frameForegroundRingTexelCounts','frameRingShadowTexelCounts'])assert.deepEqual(result.lenses[id].bank[field],lens[field],`${id} source frame ${field}`);
});
