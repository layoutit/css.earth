import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mts';
import {readObservation} from '../../../../tools/objects/terrestrial-layers/solid-raster.mts';
import {loadScienceSurface} from '../../../../tools/objects/terrestrial-layers/scientific-raster.mts';
const root=resolve(import.meta.dirname,'../../../../src/objects/ida/source');
const read=async (path: string)=>JSON.parse(await readFile(resolve(root,path),'utf8'));

test('Ida source closure retains original mission bytes, labels and restoration inputs',async()=>{
 const source=await createSourceManifest({planetId:'ida',planetName:'Ida',sourceRoot:root});await source.verify();
 const plan=await read('preparation/acquisition.json');
 // Surface places are project-authored and committed, so they have nothing to restore.
 const authored=new Set(['features/manifest.json','preparation/features.json','presentation/surface-map.json']);
 for(const input of source.manifest.inputs)if(!authored.has(input.path))assert.ok(plan.operations.some((step: { path: string; })=>step.path===input.path),`Missing acquisition path for ${input.path}`);
});

test('Ida measured radii preserve independent pole, equatorial and extremity anchors',async()=>{
 const config=await read('preparation/terrestrial.json'),surface=await loadScienceSurface(root,config.raster.scientific.find((x: { id: string; })=>x.id==='elevation'));
 for(const [longitude,latitude,radiusKm]of [[0,90,8.4529],[0,-90,6.2869],[0,0,25.6316],[90,0,14.4770],[180,0,28.3430],[270,0,9.4459],[228,-48,3.2963],[190,-6,31.0466]] as const){
  assert.ok(Math.abs(required(surface.sample(longitude,latitude))-(radiusKm-16))<1e-6,`Ida source anchor ${longitude},${latitude}`);
 }
 assert.equal(surface.sample(0,91),null);
});

test('Ida FITS samples retain verified north-up rows and are recentered, preserving only label-defined gaps',async()=>{
 const manifest=await read('manifest.json'),config=await read('preparation/terrestrial.json'),entry=manifest.inputs.find((x: { id: string; })=>x.id==='ida-normal');
 const original=(await readFile(resolve(root,entry.path))).subarray(2880,2880+2520*1260);
 assert.equal(original.filter(x=>x===0).length,76126);
 const observation=await readObservation(root,entry,config.raster.observations[0].validity,2520,1260);
 assert.ok("sourceMissingPixels" in observation);
 assert.equal(observation.sourceMissingPixels,76126);
 assert.ok(observation.missing.reduce((a,b)=>a+b,0)>=76126,'Interpolation must retain source gaps');
 for(const [x,y]of [[100,200],[640,500],[1400,700],[2000,1000]] as const){
  const expected=original[y*2520+(x+1260)%2520],index=y*2520+x;
  assert.equal(observation.missing[index],expected===0?1:0);
  if(expected!==0)assert.deepEqual([...observation.rgb.subarray(index*3,index*3+3)],[expected,expected,expected]);
 }
});
