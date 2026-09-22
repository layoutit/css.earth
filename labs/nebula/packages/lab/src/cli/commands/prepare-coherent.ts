import { implementationPins } from '@cssearth/nebula-lab/server/implementation';
import { parseLabModelJson } from '../../resources/model-paths.ts';
/** Generic lab-only experiment: frozen image + automatic supports → finite 3D → prepared PolyCSS. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import type { DensityVolumeFrame } from '@cssearth/objects';
import { digest, readBenchmarkImage } from '@cssearth/nebula-reconstruction/methods/getsf/benchmark-products';
import { decomposeStructures, type WaveletSettings } from '@cssearth/nebula-reconstruction/evidence/wavelets';
import { createCoherentVolumeSampler, type CoarseStellarDensityPrior } from '@cssearth/nebula-reconstruction/methods/density-prior/coherent-volume';
import { validateCoherentColumns, validateCoherentAxisSampling } from '@cssearth/nebula-reconstruction/methods/density-prior/coherent-validation';
import { bakeMasterVolumeSlices, deriveMasterVolumeSlices } from '@cssearth/volume-bake/slices/emission';
import { compileCssVolume } from '../../adapters/preparation/css-volume.ts';
import type { VolumeSlices } from '@cssearth/volume-bake/slices/density';

type Vec3 = [number, number, number];
interface Variant {
  id: string; name: string; directory: string; useCatalog: boolean; useDensityPrior: boolean;
  baseFraction: number; baseHalfThickness: number; structureHalfThickness: number;
  scaleThicknessFactor: number; maxDepthVariation: number;
}
interface Recipe {
  schema: 'cssearth-coherent-experiment@1'; id: string;
  benchmark: { path: string; sha256: string };
  /** Lengths below are fractions of projected image width, shared across cases. */
  projectedWidthKpc: number; projectedScaleNote: string; depthExtentWidths: number;
  densityPrior?: { path: string; sha256: string; dimensions: Vec3; boundsKpc: { min: Vec3; max: Vec3 }; note: string };
  master: { width: number; sliceCounts: { x: number; y: number; z: number }; samplesPerSlab: number };
  delivery: { width: number; quality: number };
  exposureGain: number; maxDisplaySignal: number; variants: Variant[]; limitations: string[];
}
const json = (path: string, value: unknown) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
async function pinned(path: string, pin: string) {
  const bytes = await readFile(path);
  if (digest(bytes) !== pin) throw new Error(`Pinned input differs: ${path}`);
  return bytes;
}

const [recipePath, selectedVariant, extra] = process.argv.slice(2);
if (!recipePath || extra) throw new TypeError('Usage: prepare-coherent <recipe.json> [variant-id]');
const recipeBytes = await readFile(recipePath), recipe: Recipe = parseLabModelJson(recipeBytes.toString());
if (recipe.schema !== 'cssearth-coherent-experiment@1' || !(recipe.projectedWidthKpc > 0) ||
    !Number.isFinite(recipe.projectedWidthKpc) || !(recipe.depthExtentWidths > 0) || !Number.isFinite(recipe.depthExtentWidths))
  throw new TypeError('Unsupported coherent experiment or invalid physical extent.');
