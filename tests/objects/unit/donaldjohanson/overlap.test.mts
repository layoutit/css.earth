import { sourceTest } from '../../source-test.mts';
const test = sourceTest('donaldjohanson');
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { requireRecord, requireArray, requireString, requireFiniteNumber } from '../../../../tools/sources/source-values.mts';
import { bindSipCamera, decodeLlorri } from '../../../../tools/objects/terrestrial-layers/llorri-geo.mts';
import { llorriHeaderCamera } from '../../../../tools/objects/terrestrial-layers/llorri-header-camera.mts';
import { loadKernelSet } from '../../../../tools/spice/kernel-set.mts';
const root=resolve('src/objects/donaldjohanson/source');
const record=async(path:string)=>requireRecord(JSON.parse(await readFile(resolve(root,path),'utf8')));
const vector=(value:unknown)=>requireArray(value).map(n=>requireFiniteNumber(n));

test('Lucy approach camera retains native optics, pinned inputs and every withheld control',async()=>{
  const profile=await record('preparation/llorri-overlap.json'),camera=await record('observations/llorri-approach-camera.json');
  const entry=requireRecord(requireArray(profile.frames)[0]),bytes=await readFile(resolve(root,requireString(entry.image)));
  const kernels=await loadKernelSet(requireArray(profile.kernels).map(p=>resolve(root,requireString(p))));
  const seed=llorriHeaderCamera(bytes,kernels,requireFiniteNumber(profile.bodyId));
  for(const field of ['matrix','rayMatrix','positionKm','sunDirection','imageSha256'])assert.deepEqual(camera[field],requireRecord(seed)[field],field);
  const sip=requireRecord(camera.sip);for(const field of ['referencePixel','a','b'])assert.deepEqual(sip[field],requireRecord(seed.sip)[field]);
  assert.equal(camera.meshSha256,profile.shapeSha256);
  for(const raw of requireArray(camera.provenance)) {
    const pin=requireRecord(raw),input=await readFile(resolve(root,requireString(pin.path)));
    assert.equal(createHash('sha256').update(input).digest('hex'),pin.sha256);
  }
  const registration=requireRecord(requireRecord(camera.checks).imageRegistration),controls=requireArray(registration.controls).map(c=>requireRecord(c));
  assert.equal(controls.filter(c=>c.partition==='fit').length,52);
  const held=controls.filter(c=>c.partition==='holdout');assert.equal(held.length,43);
  const project=bindSipCamera(camera).projectPoint,residuals=held.map(control=>{
    const point=vector(control.pointMeters).map(n=>n/1000),pixel=project(point),expected=vector(control.sourcePixel);
    return Math.hypot(pixel[0]-expected[0],pixel[1]-expected[1]);
  });
  assert.ok(Math.sqrt(residuals.reduce((s,n)=>s+n*n,0)/held.length)<.52);
  assert.ok(Math.max(...residuals)<1.62);
  for(const control of controls) {
    const [row,col]=requireString(control.id).split('-').slice(1).map(Number);
    assert.equal(control.partition,(row+col)%2===0?'fit':'holdout');
  }
  const frame=decodeLlorri(bytes,camera);assert.equal(frame.startTime,'2025-04-20T17:49:26.021');assert.equal(frame.qualityReport.exposureSeconds,.005);
  const changed=Buffer.from(bytes);changed[changed.length-1]^=1;
  assert.throws(()=>decodeLlorri(changed,camera),/not bound/);
});
