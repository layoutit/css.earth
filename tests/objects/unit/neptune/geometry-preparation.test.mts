import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareBandedEllipsoid} from '../../../../tools/objects/giant-layers/geometry.mts';
test('authored ellipsoid geometry reproduces accepted retained leaves and ring plane',async()=>{
  const json=async (path: string)=>JSON.parse(await readFile(new URL(`../../../../src/objects/neptune/${path}`,import.meta.url),'utf8'));
  const actual=prepareBandedEllipsoid(await json('source/preparation/geometry.json')),accepted=await json('prepared/scene.json');
  assert.ok("bodyBands" in actual && "planes" in actual);assert.deepEqual(actual.bodyBands,accepted.bodyBands);assert.deepEqual(actual.planes,accepted.planes);
});
