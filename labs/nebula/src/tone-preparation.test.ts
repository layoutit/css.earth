import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { defaultOverlayTone, overlayToneSample, updateOverlayTone } from './overlay-tone.js';
import { createTonePreparer, parseTonePreparationRequest, toneRgba } from './tone-preparation.js';
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
  for (const bad of [{ ...valid, path: '/etc/passwd' }, { ...valid, subjectId: '../x' }, { ...valid, imageId: '../x' },
    { ...valid, target: 'other' }, { ...valid, target: 'density' }, { ...valid, tone: {} },
    { ...valid, tone: { ...valid.tone, gamma: NaN } }, { ...valid, tone: { ...valid.tone, black: .8, white: .7 } },
    { ...valid, tone: { ...valid.tone, brightness: 0 } }, { ...valid, tone: { ...valid.tone, extra: 1 } }]) {
    assert.throws(() => parseTonePreparationRequest(bad), TypeError);
  }
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'nebula-tone-'));
  const write = async (path: string, bytes: string | Buffer) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes); };
  const rgba = Buffer.from([20, 80, 200, 90, 70, 100, 130, 0]);
  const image = await sharp(rgba, { raw: { width: 2, height: 1, channels: 4 } }).png().toBuffer();
  const imagePath = 'labs/nebula/models/overlays/prepared/image.png';
  const densityPath = 'labs/nebula/models/density/prepared/slices/z/00.png';
  await write(imagePath, image); await write(densityPath, image);
  await write('labs/nebula/src/subjects.json', JSON.stringify([{ id: 'test', density: { directory: 'labs/nebula/models/density', overlays: 'labs/nebula/models/overlays/overlays.json' } }]));
  await write('labs/nebula/models/overlays/overlays.json', JSON.stringify({ overlays: [{ id: 'test-photo', texturePath: 'prepared/image.png', widthPx: 2, heightPx: 1, sha256: hash(image) }] }));
  const manifest = Buffer.from(JSON.stringify({ data: { resources: [{ path: 'slices/z/00.png', sha256: hash(image), width: 2, height: 1 }] } }));
  await write('labs/nebula/models/density/prepared/volume.json', manifest);
  await write('labs/nebula/models/density/object.json', JSON.stringify({ prepared: { format: 'cssearth-density-volume@1', url: 'prepared/volume.json', sha256: hash(manifest) } }));
  return { root, image, rgba, imagePath, densityPath, write };
}
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
    await assert.rejects(prepare(request), /hash differs/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
