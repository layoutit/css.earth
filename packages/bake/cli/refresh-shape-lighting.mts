import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
// Entry script: node packages/bake/cli/refresh-shape-lighting.mts stage|publish <object-id>... | --all. The work is in
// @cssearth/bake/refresh-shape-lighting, with the generated solar geometry this entry loads from the checkout.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { SolarGeometry } from '@cssearth/bake/objects/scene';
import { requireArray, requireRecord } from '@cssearth/core';
import { readPreparedObjects } from '@cssearth/objects/node';
import { publishShapeLighting, stageShapeLighting, validateStage } from '@cssearth/bake/refresh-shape-lighting';

const projectRoot = checkoutProjectRoot(import.meta.url);
const SCENE_OBJECTS = readPreparedObjects(resolve(import.meta.dirname, '../../..')).sceneObjects;
const json = async (path: string) => requireRecord(JSON.parse(await readFile(path, 'utf8')));

const args = process.argv.slice(2), mode = args[0];
if (!['stage', 'publish'].includes(mode!)) throw new Error('Choose stage or publish, then body ids or --all.');
const requested = args.includes('--all') ? SCENE_OBJECTS.map(object => object.id) : args.slice(1);
const ids: string[] = [];
for (const id of requested) {
  if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error('Invalid object id.');
  if (args.includes('--all')) {
    let recipe;
    try { recipe = await json(resolve('src/objects', id, 'source/preparation/terrestrial.json')); }
    catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') continue; throw error; }
    if (!requireArray(requireRecord(recipe.raster).shapeViews ?? []).length) continue;
  }
  ids.push(id);
}
if (!ids.length) throw new Error('Choose existing body ids or --all.');
// Fail before any publication when a concurrently edited package is stale.
if (mode === 'publish') for (const id of ids) await validateStage(id);
const solarGeometry: SolarGeometry = await import(pathToFileURL(resolve(projectRoot, 'src/platform/solar-geometry.mts')).href);
for (const [index, id] of ids.entries()) {
  const start = performance.now();
  await (mode === 'stage' ? stageShapeLighting(id, solarGeometry) : publishShapeLighting(id));
  console.log(JSON.stringify({ mode, id, index: index + 1, total: ids.length, seconds: (performance.now() - start) / 1000 }));
}
