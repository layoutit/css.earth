import {parseDimensions,parseByteObservationPolicy,parseProjectedBytePolicy} from './source-records.mts';
import sharp, { type SharpOptions } from 'sharp';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { blackFillCoverage } from '@cssearth/bake/raster';

/** Keep thresholding at native resolution without holding a multi-gigapixel mask
 * in memory. A separate lossless image is necessary: Sharp otherwise resizes
 * before thresholding even when threshold() is called first. */
export async function resizeProjectedValidity(path: string | Buffer, options: SharpOptions, width: number, height: number) {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-observation-mask-'));
  try {
    const mask = join(directory, 'mask.png');
    await sharp(path, options).bandbool('or').threshold(1).toColourspace('b-w').png().toFile(mask);
    return await sharp(mask, {limitInputPixels: false}).resize(width, height, {fit: 'fill', kernel: 'linear'})
      .toColourspace('b-w').raw().toBuffer();
  } finally { await rm(directory, {recursive: true, force: true}); }
}

/** Byte maps declare an exact missing code, or null when no validity mask is supplied. */
export async function prepareByteObservation(path: string, sourceEntry: unknown, value: unknown, width: number, height: number) {
  const entry=parseDimensions(sourceEntry),policy=parseByteObservationPolicy(value);
  const metadata = await sharp(path, { limitInputPixels: false }).metadata();
  if (metadata.width !== entry.width || metadata.height !== entry.height ||
      metadata.depth !== 'uchar' || metadata.hasAlpha || !['b-w', 'srgb'].includes(metadata.space) ||
      (policy.kind === 'image-monochrome-no-data' && metadata.space !== 'b-w')) {
    throw new Error(`Byte observation format differs from its source: ${path}`);
  }
  if (policy.grid) return prepareProjectedByteObservation(path, entry, policy, width, height);
  const source = await sharp(path).toColourspace('srgb').raw().toBuffer();
  const fillRange = policy.connectedFillRange;
  if (fillRange !== undefined && (!policy.connectedEdge || !Array.isArray(fillRange) || fillRange.length !== 2 ||
      !fillRange.every(v => Number.isInteger(v) && v >= 0 && v <= 255) || fillRange[0] > fillRange[1] ||
      !(policy.noData !== null && policy.noData >= fillRange[0] && policy.noData <= fillRange[1]))) {
    throw new Error('Invalid connected source-fill range.');
  }
  if (policy.connectedEdge !== undefined &&
      (!['north', 'south'].includes(policy.connectedEdge) || (policy.noData !== 0 && !fillRange))) {
    throw new Error('Connected coverage requires a north/south edge and a declared fill.');
  }
  // A source-owned display map may use a gray exterior compressed as JPEG.
  // Classify only its declared fill range, then reuse the existing connected
  // coverage traversal. Interior pixels of the same value remain observations.
  const fillCandidates = fillRange ? Uint8Array.from({ length: entry.width * entry.height }, (_, i) =>
    source.subarray(i * 3, i * 3 + 3).every(v => v >= fillRange[0] && v <= fillRange[1]) ? 0 : 255) : source;
  const connected = policy.connectedEdge === undefined ? null : blackFillCoverage(fillCandidates,
    { width: entry.width, height: entry.height, channels: fillRange ? 1 : 3 },
    { northConnected: policy.connectedEdge === 'north', southConnected: policy.connectedEdge === 'south' });
  const rgba = Buffer.alloc(entry.width * entry.height * 4);
  let sourceMissingPixels = 0;
  for (let i = 0; i < rgba.length / 4; i++) {
    const color = source.subarray(i * 3, i * 3 + 3);
    const missing = connected ? Boolean(connected[i]) :
      policy.noData !== null && color.every(value => value === policy.noData);
    rgba.set(color, i * 4);
    rgba[i * 4 + 3] = missing ? 0 : 255;
    sourceMissingPixels += Number(missing);
  }
  const data = await sharp(rgba, { raw: { width: entry.width, height: entry.height, channels: 4 } })
    .resize(width, height, { fit: 'fill', kernel: 'lanczos3' }).toColourspace('srgb').raw().toBuffer();
  const rgb = Buffer.alloc(width * height * 3), missing = new Uint8Array(width * height);
  const roll = (180 - policy.centerLongitude) / 360 * width;
  if (!Number.isInteger(roll)) throw new Error('Observed longitude roll must align with prepared texels.');
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x, j = y * width + (x + roll + width) % width;
    rgb.set(data.subarray(j * 4, j * 4 + 3), i * 3);
    missing[i] = data[j * 4 + 3] < 255 ? 1 : 0;
  }
  return { rgb, missing, sourceMissingPixels };
}

