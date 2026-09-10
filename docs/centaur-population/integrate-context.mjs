import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {prepareSpatialContext} from '../../tools/objects/dist/prepare-spatial-context.js';
import {resolve} from 'node:path';
const read=async path=>JSON.parse(await readFile(path,'utf8'));
const write=(path,value)=>writeFile(path,JSON.stringify(value,null,2)+'\n');
const path='src/planets/sun/source/navigation/universe.json',source=await read(path);
for(const body of [{id:'chariklo',name:'Chariklo',color:'#aaaaaa'},{id:'bienor',name:'Bienor',color:'#aaaaaa'}]) {
 const previous=source.bodies.find(entry=>entry.id===body.id);
 if(previous)assert.deepEqual(previous,body);else source.bodies.push(body);
}
await write(path,source);
const bytes=await readFile(path),sha256=createHash('sha256').update(bytes).digest('hex');
const manifestPath='src/planets/sun/source/manifest.json',manifest=await read(manifestPath);
const record=manifest.inputs.find(entry=>entry.path==='navigation/universe.json');
assert.ok(record);record.expectedBytes=bytes.length;record.expectedSha256=sha256;
if('sha256' in record)record.sha256=sha256;
await write(manifestPath,manifest);
const descriptorPath='src/planets/sun/object.json',descriptor=await read(descriptorPath);
const recipe=descriptor.properties.recipe.sources.find(entry=>entry.id==='world-context');assert.ok(recipe);recipe.sha256=sha256;
await write(descriptorPath,descriptor);
await prepareSpatialContext({sourcePath:resolve(path),outputPath:resolve('src/planets/sun/prepared/world-context.json'),solarGeometryPath:resolve('src/platform/solar-geometry.mjs')});
console.log('Added both Centaurs to the shared authored context; manifest and recipe source pins agree:',sha256);
