import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { defaultOverlayTone, overlayToneSample, updateOverlayTone } from '../../features/legacy-viewer/overlay-tone.ts';
import { createTonePreparer, parseTonePreparationRequest, removalRgba, toneRgba } from './tone.ts';
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

test('tone formula applies ordered levels, gamma, gain; photograph alpha and density RGB stay unchanged', () => {
  const tone = updateOverlayTone(defaultOverlayTone(), { black: .1, white: .9, gamma: 2, brightness: 1.2 });
  assert.equal(overlayToneSample(.1, tone), 0);
  assert.ok(Math.abs(overlayToneSample(.3, tone) - .6) < 1e-12);
  assert.equal(overlayToneSample(.9, tone), 1);
  const pixels = Uint8Array.of(25, 77, 230, 128, 42, 80, 220, 0);
  const image = toneRgba(pixels, 'image', tone), density = toneRgba(pixels, 'density', tone);
  assert.deepEqual([...image], [0, 154, 255, 128, 87, 158, 255, 0]);
  assert.deepEqual([...density.slice(0, 3)], [25, 77, 230]);
  assert.deepEqual([...density.slice(4, 7)], [42, 80, 220]);
  assert.equal(density[3], 217); assert.equal(density[7], 0);
  assert.deepEqual([...pixels], [25, 77, 230, 128, 42, 80, 220, 0]);
  assert.deepEqual(toneRgba(pixels, 'image', defaultOverlayTone()), pixels);
  assert.deepEqual(toneRgba(pixels, 'density', defaultOverlayTone()), pixels);
});

test('tone requests reject arbitrary paths, unrecognized/missing fields and non-finite or invalid levels', () => {
  const valid = { subjectId: 'lmc-particles', target: 'image', imageId: 'smash-original', tone: defaultOverlayTone() };
  assert.deepEqual(parseTonePreparationRequest(valid), valid);
  const removalResultId = `${'a'.repeat(64)}.${'b'.repeat(64)}`;
  assert.equal(parseTonePreparationRequest({ ...valid, removalResultId }).removalResultId, removalResultId);
  for (const invalid of ['', '../result', 'a'.repeat(64), `${removalResultId}/diffuse.png`])
    assert.throws(() => parseTonePreparationRequest({ ...valid, removalResultId: invalid }), TypeError);
  assert.throws(() => parseTonePreparationRequest({ subjectId: 'test', target: 'density', tone: valid.tone, removalResultId }), TypeError);
  for (const bad of [{ ...valid, path: '/etc/passwd' }, { ...valid, subjectId: '../x' }, { ...valid, imageId: '../x' },
    { ...valid, target: 'other' }, { ...valid, target: 'density' }, { ...valid, tone: {} },
    { ...valid, tone: { ...valid.tone, gamma: NaN } }, { ...valid, tone: { ...valid.tone, black: .8, white: .7 } },
    { ...valid, tone: { ...valid.tone, brightness: 0 } }, { ...valid, tone: { ...valid.tone, extra: 1 } }]) {
    assert.throws(() => parseTonePreparationRequest(bad), TypeError);
  }
});

