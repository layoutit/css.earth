import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import sharp from 'sharp';
import { createStarRemover, parseRemovalRequest, type RemovalRunner } from './star-removal-preparation.js';

const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const request = { imageId: 'test-photo', action: 'preview' };
const modelPin = { path: '.local/model.pb', sha256: hash('synthetic pinned model') };
const script = '# synthetic worker, replaced by the injected runner\n';
const planPath = 'labs/nebula/models/lmc-star-separation/plan.json';
const cachePath = '.local/nebula-lab/star-removal-nox';

async function fixture(changeResult?: (result: any) => void) {
  const root = await mkdtemp(join(tmpdir(), 'nebula-nox-backend-'));
  const write = async (path: string, bytes: Buffer | string) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes); };
  const json = (path: string, value: unknown) => write(path, JSON.stringify(value));
  const sourceBytes = await sharp({ create: { width: 16, height: 12, channels: 3, background: '#325476' } }).png().toBuffer();
  const empty = await sharp({ create: { width: 16, height: 12, channels: 3, background: '#000' } }).png().toBuffer();
  const overview = await sharp(sourceBytes).resize(8, 6).webp().toBuffer();
  const source = { path: '.local/source.png', sha256: hash(sourceBytes), nativeDimensions: [16, 12] };
  const recipe = { schema: 'cssearth-star-separation@1', source, outputDirectory: '.local/approved' }, recipeBytes = JSON.stringify(recipe);
  const gate = JSON.stringify({ pass: true }), geometry = { kind: 'fixed-publisher-wcs', wcs: { projection: 'TAN' } };
  const report = { pass: true, status: 'passed', sources: [{ id: request.imageId, pass: true, status: 'passed', sourcePath: source.path,
    sourceSha256: source.sha256, sourceDimensions: source.nativeDimensions, geometry, gate: { path: 'proof/gate.json', sha256: hash(gate) } }] };
  const reportBytes = JSON.stringify(report);
  await write(source.path, sourceBytes); await write(modelPin.path, 'synthetic pinned model'); await write('labs/nebula/src/star-removal.py', script);
  await write('recipe.json', recipeBytes); await write('proof/gate.json', gate); await write('proof/alignment.json', reportBytes);
  await json('catalogue.json', { targets: [{ directory: 'models/test', images: [{ id: request.imageId, ...source, wcs: geometry.wcs }] }] });
  await json(planPath, { schema: 'cssearth-image-processing-plan@1', catalogue: 'catalogue.json',
    alignmentReport: { path: 'proof/alignment.json', sha256: hash(reportBytes) }, selections: [{ id: request.imageId, recipe: 'recipe.json', recipeSha256: hash(recipeBytes) }] });
  await write('.local/approved/diffuse.png', sourceBytes);
  await json('.local/approved/receipt.json', { schema: 'cssearth-star-separation-receipt@1', sourceSha256: source.sha256,
    recipeSha256: hash(recipeBytes), verification: { maximumReconstructionErrorCodeValues: 0, encodedRoundTripExact: true }, outputs: { 'diffuse.png': { sha256: hash(sourceBytes) } } });
  await write('models/test/original.webp', overview);
  await json('models/test/overlays.json', { overlays: [{ id: request.imageId, texturePath: 'original.webp', sha256: hash(overview), widthPx: 8, heightPx: 6 }] });
  await json('labs/nebula/models/lmc-star-separation/variants.json', { schema: 'cssearth-nebula-overlay-variants@1', variants: [{ imageId: request.imageId,
    sourceSha256: source.sha256, originalTextureSha256: hash(overview), receiptPath: '.local/approved/receipt.json',
    layers: [{ id: 'diffuse', label: 'Approved diffuse', texturePath: 'unused.webp', sha256: hash(overview), widthPx: 8, heightPx: 6 }] }] });
  const artifacts = { 'source.png': sourceBytes, 'diffuse.png': sourceBytes, 'stars.png': empty, 'mask.png': empty,
    'overview.webp': overview, 'diffuse.webp': overview, 'stars.webp': await sharp(empty).resize(8, 6).webp().toBuffer(), 'comparison.webp': overview };
  const calls: Record<string, unknown>[] = [];
  const runner: RemovalRunner = async (work, directory, signal, progress) => {
    calls.push(work); signal.throwIfAborted();
    assert.equal((work.source as any).path, await realpath(resolve(root, source.path)));
    assert.equal((work.model as any).path, await realpath(resolve(root, modelPin.path)));
    progress({ stage: 'inference', current: 1, total: 1, message: 'Completed native tile.' });
    for (const [name, bytes] of Object.entries(artifacts)) await writeFile(join(directory, name), bytes);
    const result: any = { schema: 'cssearth-nox-output@1', operation: work.operation, sourceSha256: source.sha256,
      scriptSha256: hash(script), modelSha256: modelPin.sha256, baselineSha256: work.baseline ? source.sha256 : null, nativeDimensions: source.nativeDimensions,
      overview: { path: 'overview.webp', dimensions: [8, 6] }, previews: [{ id: 'crop-0', origin: [0, 0], width: 16, height: 12,
        source: 'source.png', removed: 'diffuse.png', mask: 'mask.png', stars: 'stars.png' }],
      artifactSha256: Object.fromEntries(Object.entries(artifacts).map(([name, bytes]) => [name, hash(bytes)])) };
    if (work.operation === 'apply') result.applied = { images: { diffuse: 'diffuse.png', stars: 'stars.png', mask: 'mask.png' },
      previews: { diffuse: 'diffuse.webp', stars: 'stars.webp', comparison: 'comparison.webp' }, previewDimensions: [8, 6], counts: { removedPixels: 0 },
      verification: { maximumReconstructionErrorCodeValues: 0, changedPixelsOutsideMask: 0, baselineRestoredPixels: 0, encodedRoundTripExact: true, coverageComplete: true } };
    changeResult?.(result); await writeFile(join(directory, 'result.json'), JSON.stringify(result));
  };
  return { root, write, json, source, sourceBytes, overview, calls, runner, remove: createStarRemover(root, { runner, modelPin }) };
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
    await f.write(f.source.path, 'changed native source');
    await assert.rejects(f.remove(request), /hash differs/); assert.equal(f.calls.length, 1);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('Apply needs no calibration and its verified cache restores after moving the checkout root', async () => {
  const f = await fixture(), moved = await mkdtemp(join(tmpdir(), 'nebula-nox-portable-'));
  try {
    const result = await f.remove({ ...request, action: 'apply' }) as any, token = result.applied.resultId;
    const manifest = JSON.parse(await readFile(join(f.root, `${cachePath}-applied`, token.split('.')[0], 'request.json'), 'utf8'));
    assert.equal(manifest.source.path, f.source.path); assert.equal(manifest.model.path, modelPin.path);
    assert.equal(manifest.baseline.path, '.local/approved/diffuse.png');
    await cp(f.root, moved, { recursive: true });
    let reruns = 0;
    const restored = createStarRemover(moved, { modelPin, runner: async () => { reruns++; throw new Error('Restore must not infer.'); } });
    const resolved = await restored.resolveApplied(token, request.imageId, hash(f.overview));
    assert.equal(reruns, 0); assert.equal(resolved.value.layers.length, 2);
    for (const layer of resolved.value.layers) assert.equal(hash(await readFile(join(moved, layer.texturePath))), layer.sha256);
    await assert.rejects(restored.resolveApplied(token, request.imageId, '0'.repeat(64)), /original preview differs/);
    await writeFile(join(moved, resolved.value.layers[0].texturePath), 'corrupt preview');
    await assert.rejects(restored.resolveApplied(token, request.imageId, hash(f.overview)), /hash differs/);
  } finally { await rm(f.root, { recursive: true, force: true }); await rm(moved, { recursive: true, force: true }); }
});

