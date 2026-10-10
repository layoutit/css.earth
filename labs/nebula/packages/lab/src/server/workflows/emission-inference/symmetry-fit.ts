/** The axial-symmetry fit of one `cssearth-emission-inference@1` recipe (Wenger, Lorenz & Magnor 2013): the source
 * photograph read and cleaned as the recipe says, then the solver run on each color channel. `prepare-emission` bakes
 * the result as a volume (the M2-9 site bank's history); `model <id> --method symmetry` reads it as surfaces. Both
 * call this one function. */
import { applyIsophoteMasks, applyRecordedPointMasks, emissionInputChannels } from '@cssearth/nebula-reconstruction/methods/symmetry/processing';
import { inferEmission, type InferenceGrid, type SymmetryPrior } from '@cssearth/nebula-reconstruction/methods/symmetry/solver';
import { geometricDepth, conditionEmission, type ShapePrior } from '@cssearth/nebula-reconstruction/methods/symmetry/shape-prior';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { nativeStarless, type NativeRemoval } from './native-source.ts';
import { objectScratch } from '../../../resources/model-paths.ts';

export interface SymmetryRecipe {
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

export function readSymmetryRecipe(text: string): SymmetryRecipe {
  const recipe = JSON.parse(text) as SymmetryRecipe;
  if (recipe.schema !== 'cssearth-emission-inference@1' || !/^[a-z0-9-]+$/.test(recipe.id) ||
      !/^https:\/\//.test(recipe.source.url) ||
      (Array.isArray(recipe.blackLevel) ? recipe.blackLevel.length !== 3 ? [NaN] : recipe.blackLevel : [recipe.blackLevel]).some(level => !Number.isFinite(level) || level < 0 || level >= 1))
    throw new TypeError('Invalid emission recipe.');
  return recipe;
}
/** Where a recipe's downloads and results live: its object's `.local/planetary`, the object named by the recipe's
 * own path (`src/objects/<id>/source/…`), else the folder its id names. */
export function symmetryScratch(recipePath: string, recipe: SymmetryRecipe): string {
  const owner = /(?:^|\/)src\/objects\/([a-z0-9][a-z0-9-]*)\/source\//.exec(recipePath.replaceAll('\\', '/'))?.[1];
  return owner ? `src/objects/${owner}/.local/planetary` : objectScratch(recipe.id, 'planetary');
}

/** Whether bytes are the recipe's photograph: an image of its recorded size, not an archive's HTML page. */
async function isSourceImage(bytes: Buffer | null, recipe: SymmetryRecipe) {
  if (!bytes) return false;
  try { const meta = await sharp(bytes).metadata(); return meta.width === recipe.source.width && meta.height === recipe.source.height; } catch { return false; }
}
const readOptional = (path: string) => readFile(path).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return null; throw error; });
/** The photograph: the fit's cached copy, else the copy the object's source manifest pins for the recipe's publisher
 * page (restored by its origin or the source cache), else a download. A cached or downloaded file that is not the
 * photograph (an archive that now answers with a web page) is refused, never fitted. */
async function recipeSource(root: string, recipePath: string, recipe: SymmetryRecipe, cachePath: string): Promise<Buffer> {
  const cached = await readOptional(cachePath);
  if (await isSourceImage(cached, recipe)) return cached!;
  const owner = /(?:^|\/)src\/objects\/([a-z0-9][a-z0-9-]*)\/source\//.exec(recipePath.replaceAll('\\', '/'))?.[1];
  if (owner) {
    const manifest: unknown = JSON.parse((await readOptional(resolve(root, `src/objects/${owner}/source/manifest.json`)))?.toString() ?? 'null');
    const inputs = manifest && typeof manifest === 'object' && Array.isArray((manifest as { inputs?: unknown }).inputs) ? (manifest as { inputs: unknown[] }).inputs : [];
    for (const input of inputs) {
      if (!input || typeof input !== 'object') continue;
      const { path, sourceUrl } = input as { path?: unknown; sourceUrl?: unknown };
      if (typeof path !== 'string' || sourceUrl !== recipe.source.publisher) continue;
      const pinned = await readOptional(resolve(root, path));
      if (await isSourceImage(pinned, recipe)) { await writeFile(cachePath, pinned!); return pinned!; }
    }
  }
  const response = await fetch(recipe.source.url);
  const bytes = response.ok ? Buffer.from(await response.arrayBuffer()) : null;
  if (!await isSourceImage(bytes, recipe))
    throw new Error(`${recipe.source.url} no longer answers with the ${recipe.source.width} × ${recipe.source.height} photograph (${response.status} ${response.headers.get('content-type') ?? ''}); restore the copy the object's source manifest pins.`);
  await writeFile(cachePath, bytes!);
  return bytes!;
}

