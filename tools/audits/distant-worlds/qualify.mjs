import { mkdir as ensureReportDirectory } from 'node:fs/promises';
await ensureReportDirectory('output/distant-worlds', {recursive:true});
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {OBJECTS} from '../../../site/objects.mts';
import {validatePlanetData} from '../../../tools/object-package-contract.mts';

const ids=['oumuamua','sedna','gonggong','orcus','salacia','varuna','varda','mani','achlys'];
const read=async path=>JSON.parse(await readFile(path));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const bodies=[];
for(const id of ids){
 const root=`src/planets/${id}`,record=OBJECTS.find(object=>object.id===id);
 assert.equal(record.classification,id==='oumuamua'?'interstellar':'trans-neptunian');
 const closure=await validatePlanetData(record);
 const descriptor=await read(`${root}/object.json`),runtime=await read(`${root}/prepared/runtime.json`);
 const pageBytes=await readFile(`${root}/${descriptor.properties.page.metadata.url}`),page=JSON.parse(pageBytes);
 assert.equal(sha(pageBytes),descriptor.properties.page.metadata.sha256);
 assert.equal(page.sceneSha256,descriptor.prepared.sha256);
 assert.deepEqual(page.controls,runtime.controls);assert.deepEqual(page.assets,runtime.assets);
 const controls=await read(`${root}/prepared/controls.json`),terrain=await read(`${root}/prepared/terrain.json`);
 assert.equal(controls.lenses.defaultLens,'model');
 for(const name of ['shadows','orbit'])assert.equal(controls.settings.controls.find(control=>control.name===name).checked,false);
 assert.equal(terrain.source.primitive,'u');
 assert.equal(terrain.faces.length,480);
 const assets=await read(`${root}/runtime-assets.json`);
 const result={id,...closure,assetBytes:assets.assets.reduce((sum,asset)=>sum+asset.bytes,0),faceCount:terrain.faces.length,
  simplification:terrain.simplification,pageMetadataSha256:descriptor.properties.page.metadata.sha256,defaultLens:'model',shadows:false,orbit:false};
 bodies.push(result);
}
await writeFile('output/distant-worlds/qualification.json',JSON.stringify({schema:'cssearth-distant-worlds-qualification@1',
 scope:'Nine own packages: complete source and runtime byte closures, scene/page binding, native triangle budgets, source topology and defaults. Browser evidence is reported separately.',bodies},null,2)+'\n');
console.log('Nine distant-world package closures and prepared contracts passed.');
