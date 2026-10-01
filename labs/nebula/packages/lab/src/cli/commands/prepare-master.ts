import { parseLabModelJson } from '../../resources/model-paths.ts';
/** Lab-only high-resolution optical master, followed by smaller prepared CSS banks. */
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { DensityVolumeFrame } from '@cssearth/objects';
import { convertParticlesToDensityVolume } from '../../server/workflows/stars/particles.ts';
import { extractExtendedSource, type ExtractionOptions, type NativeExtractionReceipt } from '@cssearth/nebula-reconstruction/star-removal/extraction';
import { createPhotoMasterEmissionSampler } from '@cssearth/nebula-reconstruction/methods/density-prior/photo-master';
import { bakeMasterVolumeSlices, deriveMasterVolumeSlices } from '@cssearth/bake/volume/node';
import { type VolumeSlices } from '@cssearth/objects';
import { compileCssVolume } from '../../adapters/preparation/css-volume.ts';
import type { VolumeRecipe } from '@cssearth/objects';

type Vec3 = [number, number, number];
interface MasterExperiment {
  schema: 'cssearth-photo-master-experiment@1';
  base: { path: string; targetId: string };
  photo: { path: string; width: number; height: number; url: string;
    publisherUrl: string; license: string; credit: string };
  extraction: Pick<ExtractionOptions, 'maxPixels' | 'medianSize' | 'outputMode'>;
  master: { width: number; sliceCounts: { x: number; y: number; z: number }; samplesPerSlab: number };
  delivery: { id: string; width: number; directory: string; quality: number }[];
  limitations: string[];
}
async function present(path: string) {
  await access(path).catch(() => { throw new Error(`Missing input: ${path}. Run the reference acquisition and particle preparation first.`); });
}
const json = async (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2) + '\n');

