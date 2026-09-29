import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import sharp from 'sharp';
import { createStarRemover, parseRemovalRequest, type RemovalRunner } from './star-removal.ts';

const request = { imageId: 'test-photo', action: 'preview' };
const modelPath = '.local/model.pb';
const script = '# synthetic worker, replaced by the injected runner\n';
const planPath = 'models/test/processing-plan.json';
const cachePath = '.local/nebula-lab/star-removal-nox';

async function fixture(changeResult?: (result: any) => void) {
  const root = await mkdtemp(join(tmpdir(), 'nebula-nox-backend-'));
  const write = async (path: string, bytes: Buffer | string) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes); };
  const json = (path: string, value: unknown) => write(path, JSON.stringify(value));
  const sourceBytes = await sharp({ create: { width: 16, height: 12, channels: 3, background: '#325476' } }).png().toBuffer();
  const empty = await sharp({ create: { width: 16, height: 12, channels: 3, background: '#000' } }).png().toBuffer();
  const overview = await sharp(sourceBytes).resize(8, 6).webp().toBuffer();
  const source = { path: '.local/source.png', nativeDimensions: [16, 12] };
  const recipe = { schema: 'cssearth-star-separation@1', source, outputDirectory: '.local/approved' };
  const gate = JSON.stringify({ pass: true }), geometry = { kind: 'fixed-publisher-wcs', wcs: { projection: 'TAN' } };
  const report = { pass: true, status: 'passed', sources: [{ id: request.imageId, pass: true, status: 'passed', sourcePath: source.path,
    sourceDimensions: source.nativeDimensions, geometry, gate: { path: 'proof/gate.json' } }] };
  await write(source.path, sourceBytes); await write(modelPath, 'synthetic model'); await write('labs/nebula/packages/reconstruction/src/star-removal/star-removal.py', script);
  await json('recipe.json', recipe); await write('proof/gate.json', gate); await json('proof/alignment.json', report);
  await json('catalogue.json', { targets: [{ directory: 'models/test', images: [{ id: request.imageId, ...source, wcs: geometry.wcs }] }] });
  await json('labs/nebula/packages/lab/src/state/subjects.json', [{ id: 'test', density: { processingPlan: planPath } }]);
  await json(planPath, { schema: 'cssearth-image-processing-plan@1', catalogue: 'catalogue.json',
    alignmentReport: { path: 'proof/alignment.json' }, selections: [{ id: request.imageId, recipe: 'recipe.json' }] });
  await write('.local/approved/diffuse.png', sourceBytes);
  await json('.local/approved/receipt.json', { schema: 'cssearth-star-separation-receipt@1', source, recipe: 'recipe.json',
    verification: { maximumReconstructionErrorCodeValues: 0, encodedRoundTripExact: true }, outputs: { 'diffuse.png': { bytes: sourceBytes.length } } });
  await write('models/test/original.webp', overview);
  await json('models/test/overlays.json', { overlays: [{ id: request.imageId, texturePath: 'original.webp', widthPx: 8, heightPx: 6 }] });
  const artifacts = { 'source.png': sourceBytes, 'diffuse.png': sourceBytes, 'stars.png': empty, 'mask.png': empty,
    'overview.webp': overview, 'diffuse.webp': overview, 'stars.webp': await sharp(empty).resize(8, 6).webp().toBuffer(), 'comparison.webp': overview };
  const calls: Record<string, unknown>[] = [];
  const runner: RemovalRunner = async (work, directory, signal, progress) => {
    calls.push(work); signal.throwIfAborted();
    assert.equal((work.source as any).path, await realpath(resolve(root, source.path)));
    assert.equal((work.model as any).path, await realpath(resolve(root, modelPath)));
    progress({ stage: 'inference', current: 1, total: 1, message: 'Completed native tile.' });
    for (const [name, bytes] of Object.entries(artifacts)) await writeFile(join(directory, name), bytes);
    const result: any = { schema: 'cssearth-nox-output@1', operation: work.operation, nativeDimensions: source.nativeDimensions,
      overview: { path: 'overview.webp', dimensions: [8, 6] }, previews: [{ id: 'crop-0', origin: [0, 0], width: 16, height: 12,
        source: 'source.png', removed: 'diffuse.png', mask: 'mask.png', stars: 'stars.png' }],
      artifactBytes: Object.fromEntries(Object.entries(artifacts).map(([name, bytes]) => [name, bytes.length])) };
    if (work.operation === 'apply') result.applied = { images: { diffuse: 'diffuse.png', stars: 'stars.png', mask: 'mask.png' },
      previews: { diffuse: 'diffuse.webp', stars: 'stars.webp', comparison: 'comparison.webp' }, previewDimensions: [8, 6], counts: { removedPixels: 0 },
      verification: { maximumReconstructionErrorCodeValues: 0, changedPixelsOutsideMask: 0, baselineRestoredPixels: 0, encodedRoundTripExact: true, coverageComplete: true } };
    changeResult?.(result); await writeFile(join(directory, 'result.json'), JSON.stringify(result));
  };
  return { root, write, json, source, sourceBytes, overview, calls, runner, remove: createStarRemover(root, { runner, modelPath }) };
}

