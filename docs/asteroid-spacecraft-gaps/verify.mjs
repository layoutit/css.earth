import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {OBJECTS} from '../../site/objects.mts';
import {validateObjectPackageFiles,validatePlanetData} from '../../tools/object-package-contract.mts';
import {runOperations} from '../../tools/objects/dist/operations.js';
const ids=['annefrank','braille'],results=[];
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
await writeFile('docs/asteroid-spacecraft-gaps/source-validation.json',JSON.stringify(results,null,2)+'\n');
console.log('Source and package closure verified:',ids.join(', '));
