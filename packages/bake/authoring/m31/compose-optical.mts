import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
// Entry script: node packages/bake/authoring/m31/compose-optical.mts
/**
 * M31's optical image-layer input: the Local Group Galaxies Survey panorama (NOIRLab noao-m31lgs_ubvIha, ~1" seeing) wherever
 * it has data, and the ESA/Hubble DSS2 view (heic1112f, the tracked `source.jpg` crop) in the mosaic's notches and the outer
 * disc. Both are resampled into one gnomonic frame along M31's major axis. The DSS light is mapped onto the survey's by
 * per-channel histogram matching over the pixels both cover, and the two are faded together inside the mosaic's edge.
 *
 * Inputs: `source/lggs-panorama.jpg` (the publisher Large JPEG, restored from its origin) and `source/source.jpg`.
 * Output: `source/optical-composite.jpg`, the recipe's `source.path`, and `evidence/2026-09-29/optical-composite.json`, what was measured.
 */
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseImageLayerRecipe, imageLayerView } from '@cssearth/bake/image-layers';

const sourceDirectory = resolve(checkoutProjectRoot(import.meta.url), 'src/objects/m31-layers/source');
const recipe = JSON.parse(await readFile(resolve(sourceDirectory, 'recipe.json'), 'utf8'));
const composition = recipe.composition as {
  frame: { centerRaDeg: number; centerDecDeg: number; fieldOfViewDeg: [number, number]; northClockwiseDeg: number; arcsecPerPixel: number };
  survey: { path: string; dimensions: [number, number]; observation: { centerRaDeg: number; centerDecDeg: number; fieldOfViewDeg: [number, number]; northClockwiseDeg: number } };
  fill: { path: string; dimensions: [number, number]; originalDimensions: [number, number]; parentPixelWindow: [number, number, number, number];
    observation: { centerRaDeg: number; centerDecDeg: number; fieldOfViewDeg: [number, number]; northClockwiseDeg: number } };
  featherArcsec: number; noDataLevel: number };
if (!composition) throw new TypeError('src/objects/m31-layers/source/recipe.json has no "composition" block.');
sharp.cache(false);
const { frame, survey, fill } = composition;
const width = Math.round(frame.fieldOfViewDeg[0] * 3600 / frame.arcsecPerPixel), height = Math.round(frame.fieldOfViewDeg[1] * 3600 / frame.arcsecPerPixel);
// Each input as the image-layer bake reads it, with its own projection.
const input = (source: Record<string, unknown>, observation: typeof frame | typeof survey.observation) => parseImageLayerRecipe({ ...recipe,
  source: { ...recipe.source, ...source, foregroundStars: undefined, companions: undefined }, observation: { centerRaDeg: observation.centerRaDeg,
    centerDecDeg: observation.centerDecDeg, fieldOfViewDeg: observation.fieldOfViewDeg, northClockwiseDeg: observation.northClockwiseDeg } });
const out = imageLayerView(input({ path: 'optical-composite.jpg', dimensions: [width, height], originalDimensions: [width, height], parentPixelWindow: undefined }, frame));
const surveyView = imageLayerView(input({ path: survey.path, dimensions: survey.dimensions, originalDimensions: survey.dimensions, parentPixelWindow: undefined }, survey.observation));
const fillView = imageLayerView(input({ path: fill.path, dimensions: fill.dimensions, originalDimensions: fill.originalDimensions, parentPixelWindow: fill.parentPixelWindow }, fill.observation));

// The survey resampled to the output scale before sampling, so each output pixel averages the pixels it covers.
const surveyScale = survey.observation.fieldOfViewDeg[0] * 3600 / frame.arcsecPerPixel / survey.dimensions[0];
const surveyImage = await sharp(resolve(sourceDirectory, survey.path), { limitInputPixels: false })
  .resize({ width: Math.round(survey.dimensions[0] * surveyScale) }).removeAlpha().toColorspace('srgb').raw().toBuffer({ resolveWithObject: true });
const fillImage = await sharp(resolve(sourceDirectory, fill.path)).removeAlpha().toColorspace('srgb').raw().toBuffer({ resolveWithObject: true });

// The mosaic's no-data area: pixels at or below the no-data level joined to its border.
const { data: sd, info: si } = surveyImage, noData = new Uint8Array(si.width * si.height), stack: number[] = [];
const dark = (p: number) => sd[3 * p]! + sd[3 * p + 1]! + sd[3 * p + 2]! <= 3 * composition.noDataLevel;
for (let x = 0; x < si.width; x++) stack.push(x, (si.height - 1) * si.width + x);
for (let y = 0; y < si.height; y++) stack.push(y * si.width, y * si.width + si.width - 1);
while (stack.length) {
  const p = stack.pop()!; if (noData[p] || !dark(p)) continue; noData[p] = 1;
  const x = p % si.width, y = (p / si.width) | 0;
  if (x > 0) stack.push(p - 1); if (x < si.width - 1) stack.push(p + 1); if (y > 0) stack.push(p - si.width); if (y < si.height - 1) stack.push(p + si.width);
}
// Distance inside the data to the nearest no-data pixel (two-pass chamfer, pixels), for the fade.
const distance = new Float32Array(si.width * si.height).fill(1e9);
for (let p = 0; p < noData.length; p++) if (noData[p]) distance[p] = 0;
const pass = (forward: boolean) => {
  for (let k = 0; k < si.width * si.height; k++) {
    const p = forward ? k : si.width * si.height - 1 - k, x = p % si.width, y = (p / si.width) | 0, s = forward ? -1 : 1;
    for (const [dx, dy, cost] of [[s, 0, 1], [0, s, 1], [s, s, Math.SQRT2], [-s, s, Math.SQRT2]] as const) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= si.width || ny >= si.height) continue;
      distance[p] = Math.min(distance[p]!, distance[ny * si.width + nx]! + cost);
    }
  }
};
pass(true); pass(false);

