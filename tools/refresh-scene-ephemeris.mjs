// Re-publish numeric epoch state without acquiring or baking any image assets.
// Run after prepare:solar-geometry and source input restoration.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadSceneEpochEphemeris } from '../packages/astronomy/tools/scene-ephemeris.mjs';
import { SOLAR_GEOMETRY_EPOCH_JD_TT } from '../src/platform/solar-geometry.mjs';
import { refreshSolidSceneEpoch } from './objects/terrestrial-layers/solid-scene.mjs';
import { prepareObjectJson } from './prepare-object-json.mjs';

const states = await loadSceneEpochEphemeris(SOLAR_GEOMETRY_EPOCH_JD_TT);
const ids = [...states.keys()].filter(id => id !== 'earth');
for (const id of ids) {
  const directory = resolve('src/planets', id), output = resolve(directory, 'prepared');
  const descriptor = JSON.parse(await readFile(resolve(directory, 'object.json'), 'utf8'));
  const source = descriptor.properties.recipe.sources.find(source => source.id === 'terrestrial');
  if (!source) throw new TypeError(`No solid-observation epoch preparation for ${id}.`);
  const bytes = await readFile(resolve(directory, source.path));
  if (createHash('sha256').update(bytes).digest('hex') !== source.sha256) throw new TypeError(`Epoch preparation source pin differs: ${id}.`);
  const config = JSON.parse(bytes.toString('utf8'));
  const scene = JSON.parse(await readFile(resolve(output, 'scene.json'), 'utf8'));
  const definition = JSON.parse(await readFile(resolve(output, 'runtime.json'), 'utf8'));
  const next = await refreshSolidSceneEpoch({ config, scene, definition });
  for (const [name, value] of Object.entries({ scene: next.scene, runtime: next.definition, sky: next.scene.sky, sun: next.scene.sun })) {
    await writeFile(resolve(output, `${name}.json`), `${JSON.stringify(value)}\n`);
  }
}
for (const result of await prepareObjectJson([...ids, 'earth', 'moon'])) console.log(JSON.stringify(result));
