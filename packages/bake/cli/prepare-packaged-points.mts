/**
 * Prepare a bank of the star packages that are dots of a galaxy: `source/<id>/points.json` names a
 * `name,xKpc,yKpc,zKpc,color` table of Sun-centred positions in the world's frame, written by its `generator` from the
 * packages' own prepared places. Each row is one dot in its own color snapped to `appearance.colorLevels` steps a
 * channel, at its place rounded to 1e-4 kpc as every merged bank is. The bank is a bake input for merge-catalogue-points.mts (`output/catalogue-points/<object>/<id>.json`).
 *
 * Usage: node packages/bake/cli/prepare-packaged-points.mts <object-directory> <id>
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { CATALOGUE_POINTS_SCHEMA } from '@cssearth/objects';
import { writeCatalogueBank } from '@cssearth/bake/volume/node';

const KPC_M = 3.0856775814913673e19;
const [objectDirectoryArgument, id] = process.argv.slice(2);
if (!objectDirectoryArgument || !id || !/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Usage: prepare-packaged-points.mts <object-directory> <id>');
const objectDirectory = resolve(objectDirectoryArgument), sourceDirectory = resolve(objectDirectory, 'source', id), recipePath = resolve(sourceDirectory, 'points.json');
const recipe = JSON.parse(await readFile(recipePath, 'utf8')) as { schema?: unknown; id?: unknown; source?: unknown; meaning?: unknown;
  table?: { path?: unknown; generator?: unknown }; frame?: { referenceFrame?: unknown; epochJdTt?: unknown };
  appearance?: { radiusPx?: unknown; opacity?: unknown; colorLevels?: unknown; colorLevelsBasis?: unknown } };
const fail = (message: string): never => { throw new TypeError(`${recipePath}: ${message}`); };
if (recipe.schema !== 'cssearth-packaged-points-source@1' || recipe.id !== id) fail(`needs schema cssearth-packaged-points-source@1 and id ${id}.`);
if (typeof recipe.source !== 'string' || typeof recipe.meaning !== 'string') fail('needs its source and meaning.');
if (typeof recipe.table?.path !== 'string' || typeof recipe.table.generator !== 'string') fail('table names its path and the generator that writes it.');
if (typeof recipe.frame?.referenceFrame !== 'string' || typeof recipe.frame.epochJdTt !== 'number') fail('frame names the reference frame and epoch of the table.');
const { radiusPx, opacity } = recipe.appearance ?? {};
// Each color channel is snapped to `colorLevels` even steps: the app paints one path per color, and every star's own
// color would be a path of its own.
const colorLevels = recipe.appearance?.colorLevels;
if (!(Number.isInteger(colorLevels) && (colorLevels as number) >= 2 && (colorLevels as number) <= 256) || typeof recipe.appearance?.colorLevelsBasis !== 'string') {
  fail('appearance.colorLevels is a whole number of steps per color channel from 2 to 256, with its colorLevelsBasis.');
}
const snapped = (color: string) => '#' + [1, 3, 5].map(at => Math.round(Math.round(parseInt(color.slice(at, at + 2), 16) / 255 * ((colorLevels as number) - 1)) / ((colorLevels as number) - 1) * 255)
  .toString(16).padStart(2, '0')).join('');
if (!(typeof radiusPx === 'number' && radiusPx > 0) || !(typeof opacity === 'number' && opacity > 0 && opacity <= 1)) fail('appearance needs a positive radiusPx and an opacity in (0, 1].');

const tablePath = resolve(sourceDirectory, recipe.table!.path as string);
const [header, ...lines] = gunzipSync(await readFile(tablePath)).toString('utf8').trim().split('\n');
if (header !== 'name,xKpc,yKpc,zKpc,color') throw new TypeError(`${tablePath}: the header is ${JSON.stringify(header)}, not name,xKpc,yKpc,zKpc,color.`);
const rows = lines.map((line, index) => {
  const [name, x, y, z, color] = line.split(',');
  const position = [Number(x), Number(y), Number(z)];
  if (!name || !/^[a-z][a-z0-9-]*$/u.test(name) || !position.every(Number.isFinite) || !/^#[0-9a-f]{6}$/u.test(color ?? '')) {
    throw new TypeError(`${tablePath}: row ${index + 2} is ${JSON.stringify(line)}, not an object id, three kiloparsecs and a #rrggbb color.`);
  }
  // Four decimals of a kiloparsec, as the table writes them: a merged bank's own grid.
  if (position.some(value => Math.round(value * 1e4) / 1e4 !== value)) throw new TypeError(`${tablePath}: row ${index + 2} (${name}) is not written to four decimals of a kiloparsec.`);
  return { name, position, color: snapped(color!) };
});
if (!rows.length) throw new TypeError(`${tablePath}: holds no row.`);
const palette = [...new Set(rows.map(row => row.color))].sort();
const reach = Math.ceil(Math.max(...rows.flatMap(row => row.position.map(Math.abs))));
const bank = { schema: CATALOGUE_POINTS_SCHEMA, id, source: recipe.source, meaning: recipe.meaning,
  frame: { referenceFrame: recipe.frame!.referenceFrame, epochJdTt: recipe.frame!.epochJdTt, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: KPC_M,
    boundsUnits: { min: [-reach, -reach, -reach], max: [reach, reach, reach] } },
  appearance: { colorCss: palette[0]!, radiusPx, opacity, palette },
  counts: { rows: rows.length, points: rows.length },
  conversion: 'Sun-centred positions of the table, in kiloparsecs to four decimals, as written.',
  names: rows.map(row => row.name),
  points: rows.map(row => [...row.position, palette.indexOf(row.color)]) };
const outputPath = await writeCatalogueBank({ objectDirectory, id, bank, published: false });
console.log(`Prepared ${rows.length} packaged stars in ${palette.length} colors: ${outputPath}.`);
