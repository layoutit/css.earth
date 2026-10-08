/** `@cssearth/bake/refresh-shape-materials` (Node only): repaint existing shape datasets using retained geometry and the
 * shared material preparer. `packages/bake/cli/refresh-shape-materials.mts <object-id>... | --all [--resume]
 * [--descriptions-only] [--source-root=<path>] [--shard=<index>/<count>]` is its command. The generated solar geometry is
 * written after the packages build, so the host passes it in (`SolarGeometry`). */
import { retainedShapeAtlas, alternativeForDataset, createRasterEmitter, parseRadialSnapshot, SHAPE_MATERIAL, shapeMaterialRaster, neutralShapeViews, renderRadialSnapshot, parseSolidPreparationSource, loadRadialTerrain, prepareRadialMaterials } from '../objects/layers/terrestrial/index.ts';
import type { RadialMaterialSurface } from '../objects/layers/terrestrial/index.ts';
import { shapeMaterialPath } from './paths.ts';
import { sha256 } from '@cssearth/core/node';
import { readAuthoredSources } from '../objects/sources/index.ts';
import { readFile, writeFile, mkdir, rename, copyFile, readdir, access } from 'node:fs/promises';
import { resolve, basename, dirname } from 'node:path';
import sharp from 'sharp';
import { requireRecord, requireArray, requireString } from '@cssearth/core';
import { createSourceManifest } from '@cssearth/objects/node';
import type { SolarGeometry } from '../objects/scene/index.ts';
import { refreshObservationControls } from '../refresh-surface-observations/index.ts';
import { prepareSurfaceMinimaps } from '../surface-previews/index.ts';
import { loadObjectMarkerDescriptor, prepareBodyMarkers, validateMarkerDescriptor, renderMarker } from '../navigation/index.ts';
import { prepareSearchThumbnails } from '../site-assets/index.ts';

const records = (value: unknown) => requireArray(value).map(value => requireRecord(value));
const json = async (path: string) => requireRecord(JSON.parse(await readFile(path, 'utf8')));
const save = (path: string, value: unknown) => writeFile(path, JSON.stringify(value) + '\n');
const pretty = (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2) + '\n');

async function replaceAsset(source: string, destination: string) {
  const temporary = `${destination}.shape-material-tmp`;
  await copyFile(source, temporary);
  await rename(temporary, destination);
}

function describeNeutralMaterial(text: string): string {
  return text.replace(/shared no-imagery grid/g, 'shared neutral-gray material')
    .replace(/shared missing-imagery grid/g, 'shared neutral-gray material')
    .replace(/no-imagery grid/g, 'neutral-gray material')
    .replace(/Neutral grid/g, 'Neutral gray').replace(/neutral grid/g, 'neutral gray')
    .replace(/shared grid/g, 'shared neutral gray')
    .replace(/The grid marks/g, 'Neutral gray marks').replace(/the grid marks/g, 'neutral gray marks')
    .replace(/Grid marks/g, 'Neutral gray marks').replace(/grid marks/g, 'neutral gray marks');
}