test('automatic requests accept only image identity and overview, preview or apply', () => {
  for (const action of ['overview', 'preview', 'apply']) assert.deepEqual(parseRemovalRequest({ ...request, action }), { ...request, action });
  for (const input of [{ ...request, action: 'survey' }, { ...request, points: [] }, { ...request, controls: {} },
    { ...request, calibrationToken: 'old' }, { ...request, imageId: '../source' }, { ...request, source: '/tmp/file' }])
    assert.throws(() => parseRemovalRequest(input), TypeError);
});

test('original overview runs no inference; native previews deduplicate, report progress, cache and preserve approved input', async () => {
  const f = await fixture();
  try {
    const overview = await f.remove({ ...request, action: 'overview' }) as any;
    assert.equal(overview.method, 'nox'); assert.equal(f.calls.length, 0);
    const progress: string[] = [];
    const [one, two] = await Promise.all([f.remove(request, undefined, value => progress.push(value.stage)), f.remove(request)]) as any[];
    assert.deepEqual(one, two); assert.equal(f.calls.length, 1); assert.ok(progress.includes('inference'));
    assert.deepEqual(await f.remove(request), one); assert.equal(f.calls.length, 1);
    assert.ok(!one.previews[0].removed.includes('.pending'));
    assert.deepEqual(await readFile(join(f.root, f.source.path)), f.sourceBytes);
    assert.deepEqual(await readdir(join(f.root, cachePath)), [request.imageId], 'a preview is saved under its image name');
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('Apply needs no calibration and its saved result restores after moving the checkout root', async () => {
  const f = await fixture(), moved = await mkdtemp(join(tmpdir(), 'nebula-nox-portable-'));
  try {
    const result = await f.remove({ ...request, action: 'apply' }) as any, token = result.applied.resultId;
    assert.equal(token, request.imageId);
    const manifest = JSON.parse(await readFile(join(f.root, `${cachePath}-applied`, token, 'request.json'), 'utf8'));
    assert.equal(manifest.source.path, f.source.path); assert.equal(manifest.model.path, modelPath);
    assert.equal(manifest.baseline.path, '.local/approved/diffuse.png'); assert.equal(manifest.imageId, request.imageId);
    await cp(f.root, moved, { recursive: true });
    let reruns = 0;
    const restored = createStarRemover(moved, { modelPath, runner: async () => { reruns++; throw new Error('Restore must not infer.'); } });
    const resolved = await restored.resolveApplied(token, request.imageId);
    assert.equal(reruns, 0); assert.equal(resolved.value.layers.length, 2);
    for (const layer of resolved.value.layers) assert.deepEqual(await readFile(join(moved, layer.texturePath)), await readFile(join(f.root, layer.texturePath)));
    await writeFile(join(moved, resolved.value.layers[0].texturePath), 'corrupt preview');
    await assert.rejects(restored.resolveApplied(token, request.imageId));
  } finally { await rm(f.root, { recursive: true, force: true }); await rm(moved, { recursive: true, force: true }); }
});

test('fresh NOX Apply works without legacy detections or separated files', async () => {
  const f = await fixture();
  try {
    await rm(join(f.root, '.local/approved'), { recursive: true });
    const result = await f.remove({ ...request, action: 'apply' }) as any;
    assert.equal(f.calls[0].baseline, undefined); assert.ok(result.applied.resultId);
    assert.equal((await f.remove.resolveApplied(result.applied.resultId, request.imageId)).value.layers.length, 2);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('an imported candidate needs no trial selection, alignment gate, recipe or existing star layers', async () => {
  const f = await fixture();
  try {
    await f.json('labs/nebula/models/image-candidates.json', JSON.parse(await readFile(join(f.root, 'catalogue.json'), 'utf8')));
    for (const path of [planPath, 'recipe.json', 'proof', '.local/approved'])
      await rm(join(f.root, path), { recursive: true });
    const overview = await f.remove({ ...request, action: 'overview' }) as any;
    assert.equal(f.calls.length, 0); assert.deepEqual(overview.nativeDimensions, f.source.nativeDimensions);
    const result = await f.remove({ ...request, action: 'apply' }) as any;
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0].baseline, undefined);
    assert.equal((await f.remove.resolveApplied(result.applied.resultId, request.imageId)).value.layers.length, 2);
    await assert.rejects(f.remove({ ...request, imageId: 'missing-photo' }), /imported original/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('a candidate outside the saved selection processes without changing earlier results', async () => {
  const f = await fixture();
  try {
    const earlier = await f.remove({ ...request, action: 'apply' }) as any;
    const catalogue = JSON.parse(await readFile(join(f.root, 'catalogue.json'), 'utf8'));
    catalogue.targets[0].images.push({ ...catalogue.targets[0].images[0], id: 'new-photo' });
    await f.json('catalogue.json', catalogue);
    const overlays = JSON.parse(await readFile(join(f.root, 'models/test/overlays.json'), 'utf8'));
    overlays.overlays.push({ ...overlays.overlays[0], id: 'new-photo' });
    await f.json('models/test/overlays.json', overlays);
    const added = await f.remove({ ...request, imageId: 'new-photo', action: 'apply' }) as any;
    assert.equal(added.imageId, 'new-photo'); assert.equal(added.applied.resultId, 'new-photo'); assert.equal(f.calls[1].baseline, undefined);
    assert.equal((await f.remove({ ...request, action: 'apply' }) as any).applied.resultId, earlier.applied.resultId);
    assert.equal(f.calls.length, 2);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('relocating catalogue metadata preserves saved native output; a changed source path does not restore it', async () => {
  const f = await fixture();
  try {
    const result = await f.remove({ ...request, action: 'apply' }) as any;
    const plan = JSON.parse(await readFile(join(f.root, planPath), 'utf8'));
    await f.write('organized/catalogue.json', await readFile(join(f.root, plan.catalogue)));
    plan.catalogue = 'organized/catalogue.json'; await f.json(planPath, plan);
    assert.equal((await f.remove.resolveApplied(result.applied.resultId, request.imageId)).value.layers.length, 2);
    assert.equal(f.calls.length, 1);
    await rm(join(f.root, '.local/approved'), { recursive: true });
    await assert.rejects(f.remove.resolveApplied(result.applied.resultId, request.imageId), /another source, baseline or model/);
    assert.equal(f.calls.length, 1);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('16-bit imported images get a separate full-size RGB8 input while their original is preserved', async () => {
  const f = await fixture();
  try {
    const original = await sharp(f.sourceBytes).toColourspace('rgb16').tiff({ compression: 'none' }).toBuffer();
    assert.equal((await sharp(original).metadata()).depth, 'ushort');
    await f.write('.local/colour16.tif', original);
    await f.json('labs/nebula/models/image-candidates.json', { targets: [{ directory: 'models/test',
      images: [{ id: request.imageId, path: '.local/colour16.tif' }] }] });
    await rm(join(f.root, planPath));
    const overview = await f.remove({ ...request, action: 'overview' }) as any;
    assert.equal(f.calls.length, 0); assert.deepEqual(overview.nativeDimensions, [16, 12]);
    const convertedPath = `${cachePath}-inputs/${request.imageId}-rgb8-v1.png`;
    const converted = await readFile(join(f.root, convertedPath));
    const metadata = await sharp(converted).metadata();
    assert.equal(metadata.depth, 'uchar'); assert.equal(metadata.channels, 3);
    assert.deepEqual(await readFile(join(f.root, '.local/colour16.tif')), original);
    assert.deepEqual(await f.remove({ ...request, action: 'overview' }), overview);
    f.source.path = convertedPath;
    const applied = await f.remove({ ...request, action: 'apply' }) as any;
    assert.equal(await f.remove.discoverApplied(request.imageId), applied.applied.resultId);
    assert.equal(f.calls.length, 1);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('native crop bounds and exact accounting are required before atomic publication', async () => {
  for (const mutate of [(value: any) => { value.previews[0].origin = [15, 0]; },
    (value: any) => { value.nativeDimensions = [12, 16]; },
    (value: any) => { value.applied.verification.baselineRestoredPixels = 1; }]) {
    const f = await fixture(mutate);
    try {
      await assert.rejects(f.remove({ ...request, action: 'apply' }), TypeError);
      assert.deepEqual(await readdir(join(f.root, `${cachePath}-applied`)), []);
    } finally { await rm(f.root, { recursive: true, force: true }); }
  }
});

test('cancelling one observer keeps shared inference; cancelling the final observer removes incomplete output', async () => {
  const f = await fixture(); let started!: () => void, stopped = false;
  const ready = new Promise<void>(done => { started = done; });
  const remove = createStarRemover(f.root, { modelPath, runner: async (_work, _directory, signal) => {
    started(); await new Promise<void>((_done, reject) => signal.addEventListener('abort', () => { stopped = true; reject(new DOMException('Cancelled', 'AbortError')); }, { once: true }));
  } });
  try {
    const first = new AbortController(), second = new AbortController();
    const one = remove(request, first.signal), two = remove(request, second.signal);
    const firstRejected = assert.rejects(one, /cancelled/i), secondRejected = assert.rejects(two, /cancelled/i);
    await ready; await delay(20); first.abort(); await firstRejected; assert.equal(stopped, false);
    second.abort(); await secondRejected;
    for (let i = 0; i < 100 && (await readdir(join(f.root, cachePath))).length; i++) await delay(10);
    assert.equal(stopped, true); assert.deepEqual(await readdir(join(f.root, cachePath)), []);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('native discovery restores completed images without launching removal and rejects a changed model path', async () => {
  const f = await fixture();
  try {
    assert.equal(await f.remove.discoverApplied(request.imageId), null);
    assert.equal(f.calls.length, 0);
    const result = await f.remove({ ...request, action: 'apply' }) as any;
    assert.equal(await f.remove.discoverApplied(request.imageId), result.applied.resultId);
    assert.equal(f.calls.length, 1);
    await f.write('.local/other-model.pb', 'another model');
    const otherModel = createStarRemover(f.root, { runner: f.runner, modelPath: '.local/other-model.pb' });
    assert.equal(await otherModel.discoverApplied(request.imageId), null);
    assert.equal(f.calls.length, 1);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('a configured preserve treatment keeps every native pixel, runs no inference and refuses a tampered identity', async () => {
  const f = await fixture();
  try {
    const reason = 'Compact 22 micron knots are dust emission, not stars.';
    await f.json(planPath, { schema: 'cssearth-image-processing-plan@1', catalogue: 'catalogue.json',
      alignmentReport: { path: 'proof/alignment.json' }, selections: [], treatments: [{ id: request.imageId, stellarTreatment: 'preserve', reason }] });
    const result = await f.remove({ ...request, action: 'apply' }) as any;
    assert.equal(result.method, 'preserve');
    assert.equal(f.calls.length, 0, 'the identity treatment never starts the NOX worker');
    const token: string = result.applied.resultId, directory = join(f.root, `${cachePath}-applied`, token);
    const saved = JSON.parse(await readFile(join(directory, 'result.json'), 'utf8'));
    assert.equal(saved.treatment, 'preserve'); assert.equal(saved.reason, reason);
    assert.equal(saved.applied.counts.removedPixels, 0);
    const decoded = await sharp(await readFile(join(directory, 'diffuse.png'))).raw().toBuffer();
    assert.deepEqual(decoded, await sharp(f.sourceBytes).removeAlpha().raw().toBuffer(), 'the preserved diffuse layer is the source itself');
    assert.ok((await sharp(await readFile(join(directory, 'stars.png'))).raw().toBuffer()).every(byte => byte === 0), 'the star layer is empty');
    assert.equal((await f.remove.resolveApplied(token, request.imageId)).value.layers.length, 2);
    // A "preserved" result whose layers are not the identity of the source must never restore.
    const starless = await sharp({ create: { width: 16, height: 12, channels: 3, background: '#0b1d2e' } }).png().toBuffer();
    await writeFile(join(directory, 'diffuse.png'), starless);
    await assert.rejects(f.remove.resolveApplied(token, request.imageId), /identity treatment/);
    // Removing the configured treatment must not silently accept the preserved result as a NOX application.
    await f.json(planPath, { schema: 'cssearth-image-processing-plan@1', catalogue: 'catalogue.json',
      alignmentReport: { path: 'proof/alignment.json' }, selections: [] });
    await assert.rejects(f.remove.resolveApplied(token, request.imageId), /treatment differs|identity treatment|another source/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
