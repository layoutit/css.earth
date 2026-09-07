import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { digest, measureComponents, readBenchmarkImage, writeMethodProducts,
  type ComponentMaps } from './benchmark-products.js';

test('benchmark image loading rejects a changed source before decoding products', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'structure-source-pin-'));
  const path = join(directory, 'source.png');
  const pixels = Buffer.from([255, 0, 0, 0, 255, 0]);
  const bytes = await sharp(pixels, { raw: { width: 2, height: 1, channels: 3 } }).png().toBuffer();
  await writeFile(path, bytes);
  await assert.rejects(readBenchmarkImage(path, '0'.repeat(64), 2, 1), /source pin differs/);
  const image = await readBenchmarkImage(path, digest(bytes), 2, 1);
  assert.ok(Math.abs(image.luminance[0]! - .2126) < 1e-6);
  assert.ok(Math.abs(image.luminance[1]! - .7152) < 1e-6);
});

test('product writer rejects a component-map reconstruction defect', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'structure-products-'));
  const source = new Float32Array([.2, .4]);
  const maps: ComponentMaps = {
    diffuse: new Float32Array([.19, .3]),
    compact: new Float32Array([0, .1]),
    elongated: new Float32Array(2),
    residual: new Float32Array(2),
  };
  const measured = measureComponents(source, maps);
  assert.ok(Math.abs(measured.maxError - .01) < 1e-6);
  await assert.rejects(writeMethodProducts({
    id: 'defective',
    name: 'Defective fixture',
    note: 'Intentional reconstruction error.',
    image: { rgb: Buffer.from([40, 40, 40, 80, 80, 80]), luminance: source, width: 2, height: 1 },
    maps,
    outputDirectory: join(directory, 'products'),
    cacheDirectory: join(directory, 'cache'),
    residualRange: .1,
  }), /source reconstruction failed/);
});

test('positive component over source black stays visible with declared neutral hue', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'structure-black-source-'));
  const method = await writeMethodProducts({ id: 'black-source', name: 'Black source fixture', note: 'Signed background correction.',
    image: { rgb: Buffer.alloc(3), luminance: new Float32Array(1), width: 1, height: 1 },
    maps: { diffuse: new Float32Array([.2]), compact: new Float32Array(1), elongated: new Float32Array(1),
      residual: new Float32Array([-.2]) },
    outputDirectory: join(directory, 'products'), cacheDirectory: join(directory, 'cache'), residualRange: .1 });
  const pixel = await sharp(join(directory, 'products/black-source/diffuse.png')).raw().toBuffer();
  assert.deepEqual([...pixel], [51, 51, 51], 'undefined source hue must not hide positive component signal');
  assert.equal(method.metrics!['Component pixels with undefined source hue'], 1);
});
