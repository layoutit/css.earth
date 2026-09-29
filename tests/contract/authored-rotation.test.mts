import { sourceTest } from '../objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readAuthoredRotation } from '@cssearth/bake/objects/scene';

test('source-bound linear rotation propagates signed rates and wraps phase at the authored epoch',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'source-rotation-'));
  try {
    for(const rate of [90,-90]) {
      const source={schema:'cssearth-linear-rotation@1',rightAscensionDegrees:45,declinationDegrees:30,
        referenceEpochJdTt:2451545,primeMeridianDegrees:10,spinRateDegreesPerDay:rate,source:'https://example.org/model'};
      await writeFile(join(directory,'rotation.json'),JSON.stringify(source));
      const reference={path:'rotation.json'};
      const rotation=await readAuthoredRotation(directory,reference,2451546);
      assert.ok(Math.abs(rotation.primeMeridianRad-(rate>0?100:280)*Math.PI/180)<1e-12);
      assert.equal(rotation.poleRightAscensionRad,Math.PI/4);
      assert.equal(rotation.poleDeclinationRad,Math.PI/6);
      assert.ok(Math.abs(rotation.spinRateRadPerDay-rate*Math.PI/180)<1e-12);
      await assert.rejects(readAuthoredRotation(directory,reference,NaN),/Invalid/);
    }
  } finally {await rm(directory,{recursive:true,force:true});}
});
