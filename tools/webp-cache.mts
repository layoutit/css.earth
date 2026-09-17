import { createHash, randomUUID } from 'node:crypto';
import { link, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sharp, { type Sharp, type WebpOptions } from 'sharp';
import { hasErrorCode } from './source-values.mts';

/** Encode a pipeline to WebP once per distinct result. The key is the decoded pixels, their dimensions, the encoder options and the
 * libvips build, so a hit returns the exact bytes a fresh encode would, and a changed image, option or encoder finds no entry.
 * Slow encodes (effort 6 takes about 3.4 s on a 512 px image) are otherwise repeated whenever a tool edit re-prepares unchanged pixels. */
export async function encodeWebp(pipeline: Sharp, options: WebpOptions, cacheRoot = resolve(process.cwd(), '.local/webp-cache')): Promise<Buffer> {
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  const raw = { width: info.width, height: info.height, channels: info.channels };
  const key = createHash('sha256').update(data).update(JSON.stringify([raw, options, sharp.versions])).digest('hex');
  const cached = resolve(cacheRoot, key.slice(0, 2), `${key}.webp`);
  try { return await readFile(cached); } catch (error) { if (!hasErrorCode(error, 'ENOENT')) throw error; }
  const bytes = await sharp(data, { raw }).webp(options).toBuffer();
  await mkdir(dirname(cached), { recursive: true });
  const temporary = `${cached}.${randomUUID()}.tmp`;
  await writeFile(temporary, bytes);
  // A hard link creates the entry only if no other process wrote it first; either way the bytes are the same.
  try { await link(temporary, cached); } catch (error) { if (!hasErrorCode(error, 'EEXIST')) throw error; } finally { await rm(temporary, { force: true }); }
  return bytes;
}
