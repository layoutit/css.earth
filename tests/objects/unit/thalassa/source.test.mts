import {required} from '../../../../tools/contract/test-values.mts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parsePdsRadiusTable} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {readObservation} from '../../../../tools/objects/terrestrial-layers/solid-raster.mts';
const root=new URL('../../../../src/objects/thalassa/',import.meta.url);
test('Thalassa uses the measured flattened figure rather than the older PCK sphere',async()=>{
  const cfg=JSON.parse((await readFile(new URL('source/preparation/terrestrial.json',root))).toString('utf8'));
  const text=await readFile(new URL('source/shape/ellipsoid.tab',root),'utf8');
  const shape=parsePdsRadiusTable(text,cfg.geometry.radialTerrain.grid);
  for(const [lon,lat,radius] of [[0,0,54000],[90,0,50000],[180,0,54000],[270,0,50000],[0,90,26000],[0,-90,26000]] as const)
    assert.ok(Math.abs(required(shape.sample(lon,lat))-radius)<0.001,`${lon},${lat}`);
  for(const line of text.trim().split('\n')){
    const [lon,lat,radius]=line.trim().split(/\s+/).map(Number),l=lon*Math.PI/180,p=lat*Math.PI/180;
    const expected=1/Math.hypot(Math.cos(p)*Math.cos(l)/54,Math.cos(p)*Math.sin(l)/50,Math.sin(p)/26);
    assert.ok(Math.abs(radius-expected)<5.1e-10);
  }
  const pck=await readFile(new URL('source/shape/pck00011.tpc',root),'utf8');
  const old=required(pck.match(/BODY804_RADII\s*=\s*\(([^)]+)\)/))[1].trim().split(/\s+/).map(Number);
  assert.deepEqual(old,[40,40,40]);
});
test('Thalassa has no synthetic observed surface pixels after resampling',async()=>{
  const manifest=JSON.parse((await readFile(new URL('source/manifest.json',root))).toString('utf8'));
  const cfg=JSON.parse((await readFile(new URL('source/preparation/terrestrial.json',root))).toString('utf8'));
  const entry=manifest.inputs.find((input: { id: string; })=>input.id==='model-surface');
  const {missing}=await readObservation(new URL('source/',root).pathname,entry,cfg.raster.observations[0].validity,512,256);
  assert.equal(missing.length,131072);assert.ok(missing.every(value=>value===1));
});