const bilinear = (data: Buffer, w: number, h: number, x: number, y: number, out3: number[]) => {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  if (x0 < 0 || y0 < 0 || x0 + 1 >= w || y0 + 1 >= h) return false;
  for (let c = 0; c < 3; c++) out3[c] = (data[3 * (y0 * w + x0) + c]! * (1 - fx) + data[3 * (y0 * w + x0 + 1) + c]! * fx) * (1 - fy)
    + (data[3 * ((y0 + 1) * w + x0) + c]! * (1 - fx) + data[3 * ((y0 + 1) * w + x0 + 1) + c]! * fx) * fy;
  return true;
};
const at = (view: ReturnType<typeof imageLayerView>, w: number, h: number, u: number, v: number) => {
  const ray = out.ray(u, v), ra = (Math.atan2(ray[1], ray[0]) * 180 / Math.PI + 360) % 360, dec = Math.asin(ray[2]) * 180 / Math.PI, crop = view.crop(ra, dec);
  return crop ? [(crop[0] + 1) / 2 * w - 0.5, (1 - crop[1]) / 2 * h - 0.5] as const : null;
};
const feather = composition.featherArcsec / frame.arcsecPerPixel;
const surveyRgb = new Float32Array(width * height * 3), fillRgb = new Float32Array(width * height * 3), weight = new Float32Array(width * height), fillValid = new Uint8Array(width * height);
const sample = [0, 0, 0];
for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
  const u = 2 * (px + 0.5) / width - 1, v = 1 - 2 * (py + 0.5) / height, p = py * width + px;
  const s = at(surveyView, si.width, si.height, u, v);
  if (s && bilinear(sd, si.width, si.height, s[0], s[1], sample)) {
    const d = distance[Math.round(s[1]) * si.width + Math.round(s[0])]!, t = Math.min(1, d / feather);
    weight[p] = t * t * (3 - 2 * t); for (let c = 0; c < 3; c++) surveyRgb[3 * p + c] = sample[c]!;
  }
  const f = at(fillView, fillImage.info.width, fillImage.info.height, u, v);
  if (f && bilinear(fillImage.data, fillImage.info.width, fillImage.info.height, f[0], f[1], sample)) { fillValid[p] = 1; for (let c = 0; c < 3; c++) fillRgb[3 * p + c] = sample[c]!; }
}
// Per-channel histogram matching of the fill onto the survey, over pixels both cover fully.
const lookup: number[][] = [];
for (let c = 0; c < 3; c++) {
  const a: number[] = [], b: number[] = [];
  for (let p = 0; p < width * height; p++) if (weight[p] === 1 && fillValid[p]) { a.push(fillRgb[3 * p + c]!); b.push(surveyRgb[3 * p + c]!); }
  a.sort((x, y) => x - y); b.sort((x, y) => x - y);
  lookup.push(Array.from({ length: 256 }, (_, value) => {
    let lo = 0, hi = a.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (a[mid]! < value) lo = mid + 1; else hi = mid; }
    return b[Math.min(b.length - 1, Math.round(lo / a.length * (b.length - 1)))]!;
  }));
}
const mapped = (value: number, c: number) => { const i = Math.min(254, Math.floor(value)), t = value - i; return lookup[c]![i]! * (1 - t) + lookup[c]![i + 1]! * t; };
const rgb = Buffer.alloc(width * height * 3);
let fromSurvey = 0, fromFill = 0;
for (let p = 0; p < width * height; p++) {
  const w = weight[p]!, f = fillValid[p] ? 1 - w : 0;
  if (w > 0.5) fromSurvey++; else if (fillValid[p]) fromFill++;
  for (let c = 0; c < 3; c++) rgb[3 * p + c] = Math.round(Math.max(0, Math.min(255, w * surveyRgb[3 * p + c]! + f * mapped(fillRgb[3 * p + c]!, c))));
}
await sharp(rgb, { raw: { width, height, channels: 3 } }).jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toFile(resolve(sourceDirectory, 'optical-composite.jpg'));
const report = { schema: 'cssearth-m31-optical-composite@1', dimensions: [width, height], arcsecPerPixel: frame.arcsecPerPixel,
  pixels: { survey: fromSurvey, fill: fromFill, total: width * height }, featherArcsec: composition.featherArcsec,
  histogramMatch: lookup.map((table, c) => ({ channel: 'rgb'[c], at: [0, 16, 32, 64, 128, 192, 255].map(v => [v, Math.round(table[v]!)]) })) };
await writeFile(resolve(sourceDirectory, '../evidence/2026-09-29/optical-composite.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`Composed ${width}x${height}: ${fromSurvey} survey pixels, ${fromFill} fill pixels.`);
