import {array,shape,text,number,nullable} from '../../../../tools/objects/terrestrial-layers/source-records.mts';
import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('titan');
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadScienceSurface} from '../../../../tools/objects/terrestrial-layers/scientific-raster.mts';
import {parseInterpreterRecipe} from '../../../../tools/objects/observation/interpret.mts';
const sourceRoot=new URL('../../../../src/objects/titan/source/',import.meta.url).pathname;
/** The raster lane's science blocks for the scalar lenses (`terrestrial-scientific`), minus the retired elevation id. */
const scalarLenses=async()=>parseInterpreterRecipe(JSON.parse((await readFile(sourceRoot+'preparation/raster.json')).toString('utf8'))).surfaces
 .filter(s=>s.science?.kind==='terrestrial-scientific'&&s.id!=='elevation').map(s=>({id:s.id,science:required(s.science)}));
const scalarLens=async(id: string)=>required((await scalarLenses()).find(l=>l.id===id),`${id} science surface`).science;
const parseAnchors=array(shape({path:text,anchors:array(shape({longitudeEastDegrees:number,latitudeDegrees:number,value:nullable(number),column:number,row:number}))}));
test('Titan B2 scalar coordinates retain independent source values and exact missing cells',async()=>{
 const receipt=JSON.parse((await readFile(sourceRoot+'validation/b2-scalar-anchors.json')).toString('utf8'));
 const sources=parseAnchors(receipt.sources);
 for(const row of array(shape({path:text}))(receipt.sources)){const bytes=await readFile(sourceRoot+row.path);assert.ok(bytes.length>0,row.path);}
 for(const lens of await scalarLenses()){
  const surface=await loadScienceSurface(sourceRoot,lens.science),paths=[text(lens.science.path),...array(shape({path:text}))(lens.science.additionalGrids??[]).map(g=>g.path)];
  for(const source of sources.filter(s=>paths.includes(s.path)))for(const anchor of source.anchors){
   const actual=surface.sample(anchor.longitudeEastDegrees,anchor.latitudeDegrees);
   if(anchor.value===null)assert.equal(actual,null,'Do not fill a missing source cell');
   else assert.ok(actual!==null&&Math.abs(actual-anchor.value)<1e-7,`${source.path} cell ${anchor.column},${anchor.row}: ${actual} differs from ${anchor.value}`);
  }
 }
});

test('Titan scalar views preserve observed-versus-interpolated support',async()=>{const r=JSON.parse((await readFile(sourceRoot+'validation/b2-scalar-anchors.json')).toString('utf8'));const measured=await loadScienceSurface(sourceRoot,await scalarLens('topography'));const interpolated=await loadScienceSurface(sourceRoot,await scalarLens('interpolated'));const missing=required(required(parseAnchors(r.sources).find(s=>s.path.includes('GTFED00N270'))).anchors.find(a=>a.value===null));assert.equal(measured.sample(missing.longitudeEastDegrees,missing.latitudeDegrees),null);assert.ok(Number.isFinite(interpolated.sample(missing.longitudeEastDegrees,missing.latitudeDegrees)));assert.equal(measured.sample(0,-90),null,'Do not extrapolate beyond the last raster row');});
