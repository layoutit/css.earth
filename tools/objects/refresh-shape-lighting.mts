/** Refresh only the default shape atlas; retain every other prepared asset. */
import { sha256 } from '../../src/platform/sha256.mts';
import { readFile, writeFile, mkdir, copyFile, rename } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { requireRecord, requireArray, requireString } from '../sources/source-values.mts';
import { requireBodyFixedSunDirection } from '../../src/platform/solar-geometry.mts';
import { SCENE_OBJECTS } from '../../site/objects.mts';
import { parseSolidPreparationSource } from './terrestrial-layers/profile-source.mts';
import { SHAPE_MATERIAL, neutralShapeAtlas } from './terrestrial-layers/shape-material.mts';
import { createRasterEmitter } from './terrestrial-layers/raster-output.mts';
import { retainedShapeAtlas } from './refresh-shape-materials.mts';
import { prepareObjectProvenance } from './provenance.mts';


const json = async (path: string) => requireRecord(JSON.parse(await readFile(path, 'utf8')));
const records = (value: unknown) => requireArray(value).map(value => requireRecord(value));
const save = (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
const files = ['prepared/scene.json', 'prepared/surfaces.json', 'prepared/material.json',
  'inventory.json', 'object.json', 'source/manifest.json',
  'source/preparation/terrestrial.json'];
const generators = ['tools/objects/terrestrial-layers/shape-material.mts', 'tools/objects/refresh-shape-lighting.mts'];

async function stageShapeLighting(id: string) {
  const directory = resolve('src/objects', id), stage = resolve('output/shape-default-lighting', id);
  await mkdir(stage, { recursive: true });
  const originals = await Promise.all(files.map(async file => ({ file, sha256: sha256(await readFile(resolve(directory, file))) })));
  const generatorPins = await Promise.all(generators.map(async file => ({ file, sha256: sha256(await readFile(file)) })));
  const config = parseSolidPreparationSource(await json(resolve(directory, 'source/preparation/terrestrial.json')));
  const scene = await json(resolve(directory, 'prepared/scene.json'));
  const surfaces = await json(resolve(directory, 'prepared/surfaces.json'));
  const material = await json(resolve(directory, 'prepared/material.json'));
  const inventory = await json(resolve(directory, 'inventory.json'));
  const views = config.raster.shapeViews ?? [];
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
    const { flood } = neutralShapeAtlas(atlas, requireBodyFixedSunDirection(id));
    const filename = basename(requireString(prior.url));
    const surface = await emit(filename, sharp(flood, { raw: { width: atlas.width, height: atlas.height, channels: 4 } }),
      { alphaQuality: 100, effort: 4 });
    if (surface.url !== prior.url) throw new Error(`${id}: atlas address changed.`);
    replacements.set(view.id, { ...old, appearance: SHAPE_MATERIAL.appearance, surface });
    changed.set(filename, { filename, bytes: surface.bytes, sha256: surface.sha256 });
  }
  if (!changed.size) throw new Error(`${id}: no neutral shape views.`);
  // Verify the entire existing asset bank before publication. These pins become
  // the baseline proving that Shadows-on and all other lenses stay untouched.
  for (const asset of records(inventory.assets)) {
    const bytes = await readFile(resolve('public/scenes', id, requireString(asset.filename)));
    if (sha256(bytes) !== asset.sha256 || bytes.length !== asset.bytes) throw new Error(`${id}: stale asset ${asset.filename}.`);
  }
  for (const document of [surfaces, material])
    document.surfaces = records(document.surfaces).map(surface => replacements.get(requireString(surface.id)) ?? surface);
  await save(resolve(stage, 'surfaces.json'), surfaces);
  await save(resolve(stage, 'material.json'), material);
  await save(resolve(stage, 'inventory.json'), { ...inventory,
    assets: records(inventory.assets).map(asset => asset.location === 'public' && changed.has(requireString(asset.filename)) ? { ...asset, ...changed.get(requireString(asset.filename)) } : asset) });
  await save(resolve(stage, 'receipt.json'), { id, originals, generatorPins, baselineAssets: inventory.assets,
    lensIds: views.map(view => view.id), changedAssets: [...changed.values()] });
}

async function validateStage(id: string) {
  const directory = resolve('src/objects', id), stage = resolve('output/shape-default-lighting', id);
  const receipt = await json(resolve(stage, 'receipt.json'));
  for (const pin of records(receipt.originals))
    if (sha256(await readFile(resolve(directory, requireString(pin.file)))) !== pin.sha256)
      throw new Error(`${id}: ${pin.file} changed since staging.`);
  for (const pin of records(receipt.generatorPins))
    if (sha256(await readFile(requireString(pin.file))) !== pin.sha256) throw new Error('Lighting generator changed since staging.');
  for (const asset of records(receipt.changedAssets))
    if (sha256(await readFile(resolve(stage, requireString(asset.filename)))) !== asset.sha256) throw new Error('Staged atlas changed.');
}

async function publishShapeLighting(id: string) {
  await validateStage(id);
  const directory = resolve('src/objects', id), stage = resolve('output/shape-default-lighting', id);
  const receipt = await json(resolve(stage, 'receipt.json'));
  for (const asset of records(receipt.changedAssets)) {
    const filename = requireString(asset.filename), destination = resolve('public/scenes', id, filename);
    const temporary = `${destination}.shape-lighting-tmp`;
    await copyFile(resolve(stage, filename), temporary);
    await rename(temporary, destination);
  }
  for (const file of ['surfaces.json', 'material.json', 'inventory.json']) {
    const value = await json(resolve(stage, file));
    if (file === 'inventory.json') await save(resolve(directory, file), value);
    else await writeFile(resolve(directory, 'prepared', file), JSON.stringify(value) + '\n');
  }
  await prepareObjectProvenance({ objectDirectory: directory, publicDirectory: resolve('public/scenes', id),
    outputDirectory: resolve(directory, 'prepared'), basis: 'recovered' });
  const changed = new Set(records(receipt.changedAssets).map(asset => requireString(asset.filename)));
  for (const asset of records(receipt.baselineAssets)) if (!changed.has(requireString(asset.filename)))
    if (sha256(await readFile(resolve('public/scenes', id, requireString(asset.filename)))) !== asset.sha256)
      throw new Error(`${id}: unrelated asset changed during publication.`);
  const scenePin = records(receipt.originals).find(pin => pin.file === 'prepared/scene.json');
  if (sha256(await readFile(resolve(directory, 'prepared/scene.json'))) !== scenePin?.sha256) throw new Error(`${id}: scene changed.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), mode = args[0];
  if (!['stage', 'publish'].includes(mode)) throw new Error('Choose stage or publish, then body ids or --all.');
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
  for (const [index, id] of ids.entries()) {
    const start = performance.now();
    await (mode === 'stage' ? stageShapeLighting(id) : publishShapeLighting(id));
    console.log(JSON.stringify({ mode, id, index: index + 1, total: ids.length, seconds: (performance.now() - start) / 1000 }));
  }
}
