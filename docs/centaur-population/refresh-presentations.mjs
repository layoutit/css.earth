// Reuse prepared surface/lighting banks after shared navigation or leaf layout changes.
import { readFile, writeFile } from 'node:fs/promises';
import { prepareTerrestrialRings } from '../../tools/objects/terrestrial-layers/rings.mjs';
import { prepareSolidPresentation } from '../../tools/objects/terrestrial-layers/solid-scene.mjs';
import { prepareObjectJson } from '../../tools/prepare-object-json.mjs';
for (const id of ['chariklo', 'bienor']) {
  const root = `src/planets/${id}`, sourceDirectory = `${root}/source`, outputDirectory = `${root}/prepared`, publicDirectory = `public/scenes/${id}`;
  const read = async file => JSON.parse(await readFile(file, 'utf8'));
  const config = await read(`${sourceDirectory}/preparation/terrestrial.json`);
  const scene = await read(`${outputDirectory}/scene.json`);
  const material = await read(`${outputDirectory}/material.json`);
  const controls = await read(`${outputDirectory}/controls.json`);
  if (config.rings) scene.rings = await prepareTerrestrialRings({ config, publicDirectory });
  const definition = await prepareSolidPresentation({ config, scene, material, controls, sourceDirectory, publicDirectory, outputDirectory });
  await writeFile(`${outputDirectory}/scene.json`, JSON.stringify(scene) + '\n');
  await writeFile(`${outputDirectory}/runtime.json`, JSON.stringify(definition) + '\n');
}
await prepareObjectJson(['chariklo', 'bienor']);
