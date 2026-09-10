import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertObservationPreparationParity} from '../../../../tools/objects/giant-layers/observation-parity.mts';
test('authored observed maps reproduce every accepted surface, pole and thumbnail byte',async()=>{
  const result=await assertObservationPreparationParity('uranus');assert.equal(result.assets.length,15);
  const accepted=JSON.parse(await readFile(new URL('./fixtures/accepted-source-reference.json',import.meta.url),'utf8'));
  assert.deepEqual(result.maps.get('normal').coverage,accepted.coverage);
  assert.deepEqual(result.baselines.get('visible-disc').provenance,accepted.baseline);
});
