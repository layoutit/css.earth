import { restoredSources, sourceTest } from '../../source-test.mts';
const sources = restoredSources('steins', 'observations/w20080905t183606461id4df17.img');
const test = sourceTest('steins', sources);
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decodeOsirisReflectance} from '../../../../tools/objects/terrestrial-layers/archived-camera.mts';
const root='src/objects/steins/source/';
const camera=JSON.parse((await readFile(root+'observations/osiris-camera.json')).toString('utf8'));
const bytes=sources.skip ? Buffer.alloc(0) : await readFile(root+'observations/w20080905t183606461id4df17.img');
test('Steins binds the near-opposition WAC subframe, not NAC pixel conventions',()=>{
  const f=decodeOsirisReflectance(bytes,camera,true);
  assert.equal(f.planes.IMAGE[75*f.width+150],.4055645167827606);assert.equal(f.acceptPixel(75*f.width+150),true);
  assert.equal(camera.firstLine,809);assert.equal(camera.firstSample,897);
  assert.equal(camera.filter,'Empty_OI');assert.ok(camera.checks.maximumBoresightResidualDegrees<.00001);
  assert.throws(()=>decodeOsirisReflectance(bytes,{...camera,width:2048},true),/plane/);
  assert.throws(()=>decodeOsirisReflectance(bytes,{...camera,filter:'Neutral_Orange'},true),/bound/);
});
