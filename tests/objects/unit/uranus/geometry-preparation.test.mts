import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareBandedEllipsoid,prepareFixedSpanMaterialPlane} from '../../../../tools/objects/giant-layers/geometry.mts';
test('authored ellipsoid geometry reproduces accepted retained leaves and radial planes',async()=>{
  const json=async (path: string)=>JSON.parse(await readFile(new URL(`../../../../src/objects/uranus/${path}`,import.meta.url),'utf8'));
  const config=await json('source/preparation/geometry.json'),actual=prepareBandedEllipsoid(config),accepted=await json('prepared/scene.json');
  assert.ok("bodyBands" in actual); assert.deepEqual(actual.bodyBands,accepted.bodyBands);assert.deepEqual(actual.planes,accepted.planes);
  const defaultPitch=34.230769230769226,quantizedControlPitch=Math.round(defaultPitch*100)/100;
  const scenePitch=Number((65*(1-quantizedControlPitch/89)).toFixed(4));
  const leaf=prepareFixedSpanMaterialPlane(config.materialPlane,scenePitch);assert.match(leaf.style,/matrix3d\(/u);assert.equal(leaf.leafWidth,256);assert.equal(leaf.leafHeight,256);
});
