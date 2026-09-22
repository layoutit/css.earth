import {shape,dictionary,number} from '../../../../tools/objects/terrestrial-layers/source-records.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('comet-67p');
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
const prepared = new URL('../../../../src/objects/comet-67p/prepared/', import.meta.url);
const json = async (file: string|URL) => JSON.parse((await readFile(new URL(file, prepared))).toString('utf8'));

test('67P mosaic source attribution is lossless, hash-bound, and absent from the runtime transport', async () => {
  const { surfaces } = await json('surfaces.json'), surface = surfaces.find((s: { id: string; }) => s.id === 'osiris');
  const { frames, sampleSources: ref, transfer } = surface.observation;
  const bytes = await readFile(new URL(ref.file, prepared)), index = JSON.parse((bytes).toString('utf8'));
  assert.equal(bytes.length, ref.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), ref.sha256);
  assert.equal(index.schema, 'cssearth-atlas-observation-index@1');
  assert.equal(index.encoding, 'gzip-u8-base64');
  assert.equal(index.width, surface.layout.width); assert.equal(index.height, surface.layout.height);
  assert.deepEqual(index.codes, { 0: 'no-qualified-observation', ...Object.fromEntries(frames.map((frame:{id:string}, i: number) => [i + 1, frame.id])) });
  const pixels = gunzipSync(Buffer.from(index.data, 'base64')), counts = Array(frames.length + 1).fill(0);
  assert.equal(pixels.length, index.width * index.height);
  for (const code of pixels) { assert.ok(code <= frames.length); counts[code]++; }
  assert.ok(counts.every(count => count > 0), 'every named observation contributes while unobserved texels stay explicit');
  assert.equal(Object.values(dictionary(number)(transfer.sources)).reduce((a, b) => a + b), transfer.counts.accepted);
  assert.equal(Object.values(dictionary(number)(transfer.counts)).reduce((a, b) => a + b), transfer.interiorTexels);
  const runtime = await readFile(new URL('object.json', prepared), 'utf8');
  assert.ok(!runtime.includes(index.data), 'the forensic source raster must not inflate the browser transport');
  assert.ok(!runtime.includes('maximumResidualPixels'), 'source camera calibration stays in preparation');
});
