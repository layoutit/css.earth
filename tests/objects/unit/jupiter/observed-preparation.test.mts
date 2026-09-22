import {shape,array,number,boolean,text} from '../../../../tools/objects/terrestrial-layers/source-records.mts';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {prepareObservedPolarSurfaces} from '../../../../tools/objects/giant-observations/index.mts';

test('reproduces every observed/polar asset from pinned sources without prepared inputs',{timeout:120000},async()=>{
  const objectRoot=new URL('../../../../src/objects/jupiter/',import.meta.url).pathname;
  const config=JSON.parse(await readFile(objectRoot+'/source/preparation/observations.json','utf8'));
  const manifest=JSON.parse(await readFile(objectRoot+'/inventory.json','utf8'));
  const result=await prepareObservedPolarSurfaces({sourceDirectory:objectRoot+'/source',publicDirectory:'/unused',config,write:false});
  assert.equal(result.assets.length,config.lenses.length*5);
  for(const asset of result.assets){const expected=manifest.assets.find((value: { filename: string; })=>value.filename===asset.filename);assert.ok(expected,asset.filename);assert.equal(asset.sha256,expected.sha256,asset.filename);assert.equal(asset.bytes,expected.bytes,asset.filename);}
  assert.deepEqual(result.lenses.controls.map(lens=>lens.id),shape({lenses:array(shape({id:text}))})(config).lenses.map(lens=>lens.id));
  for(const value of result.lenses.controls.filter(lens=>lens.falseColor)){
    const lens=shape({sourceRange:array(number),coveragePreparation:shape({runtimeCoverageRepair:boolean,structuralDetailMeasurement:boolean,detailedPoles:array(text),model:text,sourceMissingPixels:number})})(value);
    assert.ok(lens.sourceRange[0]>0&&lens.sourceRange[1]>lens.sourceRange[0]);
    assert.equal(lens.coveragePreparation.runtimeCoverageRepair,false);
    assert.equal(lens.coveragePreparation.structuralDetailMeasurement,false);
    assert.deepEqual(lens.coveragePreparation.detailedPoles,[]);
    assert.equal(lens.coveragePreparation.model,'measured-polar-projection-with-neutral-gaps');
    assert.ok(lens.coveragePreparation.sourceMissingPixels>0);
  }
});
