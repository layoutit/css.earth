import {readJsonSource,requireArray,requireRecord,requireString} from '../../tools/source-values.mts';
import {createSourceManifest} from '../../src/platform/source-manifest.mts';
import {parseSolidPreparationSource} from '../../tools/objects/terrestrial-layers/profile-source.mts';
import {parseSolidReplayScene,parseReplayMaterial,parseReplayControls} from '../../tools/prepared-replay-source.mts';
// Reuse the baked surface and lighting banks after shared navigation changes.
import {readFile,writeFile} from 'node:fs/promises';
import {prepareSolidPresentation} from '../../tools/objects/terrestrial-layers/solid-scene.mts';
import {prepareObjectJson} from '../../tools/prepare-object-json.mts';
const bodies=requireArray(await readJsonSource('docs/mars-crossing-population/inputs.json')).map(value=>({id:requireString(requireRecord(value).id)}));
for(const {id} of bodies){
 const root=`src/planets/${id}`,sourceDirectory=`${root}/source`,outputDirectory=`${root}/prepared`,publicDirectory=`public/scenes/${id}`;
 const read=readJsonSource;
 const config=parseSolidPreparationSource(await read(`${sourceDirectory}/preparation/terrestrial.json`)),scene=parseSolidReplayScene(await read(`${outputDirectory}/scene.json`)),material=parseReplayMaterial(await read(`${outputDirectory}/material.json`)),controls=parseReplayControls(await read(`${outputDirectory}/controls.json`));
 const source=await createSourceManifest({planetId:id,planetName:config.displayName,sourceRoot:sourceDirectory});
 const definition=await prepareSolidPresentation({config,scene,material,controls,source,sourceDirectory,publicDirectory,outputDirectory});
 await writeFile(`${outputDirectory}/runtime.json`,JSON.stringify(definition)+'\n');
}
await prepareObjectJson(bodies.map(body=>body.id));
console.log('Five presentations refreshed from existing baked banks');
