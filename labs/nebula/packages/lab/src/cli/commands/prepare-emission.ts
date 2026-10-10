/** Offline planetary-nebula experiment; never runs from a browser mount. The fit is `fitSymmetryRecipe`, shared with
 * `model <id> --method symmetry`, which reads the same fit as surfaces; this command bakes it as a volume. */
import { emissionRasterPixels, createInferredEmissionSampler } from '@cssearth/nebula-reconstruction/methods/symmetry/processing';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { OBJECT_SCHEMA, PREPARED_OBJECT_SCHEMA, DENSITY_VOLUME_FORMAT, type DensityVolumeFrame, parseDensityVolumeObjectDescriptor, validatePreparedCssVolume } from '@cssearth/objects';
import { projectEmission } from '@cssearth/nebula-reconstruction/methods/symmetry/solver';
import { bakeMasterVolumeSlices } from '@cssearth/bake/volume/node';
import { compileCssVolume } from '../../adapters/preparation/css-volume.ts';
import { fitSymmetryRecipe, readSymmetryRecipe } from '../../server/workflows/emission-inference/symmetry-fit.ts';

const json = async (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
const recipePath = process.argv[2];
if (!recipePath || process.argv.length !== 3) throw new TypeError('Usage: prepare-emission <recipe.json>');
const recipeText = await readFile(recipePath, 'utf8'), recipe = readSymmetryRecipe(recipeText);
const start = performance.now();
const { cache, source, native, diffuse, removed, input, depthPrior, results, solverSeconds } = await fitSymmetryRecipe(process.cwd(), recipePath, recipe,
  (channel, iteration, error) => console.log(`EMISSION_FIT RGB${channel + 1} ${iteration}/${recipe.iterations} error=${error.toFixed(4)}`));
const { grid } = recipe, pixels = grid.width * grid.height;
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
