/**
 * A planet's moons that have no page, each at its JPL Horizons position at the world's epoch.
 *
 * The pinned JPL moon catalogue (site/source/moon-catalogues.json) lists every confirmed moon with its Horizons code.
 * For each moon of the host without an object package this asks Horizons for the geometric position relative to the
 * host's centre, ICRF axes, kilometres, at the host's prepared epoch, and writes `name,xKm,yKm,zKm` into the
 * `<host>-minor-moons` package. A moon without an ephemeris is left out and named: the catalogue gives it no code, or
 * Horizons answers that code with another body (a new moon's code can be an asteroid's number). One request at a time.
 * A moon already in the table keeps its row: the table holds one epoch, so only a moon it lacks is asked for.
 *
 * Usage: node packages/bake/authoring/minor-moons/positions.mts <host id>
 */
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

/** The Horizons code of each planet's centre, the origin its moons are asked relative to. */
const HOST_CENTRES: Readonly<Record<string, string>> = { mars: '499', jupiter: '599', saturn: '699', uranus: '799', neptune: '899', pluto: '999' };

const host = process.argv[2] ?? '', centre = HOST_CENTRES[host];
if (!centre) throw new TypeError(`Usage: positions.mts <host id>; the host must be one of ${Object.keys(HOST_CENTRES).join(', ')}, got ${JSON.stringify(host)}.`);
const root = checkoutProjectRoot(import.meta.url), objects = resolve(root, 'src/objects');
const cataloguePath = resolve(root, 'site/source/moon-catalogues.json');
const catalogue = JSON.parse(await readFile(cataloguePath, 'utf8')) as { systems: { id: string; moons: { id: string; name: string; elements?: { code?: string | null } | null }[] }[] };
const system = catalogue.systems.find(entry => entry.id === host);
if (!system) throw new TypeError(`${cataloguePath}: systems has no ${host}.`);
const descriptorPath = resolve(objects, host, 'object.json');
const descriptor = JSON.parse(await readFile(descriptorPath, 'utf8')) as { properties: { worldFrame: { epochJdTt: number } } };
const epochJdTt = descriptor.properties.worldFrame.epochJdTt;
if (!Number.isFinite(epochJdTt)) throw new TypeError(`${descriptorPath} properties.worldFrame.epochJdTt must be a Julian date, got ${JSON.stringify(epochJdTt)}.`);

const unpaged = system.moons.filter(moon => !existsSync(resolve(objects, moon.id, 'object.json'))).map(moon => ({ name: moon.name, code: moon.elements?.code ?? null }));
const withoutEphemeris = unpaged.filter(moon => !moon.code), wanted = unpaged.filter(moon => moon.code);

/** The moon's position, or null when Horizons answers its code with another body. */
async function position(moon: { name: string; code: string | null }): Promise<{ km: [number, number, number]; solution: string } | null> {
  const query = new URLSearchParams({ format: 'text', COMMAND: `'${moon.code}'`, OBJ_DATA: `'NO'`, MAKE_EPHEM: `'YES'`, EPHEM_TYPE: `'VECTORS'`, CENTER: `'500@${centre}'`,
    TLIST: `'${epochJdTt}'`, TLIST_TYPE: `'JD'`, TIME_TYPE: `'TT'`, REF_PLANE: `'FRAME'`, REF_SYSTEM: `'ICRF'`, OUT_UNITS: `'KM-S'`, VEC_TABLE: `'1'`, CSV_FORMAT: `'YES'` });
  const url = `https://ssd.jpl.nasa.gov/api/horizons.api?${query}`;
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) }).catch((error: unknown) => error as Error);
    const text = response instanceof Error ? '' : await response.text();
    const row = text.match(/\$\$SOE\s*\n([^\n]+)\n\s*\$\$EOE/u)?.[1]?.split(',').map(field => field.trim());
    const target = text.match(/Target body name:([^{]*)\{source: ([^}]+)\}/u), km = row?.slice(2, 5).map(Number), solution = target?.[2];
    if (target && !target[1]?.includes(`(${moon.code})`)) return null;
    if (row && Number(row[0]) === epochJdTt && km?.length === 3 && km.every(Number.isFinite) && solution) return { km: km as [number, number, number], solution };
    if (attempt === 3) {
      throw new Error(`${moon.name} (Horizons ${moon.code}): no position at JD ${epochJdTt} TT after 3 requests of ${url}; ` +
        `the answer was ${response instanceof Error ? response.message : JSON.stringify(text.slice(0, 400))}.`);
    }
    await new Promise(done => setTimeout(done, 2000 * attempt));
  }
}

const output = resolve(objects, `${host}-minor-moons/source/dots/positions.csv.gz`);
const kept = new Map(existsSync(output) ? gunzipSync(await readFile(output)).toString('utf8').split('\n').slice(1).filter(Boolean).map(row => [row.slice(0, row.indexOf(',')), row] as const) : []);
const rows: string[] = [], solutions = new Map<string, number>();
let asked = 0;
for (const [index, moon] of wanted.entries()) {
  const row = kept.get(moon.name);
  if (row) { rows.push(row); continue; }
  asked++;
  const found = await position(moon);
  if (!found) { withoutEphemeris.push(moon); continue; }
  const { km, solution } = found;
  rows.push(`${moon.name},${km.map(value => value.toFixed(1)).join(',')}`);
  solutions.set(solution, (solutions.get(solution) ?? 0) + 1);
  if ((index + 1) % 25 === 0 || index + 1 === wanted.length) console.log(`${index + 1}/${wanted.length}`);
}
await writeFile(output, gzipSync(`name,xKm,yKm,zKm\n${rows.join('\n')}\n`));
console.log(`Wrote ${rows.length} positions at JD ${epochJdTt} TT to ${output}.`);
console.log(`Asked Horizons for ${asked} of them; their solutions: ${[...solutions].map(([name, count]) => `${name} (${count})`).join(', ') || 'none'}.`);
console.log(`Without an ephemeris, left out: ${withoutEphemeris.map(moon => moon.name).join(', ') || 'none'}.`);
