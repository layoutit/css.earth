import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { decodeExrRgbHalf, halfToFloat } from './exr.js';
import { parseSkyRecipe } from './config.js';
import { loadSkySource } from './source.js';
import { SKY_BASES, skyRay, skyUv, sampleLinearSky, displayByte } from './bake.js';
import { sha256 } from '../volume/source.js';
import type { PreparedCssSky } from '../../renderers/css/sky/types.js';

function exrFixture(compressed: boolean): { bytes: Buffer; expected: Buffer } {
  const width = 32, height = 2, zero = Buffer.from([0]), int = (n: number) => { const b = Buffer.alloc(4); b.writeInt32LE(n); return b; };
  const attr = (name: string, type: string, b: Buffer) => Buffer.concat([Buffer.from(name + '\0' + type + '\0'), int(b.length), b]);
  const channels = Buffer.concat(['B', 'G', 'R'].map(name => Buffer.concat([Buffer.from(name + '\0'), int(1), Buffer.alloc(4), int(1), int(1)])));
  const window = Buffer.concat([int(0), int(0), int(width - 1), int(height - 1)]);
  const header = Buffer.concat([int(20000630), int(2), attr('channels', 'chlist', Buffer.concat([channels, zero])), attr('compression', 'compression', Buffer.from([compressed ? 3 : 0])),
    attr('dataWindow', 'box2i', window), attr('lineOrder', 'lineOrder', zero), zero]);
  const expected = Buffer.alloc(width * height * 6), blocks: Buffer[] = [], count = compressed ? 1 : height;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let c = 0; c < 3; c++) expected.writeUInt16LE(0x3000 + y * 32 + x + c * 512, ((y * width + x) * 3 + c) * 2);
  for (let n = 0; n < count; n++) {
    const rows = compressed ? height : 1, start = compressed ? 0 : n, raw = Buffer.alloc(rows * width * 6);
    for (let y = 0; y < rows; y++) for (let c = 0; c < 3; c++) for (let x = 0; x < width; x++) raw.writeUInt16LE(expected.readUInt16LE((((y + start) * width + x) * 3 + 2 - c) * 2), ((y * 3 + c) * width + x) * 2);
    let packed = raw;
    if (compressed) {
      const shuffled = Buffer.alloc(raw.length), half = raw.length / 2;
      for (let i = 0; i < half; i++) { shuffled[i] = raw[i * 2]!; shuffled[i + half] = raw[i * 2 + 1]!; }
      const predicted = Buffer.from(shuffled); for (let i = 1; i < raw.length; i++) predicted[i] = (shuffled[i]! - shuffled[i - 1]! + 128) & 255;
      packed = deflateSync(predicted);
    }
    blocks.push(Buffer.concat([int(start), int(packed.length), packed]));
  }
  const offsets = Buffer.alloc(count * 8); let offset = header.length + offsets.length;
  blocks.forEach((b, i) => { offsets.writeBigUInt64LE(BigInt(offset), i * 8); offset += b.length; });
  return { bytes: Buffer.concat([header, offsets, ...blocks]), expected };
}
test('offline EXR reader decodes ZIP predictor, shuffle and BGR channel order without changing HALF bits', () => {
  for (const compressed of [false, true]) {
    const { bytes, expected } = exrFixture(compressed); assert.deepEqual(decodeExrRgbHalf(bytes).rgb16f, expected);
    const bad = Buffer.from(bytes); bad.writeUInt32LE(514, 4); assert.throws(() => decodeExrRgbHalf(bad), /single-part/);
    assert.throws(() => decodeExrRgbHalf(bytes.subarray(0, bytes.length - 1)));
  }
  assert.equal(halfToFloat(0x3c00), 1); assert.equal(halfToFloat(1), 2 ** -24);
});
test('celestial directions have RA increasing left, north up, and every cube edge has an identical neighbour', () => {
  for (const [ray, uv] of [[[1, 0, 0], [.5, .5]], [[0, 1, 0], [.25, .5]], [[0, -1, 0], [.75, .5]], [[0, 0, 1], [.5, 0]]] as const)
    assert.deepEqual(skyUv([...ray]), [...uv]);
  for (const face of SKY_BASES) for (const [u, v] of [[-1, .25], [1, .25], [.25, -1], [.25, 1]]) {
    const ray = skyRay(face, u!, v!);
    const matches = SKY_BASES.filter(other => other !== face).filter(other => {
      const dot = (b: readonly number[]) => ray.reduce((s, n, i) => s + n * b[i]!, 0), depth = dot(other.forwardIcrf);
      if (depth <= 0) return false;
      const ou = dot(other.rightIcrf) / depth, ov = dot(other.upIcrf) / depth;
      return Math.abs(ou) <= 1 + 1e-12 && Math.abs(ov) <= 1 + 1e-12 && Math.hypot(...skyRay(other, ou, ov).map((n, i) => n - ray[i]!)) < 1e-12;
    });
    assert.equal(matches.length, 1);
  }
});
test('linear filtering happens before the fixed display transfer and wraps right ascension', () => {
  const rgb16f = Buffer.alloc(4 * 2 * 6); for (let i = 0; i < 8; i++) for (let c = 0; c < 3; c++) rgb16f.writeUInt16LE(i % 4 === 0 ? 0x3c00 : 0, i * 6 + c * 2);
  const source = { width: 4, height: 2, rgb16f }, rgb: [number, number, number] = [0, 0, 0];
  sampleLinearSky(source, 0, .5, rgb); assert.deepEqual(rgb, [.5, .5, .5]); assert.equal(displayByte(rgb[0], 1), 188);
  sampleLinearSky(source, 1, .5, rgb); assert.deepEqual(rgb, [.5, .5, .5]);
});
test('actual pinned NASA HALF source is unchanged and unsupported/missing recipes fail', async () => {
  const root = 'src/objects/milky-way/source/sky', raw: unknown = JSON.parse(await readFile(`${root}/recipe.json`, 'utf8')), recipe = parseSkyRecipe(raw);
  const image = await loadSkySource(root, recipe);
  assert.equal(sha256(image.rgb16f), 'aaa66125271df3d95b857bbbafcb0c7055a58372ff173c1f98af1a0778c5b0f6');
  assert.deepEqual([image.width, image.height], [8192, 4096]);
  assert.throws(() => parseSkyRecipe({ ...recipe, projection: { ...recipe.projection, mapping: 'ra-right' } }), /Unsupported/);
  assert.throws(() => parseSkyRecipe({ ...recipe, source: { ...recipe.source, chunks: recipe.source.chunks.slice(1) } }), /every row/);
  const noTransfer = { ...recipe.bake, transfer: undefined }; assert.throws(() => parseSkyRecipe({ ...recipe, bake: noTransfer }), /Unsupported/);
});
test('actual compiled sky image corners retain ICRF orientation after PolyCSS reflection', async () => {
  const volume = JSON.parse(await readFile('src/objects/milky-way/prepared/volume.json', 'utf8')) as { data: { sky: PreparedCssSky } };
  assert(volume.data.sky);
  for (const face of volume.data.sky.faces) {
    const m = face.style.transform.slice(9, -1).split(',').map(Number), width = parseFloat(face.style.width), height = parseFloat(face.style.height);
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1], [.5, .5]]) {
      const x = u! * width, y = v! * height;
      const actual = [(m[1]! * x + m[5]! * y + m[13]!) / 50, (m[0]! * x + m[4]! * y + m[12]!) / 50, (m[2]! * x + m[6]! * y + m[14]!) / 50];
      const expected = face.forwardIcrf.map((f, i) => f + (2 * u! - 1) * face.rightIcrf[i]! + (1 - 2 * v!) * face.upIcrf[i]!);
      assert(Math.hypot(...actual.map((n, i) => n - expected[i]!)) < .025, face.id);
    }
  }
});
