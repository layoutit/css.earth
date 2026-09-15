/** Full-resolution offline variant; bounded histograms replace pixel-sized JavaScript sort arrays. */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import sharp from 'sharp';
import type { ExtractionOptions, NativeExtractionReceipt } from './extraction.ts';

type SupportFactory = (signal: Buffer, width: number, height: number,
  threshold: number, options: ExtractionOptions) => Promise<Buffer>;
const clamp = (value: number) => Math.max(0, Math.min(255, value));
function histogramQuantile(counts: Uint32Array, total: number, q: number): number {
  const rank = Math.floor(q * (total - 1));
  let accumulated = 0;
  for (let index = 0; index < counts.length; index++) {
    accumulated += counts[index]!;
    if (accumulated > rank) return index;
  }
  throw new TypeError('Empty native-extraction border histogram.');
}
function histogramMad(counts: Uint32Array, total: number, median: number): number {
  const rank = Math.floor(0.5 * (total - 1));
  let accumulated = counts[median]!;
  if (accumulated > rank) return 0;
  for (let distance = 1; distance < counts.length; distance++) {
    if (median >= distance) accumulated += counts[median - distance]!;
    if (median + distance < counts.length) accumulated += counts[median + distance]!;
    if (accumulated > rank) return distance;
  }
  throw new TypeError('Invalid native-extraction deviation histogram.');
}

