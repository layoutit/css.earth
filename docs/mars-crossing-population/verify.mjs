import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {OBJECTS} from '../../site/objects.mjs';
import {validateObjectPackageFiles,validatePlanetData} from '../../tools/object-package-contract.mjs';
import {runOperations} from '../../tools/objects/dist/operations.js';
const ids=['aethra','lyyli','hela','kemi','taurinensis'],results=[];
for(const id of ids){
 const object=OBJECTS.find(o=>o.id===id);assert.equal(object.classification,'asteroid');
 await validateObjectPackageFiles(object);
 const data=await validatePlanetData(object);
 const source=await runOperations('verify',id);
 const dir=resolve('src/planets',id);
 const population=JSON.parse(await readFile(resolve(dir,'source/reference/sbdb.json')));assert.equal(population.object.orbit_class.code,'MCA');
 const calibration=JSON.parse(await readFile(resolve(dir,'source/reference/calibration.json')));assert.equal(calibration.method,'thermal-effective-diameter-as-volume-approximation');
 if(id==='kemi')assert.match(calibration.limitations,/one catalog detection/);
 const controls=JSON.parse(await readFile(resolve(dir,'prepared/controls.json')));
 assert.equal(controls.settings.controls.find(c=>c.name==='shadows').checked,false);
 assert.equal(controls.settings.controls.find(c=>c.name==='orbit').checked,false);
 assert.deepEqual(controls.lenses.controls.map(c=>c.id),['shape','elevation']);
 const descriptor=JSON.parse(await readFile(resolve(dir,'object.json')));
 const bytes=await readFile(resolve(dir,'prepared/object.json'));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),descriptor.prepared.sha256);
 results.push({id,data,source,preparedSha256:descriptor.prepared.sha256});
}
const context=JSON.parse(await readFile('src/planets/sun/prepared/world-context.json'));for(const id of ids)assert.ok(context.bodies.some(b=>b.id===id),`Missing context destination ${id}`);
await writeFile('docs/mars-crossing-population/source-validation.json',JSON.stringify(results,null,2)+'\n');
console.log('Source and package closure verified:',ids.join(', '));
