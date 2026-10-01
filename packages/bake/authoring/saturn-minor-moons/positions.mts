/**
 * Saturn's moons that have no page, each at its JPL Horizons position at the world's epoch.
 *
 * The retained JPL catalogue (src/objects/saturn/source/moons/saturn-moons.json) lists every confirmed moon with its
 * Horizons code. For each one without an object package this asks Horizons for the geometric position relative to
 * Saturn's centre, ICRF axes, kilometres, at Saturn's prepared epoch, and writes `name,xKm,yKm,zKm`. A moon the catalogue
 * gives no code (no ephemeris) is left out and named. One request at a time.
 *
 * Usage: node packages/bake/authoring/saturn-minor-moons/positions.mts
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../../..'), objects = resolve(root, 'src/objects');
const cataloguePath = resolve(objects, 'saturn/source/moons/saturn-moons.json');
const catalogue = JSON.parse(await readFile(cataloguePath, 'utf8')) as { moons: { id: string; name: string; code?: string | null }[] };
const saturn = JSON.parse(await readFile(resolve(objects, 'saturn/object.json'), 'utf8')) as { properties: { worldFrame: { epochJdTt: number } } };
const epochJdTt = saturn.properties.worldFrame.epochJdTt;
if (!Number.isFinite(epochJdTt)) throw new TypeError(`src/objects/saturn/object.json properties.worldFrame.epochJdTt must be a Julian date, got ${JSON.stringify(epochJdTt)}.`);

const unpaged = catalogue.moons.filter(moon => !existsSync(resolve(objects, moon.id, 'object.json')));
const withoutEphemeris = unpaged.filter(moon => !moon.code), wanted = unpaged.filter(moon => moon.code);

async function position(moon: { name: string; code?: string | null }): Promise<{ km: [number, number, number]; solution: string }> {
  const query = new URLSearchParams({ format: 'text', COMMAND: `'${moon.code}'`, OBJ_DATA: `'NO'`, MAKE_EPHEM: `'YES'`, EPHEM_TYPE: `'VECTORS'`, CENTER: `'500@699'`,
    TLIST: `'${epochJdTt}'`, TLIST_TYPE: `'JD'`, TIME_TYPE: `'TT'`, REF_PLANE: `'FRAME'`, REF_SYSTEM: `'ICRF'`, OUT_UNITS: `'KM-S'`, VEC_TABLE: `'1'`, CSV_FORMAT: `'YES'` });
  const url = `https://ssd.jpl.nasa.gov/api/horizons.api?${query}`;
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) }).catch((error: unknown) => error as Error);
    const text = response instanceof Error ? '' : await response.text();
    const row = text.match(/\$\$SOE\s*\n([^\n]+)\n\s*\$\$EOE/u)?.[1]?.split(',').map(field => field.trim());
    const km = row?.slice(2, 5).map(Number), solution = text.match(/Target body name:[^{]*\{source: ([^}]+)\}/u)?.[1];
    if (row && Number(row[0]) === epochJdTt && km?.length === 3 && km.every(Number.isFinite) && solution) return { km: km as [number, number, number], solution };
    if (attempt === 3) {
      throw new Error(`${moon.name} (Horizons ${moon.code}): no position at JD ${epochJdTt} TT after 3 requests of ${url}; ` +
        `the answer was ${response instanceof Error ? response.message : JSON.stringify(text.slice(0, 400))}.`);
    }
    await new Promise(done => setTimeout(done, 2000 * attempt));
  }
}

const rows: string[] = [], solutions = new Map<string, number>();
for (const [index, moon] of wanted.entries()) {
  const { km, solution } = await position(moon);
  rows.push(`${moon.name},${km.map(value => value.toFixed(1)).join(',')}`);
  solutions.set(solution, (solutions.get(solution) ?? 0) + 1);
  if ((index + 1) % 25 === 0 || index + 1 === wanted.length) console.log(`${index + 1}/${wanted.length}`);
}
const output = resolve(objects, 'saturn-minor-moons/source/dots/positions.csv');
await writeFile(output, `name,xKm,yKm,zKm\n${rows.join('\n')}\n`);
console.log(`Wrote ${rows.length} positions at JD ${epochJdTt} TT to ${output}.`);
console.log(`Horizons solutions: ${[...solutions].map(([name, count]) => `${name} (${count})`).join(', ')}.`);
console.log(`Without an ephemeris, left out: ${withoutEphemeris.map(moon => moon.name).join(', ') || 'none'}.`);
