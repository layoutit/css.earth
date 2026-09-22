import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { compilerTarget, loadCompilerImages } from './images.ts';
import type { CompilerRequest } from '../../../features/compiler/model.ts';
import type { EvidenceInputs, EvidenceSource } from '@cssearth/nebula-reconstruction/evidence/model';

test('pinned image layers use native rotation, scale, translation and sky offset for every working resolution', async t => {
  const root = await mkdtemp(join(tmpdir(), 'nebula-compiler-image-')); t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.local/nebula-lab/layers'), { recursive: true });
  async function layer(name: string, width: number, height: number, pixel: (x: number, y: number) => number[]) {
    const data = new Uint8Array(width * height * 3);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(pixel(x, y), (y * width + x) * 3);
    const bytes = await sharp(data, { raw: { width, height, channels: 3 } }).png().toBuffer(), path = `.local/nebula-lab/layers/${name}.png`;
    await writeFile(join(root, path), bytes); return { path, width, height, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
  const original = await layer('original', 8, 12, (x, y) => [10 * x + 2 * y, 80 + 3 * x + 5 * y, 40 + 2 * x + y]);
  const diffuse = await layer('diffuse', 4, 3, (x, y) => [10 + 17 * x + 2 * y, 20 + 5 * x + 31 * y, 40 + 11 * x + 7 * y]);
  const stars = await layer('stars', 2, 6, (x, y) => [x * 20, y * 20, 40]);
  const catalogue = { schema: 'cssearth-nebula-observations@1', id: 'test',
    frame: { width: 40, height: 30, fieldArcminutes: [4, 3], centerIcrsDegrees: [10, 0], northUp: true },
    images: ['first', 'second'].map(id => ({ id, label: id, source: { width: 8, height: 12, url: 'https://example.test/original',
      sha256: original.sha256, credit: 'Synthetic fixture', page: 'https://example.test/source' }, layers: { original, diffuse, stars },
      imageToFrame: [1, 0, 0, 1, 2, 3], registration: { status: 'verified', matchedStars: 10, rmsPixels: .1, maxResidualPixels: .2 } })) };
  await writeFile(join(root, 'observations.json'), JSON.stringify(catalogue));
  const request: CompilerRequest = { action: 'apply', imageId: 'compiler', recipePath: 'labs/nebula/models/test/recipe.json', cataloguePath: '.local/nebula-lab/test/catalogue.json',
    imageToFrame: { first: [0, .5, -.5, 0, 20, 7] }, evidence: { sensitivity: 1, weights: [1, 1] }, controls: { detail: .65, faint: .35, depth: 1 } };
  const { images, inspectionBoundsArcsec } = await loadCompilerImages(root, 'observations.json', request, [10, .01]), first = images[0];
  assert.deepEqual(inspectionBoundsArcsec, { min: [-108, -36], max: [0, 36] });
  // Native(3,10) -> frame(15,8.5). At6″/framepixel and−36″ north offset: sky(−30,3).
  const sky = first.pixelToSky(3, 10); assert.ok(Math.abs(sky[0] + 30) < 1e-9); assert.ok(Math.abs(sky[1] - 3) < 1e-9);
  const rgb: [number, number, number] = [0, 0, 0]; assert.equal(first.sampleRgb(-30, 3, rgb), true);
  assert.deepEqual(rgb, [31, 87, 65]);
  // The same native position interpolates original indices(2.5,9.5); this is independent of the diffuse4×3 size.
  assert.equal(first.sampleOriginal(-30, 3, rgb), true); assert.deepEqual(rgb, [44, 135, 54.5]);
  assert.equal(first.sampleRgb(1000, 1000, rgb), false);
  assert.deepEqual(images[1].matrix, [1, 0, 0, 1, 2, 3]);
  // Composite preparation must consume native separation, not the lower-resolution UI layers.
  const nativeDiffuse = await layer('diffuse', 8, 12, (x, y) => [8 + 10 * x + 3 * y, 40 + 5 * x + 7 * y, 10 + 4 * x + y]);
  const nativeStars = await layer('stars', 8, 12, () => [0, 0, 0]);
  const receipt = Buffer.from(JSON.stringify({ schema: 'cssearth-nox-output@1', sourceSha256: 'normalized-source', nativeDimensions: [8, 12],
    artifactSha256: { 'diffuse.png': nativeDiffuse.sha256, 'stars.png': nativeStars.sha256 },
    applied: { verification: { coverageComplete: true, maximumReconstructionErrorCodeValues: 0 } } }));
  await writeFile(join(root, '.local/nebula-lab/layers/result.json'), receipt);
  const nativeCatalogue = { ...catalogue, images: catalogue.images.map(image => ({ ...image, source: { ...image.source, path: original.path },
    removal: { settings: { directory: '.local/nebula-lab/layers' }, sourceSha256: 'normalized-source',
      receiptSha256: createHash('sha256').update(receipt).digest('hex'), diffuseSha256: nativeDiffuse.sha256, residualSha256: nativeStars.sha256 } })) };
  await writeFile(join(root, 'native-observations.json'), JSON.stringify(nativeCatalogue));
  const nativeImages = await loadCompilerImages(root, 'native-observations.json', request, [10, .01], true);
  assert.equal(nativeImages.images[0].diffuse.width, 8); assert.equal(nativeImages.images[0].diffuse.height, 12);
  assert.ok(nativeImages.images[0].sampleRgb(-30, 3, rgb)); assert.deepEqual(rgb, [61.5, 119, 29.5]);
  assert.deepEqual(nativeImages.images[0].pixelToSky(3, 10), sky);
  nativeCatalogue.images[0].removal.diffuseSha256 = '0'.repeat(64);
  await writeFile(join(root, 'native-observations.json'), JSON.stringify(nativeCatalogue));
  await assert.rejects(loadCompilerImages(root, 'native-observations.json', request, [10, .01], true), /separation pins differ/);
});

function targetInputs(): EvidenceInputs {
  const width = 12, height = 8, pixels = width * height;
  const sources: EvidenceSource[] = ['a', 'b'].map(id => ({ id, label: id, sourceSha256: 'a'.repeat(64), mapSha256: 'b'.repeat(64), sourcePanelSha256: 'c'.repeat(64),
    imageToFrame: [1, 0, 0, 1, 0, 0], workingWidth: width, workingHeight: height, registeredRgba: new Uint8Array(pixels * 4), footprint: new Uint8Array(pixels),
    channels: { broad: { signal: new Float32Array(pixels), coverage: new Uint8Array(pixels), noiseSigma: 1 },
      ridges: { signal: new Float32Array(pixels), coverage: new Uint8Array(pixels), noiseSigma: 1 }, compact: { signal: new Float32Array(pixels), coverage: new Uint8Array(pixels), noiseSigma: 1 } },
    ridgeDirectionX: new Float32Array(pixels), ridgeDirectionY: new Float32Array(pixels), samplingArcseconds: 1 }));
  return { identity: 'target-fixture', grid: { width, height, frameWidth: 10, frameHeight: 6, originX: -2, originY: -1, extentWidth: 12, extentHeight: 8,
    fieldArcminutes: [1, .6], arcsecondsPerPixel: 6 }, sources, method: { version: 'test', scaleArcseconds: [], samplingLimitation: '', normalization: '', boundary: '' } };
}
function observe(inputs: EvidenceInputs, source: number, x: number, y: number, value: number) {
  const p = y * inputs.grid.width + x, s = inputs.sources[source]; s.footprint[p] = 1; s.registeredRgba.set([value, value, value, 255], p * 4);
}
test('target retains missing coverage separately from observed zero and maps complete footprint bounds without mutating inputs', () => {
  const inputs = targetInputs();
  for (let y = 1; y < 7; y++) for (let x = 2; x < 6; x++) observe(inputs, 0, x, y, 0);
  observe(inputs, 0, 4, 3, 200);
  const before = structuredClone(inputs), result = compilerTarget(inputs, [1, 1], [7, -11]);
  assert.equal(result.coverage[0], 0); assert.equal(result.target[0], 0);
  assert.equal(result.coverage[2 * 12 + 3], 1); assert.equal(result.target[2 * 12 + 3], 0);
  assert.equal(result.coverage[3 * 12 + 4], 1); assert.ok(result.target[3 * 12 + 4] > 0);
  // Sky x:[(−2−5)×6,(10−5)×6]+7; y:[(3−7)×6,(3+1)×6]−11.
  assert.deepEqual(result.bounds, { min: [-35, -35], max: [37, 13] });
  assert.deepEqual(inputs, before);
});
test('excluded sources supply neither emission nor coverage and unavailable RGB cannot influence a live source target', () => {
  const inputs = targetInputs();
  for (let y = 0; y < 8; y++) for (let x = 0; x < 12; x++) {
    if (x < 6) observe(inputs, 0, x, y, 0); if (x >= 6) observe(inputs, 1, x, y, 0);
  }
  observe(inputs, 0, 3, 3, 180); observe(inputs, 1, 9, 4, 240);
  const both = compilerTarget(inputs, [1, 1]), first = compilerTarget(inputs, [1, 0]);
  assert.ok(both.target[4 * 12 + 9] > 0); assert.equal(first.target[4 * 12 + 9], 0); assert.equal(first.coverage[4 * 12 + 9], 0);
  assert.equal(first.target[3 * 12 + 3], both.target[3 * 12 + 3]);
  const altered = structuredClone(inputs); for (const source of altered.sources) for (let p = 0; p < source.footprint.length; p++) if (!source.footprint[p]) source.registeredRgba.set([255, 255, 255, 255], p * 4);
  assert.deepEqual(compilerTarget(altered, [1, 0]), first);
  const empty = compilerTarget(inputs, [0, 0]); assert.ok(empty.target.every(v => v === 0)); assert.ok(empty.coverage.every(v => v === 0));
});
