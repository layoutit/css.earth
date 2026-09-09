import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {OBJECTS} from '../../site/objects.mjs';
import {validateObjectPackageFiles,validatePlanetData} from '../../tools/object-package-contract.mjs';
import {runOperations} from '../../tools/objects/dist/operations.js';
const ids=['chariklo','bienor'],results=[];
for(const id of ids){
 const object=OBJECTS.find(o=>o.id===id);assert.equal(object.classification,'asteroid');
 await validateObjectPackageFiles(object);
 const data=await validatePlanetData(object);
 const source=await runOperations('verify',id);
 const dir=resolve('src/planets',id);
 const controls=JSON.parse(await readFile(resolve(dir,'prepared/controls.json')));
 assert.equal(controls.settings.controls.find(c=>c.name==='shadows').checked,false);
 assert.equal(controls.settings.controls.find(c=>c.name==='orbit').checked,false);
 assert.deepEqual(controls.lenses.controls.map(c=>c.id),['model']);
 const descriptor=JSON.parse(await readFile(resolve(dir,'object.json')));
 const bytes=await readFile(resolve(dir,'prepared/object.json'));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),descriptor.prepared.sha256);
 results.push({id,data,source,preparedSha256:descriptor.prepared.sha256});
}
const context=JSON.parse(await readFile('src/planets/sun/prepared/world-context.json'));
for(const id of ids){const entry=context.bodies.find(body=>body.id===id);assert.ok(entry,`Missing shared context body: ${id}`);assert.ok(entry.radiusM>0);}
const contextBytes=await readFile('src/planets/sun/source/navigation/universe.json');
const contextSha=createHash('sha256').update(contextBytes).digest('hex');
const sunDescriptor=JSON.parse(await readFile('src/planets/sun/object.json'));
assert.equal(sunDescriptor.properties.recipe.sources.find(source=>source.id==='world-context').sha256,contextSha);
const sunManifest=JSON.parse(await readFile('src/planets/sun/source/manifest.json'));
const contextRecord=sunManifest.inputs.find(input=>input.path==='navigation/universe.json');
assert.equal(contextRecord.expectedSha256,contextSha);assert.equal(contextRecord.expectedBytes,contextBytes.length);
await writeFile('docs/centaur-population/source-validation.json',JSON.stringify(results,null,2)+'\n');
console.log('Source and package closure verified:',ids.join(', '));
