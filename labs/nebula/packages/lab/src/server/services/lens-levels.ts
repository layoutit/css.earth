/**
 * Per-channel levels, delta and transfer for one baked image lens, from that lens's own pinned rasters.
 *
 * The offline round measured the same three things from browser captures
 * (`output/lmc-improvement/colour/levels-panel.mts`). This route measures them from the files the result
 * already pins, so the lab can show them live without rendering anything:
 *
 *  - SOURCE  = `source/registered-image.png`, this lens's own registered photograph, resampled onto the
 *              model's projection grid through both tangent bounds and with its own sky pedestal (the 5th
 *              percentile inside the footprint) removed, exactly as the offline scripts remove it.
 *  - RENDER  = `source/fit-projection.png`, the model's own analytic front projection
 *              `255·(1−exp(−exposureGain·I))`, wearing this lens's peak-normalized chromaticity. That is
 *              what `bakeFiniteLens` composes: every lens of one finite geometry inherits the geometry's
 *              single fitted alpha and contributes only its own hue, so the level is the projection byte
 *              and the color is `255·rgb/max(rgb)` from the same registered image.
 *  - MASK    = `source/original-image.png` alpha, the overlay footprint the pipeline itself treats as
 *              observed coverage.
 *
 * The projection is analytic light. The delivered slab bank composites it in premultiplied 8-bit alpha and
 * loses the texels that round to zero, so these numbers read brighter than a screen capture of the same
 * lens; the difference is the delivery loss, not a different measurement.
 */
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseLabModelJson } from '../../resources/model-paths.ts';
import { lensToneRender, validateChannelGain, validateLensToneCurve, type ChannelGain, type LensToneCurve } from '@cssearth/bake/volume';
import type { PreparedReconstruction } from '../../features/reconstruction/reconstruction-types.ts';

export const LEVEL_BINS = 64;
export const TRANSFER_BINS = 32;
/** A binned transfer median needs enough pixels to be a median rather than one bright pixel. */
const TRANSFER_MINIMUM = 12;
const CHANNELS = ['R', 'G', 'B'] as const;

export interface LensLevelsChannel {
  name: (typeof CHANNELS)[number];
  /** Pixels per level bin over the footprint, 64 bins of 4 levels. */
  sourceHistogram: number[];
  renderHistogram: number[];
  sourceP50: number; sourceP90: number; renderP50: number; renderP90: number;
  p50Ratio: number; p90Ratio: number;
  /** Mean render-minus-source level over the footprint, signed and absolute. */
  signedMeanDelta: number; absoluteMeanDelta: number;
  /** The level bin whose pixel count differs most between the two histograms. */
  worstBin: { from: number; to: number; pixels: number; footprintPercent: number };
  /** Median render level per bin of source level; null where the bin holds too few pixels. */
  transfer: (number | null)[];
}
export interface LensLevels {
  schema: 'cssearth-nebula-lens-levels@1';
  resultId: string; imageId: string;
  modelResultId: string; sourceResultId: string;
  files: { projection: string; source: string; coverage: string; sha256: Record<string, string> };
  grid: { width: number; height: number };
  footprintPixels: number; gridPixels: number;
  /** Per-channel 5th percentile of the registered image inside the footprint, removed from the source. */
  skyPedestal: number[];
  bins: number; transferBins: number;
  flux: { source: number; render: number; percent: number };
  /**
   * Flux-weighted mean angle between the two RGB directions, in degrees; level independent. It measures the
   * source against the projected chromaticity only — the delivered bank's own hue also carries per-component
   * averaging and the envelope's whitening, so this is a floor, not the delivered hue error.
   */
  hueErrorDegrees: number;
  channels: LensLevelsChannel[];
  note: string;
}
export interface LensLevelGrid {
  width: number; height: number;
  /** Model front projection byte per grid pixel. */
  projection: Uint8Array;
  /** Registered source RGB on the same grid, raw bytes, three values per pixel. */
  source: Float64Array;
  /** 1 where the overlay footprint covers the grid pixel. */
  mask: Uint8Array;
}
/** The lens's own recorded material corrections, so the render side shows what that lens was baked with. */
export interface LensLevelMaterial { channelGain: ChannelGain | null; toneCurve: LensToneCurve | null }

