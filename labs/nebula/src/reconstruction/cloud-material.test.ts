import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { recolorCloudSlices } from './cloud-material.js';
import { sha256 } from '../../../../src/preparation/volume/source.js';
import type { VolumeSlices, VolumeSliceQuad } from '../../../../src/preparation/volume/slices.js';

async function temporary(t: { after(fn: () => Promise<void>): void }) {
  await mkdir('.local/nebula-lab', { recursive: true });
  const directory = await mkdtemp(resolve('.local/nebula-lab/cloud-material-test-'));
  t.after(() => rm(directory, { recursive: true, force: true })); return directory;
}
async function fixture() {
  // Read the accepted real geometry/metadata, then use small known pixels to
  // independently verify physical texel-centre mapping and all alpha extremes.
  const accepted = JSON.parse(await readFile('labs/nebula/models/lmc/full-density/prepared/volume-slices.json', 'utf8')) as VolumeSlices;
  assert.equal(accepted.quads.length, 144);
  const pixels = Buffer.from([50, 100, 200, 0, 50, 100, 200, 1, 50, 100, 200, 63,
    50, 100, 200, 128, 50, 100, 200, 254, 50, 100, 200, 255]);
  const bytes = await sharp(pixels, { raw: { width: 3, height: 2, channels: 4 } }).png().toBuffer();
  const quads = ['x', 'y', 'z'].map((axis, i) => ({ ...structuredClone(accepted.quads.find(q => q.axis === axis)!),
    texturePath: `slices/${axis}/sample.png`, widthPx: 3, heightPx: 2, bytes: bytes.length, sha256: sha256(bytes),
    vertices: [[10, 20, i], [16, 20, i], [16, 12, i], [10, 12, i]], center: [13, 16, i], alphaCoverage: 5 / 6,
  })) as VolumeSliceQuad[];
  return { slices: { ...accepted, quads }, pixels, bytes };
}
const shape = ({ texturePath: _path, sha256: _hash, bytes: _bytes, ...quad }: VolumeSliceQuad) => quad;

for (const format of ['png', 'webp'] as const) test(`${format} recolors real-reference quads while preserving all geometry and every alpha byte`, async t => {
  const outputDirectory = await temporary(t), source = await fixture(), before = structuredClone(source.slices);
  const visits: number[][] = [], samples: number[][] = [];
  const result = await recolorCloudSlices({ slices: source.slices, loadResource: async () => source.bytes,
    outputDirectory, encoding: { format, quality: 100 }, sampleImageRgb: (x, y, z, out) => {
      visits.push([x, y, z]); out[0] = 20; out[1] = 40; out[2] = 80; samples.push([...out]); return true;
    } });
  assert.deepEqual(source.slices, before);
  assert.deepEqual(result.slices.quads.map(shape), before.quads.map(shape));
  assert.deepEqual(result.slices.boundsUnits, before.boundsUnits);
  assert.deepEqual(result.slices.approximation.sliceCounts, before.approximation.sliceCounts);
  assert.deepEqual(visits, [0, 1, 2].flatMap(z => [[13, 18, z], [15, 18, z], [11, 14, z], [13, 14, z], [15, 14, z]]));
  assert.ok(samples.every(rgb => JSON.stringify(rgb) === '[20,40,80]'));
  assert.equal(result.coverage.positiveAlphaTexels, 15); assert.equal(result.coverage.recoloredTexels, 15);
  assert.equal(result.coverage.preservedReferenceTexels, 0);
  for (const quad of result.slices.quads) {
    const bytes = await readFile(resolve(outputDirectory, quad.texturePath));
    assert.equal(sha256(bytes), quad.sha256); assert.equal(bytes.length, quad.bytes);
    const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer();
    for (let offset = 3; offset < decoded.length; offset += 4) assert.equal(decoded[offset], source.pixels[offset]);
    if (format === 'png') for (let offset = 4; offset < decoded.length; offset += 4)
      assert.deepEqual([...decoded.subarray(offset, offset + 3)], [64, 128, 255]);
  }
});

test('missing image or black chromaticity retains reference color/support, with explicit coverage accounting', async t => {
  const outputDirectory = await temporary(t), source = await fixture();
  const result = await recolorCloudSlices({ slices: source.slices, loadResource: async () => source.bytes,
    outputDirectory, encoding: { format: 'png' }, sampleImageRgb: (x, _y, _z, out) => {
      if (x < 12) return false;
      if (x < 14) { out.fill(0); return true; }
      out[0] = 128; out[1] = 64; out[2] = 0; return true;
    } });
  assert.deepEqual(result.coverage, { positiveAlphaTexels: 15, recoloredTexels: 6,
    outsideImageTexels: 3, blackImageTexels: 6, preservedReferenceTexels: 9 });
  for (const quad of result.slices.quads) {
    const decoded = await sharp(await readFile(resolve(outputDirectory, quad.texturePath))).ensureAlpha().raw().toBuffer();
    for (const pixel of [0, 1, 3, 4]) assert.deepEqual([...decoded.subarray(pixel * 4, pixel * 4 + 4)], [...source.pixels.subarray(pixel * 4, pixel * 4 + 4)]);
    for (const pixel of [2, 5]) assert.deepEqual([...decoded.subarray(pixel * 4, pixel * 4 + 3)], [255, 128, 0]);
  }
});

test('image brightness cannot redefine opacity or reference support', async t => {
  const directory = await temporary(t), source = await fixture(), outputs: VolumeSlices[] = [];
  for (const brightness of [.01, 1]) {
    const outputDirectory = resolve(directory, String(brightness));
    const { slices } = await recolorCloudSlices({ slices: source.slices, loadResource: async () => source.bytes,
      outputDirectory, encoding: { format: 'png' }, sampleImageRgb: (_x, _y, _z, out) => {
        out[0] = brightness * 200; out[1] = brightness * 100; out[2] = brightness * 50; return true;
      } }); outputs.push(slices);
  }
  assert.deepEqual(outputs[0].quads, outputs[1].quads, 'Only chromaticity changes material; exposure cannot change cloud shape or alpha.');
});

test('changed reference bytes fail before recoloring', async t => {
  const outputDirectory = await temporary(t), source = await fixture(), changed = Buffer.from(source.bytes); changed[10] ^= 1;
  await assert.rejects(recolorCloudSlices({ slices: source.slices, loadResource: async () => changed,
    outputDirectory, sampleImageRgb: (_x, _y, _z, out) => { out.fill(255); return true; } }), /Accepted cloud texture changed/);
});
