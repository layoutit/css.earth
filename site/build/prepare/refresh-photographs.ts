import { readPreparedPanelContentRecord } from '@cssearth/objects';
import { requireInventory } from '@cssearth/objects/node';
import { parsePreparedObjectRuntime } from '@cssearth/objects';
// Reprepare selected photographs and their small previews, preserving the existing scene,
// lighting banks and scientific maps. Full preparation uses these same raster/interpreter owners.
import { updateInventory } from '@cssearth/objects/node';
import { readAuthoredSources } from '@cssearth/bake/objects/sources';
import { readFile, readdir, writeFile, mkdir, mkdtemp, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { readRasterRecipe, prepareRasterAssets } from '@cssearth/bake/raster';
import type { SolarGeometry } from '@cssearth/bake/objects/scene';
import { prepareObjectContentAssets } from '../content/prepare.ts';
import { parseRuntimeManifest } from '@cssearth/bake/delivery';
import { requireRecord, requireArray, requireString } from '@cssearth/core';
import { sha256 } from '@cssearth/core/node';

export async function refreshPhotographs(id: string, datasetIds: readonly string[]) {
  if (!/^[a-z][a-z0-9-]*$/.test(id) || !datasetIds.length || new Set(datasetIds).size !== datasetIds.length)
    throw new TypeError('Choose an object and distinct photographic dataset IDs.');
  const objectDirectory = resolve('src/objects', id), sourceDirectory = resolve(objectDirectory, 'source');
  const outputDirectory = resolve(objectDirectory, 'prepared'), publicDirectory = resolve('public/scenes', id);
  const authored = await readAuthoredSources(objectDirectory);
  const sources = new Map([...authored.sources].map(([id, entry]) => [id, entry.value]));
  const config = readRasterRecipe(sources.get('raster'));
  if (config.resample !== 'density-before-pack' || config.emission)
    throw new TypeError('Photographic refresh needs separately packed non-emissive raster surfaces.');
  if (datasetIds.some(id => !config.surfaces.some(surface => surface.id === id))) throw new TypeError('Unknown photographic dataset.');
  const selected = { ...config, surfaces: config.surfaces.filter(surface => datasetIds.includes(surface.id)),
    lighting: undefined, atmosphere: undefined, interior: undefined };
  const { createSurfaceInterpreter, selectSurfaceDependencies } = await import('@cssearth/bake/objects/interpretation');
  const interpret = await createSurfaceInterpreter({ objectId: id, displayName: id, sourceDirectory,
    recipe: selectSurfaceDependencies(config, datasetIds), sourceVerification: 'photographs',
    solarGeometry: await import(pathToFileURL(resolve('src/platform/solar-geometry.mts')).href) as SolarGeometry });
  const stageRoot = resolve('.local/photographic-refresh'); await mkdir(stageRoot, { recursive: true });
  const stage = await mkdtemp(resolve(stageRoot, `${id}-`));
  // One encoder worker and no libvips image cache: the previous surface need not remain resident.
  sharp.concurrency(1); sharp.cache(false);
  const start = Date.now();
  const assets = await prepareRasterAssets({ sourceDirectory, publicDirectory: stage, outputDirectory: stage, config: selected, interpret });
  const manifest = parseRuntimeManifest(requireInventory(id, JSON.parse(await readFile(resolve(objectDirectory, 'inventory.json'), 'utf8'))), id);
  // The stage holds the refreshed images and their assets.json. Each image replaces one inventoried public file,
  // whose entry gets the new bytes' R2 content address.
  const replacements = new Map<string, { filename: string; bytes: number; sha256: string }>();
  const staged = (await readdir(stage, { recursive: true, withFileTypes: true }))
    .filter(entry => entry.isFile()).map(entry => resolve(entry.parentPath, entry.name).slice(stage.length + 1)).filter(filename => filename !== 'assets.json');
  for (const filename of staged) {
    if (!manifest.assets.some(asset => asset.filename === filename))
      throw new Error(`${id}: refresh cannot introduce ${filename}, which src/objects/${id}/inventory.json does not publish.`);
    const bytes = await readFile(resolve(stage, filename));
    replacements.set(filename, { filename, bytes: bytes.length, sha256: sha256(bytes) });
  }
  const previous = requireRecord(JSON.parse(await readFile(resolve(outputDirectory, 'assets.json'), 'utf8')));
  // A refreshed assets.json carries no per-file digests: inventory.json addresses the published bytes.
  const combined = { ...Object.fromEntries(Object.entries(previous).filter(([key]) => key !== 'hashes')), sourceDimensions: assets.sourceDimensions,
    surfaces: { ...requireRecord(previous.surfaces), ...assets.surfaces } };
  await mkdir(publicDirectory, { recursive: true });
  for (const filename of replacements.keys()) await copyFile(resolve(stage, filename), resolve(publicDirectory, filename));
  await writeFile(resolve(outputDirectory, 'assets.json'), JSON.stringify(combined) + '\n');
  await updateInventory({ objectId: id, objectDirectory, location: 'public', assets: manifest.assets.map(asset => replacements.get(asset.filename) ?? asset) });
  const { prepareSurfaceMinimaps } = await import('@cssearth/bake/surface-previews');
  await prepareSurfaceMinimaps({ objectDirectory, publicDirectory, outputDirectory, photographs: datasetIds,
    solarGeometry: await import(pathToFileURL(resolve('src/platform/solar-geometry.mts')).href) as SolarGeometry });
  await refreshSurfaceContent(id, datasetIds);
  return { id, datasets: datasetIds, assets: replacements.size, bytes: [...replacements.values()].reduce((sum, entry) => sum + entry.bytes, 0),
    seconds: (Date.now() - start) / 1000, maxRssMiB: process.resourceUsage().maxRSS / 1024, stage };
}

/** Refresh selected authored captions while preserving the retained scene and other dataset controls. */
export async function refreshSurfaceContent(id: string, datasetIds: readonly string[]) {
  if (!/^[a-z][a-z0-9-]*$/.test(id) || !datasetIds.length || new Set(datasetIds).size !== datasetIds.length)
    throw new TypeError('Choose an object and distinct surface dataset IDs.');
  const objectDirectory = resolve('src/objects', id), sourceDirectory = resolve(objectDirectory, 'source');
  const outputDirectory = resolve(objectDirectory, 'prepared'), publicDirectory = resolve('public/scenes', id);
  const content = (await readAuthoredSources(objectDirectory)).sources.get('content')?.reference;
  if (!content?.path.startsWith('source/')) throw new TypeError('Photographic refresh needs authored content.');
  const previousDatasets = requireRecord(JSON.parse(await readFile(resolve(outputDirectory, 'datasets.json'), 'utf8')));
  const previousContent = readPreparedPanelContentRecord(JSON.parse(await readFile(resolve(outputDirectory, 'content.json'), 'utf8')));
  await prepareObjectContentAssets({ sourceDirectory, publicDirectory, outputDirectory, config: { contentPath: content.path.slice(7) } });
  const datasetPath = resolve(outputDirectory, 'datasets.json'), preparedDatasets = requireRecord(JSON.parse(await readFile(datasetPath, 'utf8')));
  const replacementsById = new Map(requireArray(preparedDatasets.controls).map(value => { const dataset = requireRecord(value); return [requireString(dataset.id), dataset] as const; }));
  await writeFile(datasetPath, JSON.stringify({ ...previousDatasets, controls: requireArray(previousDatasets.controls).map(value => {
    const dataset = requireRecord(value), key = requireString(dataset.id);
    if (!datasetIds.includes(key)) return dataset;
    const replacement = replacementsById.get(key); if (!replacement) throw new Error(`Missing photographic dataset: ${key}`); return replacement;
  }) }) + '\n');
  if (previousContent.features !== undefined) {
    const features = requireRecord(previousContent.features);
    const path = resolve(outputDirectory, 'content.json');
    const content = readPreparedPanelContentRecord(JSON.parse(await readFile(path, 'utf8')));
    await writeFile(path, JSON.stringify({ ...content, features: { searchLabel: requireString(features.searchLabel), description: requireString(features.description) } }) + '\n');
  }
  // Asset URLs and the scene are retained. The writer updates the descriptor/page transport from the new content.
  const runtime = requireRecord(parsePreparedObjectRuntime(JSON.parse(await readFile(resolve(outputDirectory, 'runtime.json'), 'utf8')), { parsedJson: true }));
  const { repinObjectJson } = await import('@cssearth/bake/contract');
  const updatedControls = requireRecord(JSON.parse(await readFile(resolve(outputDirectory, 'controls.json'), 'utf8')));
  const labels = new Map(requireArray(requireRecord(updatedControls.datasets).controls).map(value => { const dataset = requireRecord(value); return [requireString(dataset.id), dataset] as const; }));
  const controls = requireRecord(runtime.controls), datasets = requireRecord(controls.datasets);
  const selection = requireArray(datasets.controls).map(value => {
    const dataset = requireRecord(value), key = requireString(dataset.id);
    if (!datasetIds.includes(key)) return dataset;
    const label = labels.get(key); if (!label) throw new Error(`Missing photographic caption: ${key}`); return label;
  });
  const { prepareWorldNavigationDefinition, writeWorldNavigationArtifacts } = await import('./prepare-world-navigation.ts');
  const navigation = await prepareWorldNavigationDefinition({ objectDirectory, projectRoot: process.cwd(),
    definition: { ...runtime, controls: { ...controls, datasets: { ...datasets, controls: selection } } } });
  const scene = requireRecord(JSON.parse(await readFile(resolve(outputDirectory, 'scene.json'), 'utf8')));
  await writeWorldNavigationArtifacts(outputDirectory, navigation, scene);
  // Captions do not require recompiling texture matrices, seam treatment or body geometry.
  await repinObjectJson(id);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [id, ...datasets] = process.argv.slice(2);
  if (!id) throw new TypeError('Usage: refresh-photographs.js <objectId> <datasetId> [...]');
  console.log(JSON.stringify(await refreshPhotographs(id, datasets)));
}
