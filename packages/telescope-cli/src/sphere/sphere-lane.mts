/** A measurement dataset for an existing standard sphere. No geometry or camera is authored here. */
import { parsePreparedObjectRuntime } from '@cssearth/objects';

import { existsSync } from 'node:fs';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { clearInactiveImageBindings } from './sphere-assets.mts';
import { inventoryAssets } from '@cssearth/bake/delivery';
import { LEAF_BOXES_FILE } from '@cssearth/objects/node';
import { installRuntimeAssets } from '@cssearth/bake/asset-publication';

import { outputName, prepareRasterAssets, rasterPageOutput } from '@cssearth/bake/raster';

import { prepareScientificNavigation } from '@cssearth/bake/objects/layers/terrestrial';
import type { SolarGeometry } from '@cssearth/bake/objects/scene';

export { inspectMeasurementSphere } from './sphere-inputs.mts';
import { inspectMeasurementSphere } from './sphere-inputs.mts';

export async function measurementSphere(root: string, target: string, texture: string, output: string,
  focus: { longitudeDegrees: number; latitudeDegrees: number; zoom: number }, solarGeometry: SolarGeometry) {
  const id=target.toLowerCase();
  if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error('Sphere output needs an existing body identity');
  if (!existsSync(resolve(root, 'sphere-bank.json.gz'))) {
    const assetsToInstall = await inventoryAssets(root, [id], { location: 'prepared' });
    await installRuntimeAssets(assetsToInstall.filter(asset => asset.filename === 'runtime.json' || asset.filename === LEAF_BOXES_FILE));
  }
  const {inputs,pinned,recipe,original,datasetId,surface,variant,required,styles,worldFrame}=await inspectMeasurementSphere(root,target);
  // Keep the original packing, gutters, pole atlas and density. The standard raster lane
  // receives already projected colors and uses nearest/lossless handling for measurements.
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
  const selected = assets.surfaces[datasetId];
  const poles = recipe.polesOutput.replaceAll('{id}', datasetId).replaceAll('{suffix}', '@2x').replaceAll('{density}', '2');
  const surfaceOutput = surfaces.find(item => item.id === datasetId)!.output;
  const dataUrl = async (file: string) => 'data:image/webp;base64,' + (await pinned(file)).toString('base64');
  const pagePrefix = `surface:${datasetId}:`;
  const replacement = new Map([
    // The measurement shows its full pages at every size: the levels are dropped below.
    ...await Promise.all(required.filter(key => key === `surface:${datasetId}` || key.startsWith(pagePrefix)).map(async key => [key, await dataUrl(resolve(rasterDirectory,
      key.startsWith(pagePrefix) ? rasterPageOutput(surfaceOutput, 2, datasetId, Number(key.slice(pagePrefix.length))) : outputName(surfaceOutput, 2, datasetId)))] as const)),
    [`poles:${datasetId}`, await dataUrl(resolve(rasterDirectory, poles))],
    // Mercury's row-bank presentation shares a combined pole atlas across datasets.
    ['poles', await dataUrl(resolve(rasterDirectory, poles))],
  ]);
  // Preserve the exact prepared tree, facing/depth bindings and camera. Quantitative color
  // must not be multiplied by the photographic lighting plane, even at full phase.
  // Inactive datasets retain image-valued custom properties in the shared tree.
  // Clear only bindings to excluded assets; node identity and geometry stay intact.
  const excluded = original.assets.entries.filter(entry => !required.includes(entry.key));
  const { properties: portableProperties, inactiveImageProperties } = clearInactiveImageBindings(original.tree.properties, excluded);
  const tree = { ...original.tree, properties: portableProperties };
  const navigation = prepareScientificNavigation(solarGeometry, id, focus, original.camera);
  // Apply the measurement view immediately, keeping the viewport's fitted zoom.
  const { features: _features, textureLevels: _levels, ...portable } = original;
  const definition = parsePreparedObjectRuntime({ ...portable, tree,
    controls: { datasets: { defaultDataset: datasetId, controls: [{ id: datasetId, label: 'Measurement' }] }, settings: null },
    materials: [], motion: [], animations: [],
    variants: [{ ...variant, when: { datasetId }, required, materials: [],
      navigation: { ...navigation, camera: { ...navigation.camera, transition: { durationMilliseconds: 0, preserveZoom: true } } },
      writes: [...variant.writes, ...original.materials.map(track => ({ kind: 'style', target: track.target, name: 'visibility', value: 'hidden' }))] }],
    assets: { ...original.assets, entries: original.assets.entries.filter(entry => required.includes(entry.key)), startup: required },
  });
  // Prepared properties may address the old surface URL directly. Replace only the
  // selected dataset's URLs; the geometry, dimensions and texture coordinates remain exact.
  const oldToNew = new Map(original.assets.entries.filter(entry => replacement.has(entry.key)).map(entry => [entry.url, replacement.get(entry.key)!]));
  let css = styles.map(bytes => bytes.toString()).join('\n');
  // Shared styles also contain other bodies/datasets. None is reachable in this
  // one-dataset document, and none may trigger a network request from the export.
  css = css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (_match, _quote, url: string) => {
    const embedded = oldToNew.get(url.trim());
    return embedded ? `url("${embedded}")` : 'none';
  });
  // Only the selected dataset is reachable. Reject an asset dependency instead of allowing
  // the supposedly portable HTML to quietly fetch a different scientific image.
  const serialized = JSON.stringify(definition);
  for (const entry of original.assets.entries) {
    if (!oldToNew.has(entry.url) && serialized.includes(entry.url)) throw new Error(`Unembedded standard sphere asset: ${entry.key}`);
  }
  return { definition, worldFrame, css, inputs, embeddedAssets: Object.fromEntries(oldToNew), owner: {
    object: id, runtime: inputs.find(input => input.role==='prepared sphere bank'||/\/prepared\/runtime\.json$/.test(input.identity)),
    geometry: 'existing standard sphere; unchanged nodes and geometry; inactive image bindings cleared', inactiveImageProperties,
    physicalFrame: worldFrame, projectionShape: 'standard reference sphere', surfaceUrl: selected.url,
    rasterToolchain: { node: process.version, sharp: sharp.versions },
  } };
}
export { sphereHtml } from './sphere-html.mts';