test('fresh NOX Apply works without legacy detections, separated files or variant catalogue', async () => {
  const f = await fixture();
  try {
    await rm(join(f.root, '.local/approved'), { recursive: true });
    await rm(join(f.root, 'labs/nebula/models/lmc-star-separation/variants.json'));
    const result = await f.remove({ ...request, action: 'apply' }) as any;
    assert.equal(f.calls[0].baseline, undefined); assert.ok(result.applied.resultId);
    assert.equal((await f.remove.resolveApplied(result.applied.resultId, request.imageId, hash(f.overview))).value.layers.length, 2);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('an imported candidate needs no trial selection, alignment gate, recipe or existing star layers', async () => {
  const f = await fixture();
  try {
    await f.json('labs/nebula/models/image-candidates.json', JSON.parse(await readFile(join(f.root, 'catalogue.json'), 'utf8')));
    for (const path of [planPath, 'recipe.json', 'proof', '.local/approved', 'labs/nebula/models/lmc-star-separation/variants.json'])
      await rm(join(f.root, path), { recursive: true });
    const overview = await f.remove({ ...request, action: 'overview' }) as any;
    assert.equal(f.calls.length, 0); assert.equal(overview.sourceSha256, f.source.sha256);
    const result = await f.remove({ ...request, action: 'apply' }) as any;
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0].baseline, undefined);
    assert.equal((await f.remove.resolveApplied(result.applied.resultId, request.imageId, hash(f.overview))).value.layers.length, 2);
    await assert.rejects(f.remove({ ...request, imageId: 'missing-photo' }), /imported original/);
    await f.write(f.source.path, 'changed original');
    await assert.rejects(f.remove(request), /hash differs/);
    assert.equal(f.calls.length, 1);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('a candidate outside the saved selection processes without changing earlier result identities', async () => {
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
    assert.equal(added.imageId, 'new-photo'); assert.equal(f.calls[1].baseline, undefined);
    assert.equal((await f.remove({ ...request, action: 'apply' }) as any).applied.resultId, earlier.applied.resultId);
    assert.equal(f.calls.length, 2);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('16-bit imported images get a separate full-size RGB8 input while their original is preserved', async () => {
  const f = await fixture();
  try {
    const original = await sharp(f.sourceBytes).toColourspace('rgb16').tiff({ compression: 'none' }).toBuffer();
    assert.equal((await sharp(original).metadata()).depth, 'ushort');
    await f.write('.local/colour16.tif', original);
    await f.json('labs/nebula/models/image-candidates.json', { targets: [{ directory: 'models/test',
      images: [{ id: request.imageId, path: '.local/colour16.tif', sha256: hash(original) }] }] });
    await rm(join(f.root, planPath));
    const overview = await f.remove({ ...request, action: 'overview' }) as any;
    assert.equal(f.calls.length, 0); assert.deepEqual(overview.nativeDimensions, [16, 12]);
    const converted = await readFile(join(f.root, `${cachePath}-inputs/${hash(original)}-rgb8-v1.png`));
    const metadata = await sharp(converted).metadata();
    assert.equal(metadata.depth, 'uchar'); assert.equal(metadata.channels, 3);
    assert.equal(overview.sourceSha256, hash(converted));
    assert.deepEqual(await readFile(join(f.root, '.local/colour16.tif')), original);
    assert.deepEqual(await f.remove({ ...request, action: 'overview' }), overview);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('output pins, native crop bounds and exact accounting are required before atomic publication', async () => {
  for (const mutate of [(value: any) => { value.previews[0].origin = [15, 0]; },
    (value: any) => { value.artifactSha256['mask.png'] = '0'.repeat(64); },
    (value: any) => { value.modelSha256 = '0'.repeat(64); },
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
  const remove = createStarRemover(f.root, { modelPin, runner: async (_work, _directory, signal) => {
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
