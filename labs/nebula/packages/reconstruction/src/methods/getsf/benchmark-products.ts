/** Offline inspection products. Display units are deliberately not called radiance or gas density. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import sharp from 'sharp';

export interface BenchmarkImage { rgb: Buffer; luminance: Float32Array; width: number; height: number }
export interface BenchmarkPanel { id: string; name: string; imagePath: string; description?: string }
export interface BenchmarkMethod {
  id: string; name: string; status: 'complete' | 'unavailable'; note?: string;
  panels: BenchmarkPanel[]; metrics?: Record<string, number | string>;
}
export type ComponentMaps = Record<'diffuse' | 'compact' | 'elongated' | 'residual', Float32Array>;
export const digest = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex');

export async function readBenchmarkImage(path: string, expectedHash: string, width: number, height: number): Promise<BenchmarkImage> {
  const bytes = await readFile(path);
  if (digest(bytes) !== expectedHash) throw new Error('Benchmark source pin differs.');
  const { data: rgb, info } = await sharp(bytes).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  if (info.width !== width || info.height !== height || info.channels !== 3) throw new Error('Benchmark source dimensions differ.');
  const luminance = new Float32Array(width * height);
  for (let p = 0; p < luminance.length; p++) luminance[p] =
    (.2126 * rgb[3 * p]! + .7152 * rgb[3 * p + 1]! + .0722 * rgb[3 * p + 2]!) / 255;
  return { rgb, luminance, width, height };
}

export function measureComponents(source: Float32Array, maps: ComponentMaps) {
  const reconstruction = new Float32Array(source.length);
  const totals = { diffuse: 0, compact: 0, elongated: 0, residual: 0 };
  let sourceTotal = 0, maxError = 0, absoluteError = 0, residualAbsolute = 0;
  const keys = Object.keys(maps) as (keyof ComponentMaps)[];
  if (keys.some(key => maps[key].length !== source.length)) throw new Error('Component dimensions differ.');
  for (let p = 0; p < source.length; p++) {
    let sum = 0;
    for (const key of keys) {
      const value = maps[key][p]!;
      if (!Number.isFinite(value) || (key !== 'residual' && value < 0)) throw new Error(`Invalid ${key} component.`);
      totals[key] += value; sum += value;
    }
    if (!Number.isFinite(source[p]) || source[p]! < 0) throw new Error('Invalid source signal.');
    sourceTotal += source[p]!; reconstruction[p] = sum;
    const error = Math.abs(sum - source[p]!);
    maxError = Math.max(maxError, error); absoluteError += error; residualAbsolute += Math.abs(maps.residual[p]!);
  }
  return { reconstruction, totals, sourceTotal, maxError, absoluteError, residualAbsolute };
}

/** Hue is inherited from the source. Positive signal over source black is shown neutrally. */
function colorize(image: BenchmarkImage, values: Float32Array) {
  const bytes = Buffer.alloc(image.rgb.length);
  let clippedPixels = 0, undefinedHuePixels = 0;
  for (let p = 0; p < values.length; p++) {
    const hasHue = image.luminance[p]! > 0;
    const scale = hasHue ? values[p]! / image.luminance[p]! : 0;
    if (!hasHue && values[p]! > 0) undefinedHuePixels++;
    let clipped = false;
    for (let c = 0; c < 3; c++) {
      const value = hasHue ? image.rgb[3 * p + c]! * scale : 255 * values[p]!;
      clipped ||= value < 0 || value > 255.0001;
      bytes[3 * p + c] = Math.round(Math.max(0, Math.min(255, value)));
    }
    if (clipped) clippedPixels++;
  }
  return { bytes, clippedPixels, undefinedHuePixels };
}

function residualPreview(values: Float32Array, range: number) {
  if (!(range > 0 && Number.isFinite(range))) throw new Error('Residual display range must be positive.');
  const bytes = Buffer.alloc(values.length * 3);
  let clippedPixels = 0;
  for (let p = 0; p < values.length; p++) {
    const ratio = values[p]! / range, amount = Math.min(1, Math.abs(ratio));
    if (Math.abs(ratio) > 1) clippedPixels++;
    const color = ratio < 0 ? [40, 130, 230] : [240, 125, 40];
    for (let c = 0; c < 3; c++) bytes[3 * p + c] = Math.round(128 * (1 - amount) + color[c]! * amount);
  }
  return { bytes, clippedPixels };
}

