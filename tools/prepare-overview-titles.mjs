import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as fontkit from 'fontkit';
import { createPlanetTitleSource } from './prepare-planet-title-sources.mjs';
import { PLANET_TITLE_RECIPE as recipe } from '../src/platform/planet-title-recipe.mjs';
import { createPreparedTitleLayout, sha256 } from '../src/platform/prepared-title.mjs';

const fontPath = fileURLToPath(new URL(`../${recipe.checkedFontPath}`, import.meta.url));
if (sha256(await readFile(fontPath)) !== recipe.sourceSha256) throw new Error('Shared card title font hash mismatch.');
const font = fontkit.openSync(fontPath).getVariation({ wght: recipe.weight, opsz: recipe.opticalSize });
const titles = Object.fromEntries([['solar-system', 'Solar System'], ['milky-way', 'Milky Way']].map(([id, label]) => {
  const source = createPlanetTitleSource(label, font);
  return [id, { ...source, ...createPreparedTitleLayout(source) }];
}));
await writeFile(new URL('../site/prepared-overview-titles.mjs', import.meta.url),
  `// Generated with the shared planet title recipe by tools/prepare-overview-titles.mjs.\nexport const OVERVIEW_TITLES = ${JSON.stringify(titles)};\n`);
