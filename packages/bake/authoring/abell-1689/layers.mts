// Entry script: node packages/bake/authoring/abell-1689/layers.mts [bank id, abell-1689-chandra-layers if none]
/**
 * Abell 1689's mass map as a picture of its own on the 2008 frame.
 *
 * ESA/Hubble published the lensing mass map released with Jullo et al. (2010) laid over a Hubble picture (heic1014a,
 * 3853 by 3902 px). The Chandra X-ray Center's 2008 album has the Hubble layer alone (`a1689_opt.tif`, 3853 by 4000 px) on the frame
 * its X-ray layer shares. Measured here:
 *
 * - Where the composite lies on the 2008 frame: the shift at which the most of its bright compact light falls on the
 *   Hubble layer's.
 * - How the composite renders the Hubble light, which is not the 2008 layer's rendering: in the frame's corners, where
 *   it holds no mass map, the median of its value at each value of the 2008 layer, by channel.
 *
 * The map is blue and the galaxies are yellow, so it is read in the blue channel, where the Hubble light adds least:
 * the screen undone against the rendered Hubble blue, 1 - (1 - composite) / (1 - rendered), where that blue is under
 * `LIMIT`. By cells of `CELL` px the map is the median of those pixels; a cell without enough of them takes the mean of
 * the cells around it, over a width that grows until enough are in reach. The map's red and green are its own at each
 * blue, read where all three rendered Hubble channels are under `LIMIT`.
 *
 * Compact blue light stands at the bright galaxies: the map's own small halos, or galaxy light the measured rendering
 * leaves over. The composite is too bright to read at a galaxy's middle, so each comes out as a ring, and the cluster's
 * shells could not hold it either way. The map is opened by a disc of `OPEN` cells (least within the disc, then
 * most): light narrower than the disc comes down to the light around it, and the wide mass stays.
 * The opened map is smoothed over a quarter of the disc's radius.
 *
 * Input, beside the bank's recipe: `a1689_opt.tif` and `heic1014a.tif`. Output: `mass.png`, and printed, the shift, how
 * much was read and filled, and how far the Hubble rendering and the lifted map, screened back together, are from the composite.
 */
import { resolve } from 'node:path';
import sharp from 'sharp';

/** The rendered Hubble light, of 255, from which a pixel holds no reading of the map. */
const LIMIT = 30;
/** The map is read by cells of this many pixels (0.2 arcsec); a cell needs this many readings of its 16. */
const CELL = 4, ENOUGH = 4;
/** Widths, in cells, of the neighbourhoods a cell without readings is filled from, and the share of read cells that is enough. */
const WIDTHS = [1, 2, 5, 12, 30], SHARE = .25;
/** The radius, in cells, of the disc the map is opened by: 4 arcsec at the frame's measured 0.05 arcsec a pixel. */
const OPEN = 20;
/** The corners hold no mass map beyond this share of the frame's half diagonal. */
const CORNER = .85;

const source = resolve(import.meta.dirname, '../../../../src/objects', process.argv[2] ?? 'abell-1689-chandra-layers', 'source');
const read = async (name: string) => { const { data, info } = await sharp(resolve(source, name), { limitInputPixels: false }).toColorspace('srgb').removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, width: info.width, height: info.height }; };
const hubble = await read('a1689_opt.tif'), composite = await read('heic1014a.tif'), W = composite.width, H = composite.height;
if (W !== hubble.width || H > hubble.height) throw new TypeError(`heic1014a.tif is ${W} by ${H} px and a1689_opt.tif ${hubble.width} by ${hubble.height}: the composite is the 2008 frame less some rows.`);

