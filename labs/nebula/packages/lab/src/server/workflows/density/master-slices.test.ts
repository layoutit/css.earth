import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { bakeMasterVolumeSlices, deriveMasterVolumeSlices, type MasterVolumeOptions, type VolumeSliceQuad } from '@cssearth/bake/volume/node';
import { sha256 } from '@cssearth/core/node';
import { compileCssVolume } from '../../../adapters/preparation/css-volume.ts';
import { validatePreparedCssVolume } from '../../../adapters/renderer/volume-validation.ts';
import type { VolumeRecipe } from '@cssearth/bake/volume';

async function temporary(t: { after(fn: () => Promise<void>): void }) {
  await mkdir(resolve('.local/nebula-lab'), { recursive: true });
  const directory = await mkdtemp(resolve('.local/nebula-lab/master-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}
function options(directory: string): MasterVolumeOptions {
  return { sampleEmission: (_x, _y, _z, out) => { out[0] = 1; out[1] = 0.5; out[2] = 0.25; },
    boundsKpc: { min: [0, 0, 0], max: [1, 1, 1] }, sliceCounts: { x: 1, y: 1, z: 1 },
    samplesPerSlab: 2, exposureGain: 1, masterWidth: 4, masterDirectory: resolve(directory, 'masters'),
    deliveryBanks: [], unitsPerSourceUnit: 1, provenance: { source: 'Deterministic test optical field' }, onProgress: () => {} };
}
async function raster(directory: string, quad: VolumeSliceQuad) {
  const bytes = await readFile(resolve(directory, quad.texturePath));
  assert.equal(bytes.length, quad.bytes); assert.equal(sha256(bytes), quad.sha256);
  const result = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(result.info.width, quad.widthPx); assert.equal(result.info.height, quad.heightPx);
  return result.data;
}

test('direct masters retain 64 slabs per axis, physical units, fine sampler detail and shared-opacity columns', async t => {
  const directory = await temporary(t), config = options(directory);
  let calls = 0;
  const progress: { phase: string; completed: number }[] = [];
  config.masterWidth = 16; config.sliceCounts = { x: 64, y: 64, z: 64 }; config.unitsPerSourceUnit = 7;
  config.exposureGain = 2;
  config.sampleEmission = (x, _y, z, out) => {
    calls++;
    // Fine alternating photo-color stripes are evaluated at native master pixels,
    // while the common nonuniform depth profile has an exact integral of one.
    const green = Math.floor(x * 16) % 2 ? 0.5 : 0.25;
    out[0] = Math.log(5) / 2 * 2 * z;
    out[1] = out[0] * green; out[2] = out[0] * 0.25;
  };
  config.deliveryBanks = [{ width: 8, outputDirectory: resolve(directory, 'delivery'), imageEncoding: { format: 'png' } }];
  config.onProgress = value => progress.push(value);
  const { masters, banks } = await bakeMasterVolumeSlices(config);
  assert.equal(calls, 16 * 16 * 64 * 3 * 2);
  assert.equal(masters.quads.length, 192); assert.equal(banks[0]!.slices.quads.length, 192);
  assert.deepEqual(masters.boundsUnits, { min: [0, 0, 0], max: [7, 7, 7] });
  assert.deepEqual(masters.approximation.slabPitchUnits, { x: 7 / 64, y: 7 / 64, z: 7 / 64 });
  assert.equal(masters.approximation.emissionTransfer, 'shared-opacity');
  assert.equal(masters.approximation.samplesPerSlab, 2);
  assert.ok(masters.approximation.limitations.some(value => value.includes('alias')));
  assert.ok(progress.some(value => value.phase === 'master' && value.completed === 192));
  assert.ok(progress.some(value => value.phase === 'delivery' && value.completed === 192));
  const rgb = [0, 0, 0];
  for (const quad of masters.quads.filter(quad => quad.axis === 'z')) {
    const data = await raster(config.masterDirectory, quad), at = 4 * (8 * 16 + 9), alpha = data[at + 3]! / 255;
    for (let c = 0; c < 3; c++) rgb[c] = data[at + c]! / 255 * alpha + rgb[c]! * (1 - alpha);
  }
  for (const [c, target] of [0.8, 0.4, 0.2].entries()) {
    assert.ok(Math.abs(rgb[c]! - target) < 0.008, `${rgb} should recover [0.8,0.4,0.2] through ordinary source-over`);
  }
  const masterLast = masters.quads.find(quad => quad.id === 'z-63')!;
  const masterPixels = await raster(config.masterDirectory, masterLast);
  assert.equal(masterPixels[4 * 8 + 1], 64); assert.equal(masterPixels[4 * 9 + 1], 128);
  const deliveryPixels = await raster(config.deliveryBanks[0]!.outputDirectory, banks[0]!.slices.quads.find(quad => quad.id === 'z-63')!);
  assert.equal(deliveryPixels[4 * 4 + 1], 96, 'Delivery averages the resolved neighboring master stripes.');
  assert.equal(masters.quads[0]!.vertices[0][0], 7 / 128, 'Changing geometry scale cannot change optical step length.');
});

test('delivery reads pinned PNG masters, averages premultiplied color and maps cropped pixel edges into physical quads', async t => {
  const directory = await temporary(t), config = options(directory);
  const { masters } = await bakeMasterVolumeSlices(config);
  // Top-left quarter is opaque red. The rest deliberately contains invisible
  // green: a straight-RGB resize would produce a visible green fringe.
  const rgba = Buffer.alloc(4 * 4 * 4);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const at = 4 * (y * 4 + x), visible = x < 2 && y < 2;
    rgba[at] = visible ? 255 : 0; rgba[at + 1] = visible ? 0 : 255; rgba[at + 3] = visible ? 255 : 0;
  }
  const png = await sharp(rgba, { raw: { width: 4, height: 4, channels: 4 } }).png().toBuffer();
  for (const quad of masters.quads) {
    await writeFile(resolve(config.masterDirectory, quad.texturePath), png);
    quad.bytes = png.length; quad.sha256 = sha256(png); quad.alphaCoverage = 0.25;
  }
  const deliveryBanks = [2, 1].map(width => ({ width, outputDirectory: resolve(directory, `delivery-${width}`),
    imageEncoding: { format: 'png' as const } }));
  const banks = await deriveMasterVolumeSlices({ masters, masterDirectory: config.masterDirectory, deliveryBanks, onProgress: () => {} });
  for (const [index, bank] of banks.entries()) for (const quad of bank.slices.quads) {
    const decoded = await raster(deliveryBanks[index]!.outputDirectory, quad);
    assert.deepEqual([...decoded], [255, 0, 0, bank.width === 2 ? 255 : 64]);
    assert.equal(quad.widthPx, 1); assert.equal(quad.heightPx, 1);
    const master = masters.quads.find(item => item.id === quad.id)!;
    assert.deepEqual(quad.vertices[0], master.vertices[0]);
    const fraction = bank.width === 2 ? 0.5 : 1;
    for (let corner = 1; corner < 4; corner++) {
      assert.deepEqual(quad.vertices[corner], master.vertices[corner]!.map((value, axis) =>
        master.vertices[0][axis]! + fraction * (value - master.vertices[0][axis]!)));
    }
    assert.deepEqual(quad.normal, master.normal);
  }
  // The real compiler and runtime validator accept both derived physical banks.
  const recipe: VolumeRecipe = { schema: 'cssearth-volume-recipe@1',
    grid: { path: 'unused.gz', dimensions: [1, 1, 1],
      encoding: 'linear-density-unorm8', bounds: config.boundsKpc },
    material: { emission: [{ channel: 0, color: [1, 1, 1], strength: 1 }], absorption: [], intensityScale: 1,
      stepScale: 1, exposureGain: 1, emissionTransfer: 'shared-opacity' },
    bake: { sliceCounts: config.sliceCounts, unitsPerSourceUnit: 1, imageWidth: 4,
      samplesPerSlab: 2, cropTransparent: true, opticalWeight: 1 }, anchors: [],
    provenance: { path: 'provenance.json' } };
  for (const bank of banks) {
    const prepared = compileCssVolume({ id: 'optical-test', slices: bank.slices, recipe,
      frame: { referenceFrame: 'icrf-j2000', epochJdTt: 2451545, originM: [0, 0, 0],
        localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 3.085677581491367e19, boundsUnits: masters.boundsUnits } });
    validatePreparedCssVolume(prepared); assert.equal(prepared.resources.length, 3);
    assert.ok(prepared.stacks.every(stack => stack.leaves.length === 1));
  }
  const rederived = await deriveMasterVolumeSlices({ masters, masterDirectory: config.masterDirectory,
    deliveryBanks: [{ ...deliveryBanks[0]!, outputDirectory: resolve(directory, 'rederived') }], onProgress: () => {} });
  assert.deepEqual(rederived[0]!.slices, banks[0]!.slices, 'Changing delivery output does not resample the field.');
  const webp = await deriveMasterVolumeSlices({ masters, masterDirectory: config.masterDirectory,
    deliveryBanks: [{ width: 1, outputDirectory: resolve(directory, 'webp') }], onProgress: () => {} });
  assert.ok(webp[0]!.slices.quads.every(quad => quad.texturePath.endsWith('.webp')));
  assert.equal((await raster(resolve(directory, 'webp'), webp[0]!.slices.quads[0]!))[3], 64);
  await writeFile(resolve(config.masterDirectory, masters.quads[0]!.texturePath), Buffer.from('drifted'));
  await assert.rejects(deriveMasterVolumeSlices({ masters, masterDirectory: config.masterDirectory, deliveryBanks }), /Master bytes changed/);
});

test('delivery height uses physical aspect before rounding and invalid field samples are rejected', async t => {
  const directory = await temporary(t), config = options(directory);
  config.boundsKpc.max = [1, 1, 1.37]; config.masterWidth = 7;
  config.deliveryBanks = [{ width: 4, outputDirectory: resolve(directory, 'delivery'), imageEncoding: { format: 'png' } }];
  const { masters, banks } = await bakeMasterVolumeSlices(config);
  assert.equal(masters.quads[0]!.heightPx, 10);
  assert.equal(banks[0]!.slices.quads[0]!.heightPx, 5, 'Round 4×1.37, not the already-rounded 10/7 image ratio.');
  assert.deepEqual(banks[0]!.slices.quads[0]!.vertices, masters.quads[0]!.vertices);
  await assert.rejects(deriveMasterVolumeSlices({ masters, masterDirectory: config.masterDirectory,
    deliveryBanks: [{ width: 8, outputDirectory: resolve(directory, 'upscale') }] }), /must not upscale/);
  config.sampleEmission = (_x, _y, _z, out) => { out[0] = NaN; out[1] = out[2] = 0; };
  await assert.rejects(bakeMasterVolumeSlices(config), /finite nonnegative optical RGB/);
});

test('faint optical light survives 48/96 slab quantization with the same integrated brightness and hue', async t => {
  const directory = await temporary(t), config = options(directory);
  config.masterWidth = 2; config.sliceCounts = { x: 48, y: 48, z: 96 };
  config.sampleEmission = (_x, _y, _z, out) => { out[0] = .05; out[1] = .025; out[2] = .0125; };
  const { masters } = await bakeMasterVolumeSlices(config);
  assert.match(masters.approximation.method, /optical-rgb-error-carry@1/);
  const composites: number[][] = [];
  for (const axis of ['x', 'y', 'z']) {
    const composite = [0, 0, 0], optical = [0, 0, 0];
    for (const quad of masters.quads.filter(q => q.axis === axis)) {
      const pixels = await raster(config.masterDirectory, quad), alpha = pixels[3]! / 255;
      for (let c = 0; c < 3; c++) {
        composite[c] = composite[c]! * (1 - alpha) + pixels[c]! / 255 * alpha;
        optical[c] += -Math.log1p(-alpha) * pixels[c]! / 255;
      }
    }
    const display = -Math.expm1(-.05);
    for (let c = 0; c < 3; c++) {
      assert.ok(Math.abs(composite[c]! - display * [1, .5, .25][c]!) < .002, `${axis} display ${composite}`);
      assert.ok(Math.abs(optical[c]! - [.05, .025, .0125][c]!) < .002, `${axis} optical ${optical}`);
    }
    composites.push(composite);
  }
  for (let c = 0; c < 3; c++) assert.ok(Math.max(...composites.map(v => v[c]!)) - Math.min(...composites.map(v => v[c]!)) < .0015);
  // Mutation: independently rounding the original slabs discards ALL this light.
  const oldAlpha = Math.round(-Math.expm1(-.05 / 96) * 255) / 255;
  assert.equal(oldAlpha, 0);
  assert.ok(Math.abs((1 - (1 - oldAlpha) ** 96) - (-Math.expm1(-.05))) > .002);
});

test('RGB error carry preserves faint colored layers and never deposits residuals in empty support', async t => {
  const directory = await temporary(t), config = options(directory);
  config.masterWidth = 2; config.sliceCounts = { x: 48, y: 48, z: 96 };
  config.sampleEmission = (_x, _y, z, out) => {
    out[0] = out[1] = out[2] = 0;
    if (z > .25 && z < .75) return;
    // Alternating faint red/blue slabs expose hue loss from scalar-only alpha carry.
    out[Math.floor(z * 96) % 2 === 0 ? 0 : 2] = .16;
  };
  const { masters } = await bakeMasterVolumeSlices(config), optical = [0, 0, 0], composite = [0, 0, 0];
  let emptySlabs = 0, visibleSlabs = 0;
  for (const quad of masters.quads.filter(q => q.axis === 'z')) {
    const pixels = await raster(config.masterDirectory, quad), alpha = pixels[3]! / 255;
    if (quad.center[2] > .25 && quad.center[2] < .75) {
      assert.ok(pixels.every(byte => byte === 0), `Empty ${quad.id} gained residual light`); emptySlabs++;
    } else if (alpha > 0) visibleSlabs++;
    for (let c = 0; c < 3; c++) {
      optical[c] += -Math.log1p(-alpha) * pixels[c]! / 255;
      composite[c] = composite[c]! * (1 - alpha) + pixels[c]! / 255 * alpha;
    }
  }
  assert.equal(emptySlabs, 48); assert.ok(visibleSlabs > 0);
  assert.equal(optical[1], 0);
  assert.ok(Math.abs(optical[0]! - .04) < .002, `Red ${optical[0]}`);
  assert.ok(Math.abs(optical[2]! - .04) < .002, `Blue ${optical[2]}`);
  assert.ok(Math.abs(composite[0]! - composite[2]!) < .003, `Thin balanced layers acquired a hue bias: ${composite}`);
});