export async function writeMethodProducts(options: {
  id: string; name: string; note: string; image: BenchmarkImage; maps: ComponentMaps;
  outputDirectory: string; cacheDirectory: string; residualRange: number;
  overlay?: Buffer; metrics?: Record<string, number | string>;
}) {
  const { image, maps, id } = options, measured = measureComponents(image.luminance, maps);
  if (measured.maxError > 2e-6) throw new Error(`${id}: source reconstruction failed (${measured.maxError}).`);
  const directory = resolve(options.outputDirectory, id), cache = resolve(options.cacheDirectory, id);
  await Promise.all([mkdir(directory, { recursive: true }), mkdir(cache, { recursive: true })]);
  const panels: BenchmarkPanel[] = [], products: Record<string, { sha256: string; bytes: number }> = {};
  const names = { diffuse: 'Diffuse / background', compact: 'Compact structures', elongated: 'Filament candidates' };
  let componentPreviewClippedPixels = 0, undefinedHuePixels = 0;
  const writePanel = async (panelId: string, name: string, bytes: Buffer, description: string) => {
    const png = await sharp(bytes, { raw: { width: image.width, height: image.height, channels: 3 } }).png().toBuffer();
    const file = `${panelId}.png`;
    await writeFile(resolve(directory, file), png);
    products[file] = { sha256: digest(png), bytes: png.length };
    panels.push({ id: panelId, name, imagePath: `${id}/${file}`, description });
  };
  for (const key of ['diffuse', 'compact', 'elongated'] as const) {
    const result = colorize(image, maps[key]); componentPreviewClippedPixels += result.clippedPixels;
    undefinedHuePixels += result.undefinedHuePixels;
    await writePanel(key, names[key], result.bytes,
      'Same coordinates and gain; source hue inherited where defined. Positive signal over source black is neutral gray. Morphology does not establish physical membership.');
  }
  const residual = residualPreview(maps.residual, options.residualRange);
  await writePanel('residual', 'Signed residual', residual.bytes,
    `Zero = gray; positive = orange; negative = blue. Fixed range ±${options.residualRange} display luminance. ${residual.clippedPixels} preview pixels saturate; numerical residuals are retained.`);
  await writePanel('reconstruction', 'Reconstruction', colorize(image, measured.reconstruction).bytes,
    'Sum of all components plus signed residual. Agreement checks bookkeeping, not whether the structure separation is correct.');
  if (options.overlay) await writePanel('structures', 'Detected structure outlines', options.overlay,
    'Automatically detected support boundaries. Colors indicate morphology, not verified stars or gas.');
  const rawProducts: Record<string, { sha256: string; bytes: number }> = {};
  for (const [key, values] of Object.entries(maps)) {
    const data = Buffer.alloc(values.length * 4);
    for (let p = 0; p < values.length; p++) data.writeFloatLE(values[p]!, 4 * p);
    const compressed = gzipSync(data, { level: 6 });
    await writeFile(resolve(cache, `${key}.f32.gz`), compressed);
    rawProducts[key] = { sha256: digest(compressed), bytes: compressed.length };
  }
  const percentage = (value: number) => measured.sourceTotal > 0 ? 100 * value / measured.sourceTotal : 0;
  const method: BenchmarkMethod = { id, name: options.name, status: 'complete', note: options.note, panels,
    metrics: { 'Diffuse signal (%)': percentage(measured.totals.diffuse), 'Compact signal (%)': percentage(measured.totals.compact),
      'Filament signal (%)': percentage(measured.totals.elongated), 'Signed residual signal (%)': percentage(measured.totals.residual),
      'Absolute residual / source (%)': percentage(measured.residualAbsolute), 'Maximum reconstruction error': measured.maxError,
      'Component preview clipped pixels': componentPreviewClippedPixels,
      'Component pixels with undefined source hue': undefinedHuePixels, ...options.metrics } };
  await writeFile(resolve(directory, 'receipt.json'), JSON.stringify({ schema: 'cssearth-structure-products@1',
    dimensions: [image.width, image.height], units: 'Rec.709 coefficients applied to display sRGB, normalized 0…1. Not calibrated photometry.',
    products, rawProducts, rawCacheDirectory: `${options.cacheDirectory}/${id}`, metrics: method.metrics }, null, 2) + '\n');
  return method;
}
