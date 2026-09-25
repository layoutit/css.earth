import { implementationPins } from '@cssearth/nebula-lab/server/implementation';
import { observationEnvelope, type VolumeRecipe, type ImageWcs } from '@cssearth/bake/volume';
import { parseLabModelJson } from '../../resources/model-paths.ts';
/** Lab experiment: registered native photograph + full stellar prior → filled, colored 3D components. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import type { DensityVolumeFrame } from '@cssearth/objects';
import { loadVolumeSource } from '@cssearth/volume-bake/compact-inputs/density-grid';
import { sha256 } from '@cssearth/core/node';
import type { VolumeSlices } from '@cssearth/volume-bake/slices/density';
import { compileCssVolume } from '../../adapters/preparation/css-volume.ts';
import { createObservationMapping, reprojectObservationPrior } from '../../adapters/preparation/observation-prior.ts';
import { decomposeFilledComponents, type FilledComponentOptions } from '@cssearth/nebula-reconstruction/methods/density-prior/filled-components';
import { createFilledVolumeSampler } from '@cssearth/nebula-reconstruction/methods/density-prior/filled-volume';
import { rectifyObservation, writeObservationPanel, extendedMap, validateObservationProjection } from '@cssearth/nebula-reconstruction/methods/density-prior/filled-products';
import { bakeMasterVolumeSlices, deriveMasterVolumeSlices } from '@cssearth/volume-bake/slices/emission';
import { validateCoherentAxisSampling } from '@cssearth/nebula-reconstruction/methods/density-prior/coherent-validation';

type Vec3 = [number, number, number];
interface Pin { path: string; sha256: string; }
interface Recipe {
  schema: 'cssearth-filled-observation@1'; id: string; directory: string;
  photo: Pin & { url: string; width: number; height: number; credit: string; license: string; publisherUrl: string };
  wcs: ImageWcs;
  frame: Pin;
  stellarPrior: Pin;
  analysis: { width: number; decomposition: FilledComponentOptions; priorDimensions: Vec3 };
  depth: Parameters<typeof createFilledVolumeSampler>[0]['depth'];
  diffusePriorWeight: number;
  channels: { compact: boolean; diffuse: boolean; extended: boolean };
  exposureGain: number; maxDisplaySignal: number;
  master: { width: number; sliceCounts: { x: number; y: number; z: number }; samplesPerSlab: number };
  delivery: { width: number; quality: number };
  variants: { id: string; name: string; directory: string; mode: 'broad' | 'coherent' }[];
  limitations: string[];
}
const json = (path: string, data: unknown) => writeFile(path, JSON.stringify(data, null, 2) + '\n');
async function pinned(pin: Pin, url?: string) {
  let bytes = await readFile(pin.path).catch(async (error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT' || !url) throw error;
    console.log(`FILLED_SOURCE_DOWNLOAD ${url}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Source download failed: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  });
  if (sha256(bytes) !== pin.sha256) throw new Error(`Pinned input drifted: ${pin.path}`);
  if (url) { await mkdir(dirname(pin.path), { recursive: true }); await writeFile(pin.path, bytes); }
  return bytes;
}

const [recipePath, selection, extra] = process.argv.slice(2);
if (!recipePath || extra) throw new Error('Usage: prepare-filled <recipe.json> [variant-id|analysis]');
const recipeBytes = await readFile(recipePath), recipe: Recipe = parseLabModelJson(recipeBytes.toString());
if (recipe.schema !== 'cssearth-filled-observation@1') throw new Error('Invalid filled observation recipe.');
if (!recipe.variants.length || recipe.variants.some(v => !['broad', 'coherent'].includes(v.mode)) ||
    new Set(recipe.variants.map(v => v.id)).size !== recipe.variants.length) throw new Error('Invalid experiment variants.');
const sourceDirectory = resolve(recipe.directory, 'source');
await mkdir(sourceDirectory, { recursive: true });
const nativePhoto = await pinned(recipe.photo, recipe.photo.url);
const frameSource = parseLabModelJson((await pinned(recipe.frame)).toString()) as { properties: { volume: DensityVolumeFrame } };
const frame = frameSource.properties.volume;
if (Math.abs(frame.metersPerUnit / 3.085677581491367e19 - 1) > 1e-10) throw new Error('Observation experiment requires kpc frame units.');
const mapping = createObservationMapping(recipe.wcs, frame);
const photo = await rectifyObservation(nativePhoto, mapping, recipe.analysis.width);
console.log(`FILLED_PHOTO_READY ${photo.width}x${photo.height} ${photo.coveredPixels} calibrated pixels`);
const decomposition = decomposeFilledComponents(photo.intensity, photo.width, photo.height, recipe.analysis.decomposition);
console.log(`FILLED_COMPONENTS_READY ${decomposition.components.length} ${JSON.stringify(decomposition.diagnostics)}`);
const extended = extendedMap(decomposition, photo.intensity.length), target = new Float32Array(photo.intensity.length);
for (let p = 0; p < target.length; p++) target[p] = (recipe.channels.compact ? decomposition.compact[p]! : 0) +
  (recipe.channels.diffuse ? decomposition.diffuse[p]! : 0) + (recipe.channels.extended ? extended[p]! : 0);
await Promise.all([
  writeObservationPanel(resolve(sourceDirectory, 'registered-photo.png'), photo),
  writeObservationPanel(resolve(sourceDirectory, 'target.png'), photo, target),
  writeObservationPanel(resolve(sourceDirectory, 'compact.png'), photo, decomposition.compact),
  writeObservationPanel(resolve(sourceDirectory, 'extended.png'), photo, extended),
  writeObservationPanel(resolve(sourceDirectory, 'diffuse.png'), photo, decomposition.diffuse),
]);
const sourceRecipe = parseLabModelJson((await pinned(recipe.stellarPrior)).toString()) as VolumeRecipe;
const stellarSource = await loadVolumeSource(dirname(recipe.stellarPrior.path), sourceRecipe);
const prior = reprojectObservationPrior(stellarSource, mapping, { dimensions: recipe.analysis.priorDimensions });
const priorPath = resolve(sourceDirectory, 'observation-prior.f32.gz');
const priorBytes = Buffer.alloc(prior.density.length * 4);
prior.density.forEach((value, index) => priorBytes.writeFloatLE(value, index * 4));
await writeFile(priorPath, gzipSync(priorBytes, { level: 9 }));
const pins = Object.fromEntries((await implementationPins(process.cwd(), ['labs/nebula/packages/lab/src/cli/commands/prepare-filled.ts'])).map(pin => [pin.path, pin.sha256]));
const bounds = prior.boundsKpc;
const evidence = { schema: 'cssearth-filled-observation-evidence@1', recipe: { path: recipePath, sha256: sha256(recipeBytes) },
  photo: recipe.photo, wcs: recipe.wcs, pins, observation: { tangentBoundsKpc: bounds, physicalBoundsKpc: observationEnvelope(mapping,bounds),
    distanceKpc: mapping.distanceUnits, width: photo.width, height: photo.height, coveredPixels: photo.coveredPixels,
    sourceFootprint: 'Full photograph, rectified with calibrated WCS. No manual scale, rotation, or displacement.',
    intensityMeaning: 'Rec.709-weighted encoded sRGB display signal; not linear radiance or a gas-density measurement.' },
  prior: { ...prior.diagnostics, source: recipe.stellarPrior, boundsKpc: prior.boundsKpc, dimensions: prior.dimensions,
    sha256: sha256(await readFile(priorPath)) }, decomposition: decomposition.diagnostics,
  channels: recipe.channels, limitations: recipe.limitations };
await json(resolve(sourceDirectory, 'analysis.json'), evidence);
if (selection === 'analysis') { console.log('FILLED_ANALYSIS_COMPLETE'); process.exit(0); }
const selected = recipe.variants.filter(v => !selection || v.id === selection);
if (!selected.length) throw new Error(`Unknown variant: ${selection}`);
for (const variant of selected) {
  const sampler = createFilledVolumeSampler({ target: photo, decomposition, boundsKpc: bounds, densityPrior: prior,
    mode: variant.mode, channels: recipe.channels, depth: recipe.depth, diffusePriorWeight: recipe.diffusePriorWeight,
    exposureGain: recipe.exposureGain, maxDisplaySignal: recipe.maxDisplaySignal });
  const physicalBounds = observationEnvelope(mapping, sampler.supportBoundsKpc);
  const sample: typeof sampler.sample = (x, y, z, out) => {
    const [tx, ty] = mapping.tangentAtPoint(x, y, z);
    sampler.sample(tx, ty, z, out);
    const dsDz = mapping.rayPathPerDepth(tx, ty);
    out[0] /= dsDz; out[1] /= dsDz; out[2] /= dsDz;
  };
  const projected = validateObservationProjection({ sampler, physicalSample: sample, mapping, photo, bounds,
    samples: recipe.master.sliceCounts.z * recipe.master.samplesPerSlab, exposure: recipe.exposureGain });
  const quadrature = validateCoherentAxisSampling({ sampler: { sample }, bounds: physicalBounds,
    samples: { x: recipe.master.sliceCounts.x * recipe.master.samplesPerSlab,
      y: recipe.master.sliceCounts.y * recipe.master.samplesPerSlab,
      z: recipe.master.sliceCounts.z * recipe.master.samplesPerSlab }, exposureGain: recipe.exposureGain });
  const validation = { projected, quadrature };
  const provenance = { ...evidence, variant, volume: sampler.diagnostics, validation,
    bakeSupport: { tangentBoundsKpc: sampler.supportBoundsKpc, physicalBoundsKpc: physicalBounds,
      method: 'Conservative emission support computed after depth assignment; the entire source prior remains unchanged.' } };
  console.log(`FILLED_FIELD_READY ${variant.id} ${JSON.stringify(sampler.diagnostics)}`);
  const cacheKey = sha256(Buffer.from(JSON.stringify({ provenance, master: recipe.master }))).slice(0, 16);
  const masterDirectory = resolve('.local/nebula-lab/filled', cacheKey, 'masters');
  const deliveryBanks = [{ width: recipe.delivery.width, outputDirectory: resolve(variant.directory, 'prepared'),
    imageEncoding: { format: 'webp' as const, quality: recipe.delivery.quality } }];
  const cached = await readFile(resolve(masterDirectory, 'volume-slices.json'), 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error; return null;
  });
  let slices: VolumeSlices;
  if (cached) slices = (await deriveMasterVolumeSlices({ masters: parseLabModelJson(cached), masterDirectory, deliveryBanks }))[0]!.slices;
  else slices = (await bakeMasterVolumeSlices({ sampleEmission: sample, boundsKpc: physicalBounds,
    sliceCounts: recipe.master.sliceCounts, samplesPerSlab: recipe.master.samplesPerSlab, exposureGain: recipe.exposureGain,
    masterWidth: recipe.master.width, masterDirectory, deliveryBanks, unitsPerSourceUnit: 1, provenance })).banks[0]!.slices;
  const outputFrame = { ...frame, boundsUnits: physicalBounds };
  const data = compileCssVolume({ id: variant.id, frame: outputFrame, slices, recipe: { anchors: [] } });
  const prepared = { schema: 'cssearth-prepared-object@1', id: variant.id, type: 'density-volume',
    format: 'cssearth-density-volume@1', data };
  const preparedBytes = Buffer.from(JSON.stringify(prepared) + '\n');
  await mkdir(resolve(variant.directory, 'source'), { recursive: true });
  await json(resolve(variant.directory, 'source/provenance.json'), provenance);
  await json(resolve(variant.directory, 'source/validation.json'), validation);
  await writeFile(resolve(variant.directory, 'prepared/volume.json'), preparedBytes);
  await json(resolve(variant.directory, 'object.json'), { schema: 'cssearth-object@1', id: variant.id, type: 'density-volume',
    properties: { volume: outputFrame, preparation: { source: 'source/provenance.json',
      sha256: sha256(await readFile(resolve(variant.directory, 'source/provenance.json'))) } },
    prepared: { format: prepared.format, url: 'prepared/volume.json' } });
  console.log(`FILLED_PREPARED ${variant.id} ${data.resources.length} images ${data.resources.reduce((s, r) => s + r.bytes, 0)} bytes`);
}
console.log('FILLED_EXPERIMENT_COMPLETE');
