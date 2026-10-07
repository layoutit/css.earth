// Entry script: node packages/bake/authoring/helix/register-eso.mts <bank>
/**
 * One of ESO's three photographs of the Helix Nebula, laid on the frame of the Hubble photograph the rings bank shows,
 * so every dataset of the nebula covers the same sky with the same pixels and the same bake places it on the same rings.
 *
 * ESO publishes each photograph with its sky tags (AVM: a gnomonic projection, its reference pixel, scale and rotation).
 * The tags are good to about 2 arcsec, so the photograph is matched against Gaia DR3: each star of the rings bank's
 * table brighter than G = 19 is looked for where the tags put it, its light-weighted centre measured, and a cubic in
 * the image's pixels fitted from where the tags put the stars to where the picture shows them, rejecting the stars
 * more than three times the median miss from it. The cubic is what ESO's wider field needs: the mosaic bends by about
 * 2 arcsec across its frame, which an affine fit leaves. The fit must hold at least MIN_STARS stars and miss them by
 * less than MAX_RMS_ARCSEC, or nothing is written.
 *
 * Every pixel of the rings frame (the recipe's observation and source dimensions) is then a sight line; the tags and
 * the fit give its place in the photograph, and the photograph's light there, interpolated between its four nearest
 * pixels, is the frame's. Where the photograph has no light the frame is black.
 *
 * Input: `source/original.tif` (the publisher's original, untouched), the recipe (`source/recipe.json`) and its star
 * table. Output: the recipe's `source.path`, a JPEG at quality 95; the fit is printed.
 */
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { imageLayerView, parseImageLayerRecipe } from '@cssearth/bake/image-layers';

const BANKS = ['helix-wfi-layers', 'helix-vista-layers', 'helix-wide-layers'];
/** Stars fainter than this rarely show in the three photographs; brighter ones are saturated but keep their centres. */
const FAINTEST_G = 19;
/** A star is looked for within this many arcsec of where the tags put it, then centred again within the second. */
const SEARCH_ARCSEC = 4, CENTRE_ARCSEC = 1.5;
/** A star's peak must stand this many levels above the window's 20th percentile. */
const PEAK_LEVELS = 20;
const MIN_STARS = 100, MAX_RMS_ARCSEC = 0.8, ORDER = 3, ROUNDS = 4, OUTPUT_QUALITY = 95;

const bank = process.argv[2] ?? '';
if (!BANKS.includes(bank) || process.argv[3]) throw new TypeError(`Usage: register-eso.mts <${BANKS.join('|')}>`);
const sourceDirectory = resolve(checkoutProjectRoot(import.meta.url), 'src/objects', bank, 'source');
const recipe = parseImageLayerRecipe(JSON.parse(await readFile(resolve(sourceDirectory, 'recipe.json'), 'utf8')) as unknown);
const originalPath = resolve(sourceDirectory, 'original.tif');
const original = sharp(originalPath, { limitInputPixels: false }), metadata = await original.metadata();
const { data: rgb, info } = await original.removeAlpha().toColorspace('srgb').raw().toBuffer({ resolveWithObject: true });
const width = info.width, height = info.height, rad = Math.PI / 180;

