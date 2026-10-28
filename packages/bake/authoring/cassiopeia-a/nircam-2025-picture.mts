// Entry script: node packages/bake/authoring/cassiopeia-a/nircam-2025-picture.mts
/**
 * Webb's NIRCam mosaic of Cassiopeia A of 2025 October 25 (program 7934) as a picture in the colors ESA/Webb gave the
 * same three filters in its picture of the 2022 November 5 mosaic (program 1947, weic2330a), on that picture's pixels.
 *
 * ESA's picture states which filter is which color: 1.62 µm blue, 3.56 µm green, 4.44 µm red. It does not say how each
 * filter's brightness became a color level. This script reads it off the picture, against the 2022 mosaics it was made from:
 *
 * 1. The place of each picture pixel is the 2022 bank's registration (its recipe's observation: the file's sky tags),
 *    moved by an offset measured here: the shift, in steps of a quarter pixel, at which the red level follows the F444W
 *    flux under it most closely.
 * 2. Each channel is a sum of curves of the logarithm of filters' flux, each curve the median level in 48 bins of equal
 *    count, fitted by backfitting: red from F444W, green from F356W, blue from F162M and F356W. Blue takes two because
 *    the picture's blue follows F356W more closely than F162M alone (measured on 2026-10-28: R² 0.86 against 0.77).
 * 3. The fitted curves turn the 2025 mosaics' flux, sampled at the same places, into the new picture.
 *
 * So the colors are fitted to ESA's picture of 2022, not ESA's own for 2025: the fit leaves part of each channel unexplained
 * (it prints R²), and whatever ESA did by hand to parts of its picture is not reproduced. Where the 2025 mosaics hold no
 * data the picture is black. It prints the offset, the fit and the share of pixels with data, and writes the picture.
 *
 * Inputs: the six mosaics' primary and science units (`.local/nircam/*_i2d.fits`, scratch inputs fetched by byte range from MAST as the manifest states) and
 * the 2022 bank's picture as published (`cassiopeia-a-layers/source/source.jpg`). Output: `source/source.jpg`.
 */
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { readFitsHeader, skyProjection, type SkyProjection } from '@cssearth/fits';
import { parseImageLayerRecipe } from '@cssearth/bake/image-layers';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const root = checkoutProjectRoot(import.meta.url);
const bank = resolve(root, 'src/objects/cassiopeia-a-2025-layers/source'), earlier = resolve(root, 'src/objects/cassiopeia-a-layers/source');
const FILTERS = { F162M: 'f150w2-f162m', F356W: 'clear-f356w', F444W: 'clear-f444w' } as const;
type Filter = keyof typeof FILTERS;
const MOSAICS = { 2022: 'jw01947-o013_t001_nircam', 2025: 'jw07934-o001_t001_nircam' } as const;
const CHANNELS: readonly (readonly Filter[])[] = [['F444W'], ['F356W'], ['F162M', 'F356W']];
const BINS = 48, ROUNDS = 8, STEP = 2;

