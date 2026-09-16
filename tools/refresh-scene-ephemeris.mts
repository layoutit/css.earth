import { readAuthoredSources } from './objects/authored-sources.ts';
import {parseObjectDescriptor} from '@cssearth/objects';
import {parseTerrestrialProfile} from './objects/terrestrial-layers/index.mts';
import {requireRecord,requireArray,requireString} from './source-values.mts';
import {requireObjectRuntimeDefinition} from './object-runtime-contract.mts';
import {validatePreparedCubicSky} from '../src/platform/cubic-sky-contract.mts';
import {validateDirectionalSunPlan} from '../src/platform/directional-sun-contract.mts';
// Re-publish numeric epoch state without acquiring or baking any image assets.
// Run after prepare:solar-geometry and source input restoration.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadSceneEpochEphemeris } from '../packages/astronomy/tools/scene-ephemeris.mts';
import { SOLAR_GEOMETRY_EPOCH_JD_TT } from '../src/platform/solar-geometry.mts';
import { refreshSolidSceneEpoch } from './objects/terrestrial-layers/solid-scene.mts';
import { prepareObjectJson } from './prepare-object-json.mts';

const states = await loadSceneEpochEphemeris(SOLAR_GEOMETRY_EPOCH_JD_TT);
const ids = [...states.keys()].filter(id => id !== 'earth');
for (const id of ids) {
  const directory = resolve('src/objects', id), output = resolve(directory, 'prepared');
  const descriptor = parseObjectDescriptor(await readFile(resolve(directory, 'object.json'), 'utf8'));
  const recipe=requireRecord(descriptor.properties.recipe);
  const source = requireArray(recipe.sources).map(value=>requireRecord(value)).find(source => source.id === 'terrestrial');
  if (!source) throw new TypeError(`No solid-observation epoch preparation for ${id}.`);
  const config = parseTerrestrialProfile((await readAuthoredSources(directory)).sources.get('terrestrial')?.value);
  if(config.kind!=='solid-observation-body') throw new TypeError(`Expected a solid epoch source: ${id}`);
  const input = requireRecord(JSON.parse(await readFile(resolve(output, 'scene.json'), 'utf8')));
  const scene={...input,bodyLeaves:requireArray(input.bodyLeaves),systemTransform:requireString(input.systemTransform),sky:validatePreparedCubicSky(input.sky),sun:validateDirectionalSunPlan(input.sun)};
  const definition = requireObjectRuntimeDefinition(JSON.parse(await readFile(resolve(output, 'runtime.json'), 'utf8')));
  const next = await refreshSolidSceneEpoch({ config, scene, definition });
  for (const [name, value] of Object.entries({ scene: next.scene, runtime: next.definition, sky: next.scene.sky, sun: next.scene.sun })) {
    await writeFile(resolve(output, `${name}.json`), `${JSON.stringify(value)}\n`);
  }
}
for (const result of await prepareObjectJson([...ids, 'earth', 'moon'])) console.log(JSON.stringify(result));
