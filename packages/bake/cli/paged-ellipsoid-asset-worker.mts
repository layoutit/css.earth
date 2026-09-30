import { parentPort, workerData } from 'node:worker_threads';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { preparePagedEllipsoidAssets, readPagedEllipsoid } from '@cssearth/bake/objects/layers/paged-ellipsoid';
import type { SolarGeometry } from '@cssearth/bake/objects/scene';
import { requireRecord, requireString } from '@cssearth/core';
import type { PagedAssetJob } from '@cssearth/bake/objects/layers/paged-ellipsoid';

// One share of a paged ellipsoid's asset preparation, run in a worker thread by preparePagedEllipsoidAssetsInParallel
// (`@cssearth/bake/objects/layers/paged-ellipsoid`); the host passes this module as the paged object's `assetWorker`. It
// loads the generated solar geometry from the checkout it runs in, as the host does.
const solarGeometry: SolarGeometry = await import(pathToFileURL(resolve(process.cwd(), 'src/platform/solar-geometry.mts')).href);
const data = requireRecord(workerData, 'paged asset worker data'), input = requireRecord(data.job, 'paged asset job');
const mode = requireString(input.mode, 'paged asset job mode');
if (mode !== 'maps' && mode !== 'extras' && mode !== 'materials') throw new TypeError(`Unknown paged asset job mode: ${mode}.`);
const slice = input.materialSlice === undefined ? undefined : requireRecord(input.materialSlice, 'material slice');
const job: PagedAssetJob = { mode,
  ...(Array.isArray(input.surfaceMapNames) ? { surfaceMapNames: input.surfaceMapNames.map(name => requireString(name, 'surface map name')) } : {}),
  ...(slice ? { materialSlice: { index: Number(slice.index), count: Number(slice.count) } } : {}) };
if (job.materialSlice && !(Number.isInteger(job.materialSlice.index) && Number.isInteger(job.materialSlice.count) && job.materialSlice.index >= 0 && job.materialSlice.index < job.materialSlice.count))
  throw new TypeError(`Invalid material slice: ${JSON.stringify(slice)}.`);
const { descriptor, config, sourceDirectory, atmosphere, atmosphereModel, raster, attitude, surfaceRasterPlan } = await readPagedEllipsoid(solarGeometry, requireString(data.objectDirectory, 'object directory'));
const { assets } = await preparePagedEllipsoidAssets({ config, sourceDirectory, publicDirectory: requireString(data.publicDirectory, 'public directory'),
  surfaceRasterPlan, atmosphere, atmosphereModel, raster, attitude, cutaway: Boolean(descriptor.recipe.cutaway), ...job });
parentPort?.postMessage(assets);