const selected = recipe.variants.filter(variant => !selectedVariant || variant.id === selectedVariant);
if (!selected.length) throw new TypeError('No matching coherent variant.');
const benchmark = parseLabModelJson((await pinned(recipe.benchmark.path, recipe.benchmark.sha256)).toString()) as {
  input: { path: string; sha256: string; width: number; height: number }; wavelets: WaveletSettings;
};
const photo = await readBenchmarkImage(benchmark.input.path, benchmark.input.sha256, benchmark.input.width, benchmark.input.height);
const rgba = new Uint8Array(photo.width * photo.height * 4);
for (let p = 0; p < photo.width * photo.height; p++) {
  rgba[4 * p] = photo.rgb[3 * p]!; rgba[4 * p + 1] = photo.rgb[3 * p + 1]!;
  rgba[4 * p + 2] = photo.rgb[3 * p + 2]!; rgba[4 * p + 3] = 255;
}
const analysis = decomposeStructures(photo.luminance, photo.width, photo.height, benchmark.wavelets);
const span = recipe.projectedWidthKpc, aspect = photo.height / photo.width;
const half: Vec3 = [span / 2, span * aspect / 2, span * recipe.depthExtentWidths / 2];
const bounds = { min: half.map(value => -value) as Vec3, max: half };
let densityPrior: CoarseStellarDensityPrior | undefined;
if (recipe.densityPrior) {
  const raw = gunzipSync(await pinned(recipe.densityPrior.path, recipe.densityPrior.sha256));
  const count = recipe.densityPrior.dimensions.reduce((a, b) => a * b, 1);
  if (raw.length !== count * 4) throw new Error('Pinned density-prior dimensions differ.');
  const density = new Float32Array(count);
  for (let p = 0; p < count; p++) density[p] = raw.readFloatLE(4 * p);
  densityPrior = { density, dimensions: recipe.densityPrior.dimensions, boundsKpc: recipe.densityPrior.boundsKpc };
}
const codePins = Object.fromEntries((await implementationPins(process.cwd(), ['labs/nebula/packages/lab/src/cli/commands/prepare-coherent.ts'])).map(pin => [pin.path, pin.sha256]));
codePins['css-volume-compiler'] = digest(await readFile('src/renderers/css/preparation/volume.ts'));
const frame: DensityVolumeFrame = {
  referenceFrame: 'sun-icrf', epochJdTt: 2451545, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1],
  metersPerUnit: span * 3.085677581491367e19,
  boundsUnits: { min: bounds.min.map(value => value / span) as Vec3, max: bounds.max.map(value => value / span) as Vec3 },
};
for (const variant of selected) {
  if (variant.useDensityPrior && !densityPrior) throw new Error(`No density prior supplied for ${variant.id}.`);
  const sampler = createCoherentVolumeSampler({ target: { width: photo.width, height: photo.height, rgba }, boundsKpc: bounds,
    catalog: variant.useCatalog ? analysis.catalog : [], ...(variant.useDensityPrior ? { densityPrior } : {}),
    baseFraction: variant.baseFraction, baseHalfThicknessKpc: variant.baseHalfThickness * span,
    structureHalfThicknessKpc: variant.structureHalfThickness * span, scaleThicknessFactor: variant.scaleThicknessFactor,
    maxDepthVariationKpc: variant.maxDepthVariation * span,
    exposureGain: recipe.exposureGain, maxDisplaySignal: recipe.maxDisplaySignal });
  const columns = validateCoherentColumns({ sampler, rgba, width: photo.width, height: photo.height, bounds,
    samples: recipe.master.sliceCounts.z * recipe.master.samplesPerSlab,
    exposureGain: recipe.exposureGain, maxDisplaySignal: recipe.maxDisplaySignal });
  const axisSampling = validateCoherentAxisSampling({ sampler, bounds, exposureGain: recipe.exposureGain,
    samples: { x: recipe.master.sliceCounts.x * recipe.master.samplesPerSlab,
      y: recipe.master.sliceCounts.y * recipe.master.samplesPerSlab, z: recipe.master.sliceCounts.z * recipe.master.samplesPerSlab } });
  const validation = { columns, axisSampling };
  console.log(`COHERENT_FIELD_READY ${variant.id}: ${analysis.catalog.length} scale regions, ` +
    `${(sampler.diagnostics.assignmentCoverage.fraction * 100).toFixed(2)}% supported pixels; source-column gate passed`);
  const provenance = { schema: 'cssearth-coherent-experiment-result@1', recipePath, recipeSha256: digest(recipeBytes),
    variant, input: benchmark.input, benchmark: recipe.benchmark, settings: benchmark.wavelets, codePins,
    target: 'Entire frozen display photograph, including unresolved stars. No point-source subtraction or gas-membership claim.',
    model: { projectedWidthKpc: span, projectedScaleNote: recipe.projectedScaleNote,
      localFrame: 'Isolated crop centred on its image; identity orientation and zero origin are lab framing, not a celestial placement.',
      densityPrior: variant.useDensityPrior ? recipe.densityPrior : null,
      diagnostics: sampler.diagnostics }, validation, limitations: recipe.limitations };
  const cacheKey = digest(JSON.stringify({ provenance, master: recipe.master, exposure: recipe.exposureGain })).slice(0, 16);
  const masterDirectory = resolve('.local/nebula-lab/coherent', cacheKey, 'masters');
  const deliveryBanks = [{ width: recipe.delivery.width, outputDirectory: resolve(variant.directory, 'prepared'),
    imageEncoding: { format: 'webp' as const, quality: recipe.delivery.quality } }];
  const existing = await readFile(resolve(masterDirectory, 'volume-slices.json'), 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
    return null;
  });
  let slices: VolumeSlices;
  if (existing) {
    console.log(`COHERENT_MASTER_REUSE ${variant.id} ${cacheKey}`);
    slices = (await deriveMasterVolumeSlices({ masters: parseLabModelJson(existing), masterDirectory, deliveryBanks }))[0]!.slices;
  } else {
    const baked = await bakeMasterVolumeSlices({ sampleEmission: sampler.sample, boundsKpc: bounds,
      ...recipe.master, masterWidth: recipe.master.width, masterDirectory, deliveryBanks,
      exposureGain: recipe.exposureGain, unitsPerSourceUnit: 1 / span, provenance });
    slices = baked.banks[0]!.slices;
  }
  const data = compileCssVolume({ id: variant.id, frame, slices, recipe: { anchors: [] } });
  const prepared = { schema: 'cssearth-prepared-object@1', id: variant.id, type: 'density-volume',
    format: 'cssearth-density-volume@1', data };
  const bytes = Buffer.from(`${JSON.stringify(prepared)}\n`);
  const sourceDirectory = resolve(variant.directory, 'source');
  await mkdir(sourceDirectory, { recursive: true });
  await json(resolve(sourceDirectory, 'experiment.json'), { recipe, selectedVariant: variant.id, cacheKey });
  await json(resolve(sourceDirectory, 'provenance.json'), provenance);
  await json(resolve(sourceDirectory, 'validation.json'), validation);
  await writeFile(resolve(variant.directory, 'prepared/volume.json'), bytes);
  await json(resolve(variant.directory, 'object.json'), { schema: 'cssearth-object@1', id: variant.id, type: 'density-volume',
    properties: { volume: frame, preparation: { source: 'source/experiment.json',
      sha256: digest(await readFile(resolve(sourceDirectory, 'experiment.json'))) } },
    prepared: { format: prepared.format, url: 'prepared/volume.json' } });
  console.log(`COHERENT_PREPARED ${variant.id}: ${data.resources.length} images, ` +
    `${(data.resources.reduce((sum, item) => sum + item.bytes, 0) / 1e6).toFixed(2)} MB, ` +
    `${(data.resources.reduce((sum, item) => sum + item.width * item.height * 4, 0) / 1e6).toFixed(1)} MB decoded`);
}
console.log('COHERENT_EXPERIMENT_COMPLETE');
