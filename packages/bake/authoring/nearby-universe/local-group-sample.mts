/**
 * The Nearby Universe's Local Group dots: every galaxy of the prepared Local Group catalogue (LVDB v1.1.1, its eligible
 * rows) nearer than the Cosmicflows-4 field's inner edge, so the dots continue inside it. Galaxies drawn as their own
 * detailed objects (`detailedObjectId`: M31, M33, the Magellanic Clouds) are left out. Each row keeps the catalogue's
 * adopted distance and sky position, and LVDB's apparent V magnitude for its tone.
 *
 * Inputs: `src/objects/local-group-galaxies/prepared/catalogue.json` (restored by `pnpm setup:prepared`) and its source table
 * `src/objects/local-group-galaxies/source/lvdb/comb_all.csv`.
 * Output: `source/local-group-galaxies/lvdb-sample.csv.gz`. It prints what it kept.
 */
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
// Entry script: node packages/bake/authoring/nearby-universe/local-group-sample.mts
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const repository = checkoutProjectRoot(import.meta.url);
const catalogPath = resolve(repository, 'src/objects/local-group-galaxies/prepared/catalogue.json');
const tablePath = resolve(repository, 'src/objects/local-group-galaxies/source/lvdb/comb_all.csv');
const outputPath = resolve(repository, 'src/objects/nearby-universe-galaxies/source/local-group-galaxies/lvdb-sample.csv.gz');
const fieldPath = resolve(repository, 'src/objects/nearby-universe-galaxies/source/galaxies/points.json');

// The field's inner edge, measured: its nearest galaxy, from the tracked Cosmicflows-4 table its recipe reads (distance
// moduli), so the Local Group dots stop where Cosmicflows-4's start.
const field = JSON.parse(await readFile(fieldPath, 'utf8')) as { table?: { path?: unknown; gzip?: unknown; columns?: { distance?: unknown }; distanceUnit?: unknown } };
const innerEdgePc = await innerEdge(field.table);
const catalog = JSON.parse(await readFile(catalogPath, 'utf8')) as { objects?: unknown };
if (!Array.isArray(catalog.objects)) throw new TypeError(`${catalogPath}: expected the prepared catalogue's objects.`);
const [header, ...lines] = (await readFile(tablePath, 'utf8')).trim().split('\n');
const names = header!.split(','), keyAt = names.indexOf('key'), magnitudeAt = names.indexOf('apparent_magnitude_v');
if (keyAt < 0 || magnitudeAt < 0) throw new TypeError(`${tablePath}: needs key and apparent_magnitude_v columns.`);
// comb_all.csv quotes no field that holds a comma before these columns, so a plain split reads them.
const magnitudes = new Map(lines.map(line => { const fields = line.split(','); return [fields[keyAt]!, fields[magnitudeAt]!] as const; }));
const rows = catalog.objects.flatMap((raw: unknown, index: number) => {
  const object = raw as { id?: unknown; skyPosition?: { raDeg?: unknown; decDeg?: unknown }; distance?: { valuePc?: unknown }; detailedObjectId?: unknown };
  const { id, skyPosition, distance } = object;
  if (typeof id !== 'string' || typeof skyPosition?.raDeg !== 'number' || typeof skyPosition.decDeg !== 'number' || typeof distance?.valuePc !== 'number') {
    throw new TypeError(`${catalogPath}: object ${index} (${String(id)}) needs an id, skyPosition.raDeg, skyPosition.decDeg and distance.valuePc.`);
  }
  if (object.detailedObjectId !== undefined || distance.valuePc >= innerEdgePc) return [];
  if (!magnitudes.has(id)) throw new TypeError(`${catalogPath}: ${id} has no row in ${tablePath}.`);
  return [`${id},${skyPosition.raDeg},${skyPosition.decDeg},${distance.valuePc},${magnitudes.get(id)}`];
});
await writeFile(outputPath, gzipSync(['key,ra,dec,distance_pc,apparent_magnitude_v', ...rows].join('\n') + '\n', { level: 9 }));
console.log(JSON.stringify({ catalogue: catalog.objects.length, innerEdgePc, kept: rows.length, output: outputPath }));

async function innerEdge(table: typeof field.table) {
  const column = table?.columns?.distance;
  if (typeof table?.path !== 'string' || table.gzip !== true || table.distanceUnit !== 'distance-modulus' || typeof column !== 'number') {
    throw new TypeError(`${fieldPath}: expected a gzipped table of distance moduli with a distance column; got ${JSON.stringify(table)}.`);
  }
  const path = resolve(fieldPath, '..', table.path), [, ...rows] = gunzipSync(await readFile(path)).toString('utf8').trim().split('\n');
  const moduli = rows.map(row => Number(row.split(',')[column - 1])).filter(Number.isFinite);
  if (!moduli.length) throw new TypeError(`${path}: no distance modulus in column ${column}.`);
  return 10 ** (Math.min(...moduli) / 5 + 1);
}
