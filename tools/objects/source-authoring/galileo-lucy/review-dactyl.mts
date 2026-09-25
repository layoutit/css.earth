/** Reproduce the native-frame review; this does not fit a camera or prepare a surface. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { readFitsPrimary } from '@cssearth/fits';
import { readDaf } from '@cssearth/spice';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { readPinnedFile } from '../../../spice/kernel-bank.mts';

const input = resolve('src/objects/dactyl/evidence/galileo');
const output = resolve(process.argv[2] ?? 'output/dactyl-galileo-review');
const record = requireRecord(JSON.parse(await readFile(resolve(input, 'inputs.json'), 'utf8')));
if (record.schema !== 'cssearth-galileo-frame-review@1' || record.objectId !== 'dactyl') throw new Error('Unexpected review input.');
const native = new Map<string, Buffer>();
for (const item of requireArray(record.files)) {
  const file = requireRecord(item), path = requireString(file.path);
  if (!/^native\/[a-z0-9_]+\.(fit|lbl|tab|bc|tpc)$/.test(path)) throw new Error('Invalid native file path.');
  // Kernels are not committed; a missing one is restored from its pinned origin.
  const bytes = /\.(bc|tpc)$/.test(path) ? await readPinnedFile(resolve(input, path), requireString(file.origin), requireString(file.expectedSha256)) : await readFile(resolve(input, path));
  native.set(path, bytes);
}
const ckBytes = native.get('native/gll_plt_rec_1993_tav_v00.bc');
if (!ckBytes) throw new Error('Missing scan-platform kernel.');
const ck = readDaf(ckBytes);
if (ck.idWord !== 'DAF/CK' || ck.summaries.some(s => s.integers[0] !== -77001 || s.integers[1] !== 2 || s.integers[2] !== 3)) throw new Error('Unexpected CK frame or type.');
function integer(value: unknown) {
  const n = requireFiniteNumber(value);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('Expected a nonnegative integer.');
  return n;
}
function field(label: string, key: string) {
  const match = label.match(new RegExp(`^${key}\\s*=\\s*(.*?)\\s*$`, 'm'));
  if (!match) throw new Error(`Missing native label field: ${key}`);
  return match[1].replace(/^"|"$/g, '');
}
await mkdir(output, { recursive: true });
const frames = [];
for (const item of requireArray(record.frames)) {
  const frame = requireRecord(item), id = requireString(frame.id), crop = requireRecord(frame.crop);
  const bytes = native.get(`native/${id}.fit`), labelBytes = native.get(`native/${id}.lbl`);
  if (!bytes || !labelBytes) throw new Error(`Unpinned image or label: ${id}`);
  const image = readFitsPrimary(bytes), label = labelBytes.toString('ascii');
  if (image.bitpix !== 8 || image.width !== 800 || image.height !== 800 || image.scale !== 1 || image.zero !== 0) throw new Error(`Unexpected detector layout: ${id}`);
  const region = { left: integer(crop.left), top: integer(crop.top), width: integer(crop.width), height: integer(crop.height) };
  if (!region.width || !region.height || region.left + region.width > image.width || region.top + region.height > image.height) throw new Error('Crop outside detector.');
  const pixels = Buffer.from(image.values);
  // Preserve the detector array exactly; the enlarged crop has a declared display stretch only.
  await sharp(pixels, { raw: { width: image.width, height: image.height, channels: 1 } }).png().toFile(resolve(output, `${id}-native.png`));
  const values = await sharp(pixels, { raw: { width: image.width, height: image.height, channels: 1 } }).extract(region).greyscale().raw().toBuffer();
  if (values.length !== region.width * region.height) throw new Error('Unexpected crop layout.');
  const gain = 2; // DN 0..127 -> display 0..254; clipping is counted below, never concealed.
  await sharp(values, { raw: { width: region.width, height: region.height, channels: 1 } })
    .linear(gain, 0).resize(region.width * 5, region.height * 5, { kernel: 'nearest' }).png().toFile(resolve(output, `${id}-crop.png`));
  frames.push({ id, productId: field(label, 'PRODUCT_ID'), startTime: field(label, 'START_TIME'),
    filter: field(label, 'FILTER_NAME'), labelGeometryTarget: field(label, 'TARGET_NAME'),
    width: image.width, height: image.height, bitpix: image.bitpix, units: 'uncalibrated DN',
    storageCrop: region, displayGain: gain, displayZoom: 5, displayClippedPixels: values.filter(n => n * gain > 255).length,
    cropMin: Math.min(...values), cropMax: Math.max(...values), qualityMaskApplied: false,
    finding: requireString(frame.finding) });
}
await writeFile(resolve(output, 'review.json'), JSON.stringify({
  schema: 'cssearth-galileo-frame-review-result@1',
  baseCommit: record.baseCommit,
  qualifiedSurface: false, coordinates: record.coordinateConvention, frames,
  scanPlatformKernel: { segments: ck.summaries.length, frameId: -77001, referenceFrame: 'B1950', type: 3, evaluatedAttitude: false },
  limitations: ['No radiometric or geometric calibration.', 'No camera fit, surface reprojection, or registration residual is claimed.',
    'Bad-pixel tables are pinned for a future projection; these detector previews show the input values without masking.'],
}, null, 2) + '\n');
console.log(JSON.stringify({ output, frames: frames.length, qualifiedSurface: false }));
