import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { readObservations, type Matrix, type Observations } from '../../alignment/observations-ui/model';
import { invertAffine, applyAffine } from '../../alignment/observations/registration';
import { jointRecord } from '../joint-fit/model';
import { tangentOffsetWestNorth } from '../joint-fit/input';
import { readGeometryPin } from '../geometry/registered-source';
import type { SkyBounds } from './field-types';
import type { CompilerRequest } from './model';
export interface CompilerRaster { width: number; height: number; data: Uint8Array; path: string; sha256: string }
export interface CompilerImage { id: string; label: string; credit: string; page: string; matrix: Matrix;
  nativeWidth: number; nativeHeight: number; original: CompilerRaster; diffuse: CompilerRaster; stars: CompilerRaster;
  sampleRgb(x: number, y: number, out: [number, number, number]): boolean;
  sampleOriginal(x: number, y: number, out: [number, number, number]): boolean;
  sampleLowRgb?(x: number, y: number, out: [number, number, number]): boolean;
  sampleLowOriginal?(x: number, y: number, out: [number, number, number]): boolean;
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
export async function loadCompilerImages(root: string, path: string, request: CompilerRequest, center: [number, number], native = false, lowFrequencyArcsec?: number) {
  if (lowFrequencyArcsec !== undefined && (!native || !Number.isFinite(lowFrequencyArcsec) || lowFrequencyArcsec < 1 || lowFrequencyArcsec > 3600))
    throw new TypeError('Low-frequency optical sampling requires a bounded native angular scale.');
  const raw: unknown = JSON.parse(await readFile(resolve(root, path), 'utf8')), observations = readObservations(raw);
  if (!jointRecord(raw) || !Array.isArray(raw.images)) throw new TypeError('Missing observation layers.');
  const offset = tangentOffsetWestNorth(observations.frame.centerIcrsDegrees, center), f = observations.frame;
  const images: CompilerImage[] = [];
  for (const image of observations.images) {
    const row = raw.images.find((r: unknown) => jointRecord(r) && r.id === image.id);
    if (!jointRecord(row) || !jointRecord(row.layers)) throw new TypeError('Missing source pixels.');
    let layers: Record<string, unknown> = row.layers;
    if (native) {
      const removal = row.removal, source = row.source;
      if (!jointRecord(source) || !jointRecord(removal) || !jointRecord(removal.settings) || typeof removal.settings.directory !== 'string' ||
          typeof removal.receiptSha256 !== 'string' || image.registration.status === 'publisher') throw new TypeError('Native composite requires verified registration and completed NOX.');
      const directory = removal.settings.directory;
      const receipt: unknown = JSON.parse((await readGeometryPin(root, { path: `${directory}/result.json`, sha256: removal.receiptSha256 })).toString());
      if (!jointRecord(receipt) || receipt.schema !== 'cssearth-nox-output@1' || receipt.sourceSha256 !== removal.sourceSha256 ||
          !jointRecord(receipt.artifactSha256) || !jointRecord(receipt.applied) || !jointRecord(receipt.applied.verification) ||
          receipt.applied.verification.coverageComplete !== true || receipt.applied.verification.maximumReconstructionErrorCodeValues !== 0)
        throw new TypeError('Native composite NOX accounting is incomplete.');
      const dimensions = { width: image.source.width, height: image.source.height };
      if (JSON.stringify(receipt.nativeDimensions) !== JSON.stringify([dimensions.width, dimensions.height]) ||
          receipt.artifactSha256['diffuse.png'] !== removal.diffuseSha256 || receipt.artifactSha256['stars.png'] !== removal.residualSha256)
        throw new TypeError('Native composite source grid or separation pins differ.');
      layers = { original: { ...dimensions, path: source.path, sha256: source.sha256 },
        diffuse: { ...dimensions, path: `${directory}/diffuse.png`, sha256: removal.diffuseSha256 },
        stars: { ...dimensions, path: `${directory}/stars.png`, sha256: removal.residualSha256 } };
    }
    const [original, diffuse, stars] = await Promise.all(['original', 'diffuse', 'stars'].map(name => raster(root, layers[name])));
    const matrix = request.imageToFrame[image.id] ?? image.imageToFrame, inverse = invertAffine(matrix);
    const sample = (layer: CompilerRaster) => (x: number, y: number, out: [number, number, number]) => {
      const frame: [number, number] = [f.width / 2 + (x - offset[0]) * f.width / (f.fieldArcminutes[0] * 60), f.height / 2 - (y - offset[1]) * f.height / (f.fieldArcminutes[1] * 60)];
      const native = applyAffine(inverse, frame);
      return sampleRaster(layer, native[0] * layer.width / image.source.width, native[1] * layer.height / image.source.height, out);
    };
    const pixelArcsec = Math.sqrt(Math.abs(matrix[0] * matrix[3] - matrix[1] * matrix[2]) * f.fieldArcminutes[0] * 60 / f.width * f.fieldArcminutes[1] * 60 / f.height);
    const low = async (layer: CompilerRaster) => ({ ...layer, data: await sharp(layer.data, { raw: { width: layer.width, height: layer.height, channels: 3 } })
      .blur(Math.max(.3, Math.min(1000, lowFrequencyArcsec! / pixelArcsec))).raw().toBuffer() });
    const lowLayers = lowFrequencyArcsec === undefined ? undefined : await Promise.all([low(diffuse!), low(original!)]);
    images.push({ id: image.id, label: image.label, credit: image.source.credit, page: image.source.page, matrix,
      nativeWidth: image.source.width, nativeHeight: image.source.height, original: original!, diffuse: diffuse!, stars: stars!,
      sampleRgb: sample(diffuse!), sampleOriginal: sample(original!),
      ...(lowLayers ? { sampleLowRgb: sample(lowLayers[0]!), sampleLowOriginal: sample(lowLayers[1]!) } : {}), pixelToSky(x, y) {
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
export { compilerTarget } from './target';
export async function compilerImagePanel(image: CompilerImage, bounds: SkyBounds, original: boolean, width = 768) {
  const height = Math.max(1, Math.round(width * (bounds.max[1] - bounds.min[1]) / (bounds.max[0] - bounds.min[0]))), rgba = Buffer.alloc(width * height * 4), rgb: [number, number, number] = [0, 0, 0];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const west = bounds.min[0] + (x + .5) / width * (bounds.max[0] - bounds.min[0]), north = bounds.max[1] - (y + .5) / height * (bounds.max[1] - bounds.min[1]);
    if (!(original ? image.sampleOriginal : image.sampleRgb)(west, north, rgb)) continue;
    const at = (y * width + x) * 4; for (let c = 0; c < 3; c++) rgba[at + c] = Math.round(rgb[c]!); rgba[at + 3] = 255;
  }
  return { width, height, bytes: await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer() };
}
