import {required} from '../../../../tools/contract/test-values.mts';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('lutetia');
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodeOsirisReflectance} from '../../../../tools/objects/terrestrial-layers/archived-camera.mts';
import {project,diskGain} from '../../../../tools/objects/terrestrial-layers/osiris-geo.mts';
const root='src/objects/lutetia/source/';
const camera=JSON.parse((await readFile(root+'observations/osiris-camera.json')).toString('utf8'));
const bytes=await readFile(root+'observations/n20100710t154047674id4df22.img');

test('Lutetia preserves an independent original reflectance sample and rejects CCD/observation drift',()=>{
  const f=decodeOsirisReflectance(bytes,camera,true),i=1200*2048+1023;
  assert.equal(f.planes.IMAGE[i],.07455288618803024);assert.equal(f.acceptPixel(i),true);
  assert.throws(()=>decodeOsirisReflectance(bytes,{...camera,firstLine:2},true),/plane/);
  assert.throws(()=>decodeOsirisReflectance(bytes,{...camera,startTime:'2010-07-10T00:00:00'},true),/bound/);
  const altered=Buffer.from(bytes);altered[(65590-1)*512+i]=9;
  const bound={...camera,imageSha256:createHash('sha256').update(altered).digest('hex')};
  assert.equal(decodeOsirisReflectance(altered,bound,false).acceptPixel(i),false);
  assert.equal(decodeOsirisReflectance(altered,bound,true).acceptPixel(i),true);
  altered[(65590-1)*512+i]=3;bound.imageSha256=createHash('sha256').update(altered).digest('hex');
  assert.equal(decodeOsirisReflectance(altered,bound,true).acceptPixel(i),false);
});

test('Lutetia distinguishes archive pointing from image-controlled fit and holdout evidence',()=>{
  const c=camera.checks,r=c.imageRegistration;
  assert.ok(c.maximumBoresightResidualDegrees<.00001 && c.maximumPointResidualPixels<.02);
  const p=project(camera.matrix,c.archivePointKm);
  assert.ok(Math.abs(p[0]-(c.projectedPixel[0]+r.offsetPixels[0]))<1e-8);
  assert.ok(Math.abs(p[1]-(c.projectedPixel[1]+r.offsetPixels[1]))<1e-8);
  assert.equal(r.windows.filter((w: { role: string; })=>w.role==='fit').length,2);assert.equal(r.windows.filter((w: { role: string; })=>w.role==='holdout').length,2);
  for (const w of r.windows.filter((w: { role: string; })=>w.role==='holdout')) assert.ok(Math.hypot(...w.offsetPixels.map((n: number,i: number)=>n-r.offsetPixels[i]))<12 && w.correlation>.7);
  // A half disk's photometry has an independently simple result: at i=e=60,
  // D=.5^(2k-1). Phase 30 degrees gives k=.7005.
  const gain=required(diskGain(Math.PI/3,Math.PI/3,{model:'minnaert',coefficient:.5505,phaseCoefficientPerDegree:.005,maximumIncidenceDegrees:70,maximumEmissionDegrees:70,maximumGain:2.5},Math.PI/6));
  assert.ok(Math.abs(gain-2**.401)<1e-12);
});
