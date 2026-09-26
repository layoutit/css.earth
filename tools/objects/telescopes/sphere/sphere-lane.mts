/** A measurement lens for an existing standard sphere. No geometry or camera is authored here. */
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { clearInactiveImageBindings } from './sphere-assets.mts';
import { inventoryAssets } from '../../../assets/runtime-assets.mts';
import { installRuntimeAssets } from '../../../assets/setup.mts';
import { requireRecord } from '@cssearth/core';
import { sha256 } from '@cssearth/core/node';
import { parseRasterRecipe, prepareRasterAssets } from '../../../../src/preparation/raster/index.ts';
import { parsePreparedObjectRuntime } from '@cssearth/renderer/validation/index.ts';
import { parseGeometryProfile } from '../../../../src/renderers/css/preparation/scene/profile.ts';
import { prepareScientificNavigation } from '../../terrestrial-layers/scientific-focus.mts';
import { parsePreparedWorldContext } from '@cssearth/renderer/prepared-data/world-context.ts';


export async function inspectMeasurementSphere(root:string,target:string){
  const id = target.toLowerCase();
  if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error('Sphere output needs an existing body identity');
  const object = resolve(root, 'src/objects', id);
  const inputs: { role: string; identity: string; sha256: string; bytes: number }[] = [];
  const pinned = async (file: string) => {
    const bytes = await readFile(file);
    inputs.push({ role: 'standard sphere input', identity: file, sha256: sha256(bytes), bytes: bytes.length });
    return bytes;
  };
  const json = async (file: string): Promise<unknown> => JSON.parse((await pinned(file)).toString());
  await pinned(resolve(root, 'pnpm-lock.yaml'));
  const geometry = parseGeometryProfile(await json(resolve(object, 'source/preparation/geometry.json')));
  if (geometry.namespace !== id) throw new Error('Standard sphere geometry belongs to another body');
  const recipe = parseRasterRecipe(await json(resolve(object, 'source/preparation/raster.json')));
  await pinned(resolve(object, 'inventory.json'));
  const original = parsePreparedObjectRuntime(await json(resolve(object, 'prepared/runtime.json')));
  if (original.id !== id || original.destinations)
    throw new Error('This sphere requires application capabilities that cannot be exported');
  const lensId = original.controls.lenses?.defaultLens;
  const surface = recipe.surfaces.find(item => item.id === lensId);
  if (!lensId || !surface) throw new Error('Standard sphere has no matching prepared surface lens');
  const replacementKeys=new Set([`surface:${lensId}`,`poles:${lensId}`,'poles']);
  const variant = original.variants.find(item => item.when.lensId === lensId && item.when.shadows !== true && item.when.atmosphere !== true);
  if (!variant) throw new Error('Standard sphere has no unshadowed surface variant');
  const required = variant.required.filter(key => replacementKeys.has(key));
  if (!required.some(key => key.startsWith('surface:'))) throw new Error('Sphere surface binding is unavailable');
  const styles = await Promise.all(['src/renderers/css/styles/body-surfaces.css', 'site/object-shell.css'].map(file => pinned(resolve(root, file))));
  try { styles.push(await pinned(resolve(root, `src/renderers/css/styles/${id}-surfaces.css`))); }
  catch(error) { if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') throw error; }
  const descriptor = requireRecord(await json(resolve(object, 'object.json'))),properties = requireRecord(descriptor.properties),worldFrame = properties.worldFrame;
  if (!worldFrame) throw new Error('Standard sphere has no prepared physical frame');
  const context = parsePreparedWorldContext(await json(resolve(root, 'src/objects/sun/prepared/world-context.json')));
  return {id,object,inputs,pinned,recipe,original,lensId,surface,variant,required,styles,worldFrame,context};
}

export async function measurementSphere(root: string, target: string, texture: string, output: string,
  focus: { longitudeDegrees: number; latitudeDegrees: number; zoom: number }) {
  const id=target.toLowerCase();
  if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error('Sphere output needs an existing body identity');
  const assetsToInstall = await inventoryAssets(root, [id], { location: 'prepared' });
  await installRuntimeAssets(assetsToInstall.filter(asset => asset.filename === 'runtime.json'));
  const {inputs,pinned,recipe,original,lensId,surface,variant,required,styles,worldFrame,context}=await inspectMeasurementSphere(root,target);
  // Keep the original packing, gutters, pole atlas and density. The standard raster lane
  // receives already projected colours and uses nearest/lossless handling for measurements.
  const rasterDirectory = resolve(output, 'raster');
  await mkdir(rasterDirectory, { recursive: true });
  // Mercury's combined pole bank reads the unpacked source at its authored
  // dimensions. Keep that source-packed route instead of inventing a pole atlas.
  let rasterSource = texture;
  if (recipe.resample === 'source-packed') {
    if (recipe.sourceWidth !== recipe.width * 2 || recipe.sourceHeight !== recipe.height * 2 ||
        recipe.surfaces.some(item => (item.resolutionScale ?? 1) !== 1))
      throw new Error('Source-packed measurement requires matching canonical source dimensions');
    rasterSource = resolve(rasterDirectory, 'measurement-source.png');
    await sharp(texture).resize(recipe.sourceWidth, recipe.sourceHeight, { fit: 'fill', kernel: 'nearest' }).png().toFile(rasterSource);
  }
  const surfaces = [surface].map(item => ({
    id: item.id, source: rasterSource, falseColor: true, output: item.output.replace(/\.jpe?g$/, '.webp'),
    thumbnail: item.thumbnail, ...(item.resolutionScale ? { resolutionScale: item.resolutionScale } : {}),
    science: { kind: 'projected-measurement' },
  }));
  const { lighting: _lighting, atmosphere: _atmosphere, interior: _interior, emission: _emission, ...layout } = recipe;
  const assets = await prepareRasterAssets({ sourceDirectory: '/', publicDirectory: rasterDirectory,
    outputDirectory: rasterDirectory, config: { ...layout, surfaces },
    interpret: async (_source, width, height) => ({
      data: await sharp(texture).resize(width, height, { fit: 'fill', kernel: 'nearest' }).ensureAlpha().raw().toBuffer(),
      channels: 4, nearest: true,
    }),
  });
  const selected = assets.surfaces[lensId];
  const poles = recipe.polesOutput.replaceAll('{id}', lensId).replaceAll('{suffix}', '@2x').replaceAll('{density}', '2');
  const surfaceFile = resolve(rasterDirectory, surfaces.find(item => item.id === lensId)!.output.replaceAll('{id}', lensId).replaceAll('{suffix}', '@2x').replaceAll('{density}', '2'));
  const dataUrl = async (file: string) => 'data:image/webp;base64,' + (await pinned(file)).toString('base64');
  const replacement = new Map([
    [`surface:${lensId}`, await dataUrl(surfaceFile)],
    [`poles:${lensId}`, await dataUrl(resolve(rasterDirectory, poles))],
    // Mercury's row-bank presentation shares a combined pole atlas across lenses.
    ['poles', await dataUrl(resolve(rasterDirectory, poles))],
  ]);
  // Preserve the exact prepared tree, facing/depth bindings and camera. Quantitative colour
  // must not be multiplied by the photographic lighting plane, even at full phase.
  // Inactive lenses retain image-valued custom properties in the shared tree.
  // Clear only bindings to excluded assets; node identity and geometry stay intact.
  const excluded = original.assets.entries.filter(entry => !required.includes(entry.key));
  const { properties: portableProperties, inactiveImageProperties } = clearInactiveImageBindings(original.tree.properties, excluded);
  const tree = { ...original.tree, properties: portableProperties };
  const navigation = prepareScientificNavigation(id, focus, original.camera);
  // Apply the measurement view immediately, keeping the viewport's fitted zoom.
  const { features: _features, ...portable } = original;
  const definition = parsePreparedObjectRuntime({ ...portable, tree,
    controls: { lenses: { defaultLens: lensId, controls: [{ id: lensId, label: 'Measurement' }] }, settings: null },
    materials: [], motion: [], animations: [],
    variants: [{ ...variant, when: { lensId }, required, materials: [],
      navigation: { ...navigation, camera: { ...navigation.camera, transition: { durationMilliseconds: 0, preserveZoom: true } } },
      writes: [...variant.writes, ...original.materials.map(track => ({ kind: 'style', target: track.target, name: 'visibility', value: 'hidden' }))] }],
    assets: { ...original.assets, entries: original.assets.entries.filter(entry => required.includes(entry.key)), startup: required },
  });
  // Prepared properties may address the old surface URL directly. Replace only the
  // selected lens's URLs; the geometry, dimensions and texture coordinates remain exact.
  const oldToNew = new Map(original.assets.entries.filter(entry => replacement.has(entry.key)).map(entry => [entry.url, replacement.get(entry.key)!]));
  let css = styles.map(bytes => bytes.toString()).join('\n');
  // Shared styles also contain other bodies/lenses. None is reachable in this
  // one-lens document, and none may trigger a network request from the export.
  css = css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (_match, _quote, url: string) => {
    const embedded = oldToNew.get(url.trim());
    return embedded ? `url("${embedded}")` : 'none';
  });
  // Only the selected lens is reachable. Reject an asset dependency instead of allowing
  // the supposedly portable HTML to quietly fetch a different scientific image.
  const serialized = JSON.stringify(definition);
  for (const entry of original.assets.entries) {
    if (!oldToNew.has(entry.url) && serialized.includes(entry.url)) throw new Error(`Unembedded standard sphere asset: ${entry.key}`);
  }
  return { definition, worldFrame, context, css, inputs, embeddedAssets: Object.fromEntries(oldToNew), owner: {
    object: id, runtimeSha256: inputs.find(input => input.identity.endsWith('/prepared/runtime.json'))!.sha256,
    treeSha256: sha256(JSON.stringify(original.tree)), geometry: 'existing standard sphere; unchanged nodes and geometry; inactive image bindings cleared', inactiveImageProperties,
    physicalFrame: worldFrame, projectionShape: 'standard reference sphere', surfaceUrl: selected.url,
    rasterToolchain: { node: process.version, sharp: sharp.versions },
  } };
}
export { sphereHtml } from './sphere-html.mts';
