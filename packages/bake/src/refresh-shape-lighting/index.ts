/** `@cssearth/bake/refresh-shape-lighting` (Node only): refresh only the default shape atlas; retain every other prepared
 * asset. `packages/bake/cli/refresh-shape-lighting.mts stage|publish <object-id>... | --all` is its command. The generated
 * solar geometry is written after the packages build, so the host passes it in (`SolarGeometry`). */
import { shapeLightingPath } from './paths.ts';
import { sha256 } from '@cssearth/core/node';
import { readFile, writeFile, mkdir, copyFile, rename } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import sharp from 'sharp';
import { requireRecord, requireArray, requireString } from '@cssearth/core';
import type { SolarGeometry } from '../objects/scene/index.ts';
import { readPreparedRuntimeText } from '@cssearth/objects/node';
import { parseSolidPreparationSource, SHAPE_MATERIAL, neutralShapeAtlas, neutralShapeViews, createRasterEmitter, retainedScene, retainedShapeAtlas } from '../objects/layers/terrestrial/index.ts';

const json = async (path: string) => requireRecord(JSON.parse(await readFile(path, 'utf8')));
const records = (value: unknown) => requireArray(value).map(value => requireRecord(value));
const save = (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2) + '\n');

export async function stageShapeLighting(id: string, solarGeometry: SolarGeometry) {
  const directory = shapeLightingPath('src/objects', id), stage = shapeLightingPath('output/shape-default-lighting', id);
  await mkdir(stage, { recursive: true });
  const config = parseSolidPreparationSource(await json(resolve(directory, 'source/preparation/terrestrial.json')));
  const scene = retainedScene(requireRecord(JSON.parse(await readPreparedRuntimeText(resolve(directory, 'prepared')))));
  const surfaces = await json(resolve(directory, 'prepared/surfaces.json'));
  const inventory = await json(resolve(directory, 'inventory.json'));
  const views = neutralShapeViews(config.raster.shapeViews);
  const replacements = new Map<string, Record<string, unknown>>();
  const changed = new Map<string, { filename: string; bytes: number; sha256: string }>();
  const emit = createRasterEmitter(stage, config.publicBase);
  sharp.concurrency(1); sharp.cache(false);
  for (const view of views) {
    const old = records(surfaces.surfaces).find(surface => surface.id === view.id);
    if (!old || requireRecord(old.material).kind !== 'unobserved-neutral' || old.textureScale)
      throw new Error(`${id}/${view.id}: expected an existing unscaled neutral shape.`);
    const atlas = retainedShapeAtlas(scene, view.id), prior = requireRecord(old.surface);
    if (prior.width !== atlas.width || prior.height !== atlas.height) throw new Error(`${id}: atlas dimensions changed.`);
    const { flood } = neutralShapeAtlas(atlas, solarGeometry.requireBodyFixedSunDirection(id));
    const filename = basename(requireString(prior.url));
    const surface = await emit(filename, sharp(flood, { raw: { width: atlas.width, height: atlas.height, channels: 4 } }),
      { alphaQuality: 100, effort: 4 });
    if (surface.url !== prior.url) throw new Error(`${id}: atlas address changed.`);
    replacements.set(view.id, { ...old, appearance: SHAPE_MATERIAL.appearance, surface });
    // The inventory row names the new atlas by its R2 content address.
    changed.set(filename, { filename, bytes: surface.bytes, sha256: sha256(await readFile(resolve(stage, filename))) });
  }
  if (!changed.size) throw new Error(`${id}: no neutral shape views.`);
  // Verify the entire existing asset bank against its inventory before publication; the inventory rows become the
  // baseline showing that Shadows-on and all other datasets stay untouched.
  for (const asset of records(inventory.assets)) {
    const bytes = await readFile(shapeLightingPath('site/public/scenes', id, requireString(asset.filename)));
    if (sha256(bytes) !== asset.sha256 || bytes.length !== asset.bytes) throw new Error(`${id}: stale asset ${asset.filename}.`);
  }
  surfaces.surfaces = records(surfaces.surfaces).map(surface => replacements.get(requireString(surface.id)) ?? surface);
  await save(resolve(stage, 'surfaces.json'), surfaces);
  await save(resolve(stage, 'inventory.json'), { ...inventory,
    assets: records(inventory.assets).map(asset => asset.location === 'public' && changed.has(requireString(asset.filename)) ? { ...asset, ...changed.get(requireString(asset.filename)) } : asset) });
  await save(resolve(stage, 'receipt.json'), { id, baselineAssets: inventory.assets,
    datasetIds: views.map(view => view.id), changedAssets: [...changed.values()] });
}

export async function validateStage(id: string) {
  const stage = shapeLightingPath('output/shape-default-lighting', id);
  const receipt = await json(resolve(stage, 'receipt.json'));
  for (const asset of records(receipt.changedAssets))
    if (sha256(await readFile(resolve(stage, requireString(asset.filename)))) !== asset.sha256) throw new Error('Staged atlas changed.');
}

export async function publishShapeLighting(id: string) {
  await validateStage(id);
  const directory = shapeLightingPath('src/objects', id), stage = shapeLightingPath('output/shape-default-lighting', id);
  const receipt = await json(resolve(stage, 'receipt.json'));
  for (const asset of records(receipt.changedAssets)) {
    const filename = requireString(asset.filename), destination = shapeLightingPath('site/public/scenes', id, filename);
    const temporary = `${destination}.shape-lighting-tmp`;
    await copyFile(resolve(stage, filename), temporary);
    await rename(temporary, destination);
  }
  for (const file of ['surfaces.json', 'inventory.json']) {
    const value = await json(resolve(stage, file));
    if (file === 'inventory.json') await save(resolve(directory, file), value);
    else await writeFile(resolve(directory, 'prepared', file), JSON.stringify(value) + '\n');
  }
  const changed = new Set(records(receipt.changedAssets).map(asset => requireString(asset.filename)));
  for (const asset of records(receipt.baselineAssets)) if (!changed.has(requireString(asset.filename)))
    if (sha256(await readFile(shapeLightingPath('site/public/scenes', id, requireString(asset.filename)))) !== asset.sha256)
      throw new Error(`${id}: unrelated asset changed during publication.`);
}