/** PDS-labelled display images can be cropped and need not be exactly 2:1.
 * The explicit source grid prevents stretching such a crop across both poles.
 */
export async function prepareProjectedByteObservation(path: string | Buffer, sourceEntry: unknown, value: unknown, width: number, height: number, inputOptions: SharpOptions = {}, sourceAlpha?: Buffer) {
  const entry=parseDimensions(sourceEntry),policy=parseProjectedBytePolicy(value);
  const { pixelsPerDegree, sampleOffset, lineOffset } = policy.grid;
  if (![pixelsPerDegree, sampleOffset, lineOffset].every(Number.isFinite) || pixelsPerDegree <= 0 || policy.noData !== 0) throw new TypeError('Invalid projected byte-image grid.');
  const options = { limitInputPixels: false, ...inputOptions };
  // Bitwise OR is zero exactly when all source channels are zero. Resolve this
  // before interpolation; the alpha boundary never borrows fill as terrain.
  const intermediateHeight = Math.round(entry.height * width / entry.width);
  const largeMask = sourceAlpha === undefined && entry.width * entry.height > 64 * 1024 * 1024;
  const alpha = largeMask ? undefined : sourceAlpha ?? await sharp(path, options).bandbool('or').threshold(1).toColourspace('b-w').raw().toBuffer();
  // Separate pipelines are intentional: joinChannel happens after resize in
  // libvips and a native-sized joined band would restore the original extent.
  const data = await sharp(path, options).resize(width, intermediateHeight, { fit: 'fill', kernel: 'linear' }).removeAlpha().toColourspace('srgb').raw().toBuffer();
  const validity = largeMask ? await resizeProjectedValidity(path, options, width, intermediateHeight)
    : await sharp(alpha, { ...options, raw: { width: entry.width, height: entry.height, channels: 1 } })
      .resize(width, intermediateHeight, { fit: 'fill', kernel: 'linear' }).toColourspace('b-w').raw().toBuffer();
  if (data.length !== width * intermediateHeight * 3 || validity.length !== width * intermediateHeight) throw new Error('Projected observation resampling changed its layout.');
  const rgb = Buffer.alloc(width * height * 3), missing = new Uint8Array(width * height);
  const scaleX = width / entry.width, scaleY = intermediateHeight / entry.height;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const lon = (x + .5) * 360 / width, lat = 90 - (y + .5) * 180 / height;
    const sx = ((lon - policy.centerLongitude) * pixelsPerDegree + sampleOffset + .5) * scaleX - .5;
    const sy = (-lat * pixelsPerDegree + lineOffset + .5) * scaleY - .5;
    const i = y * width + x;
    if (sx < 0 || sx > width - 1 || sy < 0 || sy > intermediateHeight - 1) { missing[i] = 1; continue; }
    const x0 = Math.floor(sx), x1 = Math.min(width - 1, x0 + 1), y0 = Math.floor(sy), y1 = Math.min(intermediateHeight - 1, y0 + 1);
    const indices = [y0 * width + x0, y0 * width + x1, y1 * width + x0, y1 * width + x1];
    const u = sx - x0, v = sy - y0;
    const weights = [(1 - u) * (1 - v), u * (1 - v), (1 - u) * v, u * v];
    if (indices.some((j, k) => weights[k] > 0 && validity[j] !== 255)) { missing[i] = 1; continue; }
    const offsets = indices.map(j => j * 3);
    for (let c = 0; c < 3; c++) rgb[i * 3 + c] = Math.round((data[offsets[0] + c] * (1 - u) + data[offsets[1] + c] * u) * (1 - v) +
      (data[offsets[2] + c] * (1 - u) + data[offsets[3] + c] * u) * v);
  }
  return { rgb, missing, sourceGeoreference: policy.grid };
}