export interface SymmetryFit {
  recipe: SymmetryRecipe; cache: string; source: Buffer; native: { data: Buffer; info: import('sharp').OutputInfo };
  diffuse: Buffer; removed: Awaited<ReturnType<typeof nativeStarless>> | undefined;
  input: Float32Array[]; depthPrior: ReturnType<typeof geometricDepth> | null;
  results: (ReturnType<typeof inferEmission> | ReturnType<typeof conditionEmission>)[]; solverSeconds: number;
}
/** Downloads (once) and cleans the photograph, then fits each channel. `onIteration` hears every 20th iteration. */
export async function fitSymmetryRecipe(root: string, recipePath: string, recipe: SymmetryRecipe,
  onIteration: (channel: number, iteration: number, error: number) => void = () => {}): Promise<SymmetryFit> {
  const cache = resolve(root, symmetryScratch(recipePath, recipe)), sourcePath = resolve(cache, `${recipe.id}-original.jpg`);
  await mkdir(cache, { recursive: true });
  const source = await recipeSource(root, recipePath, recipe, sourcePath);
  const native = await sharp(source).removeAlpha().toColorspace('srgb').raw().toBuffer({ resolveWithObject: true });
  if (native.info.width !== recipe.source.width || native.info.height !== recipe.source.height || native.info.channels !== 3)
    throw new Error('Source dimensions differ from recipe.');
  const removed = recipe.nativeRemoval ? await nativeStarless(source, [recipe.source.width, recipe.source.height], recipe.nativeRemoval) : undefined;
  const diffuse = Buffer.from(removed?.pixels ?? native.data);
  if (recipe.nativeRemoval && recipe.pointMasks.length) throw new TypeError('Do not remove point sources again after native NOX separation.');
  applyRecordedPointMasks(diffuse, native.data, native.info.width, native.info.height, recipe.pointMasks);
  if (recipe.neighbourMasks?.fill === 'isophote') {
    const spheroid = recipe.shapePrior?.components.length === 1 && recipe.shapePrior.components[0]!.kind === 'sersic' ? recipe.shapePrior.components[0]! : undefined;
    if (!spheroid || spheroid.axis[2] !== 0 || !Number.isFinite(spheroid.axisRatio)) throw new TypeError('Isophote-filled masks need one Sérsic spheroid whose axis lies in the plane of the sky.');
    // The spheroid's centre in the grid, as a pixel of the source image.
    const pixel = (cell: number, cells: number, start: number, size: number) => start + (cell + .5) * size / cells - .5;
    applyIsophoteMasks(diffuse, native.info.width, native.info.height, recipe.neighbourMasks.masks, {
      centre: [pixel(recipe.prior.center[0]!, recipe.grid.width, recipe.crop.left, recipe.crop.width), pixel(recipe.prior.center[1]!, recipe.grid.height, recipe.crop.top, recipe.crop.height)],
      minorAxis: [spheroid.axis[0], spheroid.axis[1]], axisRatio: spheroid.axisRatio! });
  }
  else if (recipe.neighbourMasks) applyRecordedPointMasks(diffuse, diffuse, native.info.width, native.info.height, recipe.neighbourMasks.masks);
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
  const input = emissionInputChannels(resized, pixels, recipe.blackLevel);
  const start = performance.now();
  const depthPrior = recipe.shapePrior ? geometricDepth(grid, recipe.prior.center, recipe.shapePrior) : null;
  const results = input.map((image, channel) => depthPrior ? conditionEmission(image, depthPrior, grid) : inferEmission({ grid, image, prior: recipe.prior,
    tau: recipe.tau, iterations: recipe.iterations, onIteration(report) {
      if (report.iteration % 20 === 0) onIteration(channel, report.iteration, report.relativeProjectionError);
    } }));
  return { recipe, cache, source, native, diffuse, removed, input, depthPrior, results, solverSeconds: (performance.now() - start) / 1000 };
}
