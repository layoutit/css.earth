import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { readObservations, type Matrix, type Observations } from '../../alignment/observations-ui/model';
import { invertAffine, applyAffine } from '../../alignment/observations/registration';
import { jointRecord } from '../joint-fit/model';
import { tangentOffsetWestNorth } from '../joint-fit/input';
import { readGeometryPin } from '../geometry/registered-source';
import type { EvidenceInputs } from '../evidence-fusion/model';
import type { SkyBounds } from './field-types';
import type { CompilerRequest } from './model';
export interface CompilerRaster { width: number; height: number; data: Uint8Array; path: string; sha256: string }
export interface CompilerImage { id: string; label: string; credit: string; page: string; matrix: Matrix;
  nativeWidth: number; nativeHeight: number; original: CompilerRaster; diffuse: CompilerRaster; stars: CompilerRaster;
  sampleRgb(x: number, y: number, out: [number, number, number]): boolean;
  sampleOriginal(x: number, y: number, out: [number, number, number]): boolean;
  pixelToSky(x: number, y: number): [number, number] }
async function raster(root: string, v: unknown): Promise<CompilerRaster> {
  if (!jointRecord(v) || typeof v.path !== 'string' || typeof v.sha256 !== 'string' || typeof v.width !== 'number' || typeof v.height !== 'number') throw new TypeError('Missing pinned source layer.');
  const { data, info } = await sharp(await readGeometryPin(root, { path: v.path, sha256: v.sha256 })).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  if (info.width !== v.width || info.height !== v.height || info.channels !== 3) throw new TypeError('Source layer dimensions changed.');
  return { width: info.width, height: info.height, data, path: v.path, sha256: v.sha256 };
}
function sampleRaster(layer: CompilerRaster, x: number, y: number, out: [number, number, number]): boolean {
  if (x < 0 || y < 0 || x >= layer.width || y >= layer.height) return false;
  const px = Math.max(0, Math.min(layer.width - 1, x - .5)), py = Math.max(0, Math.min(layer.height - 1, y - .5));
  const x0 = Math.floor(px), y0 = Math.floor(py), x1 = Math.min(layer.width - 1, x0 + 1), y1 = Math.min(layer.height - 1, y0 + 1), u = px - x0, v = py - y0;
  for (let c = 0; c < 3; c++) {
    const a = layer.data[(y0 * layer.width + x0) * 3 + c]!, b = layer.data[(y0 * layer.width + x1) * 3 + c]!;
    const d = layer.data[(y1 * layer.width + x0) * 3 + c]!, e = layer.data[(y1 * layer.width + x1) * 3 + c]!;
    out[c] = (a + (b - a) * u) * (1 - v) + (d + (e - d) * u) * v;
  }
  return true;
}
export async function loadCompilerImages(root: string, path: string, request: CompilerRequest, center: [number, number]) {
  const raw: unknown = JSON.parse(await readFile(resolve(root, path), 'utf8')), observations = readObservations(raw);
  if (!jointRecord(raw) || !Array.isArray(raw.images)) throw new TypeError('Missing observation layers.');
  const offset = tangentOffsetWestNorth(observations.frame.centerIcrsDegrees, center), f = observations.frame;
  const images: CompilerImage[] = [];
  for (const image of observations.images) {
    const row = raw.images.find((r: unknown) => jointRecord(r) && r.id === image.id);
    if (!jointRecord(row) || !jointRecord(row.layers)) throw new TypeError('Missing source pixels.');
    const layers = row.layers;
    const [original, diffuse, stars] = await Promise.all(['original', 'diffuse', 'stars'].map(name => raster(root, layers[name])));
    const matrix = request.imageToFrame[image.id] ?? image.imageToFrame, inverse = invertAffine(matrix);
    const sample = (layer: CompilerRaster) => (x: number, y: number, out: [number, number, number]) => {
      const frame: [number, number] = [f.width / 2 + (x - offset[0]) * f.width / (f.fieldArcminutes[0] * 60), f.height / 2 - (y - offset[1]) * f.height / (f.fieldArcminutes[1] * 60)];
      const native = applyAffine(inverse, frame);
      return sampleRaster(layer, native[0] * layer.width / image.source.width, native[1] * layer.height / image.source.height, out);
    };
    images.push({ id: image.id, label: image.label, credit: image.source.credit, page: image.source.page, matrix,
      nativeWidth: image.source.width, nativeHeight: image.source.height, original: original!, diffuse: diffuse!, stars: stars!,
      sampleRgb: sample(diffuse!), sampleOriginal: sample(original!), pixelToSky(x, y) {
        const p = applyAffine(matrix, [x, y]); return [(p[0] - f.width / 2) * f.fieldArcminutes[0] * 60 / f.width + offset[0],
          (f.height / 2 - p[1]) * f.fieldArcminutes[1] * 60 / f.height + offset[1]];
      } });
  }
  const corners = images.flatMap(image => [[0, 0], [image.nativeWidth, 0], [image.nativeWidth, image.nativeHeight], [0, image.nativeHeight]]
    .map(([x, y]) => image.pixelToSky(x!, y!)));
  const inspectionBoundsArcsec: SkyBounds = { min: [Math.min(...corners.map(p => p[0])), Math.min(...corners.map(p => p[1]))],
    max: [Math.max(...corners.map(p => p[0])), Math.max(...corners.map(p => p[1]))] };
  return { observations, images, inspectionBoundsArcsec };
}
const quantile = (values: number[], q: number) => values[Math.min(values.length - 1, Math.floor(q * values.length))] ?? 0;
/** All observed footprints enter one positive display-emission target; source color is kept separately. */
export function compilerTarget(inputs: EvidenceInputs, weights: number[], centerOffset: [number, number] = [0, 0]) {
  const g = inputs.grid, width = Math.min(512, g.width), height = Math.max(1, Math.round(g.height * width / g.width));
  const target = new Float32Array(width * height), coverage = new Uint8Array(target.length);
  const normalization = inputs.sources.map(source => {
    const samples: number[] = [];
    for (let p = 0; p < source.footprint.length; p += 3) if (source.footprint[p]) samples.push((.2126 * source.registeredRgba[p * 4]! + .7152 * source.registeredRgba[p * 4 + 1]! + .0722 * source.registeredRgba[p * 4 + 2]!) / 255);
    samples.sort((a, b) => a - b); const black = quantile(samples, .25), lowerSpread = Math.max(.002, quantile(samples, .5) - black);
    return { background: black + lowerSpread * 1.5, white: quantile(samples, .995), observedPixels: samples.length * 3 };
  });
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let strongest = 0, sum = 0, total = 0;
    for (let s = 0; s < inputs.sources.length; s++) {
      const weight = weights[s] ?? 1; if (weight <= 0) continue;
      const source = inputs.sources[s]!, n = normalization[s]!; let value = 0, observed = 0;
      for (const dx of [.25, .75]) for (const dy of [.25, .75]) {
        const gx = Math.min(g.width - 1, Math.floor((x + dx) * g.width / width)), gy = Math.min(g.height - 1, Math.floor((y + dy) * g.height / height)), p = gy * g.width + gx;
        if (!source.footprint[p]) continue; observed++;
        const luminance = (.2126 * source.registeredRgba[p * 4]! + .7152 * source.registeredRgba[p * 4 + 1]! + .0722 * source.registeredRgba[p * 4 + 2]!) / 255;
        value += Math.pow(Math.max(0, Math.min(2, (luminance - n.background) / Math.max(.03, n.white - n.background))), .85);
      }
      if (!observed) continue; value = value / observed * weight; strongest = Math.max(strongest, value); sum += value; total += weight;
    }
    if (total > 0) { coverage[y * width + x] = 1; target[y * width + x] = .7 * strongest + .3 * sum / total; }
  }
  const x = (p: number) => (p - g.frameWidth / 2) * g.fieldArcminutes[0] * 60 / g.frameWidth + centerOffset[0];
  const y = (p: number) => (g.frameHeight / 2 - p) * g.fieldArcminutes[1] * 60 / g.frameHeight + centerOffset[1];
  const bounds: SkyBounds = { min: [x(g.originX), y(g.originY + g.extentHeight)], max: [x(g.originX + g.extentWidth), y(g.originY)] };
  return { target, coverage, width, height, bounds, normalization };
}
export async function compilerImagePanel(image: CompilerImage, bounds: SkyBounds, original: boolean, width = 768) {
  const height = Math.max(1, Math.round(width * (bounds.max[1] - bounds.min[1]) / (bounds.max[0] - bounds.min[0]))), rgba = Buffer.alloc(width * height * 4), rgb: [number, number, number] = [0, 0, 0];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const west = bounds.min[0] + (x + .5) / width * (bounds.max[0] - bounds.min[0]), north = bounds.max[1] - (y + .5) / height * (bounds.max[1] - bounds.min[1]);
    if (!(original ? image.sampleOriginal : image.sampleRgb)(west, north, rgb)) continue;
    const at = (y * width + x) * 4; for (let c = 0; c < 3; c++) rgba[at + c] = Math.round(rgb[c]!); rgba[at + 3] = 255;
  }
  return { width, height, bytes: await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer() };
}
