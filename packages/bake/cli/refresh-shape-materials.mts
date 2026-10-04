import { projectRoot as checkoutProjectRoot, sha256 } from '@cssearth/core/node';
// Entry script: node packages/bake/cli/refresh-shape-materials.mts <object-id>... | --all [--resume] [--descriptions-only]
// [--source-root=<path>] [--shard=<index>/<count>]. The work is in @cssearth/bake/refresh-shape-materials, with the
// generated solar geometry this entry loads from the checkout.
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import type { SolarGeometry } from '@cssearth/bake/objects/scene';
import { readInventory, readPreparedObjects } from '@cssearth/objects/node';
import { anyChangedAfter } from '@cssearth/bake/preparation';
import { refreshShapeMaterialDescriptions, refreshShapeMaterials } from '@cssearth/bake/refresh-shape-materials';

const projectRoot = checkoutProjectRoot(import.meta.url);
const SCENE_OBJECTS = readPreparedObjects(projectRoot).sceneObjects;
const records = (value: unknown) => requireArray(value).map(value => requireRecord(value));
const json = async (path: string) => requireRecord(JSON.parse(await readFile(path, 'utf8')));

const args = process.argv.slice(2), sourceOption = args.find(arg => arg.startsWith('--source-root='));
const sourceRoot = sourceOption ? resolve(projectRoot, sourceOption.slice('--source-root='.length)) : undefined, requested = args.filter(arg => !arg.startsWith('--'));
const allIds = args.includes('--all') ? SCENE_OBJECTS.map(object => object.id) : requested;
const shard = args.find(arg => arg.startsWith('--shard='))?.slice('--shard='.length).split('/').map(Number);
if (shard && (shard.length !== 2 || !shard.every(Number.isSafeInteger) || shard[0] < 0 || shard[1] < 1 || shard[0] >= shard[1] || shard[1] > 4))
  throw new Error('Shard must be an index/count with at most four independent object batches.');
const ids = shard ? allIds.filter((_id, index) => index % shard[1] === shard[0]) : allIds;
if (!ids.length) throw new Error('Choose existing object ids or --all.');
let solarGeometry: SolarGeometry | undefined;
for (const id of ids) {
  if (args.includes('--all')) {
    let recipe;
    try { recipe = await json(resolve(projectRoot, 'src/objects', id, 'source/preparation/terrestrial.json')); }
    catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') continue; throw error; }
    if (!requireArray(requireRecord(recipe.raster).shapeViews ?? []).length) continue;
  }
  if (args.includes('--descriptions-only')) {
    await refreshShapeMaterialDescriptions(id);
    continue;
  }
  if (args.includes('--resume')) {
    let receipt;
    try { receipt = await json(resolve(projectRoot, 'output/shape-material-refresh', id, 'refresh.json')); }
    catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
    // A finished refresh holds while its recipe and retained scene have not changed since its report was written.
    const written = await stat(resolve(projectRoot, 'output/shape-material-refresh', id, 'refresh.json')).then(info => info.mtimeMs, () => -Infinity);
    if (receipt && !await anyChangedAfter([resolve(projectRoot, 'src/objects', id, 'source/preparation/terrestrial.json'),
      resolve(projectRoot, 'src/objects', id, 'prepared/scene.json')], written)) {
      // The installed refreshed files still match their inventory rows.
      const inventory = await readInventory(id, resolve(projectRoot, 'src/objects', id));
      for (const asset of records(receipt.changedAssets)) {
        const filename = requireString(asset.filename), row = inventory?.assets.find(entry => entry.location === 'public' && entry.filename === filename);
        if (!row || sha256(await readFile(resolve(projectRoot, 'public/scenes', id, filename))) !== row.sha256)
          throw new Error(`Refreshed asset changed before resume: ${id}/${filename}.`);
      }
      continue;
    }
  }
  solarGeometry ??= await import(pathToFileURL(resolve(projectRoot, 'src/platform/solar-geometry.mts')).href);
  await refreshShapeMaterials(id, solarGeometry!, sourceRoot);
}
