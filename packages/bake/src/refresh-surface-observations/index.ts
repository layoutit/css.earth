/** `@cssearth/bake/refresh-surface-observations` (Node only): refresh existing observation datasets using the full
 * preparer's raster and atlas owners. `packages/bake/cli/refresh-surface-observations.mts <object-id> <datasetId>...` is its
 * command. The generated solar geometry is written after the packages build, so the host passes it in (`SolarGeometry`). */
import { projectRoot, sha256 } from '@cssearth/core/node';
import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { requireRecord, requireArray, requireString } from '@cssearth/core';
import { createSourceManifest } from '@cssearth/objects/node';
import type { SolarGeometry } from '../objects/scene/index.ts';
import { parseSolidPreparationSource, retainedPhotographicAtlas, loadRadialTerrain, prepareRadialMaterials, prepareSolidRasters, prepareSolidSurfacePoles } from '../objects/layers/terrestrial/index.ts';
import { datasetBillboardColors } from '../objects/content/index.ts';
import { prepareSurfaceMinimaps } from '../surface-previews/index.ts';
import { repinObjectJson } from '../contract/index.ts';

const json = async (path: string) => requireRecord(JSON.parse(await readFile(path, 'utf8')));
const records = (value: unknown) => requireArray(value).map(value => requireRecord(value));
const save = (path: string, value: unknown) => writeFile(path, JSON.stringify(value) + '\n');

