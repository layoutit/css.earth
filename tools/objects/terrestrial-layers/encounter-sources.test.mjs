import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {decodeEncounterFits} from './encounter-fits.mts';
import {encounterCamera} from './encounter-camera.mts';
import {validateEncounterRegistration} from './encounter-registration.mts';
const root=resolve(import.meta.dirname,'../../..');
const anchors=JSON.parse(await readFile(resolve(root,'docs/comets/evidence/encounter-decoder-anchors.json')));
for(const body of ['comet-81p','comet-9p','comet-103p'])test(`${body}: real source pixels match independent FITS decoding and all cameras pass held-out controls`,async()=>{
 const source=resolve(root,`src/planets/${body}/source`),recipe=JSON.parse(await readFile(resolve(source,'preparation/terrestrial.json'))),manifest=JSON.parse(await readFile(resolve(source,'manifest.json')));
 const shape=manifest.inputs.find(e=>e.path===recipe.geometry.radialTerrain.path);
 for(const lens of recipe.raster.surfaceObservations)for(const frame of lens.frames){
  const bytes=await readFile(resolve(source,frame.path)),control=JSON.parse(await readFile(resolve(source,frame.controlPath))),reference=anchors.products.find(p=>p.body===body&&p.path===frame.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),reference.sha256);
  const decoded=decodeEncounterFits(bytes,control.observation);
  assert.equal(decoded.width,reference.width);assert.equal(decoded.height,reference.height);assert.equal(decoded.units,reference.units);
  for(const p of reference.anchors){const i=p.y*decoded.width+p.x;assert.equal(decoded.quality[i],p.quality);if(p.radiance===null)assert.ok(!Number.isFinite(decoded.values[i]));else assert.equal(decoded.values[i],p.radiance);}
  const camera=encounterCamera(decoded.header,control.camera),report=validateEncounterRegistration(camera,control.registration,shape.expectedSha256);
  assert.ok(report.fit.count>=6&&report.holdout.count>=6);
 }
});
