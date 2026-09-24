import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';

/** One share of the asset preparation: a surface map, the extras (interior, legends, thumbnails) or a material slice. */
export interface PagedAssetJob { mode: 'maps' | 'extras' | 'materials'; surfaceMapNames?: readonly string[]; materialSlice?: { index: number; count: number }; }

// Each surface map holds a full-resolution raster (a few GB), so the pool stays well inside a laptop's memory.
const MAXIMUM_WORKERS = 6;

/** Prepare a paged ellipsoid's assets in worker threads: each surface map, the extras and slices of the material frames
 * run at once. Every job writes a disjoint set of files with the same code as a single run, so the outputs are the same. */
export async function preparePagedEllipsoidAssetsInParallel({ objectDirectory, publicDirectory, mapNames }: { objectDirectory: string; publicDirectory: string; mapNames: readonly string[] }) {
  const workers = Math.max(1, Math.min(MAXIMUM_WORKERS, availableParallelism() - 2));
  const slices = workers;
  // Longest first (Earth, 2026-09-24): the extras take about 115 s, a surface map 80 s, a sixth of the materials 55 s.
  const jobs: PagedAssetJob[] = [{ mode: 'extras' }, ...mapNames.map(name => ({ mode: 'maps' as const, surfaceMapNames: [name] })),
    ...Array.from({ length: slices }, (_, index) => ({ mode: 'materials' as const, materialSlice: { index, count: slices } }))];
  const assets = new Set<string>();
  let next = 0;
  const run = (job: PagedAssetJob) => new Promise<void>((done, fail) => {
    const worker = new Worker(new URL('./asset-worker.mts', import.meta.url), { workerData: { objectDirectory, publicDirectory, job } });
    let received = false;
    worker.once('message', (produced: unknown) => {
      if (!Array.isArray(produced) || produced.some(item => typeof item !== 'string')) { fail(new TypeError(`${objectDirectory}: asset job ${JSON.stringify(job)} returned an invalid file list.`)); return; }
      for (const asset of produced) assets.add(asset);
      received = true;
    });
    worker.once('error', (error: unknown) => fail(new Error(`${objectDirectory}: asset job ${JSON.stringify(job)} failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error })));
    worker.once('exit', code => received && code === 0 ? done() : fail(new Error(`${objectDirectory}: asset job ${JSON.stringify(job)} exited with code ${code}.`)));
  });
  await Promise.all(Array.from({ length: Math.min(workers, jobs.length) }, async () => {
    while (next < jobs.length) await run(jobs[next++]);
  }));
  return { assets: [...assets].sort() };
}
