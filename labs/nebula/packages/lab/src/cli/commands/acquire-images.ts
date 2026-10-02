import { parseLabModelJson } from '../../resources/model-paths.ts';
/** Acquisition of full-resolution lab reference images by URL, checked by their declared dimensions; never a browser dependency. */
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import sharp from 'sharp';

interface ReferenceImageRecipe {
  schema: 'cssearth-lab-reference-images@1';
  images: { id: string; url: string; bytes: number; width: number; height: number;
    publisherUrl: string; credit: string; license: string;
    // `resizeWidth` is for a source libwebp cannot encode at native size: the VST Omega Centauri mosaic
    // (14540px of a crowded star field) overflows the encoder at every quality, while 8192px encodes. It only
    // ever reduces, and the recorded interpretation states the reduction, so a downscale is never silent.
    output: { path: string; quality: number; effort: number; resizeWidth?: number } }[];
}
/** sharp reports the sample type; a provenance record states the bit depth a reader recognises. */
const DEPTH_WORDS: Record<string, string> = { uchar: '8-bit', ushort: '16-bit', ufloat: '32-bit float', float: '32-bit float' };


const [recipePath, extra] = process.argv.slice(2);
if (!recipePath || extra) throw new TypeError('Usage: acquire-images <reference-images.json>');
const recipe: ReferenceImageRecipe = parseLabModelJson(await readFile(recipePath, 'utf8'));
if (recipe.schema !== 'cssearth-lab-reference-images@1') throw new TypeError('Unsupported reference image recipe.');
const cache = resolve('.local/nebula-lab/source-originals');
await mkdir(cache, { recursive: true });
for (const image of recipe.images) {
  if (!/^[a-z0-9-]+$/.test(image.id)) throw new TypeError('Reference ids must be safe file names.');
  const original = resolve(cache, `${image.id}.tif`);
  if (!await stat(original).then(() => true, () => false)) {
    const response = await fetch(image.url, { signal: AbortSignal.timeout(180_000) });
    if (!response.ok || !response.body) throw new Error(`Reference download of ${image.url} failed: ${response.status}`);
    await pipeline(Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(`${original}.part`));
    // A truncated transfer is not the publisher's file.
    const received = (await stat(`${original}.part`)).size;
    if (received !== image.bytes) throw new Error(`Reference ${image.id}: ${image.url} delivered ${received} bytes, not the ${image.bytes} the publisher lists.`);
    await rename(`${original}.part`, original);
  }
  const metadata = await sharp(original).metadata();
  if (metadata.width !== image.width || metadata.height !== image.height) throw new Error(`Reference dimensions differ: ${image.id}`);
  const output = resolve(image.output.path);
  await mkdir(dirname(output), { recursive: true });
  const resizeWidth = image.output.resizeWidth;
  if (resizeWidth !== undefined && !(Number.isInteger(resizeWidth) && resizeWidth > 0 && resizeWidth < image.width)) {
    throw new TypeError(`Reference resizeWidth must be a positive integer below the native width: ${image.id}`);
  }
  const pipe = sharp(original).rotate().toColorspace('srgb').removeAlpha();
  await (resizeWidth === undefined ? pipe : pipe.resize({ width: resizeWidth }))
    .webp({ quality: image.output.quality, effort: image.output.effort }).toFile(`${output}.part`);
  await rename(`${output}.part`, output);
  await writeFile(`${output}.json`, JSON.stringify({ schema: 'cssearth-lab-reference-image@1', source: image,
    interpretation: `Converted from the publisher's ${DEPTH_WORDS[metadata.depth ?? ''] ?? `${metadata.depth ?? 'unknown'}-sample`} TIFF to 8-bit sRGB WebP. Lossy display reference; never cropped.${
      resizeWidth === undefined
        ? ' Full spatial resolution: not resized.'
        : ` Reduced from ${image.width}px to ${resizeWidth}px wide because libwebp cannot encode this source at native size; measure angular scale from the recorded native dimensions, not from this file.`
    } Original TIFF remains in the ignored cache.`,
    outputBytes: (await stat(output)).size }, null, 2) + '\n');
  console.log(`REFERENCE_READY ${image.id}: ${image.width}x${image.height}, ${image.output.path}`);
}
