import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { recolorCloudSlices, type VolumeSlices, type VolumeSliceQuad } from '@cssearth/bake/volume/node';
import { sha256 } from '@cssearth/core/node';

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

test('saturation and registered detail change only RGB, including identical dark lanes on all slice axes', async t => {
  const directory = await temporary(t), source = await fixture();
  for (const saturation of [0, 1, 2]) {
    const outputDirectory = resolve(directory, String(saturation));
    const result = await recolorCloudSlices({ slices: source.slices, loadResource: async () => source.bytes,
      outputDirectory, encoding: { format: 'png' }, appearance: { brightness: 1, gamma: 1, saturation, detailStrength: 1, detailScale: 24 },
      sampleImageRgb: (_x, _y, _z, out) => { out[0] = 40; out[1] = 60; out[2] = 80; return true; },
      sampleDetailGain: x => x < 14 ? .4 : 1 });
    const banks = [];
    for (const quad of result.slices.quads) {
      const rgba = await sharp(await readFile(resolve(outputDirectory, quad.texturePath))).ensureAlpha().raw().toBuffer();
      for (let p = 3; p < rgba.length; p += 4) assert.equal(rgba[p], source.pixels[p]);
      const dark = [...rgba.subarray(4, 7)], bright = [...rgba.subarray(8, 11)];
      assert.equal(Math.max(...dark), 102); assert.equal(Math.max(...bright), 255);
      if (saturation === 0) assert.deepEqual(bright, [255, 255, 255]);
      if (saturation === 1) assert.deepEqual(bright, [128, 191, 255]);
      if (saturation === 2) assert.ok(bright[0] < 128 && bright[2] === 255);
      banks.push(rgba);
    }
    assert.deepEqual(banks[0], banks[1]); assert.deepEqual(banks[1], banks[2]);
    assert.deepEqual(result.slices.quads.map(shape), source.slices.quads.map(shape));
  }
});

test('material brightness and gamma affect real midtone pixels while opacity stays exact', async t => {
  const directory = await temporary(t), source = await fixture();
  for (const [brightness, gamma, expected] of [[1, 1, [64, 128, 255]], [.5, 1, [32, 64, 128]],
    [1, 2, [128, 180, 255]], [0, 1, [0, 0, 0]]] as const) {
    const outputDirectory = resolve(directory, `${brightness}-${gamma}`);
    const result = await recolorCloudSlices({ slices: source.slices, loadResource: async () => source.bytes,
      outputDirectory, encoding: { format: 'png' },
      appearance: { saturation: 1, detailStrength: 0, detailScale: 24, brightness, gamma },
      sampleImageRgb: (_x, _y, _z, out) => { out[0] = 20; out[1] = 40; out[2] = 80; return true; } });
    const rgba = await sharp(await readFile(resolve(outputDirectory, result.slices.quads[0].texturePath))).ensureAlpha().raw().toBuffer();
    assert.deepEqual([...rgba.subarray(4, 7)], [...expected]);
    for (let p = 3; p < rgba.length; p += 4) assert.equal(rgba[p], source.pixels[p]);
  }
});

test('whole-cloud tone also reaches uncovered and black-image neutral material', async t => {
  const outputDirectory = await temporary(t), source = await fixture();
  const result = await recolorCloudSlices({ slices: source.slices, loadResource: async () => source.bytes,
    outputDirectory, encoding: { format: 'png' },
    appearance: { saturation: 1, detailStrength: 0, detailScale: 24, brightness: .5, gamma: 1 },
    sampleImageRgb: (x, _y, _z, out) => { out.fill(0); return x >= 14; } });
  const rgba = await sharp(await readFile(resolve(outputDirectory, result.slices.quads[0].texturePath))).ensureAlpha().raw().toBuffer();
  for (let p = 1; p < 6; p++) {
    assert.deepEqual([...rgba.subarray(p * 4, p * 4 + 3)], [25, 50, 100]);
    assert.equal(rgba[p * 4 + 3], source.pixels[p * 4 + 3]);
  }
});

test('prepared 3D component mixtures preserve their intensity and valid black material without changing alpha', async t => {
  const directory = await temporary(t), source = await fixture();
  for (const [preserveMaterialIntensity, value] of [[false, 127.5], [true, 127.5], [true, 0]] as const) {
    const outputDirectory = resolve(directory, `${preserveMaterialIntensity}-${value}`);
    const result = await recolorCloudSlices({ slices: source.slices, loadResource: async () => source.bytes,
      outputDirectory, encoding: { format: 'png' }, preserveMaterialIntensity,
      sampleImageRgb(_x, _y, _z, out) { out[0] = out[2] = value; out[1] = 0; return true; } });
    for (const quad of result.slices.quads) {
      const rgba = await sharp(await readFile(resolve(outputDirectory, quad.texturePath))).ensureAlpha().raw().toBuffer();
      for (let pixel = 0; pixel < 6; pixel++) {
        assert.equal(rgba[pixel * 4 + 3], source.pixels[pixel * 4 + 3]);
        if (pixel > 0) assert.deepEqual([...rgba.subarray(pixel * 4, pixel * 4 + 3)],
          value === 0 ? [0, 0, 0] : preserveMaterialIntensity ? [128, 0, 128] : [255, 0, 255]);
      }
    }
    assert.deepEqual(result.slices.quads.map(shape), source.slices.quads.map(shape));
  }
});