export async function refreshSurfaceObservations(id: string, datasetIds: readonly string[], solarGeometry: SolarGeometry) {
  if (!/^[a-z][a-z0-9-]*$/.test(id) || !datasetIds.length || new Set(datasetIds).size !== datasetIds.length)
    throw new TypeError('Choose a body and distinct existing observation datasets.');
  const started = performance.now(), objectDirectory = resolve('src/objects', id), sourceDirectory = resolve(objectDirectory, 'source');
  const outputDirectory = resolve(objectDirectory, 'prepared'), publicDirectory = resolve('site/public/scenes', id);
  const stage = resolve('output/surface-observation-refresh', id), recipePath = resolve(sourceDirectory, 'preparation/terrestrial.json');
  const recipeBytes = await readFile(recipePath), descriptor = await json(resolve(objectDirectory, 'object.json'));
  const references = records(requireRecord(requireRecord(descriptor.properties).recipe).sources);
  if (!references.some(reference => reference.id === 'terrestrial')) throw new Error('The descriptor names no observation recipe.');
  const config = parseSolidPreparationSource(JSON.parse(recipeBytes.toString('utf8')));
  const terrain = requireRecord(config.geometry.radialTerrain);
  if (config.geometry.radialModels || config.geometry.radialTerrainAlternatives || terrain.sourceLighting)
    throw new Error('This refresh supports existing single-model observation datasets without source lighting.');
  const selected = config.raster.surfaceObservations?.filter(recipe => datasetIds.includes(recipe.id)) ?? [];
  if (selected.length !== datasetIds.length) throw new Error('Unknown surface-observation dataset.');
  const originals = new Map<string, Buffer>();
  for (const name of ['scene.json', 'surfaces.json', 'minimaps.json']) originals.set(name, await readFile(resolve(outputDirectory, name)));
  originals.set('inventory.json', await readFile(resolve(objectDirectory, 'inventory.json')));
  const previousSurfaces = requireRecord(JSON.parse(originals.get('surfaces.json')!.toString('utf8')));
  if (datasetIds.some(id => !records(previousSurfaces.surfaces).some(surface => surface.id === id))) throw new Error('Refresh cannot add a dataset.');
  sharp.concurrency(1); sharp.cache(false);
  const source = await createSourceManifest({ objectId: id, objectName: id, sourceRoot: sourceDirectory });
  const radial = await loadRadialTerrain({ config, sourceDirectory, source });
  if (!radial) throw new Error('Observation refresh requires source terrain.');
  const retained = retainedPhotographicAtlas(requireRecord(JSON.parse(originals.get('scene.json')!.toString('utf8'))));
  // Reuse the full preparer's source mesh and exact plans. A geometry change needs a full preparation.
  if (retained.width !== radial.width || retained.height !== radial.height ||
      retained.plans.length !== radial.plans.length || retained.plans.some((plan, i) =>
        plan.rect.x !== radial.plans[i].rect.x || plan.rect.y !== radial.plans[i].rect.y || plan.rect.width !== radial.plans[i].rect.width || plan.rect.height !== radial.plans[i].rect.height ||
        plan.matrix.some((value, j) => value !== radial.plans[i].matrix[j]))) throw new Error('Retained atlas geometry differs from the source recipe.');
  await mkdir(stage, { recursive: true });
  const rasterConfig = { ...config, raster: { ...config.raster, observations: [], scientific: [], shapeViews: [], observedColors: [], surfaceObservations: selected } };
  const surfaces = await prepareSolidRasters({ config: rasterConfig, sourceDirectory, source, radial, publicDirectory: stage, outputDirectory: stage });
  // Like the full preparer's material step, record each surface's billboard color before the radial materials add its shadow surface.
  await prepareSolidSurfacePoles({ surfaces, publicDirectory: stage, config: rasterConfig });
  await prepareRadialMaterials({ radial, surfaces, config: { ...rasterConfig, geometry: { ...config.geometry, radialTerrain: { thumbnail: terrain.thumbnail } } }, source, sourceDirectory, publicDirectory: stage, outputDirectory: stage,
    sunDirection: solarGeometry.requireBodyFixedSunDirection(id), snapshotEntries: [] });
  const replacements = new Map(surfaces.map(surface => [surface.id, surface]));
  const inventory = requireRecord(JSON.parse(originals.get('inventory.json')!.toString('utf8'))), assets = records(inventory.assets);
  const changed = new Map<string, { filename: string; bytes: number; sha256: string }>();
  for (const surface of surfaces) {
    const old = records(previousSurfaces.surfaces).find(old => old.id === surface.id)!;
    for (const key of ['surface', 'shadowSurface', 'thumbnail', 'map']) {
      const value = requireRecord(surface[key]), url = requireString(value.url);
      if (url !== requireRecord(old[key]).url) throw new Error(`Refresh cannot change the ${key} resource name.`);
      const filename = url.split('/').at(-1)!;
      const bytes = await readFile(resolve(stage, filename));
      if (bytes.length !== value.bytes) throw new Error(`${id}: staged asset ${filename} is ${bytes.length} bytes; its surface records ${String(value.bytes)}.`);
      // The inventory row names the refreshed file by its R2 content address.
      if (assets.some(asset => asset.location === 'public' && asset.filename === filename)) changed.set(filename, { filename, bytes: bytes.length, sha256: sha256(bytes) });
    }
  }
  // Confirm the package has not changed while preparing, before applying any replacements.
  for (const [name, bytes] of originals) if (!(await readFile(resolve(outputDirectory, name))).equals(bytes)) throw new Error(`Package changed during refresh: ${name}.`);
  if (!(await readFile(recipePath)).equals(recipeBytes)) throw new Error('Recipe changed during refresh.');
  const refreshed = requireRecord(JSON.parse(originals.get('surfaces.json')!.toString('utf8')));
  refreshed.surfaces = records(refreshed.surfaces).map(surface => replacements.get(requireString(surface.id)) ?? surface);
  await save(resolve(outputDirectory, 'surfaces.json'), refreshed);
  await mkdir(publicDirectory, { recursive: true });
  for (const surface of surfaces) for (const key of ['surface', 'shadowSurface', 'thumbnail', 'map']) {
    const filename = requireString(requireRecord(surface[key]).url).split('/').at(-1)!;
    await copyFile(resolve(stage, filename), resolve(publicDirectory, filename));
  }
  for (const filename of await readdir(stage)) if (datasetIds.some(id => filename === `${id}-source-index.json`)) await copyFile(resolve(stage, filename), resolve(outputDirectory, filename));
  const nextInventory = { ...inventory, assets: assets.map(asset => asset.location === 'public' && changed.has(requireString(asset.filename)) ? { ...asset, ...changed.get(requireString(asset.filename)) } : asset) };
  await writeFile(resolve(objectDirectory, 'inventory.json'), JSON.stringify(nextInventory, null, 2) + '\n');
  await prepareSurfaceMinimaps({ objectDirectory, publicDirectory, outputDirectory, photographs: datasetIds, solarGeometry });
  await refreshObservationControls(id, datasetIds, new Map(surfaces.map(surface => [surface.id, requireString(surface.billboardColor)])));
  if (!(await readFile(resolve(outputDirectory, 'scene.json'))).equals(originals.get('scene.json')!)) throw new Error('Observation refresh changed the scene.');
  const report = { id, datasetIds, seconds: (performance.now() - started) / 1000, maxRssMiB: process.resourceUsage().maxRSS / 1024,
    refreshedRuntimeAssets: [...changed.values()].map(({ filename, bytes }) => ({ filename, bytes })),
    retainedRuntimeAssetCount: assets.length - changed.size, observations: surfaces.map(surface => surface.observation) };
  await writeFile(resolve(stage, 'refresh.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ id, seconds: report.seconds, maxRssMiB: report.maxRssMiB, refreshedAssets: changed.size, retainedAssets: report.retainedRuntimeAssetCount }));
  return report;
}

/** Refresh the refreshed datasets' no-data flags and billboard colors without rebaking any images. Reader text publishes separately with prepare:text. */
export async function refreshObservationControls(id: string, datasetIds: readonly string[], surfaceColors: ReadonlyMap<string, string> = new Map(), root = projectRoot(import.meta.url)) {
  if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error('Invalid object id.');
  const objectDirectory = resolve(root, 'src/objects', id), outputDirectory = resolve(objectDirectory, 'prepared'), publicDirectory = resolve(root, 'site/public/scenes', id);
  const descriptor = await json(resolve(objectDirectory, 'object.json'));
  const references = records(requireRecord(requireRecord(descriptor.properties).recipe).sources);
  // Keep the existing prepared controls, feature catalogue and all other shell content; a refreshed control takes only its
  // no-data flag from the source content, because reader text lives in text.json.
  const contentPath = references.find(reference => reference.id === 'content');
  const noData = new Map<string, boolean>();
  if (contentPath) {
    const bytes = await readFile(resolve(objectDirectory, requireString(contentPath.path)));
    const content = requireRecord(JSON.parse(bytes.toString('utf8')));
    for (const dataset of records(requireRecord(content.datasets).controls)) if (datasetIds.includes(requireString(dataset.id))) noData.set(requireString(dataset.id), dataset.noData === true);
  }
  // As in the full preparer, only the dataset catalogue carries control colors. Recolor each control whose image was refreshed, including an interior view of a refreshed default dataset; runtime variants take the surface billboard color.
  const datasets = await json(resolve(outputDirectory, 'datasets.json')), defaultDataset = requireString(datasets.defaultDataset);
  const controlColors = await datasetBillboardColors(records(datasets.controls), defaultDataset, publicDirectory);
  const update = (controls: unknown, colored: boolean) => records(controls).map(control => {
    const datasetId = requireString(control.id), refreshed = datasetIds.includes(datasetId);
    const recolored = colored && (refreshed || (control.view === 'interior' && datasetIds.includes(defaultDataset)));
    if (!refreshed && !recolored) return control;
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(control)) {
      if (['title', 'detail', 'summary', 'description', 'noData'].includes(key)) continue;
      next[key] = value;
      if (key === 'thumbnailUrl' && (refreshed ? noData.get(datasetId) === true : control.noData === true)) next.noData = true;
    }
    return recolored ? { ...next, billboardColor: controlColors.get(datasetId) } : next;
  });
  for (const name of ['datasets.json', 'runtime.json']) {
    const path = resolve(outputDirectory, name), document = await json(path);
    const target = name === 'datasets.json' ? document : requireRecord(requireRecord(document.controls).datasets);
    target.controls = update(target.controls, name === 'datasets.json');
    if (name === 'runtime.json') {
      // The far billboard's color is a write of its own background (solid-scene.ts).
      const billboards = new Set(records(requireRecord(document.tree).nodes).flatMap((node, index) => String(node.className ?? '').split(' ').includes(`${id}-billboard`) ? [index] : []));
      document.variants = records(document.variants).map(variant => {
        const color = surfaceColors.get(requireString(requireRecord(variant.when).datasetId));
        return color === undefined ? variant : { ...variant, writes: records(variant.writes).map(write =>
          write.kind === 'style' && write.name === 'backgroundColor' && billboards.has(Number(write.target)) ? { ...write, value: color } : write) };
      });
    }
    await save(path, document);
  }
  await repinObjectJson(id, root);
}