export async function extractNativeSource(options: ExtractionOptions, createSupport: SupportFactory): Promise<NativeExtractionReceipt> {
  const started = performance.now(), medianSize = options.medianSize ?? 9;
  if (!Number.isInteger(medianSize) || medianSize < 3 || medianSize % 2 !== 1)
    throw new TypeError('medianSize must be an odd integer of at least three.');
  const outputMode = options.outputMode ?? 'all';
  if (outputMode !== 'all' && outputMode !== 'diffuse-only') throw new TypeError('Unknown extraction output mode.');
  const id = options.id ?? basename(options.inputPath).replace(/\.[^.]+$/, '');
  const before = await stat(options.inputPath), sourceHash = createHash('sha256');
  for await (const chunk of createReadStream(options.inputPath)) sourceHash.update(chunk);
  const metadata = await sharp(options.inputPath).metadata();
  const decoded = await sharp(options.inputPath).rotate().removeAlpha().toColourspace('srgb')
    .raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = decoded.info, rgb = decoded.data;
  if (channels !== 3 || rgb.length !== width * height * 3) throw new TypeError('Expected native 8-bit sRGB pixels.');
  const border = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  const band = Math.max(2, Math.round(Math.min(width, height) * 0.08));
  let borderCount = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (x >= band && y >= band && x < width - band && y < height - band) continue;
    const offset = 3 * (y * width + x); borderCount++;
    for (let channel = 0; channel < 3; channel++) border[channel]![rgb[offset + channel]!]++;
  }
  const sky = border.map(counts => histogramQuantile(counts, borderCount, 0.35)) as [number, number, number];
  const median = await sharp(rgb, { raw: { width, height, channels: 3 } }).median(medianSize).raw().toBuffer();
  const signal = Buffer.alloc(width * height);
  // Rec.709 coefficients have four decimal places: this histogram is exact on
  // the resulting integer lattice, rather than a sampled or 8-bit approximation.
  const signalHistogram = new Uint32Array(2_550_001);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = y * width + x, offset = 3 * p;
    const value = Math.max(0, Math.min(2_550_000, 2126 * (median[offset]! - sky[0]) +
      7152 * (median[offset + 1]! - sky[1]) + 722 * (median[offset + 2]! - sky[2])));
    signal[p] = Math.round(value / 10000);
    if (x < band || y < band || x >= width - band || y >= height - band) signalHistogram[value]++;
  }
  const baselineInteger = histogramQuantile(signalHistogram, borderCount, 0.5);
  const baseline = baselineInteger / 10000, mad = histogramMad(signalHistogram, borderCount, baselineInteger) / 10000;
  const threshold = baseline + (options.thresholdSigma ?? 6) * Math.max(1, 1.4826 * mad);
  const mask = await createSupport(signal, width, height, threshold, options);
  const rgba = Buffer.alloc(width * height * 4);
  let supportSum = 0;
  for (const value of mask) supportSum += value / 255;
  const files: NativeExtractionReceipt['outputs'] = { diffuse: `${id}-diffuse.png`,
    mask: `${id}-mask.png`, comparison: `${id}-comparison.png` };
  await mkdir(options.outputDirectory, { recursive: true });
  const writeLayer = async (kind: 'diffuse' | 'cutout' | 'residual', file: string) => {
    for (let p = 0; p < width * height; p++) {
      const source = 3 * p, output = 4 * p;
      let maximum = 0;
      for (let channel = 0; channel < 3; channel++) {
        const observed = Math.max(0, rgb[source + channel]! - sky[channel]!);
        const extended = Math.max(0, median[source + channel]! - sky[channel]!);
        const value = kind === 'diffuse' ? extended : kind === 'cutout' ? observed : Math.max(0, observed - extended);
        rgba[output + channel] = clamp(value); maximum = Math.max(maximum, value);
      }
      for (let channel = 0; channel < 3; channel++)
        rgba[output + channel] = maximum ? Math.round(255 * rgba[output + channel]! / maximum) : 0;
      rgba[output + 3] = Math.round(mask[p]! / 255 * maximum);
    }
    await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toFile(resolve(options.outputDirectory, file));
  };
  await writeLayer('diffuse', files.diffuse);
  if (outputMode === 'all') {
    files.cutout = `${id}-cutout.png`; files.residual = `${id}-residual.png`;
    await writeLayer('cutout', files.cutout); await writeLayer('residual', files.residual);
  }
  await sharp(mask, { raw: { width, height, channels: 1 } }).png().toFile(resolve(options.outputDirectory, files.mask));
  const panelWidth = 480, panelHeight = Math.round(height * panelWidth / width);
  const originalPanel = await sharp(rgb, { raw: { width, height, channels: 3 } }).resize(panelWidth, panelHeight).png().toBuffer();
  const diffusePanel = await sharp(resolve(options.outputDirectory, files.diffuse)).resize(panelWidth, panelHeight)
    .flatten({ background: '#05070b' }).png().toBuffer();
  const maskPanel = await sharp(mask, { raw: { width, height, channels: 1 } }).resize(panelWidth, panelHeight).png().toBuffer();
  await sharp({ create: { width: panelWidth * 3, height: panelHeight, channels: 3, background: '#05070b' } })
    .composite([{ input: originalPanel, left: 0, top: 0 }, { input: diffusePanel, left: panelWidth, top: 0 },
      { input: maskPanel, left: panelWidth * 2, top: 0 }]).png().toFile(resolve(options.outputDirectory, files.comparison));
  const after = await stat(options.inputPath);
  if (after.size !== before.size || after.mtimeMs !== before.mtimeMs)
    throw new TypeError('Native extraction source changed during processing.');
  const outputHashes: Record<string, string> = {};
  for (const file of Object.values(files)) {
    const digest = createHash('sha256');
    for await (const chunk of createReadStream(resolve(options.outputDirectory, file))) digest.update(chunk);
    outputHashes[file] = digest.digest('hex');
  }
  const receipt: NativeExtractionReceipt = {
    schema: 'cssearth-nebula-extraction-lab@1', id, width, height, skyRgb: sky, threshold,
    supportFraction: supportSum / (width * height), outputs: files, outputHashes,
    options: { maxPixels: null, medianSize, outputMode, supportPixels: options.supportPixels ?? 420,
      thresholdSigma: options.thresholdSigma ?? 6, bridgeFraction: options.bridgeFraction ?? 0.006,
      softEdgeFraction: options.softEdgeFraction ?? 0.018 },
    source: { path: options.inputPath, sha256: sourceHash.digest('hex'), bytes: before.size,
      depth: metadata.depth ?? 'unknown', width: metadata.width!, height: metadata.height! },
    processing: { nativeResolution: true, medianSize, outputMode,
      borderStatistic: 'Full border histograms: 256 bins per RGB channel; exact four-decimal luminance lattice for median and MAD.',
      elapsedSeconds: (performance.now() - started) / 1000, maximumResidentBytes: process.resourceUsage().maxRSS * 1024 },
    method: 'Native-resolution sRGB display conversion; border-robust sky subtraction; median-filtered extended signal; connected softly feathered support. No coordinate resize.',
    limitations: ['Output is 8-bit sRGB display imagery, not linear scientific radiance or preserved 16-bit photometry.',
      'Median filtering removes compact intrinsic knots as well as foreground stars; it cannot classify source membership.',
      'The median kernel is measured in native pixels; angular scale depends on the supplied image WCS.',
      'Disconnected extended emission can be omitted by the morphology-connected support.',
      'Native comparison panels are reduced previews; diffuse and mask retain full source dimensions.'],
  };
  await writeFile(resolve(options.outputDirectory, `${id}-receipt.json`), JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}
