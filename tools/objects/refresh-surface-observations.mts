/** Refresh existing observation lenses using the full preparer's raster and atlas owners. */
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { requireRecord, requireArray, requireString } from '../source-values.mts';
import { createSourceManifest } from '../../src/platform/source-manifest.mts';
import { requireBodyFixedSunDirection } from '../../src/platform/solar-geometry.mts';
import { parseSolidPreparationSource } from './terrestrial-layers/profile-source.mts';
import { loadRadialTerrain, prepareRadialMaterials } from './terrestrial-layers/radial-terrain.mts';
import { prepareSolidRasters, prepareSolidSurfacePoles } from './terrestrial-layers/solid-raster.mts';
import { lensBillboardColors } from './content/billboard-colors.mts';
import { retainedPhotographicAtlas } from './refresh-terrain-photographs.mts';
import { prepareSurfaceMinimaps } from '../prepare-surface-minimaps.mts';
import { prepareObjectProvenance } from './provenance.mts';
import { repinObjectJson } from '../prepare-object-json.mts';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const json = async (path: string) => requireRecord(JSON.parse(await readFile(path, 'utf8')));
const records = (value: unknown) => requireArray(value).map(value => requireRecord(value));
const save = (path: string, value: unknown) => writeFile(path, JSON.stringify(value) + '\n');

