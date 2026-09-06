import assert from 'node:assert/strict';
import test from 'node:test';
import{readFile}from'node:fs/promises';
import{prepareBandedEllipsoid}from'../../../../tools/objects/giant-layers/geometry.mjs';
test('source latitude bounds reproduce every accepted body, polar and tiled ring leaf',async()=>{
 const read=async path=>JSON.parse(await readFile(new URL(`../../../../src/planets/jupiter/${path}`,import.meta.url),'utf8'));
 const result=prepareBandedEllipsoid(await read('source/preparation/geometry.json')),prepared=await read('prepared/scene.json');
 assert.equal(result.leaves.length,772);assert.equal(result.ringLeaves.length,16);assert.deepEqual(result.leaves,prepared.leaves);assert.deepEqual(result.ringLeaves,prepared.ringLeaves);
});