/**
 * The analytic render of one channel before any tone curve: the projection byte wearing the image's
 * peak-normalized chromaticity, times the lens's recorded channel gain (clipped where it reaches full), as
 * the bake paints it where alpha carries colour.
 */
export const untonedRender = (level: number, raw: number, peak: number, gain?: number) =>
  !(peak > 0) ? 0 : gain === undefined ? level * raw / peak : level * Math.min(255, 255 * raw / peak * gain) / 255;
const quantile = (sorted: number[], fraction: number) =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]! : 0;
const ratio = (render: number, source: number) => (source > 0 ? render / source : 0);

/**
 * Per covered grid pixel, the two levels every comparison uses: the source with its sky pedestal removed and
 * the render the lens paints there. The levels statistics and the difference map both read these, so the two
 * can never disagree about what "source" and "render" mean.
 */
export interface LensLevelPairs {
  /** Grid pixel index of each covered pixel, in scan order. */
  covered: number[];
  /** Per-channel 5th percentile of the registered image inside the footprint. */
  sky: number[];
  /** Three levels per covered pixel, in the order of `covered`. */
  source: Float64Array; render: Float64Array;
}
export function lensLevelPairs(grid: LensLevelGrid, material: LensLevelMaterial = { channelGain: null, toneCurve: null }): LensLevelPairs {
  const { width, height, projection, source, mask } = grid;
  const pixels = width * height;
  if (projection.length < pixels || source.length < pixels * 3 || mask.length < pixels)
    throw new TypeError('Lens levels received an incomplete grid.');
  const covered: number[] = [];
  for (let p = 0; p < pixels; p++) if (mask[p]) covered.push(p);
  const sky = CHANNELS.map((_, c) => {
    const values = covered.map(p => source[p * 3 + c]!).sort((a, b) => a - b);
    return quantile(values, .05);
  });
  const sourceLevels = new Float64Array(covered.length * 3), renderLevels = new Float64Array(covered.length * 3);
  covered.forEach((p, k) => {
    const level = projection[p]!, raw = [source[p * 3]!, source[p * 3 + 1]!, source[p * 3 + 2]!];
    const peak = Math.max(raw[0]!, raw[1]!, raw[2]!);
    for (let c = 0; c < 3; c++) {
      sourceLevels[k * 3 + c] = Math.max(0, raw[c]! - sky[c]!);
      // The delivered material is the projection's alpha wearing the image's peak-normalized chromaticity.
      renderLevels[k * 3 + c] = lensToneRender(material.toneCurve, c, level, untonedRender(level, raw[c]!, peak, material.channelGain?.[c]));
    }
  });
  return { covered, sky, source: sourceLevels, render: renderLevels };
}

