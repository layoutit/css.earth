/** Lossless source loading and reproducible original OpenEXR acquisition, exclusively offline. */
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { resolve } from 'node:path';
import { zstdCompressSync, zstdDecompressSync, constants } from 'node:zlib';
import { sourceBytes, containedPath } from '@cssearth/volume-bake/compact-inputs/density-grid';
import { sha256 } from '@cssearth/core/node';
import { requireRecord as record } from '@cssearth/core';
import { decodeExrRgbHalf, halfToFloat, type LinearHalfImage } from './exr.js';
import type { SkyRecipe } from './config.js';
export async function loadSkySource(directory: string, recipe: SkyRecipe): Promise<LinearHalfImage> {
  const { width, height } = recipe.source, rgb16f = Buffer.alloc(width * height * 6);
  for (const chunk of recipe.source.chunks) {
    const decoded = zstdDecompressSync(await sourceBytes(directory, chunk), { maxOutputLength: width * chunk.rows * 6 });
    if (decoded.length !== width * chunk.rows * 6) throw new TypeError('Sky chunk decoded size mismatch.');
    decoded.copy(rgb16f, width * chunk.firstRow * 6);
  }
  // A lookup table avoids repeatedly decoding HALF while sampling the six faces.
  for (let i = 0; i < rgb16f.length; i += 2) if (rgb16f.readUInt16LE(i) >= 0x7c00) throw new TypeError('Sky radiance must be finite and nonnegative.');
  return { width, height, rgb16f };
}
export const HALF_LINEAR = Float64Array.from({ length: 65536 }, (_, bits) => halfToFloat(bits));
export async function acquireSkySource(directory: string, recipe: SkyRecipe, cacheDirectory: string): Promise<void> {
  const acquisition = record(JSON.parse((await sourceBytes(directory, recipe.source.acquisition)).toString('utf8')), 'sky acquisition');
  const source = record(acquisition.source, 'sky original source'), compression = record(acquisition.compression, 'sky source compression');
  if (acquisition.schema !== 'cssearth-exr-sky-acquisition@1' || typeof source.url !== 'string' || new URL(source.url).protocol !== 'https:' ||
    !Number.isSafeInteger(source.bytes) || Number(source.bytes) < 1 ||
    compression.format !== 'rgb16f-le-zstd-rows' || !Number.isInteger(compression.level) || Number(compression.level) < 1 || Number(compression.level) > 19) throw new TypeError('Invalid sky acquisition.');
  await mkdir(cacheDirectory, { recursive: true });
  const cache = resolve(cacheDirectory, `${sha256(Buffer.from(String(source.url)))}.exr`); let original: Buffer | undefined;
  try { original = await readFile(cache); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  if (!original) {
    const response = await fetch(source.url); if (!response.ok || !response.body) throw new Error(`Sky source HTTP ${response.status}.`);
    let received = 0, announced = 0;
    const progress = new Transform({ transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      if (received > Number(source.bytes)) return callback(new Error('Sky download exceeds pinned length.'));
      if (received - announced >= 16 * 1024 * 1024) { announced = received; console.log(`Sky source: ${received}/${source.bytes} bytes`); }
      callback(null, chunk);
    } });
    try {
      await pipeline(Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]), progress, createWriteStream(`${cache}.partial`));
      original = await readFile(`${cache}.partial`);
      if (original.length !== source.bytes) throw new TypeError('Downloaded EXR length mismatch.');
      await rename(`${cache}.partial`, cache);
    } finally { await rm(`${cache}.partial`, { force: true }); }
  }
  if (original.length !== source.bytes) throw new TypeError('Cached EXR length mismatch.');
  const image = decodeExrRgbHalf(original);
  if (image.width !== recipe.source.width || image.height !== recipe.source.height) throw new TypeError('Original EXR disagrees with the recorded linear source.');
  const chunks = recipe.source.chunks.map(chunk => {
    const raw = image.rgb16f.subarray(chunk.firstRow * image.width * 6, (chunk.firstRow + chunk.rows) * image.width * 6);
    const bytes = zstdCompressSync(raw, { params: { [constants.ZSTD_c_compressionLevel]: Number(compression.level) } });
    return { path: containedPath(directory, chunk.path), bytes };
  });
  for (const chunk of chunks) await writeFile(chunk.path, chunk.bytes);
  console.log(`VERIFIED sky import: ${image.width}×${image.height}, every RGB HALF source bit preserved.`);
}
