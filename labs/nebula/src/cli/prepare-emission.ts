/** Offline planetary-nebula experiment; never runs from a browser mount. */
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import sharp from 'sharp';
import type { DensityVolumeFrame } from '@cssearth/objects';
import { parseDensityVolumeObjectDescriptor } from '@cssearth/objects';
import { inferEmission, projectEmission, type InferenceGrid, type SymmetryPrior } from '../reconstruction/emission-inference/solver.js';
import { bakeMasterVolumeSlices } from '../reconstruction/master-slices.js';
import { compileCssVolume } from '../../../../src/renderers/css/preparation/volume.js';
import { validatePreparedCssVolume } from '../../../../src/renderers/css/volume/validation.js';
import { geometricDepth, conditionEmission, type ShapePrior } from '../reconstruction/emission-inference/shape-prior.js';
import { nativeStarless, type NativeRemoval } from '../reconstruction/emission-inference/native-source.js';

interface Recipe {
  schema: 'cssearth-emission-inference@1'; id: string;
  source: { url: string; sha256: string; width: number; height: number; publisher: string; credit: string };
  crop: { left: number; top: number; width: number; height: number };
  pointMasks: { x: number; y: number; radius: number }[];
  grid: InferenceGrid; prior: SymmetryPrior; tau: number; iterations: number;
  blackLevel: number; displayExposure: number; slices: number; assumptions: string[];
  nativeRemoval?: NativeRemoval;
  shapePrior?: ShapePrior;
  modelReference?: { paper: string };
}
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const json = async (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
const recipePath = process.argv[2];
if (!recipePath || process.argv.length !== 3) throw new TypeError('Usage: prepare-emission <recipe.json>');
const recipeBytes = await readFile(recipePath), recipe = JSON.parse(recipeBytes.toString()) as Recipe;
if (recipe.schema !== 'cssearth-emission-inference@1' || !/^[a-z0-9-]+$/.test(recipe.id) ||
    !/^[a-f0-9]{64}$/.test(recipe.source.sha256) || !/^https:\/\//.test(recipe.source.url) ||
    !Number.isFinite(recipe.blackLevel) || recipe.blackLevel < 0 || recipe.blackLevel >= 1)
  throw new TypeError('Invalid emission recipe.');
const cache = resolve('.local/nebula-lab/planetary'), sourcePath = resolve(cache, `${recipe.source.sha256}.jpg`);
await mkdir(cache, { recursive: true });
let source: Buffer;
try { source = await readFile(sourcePath); }
catch {
  const response = await fetch(recipe.source.url);
  if (!response.ok) throw new Error(`Source download failed: ${response.status}`);
  source = Buffer.from(await response.arrayBuffer());
  if (hash(source) !== recipe.source.sha256) throw new Error('Downloaded source hash differs from recipe.');
  await writeFile(sourcePath, source);
}
if (hash(source) !== recipe.source.sha256) throw new Error('Cached source hash differs from recipe.');
const native = await sharp(source).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
if (native.info.width !== recipe.source.width || native.info.height !== recipe.source.height || native.info.channels !== 3)
  throw new Error('Source dimensions differ from recipe.');
const removed = recipe.nativeRemoval ? await nativeStarless(source, [recipe.source.width, recipe.source.height], recipe.nativeRemoval) : undefined;
const diffuse = Buffer.from(removed?.pixels ?? native.data);
if (recipe.nativeRemoval && recipe.pointMasks.length) throw new TypeError('Do not remove point sources again after native NOX separation.');
// Explicitly recorded point masks, bounded by nearby light. Not a detector or a
// replacement for NOX: this baseline preserves bright extended nebular knots.
for (const mask of recipe.pointMasks) {
  const samples: number[][] = [[], [], []];
  for (let y = 0; y < native.info.height; y++) for (let x = 0; x < native.info.width; x++) {
    const distance = Math.hypot(x - mask.x, y - mask.y);
    if (distance < mask.radius * 1.5 || distance > mask.radius * 2) continue;
    for (let c = 0; c < 3; c++) samples[c]!.push(native.data[(y * native.info.width + x) * 3 + c]!);
  }
  if (samples.some(values => !values.length)) throw new Error('A point mask has no background annulus.');
  const background = samples.map(values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]!);
  for (let y = 0; y < native.info.height; y++) for (let x = 0; x < native.info.width; x++) {
    const distance = Math.hypot(x - mask.x, y - mask.y);
    if (distance >= mask.radius) continue;
    const weight = Math.min(1, (mask.radius - distance) / Math.max(1, mask.radius * .25));
    for (let c = 0; c < 3; c++) {
      const i = (y * native.info.width + x) * 3 + c;
      diffuse[i] = Math.round(diffuse[i]! + weight * (Math.min(diffuse[i]!, background[c]!) - diffuse[i]!));
    }
  }
}
const { grid } = recipe, pixels = grid.width * grid.height;
const resized = await sharp(diffuse, { raw: native.info }).extract(recipe.crop)
  .resize(grid.width, grid.height, { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer();
const input = Array.from({ length: 3 }, (_, c) => Float32Array.from({ length: pixels }, (_, p) =>
  Math.max(0, (resized[p * 3 + c]! / 255 - recipe.blackLevel) / (1 - recipe.blackLevel))));
const start = performance.now();
const depthPrior = recipe.shapePrior ? geometricDepth(grid, recipe.prior.center, recipe.shapePrior) : null;
const results = input.map((image, channel) => depthPrior ? conditionEmission(image, depthPrior, grid) : inferEmission({ grid, image, prior: recipe.prior,
  tau: recipe.tau, iterations: recipe.iterations, onIteration(report) {
    if (report.iteration % 20 === 0) console.log(`EMISSION_FIT RGB${channel + 1} ${report.iteration}/${recipe.iterations} error=${report.relativeProjectionError.toFixed(4)}`);
  } }));
const solverSeconds = (performance.now() - start) / 1000;
const directory = resolve(cache, recipe.id), staging = resolve(cache, `${recipe.id}-staging-${process.pid}`);
await mkdir(staging, { recursive: true });
const projected = results.map(result => projectEmission(result.volume, grid));
async function raster(name: string, channels: Float32Array[], gain = 1) {
  const bytes = Buffer.alloc(pixels * 3);
  for (let p = 0; p < pixels; p++) for (let c = 0; c < 3; c++)
    bytes[p * 3 + c] = Math.round(Math.max(0, Math.min(1, channels[c]![p]! * gain)) * 255);
  await sharp(bytes, { raw: { width: grid.width, height: grid.height, channels: 3 } }).png().toFile(resolve(staging, name));
}
await raster('input.png', input); await raster('projection.png', projected);
await raster('residual.png', input.map((channel, c) => channel.map((v, p) => Math.abs(v - projected[c]![p]!))), 4);
await sharp(source).extract(recipe.crop).png().toFile(resolve(staging, 'original.png'));
await sharp(diffuse, { raw: native.info }).extract(recipe.crop).png().toFile(resolve(staging, 'without-points.png'));
// Dimensionless display coordinates. The generic baker integrates any consistent
// unit; its historical boundsKpc name does not confer physical scale on this fit.
const voxelSize = 10 / grid.width;
const bounds = { min: [-grid.width * voxelSize / 2, -grid.height * voxelSize / 2, -grid.depth * voxelSize / 2] as [number, number, number],
  max: [grid.width * voxelSize / 2, grid.height * voxelSize / 2, grid.depth * voxelSize / 2] as [number, number, number] };
const provenance = { method: depthPrior ? 'Image-conditioned emission in an authored geometric prior; no image-only depth inference' : 'Wenger, Lorenz & Magnor 2013, equations 1–7; independent TypeScript implementation',
  doi: depthPrior ? recipe.modelReference?.paper : 'https://doi.org/10.1111/cgf.12216', recipePath, recipeSha256: hash(recipeBytes), recipe,
  implementation: await Promise.all(['labs/nebula/src/reconstruction/emission-inference/solver.ts',
    'labs/nebula/src/cli/prepare-emission.ts', 'labs/nebula/src/reconstruction/master-slices.ts',
    'src/renderers/css/preparation/volume.ts', 'labs/nebula/src/reconstruction/emission-inference/shape-prior.ts',
    'labs/nebula/src/reconstruction/emission-inference/native-source.ts'].map(async path => ({ path, sha256: hash(await readFile(path)) }))),
  nativeRemoval: removed?.provenance,
  ...(depthPrior ? { uncoveredSignalFractions: results.map(result => 'uncoveredSignalFraction' in result ? result.uncoveredSignalFraction : 0),
    projectionCaveat: 'Agreement on supported rays is imposed by normalization and does not validate depth geometry.' } : {}),
  coordinateMeaning: 'Image x right, y up in display; dimensionless units. No measured gas density, scale, distance or sky registration.',
  reports: results.map(result => result.report) };
const preparedDirectory = resolve(staging, 'prepared');
const baked = await bakeMasterVolumeSlices({ boundsKpc: bounds,
  sliceCounts: { x: recipe.slices, y: recipe.slices, z: recipe.slices }, samplesPerSlab: 4,
  masterWidth: 192, masterDirectory: preparedDirectory, deliveryBanks: [],
  exposureGain: recipe.displayExposure, unitsPerSourceUnit: 1, provenance,
  sampleEmission(x, y, z, out) {
    const gx = (x - bounds.min[0]) / voxelSize - .5;
    const gy = (bounds.max[1] - y) / voxelSize - .5;
    const gz = (z - bounds.min[2]) / voxelSize - .5;
    out.fill(0);
    const ix = Math.floor(gx), iy = Math.floor(gy), iz = Math.floor(gz);
    for (let dz = 0; dz <= 1; dz++) for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) {
      const xx = ix + dx, yy = iy + dy, zz = iz + dz;
      if (xx < 0 || xx >= grid.width || yy < 0 || yy >= grid.height || zz < 0 || zz >= grid.depth) continue;
      const weight = (dx ? gx - ix : 1 - gx + ix) * (dy ? gy - iy : 1 - gy + iy) * (dz ? gz - iz : 1 - gz + iz);
      const index = (zz * grid.height + yy) * grid.width + xx;
      for (let c = 0; c < 3; c++) out[c]! += results[c]!.volume[index]! * weight / (voxelSize * Math.sqrt(grid.depth));
    }
  } });
const frame: DensityVolumeFrame = { referenceFrame: 'lab-image-relative-unscaled', epochJdTt: 2451545,
  originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1, boundsUnits: bounds };
const data = compileCssVolume({ id: recipe.id, frame, slices: baked.masters, recipe: { anchors: [] } });
validatePreparedCssVolume(data);
const preparedBytes = Buffer.from(JSON.stringify({ schema: 'cssearth-prepared-object@1', id: recipe.id,
  type: 'density-volume', format: 'cssearth-density-volume@1', data }) + '\n');
await writeFile(resolve(preparedDirectory, 'volume.json'), preparedBytes);
await writeFile(resolve(staging, 'experiment.json'), recipeBytes);
const descriptor = { schema: 'cssearth-object@1', id: recipe.id, type: 'density-volume',
  properties: { volume: frame, preparation: { source: 'experiment.json', sha256: hash(recipeBytes) } },
  prepared: { format: 'cssearth-density-volume@1', url: 'prepared/volume.json', sha256: hash(preparedBytes) } };
parseDensityVolumeObjectDescriptor(descriptor);
await json(resolve(staging, 'object.json'), descriptor);
for (let c = 0; c < 3; c++) {
  const volume = results[c]!.volume, bytes = Buffer.alloc(volume.length * 4);
  for (let i = 0; i < volume.length; i++) bytes.writeFloatLE(volume[i]!, i * 4);
  await writeFile(resolve(staging, `emission-${c}.f32`), bytes);
}
await json(resolve(staging, 'result.json'), { ...provenance, solverSeconds, totalSeconds: (performance.now() - start) / 1000,
  resources: data.resources.length, outputBytes: data.resources.reduce((sum, item) => sum + item.bytes, 0) });
try { await rename(directory, `${directory}-previous-${Date.now()}`); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
await rename(staging, directory);
console.log(`EMISSION_COMPLETE ${directory}; fit=${solverSeconds.toFixed(2)}s; ${data.resources.length} prepared PolyCSS leaves`);
