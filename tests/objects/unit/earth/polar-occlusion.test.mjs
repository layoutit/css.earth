import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareOpaquePolarDiscs} from '../../../../tools/objects/geographic-pages/opaque-polar-discs.mjs';
import {canonicalPreparedAsset} from '../../../../src/platform/prepared-object-assets.mjs';

test('Earth base-page occlusion reproduces from the canonical retained polar source and stays out of observations',async()=>{
  const root=new URL('../../../../',import.meta.url);
  const read=async name=>JSON.parse(await readFile(new URL(`src/planets/earth/prepared/${name}.json`,root)));
  const [scene,pages,runtime,receipt]=await Promise.all(['scene','pages','runtime','page-preparation'].map(read));
  const asset=canonicalPreparedAsset(scene.body.assets.poles);
  const bytes=await readFile(new URL(`public${asset}`,root));
  const expected=await prepareOpaquePolarDiscs(scene,bytes);
  assert.equal(expected.discs.length,2);
  assert.deepEqual(pages.opaqueDiscs,expected.discs);
  assert.deepEqual(receipt.opaqueDiscs,expected.receipt);
  assert.deepEqual(runtime.pageLayers.find(layer=>layer.id==='city').plan.opaqueDiscs,expected.discs);
  for(const layer of runtime.pageLayers.filter(layer=>layer.id!=='city'))assert.equal(layer.plan.opaqueDiscs,undefined);
});
