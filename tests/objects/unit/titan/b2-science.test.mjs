import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadScienceSurface} from '../../../../tools/objects/terrestrial-layers/scientific-raster.mjs';
const sourceRoot=new URL('../../../../src/planets/titan/source/',import.meta.url).pathname;
test('Titan B2 scalar coordinates retain independent source values and exact missing cells',async()=>{
 const config=JSON.parse(await readFile(sourceRoot+'preparation/terrestrial.json'));
 const receipt=JSON.parse(await readFile(sourceRoot+'validation/b2-scalar-anchors.json'));
 for(const row of receipt.sources){const bytes=await readFile(sourceRoot+row.path);assert.equal(bytes.length,row.expectedBytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.expectedSha256);}
 for(const lens of config.raster.scientific.filter(l=>l.id!=='elevation')){
  const surface=await loadScienceSurface(sourceRoot,lens),paths=[lens.path,...(lens.additionalGrids??[]).map(g=>g.path)];
  for(const source of receipt.sources.filter(s=>paths.includes(s.path)))for(const anchor of source.anchors){
   const actual=surface.sample(anchor.longitudeEastDegrees,anchor.latitudeDegrees);
   if(anchor.value===null)assert.equal(actual,null,'Do not fill a missing source cell');
   else assert.ok(actual!==null&&Math.abs(actual-anchor.value)<1e-7,`${source.path} cell ${anchor.column},${anchor.row}: ${actual} differs from ${anchor.value}`);
  }
 }
});

test('Titan scalar views preserve observed-versus-interpolated support',async()=>{const c=JSON.parse(await readFile(sourceRoot+'preparation/terrestrial.json'));const r=JSON.parse(await readFile(sourceRoot+'validation/b2-scalar-anchors.json'));const measured=await loadScienceSurface(sourceRoot,c.raster.scientific.find(l=>l.id==='topography'));const interpolated=await loadScienceSurface(sourceRoot,c.raster.scientific.find(l=>l.id==='interpolated'));const missing=r.sources.find(s=>s.path.includes('GTFED00N270')).anchors.find(a=>a.value===null);assert.equal(measured.sample(missing.longitudeEastDegrees,missing.latitudeDegrees),null);assert.ok(Number.isFinite(interpolated.sample(missing.longitudeEastDegrees,missing.latitudeDegrees)));assert.equal(measured.sample(0,-90),null,'Do not extrapolate beyond the last raster row');});