/** The whole measurement, over one prepared grid. Kept pure so its tests never need a bake. */
export function lensLevelStatistics(grid: LensLevelGrid, material: LensLevelMaterial = { channelGain: null, toneCurve: null }): Pick<LensLevels,
  'footprintPixels' | 'gridPixels' | 'skyPedestal' | 'bins' | 'transferBins' | 'flux' | 'hueErrorDegrees' | 'channels'> {
  const pixels = grid.width * grid.height;
  const { covered, sky, source: sourcePairs, render: renderPairs } = lensLevelPairs(grid, material);
  const sourceHistogram = CHANNELS.map(() => new Array<number>(LEVEL_BINS).fill(0));
  const renderHistogram = CHANNELS.map(() => new Array<number>(LEVEL_BINS).fill(0));
  const sourceValues = CHANNELS.map(() => [] as number[]), renderValues = CHANNELS.map(() => [] as number[]);
  const buckets = CHANNELS.map(() => Array.from({ length: TRANSFER_BINS }, () => [] as number[]));
  const signed = [0, 0, 0], absolute = [0, 0, 0];
  const binWidth = 256 / LEVEL_BINS, transferWidth = 256 / TRANSFER_BINS;
  let fluxSource = 0, fluxRender = 0, hueSum = 0, hueWeight = 0;
  for (let k = 0; k < covered.length; k++) {
    const sourceLevel = sourcePairs.subarray(k * 3, k * 3 + 3), renderLevel = renderPairs.subarray(k * 3, k * 3 + 3);
    fluxSource += Math.max(sourceLevel[0]!, sourceLevel[1]!, sourceLevel[2]!);
    fluxRender += Math.max(renderLevel[0]!, renderLevel[1]!, renderLevel[2]!);
    for (let c = 0; c < 3; c++) {
      sourceHistogram[c]![Math.min(LEVEL_BINS - 1, Math.floor(sourceLevel[c]! / binWidth))]! += 1;
      renderHistogram[c]![Math.min(LEVEL_BINS - 1, Math.floor(renderLevel[c]! / binWidth))]! += 1;
      sourceValues[c]!.push(sourceLevel[c]!); renderValues[c]!.push(renderLevel[c]!);
      buckets[c]![Math.min(TRANSFER_BINS - 1, Math.floor(sourceLevel[c]! / transferWidth))]!.push(renderLevel[c]!);
      signed[c]! += renderLevel[c]! - sourceLevel[c]!;
      absolute[c]! += Math.abs(renderLevel[c]! - sourceLevel[c]!);
    }
    const sourceNorm = Math.hypot(sourceLevel[0]!, sourceLevel[1]!, sourceLevel[2]!);
    const renderNorm = Math.hypot(renderLevel[0]!, renderLevel[1]!, renderLevel[2]!);
    if (sourceNorm > 3 && renderNorm > 3) {
      const dot = (sourceLevel[0]! * renderLevel[0]! + sourceLevel[1]! * renderLevel[1]! + sourceLevel[2]! * renderLevel[2]!) / (sourceNorm * renderNorm);
      const weight = Math.max(sourceLevel[0]!, sourceLevel[1]!, sourceLevel[2]!);
      hueSum += Math.acos(Math.min(1, Math.max(-1, dot))) * 180 / Math.PI * weight; hueWeight += weight;
    }
  }
  const footprint = covered.length, divisor = Math.max(1, footprint);
  const channels = CHANNELS.map((name, c): LensLevelsChannel => {
    const sourceSorted = sourceValues[c]!.sort((a, b) => a - b), renderSorted = renderValues[c]!.sort((a, b) => a - b);
    let worst = 0;
    for (let bin = 0; bin < LEVEL_BINS; bin++)
      if (Math.abs(renderHistogram[c]![bin]! - sourceHistogram[c]![bin]!) >
          Math.abs(renderHistogram[c]![worst]! - sourceHistogram[c]![worst]!)) worst = bin;
    const sourceP50 = quantile(sourceSorted, .5), sourceP90 = quantile(sourceSorted, .9);
    const renderP50 = quantile(renderSorted, .5), renderP90 = quantile(renderSorted, .9);
    return { name, sourceHistogram: sourceHistogram[c]!, renderHistogram: renderHistogram[c]!,
      sourceP50, sourceP90, renderP50, renderP90,
      p50Ratio: ratio(renderP50, sourceP50), p90Ratio: ratio(renderP90, sourceP90),
      signedMeanDelta: signed[c]! / divisor, absoluteMeanDelta: absolute[c]! / divisor,
      worstBin: { from: worst * binWidth, to: (worst + 1) * binWidth,
        pixels: renderHistogram[c]![worst]! - sourceHistogram[c]![worst]!,
        footprintPercent: (renderHistogram[c]![worst]! - sourceHistogram[c]![worst]!) / divisor * 100 },
      transfer: buckets[c]!.map(set => (set.length >= TRANSFER_MINIMUM ? set.sort((a, b) => a - b)[set.length >> 1]! : null)) };
  });
  return { footprintPixels: footprint, gridPixels: pixels, skyPedestal: sky,
    bins: LEVEL_BINS, transferBins: TRANSFER_BINS,
    flux: { source: fluxSource, render: fluxRender, percent: fluxSource > 0 ? (fluxRender / fluxSource - 1) * 100 : 0 },
    hueErrorDegrees: hueWeight > 0 ? hueSum / hueWeight : 0, channels };
}

