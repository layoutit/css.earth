import { sha256 } from '../../src/platform/sha256.mts';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as fontkit from 'fontkit';
import { createPlanetTitleSource } from './prepare-planet-title-sources.mts';
import { PLANET_TITLE_RECIPE as recipe } from '../../src/platform/planet-title-recipe.mts';
import { createPreparedTitleLayout } from '../../src/platform/prepared-title.mts';

const fontPath = fileURLToPath(new URL(`../../${recipe.checkedFontPath}`, import.meta.url));
const baseFont = fontkit.openSync(fontPath);
if (!("getVariation" in baseFont)) throw new TypeError("The pinned overview font must be one font face.");
const font = baseFont.getVariation({ wght: recipe.weight, opsz: recipe.opticalSize });
const title = (label: string) => {
  const source = createPlanetTitleSource(label, font);
  return { ...source, ...createPreparedTitleLayout(source) };
};
const titles = Object.fromEntries([['milky-way', 'Milky Way'], ['local-group', 'Local Group'], ['nearby-universe', 'Nearby Universe']].map(([id, label]) => [id, title(label!)]));
// Every planetary system's overview card, keyed by its star: the Solar System and each placed star's system.
const { SCENE_OBJECTS } = await import('../../site/objects.mts');
const { allPlanetarySystems } = await import('../../site/object-systems.mts');
const systems = Object.fromEntries(allPlanetarySystems(SCENE_OBJECTS).map(system => [system.id, title(system.name)]));
await writeFile(new URL('../../site/prepared-overview-titles.mjs', import.meta.url),
  `// Generated with the shared planet title recipe by tools/prepare-overview-titles.mts.\nexport const OVERVIEW_TITLES = ${JSON.stringify(titles)};\nexport const SYSTEM_TITLES = ${JSON.stringify(systems)};\n`);
