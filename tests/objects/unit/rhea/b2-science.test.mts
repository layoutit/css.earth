import {array,shape,text,number,nullable} from '../../../../tools/objects/terrestrial-layers/source-records.mts';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadScienceSurface} from '../../../../tools/objects/terrestrial-layers/scientific-raster.mts';
const sourceRoot=new URL('../../../../src/objects/rhea/source/',import.meta.url).pathname;
test('Rhea B2 scalar coordinates retain independent source values and exact missing cells',async()=>{
 const config=JSON.parse((await readFile(sourceRoot+'preparation/terrestrial.json')).toString('utf8'));
 const receipt=JSON.parse((await readFile(sourceRoot+'validation/b2-scalar-anchors.json')).toString('utf8'));
 for(const row of receipt.sources){const bytes=await readFile(sourceRoot+row.path);assert.ok(bytes.length>0,row.path);}
 for(const lens of config.raster.scientific.filter((l: { id: string; })=>l.id!=='elevation')){
  const surface=await loadScienceSurface(sourceRoot,lens),paths=[lens.path,...array(shape({path:text}))(lens.additionalGrids??[]).map(g=>g.path)];
  for(const source of array(shape({path:text,anchors:array(shape({longitudeEastDegrees:number,latitudeDegrees:number,value:nullable(number),column:number,row:number}))}))(receipt.sources).filter(s=>paths.includes(s.path)))for(const anchor of source.anchors){
   const actual=surface.sample(anchor.longitudeEastDegrees,anchor.latitudeDegrees);
   if(anchor.value===null)assert.equal(actual,null,'Do not fill a missing source cell');
   else assert.ok(actual!==null&&Math.abs(actual-anchor.value)<1e-7,`${source.path} cell ${anchor.column},${anchor.row}: ${actual} differs from ${anchor.value}`);
  }
 }
});

test('Rhea relative albedo retains the exact delivered footprint',async()=>{const c=JSON.parse((await readFile(sourceRoot+'preparation/terrestrial.json')).toString('utf8'));const source=await loadScienceSurface(sourceRoot,c.raster.scientific.find((l: { id: string; })=>l.id==='relative-albedo'));assert.equal(source.sample(359.6,0),null);assert.equal(source.sample(180,-89.8),null);assert.ok(Number.isFinite(source.sample(359,0)));assert.ok(Number.isFinite(source.sample(180,-89.5)));});