// The shift: bright compact light of the composite on the Hubble layer's.
const lit = (image: typeof hubble, least: number) => { const mask = new Uint8Array(image.width * image.height); for (let p = 0; p < mask.length; p++) mask[p] = Math.min(image.data[3 * p]!, image.data[3 * p + 1]!) > least ? 1 : 0; return mask; };
const stars = lit(hubble, 150), compact = lit(composite, 120), places: number[] = [];
for (let y = 60; y < H - 60; y++) for (let x = 60; x < W - 60; x++) if (compact[y * W + x]) places.push(y * W + x);
let shift = { dx: 0, dy: 0, share: 0 };
for (let dy = 0; dy <= hubble.height - H; dy++) for (let dx = -8; dx <= 8; dx++) { let hit = 0, tried = 0; for (let i = 0; i < places.length; i += 7) { const p = places[i]!; hit += stars[(Math.floor(p / W) + dy) * hubble.width + p % W + dx]!; tried++; } if (hit / tried > shift.share) shift = { dx, dy, share: hit / tried }; }
const from = Math.max(0, -shift.dx), at = (x: number, y: number) => 3 * ((y + shift.dy) * hubble.width + x + shift.dx);

// The composite's rendering of the Hubble light, by channel: medians in the corners, made to rise.
const medians = (lists: number[][], reach: number, least: number) => { const curve = new Float32Array(256); let last = 0;
  for (let value = 0; value < 256; value++) { const pool: number[] = []; for (let k = Math.max(0, value - reach); k <= Math.min(255, value + reach); k++) for (const reading of lists[k]!) pool.push(reading); pool.sort((a, b) => a - b); if (pool.length >= least) last = Math.max(last, pool[pool.length >> 1]!); curve[value] = last; }
  return curve; };
const rendered = [0, 1, 2].map(c => { const lists: number[][] = Array.from({ length: 256 }, () => []);
  for (let y = 0; y < H; y += 2) for (let x = from + 1; x < W; x += 2) if (Math.hypot(x - W / 2, y - H / 2) / Math.hypot(W / 2, H / 2) > CORNER) lists[hubble.data[at(x, y) + c]!]!.push(composite.data[3 * (y * W + x) + c]!);
  return medians(lists, 3, 20); });
const unscreen = (value: number, under: number) => Math.min(1, Math.max(0, 1 - (1 - value / 255) / (1 - under / 255)));

// Blue by cells, and the map's red and green at each blue.
const w = Math.floor(W / CELL), h = Math.floor(H / CELL), blue = new Float32Array(w * h), known = new Uint8Array(w * h), colors: number[][][] = Array.from({ length: 256 }, () => [[], []]); let readPixels = 0, knownCells = 0;
for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const pool: number[] = [];
  for (let y = j * CELL; y < (j + 1) * CELL; y++) for (let x = Math.max(from, i * CELL); x < (i + 1) * CELL; x++) { const p = 3 * (y * W + x), o = at(x, y), under = [0, 1, 2].map(c => rendered[c]![hubble.data[o + c]!]!); if (under[2]! >= LIMIT) continue;
    const value = unscreen(composite.data[p + 2]!, under[2]!); pool.push(value); readPixels++;
    if (Math.max(...under) < LIMIT && (x + 2 * y) % 7 === 0) { const bin = colors[Math.round(255 * value)]!; bin[0]!.push(unscreen(composite.data[p]!, under[0]!)); bin[1]!.push(unscreen(composite.data[p + 1]!, under[1]!)); } }
  if (pool.length >= ENOUGH) { pool.sort((a, b) => a - b); blue[j * w + i] = pool[pool.length >> 1]!; known[j * w + i] = 1; knownCells++; } }