const recipe = parseImageLayerRecipe(JSON.parse(await readFile(resolve(earlier, 'recipe.json'), 'utf8')));
const published = await sharp(resolve(earlier, 'source.jpg')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const width = published.info.width, height = published.info.height;
if (width !== recipe.source.dimensions[0] || height !== recipe.source.dimensions[1]) throw new Error('The 2022 picture is not the size its recipe states.');
const { centerRaDeg, centerDecDeg, fieldOfViewDeg, northClockwiseDeg } = recipe.observation;
const scaleDeg = fieldOfViewDeg[0] / width, tilt = northClockwiseDeg * Math.PI / 180;
/** The sky place of a picture pixel (x right, y down), moved by the offset in pixels. */
const skyOf = (x: number, y: number, [dx, dy]: readonly [number, number]) => {
  const right = x + dx - (width - 1) / 2, up = (height - 1) / 2 - (y + dy);
  const north = (right * Math.sin(tilt) + up * Math.cos(tilt)) * scaleDeg, east = (-right * Math.cos(tilt) + up * Math.sin(tilt)) * scaleDeg;
  const dec = centerDecDeg + north;
  return [centerRaDeg + east / Math.cos(dec * Math.PI / 180), dec] as const;
};

/** A mosaic's science unit: its projection, and its flux averaged over the box one picture pixel covers. */
async function mosaic(epoch: keyof typeof MOSAICS, filter: Filter) {
  const bytes = await readFile(resolve(bank, `../.local/nircam/${MOSAICS[epoch]}_${FILTERS[filter]}_i2d.fits`));
  const primary = readFitsHeader(bytes), sci = readFitsHeader(bytes, primary.dataOffset), h = sci.header;
  if (h.EXTNAME !== 'SCI' || h.BITPIX !== -32 || h.BUNIT !== 'MJy/sr') throw new Error(`${MOSAICS[epoch]} ${filter}: not a science unit in MJy/sr.`);
  const w = Number(h.NAXIS1), hh = Number(h.NAXIS2), view = new DataView(bytes.buffer, bytes.byteOffset + sci.dataOffset, w * hh * 4);
  const projection: SkyProjection = skyProjection(h), reach = Math.max(0, Math.round(scaleDeg * 3600 / projection.scaleArcsec / 2 - 0.5));
  return (ra: number, dec: number) => {
    const at = projection.pixelOf(ra, dec); if (!at) return NaN;
    const cx = Math.round(at[0]), cy = Math.round(at[1]); let sum = 0, count = 0;
    for (let y = cy - reach; y <= cy + reach; y++) for (let x = cx - reach; x <= cx + reach; x++) {
      if (x < 0 || y < 0 || x >= w || y >= hh) continue;
      const value = view.getFloat32((y * w + x) * 4, false); if (Number.isFinite(value) && value !== 0) { sum += value; count++; }
    }
    return count ? sum / count : NaN;
  };
}

/** Flux of each filter under every STEP-th picture pixel (or every pixel), at an offset. */
async function sampled(epoch: keyof typeof MOSAICS, offset: readonly [number, number], step: number) {
  const columns = Math.ceil(width / step), rows = Math.ceil(height / step), out = {} as Record<Filter, Float32Array>;
  for (const filter of Object.keys(FILTERS) as Filter[]) {
    const read = await mosaic(epoch, filter), values = new Float32Array(columns * rows);
    for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) values[r * columns + c] = read(...skyOf(c * step, r * step, offset));
    out[filter] = values;
  }
  return { out, columns, rows };
}
const levelAt = (channel: number, step: number, columns: number, i: number) => published.data[((Math.floor(i / columns) * step) * width + (i % columns) * step) * 3 + channel]!;
const median = (list: number[]) => list.length ? list.sort((a, b) => a - b)[list.length >> 1]! : 0;

/** Medians of the level in equal-count bins of log flux: the curve, and how much of the level it explains. */
function binned(log: Float32Array, kept: number[]) {
  const sorted = kept.map(i => log[i]!).sort((a, b) => a - b);
  return Array.from({ length: BINS + 1 }, (_, k) => sorted[Math.min(sorted.length - 1, Math.floor(k * sorted.length / BINS))]!);
}
const binOf = (edges: number[], value: number) => { let lo = 0, hi = BINS - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (edges[mid]! <= value) lo = mid; else hi = mid - 1; } return lo; };

