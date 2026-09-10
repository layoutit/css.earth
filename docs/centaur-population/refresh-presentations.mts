import {readJsonSource,requireArray,requireRecord,requireString} from '../../tools/source-values.mts';
import {createSourceManifest} from '../../src/platform/source-manifest.mts';
import {parseSolidPreparationSource} from '../../tools/objects/terrestrial-layers/profile-source.mts';
import {parseSolidReplayScene,parseReplayMaterial,parseReplayControls} from '../../tools/prepared-replay-source.mts';
// Reuse prepared surface/lighting banks after shared navigation or leaf layout changes.
import { readFile, writeFile } from 'node:fs/promises';
import { prepareTerrestrialRings } from '../../tools/objects/terrestrial-layers/rings.mts';
import { prepareSolidPresentation } from '../../tools/objects/terrestrial-layers/solid-scene.mts';
import { prepareObjectJson } from '../../tools/prepare-object-json.mts';
for (const id of ['chariklo', 'bienor']) {
  const root = `src/planets/${id}`, sourceDirectory = `${root}/source`, outputDirectory = `${root}/prepared`, publicDirectory = `public/scenes/${id}`;
  const read = readJsonSource;
  const config =parseSolidPreparationSource(await read(`${sourceDirectory}/preparation/terrestrial.json`));
  const scene =parseSolidReplayScene(await read(`${outputDirectory}/scene.json`));
  const material =parseReplayMaterial(await read(`${outputDirectory}/material.json`));
  const controls =parseReplayControls(await read(`${outputDirectory}/controls.json`));
  if (config.rings) {
    const rings=await prepareTerrestrialRings({ config, publicDirectory });
    if(!rings)throw new TypeError('Configured rings were not prepared.');
    scene.rings=rings;
  }
  const source=await createSourceManifest({planetId:id,planetName:config.displayName,sourceRoot:sourceDirectory});
  const definition = await prepareSolidPresentation({ config, scene, material, controls, source, sourceDirectory, publicDirectory, outputDirectory });
  await writeFile(`${outputDirectory}/scene.json`, JSON.stringify(scene) + '\n');
  await writeFile(`${outputDirectory}/runtime.json`, JSON.stringify(definition) + '\n');
}
await prepareObjectJson(['chariklo', 'bienor']);
