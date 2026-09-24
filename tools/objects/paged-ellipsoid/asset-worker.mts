import { parentPort, workerData } from 'node:worker_threads';
import { readPagedEllipsoid } from './context.mts';
import { preparePagedEllipsoidAssets } from './assets.mts';
import { requireRecord, requireString } from '../../sources/source-values.mts';
import type { PagedAssetJob } from './parallel-assets.mts';

// One share of a paged ellipsoid's asset preparation, run by parallel-assets.mts.
const data = requireRecord(workerData, 'paged asset worker data'), input = requireRecord(data.job, 'paged asset job');
const mode = requireString(input.mode, 'paged asset job mode');
if (mode !== 'maps' && mode !== 'extras' && mode !== 'materials') throw new TypeError(`Unknown paged asset job mode: ${mode}.`);
const slice = input.materialSlice === undefined ? undefined : requireRecord(input.materialSlice, 'material slice');
const job: PagedAssetJob = { mode,
  ...(Array.isArray(input.surfaceMapNames) ? { surfaceMapNames: input.surfaceMapNames.map(name => requireString(name, 'surface map name')) } : {}),
  ...(slice ? { materialSlice: { index: Number(slice.index), count: Number(slice.count) } } : {}) };
if (job.materialSlice && !(Number.isInteger(job.materialSlice.index) && Number.isInteger(job.materialSlice.count) && job.materialSlice.index >= 0 && job.materialSlice.index < job.materialSlice.count))
  throw new TypeError(`Invalid material slice: ${JSON.stringify(slice)}.`);
const { config, sourceDirectory, atmosphere, atmosphereModel, raster, attitude, surfaceRasterPlan } = await readPagedEllipsoid(requireString(data.objectDirectory, 'object directory'));
const { assets } = await preparePagedEllipsoidAssets({ config, sourceDirectory, publicDirectory: requireString(data.publicDirectory, 'public directory'),
  surfaceRasterPlan, atmosphere, atmosphereModel, raster, attitude, ...job });
parentPort?.postMessage(assets);
