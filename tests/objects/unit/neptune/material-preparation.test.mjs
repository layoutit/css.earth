import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertMaterialPreparationParity} from '../../../../tools/objects/giant-layers/material-parity.mjs';
test('source-derived oblate material preparation reproduces all accepted fixed and orbit products',async()=>{
  const result=await assertMaterialPreparationParity('neptune');assert.equal(result.assets.length,54);
  const accepted=JSON.parse(await readFile(new URL('./fixtures/accepted-source-reference.json',import.meta.url),'utf8'));
  for(const [id,lens]of Object.entries(accepted.lenses)){assert.deepEqual(result.lenses[id].fixed[1].leaf,lens.materialLeaf);assert.deepEqual(result.lenses[id].bank.presentations,lens.presentations);}
});
