/**
 * Bring an object's published banks to their packed delivery form (@cssearth/objects prepared-binary.ts) without rerunning
 * the preparation that made them. A catalogue point bank is rewritten through writeCatalogueBank, which packs it as
 * `<id>.bin` with its spread and cells, from either form it is inventoried in (the `.bin` or the `.json` it replaces);
 * its points, their order and every other field are kept. An orbit bank (`CSWO`) or point-field bank (`CSEPFB01`) still
 * published raw is packed in place with the regions its own decoder names; a packed file is left alone. Only inventoried
 * files are read, and only the inventory's own prepared entries are refreshed, so a stale file left in `prepared/` never
 * joins it. Publish the changed files to R2 after.
 *
 * Usage: node packages/bake/cli/pack-prepared-banks.mts <object-directory>...
 */
import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { CATALOGUE_POINTS_SCHEMA, decodeCatalogueBankBinary, worldOrbitBankRegions, POINT_FIELD_BANK_MAGIC, pointFieldBankRegions } from '@cssearth/objects';
import { writeCatalogueBank } from '@cssearth/bake/volume/node';
import { inventoryPreparedAssets, packPreparedBinary, readInventory, unpackPreparedBinary } from '@cssearth/objects/node';

// Non-catalogue binary formats share the inventory; decode only their published bytes.
function decodePublishedBank(bytes: Uint8Array, path: string): unknown {
  try { return decodeCatalogueBankBinary(unpackPreparedBinary(bytes, path), path); }
  catch { return null; }
}

const objects = process.argv.slice(2);
if (!objects.length) throw new TypeError('Usage: pack-prepared-banks.mts <object-directory>...');
const startsWith = (bytes: Uint8Array, text: string) => text.length <= bytes.length && [...text].every((char, index) => bytes[index] === char.charCodeAt(0));
for (const objectArgument of objects) {
  const objectDirectory = resolve(objectArgument), prepared = resolve(objectDirectory, 'prepared'), objectId = basename(objectDirectory);
  const inventoried = ((await readInventory(objectId, objectDirectory))?.assets ?? []).filter(asset => asset.location === 'prepared').map(asset => asset.filename);
  const banks: { id: string; bank: Record<string, unknown> & { points: unknown[] } }[] = [];
  let packed = 0;
  for (const name of [...inventoried].sort()) {
    const path = resolve(prepared, name);
    if (name.endsWith('.bin')) {
      const bytes = new Uint8Array(await readFile(path));
      const regions = startsWith(bytes, 'CSWO') ? worldOrbitBankRegions(bytes, `${objectId}/${name}`)
        : startsWith(bytes, POINT_FIELD_BANK_MAGIC) ? pointFieldBankRegions(bytes, `${objectId}/${name}`) : null;
      if (regions) { await writeFile(path, packPreparedBinary(bytes, regions, `${objectId}/${name}`)); packed++; continue; }
    }
    if (!/^[^/]+\.(json|bin)$/u.test(name)) continue;
    const id = name.replace(/\.(json|bin)$/u, '');
    const bank = name.endsWith('.json') ? JSON.parse(await readFile(path, 'utf8')) as unknown
      : decodePublishedBank(await readFile(path), path);
    const record = bank as { schema?: unknown; points?: unknown } | null;
    if (record?.schema !== CATALOGUE_POINTS_SCHEMA) continue;
    if (!Array.isArray(record.points)) throw new TypeError(`${objectId}/prepared/${name}: a catalogue point bank without points.`);
    banks.push({ id, bank: record as Record<string, unknown> & { points: unknown[] } });
  }
  const renamed = new Set(banks.map(({ id }) => `${id}.json`));
  const filenames = [...new Set(inventoried.map(name => renamed.has(name) ? name.replace(/\.json$/u, '.bin') : name))];
  // One inventory refresh once every bank is written: until then a renamed bank's `.bin` does not exist yet.
  for (const { id, bank } of banks) {
    const { spread: _spread, cells: _cells, ...rest } = bank;
    await writeCatalogueBank({ objectDirectory, id, bank: { ...rest, schema: bank.schema, points: bank.points }, published: true, inventory: async () => {} });
  }
  if (banks.length || packed) await inventoryPreparedAssets({ objectId, objectDirectory, filenames });
  console.log(`${objectId}: ${banks.length} catalogue banks written, ${packed} raw banks packed.`);
}
