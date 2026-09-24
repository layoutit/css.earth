import { sha256 } from '../../../../src/platform/sha256.mts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { decodeCalibratedCamera } from '../../terrestrial-layers/shape-camera-mosaic.mts';
import { pds3Keyword } from '../../pds-labels.mts';

// A source inspection only. It cannot fit a camera or publish a surface.
const args = process.argv.slice(2), acquire = args.includes('--acquire');
const directories = args.filter(arg => arg !== '--acquire');
if (directories.length > 2) throw new Error('Expected [input directory] [output directory] [--acquire].');
const inputDirectory = resolve(directories[0] ?? 'output/moons-first-photographs');
const outputDirectory = resolve(directories[1] ?? 'output/aegaeon-source-review');
const manifestPath = resolve('src/objects/aegaeon/evidence/registration/inputs.json');
const manifestBytes = await readFile(manifestPath);
const manifest = requireRecord(JSON.parse(manifestBytes.toString('utf8')));
if (manifest.schema !== 'cssearth-photograph-investigation-inputs@1' || manifest.body !== 'aegaeon' || manifest.qualifiedSurface !== false) throw new Error('Unexpected investigation manifest.');
const display = requireRecord(manifest.display);
const gain = requireFiniteNumber(display.gain), scale = requireFiniteNumber(display.scale);
if (gain !== 20 || scale !== 6 || display.offset !== 0 || display.resize !== 'nearest') throw new Error('Unexpected source-inspection stretch.');

async function input(value: unknown) {
  const record = requireRecord(value), file = requireString(record.path), origin = requireString(record.origin);
  if (basename(file) !== file || !/^N\d+_1_CALIB\.(IMG|LBL)$/u.test(file) || !origin.startsWith('https://opus.pds-rings.seti.org/holdings/calibrated/')) throw new Error('Unexpected image input.');
  const path = resolve(inputDirectory, file);
  let bytes: Buffer;
  try { bytes = await readFile(path); }
  catch (error) {
    if (!acquire || !(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    const response = await fetch(origin, { signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw new Error(`${response.status}: ${origin}`);
    bytes = Buffer.from(await response.arrayBuffer());
    await mkdir(inputDirectory, { recursive: true });
    await writeFile(path, bytes);
  }
  return bytes;
}

await mkdir(outputDirectory, { recursive: true });
sharp.concurrency(1);
const frames = requireArray(manifest.frames);
if (frames.length !== 2) throw new Error('Expected the two pinned 2010 source frames.');
const panels: OverlayOptions[] = [], reports = [];
for (const [index, value] of frames.entries()) {
  const frame = requireRecord(value), id = requireString(frame.id);
  if (!/^N\d+$/u.test(id)) throw new Error('Unexpected frame ID.');
  const imageBytes = await input(frame.image), labelBytes = await input(frame.label);
  const image = decodeCalibratedCamera(imageBytes), label = labelBytes.toString('ascii');
  if (image.width !== 1024 || image.height !== 1024 || image.offset !== 8192 || pds3Keyword(label, 'FILTER_NAME') !== 'CL1,CL2') throw new Error('Unexpected native layout or filter.');
  const crop = requireArray(frame.crop).map(value => requireFiniteNumber(value));
  if (crop.length !== 4 || crop.some(v => !Number.isSafeInteger(v))) throw new Error('Expected an integer crop rectangle.');
  const [left, top, width, height] = crop;
  if (width !== 80 || height !== 80 || left < 0 || top < 0 || left + width > image.width || top + height > image.height) throw new Error('Invalid crop.');
  const pixels = Buffer.alloc(width * height);
  let lowClipped = 0, highClipped = 0, minimum = Infinity, maximum = -Infinity;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const source = image.data[(top + y) * image.width + left + x];
    if (!Number.isFinite(source)) throw new Error('Nonfinite source sample.');
    minimum = Math.min(minimum, source); maximum = Math.max(maximum, source);
    if (source < 0) lowClipped++;
    if (source * gain > 1) highClipped++;
    pixels[y * width + x] = Math.round(Math.max(0, Math.min(1, source * gain)) * 255);
  }
  panels.push({ input: await sharp(pixels, { raw: { width, height, channels: 1 } }).resize(width * scale, height * scale, { kernel: 'nearest' }).png().toBuffer(), left: index * 480, top: 32 });
  panels.push({ input: Buffer.from(`<svg width="480" height="32"><rect width="480" height="32" fill="#171717"/><text x="12" y="22" font-family="sans-serif" font-size="17" fill="white">${id} · I/F ×20 · native pixels ×6</text></svg>`), left: index * 480, top: 0 });
  reports.push({ id, productId: pds3Keyword(label, 'PRODUCT_ID'), imageMidTime: pds3Keyword(label, 'IMAGE_MID_TIME'), filter: 'CL1,CL2', imageBytes: imageBytes.length, imageSha256: sha256(imageBytes), labelSha256: sha256(labelBytes), dimensions: [image.width, image.height], rasterByteOffset: image.offset, crop, minimum, maximum, lowClipped, highClipped });
}
const png = await sharp({ create: { width: 960, height: 512, channels: 3, background: '#171717' } }).composite(panels).png().toBuffer();
await writeFile(resolve(outputDirectory, 'native-pair.png'), png);
const report = { schema: 'cssearth-aegaeon-source-review@1', qualifiedSurface: false,
  inputManifestSha256: sha256(manifestBytes), generatorSha256: sha256(await readFile(new URL(import.meta.url))),
  decoderSha256: sha256(await readFile(resolve('tools/objects/terrestrial-layers/shape-camera-mosaic.mts'))),
  outputSha256: sha256(png), display, frames: reports,
  result: 'A diffuse disc candidate is visible in both source crops. No image-to-surface registration, interior-control validation or photographic coverage is established.' };
await writeFile(resolve(outputDirectory, 'review.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ qualifiedSurface: false, outputDirectory, frames: reports.map(({ id, lowClipped, highClipped }) => ({ id, lowClipped, highClipped })) }));