export async function refreshShapeMaterialDescriptions(id: string) {
  const objectDirectory = shapeMaterialPath('src/objects', id), sourceDirectory = resolve(objectDirectory, 'source');
  const recipe = await json(resolve(sourceDirectory, 'preparation/terrestrial.json'));
  const datasetIds = neutralShapeViews(records(requireRecord(recipe.raster).shapeViews ?? [])).map(view => requireString(view.id));
  if (!datasetIds.length) return;
  const contentPath = resolve(sourceDirectory, 'content/object.json'), content = await json(contentPath);
  let edited = false;
  for (const dataset of records(requireRecord(content.datasets).controls)) if (datasetIds.includes(requireString(dataset.id))) {
    const before = requireString(dataset.notes ?? '');
    let notes = describeNeutralMaterial(before);
    const qualification = 'Neutral gray (#808080 sRGB) is a shared display convention, not measured surface color or albedo.';
    if (!notes.includes(qualification)) notes = `${notes}${notes ? ' ' : ''}${qualification}`;
    if (notes !== before) { dataset.notes = notes; edited = true; }
  }
  if (edited) {
    await pretty(contentPath, content);
  }
  const readmePath = resolve(objectDirectory, 'README.md'), readme = await readFile(readmePath, 'utf8');
  // A body can also have photographed/scientific gaps. Only change sentences
  // explicitly describing the whole shape's absent imagery or neutral material.
  const updated = readme.split('\n').map(line => /no-imagery|neutral grid|Neutral grid|grid marks (unavailable|missing surface|that gap)/.test(line)
    ? describeNeutralMaterial(line) : line).join('\n');
  const note = 'Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.';
  const final = updated.includes(note) ? updated : updated.replace(/^(#[^\n]+\n)/, `$1\n${note}\n`);
  if (final !== readme) await writeFile(readmePath, final);
}

export async function refreshShapeMaterials(id: string, solarGeometry: SolarGeometry, sourceRoot?: string) {
  if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new TypeError('Invalid object id.');
  const started = performance.now(), objectDirectory = shapeMaterialPath('src/objects', id), outputDirectory = resolve(objectDirectory, 'prepared');
  const publicDirectory = shapeMaterialPath('site/public/scenes', id), stage = shapeMaterialPath('output/shape-material-refresh', id);
  const recipePath = resolve(objectDirectory, 'source/preparation/terrestrial.json'), recipeBytes = await readFile(recipePath);
  const config = parseSolidPreparationSource(JSON.parse(recipeBytes.toString('utf8'))), views = neutralShapeViews(config.raster.shapeViews);
  if (!views.length) throw new Error(`${id} has no shape-only dataset.`);
  await readAuthoredSources(objectDirectory);
  const originals = new Map<string, Buffer>();
  for (const name of ['scene.json', 'surfaces.json']) originals.set(name, await readFile(resolve(outputDirectory, name)));
  originals.set('inventory.json', await readFile(resolve(objectDirectory, 'inventory.json')));
  const scene = requireRecord(JSON.parse(originals.get('scene.json')!.toString('utf8')));
  const document = requireRecord(JSON.parse(originals.get('surfaces.json')!.toString('utf8'))), oldSurfaces = records(document.surfaces);
  const sourceDirectory = resolve(objectDirectory, 'source');
  const source = await createSourceManifest({ objectId: id, objectName: id, sourceRoot: sourceDirectory });
  await mkdir(stage, { recursive: true });
  sharp.concurrency(1); sharp.cache(false);
  const emit = createRasterEmitter(stage, config.publicBase), surfaces: RadialMaterialSurface[] = [];
  for (const view of views) {
    const old = oldSurfaces.find(surface => surface.id === view.id);
    if (!old) throw new Error('Refresh cannot add a dataset.');
    const alternate = alternativeForDataset(config.geometry.radialTerrainAlternatives ?? [], view.id);
    const terrain = requireRecord(alternate ?? config.geometry.radialTerrain), radial = retainedShapeAtlas(scene, view.id);
    const sourceEntry = source.manifest.inputs.find(entry => entry.path === terrain.path && entry.consumers.includes(view.consumer));
    if (!sourceEntry) throw new Error('Retained shape source binding changed.');
    const { width, height } = config.raster, stem = `${id}-${view.id}`;
    const flat = sharp(shapeMaterialRaster(width, height), { raw: { width, height, channels: 3 } }).ensureAlpha();
    const surface: RadialMaterialSurface = { ...old, id: view.id,
      appearance: SHAPE_MATERIAL.appearance, material: { kind: 'unobserved-neutral', color: SHAPE_MATERIAL.color },
      map: await emit(`${stem}-map.webp`, flat.clone()),
      thumbnail: await emit(`${stem}-thumbnail.webp`, flat.clone().resize(96, 48)),
      billboardColor: SHAPE_MATERIAL.color,
    };
    // Source-cast shadows need the original mesh. Read it from the explicitly selected
    // source checkout; do not copy, edit, or simplify the retained scene.
    let grid;
    if (terrain.sourceLighting) {
      const localSource = await access(resolve(sourceDirectory, requireString(terrain.path))).then(() => true, () => false);
      const lightingDirectory = !localSource && sourceRoot ? resolve(sourceRoot, 'src/objects', id, 'source') : sourceDirectory;
      const lightingSource = await createSourceManifest({ objectId: id, objectName: id, sourceRoot: lightingDirectory });
      if (!lightingSource.manifest.inputs.some(entry => entry.path === terrain.path)) throw new Error('Source lighting mesh is not declared in that checkout.');
      grid = (await loadRadialTerrain({ config: { ...config, geometry: { ...config.geometry, radialTerrain: terrain } }, sourceDirectory: lightingDirectory, source: lightingSource }))?.grid;
    }
    await prepareRadialMaterials({ radial: { ...radial, grid }, surfaces: [surface],
      config: { ...config, geometry: { ...config.geometry, radialTerrain: terrain } }, source,
      publicDirectory: stage, outputDirectory: stage, sunDirection: solarGeometry.requireBodyFixedSunDirection(id), snapshotEntries: [] });
    surfaces.push(surface);
  }
  // No partial changes while an asset is being baked, and no writes into a shared inode.
  for (const [name, bytes] of originals) if (!(await readFile(resolve(outputDirectory, name))).equals(bytes)) throw new Error(`Package changed during refresh: ${name}.`);
  if (!(await readFile(recipePath)).equals(recipeBytes)) throw new Error('Recipe changed during refresh.');
  const inventory = requireRecord(JSON.parse(originals.get('inventory.json')!.toString('utf8'))), assets = records(inventory.assets);
  const changed = new Map<string, { filename: string; bytes: number; sha256: string }>();
  for (const surface of surfaces) for (const key of ['map', 'surface', 'shadowSurface', 'thumbnail']) {
    const asset = requireRecord(surface[key]), filename = basename(requireString(asset.url));
    const bytes = await readFile(resolve(stage, filename));
    if (bytes.length !== asset.bytes) throw new Error(`${id}: staged asset ${filename} is ${bytes.length} bytes; its surface records ${String(asset.bytes)}.`);
    await replaceAsset(resolve(stage, filename), resolve(publicDirectory, filename));
    // The inventory row names the refreshed file by its R2 content address.
    if (assets.some(asset => asset.location === 'public' && asset.filename === filename)) changed.set(filename, { filename, bytes: bytes.length, sha256: sha256(bytes) });
  }
  const replacements = new Map(surfaces.map(surface => [surface.id, surface]));
  const refreshed = requireRecord(JSON.parse(originals.get('surfaces.json')!.toString('utf8')));
  refreshed.surfaces = records(refreshed.surfaces).map(surface => replacements.get(requireString(surface.id)) ?? surface);
  await save(resolve(outputDirectory, 'surfaces.json'), refreshed);
  const nextInventory = { ...inventory, assets: assets.map(asset => asset.location === 'public' && changed.has(requireString(asset.filename)) ? { ...asset, ...changed.get(requireString(asset.filename)) } : asset) };
  await writeFile(resolve(objectDirectory, 'inventory.json'), JSON.stringify(nextInventory, null, 2) + '\n');
  const datasetIds = views.map(view => view.id);
  // Context images and tiny navigation icons use the same material and retained mesh.
  const manifestPath = resolve(sourceDirectory, 'manifest.json'), manifest = await json(manifestPath);
  const navigation = await json(resolve(sourceDirectory, 'preparation/navigation.json'));
  let contextRecord: Record<string, unknown> | null = null;
  for (const entry of records(manifest.generatedIntermediates ?? [])) {
    const recipe = entry.recipe === undefined ? null : requireRecord(entry.recipe);
    if (!recipe || !datasetIds.includes(requireString(recipe.datasetId ?? '')) || !String(entry.generator).includes('radial-snapshot.')) continue;
    const surface = surfaces.find(surface => surface.id === recipe.datasetId)!;
    const png = await renderRadialSnapshot({ ...parseRadialSnapshot(recipe), faces: retainedShapeAtlas(scene, surface.id).faces,
      map: resolve(stage, basename(surface.map.url)) });
    const contextPath = resolve(sourceDirectory, requireString(entry.path));
    await mkdir(dirname(contextPath), { recursive: true });
    const stagedContext = resolve(stage, `context-${surface.id}.png`);
    await writeFile(stagedContext, png); await replaceAsset(stagedContext, contextPath);
    if (requireRecord(navigation.source).path === entry.path) contextRecord = entry;
  }
  if (contextRecord) {
    const markerStage = resolve(stage, 'navigation'); await mkdir(markerStage, { recursive: true });
    const descriptors = [validateMarkerDescriptor(await loadObjectMarkerDescriptor(id, shapeMaterialPath()))];
    await prepareBodyMarkers({ projectRoot: shapeMaterialPath(), outputRoot: markerStage, descriptors });

    // Radial snapshots already own their crop and size. Use the same marker
    // renderer and context encoding without evaluating the whole orbital catalogue.
    const marker = descriptors[0];
    if (marker.context) {
      if (marker.operations.some(operation => !['resize', 'png'].includes(operation.type))) throw new Error('Shape refresh requires an uncropped radial context recipe.');
      const sourcePath = resolve(sourceDirectory, marker.source.path), size = await sharp(sourcePath).metadata();
      const tileSize = Math.min(marker.context.pixels, size.width ?? 0, size.height ?? 0);
      const png = await renderMarker(marker, { sourcePath, tileSize });
      await sharp(png).webp({ quality: 85, alphaQuality: 100, effort: 6 }).toFile(resolve(markerStage, `${id}-context.webp`));
    }

    for (const filename of await readdir(markerStage)) await replaceAsset(resolve(markerStage, filename), shapeMaterialPath('site/public/navigation', filename));
    // The committed search preview follows its context image.
    await prepareSearchThumbnails(shapeMaterialPath());
  }
  await pretty(manifestPath, manifest);
  await prepareSurfaceMinimaps({ objectDirectory, publicDirectory, outputDirectory, photographs: datasetIds, solarGeometry });
  await refreshObservationControls(id, datasetIds, new Map(datasetIds.map(datasetId => [datasetId, SHAPE_MATERIAL.color])), shapeMaterialPath());
  await refreshShapeMaterialDescriptions(id);
  const report = { id, datasetIds, seconds: (performance.now() - started) / 1000,
    material: SHAPE_MATERIAL,
    changedAssets: [...changed.values()].map(({ filename, bytes }) => ({ filename, bytes })), retainedAssets: assets.length - changed.size,
    geometryBasis: 'Existing prepared scene; original source mesh additionally verified for source-cast lighting.' };
  await writeFile(resolve(stage, 'refresh.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ id, seconds: report.seconds, changedAssets: changed.size }));
  return report;
}