// The AVM tags, read from the file's XMP packet.
const xmp = metadata.xmp?.toString('utf8') ?? '';
const tag = (name: string): number[] => {
  const element = new RegExp(`<avm:Spatial\\.${name}>([\\s\\S]*?)</avm:Spatial\\.${name}>`, 'u').exec(xmp)?.[1];
  const text = element ?? new RegExp(`avm:Spatial\\.${name}="([^"]*)"`, 'u').exec(xmp)?.[1];
  const values = (text ?? '').replace(/<[^>]+>/gu, ' ').trim().split(/\s+/u).filter(Boolean).map(Number);
  if (!values.length || values.some(value => !Number.isFinite(value))) throw new TypeError(`${bank}: original.tif has no AVM Spatial.${name}.`);
  return values;
};
for (const [name, expected] of [['CoordinateFrame', 'ICRS'], ['CoordsystemProjection', 'TAN']] as const) {
  if (!new RegExp(`Spatial\\.${name}(?:>|=")\\s*${expected}`, 'u').test(xmp)) throw new TypeError(`${bank}: original.tif is not tagged ${name} ${expected}.`);
}
const [refRa, refDec] = tag('ReferenceValue') as [number, number], [refWidth, refHeight] = tag('ReferenceDimension') as [number, number];
const [refX, refY] = tag('ReferencePixel') as [number, number], [scaleX, scaleY] = tag('Scale') as [number, number], [rotation] = tag('Rotation') as [number];
// The tags may describe a smaller copy of the picture; FITS pixel centres are at whole numbers from 1, y up.
const sx = width / refWidth, sy = height / refHeight;
const crpix = [(refX - 0.5) * sx + 0.5, (refY - 0.5) * sy + 0.5] as const, cdelt = [scaleX / sx, scaleY / sy] as const;
const cr = Math.cos(rotation * rad), sr = Math.sin(rotation * rad);
const ra0 = refRa * rad, dec0 = refDec * rad;
/** Where the tags put a sky position, in pixels of the photograph (x right, y down, pixel centres at whole numbers from 0). */
const tagged = (raDeg: number, decDeg: number): [number, number] | null => {
  const ra = raDeg * rad, dec = decDeg * rad, dra = ra - ra0;
  const cosc = Math.sin(dec0) * Math.sin(dec) + Math.cos(dec0) * Math.cos(dec) * Math.cos(dra);
  if (!(cosc > 0)) return null;
  // Gnomonic standard coordinates, in degrees, then the inverse of FITS CROTA2 with CDELT.
  const xi = Math.cos(dec) * Math.sin(dra) / cosc / rad, eta = (Math.cos(dec0) * Math.sin(dec) - Math.sin(dec0) * Math.cos(dec) * Math.cos(dra)) / cosc / rad;
  const px = (xi * cr + eta * sr) / cdelt[0], py = (-xi * sr + eta * cr) / cdelt[1];
  return [crpix[0] + px - 1, height - (crpix[1] + py)];
};
const arcsecPerPixel = Math.abs(cdelt[0]) * 3600;

const luminance = new Float32Array(width * height);
for (let p = 0; p < width * height; p++) luminance[p] = 0.2126 * rgb[3 * p]! + 0.7152 * rgb[3 * p + 1]! + 0.0722 * rgb[3 * p + 2]!;
/** The light-weighted centre of the pixels above half the peak in a square window, or null when no star stands there. */
const centre = (x: number, y: number, reach: number): [number, number] | null => {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi - reach < 0 || yi - reach < 0 || xi + reach >= width || yi + reach >= height) return null;
  const values: number[] = [];
  for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) values.push(luminance[(yi + dy) * width + xi + dx]!);
  const floor = [...values].sort((a, b) => a - b)[Math.floor(0.2 * (values.length - 1))]!, peak = Math.max(...values) - floor;
  if (peak < PEAK_LEVELS) return null;
  let sum = 0, mx = 0, my = 0, i = 0;
  for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++, i++) {
    const w = Math.max(0, values[i]! - floor - 0.5 * peak); sum += w; mx += w * dx; my += w * dy;
  }
  return [xi + mx / sum, yi + my / sum];
};

const table = recipe.source.foregroundStars!, lines = (await readFile(resolve(sourceDirectory, table.path), 'utf8')).trim().split(/\r?\n/u), header = lines[0]!.split(',');
const [raColumn, decColumn, gColumn] = [table.raDegColumn, table.decDegColumn, table.gMagColumn].map(name => header.indexOf(name)) as [number, number, number];
const pairs: { at: [number, number]; seen: [number, number] }[] = [];
for (const line of lines.slice(1)) {
  const cells = line.split(','), ra = Number(cells[raColumn]), dec = Number(cells[decColumn]), g = Number(cells[gColumn]);
  if (!(g <= FAINTEST_G)) continue;
  const at = tagged(ra, dec);
  if (!at) continue;
  const first = centre(at[0], at[1], Math.max(4, Math.round(SEARCH_ARCSEC / arcsecPerPixel)));
  const seen = first && centre(first[0], first[1], Math.max(2, Math.round(CENTRE_ARCSEC / arcsecPerPixel)));
  if (seen) pairs.push({ at, seen });
}

