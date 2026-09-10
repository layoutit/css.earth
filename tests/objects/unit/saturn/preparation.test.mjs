import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {promisify} from 'node:util';
import test from 'node:test';
import {readPreparedFixture,projectRoot} from '../../fixtures.mjs';
import {parseSourceManifest,verifySources} from '../../../../tools/objects/dist/operations.js';
const sourceRoot=new URL('../../../../src/planets/saturn/source/',import.meta.url).pathname;
const manifest=parseSourceManifest(JSON.parse(await readFile(sourceRoot+'manifest.json','utf8')),'saturn');
test('prepares Saturn from a complete checked source closure',async()=>{
 assert.deepEqual(await verifySources({sourceRoot,manifest}),{inputCount:39,generatedIntermediateCount:1,documentCount:2,verifiedCount:42});
});
test('composition consumes the verified phase and never reruns its numerical generator',async()=>{
 const source=await readFile(new URL('../../../../tools/objects/material-composition/layered-oblate.mts',import.meta.url),'utf8');
 const start=source.indexOf('async function composePlanetTextures('),end=source.indexOf('\nfunction prepareSurfaceChannelFactors(',start);
 assert.ok(start>0&&end>start);
 const composition=source.slice(start,end);
 assert.doesNotMatch(composition,/prepareNormalMaterialMasters\(/);
 assert.match(source,/prepareBaseMaterialSurfaces: prepareNormalMaterialMasters/);
 assert.match(source,/composeMaterialSurfaces: composePlanetTextures/);
 const dispatcher=await readFile(new URL('../../../../tools/objects/material-composition/index.mts',import.meta.url),'utf8');
 assert.ok(dispatcher.indexOf('prepareBaseMaterialSurfaces()')<dispatcher.indexOf('composeMaterialSurfaces(metadata)'));
});
test('executes every pinned Saturn acquisition verifier',async()=>{
 const {stdout}=await promisify(execFile)(process.execPath,['tools/objects/dist/operations.js','acquire','saturn','--verify-only'],{cwd:projectRoot});
 assert.deepEqual(JSON.parse(stdout),{inputCount:39,generatedIntermediateCount:1,documentCount:2,verifiedCount:42});
 const plan=JSON.parse(await readFile(sourceRoot+'preparation/acquisition.json','utf8'));
 assert.ok(plan.operations.some(step=>step.kind==='satellite-catalog'));
 for(const path of ['lenses/2025a_225.fits','moons/titan.jpg'])assert.ok(manifest.inputs.some(entry=>entry.path===path)||plan.operations.some(step=>step.kind==='download'));
 assert.equal(plan.operations.filter(step=>step.kind==='verify-request').length,2);
});
test('prepares the Saturn shell title from its owned source',async()=>{
 const {title}=await readPreparedFixture('saturn','content');
 assert.equal(title.label,'Saturn');
 assert.equal(title.sourceSha256,'746431e950fd28d29b0189d708d4a5852a8458edb3184387eadcee9e5e34676c');
 const descriptor=JSON.parse(await readFile(new URL('../../../../src/planets/saturn/object.json',import.meta.url),'utf8'));
 assert.match(descriptor.properties.recipe.sources.find(source=>source.id==='title').sha256,/^[0-9a-f]{64}$/);
 assert.equal(title.sourceGenerator,'tools/prepare-planet-title-sources.mts');
 assert.doesNotMatch(title.path,/<text|font-family/i);
});
