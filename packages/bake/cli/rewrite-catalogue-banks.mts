/**
 * Rewrite published catalogue point banks through writeCatalogueBank, so each carries what that function now adds
 * (its spread and cells) without rerunning the recipe that made it: the points, their order and every other field are
 * kept. Only inventoried banks are rewritten, and only the inventory's own prepared entries are refreshed, so a stale file
 * left in `prepared/` never joins it. Publish the changed files to R2 after.
 *
 * Usage: node packages/bake/cli/rewrite-catalogue-banks.mts <object-directory>...
 */
import { readdir, readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { CATALOGUE_POINTS_SCHEMA } from '@cssearth/objects';
import { writeCatalogueBank } from '@cssearth/bake/volume/node';
import { inventoryPreparedAssets, readInventory } from '@cssearth/objects/node';

const objects = process.argv.slice(2);
if (!objects.length) throw new TypeError('Usage: rewrite-catalogue-banks.mts <object-directory>...');
for (const objectArgument of objects) {
  const objectDirectory = resolve(objectArgument), prepared = resolve(objectDirectory, 'prepared'), objectId = basename(objectDirectory);
  const inventoried = ((await readInventory(objectId, objectDirectory))?.assets ?? []).filter(asset => asset.location === 'prepared').map(asset => asset.filename);
  const inventory = () => inventoryPreparedAssets({ objectId, objectDirectory, filenames: inventoried });
  for (const name of (await readdir(prepared)).filter(file => file.endsWith('.json') && inventoried.includes(file)).sort()) {
    const bank = JSON.parse(await readFile(resolve(prepared, name), 'utf8')) as Record<string, unknown> & { schema?: unknown; points?: unknown };
    if (bank.schema !== CATALOGUE_POINTS_SCHEMA) continue;
    if (!Array.isArray(bank.points)) throw new TypeError(`${basename(objectDirectory)}/prepared/${name}: a catalogue point bank without points.`);
    const { spread: _spread, cells: _cells, ...rest } = bank;
    const id = name.slice(0, -'.json'.length);
    await writeCatalogueBank({ objectDirectory, id, bank: { ...rest, schema: bank.schema, points: bank.points }, published: true, inventory });
    console.log(`${basename(objectDirectory)}/${id}: ${bank.points.length} points rewritten.`);
  }
}
