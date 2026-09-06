import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {prepareObservedPolarSurfaces} from '../../../../tools/objects/giant-observations/index.mjs';

test('reproduces every observed/polar asset from pinned sources without prepared inputs',{timeout:120000},async()=>{
  const objectRoot=new URL('../../../../src/planets/jupiter/',import.meta.url).pathname;
  const config=JSON.parse(await readFile(objectRoot+'/source/preparation/observations.json','utf8'));
  const manifest=JSON.parse(await readFile(objectRoot+'/runtime-assets.json','utf8'));
  const result=await prepareObservedPolarSurfaces({sourceDirectory:objectRoot+'/source',publicDirectory:'/unused',config,write:false});
  assert.equal(result.assets.length,config.lenses.length*5);
  for(const asset of result.assets){const expected=manifest.assets.find(value=>value.filename===asset.filename);assert.ok(expected,asset.filename);assert.equal(asset.sha256,expected.sha256,asset.filename);assert.equal(asset.bytes,expected.bytes,asset.filename);}
  assert.deepEqual(result.lenses.controls.map(lens=>lens.id),config.lenses.map(lens=>lens.id));
  for(const lens of result.lenses.controls.filter(lens=>lens.falseColor)){
    assert.ok(lens.sourceRange[0]>0&&lens.sourceRange[1]>lens.sourceRange[0]);
    assert.equal(lens.coveragePreparation.runtimeCoverageRepair,false);
    assert.equal(lens.coveragePreparation.structuralDetailMeasurement,false);
    assert.deepEqual(lens.coveragePreparation.detailedPoles,['south','north']);
  }
});
