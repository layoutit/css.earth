/**
 * Prepare a catalogue point bank centred on a body: `source/<id>/points.json` (cssearth-body-points-source@1) names a
 * `name,xKm,yKm,zKm` table of positions relative to its host, and the bank is written at the host's prepared world
 * position, as the app draws it (packages/bake/src/volume/node/body-points.ts). The package's descriptor names the same
 * host, so the dots draw while that body or one that orbits it is selected.
 *
 * Usage: node packages/bake/cli/prepare-body-points.mts <object-directory> <id>
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { bodyCentredBank, parseBodyPointsRecipe, parseBodyPointsTable, recipePublished, writeCatalogueBank } from '@cssearth/bake/volume/node';

const [objectDirectoryArgument, id] = process.argv.slice(2);
if (!objectDirectoryArgument || !id || !/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Usage: prepare-body-points.mts <object-directory> <id>');
const objectDirectory = resolve(objectDirectoryArgument), sourceDirectory = resolve(objectDirectory, 'source', id), recipePath = resolve(sourceDirectory, 'points.json');
const raw = JSON.parse(await readFile(recipePath, 'utf8')) as Record<string, unknown>;
const recipe = parseBodyPointsRecipe(raw, recipePath);
if (recipe.id !== id) throw new TypeError(`${recipePath}: id is ${recipe.id}, not ${id}.`);
const hostPath = resolve(objectDirectory, '..', recipe.host, 'object.json');
const host = JSON.parse(await readFile(hostPath, 'utf8')) as { properties?: { worldFrame?: { referenceFrame?: unknown; epochJdTt?: unknown; originM?: unknown } } };
const worldFrame = host.properties?.worldFrame;
if (!worldFrame || typeof worldFrame.referenceFrame !== 'string' || typeof worldFrame.epochJdTt !== 'number' || !Array.isArray(worldFrame.originM)) {
  throw new TypeError(`${hostPath}: properties.worldFrame must name a reference frame, an epoch and an origin; ${recipe.host} is not a placed body.`);
}
const descriptor = JSON.parse(await readFile(resolve(objectDirectory, 'object.json'), 'utf8')) as { properties?: { host?: unknown } };
if (descriptor.properties?.host !== recipe.host) {
  throw new TypeError(`${resolve(objectDirectory, 'object.json')} properties.host is ${JSON.stringify(descriptor.properties?.host)}, but ${recipePath} places the bank at ${recipe.host}.`);
}
const tablePath = resolve(sourceDirectory, recipe.table.path);
const rows = parseBodyPointsTable(await readFile(tablePath, 'utf8'), tablePath);
const bank = bodyCentredBank({ recipe, rows, hostFrame: { referenceFrame: worldFrame.referenceFrame, epochJdTt: worldFrame.epochJdTt, originM: worldFrame.originM as number[] } });
const outputPath = await writeCatalogueBank({ objectDirectory, id, bank, published: recipePublished(raw, recipePath) });
console.log(`Prepared ${rows.length} points around ${recipe.host} into ${outputPath}.`);