export async function refreshSurfaceObservations(id: string, lensIds: readonly string[]) {
  if (!/^[a-z][a-z0-9-]*$/.test(id) || !lensIds.length || new Set(lensIds).size !== lensIds.length)
    throw new TypeError('Choose a body and distinct existing observation lenses.');
  const started = performance.now(), objectDirectory = resolve('src/planets', id), sourceDirectory = resolve(objectDirectory, 'source');
  const outputDirectory = resolve(objectDirectory, 'prepared'), publicDirectory = resolve('public/scenes', id);
  const stage = resolve('output/surface-observation-refresh', id), recipePath = resolve(sourceDirectory, 'preparation/terrestrial.json');
  const recipeBytes = await readFile(recipePath), descriptor = await json(resolve(objectDirectory, 'object.json'));
  const references = records(requireRecord(requireRecord(descriptor.properties).recipe).sources);
  for (const reference of references) {
    const path = requireString(reference.path);
    if (hash(await readFile(resolve(objectDirectory, path))) !== reference.sha256) throw new Error(`Pin the source recipe before refreshing: ${path}.`);
  }
  if (references.find(reference => reference.id === 'terrestrial')?.sha256 !== hash(recipeBytes)) throw new Error('Pin the observation recipe before refreshing.');
  const config = parseSolidPreparationSource(JSON.parse(recipeBytes.toString('utf8')));
  const terrain = requireRecord(config.geometry.radialTerrain);
  if (config.geometry.radialModels || config.geometry.radialTerrainAlternatives || terrain.sourceLighting)
    throw new Error('This refresh supports existing single-model observation lenses without source lighting.');
  const selected = config.raster.surfaceObservations?.filter(recipe => lensIds.includes(recipe.id)) ?? [];
  if (selected.length !== lensIds.length) throw new Error('Unknown surface-observation lens.');
  const originals = new Map<string, Buffer>();
  for (const name of ['scene.refs.json', 'surfaces.json', 'material.json', 'runtime-assets.json', 'minimaps.json']) originals.set(name, await readFile(resolve(outputDirectory, name)));
  const previousSurfaces = requireRecord(JSON.parse(originals.get('surfaces.json')!.toString('utf8')));
  if (lensIds.some(id => !records(previousSurfaces.surfaces).some(surface => surface.id === id))) throw new Error('Refresh cannot add a lens.');
  sharp.concurrency(1); sharp.cache(false);
  const source = await createSourceManifest({ planetId: id, planetName: id, sourceRoot: sourceDirectory });
  const radial = await loadRadialTerrain({ config, sourceDirectory, source });
  if (!radial) throw new Error('Observation refresh requires source terrain.');
  const retained = retainedPhotographicAtlas(requireRecord(JSON.parse(originals.get('scene.refs.json')!.toString('utf8'))));
  // Reuse the full preparer's source mesh and exact plans. A geometry change needs a full preparation.
  if (retained.width !== radial.width || retained.height !== radial.height || retained.tileSize !== radial.tileSize ||
      retained.plans.length !== radial.plans.length || retained.plans.some((plan, i) =>
        plan.rect.x !== radial.plans[i].rect.x || plan.rect.y !== radial.plans[i].rect.y ||
        plan.matrix.some((value, j) => value !== radial.plans[i].matrix[j]))) throw new Error('Retained atlas geometry differs from the source recipe.');
  await mkdir(stage, { recursive: true });
  const rasterConfig = { ...config, raster: { ...config.raster, observations: [], scientific: [], shapeViews: [], observedColors: [], surfaceObservations: selected } };
  const surfaces = await prepareSolidRasters({ config: rasterConfig, sourceDirectory, source, radial, publicDirectory: stage, outputDirectory: stage });
  // Like the full preparer's material step, record each surface's billboard colour before the radial materials add its shadow surface.
  await prepareSolidSurfacePoles({ surfaces, publicDirectory: stage, config: rasterConfig });
  await prepareRadialMaterials({ radial, surfaces, config: { ...rasterConfig, geometry: { ...config.geometry, radialTerrain: { thumbnail: terrain.thumbnail } } }, source, sourceDirectory, publicDirectory: stage, outputDirectory: stage,
    sunDirection: requireBodyFixedSunDirection(id), snapshotEntries: [] });
  const replacements = new Map(surfaces.map(surface => [surface.id, surface]));
  const inventory = requireRecord(JSON.parse(originals.get('runtime-assets.json')!.toString('utf8'))), assets = records(inventory.assets);
  const changed = new Map<string, { filename: string; bytes: number; sha256: string }>();
  for (const surface of surfaces) {
    const old = records(previousSurfaces.surfaces).find(old => old.id === surface.id)!;
    for (const key of ['surface', 'shadowSurface', 'thumbnail', 'map']) {
      const value = requireRecord(surface[key]), url = requireString(value.url);
      if (url !== requireRecord(old[key]).url) throw new Error(`Refresh cannot change the ${key} resource name.`);
      const filename = url.split('/').at(-1)!;
      const bytes = await readFile(resolve(stage, filename));
      if (hash(bytes) !== value.sha256 || bytes.length !== value.bytes) throw new Error(`Invalid staged asset ${filename}.`);
      if (assets.some(asset => asset.filename === filename)) changed.set(filename, { filename, bytes: bytes.length, sha256: hash(bytes) });
    }
  }
  // Confirm the package has not changed while preparing, before applying any replacements.
  for (const [name, bytes] of originals) if (hash(await readFile(resolve(outputDirectory, name))) !== hash(bytes)) throw new Error(`Package changed during refresh: ${name}.`);
  if (hash(await readFile(recipePath)) !== hash(recipeBytes)) throw new Error('Recipe changed during refresh.');
  for (const name of ['surfaces.json', 'material.json']) {
    const document = requireRecord(JSON.parse(originals.get(name)!.toString('utf8')));
    document.surfaces = records(document.surfaces).map(surface => replacements.get(requireString(surface.id)) ?? surface);
    await save(resolve(outputDirectory, name), document);
  }
  await mkdir(publicDirectory, { recursive: true });
  for (const surface of surfaces) for (const key of ['surface', 'shadowSurface', 'thumbnail', 'map']) {
    const filename = requireString(requireRecord(surface[key]).url).split('/').at(-1)!;
    await copyFile(resolve(stage, filename), resolve(publicDirectory, filename));
  }
  for (const filename of await readdir(stage)) if (lensIds.some(id => filename === `${id}-source-index.json`)) await copyFile(resolve(stage, filename), resolve(outputDirectory, filename));
  const nextInventory = { ...inventory, assets: assets.map(asset => changed.get(requireString(asset.filename)) ?? asset) };
  for (const path of [resolve(objectDirectory, 'runtime-assets.json'), resolve(outputDirectory, 'runtime-assets.json')]) await writeFile(path, JSON.stringify(nextInventory, null, 2) + '\n');
  await prepareSurfaceMinimaps({ objectDirectory, publicDirectory, outputDirectory, photographs: lensIds });
  await refreshObservationDescriptions(id, lensIds, new Map(surfaces.map(surface => [surface.id, requireString(surface.billboardColor)])));
  await prepareObjectProvenance({ objectDirectory, publicDirectory, outputDirectory, basis: 'recovered' });
  if (hash(await readFile(resolve(outputDirectory, 'scene.refs.json'))) !== hash(originals.get('scene.refs.json')!)) throw new Error('Observation refresh changed the scene.');
  const report = { id, lensIds, seconds: (performance.now() - started) / 1000, maxRssMiB: process.resourceUsage().maxRSS / 1024,
    recipeSha256: hash(recipeBytes), retainedSceneSha256: hash(originals.get('scene.refs.json')!), refreshedRuntimeAssets: [...changed.values()],
    retainedRuntimeAssetCount: assets.length - changed.size, provenanceBasis: 'recovered', observations: surfaces.map(surface => surface.observation) };
  await writeFile(resolve(stage, 'refresh.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ id, seconds: report.seconds, maxRssMiB: report.maxRssMiB, refreshedAssets: changed.size, retainedAssets: report.retainedRuntimeAssetCount }));
  return report;
}

/** Refresh source-owned lens descriptions and the refreshed lenses' billboard colours without rebaking any images. */
export async function refreshObservationDescriptions(id: string, lensIds: readonly string[], surfaceColors: ReadonlyMap<string, string> = new Map()) {
  if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error('Invalid object id.');
  const objectDirectory = resolve('src/planets', id), outputDirectory = resolve(objectDirectory, 'prepared'), publicDirectory = resolve('public/scenes', id);
  const descriptor = await json(resolve(objectDirectory, 'object.json'));
  const references = records(requireRecord(requireRecord(descriptor.properties).recipe).sources);
  // The source-owned description explains the selected observations. Keep the
  // existing prepared controls, feature catalogue and all other shell content.
  const contentPath = references.find(reference => reference.id === 'content');
  const descriptions = new Map<string, { description: string; summary: string | undefined }>();
  if (contentPath) {
    const bytes = await readFile(resolve(objectDirectory, requireString(contentPath.path)));
    if (hash(bytes) !== contentPath.sha256) throw new Error('Source content changed from its descriptor pin.');
    const content = requireRecord(JSON.parse(bytes.toString('utf8')));
    for (const lens of records(requireRecord(content.lenses).controls)) if (lensIds.includes(requireString(lens.id)))
      descriptions.set(requireString(lens.id), { description: requireString(lens.description), summary: lens.summary === undefined ? undefined : requireString(lens.summary) });
  }
  // As in the full preparer, only the lens catalogue carries control colours. Recolour each control whose image was refreshed, including an interior view of a refreshed default lens; runtime variants take the surface billboard colour.
  const lenses = await json(resolve(outputDirectory, 'lenses.json')), defaultLens = requireString(lenses.defaultLens);
  const controlColors = await lensBillboardColors(records(lenses.controls), defaultLens, publicDirectory);
  const update = (controls: unknown, colored: boolean) => records(controls).map(control => {
    const lensId = requireString(control.id), refreshed = lensIds.includes(lensId);
    const recolored = colored && (refreshed || (control.view === 'interior' && lensIds.includes(defaultLens)));
    return refreshed || recolored ? { ...control, ...descriptions.get(lensId), ...(recolored ? { billboardColor: controlColors.get(lensId) } : {}) } : control;
  });
  for (const name of ['lenses.json', 'controls.json', 'runtime.json']) {
    const path = resolve(outputDirectory, name), document = await json(path);
    const target = name === 'lenses.json' ? document : requireRecord(name === 'controls.json' ? document.lenses : requireRecord(document.controls).lenses);
    target.controls = update(target.controls, name === 'lenses.json');
    if (name === 'runtime.json') document.variants = records(document.variants).map(variant => {
      const color = surfaceColors.get(requireString(requireRecord(variant.when).lensId));
      return color === undefined ? variant : { ...variant, writes: records(variant.writes).map(write => write.name === `--${id}-billboard-color` ? { ...write, value: color } : write) };
    });
    await save(path, document);
  }
  await repinObjectJson(id);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [id, ...lenses] = process.argv.slice(2);
  await refreshSurfaceObservations(id, lenses);
}
