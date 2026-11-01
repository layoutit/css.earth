/** The model's far pictures, rendered tile by tile. Each tile keeps the full camera, and a stopped bake resumes at the tile it lost. */
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import { FAR_RADIUS, FAR_SIZE, modelFarCamera, modelFarRgba, modelFarViews } from './far-model.mts';
import { catalogueBasis, projectCatalogue } from '../catalogue-render.mts';
import { gradedPrediction } from '../grade.mts';
import { need } from '../inputs.mts';
import { BAKE_DIR, loadModel } from '../scene.mts';

export const FAR_DIR = BAKE_DIR + 'far/';
const TILE = 256,
  WORKERS = 6,
  SAMPLING = {
    objectSubpixels: 4 as const,
    cacheFinishedDust: true,
    gaussianTailSigma: 10 as const,
    skipEmptyGaussianRuns: true,
  };
type Tile = { view: ReturnType<typeof modelFarViews>[number]; left: number; top: number };
export const farTiles = (): Tile[] =>
  modelFarViews().flatMap(view =>
    Array.from({ length: (FAR_SIZE / TILE) ** 2 }, (_, i) => ({
      view,
      left: (i % (FAR_SIZE / TILE)) * TILE,
      top: Math.floor(i / (FAR_SIZE / TILE)) * TILE,
    })),
  );
const tilePath = (j: Tile) => FAR_DIR + `native/${j.view.id}-${j.left}-${j.top}.f64le`;
const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

/** One worker's share of the tiles, or the tiles of `only`. */
export async function farWorker(worker: number, only?: readonly number[]) {
  await mkdir(FAR_DIR + 'native/', { recursive: true });
  const source = await loadModel('far'),
    tiles = farTiles(),
    jobs = only ? only.map(i => tiles[i]!) : tiles.filter((_, i) => i % WORKERS === worker);
  for (const j of jobs) {
    if (await exists(tilePath(j))) continue;
    const projection = projectCatalogue(source.scene, modelFarCamera(j.view, FAR_SIZE), 0.015, undefined, undefined, {
        ...SAMPLING,
        window: { left: j.left, top: j.top, width: TILE, height: TILE },
      }),
      rgb = gradedPrediction(catalogueBasis(projection, source.scene, source.amplitudes), source.grade);
    need(
      rgb.every(v => Number.isFinite(v) && v >= 0),
      'Invalid model picture light',
    );
    await writeFile(tilePath(j) + '.tmp', Buffer.from(rgb.buffer));
    await rename(tilePath(j) + '.tmp', tilePath(j));
    console.log('LMC_FAR_TILE ' + j.view.id + ' ' + j.left + ' ' + j.top);
    const gc = Reflect.get(globalThis, 'gc');
    if (typeof gc === 'function') gc();
  }
}
/** Render what is missing across the workers, then assemble each picture. */
export async function bakeFarPictures(entry: string) {
  const children = Array.from(
    { length: WORKERS },
    (_, i) =>
      new Promise<void>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          ['--expose-gc', '--max-old-space-size=8192', entry, 'far-worker', String(i)],
          {
            stdio: ['ignore', 'inherit', 'inherit'],
          },
        );
        child.once('close', code => (code === 0 ? resolve() : reject(Error('Far worker failed: ' + i))));
      }),
  );
  await Promise.all(children);
  await mkdir(FAR_DIR + 'pictures/', { recursive: true });
  for (const view of modelFarViews()) {
    const rgb = new Float64Array(FAR_SIZE * FAR_SIZE * 3);
    for (const j of farTiles().filter(j => j.view.id === view.id)) {
      const v = new Float64Array(Uint8Array.from(await readFile(tilePath(j))).buffer);
      for (let y = 0; y < TILE; y++)
        rgb.set(v.subarray(y * TILE * 3, (y + 1) * TILE * 3), ((j.top + y) * FAR_SIZE + j.left) * 3);
    }
    await sharp(modelFarRgba(rgb), { raw: { width: FAR_SIZE, height: FAR_SIZE, channels: 4 } })
      .png()
      .toFile(FAR_DIR + 'pictures/' + view.id + '.png');
    console.log('LMC_FAR_PICTURE ' + view.id);
  }
}
export { FAR_RADIUS };
