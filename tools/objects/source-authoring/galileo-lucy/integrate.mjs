import { readFile, writeFile } from 'node:fs/promises';
import { bodies } from './catalog.mjs';
import { OBJECTS } from '../../../../site/objects.mjs';
import { parseVectors } from '../../../../packages/astronomy/tools/lib/horizons.mjs';
const write = async (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
let registry = await readFile('site/objects.mjs', 'utf8'), astronomy = await readFile('packages/astronomy/src/bodies.ts', 'utf8');
const universe = JSON.parse(await readFile('src/planets/sun/source/navigation/universe.json', 'utf8'));
const dinkineshState = parseVectors(await readFile('packages/astronomy/tools/.cache/horizons/asteroid-vectors-dinkinesh.txt', 'utf8'), 'dinkinesh')[1];
const distance = Math.hypot(...dinkineshState.position) / 149597870.7;
for (const body of bodies) {
  const distanceAu = body.id === 'dactyl' ? OBJECTS.find(object => object.id === 'ida').distanceAu : distance;
  const descriptor = `${body.id}Descriptor`;
  if (!registry.includes(`object("${body.id}",`)) {
    registry = `import ${descriptor} from "../src/planets/${body.id}/object.json" with { type: "json" };\n` + registry;
    registry = registry.replace('export const OBJECTS = defineObjects([', `export const OBJECTS = defineObjects([\n  object(${JSON.stringify(body.id)}, ${JSON.stringify(body.name)}, "${body.parent === 'sun' ? 'asteroid' : 'satellite'}", "#a0a0a0", ${distanceAu},\n    ${JSON.stringify(body.introduction)}, packaged(${descriptor}), ${descriptor}.properties.worldFrame),`);
  }
  if (!astronomy.includes(`'${body.id}': body(`)) astronomy = astronomy.replace("  'asteroid-2001-sn263': body", `  '${body.id}': body('${body.id}', '${body.name}', ${body.id === 'dinkinesh' ? "'152830;'" : 'null'}, ${body.radiusKm}, 0, '${body.parent}'),\n  'asteroid-2001-sn263': body`);
  if (!universe.bodies.some(item => item.id === body.id)) universe.bodies.push({ id: body.id, name: body.name, color: '#a0a0a0', ...(body.parent !== 'sun' ? { placement: 'approximate' } : {}) });
  const path = `src/planets/${body.id}/source/preparation/terrestrial.json`, config = JSON.parse(await readFile(path, 'utf8'));
  config.distanceAu = distanceAu; await write(path, config);
}
astronomy = astronomy.replace("export type AsteroidId = 'vesta'", "export type AsteroidId = 'dinkinesh' | 'vesta'")
  .replace("export const ASTEROID_IDS: readonly AsteroidId[] = ['vesta'", "export const ASTEROID_IDS: readonly AsteroidId[] = ['dinkinesh', 'vesta'");
await writeFile('site/objects.mjs', registry); await writeFile('packages/astronomy/src/bodies.ts', astronomy);
await write('src/planets/sun/source/navigation/universe.json', universe);
