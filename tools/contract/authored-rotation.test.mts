import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readAuthoredRotation } from '../objects/authored-rotation.mts';

test('source-bound linear rotation propagates signed rates and wraps phase at the authored epoch',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'source-rotation-'));
  try {
    for(const rate of [90,-90]) {
      const source={schema:'cssearth-linear-rotation@1',rightAscensionDegrees:45,declinationDegrees:30,
        referenceEpochJdTt:2451545,primeMeridianDegrees:10,spinRateDegreesPerDay:rate,source:'https://example.org/model'};
      const bytes=JSON.stringify(source);await writeFile(join(directory,'rotation.json'),bytes);
      const reference={path:'rotation.json',sha256:createHash('sha256').update(bytes).digest('hex')};
      const rotation=await readAuthoredRotation(directory,reference,2451546);
      assert.ok(Math.abs(rotation.primeMeridianRad-(rate>0?100:280)*Math.PI/180)<1e-12);
      assert.equal(rotation.poleRightAscensionRad,Math.PI/4);
      assert.equal(rotation.poleDeclinationRad,Math.PI/6);
      assert.ok(Math.abs(rotation.spinRateRadPerDay-rate*Math.PI/180)<1e-12);
      await assert.rejects(readAuthoredRotation(directory,reference,NaN),/Invalid/);
    }
  } finally {await rm(directory,{recursive:true,force:true});}
});
