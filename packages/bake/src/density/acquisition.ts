/** Offline, hash-pinned RGBA volume acquisition and deterministic encoded-field reduction. */
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { resolve } from 'node:path';
import { zstdCompressSync, constants } from 'node:zlib';
import { containedPath, sourceBytes, type DecodedGrid } from '../volume/node/index.ts';
import { sha256 } from '@cssearth/core/node';
import { triple, type Vector3, type VolumeRecipe } from '../volume/index.ts';
import { requireRecord as record } from '@cssearth/core';

export interface VolumeAcquisition {
  schema: 'cssearth-raw-volume-acquisition@1';
  source: { url: string; bytes: number; dimensions: Vector3; layout: 'x-fastest-rgba8'; invertZ: false };
  reduction: { method: 'encoded-box-average-round-half-up'; factor: number };
  compression: { format: 'ktx2-rgba8-zstd'; level: number };
}
export function parseVolumeAcquisition(value: unknown): VolumeAcquisition {
  const data = record(value, 'acquisition'), source = record(data.source, 'raw source');
  const reduction = record(data.reduction, 'reduction'), compression = record(data.compression, 'compression');
  const dimensions = triple(source.dimensions, 'raw dimensions');
  if (data.schema !== 'cssearth-raw-volume-acquisition@1' || source.layout !== 'x-fastest-rgba8' || source.invertZ !== false ||
    reduction.method !== 'encoded-box-average-round-half-up' || compression.format !== 'ktx2-rgba8-zstd') throw new TypeError('Unsupported raw volume acquisition.');
  if (typeof source.url !== 'string' || new URL(source.url).protocol !== 'https:') throw new TypeError('Raw source requires HTTPS.');
  if (dimensions.some(n => !Number.isSafeInteger(n) || n < 1) || source.bytes !== dimensions[0] * dimensions[1] * dimensions[2] * 4) throw new TypeError('Invalid raw volume dimensions/bytes.');
  const factor = reduction.factor;
  if (typeof factor !== 'number' || !Number.isSafeInteger(factor) || factor < 1 ||
    dimensions.some(n => n % factor !== 0)) throw new TypeError('Reduction factor must divide each raw dimension.');
  if (typeof compression.level !== 'number' || !Number.isInteger(compression.level) || compression.level < 1 || compression.level > 19) throw new TypeError('Invalid Zstd level.');
  return { schema: data.schema, source: { url: source.url, bytes: source.bytes as number,
    dimensions, layout: source.layout, invertZ: false }, reduction: { method: reduction.method, factor },
    compression: { format: compression.format, level: compression.level } };
}
/** Average encoded values before their nonlinear transfer, matching a coarse trilinear texel center. */
export function reduceRawVolume(raw: Uint8Array, acquisition: VolumeAcquisition): DecodedGrid {
  if (raw.length !== acquisition.source.bytes) throw new TypeError('Raw volume source length mismatch.');
  const [sourceWidth, sourceHeight, sourceDepth] = acquisition.source.dimensions, factor = acquisition.reduction.factor;
  const width = sourceWidth / factor, height = sourceHeight / factor, depth = sourceDepth / factor;
  if (factor === 1) return { width, height, depth, encodedRgba: raw };
  const encodedRgba = Buffer.alloc(width * height * depth * 4), count = factor ** 3;
  for (let z = 0; z < depth; z++) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sums = [0, 0, 0, 0];
    for (let dz = 0; dz < factor; dz++) for (let dy = 0; dy < factor; dy++) for (let dx = 0; dx < factor; dx++) {
      const offset = 4 * (((z * factor + dz) * sourceHeight + y * factor + dy) * sourceWidth + x * factor + dx);
      for (let c = 0; c < 4; c++) sums[c] = sums[c]! + raw[offset + c]!;
    }
    const target = 4 * ((z * height + y) * width + x);
    for (let c = 0; c < 4; c++) encodedRgba[target + c] = Math.floor(sums[c]! / count + 0.5);
  }
  return { width, height, depth, encodedRgba };
}
/** Standards-shaped, single-level RGBA8 KTX2 with linear transfer and a complete basic DFD. */
export function encodeDensityKtx2(grid: DecodedGrid, level: number): Buffer {
  const compressed = zstdCompressSync(grid.encodedRgba, { params: { [constants.ZSTD_c_compressionLevel]: level } });
  const prefix = Buffer.alloc(200);
  Buffer.from('ab4b5458203230bb0d0a1a0a', 'hex').copy(prefix);
  [37, 1, grid.width, grid.height, grid.depth, 0, 1, 1, 2, 104, 92, 0, 0].forEach((n, i) => prefix.writeUInt32LE(n, 12 + 4 * i));
  prefix.writeBigUInt64LE(200n, 80);
  prefix.writeBigUInt64LE(BigInt(compressed.length), 88);
  prefix.writeBigUInt64LE(BigInt(grid.encodedRgba.length), 96);
  const dfd = 104;
  prefix.writeUInt32LE(92, dfd); prefix.writeUInt16LE(2, dfd + 8); prefix.writeUInt16LE(88, dfd + 10);
  prefix[dfd + 12] = prefix[dfd + 13] = prefix[dfd + 14] = 1;
  prefix[dfd + 20] = 4;
  for (let c = 0; c < 4; c++) {
    const sample = dfd + 28 + c * 16;
    prefix.writeUInt16LE(c * 8, sample); prefix[sample + 2] = 7; prefix[sample + 3] = c === 3 ? 15 : c;
    prefix.writeUInt32LE(255, sample + 12);
  }
  return Buffer.concat([prefix, compressed]);
}
export async function acquireVolumeSource(sourceDirectory: string, recipe: VolumeRecipe, cacheDirectory: string): Promise<void> {
  if (!recipe.grid.acquisition) throw new TypeError('Volume has no acquisition recipe.');
  const acquisition = parseVolumeAcquisition(JSON.parse((await sourceBytes(sourceDirectory, recipe.grid.acquisition)).toString('utf8')));
  await mkdir(cacheDirectory, { recursive: true });
  const cache = resolve(cacheDirectory, `${sha256(Buffer.from(acquisition.source.url))}.raw`);
  let raw: Buffer | undefined;
  try { raw = await readFile(cache); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  if (!raw) {
    const response = await fetch(acquisition.source.url);
    if (!response.ok || !response.body) throw new Error(`Volume source download failed: HTTP ${response.status}`);
    let received = 0, announced = 0;
    const progress = new Transform({ transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      if (received > acquisition.source.bytes) { callback(new Error('Volume download exceeds the recorded length.')); return; }
      if (received - announced >= 32 * 1024 * 1024) { announced = received; console.log(`Volume source: ${received}/${acquisition.source.bytes} bytes`); }
      callback(null, chunk);
    } });
    try {
      await pipeline(Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]), progress, createWriteStream(`${cache}.partial`));
      raw = await readFile(`${cache}.partial`);
      if (raw.length !== acquisition.source.bytes) throw new TypeError('Downloaded volume length mismatch.');
      await rename(`${cache}.partial`, cache);
    } finally { await rm(`${cache}.partial`, { force: true }); }
  }
  const reduced = reduceRawVolume(raw, acquisition);
  if ([reduced.width, reduced.height, reduced.depth].some((n, i) => n !== recipe.grid.dimensions[i])) throw new TypeError('Imported volume differs from the recorded source dimensions.');
  const bytes = encodeDensityKtx2(reduced, acquisition.compression.level);
  await writeFile(containedPath(sourceDirectory, recipe.grid.path), bytes);
  console.log(`Volume import: ${bytes.length} bytes.`);
}
