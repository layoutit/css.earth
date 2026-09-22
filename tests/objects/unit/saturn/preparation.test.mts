import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {promisify} from 'node:util';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('saturn');
import {readPreparedFixture,projectRoot} from '../../fixtures.mts';
import {parseSourceManifest,verifySources} from '../../../../tools/objects/dist/operations.js';
const sourceRoot=new URL('../../../../src/objects/saturn/source/',import.meta.url).pathname;
const manifest=parseSourceManifest(JSON.parse(await readFile(sourceRoot+'manifest.json','utf8')),'saturn');
test('prepares Saturn from a complete checked source closure',async()=>{
 const verified=await verifySources({sourceRoot,manifest});
 assert.equal(verified.inputCount,manifest.inputs.length);
 assert.equal(verified.verifiedCount,verified.inputCount+verified.generatedIntermediateCount+verified.documentCount);
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
 assert.deepEqual(JSON.parse(stdout),await verifySources({sourceRoot,manifest}));
 const plan=JSON.parse(await readFile(sourceRoot+'preparation/acquisition.json','utf8'));
 assert.ok(plan.operations.some((step: { kind: string; })=>step.kind==='satellite-catalog'));
 for(const path of ['lenses/2025a_225.fits','moons/titan.jpg'])assert.ok(manifest.inputs.some(entry=>entry.path===path)||plan.operations.some((step: { kind: string; })=>step.kind==='download'));
 assert.equal(plan.operations.filter((step: { kind: string; })=>step.kind==='verify-request').length,2);
});
test('prepares the Saturn shell title from its owned source',async()=>{
 const {title}=await readPreparedFixture('saturn','content');
 assert.equal(title.label,'Saturn');
 const descriptor=JSON.parse(await readFile(new URL('../../../../src/objects/saturn/object.json',import.meta.url),'utf8'));
 assert.equal(descriptor.properties.recipe.sources.find((source: { id: string; })=>source.id==='title').path,'source/presentation/title-mark.json');
 assert.doesNotMatch(title.path,/<text|font-family/i);
});
