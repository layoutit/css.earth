// Reuse the baked surface and lighting banks after shared navigation changes.
import {readFile,writeFile} from 'node:fs/promises';
import {prepareSolidPresentation} from '../../tools/objects/terrestrial-layers/solid-scene.mjs';
import {prepareObjectJson} from '../../tools/prepare-object-json.mjs';
const bodies=JSON.parse(await readFile('docs/mars-crossing-population/inputs.json'));
for(const {id} of bodies){
 const root=`src/planets/${id}`,sourceDirectory=`${root}/source`,outputDirectory=`${root}/prepared`,publicDirectory=`public/scenes/${id}`;
 const read=async file=>JSON.parse(await readFile(file,'utf8'));
 const config=await read(`${sourceDirectory}/preparation/terrestrial.json`),scene=await read(`${outputDirectory}/scene.json`),material=await read(`${outputDirectory}/material.json`),controls=await read(`${outputDirectory}/controls.json`);
 const definition=await prepareSolidPresentation({config,scene,material,controls,sourceDirectory,publicDirectory,outputDirectory});
 await writeFile(`${outputDirectory}/runtime.json`,JSON.stringify(definition)+'\n');
}
await prepareObjectJson(bodies.map(body=>body.id));
console.log('Five presentations refreshed from existing baked banks');
