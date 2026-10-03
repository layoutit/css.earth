import {applyIsophoteMasks,applyRecordedPointMasks,emissionInputChannels,emissionRasterPixels,createInferredEmissionSampler} from '@cssearth/nebula-reconstruction/methods/symmetry/processing';
/** Offline planetary-nebula experiment; never runs from a browser mount. */
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { OBJECT_SCHEMA, PREPARED_OBJECT_SCHEMA, DENSITY_VOLUME_FORMAT, type DensityVolumeFrame, parseDensityVolumeObjectDescriptor, validatePreparedCssVolume } from '@cssearth/objects';

import { inferEmission, projectEmission, type InferenceGrid, type SymmetryPrior } from '@cssearth/nebula-reconstruction/methods/symmetry/solver';
import { bakeMasterVolumeSlices } from '@cssearth/bake/volume/node';
import { compileCssVolume } from '../../adapters/preparation/css-volume.ts';

import { geometricDepth, conditionEmission, type ShapePrior } from '@cssearth/nebula-reconstruction/methods/symmetry/shape-prior';
import { nativeStarless, type NativeRemoval } from '../../server/workflows/emission-inference/native-source.ts';

interface Recipe {
  schema: 'cssearth-emission-inference@1'; id: string;
  source: { url: string; width: number; height: number; publisher: string; credit: string };
  crop: { left: number; top: number; width: number; height: number };
  pointMasks: { x: number; y: number; radius: number }[];
  /** Catalogued neighbouring galaxies, masked after NOX: NOX removes stars, not galaxies, and an axisymmetric fit would
   * turn each into a ring about the axis. Positions and sizes come from a catalogue the recipe names. */
  neighbourMasks?: { source: string; masks: { name: string; x: number; y: number; radius: number }[];
    /** For neighbours inside the galaxy's own light: fill each mask with the median light of its isophote (the shape
     * prior's Sérsic spheroid) instead of the light around it, which is fainter than the galaxy there and would leave a hole. */
    fill?: 'isophote' };
  /** Each pixel clamped to the median of the square window around it: compact light smaller than the window (star
   * haloes, small background galaxies) drops out and the smooth light stays. Only for a window above the fit's cell. */
  compactClamp?: { windowPx: number; basis: string;
    /** Also raise a pixel darker than its window's median to that median: a survey's saturation bleed trails and the
     * holes it leaves at bright stars are darker than the galaxy around them, and a clamp that only lowers keeps them. */
    fillDark?: boolean };
  grid: InferenceGrid; prior: SymmetryPrior; tau: number; iterations: number;
  /** One level, or one per channel (red, green, blue) for a composite whose sky is not grey. */
  blackLevel: number | [number, number, number]; displayExposure: number; slices: number; assumptions: string[];
  nativeRemoval?: NativeRemoval;
  shapePrior?: ShapePrior;
  modelReference?: { paper: string };
}
const json = async (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
const recipePath = process.argv[2];
if (!recipePath || process.argv.length !== 3) throw new TypeError('Usage: prepare-emission <recipe.json>');
const recipeText = await readFile(recipePath, 'utf8'), rawRecipe: unknown = JSON.parse(recipeText);
const recipe = rawRecipe as Recipe;
if (recipe.schema !== 'cssearth-emission-inference@1' || !/^[a-z0-9-]+$/.test(recipe.id) ||
    !/^https:\/\//.test(recipe.source.url) ||
    (Array.isArray(recipe.blackLevel) ? recipe.blackLevel.length !== 3 ? [NaN] : recipe.blackLevel : [recipe.blackLevel]).some(level => !Number.isFinite(level) || level < 0 || level >= 1))
  throw new TypeError('Invalid emission recipe.');
const cache = resolve('.local/nebula-lab/planetary'), sourcePath = resolve(cache, `${recipe.id}-original.jpg`);
await mkdir(cache, { recursive: true });
let source: Buffer;
try { source = await readFile(sourcePath); }
catch {
  const response = await fetch(recipe.source.url);
  if (!response.ok) throw new Error(`Source download failed: ${response.status}`);
  source = Buffer.from(await response.arrayBuffer());
  await writeFile(sourcePath, source);
}
const native = await sharp(source).removeAlpha().toColorspace('srgb').raw().toBuffer({ resolveWithObject: true });
if (native.info.width !== recipe.source.width || native.info.height !== recipe.source.height || native.info.channels !== 3)
  throw new Error('Source dimensions differ from recipe.');
const removed = recipe.nativeRemoval ? await nativeStarless(source, [recipe.source.width, recipe.source.height], recipe.nativeRemoval) : undefined;
const diffuse = Buffer.from(removed?.pixels ?? native.data);
if (recipe.nativeRemoval && recipe.pointMasks.length) throw new TypeError('Do not remove point sources again after native NOX separation.');
applyRecordedPointMasks(diffuse,native.data,native.info.width,native.info.height,recipe.pointMasks);
if (recipe.neighbourMasks?.fill === 'isophote') {
  const spheroid = recipe.shapePrior?.components.length === 1 && recipe.shapePrior.components[0]!.kind === 'sersic' ? recipe.shapePrior.components[0]! : undefined;
  if (!spheroid || spheroid.axis[2] !== 0 || !Number.isFinite(spheroid.axisRatio)) throw new TypeError('Isophote-filled masks need one Sérsic spheroid whose axis lies in the plane of the sky.');
  // The spheroid's centre in the grid, as a pixel of the source image.
  const pixel = (cell: number, cells: number, start: number, size: number) => start + (cell + .5) * size / cells - .5;
  applyIsophoteMasks(diffuse,native.info.width,native.info.height,recipe.neighbourMasks.masks,{
    centre: [pixel(recipe.prior.center[0]!, recipe.grid.width, recipe.crop.left, recipe.crop.width), pixel(recipe.prior.center[1]!, recipe.grid.height, recipe.crop.top, recipe.crop.height)],
    minorAxis: [spheroid.axis[0], spheroid.axis[1]], axisRatio: spheroid.axisRatio! });
}
else if (recipe.neighbourMasks) applyRecordedPointMasks(diffuse,diffuse,native.info.width,native.info.height,recipe.neighbourMasks.masks);
if (recipe.compactClamp) {
  const window = recipe.compactClamp.windowPx;
  if (!Number.isInteger(window) || window < 3 || window % 2 === 0) throw new TypeError(`compactClamp.windowPx must be an odd integer of at least 3, not ${window}.`);
  const median = await sharp(diffuse, { raw: native.info }).median(window).raw().toBuffer();
  const fillDark = recipe.compactClamp.fillDark === true;
  for (let i = 0; i < diffuse.length; i++) if (fillDark || median[i]! < diffuse[i]!) diffuse[i] = median[i]!;
}
const { grid } = recipe, pixels = grid.width * grid.height;
const resized = await sharp(diffuse, { raw: native.info }).extract(recipe.crop)
  .resize(grid.width, grid.height, { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer();
const input = emissionInputChannels(resized,pixels,recipe.blackLevel);
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
  const bytes = emissionRasterPixels(channels,pixels,gain);
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
  doi: depthPrior ? recipe.modelReference?.paper : 'https://doi.org/10.1111/cgf.12216', recipePath, recipe,
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
  sampleEmission:createInferredEmissionSampler(results.map(result=>result.volume),grid,bounds,voxelSize) });
const frame: DensityVolumeFrame = { referenceFrame: 'lab-image-relative-unscaled', epochJdTt: 2451545,
  originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1, boundsUnits: bounds };
const data = compileCssVolume({ id: recipe.id, frame, slices: baked.masters, recipe: { anchors: [] } });
validatePreparedCssVolume(data);
const preparedBytes = Buffer.from(JSON.stringify({ schema: PREPARED_OBJECT_SCHEMA, id: recipe.id,
  type: 'density-volume', format: DENSITY_VOLUME_FORMAT, data }) + '\n');
await writeFile(resolve(preparedDirectory, 'volume.json'), preparedBytes);
await writeFile(resolve(staging, 'experiment.json'), recipeText);
const descriptor = { schema: OBJECT_SCHEMA, id: recipe.id, type: 'density-volume',
  properties: { volume: frame, preparation: { source: 'experiment.json' } },
  prepared: { format: DENSITY_VOLUME_FORMAT, url: 'prepared/volume.json' } };
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
