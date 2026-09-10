import assert from 'node:assert/strict';
import test from 'node:test';
import{readFile}from'node:fs/promises';
import{isDeepStrictEqual}from'node:util';
import{prepareBandedEllipsoid}from'../../../../tools/objects/giant-layers/geometry.mts';
import{prepareNormalizedDiscPresentation}from'../../../../tools/objects/giant-layers/normalized-disc-presentation.mts';
import{prepareWorldNavigationDefinition}from'../../../../tools/objects/dist/prepare-world-navigation.js';
import{fileURLToPath}from'node:url';
test('authored normalized-disc composition reproduces the complete accepted runtime',async()=>{
 const read=async path=>JSON.parse(await readFile(new URL(`../../../../src/planets/jupiter/${path}`,import.meta.url),'utf8'));
 const actual=await prepareNormalizedDiscPresentation({config:await read('source/preparation/presentation.json'),geometry:prepareBandedEllipsoid(await read('source/preparation/geometry.json')),materialConfig:await read('source/preparation/materials.json'),sky:await read('prepared/sky.json'),sun:await read('prepared/sun.json')});
 const {definition:runtime}=await prepareWorldNavigationDefinition({objectDirectory:fileURLToPath(new URL('../../../../src/planets/jupiter/',import.meta.url)),definition:{...actual,schema:'cssearth-object-runtime@4',id:'jupiter',controls:await read('prepared/controls.json')}});assert.ok(isDeepStrictEqual(runtime,await read('prepared/runtime.json')),'Complete runtime differs from accepted retained presentation');
});
