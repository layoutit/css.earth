import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { parsePreparedClusterCatalog } from '@cssearth/objects';
import { requireRecord as record } from '@cssearth/core';
import { sha256 } from '@cssearth/core/node';
import { readInventory, updateInventory } from '@cssearth/objects/node';
import { parseMcxcRows, prepareClusterCatalog, type ClusterGroupDistance, type ClusterRecipe } from './prepare.ts';

/** Every group's distance in a Cosmicflows-4 table with `G1PGC` and `GDMzp` columns (the Nearby Universe's tracked table,
 * `packages/bake/authoring/nearby-universe/cf4-groups.mts`), in parsecs. */
export function readClusterGroupDistances(csv: string, path: string): Map<string, ClusterGroupDistance> {
  const [header, ...rows] = csv.trim().split('\n'), names = header!.split(',');
  const group = names.indexOf('G1PGC'), modulus = names.indexOf('GDMzp');
  if (group < 0 || modulus < 0) throw new TypeError(`${path}: needs G1PGC and GDMzp columns, not "${header}".`);
  const distances = new Map<string, ClusterGroupDistance>();
  for (const row of rows) {
    const fields = row.split(','), id = fields[group]!, text = fields[modulus]!;
    if (!text) continue;
    const valuePc = 10 ** (Number(text) / 5 + 1), known = distances.get(id);
    if (!Number.isFinite(valuePc)) throw new TypeError(`${path}: group ${id} has distance modulus ${JSON.stringify(text)}.`);
    if (known && known.valuePc !== valuePc) throw new TypeError(`${path}: group ${id}'s members name different distance moduli.`);
    distances.set(id, { group: id, valuePc });
  }
  return distances;
}

/** Prepare the galaxy-cluster catalogue object: its catalogue from the pinned MCXC-II table, placed at the Cosmicflows-4
 * group distances, written with its inventory into the object's own `prepared/`. */
export async function prepareClusterCatalogObject(options: { objectDirectory: string }) {
  const objectDirectory = resolve(options.objectDirectory), sourceDirectory = resolve(objectDirectory, 'source');
  const descriptor = record(JSON.parse(await readFile(resolve(objectDirectory, 'object.json'), 'utf8').catch((error: unknown) => {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') throw new TypeError(`${objectDirectory}/object.json: authored descriptor id is required.`);
    throw error;
  })), 'object.json');
  if (typeof descriptor.id !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(descriptor.id)) throw new TypeError(`${objectDirectory}/object.json: authored descriptor id is required.`);
  const objectId = descriptor.id;
  if (objectId !== basename(objectDirectory)) throw new TypeError(`${objectDirectory}/object.json: authored descriptor id ${JSON.stringify(objectId)} must match directory ${JSON.stringify(basename(objectDirectory))}.`);
  const recipe = record(JSON.parse(await readFile(resolve(sourceDirectory, 'catalogue.json'), 'utf8')), 'Cluster recipe') as unknown as ClusterRecipe;
  const pinned = async (id: string) => {
    const source = recipe.sources.find(candidate => candidate.id === id);
    if (!source) throw new TypeError(`${resolve(sourceDirectory, 'catalogue.json')}: no source ${id}.`);
    const path = resolve(sourceDirectory, source.path), bytes = await readFile(path);
    if (bytes.length !== source.bytes) throw new TypeError(`${path} has ${bytes.length} bytes; its source record pins ${source.bytes}.`);
    return { path, text: gunzipSync(bytes).toString('latin1') };
  };
  const table = await pinned(recipe.catalogueSourceId), groups = await pinned(recipe.groupDistanceSourceId);
  const data = prepareClusterCatalog(parseMcxcRows(table.text), recipe, readClusterGroupDistances(groups.text, groups.path));
  parsePreparedClusterCatalog(data);
  const bytes = Buffer.from(JSON.stringify(data) + '\n'), path = resolve(objectDirectory, 'prepared/catalogue.json');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.tmp`, bytes); await rename(`${path}.tmp`, path);
  const current = await readInventory(objectId, objectDirectory);
  const kept = current?.assets.filter(asset => asset.location === 'prepared' && asset.filename !== 'catalogue.json') ?? [];
  await updateInventory({ objectId, objectDirectory, location: 'prepared', assets: [...kept, { filename: 'catalogue.json', bytes: bytes.length, sha256: sha256(bytes) }] });
  console.log(`PREPARED CLUSTER CATALOGUE: ${JSON.stringify({ path, bytes: bytes.length, clusters: data.objects.map(object => `${object.id} ${(object.distance.valuePc / 1e6).toFixed(1)} Mpc${object.detailedObjectId ? ` -> ${object.detailedObjectId}` : ''}`) })}`);
}
