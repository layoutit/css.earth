// Reprepare selected photographs and their small previews, preserving the existing scene,
// lighting banks and scientific maps. Full preparation uses these same raster/interpreter owners.
import { updateInventory } from '../../src/platform/runtime-asset-closure.mts';
import { readAuthoredSources } from './authored-sources.js';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { parseAuthoredObjectDescriptor } from '@cssearth/objects';
import { parseRasterRecipe, prepareRasterAssets } from '../../src/preparation/raster/index.js';
import { prepareObjectContentAssets } from './content/prepare.js';
import { parseRuntimeManifest } from './operations.js';
import { requireRecord, requireArray } from '../source-values.mts';
import { requireString } from '../source-values.mts';

export async function refreshPhotographs(id: string, lensIds: readonly string[]) {
  if (!/^[a-z][a-z0-9-]*$/.test(id) || !lensIds.length || new Set(lensIds).size !== lensIds.length)
    throw new TypeError('Choose an object and distinct photographic lens IDs.');
  const objectDirectory = resolve('src/objects', id), sourceDirectory = resolve(objectDirectory, 'source');
  const outputDirectory = resolve(objectDirectory, 'prepared'), publicDirectory = resolve('public/scenes', id);
  const authored = await readAuthoredSources(objectDirectory);
  const sources = new Map([...authored.sources].map(([id, entry]) => [id, entry.value]));
  const config = parseRasterRecipe(sources.get('raster'));
  if (config.resample !== 'density-before-pack' || config.polesCombined || config.emission)
    throw new TypeError('Photographic refresh needs separately packed non-emissive raster surfaces.');
  if (lensIds.some(id => !config.surfaces.some(surface => surface.id === id))) throw new TypeError('Unknown photographic lens.');
  const selected = { ...config, surfaces: config.surfaces.filter(surface => lensIds.includes(surface.id)),
    lighting: undefined, atmosphere: undefined, interior: undefined };
  const { createSurfaceInterpreter, selectSurfaceDependencies } = await import(pathToFileURL(resolve('tools/objects/observation/interpret.mts')).href) as typeof import('./observation/interpret.mts');
  const interpret = await createSurfaceInterpreter({ objectId: id, displayName: id, sourceDirectory,
    recipe: selectSurfaceDependencies(config, lensIds), sourceVerification: 'photographs' });
  const stageRoot = resolve('.local/photographic-refresh'); await mkdir(stageRoot, { recursive: true });
  const stage = await mkdtemp(resolve(stageRoot, `${id}-`));
  // One encoder worker and no libvips image cache: the previous surface need not remain resident.
  sharp.concurrency(1); sharp.cache(false);
  const start = Date.now();
  const assets = await prepareRasterAssets({ sourceDirectory, publicDirectory: stage, outputDirectory: stage, config: selected, interpret });
  const manifest = parseRuntimeManifest(JSON.parse(await readFile(resolve(objectDirectory, 'inventory.json'), 'utf8')), id);
  const replacements = new Map<string, { filename: string; bytes: number; sha256: string }>();
  for (const [filename, pin] of Object.entries(assets.hashes)) {
    if (!manifest.assets.some(asset => asset.filename === filename)) throw new Error(`Refresh cannot introduce an unbound resource: ${filename}`);
    const bytes = await readFile(resolve(stage, filename));
    replacements.set(filename, { filename, bytes: bytes.length, sha256: requireString(requireRecord(pin).sha256) });
  }
  const previous = requireRecord(JSON.parse(await readFile(resolve(outputDirectory, 'assets.json'), 'utf8')));
  const combined = { ...previous, sourceDimensions: assets.sourceDimensions,
    surfaces: { ...requireRecord(previous.surfaces), ...assets.surfaces }, hashes: { ...requireRecord(previous.hashes), ...assets.hashes } };
  await mkdir(publicDirectory, { recursive: true });
  for (const filename of replacements.keys()) await copyFile(resolve(stage, filename), resolve(publicDirectory, filename));
  await writeFile(resolve(outputDirectory, 'assets.json'), JSON.stringify(combined) + '\n');
  await updateInventory({ planetId: id, objectDirectory, location: 'public', assets: manifest.assets.map(asset => replacements.get(asset.filename) ?? asset) });
  const { prepareSurfaceMinimaps } = await import(pathToFileURL(resolve('tools/prepare-surface-minimaps.mts')).href) as typeof import('../prepare-surface-minimaps.mts');
  await prepareSurfaceMinimaps({ objectDirectory, publicDirectory, outputDirectory, photographs: lensIds });
  await refreshSurfaceContent(id, lensIds);
  return { id, lenses: lensIds, assets: replacements.size, bytes: [...replacements.values()].reduce((sum, entry) => sum + entry.bytes, 0),
    seconds: (Date.now() - start) / 1000, maxRssMiB: process.resourceUsage().maxRSS / 1024, stage };
}

