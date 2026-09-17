import {test} from 'node:test';
import assert from 'node:assert/strict';
import {unpackPoints,samplePoints,ellipsoidPoints} from './forward-fit-data.ts';
test('source unpacking retains physical weights and rejects malformed points',()=>{
 const bytes=Buffer.alloc(32);[1,2,3,7,4,5,6,11].forEach((v,i)=>bytes.writeFloatLE(v,i*4));
 const p=unpackPoints(bytes);assert.deepEqual(p,[{x:1,y:2,z:3,weight:7},{x:4,y:5,z:6,weight:11}]);
 assert.throws(()=>unpackPoints(bytes.subarray(0,31)));bytes.writeFloatLE(NaN,0);assert.throws(()=>unpackPoints(bytes));
});
test('comparison hypothesis and bounded sampling are deterministic and independent of observations',()=>{
 const p=ellipsoidPoints(64,19471,2);assert.deepEqual(p,ellipsoidPoints(64,19471,2));
 assert.notDeepEqual(p,ellipsoidPoints(64,19472,2));assert.equal(samplePoints(p,12).length,12);
 assert.equal(samplePoints(p,100).length,64);assert.ok(p.some(v=>v.x<0)&&p.some(v=>v.x>0));
 assert.throws(()=>ellipsoidPoints(10,1,0));assert.throws(()=>samplePoints(p,0));
});
