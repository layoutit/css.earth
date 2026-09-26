import { retainedShapeAtlas } from './terrestrial-layers/retained-atlas.mts';
/** Repaint existing shape lenses using retained geometry and the shared material preparer. */
import { alternativeForLens } from './terrestrial-layers/alternative-lenses.mts';
import { sha256 } from '@cssearth/core/node';
import { readAuthoredSources } from './authored-sources.ts';
import { readFile, writeFile, mkdir, rename, copyFile, readdir, access } from 'node:fs/promises';
import { resolve, basename, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { requireRecord, requireArray, requireString } from '@cssearth/core';
import { createSourceManifest } from '../../src/platform/source-manifest.mts';
import { requireBodyFixedSunDirection } from '../../src/platform/solar-geometry.mts';
import { parseSolidPreparationSource } from './terrestrial-layers/profile-source.mts';
import { createRasterEmitter } from './terrestrial-layers/raster-output.mts';
import { loadRadialTerrain } from './terrestrial-layers/radial-terrain.mts';
import { prepareRadialMaterials } from './terrestrial-layers/radial-materials.mts';
import { SHAPE_MATERIAL, shapeMaterialRaster } from './terrestrial-layers/shape-material.mts';
import { refreshObservationControls } from './refresh-surface-observations.mts';
import { prepareSurfaceMinimaps } from '../prepare/prepare-surface-minimaps.mts';
import { prepareObjectProvenance } from './provenance.mts';
import type { RadialMaterialSurface } from './terrestrial-layers/solid-contract.mts';
import { renderRadialSnapshot } from './terrestrial-layers/radial-snapshot.mts';
import { parseRadialSnapshot } from './terrestrial-layers/radial-source.mts';
import { loadObjectMarkerDescriptor, prepareBodyMarkers } from '../prepare/prepare-navigation.mts';
import { validateMarkerDescriptor, renderMarker } from '../prepare/marker-recipe.mts';
import { SCENE_OBJECTS } from '../../site/objects.mts';


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
  const objectDirectory = resolve('src/objects', id), sourceDirectory = resolve(objectDirectory, 'source');
  const recipe = await json(resolve(sourceDirectory, 'preparation/terrestrial.json'));
  const lensIds = records(requireRecord(recipe.raster).shapeViews ?? []).map(view => requireString(view.id));
  if (!lensIds.length) return;
  const contentPath = resolve(sourceDirectory, 'content/object.json'), content = await json(contentPath);
  let edited = false;
  for (const lens of records(requireRecord(content.lenses).controls)) if (lensIds.includes(requireString(lens.id))) {
    const before = requireString(lens.notes ?? '');
    let notes = describeNeutralMaterial(before);
    const qualification = 'Neutral gray (#808080 sRGB) is a shared display convention, not measured surface color or albedo.';
    if (!notes.includes(qualification)) notes = `${notes}${notes ? ' ' : ''}${qualification}`;
    if (notes !== before) { lens.notes = notes; edited = true; }
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

export async function refreshShapeMaterials(id: string, sourceRoot?: string) {
  if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new TypeError('Invalid object id.');
  const started = performance.now(), objectDirectory = resolve('src/objects', id), outputDirectory = resolve(objectDirectory, 'prepared');
  const publicDirectory = resolve('public/scenes', id), stage = resolve('output/shape-material-refresh', id);
  const recipePath = resolve(objectDirectory, 'source/preparation/terrestrial.json'), recipeBytes = await readFile(recipePath);
  const config = parseSolidPreparationSource(JSON.parse(recipeBytes.toString('utf8'))), views = config.raster.shapeViews ?? [];
  if (!views.length) throw new Error(`${id} has no shape-only lens.`);
  await readAuthoredSources(objectDirectory);
  const originals = new Map<string, Buffer>();
  for (const name of ['scene.json', 'surfaces.json', 'material.json']) originals.set(name, await readFile(resolve(outputDirectory, name)));
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
    if (!old) throw new Error('Refresh cannot add a lens.');
    const alternate = alternativeForLens(config.geometry.radialTerrainAlternatives ?? [], view.id);
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
      publicDirectory: stage, outputDirectory: stage, sunDirection: requireBodyFixedSunDirection(id), snapshotEntries: [] });
    surfaces.push(surface);
  }
  // No partial changes while an asset is being baked, and no writes into a shared inode.
  for (const [name, bytes] of originals) if (sha256(await readFile(resolve(outputDirectory, name))) !== sha256(bytes)) throw new Error(`Package changed during refresh: ${name}.`);
  if (sha256(await readFile(recipePath)) !== sha256(recipeBytes)) throw new Error('Recipe changed during refresh.');
  const inventory = requireRecord(JSON.parse(originals.get('inventory.json')!.toString('utf8'))), assets = records(inventory.assets);
  const changed = new Map<string, { filename: string; bytes: number; sha256: string }>();
  for (const surface of surfaces) for (const key of ['map', 'surface', 'shadowSurface', 'thumbnail']) {
    const asset = requireRecord(surface[key]), filename = basename(requireString(asset.url));
    const bytes = await readFile(resolve(stage, filename));
    if (sha256(bytes) !== asset.sha256 || bytes.length !== asset.bytes) throw new Error(`Invalid staged asset: ${filename}.`);
    await replaceAsset(resolve(stage, filename), resolve(publicDirectory, filename));
    if (assets.some(asset => asset.location === 'public' && asset.filename === filename)) changed.set(filename, { filename, bytes: bytes.length, sha256: sha256(bytes) });
  }
  const replacements = new Map(surfaces.map(surface => [surface.id, surface]));
  for (const name of ['surfaces.json', 'material.json']) {
    const document = requireRecord(JSON.parse(originals.get(name)!.toString('utf8')));
    document.surfaces = records(document.surfaces).map(surface => replacements.get(requireString(surface.id)) ?? surface);
    await save(resolve(outputDirectory, name), document);
  }
  const nextInventory = { ...inventory, assets: assets.map(asset => asset.location === 'public' && changed.has(requireString(asset.filename)) ? { ...asset, ...changed.get(requireString(asset.filename)) } : asset) };
  await writeFile(resolve(objectDirectory, 'inventory.json'), JSON.stringify(nextInventory, null, 2) + '\n');
  const lensIds = views.map(view => view.id);
  // Context images and tiny navigation icons use the same material and retained mesh.
  const manifestPath = resolve(sourceDirectory, 'manifest.json'), manifest = await json(manifestPath);
  const navigation = await json(resolve(sourceDirectory, 'preparation/navigation.json'));
  let contextRecord: Record<string, unknown> | null = null;
  for (const entry of records(manifest.generatedIntermediates ?? [])) {
    const recipe = entry.recipe === undefined ? null : requireRecord(entry.recipe);
    if (!recipe || !lensIds.includes(requireString(recipe.lensId ?? '')) || !String(entry.generator).includes('radial-snapshot.')) continue;
    const surface = surfaces.find(surface => surface.id === recipe.lensId)!;
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
    const descriptors = [validateMarkerDescriptor(await loadObjectMarkerDescriptor(id, resolve('.')))];
    await prepareBodyMarkers({ projectRoot: resolve('.'), outputRoot: markerStage, descriptors });

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

    for (const filename of await readdir(markerStage)) await replaceAsset(resolve(markerStage, filename), resolve('public/navigation', filename));
  }
  await pretty(manifestPath, manifest);
  await prepareSurfaceMinimaps({ objectDirectory, publicDirectory, outputDirectory, photographs: lensIds });
  await refreshObservationControls(id, lensIds, new Map(lensIds.map(lensId => [lensId, SHAPE_MATERIAL.color])));
  await refreshShapeMaterialDescriptions(id);
  await prepareObjectProvenance({ objectDirectory, publicDirectory, outputDirectory, basis: 'recovered' });
  const report = { id, lensIds, seconds: (performance.now() - started) / 1000,
    retainedSceneSha256: sha256(originals.get('scene.json')!), recipeSha256: sha256(recipeBytes), material: SHAPE_MATERIAL,
    changedAssets: [...changed.values()], retainedAssets: assets.length - changed.size,
    geometryBasis: 'Existing prepared scene; original source mesh additionally verified for source-cast lighting.' };
  await writeFile(resolve(stage, 'refresh.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ id, seconds: report.seconds, changedAssets: changed.size }));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), sourceOption = args.find(arg => arg.startsWith('--source-root='));
  const sourceRoot = sourceOption?.slice('--source-root='.length), requested = args.filter(arg => !arg.startsWith('--'));
  const allIds = args.includes('--all') ? SCENE_OBJECTS.map(object => object.id) : requested;
  const shard = args.find(arg => arg.startsWith('--shard='))?.slice('--shard='.length).split('/').map(Number);
  if (shard && (shard.length !== 2 || !shard.every(Number.isSafeInteger) || shard[0] < 0 || shard[1] < 1 || shard[0] >= shard[1] || shard[1] > 4))
    throw new Error('Shard must be an index/count with at most four independent object batches.');
  const ids = shard ? allIds.filter((_id, index) => index % shard[1] === shard[0]) : allIds;
  if (!ids.length) throw new Error('Choose existing object ids or --all.');
  for (const id of ids) {
    if (args.includes('--all')) {
      let recipe;
      try { recipe = await json(resolve('src/objects', id, 'source/preparation/terrestrial.json')); }
      catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') continue; throw error; }
      if (!requireArray(requireRecord(recipe.raster).shapeViews ?? []).length) continue;
    }
    if (args.includes('--descriptions-only')) {
      await refreshShapeMaterialDescriptions(id);
      await prepareObjectProvenance({ objectDirectory: resolve('src/objects', id), publicDirectory: resolve('public/scenes', id), basis: 'recovered' });
      continue;
    }
    if (args.includes('--resume')) {
      let receipt;
      try { receipt = await json(resolve('output/shape-material-refresh', id, 'refresh.json')); }
      catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
      if (receipt && receipt.recipeSha256 === sha256(await readFile(resolve('src/objects', id, 'source/preparation/terrestrial.json'))) &&
          receipt.retainedSceneSha256 === sha256(await readFile(resolve('src/objects', id, 'prepared/scene.json')))) {
        for (const asset of records(receipt.changedAssets)) if (sha256(await readFile(resolve('public/scenes', id, requireString(asset.filename)))) !== asset.sha256)
          throw new Error(`Refreshed asset changed before resume: ${id}/${asset.filename}.`);
        continue;
      }
    }
    await refreshShapeMaterials(id, sourceRoot);
  }
}