/** Tangent-plane bounds in kpc: `min`/`max` x (east) and y (north). */
export interface Bounds { min: number[]; max: number[] }
const bounds = (value: unknown): Bounds => {
  const min = (value as Bounds | undefined)?.min, max = (value as Bounds | undefined)?.max;
  if (!Array.isArray(min) || !Array.isArray(max) || min.length < 2 || max.length < 2 ||
      ![...min.slice(0, 2), ...max.slice(0, 2)].every(v => typeof v === 'number' && Number.isFinite(v)) ||
      !(max[0]! > min[0]!) || !(max[1]! > min[1]!)) throw new TypeError('Invalid pinned tangent bounds.');
  return { min, max };
};

/**
 * Resample this lens's registered raster and its coverage onto the model's projection grid.
 *
 * The lens image and the projection carry different tangent bounds — each lens is registered on its own
 * sky footprint — so the two are related through those bounds, never by stretching one raster onto the
 * other. This is the same mapping `finite-lens.ts` samples the material through, written out here because
 * that file's bytes are pinned into every baked lens identity and must not move.
 */
export function resampleOntoProjection(inputs: {
  width: number; height: number; projectionBounds: Bounds;
  lensWidth: number; lensHeight: number; lensBounds: Bounds;
  rgb: Uint8Array | Buffer; rgbChannels: number; alpha: Uint8Array | Buffer; alphaChannels: number;
}): { source: Float64Array; mask: Uint8Array } {
  const { width, height, projectionBounds: view, lensWidth, lensHeight, lensBounds: lens } = inputs;
  const source = new Float64Array(width * height * 3), mask = new Uint8Array(width * height);
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    const x = view.min[0]! + (i + .5) / width * (view.max[0]! - view.min[0]!);
    const y = view.max[1]! - (j + .5) / height * (view.max[1]! - view.min[1]!);
    const u = (x - lens.min[0]!) / (lens.max[0]! - lens.min[0]!) * lensWidth - .5;
    const v = (lens.max[1]! - y) / (lens.max[1]! - lens.min[1]!) * lensHeight - .5;
    if (u < 0 || v < 0 || u > lensWidth - 1 || v > lensHeight - 1) continue;
    const ix = Math.floor(u), iy = Math.floor(v);
    if (inputs.alpha[(iy * lensWidth + ix) * inputs.alphaChannels + inputs.alphaChannels - 1]! < 250) continue;
    const p = j * width + i;
    mask[p] = 1;
    for (let c = 0; c < 3; c++) {
      let value = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++)
        value += inputs.rgb[inputs.rgbChannels * (Math.min(lensHeight - 1, iy + dy) * lensWidth + Math.min(lensWidth - 1, ix + dx)) + c]! *
          (dx ? u - ix : 1 - u + ix) * (dy ? v - iy : 1 - v + iy);
      source[p * 3 + c] = Math.min(255, Math.max(0, value));
    }
  }
  return { source, mask };
}

const PROJECTION = 'source/fit-projection.png', REGISTERED = 'source/registered-image.png', COVERAGE = 'source/original-image.png';
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

/** Read one artifact of a saved result and verify it against that result's own manifest. */
async function artifact(directory: string, manifest: Record<string, { sha256?: unknown }>, path: string) {
  const bytes = await readFile(resolve(directory, path));
  const pin = manifest[path]?.sha256;
  if (typeof pin !== 'string' || digest(bytes) !== pin) throw new TypeError(`Saved lens artifact differs: ${path}`);
  return bytes;
}

/**
 * Measure one saved finite lens. `prepared` is the already-validated result, so this never widens the
 * identity checks `readPreparedReconstruction` owns; nothing here writes.
 */