function fitChannel(channel: number, filters: readonly Filter[], flux: Record<Filter, Float32Array>, step: number, columns: number) {
  const logs = filters.map(filter => flux[filter].map(value => value > 0 ? Math.log10(value) : NaN));
  const kept: number[] = []; for (let i = 0; i < logs[0]!.length; i++) if (logs.every(log => Number.isFinite(log[i]!))) kept.push(i);
  const edges = logs.map(log => binned(log, kept)), bins = logs.map((log, f) => kept.map(i => binOf(edges[f]!, log[i]!)));
  const target = kept.map(i => levelAt(channel, step, columns, i)), parts = filters.map(() => new Float64Array(kept.length)), curves = filters.map(() => new Array<number>(BINS).fill(0));
  for (let round = 0; round < ROUNDS; round++) for (let f = 0; f < filters.length; f++) {
    const groups = Array.from({ length: BINS }, () => [] as number[]);
    kept.forEach((_, k) => { let rest = target[k]!; for (let o = 0; o < filters.length; o++) if (o !== f) rest -= parts[o]![k]!; groups[bins[f]![k]!]!.push(rest); });
    curves[f] = groups.map(median); kept.forEach((_, k) => { parts[f]![k] = curves[f]![bins[f]![k]!]!; });
  }
  const mean = target.reduce((a, b) => a + b, 0) / target.length; let error = 0, total = 0;
  target.forEach((level, k) => { const fitted = parts.reduce((sum, part) => sum + part[k]!, 0); error += (level - fitted) ** 2; total += (level - mean) ** 2; });
  return { edges, curves, r2: 1 - error / total };
}
/** A channel's level for one place's fluxes: each curve read at its bin centres, interpolated, summed. */
function levelOf(fit: ReturnType<typeof fitChannel>, fluxes: number[]) {
  let level = 0;
  fit.edges.forEach((edges, f) => {
    const value = Math.log10(Math.max(fluxes[f]!, 10 ** edges[0]!)), centres = edges.slice(0, BINS).map((edge, k) => (edge + edges[k + 1]!) / 2);
    const k = Math.max(0, Math.min(BINS - 2, binOf(centres.concat(Infinity), value))), t = Math.max(0, Math.min(1, (value - centres[k]!) / (centres[k + 1]! - centres[k]!)));
    level += fit.curves[f]![k]! + t * (fit.curves[f]![k + 1]! - fit.curves[f]![k]!);
  });
  return Math.max(0, Math.min(255, Math.round(level)));
}

// 1. The offset: red against F444W of 2022 on every 8th pixel, searched in pixels and then quarter pixels.
const redOnly = async (offset: readonly [number, number]) => { const { out, columns } = await sampled(2022, offset, 8); return fitChannel(0, ['F444W'], out, 8, columns).r2; };
let offset: [number, number] = [0, 0], best = await redOnly(offset);
for (const step of [1, 0.25]) for (let improved = true; improved;) {
  improved = false;
  for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]] as const) {
    const trial: [number, number] = [offset[0] + dx, offset[1] + dy], r2 = await redOnly(trial);
    if (r2 > best) { best = r2; offset = trial; improved = true; }
  }
}
console.log(`offset from the sky tags: ${offset[0]}, ${offset[1]} px of ${(scaleDeg * 3600).toFixed(4)} arcsec (red against F444W, R² ${best.toFixed(3)})`);

// 2. The curves, on every STEP-th pixel of the 2022 picture.
const sample = await sampled(2022, offset, STEP);
const fits = CHANNELS.map((filters, channel) => fitChannel(channel, filters, sample.out, STEP, sample.columns));
fits.forEach((fit, channel) => console.log(`${'RGB'[channel]} from ${CHANNELS[channel]!.join(' and ')}: R² ${fit.r2.toFixed(3)}`));

// 3. The 2025 picture, every pixel.
const now = await sampled(2025, offset, 1), rgb = Buffer.alloc(width * height * 3); let covered = 0;
for (let i = 0; i < width * height; i++) {
  const fluxes = (Object.keys(FILTERS) as Filter[]).map(filter => now.out[filter][i]!);
  if (!fluxes.every(Number.isFinite)) continue; covered++;
  fits.forEach((fit, channel) => { rgb[i * 3 + channel] = levelOf(fit, CHANNELS[channel]!.map(filter => now.out[filter][i]!)); });
}
await sharp(rgb, { raw: { width, height, channels: 3 } }).jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toFile(resolve(bank, 'source.jpg'));
console.log(`2025: ${(100 * covered / (width * height)).toFixed(1)}% of the picture's pixels hold all three filters; wrote source/source.jpg, ${width} x ${height}`);
