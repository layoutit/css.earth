import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertObservationPreparationParity} from '../../../../tools/objects/giant-layers/observation-parity.mjs';
test('authored observed maps reproduce every accepted surface, pole and thumbnail byte',async()=>{
  const result=await assertObservationPreparationParity('neptune');assert.equal(result.assets.length,12);
  const accepted=JSON.parse(await readFile(new URL('./fixtures/accepted-source-reference.json',import.meta.url),'utf8'));
  for(const [id,lens]of Object.entries(accepted.lenses)){const map=result.maps.get(id);assert.deepEqual(map.atmosphereColor,lens.atmosphereColor);if(map.calibration)assert.deepEqual(map.calibration,lens.calibration);}
});