test('removal requests are bounded and image-only; endpoint interpolation precedes tone and preserves alpha', () => {
  const valid = { subjectId: 'test', target: 'image', imageId: 'photo', imageLayer: 'diffuse', tone: defaultOverlayTone() };
  for (const strength of [0, 25.5, 100]) assert.equal(parseTonePreparationRequest({ ...valid, removalStrength: strength }).removalStrength, strength);
  for (const strength of [-1, 101, NaN, Infinity, '50', null])
    assert.throws(() => parseTonePreparationRequest({ ...valid, removalStrength: strength }), TypeError);
  assert.throws(() => parseTonePreparationRequest({ subjectId: 'test', target: 'density', removalStrength: 50, tone: valid.tone }), TypeError);
  const original = Uint8Array.of(200, 100, 80, 90, 120, 70, 20, 0), diffuse = Uint8Array.of(40, 60, 20, 90, 100, 50, 10, 0);
  assert.deepEqual(removalRgba(diffuse, 'diffuse', 0, original), original);
  assert.deepEqual(removalRgba(diffuse, 'diffuse', 100, original), diffuse);
  assert.deepEqual([...removalRgba(diffuse, 'diffuse', 50, original)], [120, 80, 50, 90, 110, 60, 15, 0]);
  assert.deepEqual([...removalRgba(diffuse, 'stars', 0)], [0, 0, 0, 90, 0, 0, 0, 0]);
  assert.deepEqual([...removalRgba(diffuse, 'stars', 25)], [10, 15, 5, 90, 25, 13, 3, 0]);
  assert.throws(() => removalRgba(diffuse, 'diffuse', 50), /matching RGBA/);
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'nebula-tone-'));
  const write = async (path: string, bytes: string | Buffer) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes); };
  const rgba = Buffer.from([20, 80, 200, 90, 70, 100, 130, 0]);
  const image = await sharp(rgba, { raw: { width: 2, height: 1, channels: 4 } }).png().toBuffer();
  const imagePath = 'labs/nebula/models/overlays/prepared/image.png';
  const densityPath = 'labs/nebula/models/density/prepared/slices/z/00.png';
  await write(imagePath, image); await write(densityPath, image);
  await write('labs/nebula/packages/lab/src/state/subjects.json', JSON.stringify([{ id: 'test', density: { directory: 'labs/nebula/models/density', overlays: 'labs/nebula/models/overlays/overlays.json' } }]));
  await write('labs/nebula/models/overlays/overlays.json', JSON.stringify({ overlays: [{ id: 'test-photo', texturePath: 'prepared/image.png', widthPx: 2, heightPx: 1, sha256: hash(image) }] }));
  const manifest = Buffer.from(JSON.stringify({ data: { resources: [{ path: 'slices/z/00.png', sha256: hash(image), width: 2, height: 1 }] } }));
  await write('labs/nebula/models/density/prepared/volume.json', manifest);
  await write('labs/nebula/models/density/object.json', JSON.stringify({ prepared: { format: 'cssearth-density-volume@1', url: 'prepared/volume.json', sha256: hash(manifest) } }));
  return { root, image, rgba, imagePath, densityPath, write };
}
test('saved reconstructions retain inherited Alignment image and density tone targets', async () => {
  const f = await fixture();
  try {
    const resultId = 'a'.repeat(64), subjectId = `reconstruction-${resultId}`;
    const directory = `.local/nebula-lab/reconstructions/${resultId}`;
    const subject = { id: subjectId, directory, density: {
      directory: 'labs/nebula/models/density', overlays: 'labs/nebula/models/overlays/overlays.json' } };
    const manifest = Buffer.from(JSON.stringify({ data: {} }));
    await f.write(`${directory}/volume.json`, manifest);
    await f.write(`${directory}/object.json`, JSON.stringify({ id: subjectId, type: 'density-volume',
      prepared: { url: 'volume.json', sha256: hash(manifest) } }));
    await f.write(`${directory}/result.json`, JSON.stringify({ schema: 'cssearth-nebula-reconstruction@1', resultId, subject }));
    const prepare = createTonePreparer(f.root), tone = { ...defaultOverlayTone(), brightness: .5 };
    for (const target of ['image', 'density'] as const) {
      const result = await prepare({ subjectId, target, ...(target === 'image' ? { imageId: 'test-photo' } : {}), tone });
      const pixels = await sharp(await readFile(result.resources[0].url.slice(4))).ensureAlpha().raw().toBuffer();
      assert.deepEqual([...pixels], [...toneRgba(f.rgba, target, tone)]);
    }
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
test('local preparation writes verifiable pixels, deduplicates concurrent cache work and returns original neutral resources', async () => {
  const f = await fixture();
  try {
    const prepare = createTonePreparer(f.root, { maximumCacheFiles: 1 });
    const request = { subjectId: 'test', target: 'image', imageId: 'test-photo', tone: { ...defaultOverlayTone(), gamma: 2 } };
    const [one, two] = await Promise.all([prepare(request), prepare(request)]);
    assert.deepEqual(one, two);
    assert.equal(one.resources[0].sourcePath, f.imagePath);
    const path = one.resources[0].url.slice(4), before = await stat(path);
    const actual = await sharp(await readFile(path)).ensureAlpha().raw().toBuffer();
    assert.deepEqual([...actual], [...toneRgba(f.rgba, 'image', request.tone)]);
    await prepare(request); const after = await stat(path);
    assert.equal(before.ino, after.ino, 'cache hit must reuse the prepared file');
    const neutral = await prepare({ ...request, tone: defaultOverlayTone() });
    assert.equal(neutral.resources[0].url, `/@fs${join(f.root, f.imagePath)}`);
    assert.deepEqual(await readFile(join(f.root, f.imagePath)), f.image);
    const density = await prepare({ subjectId: 'test', target: 'density', tone: request.tone });
    assert.equal(density.resources[0].sourcePath, f.densityPath);
    const alphaPixels = await sharp(await readFile(density.resources[0].url.slice(4))).ensureAlpha().raw().toBuffer();
    assert.deepEqual([...alphaPixels], [...toneRgba(f.rgba, 'density', request.tone)]);
    assert.equal(alphaPixels[7], 0);
    assert.equal((await readdir(join(f.root, '.local/nebula-lab/tone-cache'))).length, 1, 'old unprotected cache output is bounded');
    await assert.rejects(prepare({ ...request, subjectId: 'unknown' }), /no prepared neutral/);
    await assert.rejects(prepare({ ...request, imageId: 'unknown' }), /Unknown prepared/);
    await f.write(f.imagePath, Buffer.from('changed'));
    await assert.rejects(prepare(request), /unsupported image format|hash differs/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('image tone targets the selected prepared layer and rejects a mismatched original', async () => {
  const f = await fixture();
  try {
    const layerPath = 'labs/nebula/models/separation/diffuse.png';
    const layer = await sharp({ create: { width: 2, height: 1, channels: 4, background: '#123456' } }).png().toBuffer();
    await f.write(layerPath, layer);
    const metadata = { schema: 'cssearth-nebula-overlay-variants@1', variants: [{ imageId: 'test-photo',
      originalTextureSha256: hash(f.image), sourceSha256: hash(f.image), receiptPath: 'receipt.json',
      layers: [{ id: 'diffuse', label: 'Diffuse trial', texturePath: layerPath, widthPx: 2, heightPx: 1, sha256: hash(layer) }] }] };
    const metadataPath = 'labs/nebula/models/lmc/star-separation/variants.json';
    await f.write(metadataPath, JSON.stringify(metadata));
    const prepare = createTonePreparer(f.root), request = { subjectId: 'test', target: 'image', imageId: 'test-photo',
      imageLayer: 'diffuse', tone: defaultOverlayTone() };
    assert.equal((await prepare(request)).resources[0].sourcePath, layerPath);
    assert.equal((await prepare({ ...request, imageLayer: 'original' })).resources[0].sourcePath, f.imagePath);
    await assert.rejects(prepare({ ...request, imageLayer: 'stars' }), /Unknown prepared image layer/);
    await assert.rejects(prepare({ ...request, imageLayer: '../bad' }), TypeError);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('strength uses the selected full-size grid, preserves endpoints, scales residual before tone and caches original pairing', async () => {
  const f = await fixture();
  try {
    const originalPixels = Buffer.from([200, 140, 80, 255, 180, 100, 60, 255, 80, 60, 40, 255, 60, 40, 20, 255,
      200, 140, 80, 255, 180, 100, 60, 255, 80, 60, 40, 255, 60, 40, 20, 255]);
    const original = await sharp(originalPixels, { raw: { width: 4, height: 2, channels: 4 } }).png().toBuffer();
    const diffusePixels = Buffer.from([30, 40, 50, 255, 20, 30, 40, 255]), starPixels = Buffer.from([70, 50, 30, 255, 40, 20, 10, 255]);
    const diffuse = await sharp(diffusePixels, { raw: { width: 2, height: 1, channels: 4 } }).png().toBuffer();
    const stars = await sharp(starPixels, { raw: { width: 2, height: 1, channels: 4 } }).png().toBuffer();
    const diffusePath = 'labs/nebula/models/separation/diffuse.png', starsPath = 'labs/nebula/models/separation/stars.png';
    await f.write(f.imagePath, original); await f.write(diffusePath, diffuse); await f.write(starsPath, stars);
    const catalogue = { overlays: [{ id: 'test-photo', texturePath: 'prepared/image.png', widthPx: 4, heightPx: 2, sha256: hash(original) }] };
    const variants = { schema: 'cssearth-nebula-overlay-variants@1', variants: [{ imageId: 'test-photo', originalTextureSha256: hash(original),
      sourceSha256: hash(original), receiptPath: 'receipt.json', layers: [
        { id: 'diffuse', label: 'Diffuse', texturePath: diffusePath, widthPx: 2, heightPx: 1, sha256: hash(diffuse) },
        { id: 'stars', label: 'Stars', texturePath: starsPath, widthPx: 2, heightPx: 1, sha256: hash(stars) }] }] };
    const saveMetadata = async () => { await f.write('labs/nebula/models/overlays/overlays.json', JSON.stringify(catalogue));
      await f.write('labs/nebula/models/lmc/star-separation/variants.json', JSON.stringify(variants)); };
    await saveMetadata();
    const prepare = createTonePreparer(f.root, { maximumCacheFiles: 2, maximumDecodedCacheBytes: 64 });
    const request = { subjectId: 'test', target: 'image', imageId: 'test-photo', imageLayer: 'diffuse', tone: defaultOverlayTone() };
    const pixels = async (url: string) => sharp(await readFile(url.slice(4))).ensureAlpha().raw().toBuffer();
    const resized = await sharp(original).ensureAlpha().resize(2, 1, { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer();
    const zero = (await prepare({ ...request, removalStrength: 0 })).resources[0];
    assert.equal(zero.sourcePath, diffusePath); assert.equal(zero.width, 2); assert.equal(zero.height, 1);
    assert.deepEqual(await pixels(zero.url), resized, 'zero strength is original on the full endpoint pixel grid');
    assert.equal((await prepare(request)).resources[0].url, `/@fs${join(f.root, diffusePath)}`, 'omitted strength preserves the endpoint');
    assert.equal((await prepare({ ...request, removalStrength: 100 })).resources[0].url, `/@fs${join(f.root, diffusePath)}`);
    assert.equal((await prepare({ ...request, imageLayer: 'original', removalStrength: 0 })).resources[0].url, `/@fs${join(f.root, f.imagePath)}`);
    const tone = { ...defaultOverlayTone(), gamma: 2 }, halfway = (await prepare({ ...request, removalStrength: 50, tone })).resources[0];
    const blend = Uint8Array.from(resized, (value, i) => Math.round((value + diffusePixels[i]) / 2));
    assert.deepEqual([...await pixels(halfway.url)], [...toneRgba(blend, 'image', tone)]);
    const cached = await stat(halfway.url.slice(4));
    assert.equal((await prepare({ ...request, removalStrength: 50, tone })).resources[0].url, halfway.url);
    assert.equal((await stat(halfway.url.slice(4))).ino, cached.ino);
    const residual = (await prepare({ ...request, imageLayer: 'stars', removalStrength: 25, tone })).resources[0];
    const reduced = Uint8Array.from(starPixels, (value, i) => i % 4 === 3 ? value : Math.round(value / 4));
    assert.equal(residual.sourcePath, starsPath);
    assert.deepEqual([...await pixels(residual.url)], [...toneRgba(reduced, 'image', tone)]);
    const changed = await sharp({ create: { width: 4, height: 2, channels: 4, background: '#aa9988' } }).png().toBuffer();
    await f.write(f.imagePath, changed); catalogue.overlays[0].sha256 = hash(changed); variants.variants[0].originalTextureSha256 = hash(changed);
    await saveMetadata();
    const newZero = (await prepare({ ...request, removalStrength: 0 })).resources[0];
    assert.notEqual(newZero.url, zero.url, 'cache key binds the current original source hash');
    assert.notDeepEqual(await pixels(newZero.url), resized);
    assert.deepEqual(await readFile(join(f.root, diffusePath)), diffuse, 'prepared endpoints remain untouched');
    assert.ok((await readdir(join(f.root, '.local/nebula-lab/tone-cache'))).length <= 2);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