// The cubic, in pixel coordinates scaled to the frame: x and y separately, by least squares.
const terms = (x: number, y: number): number[] => {
  const u = (x - width / 2) / width, v = (y - height / 2) / height, out: number[] = [];
  for (let i = 0; i <= ORDER; i++) for (let j = 0; j <= ORDER - i; j++) out.push(u ** i * v ** j);
  return out;
};
const solve = (rows: number[][], values: number[]): number[] => {
  const n = rows[0]!.length, a = Array.from({ length: n }, () => new Array<number>(n + 1).fill(0));
  rows.forEach((row, k) => { for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) a[i]![j]! += row[i]! * row[j]!; a[i]![n]! += row[i]! * values[k]!; } });
  for (let c = 0; c < n; c++) {
    let pivot = c; for (let r = c + 1; r < n; r++) if (Math.abs(a[r]![c]!) > Math.abs(a[pivot]![c]!)) pivot = r;
    [a[c], a[pivot]] = [a[pivot]!, a[c]!];
    for (let r = 0; r < n; r++) if (r !== c) { const f = a[r]![c]! / a[c]![c]!; for (let k = c; k <= n; k++) a[r]![k]! -= f * a[c]![k]!; }
  }
  return a.map((row, i) => row[n]! / row[i]!);
};
const median = (values: number[]) => { const s = [...values].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2; };
const missOf = (pair: (typeof pairs)[number]) => Math.hypot(pair.seen[0] - pair.at[0], pair.seen[1] - pair.at[1]) * arcsecPerPixel;
let kept = pairs.filter(pair => missOf(pair) < Math.max(3 * median(pairs.map(missOf)), 1));
let fitX: number[] = [], fitY: number[] = [], misses: number[] = [];
for (let round = 0; round < ROUNDS; round++) {
  if (kept.length < MIN_STARS) break;
  const rows = kept.map(pair => terms(...pair.at));
  fitX = solve(rows, kept.map(pair => pair.seen[0])); fitY = solve(rows, kept.map(pair => pair.seen[1]));
  const miss = pairs.map(pair => { const t = terms(...pair.at), x = t.reduce((s, v, i) => s + v * fitX[i]!, 0), y = t.reduce((s, v, i) => s + v * fitY[i]!, 0); return Math.hypot(x - pair.seen[0], y - pair.seen[1]) * arcsecPerPixel; });
  const limit = Math.max(3 * median(kept.map(pair => miss[pairs.indexOf(pair)]!)), 0.6);
  kept = pairs.filter((_, i) => miss[i]! < limit); misses = kept.map(pair => miss[pairs.indexOf(pair)]!);
}
const rms = Math.sqrt(misses.reduce((s, m) => s + m * m, 0) / Math.max(1, misses.length)), taggedRms = Math.sqrt(kept.reduce((s, p) => s + missOf(p) ** 2, 0) / Math.max(1, kept.length));
if (kept.length < MIN_STARS || !(rms < MAX_RMS_ARCSEC)) throw new RangeError(`${bank}: the photograph does not register against Gaia DR3 (${kept.length} stars, ${rms.toFixed(2)} arcsec); nothing written.`);

// Each pixel of the rings frame, through the tags and the fit, sampled from the photograph.
const [outWidth, outHeight] = recipe.source.dimensions, view = imageLayerView(recipe), out = Buffer.alloc(outWidth * outHeight * 3);
let covered = 0;
for (let py = 0; py < outHeight; py++) for (let px = 0; px < outWidth; px++) {
  const ray = view.ray(2 * (px + 0.5) / outWidth - 1, 1 - 2 * (py + 0.5) / outHeight);
  const at = tagged(Math.atan2(ray[1], ray[0]) / rad, Math.asin(ray[2]) / rad);
  if (!at) continue;
  const t = terms(...at), x = t.reduce((s, v, i) => s + v * fitX[i]!, 0), y = t.reduce((s, v, i) => s + v * fitY[i]!, 0);
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  if (x0 < 0 || y0 < 0 || x0 + 1 >= width || y0 + 1 >= height) continue;
  covered++;
  for (let c = 0; c < 3; c++) {
    const at00 = rgb[3 * (y0 * width + x0) + c]!, at10 = rgb[3 * (y0 * width + x0 + 1) + c]!, at01 = rgb[3 * ((y0 + 1) * width + x0) + c]!, at11 = rgb[3 * ((y0 + 1) * width + x0 + 1) + c]!;
    out[3 * (py * outWidth + px) + c] = Math.round((at00 * (1 - fx) + at10 * fx) * (1 - fy) + (at01 * (1 - fx) + at11 * fx) * fy);
  }
}
await sharp(out, { raw: { width: outWidth, height: outHeight, channels: 3 } }).jpeg({ quality: OUTPUT_QUALITY, chromaSubsampling: '4:4:4' }).toFile(resolve(sourceDirectory, recipe.source.path));
console.log(`${bank}: ${width} x ${height} px at ${arcsecPerPixel.toFixed(4)} arcsec; ${pairs.length} Gaia stars found, ${kept.length} kept; tags miss them by ${taggedRms.toFixed(2)} arcsec rms, the cubic by ${rms.toFixed(2)}.`);
console.log(`${bank}: wrote ${recipe.source.path}, ${outWidth} x ${outHeight} px; ${(100 * covered / (outWidth * outHeight)).toFixed(1)}% of the frame inside the photograph.`);
