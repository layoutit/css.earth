import { bodies, ids, reportDirectory, captureDirectory } from './selection.mts';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {SCENE_OBJECTS} from '../../../site/objects.mts';
import {validatePlanetData} from '../../../tools/object-package-contract.mts';
import {parsePreparedObjectRuntime} from '../../../src/renderers/css/dist/index.js';
import {requireRuntimeAssetManifest} from '../../../src/platform/runtime-asset-closure.mts';
import {requireArray,requireRecord,requireString} from '../../../tools/source-values.mts';


const read=async (path:string):Promise<unknown>=>JSON.parse(await readFile(path,'utf8'));
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
function requireDescriptor(value:unknown){const descriptor=requireRecord(value,'Object descriptor'),properties=requireRecord(descriptor.properties,'Object descriptor properties'),page=requireRecord(properties.page,'Object descriptor page'),metadata=requireRecord(page.metadata,'Object descriptor page metadata'),prepared=requireRecord(descriptor.prepared,'Object descriptor prepared reference');return {pageUrl:requireString(metadata.url,'Object descriptor page URL'),pageSha256:requireString(metadata.sha256,'Object descriptor page hash'),preparedSha256:requireString(prepared.sha256,'Object descriptor prepared hash')};}
function requirePreparedPage(value:unknown){const page=requireRecord(value,'Prepared page');return {sceneSha256:requireString(page.sceneSha256,'Prepared page scene hash'),controls:page.controls,assets:page.assets};}
function requireTerrain(value:unknown){const terrain=requireRecord(value,'Prepared terrain'),source=requireRecord(terrain.source,'Prepared terrain source');return {primitive:requireString(source.primitive,'Prepared terrain primitive'),faces:requireArray(terrain.faces,'Prepared terrain faces'),simplification:requireRecord(terrain.simplification,'Prepared terrain simplification')};}
const results:Array<Record<string,unknown>>=[];
for(const id of ids){
 const root=`src/objects/${id}`,record=SCENE_OBJECTS.find(object=>object.id===id),body=bodies.find(candidate=>candidate.id===id);
 assert.ok(record);assert.ok(body);assert.equal(record.classification,requireString(requireRecord(body,'Distant-world selection').classification,'Distant-world classification'));
 const closure=await validatePlanetData(record);
 const descriptor=requireDescriptor(await read(`${root}/object.json`)),runtime=parsePreparedObjectRuntime(await read(`${root}/prepared/runtime.json`));
 const pageBytes=await readFile(`${root}/${descriptor.pageUrl}`),page=requirePreparedPage(JSON.parse(pageBytes.toString('utf8')));
 assert.equal(sha(pageBytes),descriptor.pageSha256);
 assert.equal(page.sceneSha256,descriptor.preparedSha256);
 assert.deepEqual(page.controls,runtime.controls);assert.deepEqual(page.assets,runtime.assets);
 const controls=requireRecord(await read(`${root}/prepared/controls.json`),'Prepared controls'),terrain=requireTerrain(await read(`${root}/prepared/terrain.json`));
 const lenses=requireRecord(controls.lenses,'Prepared lenses');assert.equal(requireString(lenses.defaultLens,'Prepared default lens'),'model');
 const settings=requireRecord(controls.settings,'Prepared settings'),settingsControls=requireArray(settings.controls,'Prepared settings controls').map((value,index)=>{const control=requireRecord(value,`Prepared setting ${index}`);if(typeof control.checked!=='boolean')throw new TypeError(`Prepared setting ${index} checked must be boolean.`);return {name:requireString(control.name,`Prepared setting ${index} name`),checked:control.checked};});
 for(const name of ['shadows','orbit']){const control=settingsControls.find(candidate=>candidate.name===name);assert.ok(control);assert.equal(control.checked,false);}
 assert.equal(terrain.primitive,'u');
 assert.equal(terrain.faces.length,480);
 const assets=requireRuntimeAssetManifest(id,await read(`${root}/runtime-assets.json`));
 const result={id,...closure,assetBytes:assets.assets.reduce((sum,asset)=>sum+asset.bytes,0),faceCount:terrain.faces.length,
  simplification:terrain.simplification,pageMetadataSha256:descriptor.pageSha256,defaultLens:'model',shadows:false,orbit:false};
 results.push(result);
}
await writeFile(`${reportDirectory}/qualification.json`,JSON.stringify({schema:'cssearth-distant-worlds-qualification@1',
 scope:'Selected body packages: complete source and runtime byte closures, scene/page binding, native triangle budgets, source topology and defaults. Browser evidence is reported separately.',bodies:results},null,2)+'\n');
console.log(ids.length, 'body package closures and prepared contracts passed.');