export async function preparePhotoMaster(recipePath: string) {
  const recipe: MasterExperiment = parseLabModelJson(await readFile(recipePath, 'utf8'));
  if (recipe.schema !== 'cssearth-photo-master-experiment@1') throw new TypeError('Unsupported photo-master experiment.');
  if (recipe.extraction.maxPixels !== null) throw new TypeError('Photo masters require native-resolution extraction.');
  await present(recipe.base.path);
  await present(recipe.photo.path);
  const base = parseLabModelJson(await readFile(recipe.base.path, 'utf8'));
  const target = base.targets.find((item: { id: string }) => item.id === recipe.base.targetId);
  if (!target?.photoEmission) throw new TypeError('A photo-constrained particle target is required.');
  const imported = parseLabModelJson(await readFile(resolve(target.directory, 'source/import.json'), 'utf8'));
  if (imported.source.bytes === undefined || imported.source.header?.starCount !== base.source.starCount ||
      JSON.stringify(imported.displayRotation) !== JSON.stringify(target.rotation) ||
      imported.selection.start !== target.starRange.start || imported.selection.count !== target.starRange.count) {
    throw new TypeError('The prepared particle receipt differs from the pinned model. Rebuild the particle target.');
  }
  await present(imported.rotatedOutput.path);
  const descriptor = parseLabModelJson(await readFile(resolve(target.directory, 'object.json'), 'utf8'));
  const frame: DensityVolumeFrame = descriptor.properties.volume;
  const compilerRecipe: VolumeRecipe = parseLabModelJson(await readFile(resolve(target.directory, 'source/volume.json'), 'utf8'));
  const masterInputs = { base: recipe.base, photo: recipe.photo,
    extraction: recipe.extraction, master: recipe.master, particles: imported.rotatedOutput.path };
  // One master per particle target; it is reused only while the saved inputs are the same.
  const masterKey = recipe.base.targetId;
  const cache = resolve('.local/nebula-lab/highres', masterKey);
  const masterDirectory = resolve(cache, 'masters');
  await mkdir(cache, { recursive: true });
  const deliveryBanks = recipe.delivery.map(bank => ({ width: bank.width,
    outputDirectory: resolve(bank.directory, 'prepared'), imageEncoding: { format: 'webp' as const, quality: bank.quality } }));
  let masters: VolumeSlices;
  let banks: { width: number; slices: VolumeSlices }[];
  const savedInputs = await readFile(resolve(cache, 'inputs.json'), 'utf8').catch(() => null);
  const existing = savedInputs !== null && JSON.stringify(JSON.parse(savedInputs)) === JSON.stringify(masterInputs)
    ? await readFile(resolve(masterDirectory, 'volume-slices.json'), 'utf8').catch(() => null) : null;
  if (existing) {
    console.log(`PHOTO_MASTER_REUSE ${masterKey}: deriving delivery from verified lossless slices`);
    masters = parseLabModelJson(existing);
    banks = await deriveMasterVolumeSlices({ masters, masterDirectory, deliveryBanks });
  } else {
    console.log(`PHOTO_MASTER_EXTRACT ${recipe.photo.width}×${recipe.photo.height} native source`);
    const extractionDirectory = resolve(cache, 'extraction');
    const extraction = await extractExtendedSource({ inputPath: recipe.photo.path,
      outputDirectory: extractionDirectory, id: 'photo', ...recipe.extraction });
    if (extraction.width !== recipe.photo.width || extraction.height !== recipe.photo.height) {
      throw new TypeError('The master extraction must retain the pinned native image dimensions.');
    }
    const diffusePath = resolve(extractionDirectory, extraction.outputs.diffuse);
    const densityOutputPath = resolve(cache, 'density.f32');
    console.log(`PHOTO_MASTER_DENSITY ${target.dimensions.join('×')}: depth only, no photo resampling`);
    const densityReceipt = await convertParticlesToDensityVolume({
      particlePath: imported.rotatedOutput.path, outputDirectory: resolve(cache, 'density'),
      densityOutputPath, dimensions: target.dimensions, boundsKpc: target.boundsKpc,
      smoothingSigmaVoxels: target.smoothingSigmaVoxels, normalizationQuantile: target.normalizationQuantile,
      encoding: 'sqrt-density-unorm8',
    });
    const densityBytes = await readFile(densityOutputPath);
    if (!densityReceipt.densityField || densityReceipt.densityField.bytes !== densityBytes.length) {
      throw new TypeError(`The exported depth field ${densityOutputPath} does not match its receipt.`);
    }
    densityReceipt.densityField.path = relative(process.cwd(), densityOutputPath);
    const density = new Float32Array(densityBytes.length / 4);
    for (let i = 0; i < density.length; i++) density[i] = densityBytes.readFloatLE(4 * i);
    console.log('PHOTO_MASTER_FIELD native photo + conditional stellar depth');
    const sampler = await createPhotoMasterEmissionSampler({ density, dimensions: target.dimensions,
      boundsKpc: target.boundsKpc, photo: { bytes: await readFile(diffusePath) },
      projection: { centerKpc: target.colorCenterKpc.slice(0, 2), spanKpc: target.colorSpanKpc },
      ...target.photoEmission, exposureGain: target.exposureGain, onProgress: console.log });
    const { processing: _processing, ...stableExtraction } = extraction as NativeExtractionReceipt;
    const provenance = { schema: 'cssearth-photo-master-provenance@1',
      masterInputs, source: base.source, photo: recipe.photo,
      particles: imported.rotatedOutput, density: densityReceipt,
      extraction: { ...stableExtraction, diffuse: relative(process.cwd(), diffusePath) },
      display: { alignment: target.alignment, rotation: target.rotation,
        boundsKpc: target.boundsKpc, photoCenterKpc: target.colorCenterKpc, photoSpanKpc: target.colorSpanKpc,
        emission: target.photoEmission, diagnostics: sampler.diagnostics },
      resolution: { original: [recipe.photo.width, recipe.photo.height], masterWidth: recipe.master.width,
        depthGrid: target.dimensions, photoColorStoredInDepthGrid: false },
      limitations: recipe.limitations };
    const baked = await bakeMasterVolumeSlices({ sampleEmission: sampler.sample,
      boundsKpc: target.boundsKpc as { min: Vec3; max: Vec3 }, sliceCounts: recipe.master.sliceCounts,
      samplesPerSlab: recipe.master.samplesPerSlab, exposureGain: target.exposureGain,
      masterWidth: recipe.master.width, masterDirectory, deliveryBanks,
      unitsPerSourceUnit: 1, provenance });
    masters = baked.masters; banks = baked.banks;
    await json(resolve(cache, 'inputs.json'), masterInputs);
  }
  for (const bank of recipe.delivery) {
    const slices = banks.find(item => item.width === bank.width)?.slices;
    if (!slices) throw new Error(`Missing derived bank ${bank.width}.`);
    slices.provenance = { master: slices.provenance,
      deliveryRecipe: { path: recipePath, selectedDelivery: bank } };
    const directory = resolve(bank.directory), sourceDirectory = resolve(directory, 'source');
    await mkdir(sourceDirectory, { recursive: true });
    const modelRecipe = { ...recipe, selectedDelivery: bank,
      master: { ...recipe.master, cacheKey: masterKey,
        manifest: relative(process.cwd(), resolve(masterDirectory, 'volume-slices.json')) } };
    await json(resolve(sourceDirectory, 'master.json'), modelRecipe);
    await json(resolve(sourceDirectory, 'provenance.json'), slices.provenance);
    await json(resolve(directory, 'prepared/volume-slices.json'), slices);
    const data = compileCssVolume({ id: bank.id, frame, slices, recipe: compilerRecipe });
    const prepared = { schema: 'cssearth-prepared-object@1', id: bank.id, type: 'density-volume',
      format: 'cssearth-density-volume@1', data };
    const bytes = Buffer.from(JSON.stringify(prepared) + '\n');
    await writeFile(resolve(directory, 'prepared/volume.json'), bytes);
    await json(resolve(directory, 'object.json'), { schema: 'cssearth-object@2', id: bank.id,
      type: 'density-volume', properties: { volume: frame,
        preparation: { source: 'source/master.json' } },
      prepared: { format: prepared.format, url: 'prepared/volume.json' } });
    console.log(`PHOTO_MASTER_PREPARED ${bank.id}: ${data.resources.length} leaves, ` +
      `${(data.resources.reduce((sum, resource) => sum + resource.bytes, 0) / 1e6).toFixed(2)} MB, ` +
      `${(data.resources.reduce((sum, resource) => sum + resource.width * resource.height * 4, 0) / 1e6).toFixed(1)} MB decoded`);
  }
  await json(resolve(cache, 'complete.json'), { recipe: relative(process.cwd(), recipePath),
    masterKey, masterQuads: masters.quads.length, banks: recipe.delivery });
  console.log('PHOTO_MASTER_COMPLETE');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [recipe, extra] = process.argv.slice(2);
  if (!recipe || extra) throw new TypeError('Usage: prepare-master <recipe.json>');
  await preparePhotoMaster(recipe);
}