export async function lensLevels(root: string, prepared: PreparedReconstruction): Promise<LensLevels> {
  const { grid, material, pins } = await loadLensLevelGrid(root, prepared);
  const statistics = lensLevelStatistics(grid, material);
  if (!statistics.footprintPixels) throw new TypeError('This lens image covers none of the model projection.');
  return { schema: 'cssearth-nebula-lens-levels@1', resultId: prepared.resultId, imageId: prepared.imageId,
    modelResultId: prepared.finiteMaterial!.modelResultId, sourceResultId: prepared.finiteMaterial!.sourceResultId,
    files: { projection: PROJECTION, source: REGISTERED, coverage: COVERAGE, sha256: pins },
    grid: { width: grid.width, height: grid.height }, ...statistics,
    note: 'Source: this lens’s own registered image, sky pedestal removed. Render: the model’s analytic front ' +
      'projection wearing this lens’s peak-normalized chromaticity and its own recorded channel gain and tone curve. Analytic light, so it reads brighter than the ' +
      'delivered bank, which loses the texels that round to zero in premultiplied 8-bit alpha. The chroma angle ' +
      'compares those two directly, so it is not the delivered hue error: the bank also averages chromaticity per ' +
      'finite component and mixes in the envelope’s whitened colour.' };
}

/** The measurement's inputs for one saved lens: the pinned grid and the lens's recorded material corrections. */
export async function loadLensLevelGrid(root: string, prepared: PreparedReconstruction):
  Promise<{ grid: LensLevelGrid; material: LensLevelMaterial; pins: Record<string, string>;
    /** The projection grid's and the lens image's own tangent bounds; the lens bounds are the overlay's frame. */
    bounds: { projection: Bounds; lens: Bounds } }> {
  if (!prepared.finiteMaterial) throw new TypeError('Levels compare a baked image lens against its own source image.');
  const directory = resolve(root, prepared.subject.directory);
  const manifestBytes = await readFile(resolve(directory, 'manifest.json'));
  const manifest = parseLabModelJson(manifestBytes.toString());
  if (manifest.schema !== 'cssearth-nebula-reconstruction-artifacts@1' || manifest.id !== prepared.subject.id ||
      !manifest.artifacts || typeof manifest.artifacts !== 'object')
    throw new TypeError('Saved lens artifact manifest differs.');
  const artifacts = manifest.artifacts as Record<string, { sha256?: unknown }>;
  const provenance = parseLabModelJson((await artifact(directory, artifacts, 'source/provenance.json')).toString());
  const grid = provenance.densityProjection, lensBounds = bounds(provenance.sourceRegistration?.tangentBoundsKpc);
  if (!grid || !Number.isInteger(grid.width) || !Number.isInteger(grid.height) || grid.width < 2 || grid.height < 2)
    throw new TypeError('This saved lens pins no model projection grid.');
  const projectionBounds = bounds(grid.tangentBoundsKpc);
  const projection = await sharp(await artifact(directory, artifacts, PROJECTION)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (projection.info.width !== grid.width || projection.info.height !== grid.height)
    throw new TypeError('The saved front projection differs from its pinned grid.');
  const registered = await sharp(await artifact(directory, artifacts, REGISTERED)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const coverage = await sharp(await artifact(directory, artifacts, COVERAGE))
    .resize(registered.info.width, registered.info.height, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
  const { source, mask } = resampleOntoProjection({ width: grid.width, height: grid.height, projectionBounds,
    lensWidth: registered.info.width, lensHeight: registered.info.height, lensBounds,
    rgb: registered.data, rgbChannels: registered.info.channels, alpha: coverage, alphaChannels: 4 });
  const flat = new Uint8Array(grid.width * grid.height);
  for (let p = 0; p < flat.length; p++) flat[p] = projection.data[p * projection.info.channels]!;
  const finite = provenance.finiteMaterial ?? {};
  const material = { channelGain: finite.channelGain == null ? null : validateChannelGain(finite.channelGain),
    toneCurve: finite.toneCurve == null ? null : validateLensToneCurve(finite.toneCurve) };
  return { grid: { width: grid.width, height: grid.height, projection: flat, source, mask }, material,
    bounds: { projection: projectionBounds, lens: lensBounds },
    pins: Object.fromEntries([PROJECTION, REGISTERED, COVERAGE].map(path => [path, String(artifacts[path]!.sha256)])) };
}