/** Refresh selected authored captions while preserving the retained scene and other lens controls. */
export async function refreshSurfaceContent(id: string, lensIds: readonly string[]) {
  if (!/^[a-z][a-z0-9-]*$/.test(id) || !lensIds.length || new Set(lensIds).size !== lensIds.length)
    throw new TypeError('Choose an object and distinct surface lens IDs.');
  const objectDirectory = resolve('src/objects', id), sourceDirectory = resolve(objectDirectory, 'source');
  const outputDirectory = resolve(objectDirectory, 'prepared'), publicDirectory = resolve('public/scenes', id);
  const content = (await readAuthoredSources(objectDirectory)).sources.get('content')?.reference;
  if (!content?.path.startsWith('source/')) throw new TypeError('Photographic refresh needs authored content.');
  const previousLenses = requireRecord(JSON.parse(await readFile(resolve(outputDirectory, 'lenses.json'), 'utf8')));
  const previousContent = requireRecord(JSON.parse(await readFile(resolve(outputDirectory, 'content.json'), 'utf8')));
  await prepareObjectContentAssets({ sourceDirectory, publicDirectory, outputDirectory, config: { contentPath: content.path.slice(7) } });
  const lensPath = resolve(outputDirectory, 'lenses.json'), preparedLenses = requireRecord(JSON.parse(await readFile(lensPath, 'utf8')));
  const replacementsById = new Map(requireArray(preparedLenses.controls).map(value => { const lens = requireRecord(value); return [requireString(lens.id), lens] as const; }));
  await writeFile(lensPath, JSON.stringify({ ...previousLenses, controls: requireArray(previousLenses.controls).map(value => {
    const lens = requireRecord(value), key = requireString(lens.id);
    if (!lensIds.includes(key)) return lens;
    const replacement = replacementsById.get(key); if (!replacement) throw new Error(`Missing photographic lens: ${key}`); return replacement;
  }) }) + '\n');
  if (previousContent.features !== undefined) {
    const features = requireRecord(previousContent.features);
    const path = resolve(outputDirectory, 'content.json');
    const content = requireRecord(JSON.parse(await readFile(path, 'utf8')));
    await writeFile(path, JSON.stringify({ ...content, features: { searchLabel: requireString(features.searchLabel), description: requireString(features.description) } }) + '\n');
  }
  // Asset URLs and the scene are retained. The writer updates the descriptor/page transport from the new content.
  const runtime = requireRecord(JSON.parse(await readFile(resolve(outputDirectory, 'runtime.json'), 'utf8')));
  const { repinObjectJson } = await import(pathToFileURL(resolve('tools/prepare-object-json.mts')).href) as typeof import('../prepare-object-json.mts');
  const updatedControls = requireRecord(JSON.parse(await readFile(resolve(outputDirectory, 'controls.json'), 'utf8')));
  const labels = new Map(requireArray(requireRecord(updatedControls.lenses).controls).map(value => { const lens = requireRecord(value); return [requireString(lens.id), lens] as const; }));
  const controls = requireRecord(runtime.controls), lenses = requireRecord(controls.lenses);
  const selection = requireArray(lenses.controls).map(value => {
    const lens = requireRecord(value), key = requireString(lens.id);
    if (!lensIds.includes(key)) return lens;
    const label = labels.get(key); if (!label) throw new Error(`Missing photographic caption: ${key}`); return label;
  });
  const { prepareWorldNavigationDefinition, writeWorldNavigationArtifacts } = await import('./prepare-world-navigation.js');
  const navigation = await prepareWorldNavigationDefinition({ objectDirectory, projectRoot: process.cwd(),
    definition: { ...runtime, controls: { ...controls, lenses: { ...lenses, controls: selection } } } });
  const scene = requireRecord(JSON.parse(await readFile(resolve(outputDirectory, 'scene.json'), 'utf8')));
  await writeWorldNavigationArtifacts(outputDirectory, navigation, scene);
  // Captions do not require recompiling texture matrices, seam treatment or body geometry.
  await repinObjectJson(id);
  const { prepareObjectProvenance } = await import(pathToFileURL(resolve('tools/objects/provenance.mts')).href) as typeof import('./provenance.mts');
  // Only these photographs ran. Bind the retained products without claiming a full package preparation.
  await prepareObjectProvenance({ objectDirectory, publicDirectory, outputDirectory, basis: 'recovered' });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [id, ...lenses] = process.argv.slice(2);
  if (!id) throw new TypeError('Usage: refresh-photographs.js <objectId> <lensId> [...]');
  console.log(JSON.stringify(await refreshPhotographs(id, lenses)));
}