const table = (values: ArrayLike<number>) => { const sums = new Float64Array((w + 1) * (h + 1)); for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += values[y * w + x]!; sums[(y + 1) * (w + 1) + x + 1] = sums[y * (w + 1) + x + 1]! + row; } } return sums; };
const box = (sums: Float64Array, x: number, y: number, reach: number) => { const x0 = Math.max(0, x - reach), x1 = Math.min(w, x + reach + 1), y0 = Math.max(0, y - reach), y1 = Math.min(h, y + reach + 1); return [sums[y1 * (w + 1) + x1]! - sums[y0 * (w + 1) + x1]! - sums[y1 * (w + 1) + x0]! + sums[y0 * (w + 1) + x0]!, (x1 - x0) * (y1 - y0)] as const; };
const cover = table(known), around = table(blue), filled = new Array<number>(WIDTHS.length).fill(0);
const whole = Float32Array.from(blue);
for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { if (known[j * w + i]) continue;
  for (let k = 0; k < WIDTHS.length; k++) { const [readings, area] = box(cover, i, j, WIDTHS[k]!); if (readings >= SHARE * area || k === WIDTHS.length - 1) { whole[j * w + i] = readings > 0 ? box(around, i, j, WIDTHS[k]!)[0] / readings : 0; filled[k]!++; break; } } }
// The opening: by rows of the disc, the least within it and then the most of those.
const spans = Array.from({ length: 2 * OPEN + 1 }, (_, k) => Math.floor(Math.sqrt(OPEN ** 2 - (k - OPEN) ** 2)));
const over = (values: Float32Array, pick: (a: number, b: number) => number, start: number) => { const out = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { let value = start; for (let k = 0; k <= 2 * OPEN; k++) { const y = j + k - OPEN; if (y < 0 || y >= h) continue; const row = y * w, x1 = Math.min(w - 1, i + spans[k]!); for (let x = Math.max(0, i - spans[k]!); x <= x1; x++) value = pick(value, values[row + x]!); } out[j * w + i] = value; }
  return out; };
const opened = over(over(whole, Math.min, 1), Math.max, 0); let taken = 0, all = 0; for (let p = 0; p < w * h; p++) { taken += whole[p]! - opened[p]!; all += whole[p]!; }
const ramp = [0, 1].map(c => medians(colors.map(bin => bin[c]!.map(value => 255 * value)), 2, 30));

// The cells' picture, enlarged smoothly and set at the composite's place on the 2008 frame.
const small = Buffer.alloc(3 * w * h); for (let p = 0; p < w * h; p++) { const value = Math.round(255 * opened[p]!); small[3 * p] = Math.round(ramp[0]![value]!); small[3 * p + 1] = Math.round(ramp[1]![value]!); small[3 * p + 2] = value; }
const large = await sharp(small, { raw: { width: w, height: h, channels: 3 } }).blur(OPEN / 4).resize({ width: w * CELL, height: h * CELL, kernel: 'cubic' }).raw().toBuffer(), mass = Buffer.alloc(3 * hubble.width * hubble.height);
let apart = 0, compared = 0;
for (let y = 0; y < h * CELL; y++) for (let x = from; x < w * CELL; x++) { const o = at(x, y), p = 3 * (y * w * CELL + x);
  for (let c = 0; c < 3; c++) { mass[o + c] = large[p + c]!; apart += Math.abs(255 * (1 - (1 - large[p + c]! / 255) * (1 - rendered[c]![hubble.data[o + c]!]! / 255)) - composite.data[3 * (y * W + x) + c]!); compared++; } }
await sharp(mass, { raw: { width: hubble.width, height: hubble.height, channels: 3 } }).png({ compressionLevel: 9 }).toFile(resolve(source, 'mass.png'));
console.log(`mass.png: ${hubble.width} by ${hubble.height} px. The composite lies ${shift.dx}, ${shift.dy} px from the 2008 frame's corner (${(100 * shift.share).toFixed(1)}% of its bright compact light on the Hubble layer's).`);
console.log(`Read in blue: ${(100 * readPixels / (W * H)).toFixed(1)}% of the pixels, ${(100 * knownCells / (w * h)).toFixed(1)}% of the cells; filled from around, by width in cells: ${WIDTHS.map((width, k) => `${width}: ${filled[k]}`).join(', ')}.`);
console.log(`Opened by a disc of ${OPEN} cells: ${(100 * taken / all).toFixed(1)}% of the map's blue was narrower than the disc and came down.`);
console.log(`The Hubble rendering and the lifted map, screened back together, are ${(apart / compared).toFixed(1)} of 255 from the composite on average.`);
