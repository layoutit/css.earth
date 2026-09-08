import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';
import { createStarSampler, parseSamplingRequest, resolveAppliedSamplingLayers, starSamplingPlugin, type SamplerRunner, type SamplingProgress } from './star-sampling-preparation.js';
import type { StarSample } from './star-sampling-types.js';
import { createTonePreparer, toneRgba } from './tone-preparation.js';
import { defaultOverlayTone } from './overlay-tone.js';

const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const request = { imageId: 'test-photo', action: 'inspect', point: { x: 8, y: 6 } };
const planPath = 'labs/nebula/models/lmc-star-separation/plan.json';
type Result = { schema: string; operation: unknown; sourceSha256: string; nativeDimensions: number[];
  overview: { path: string; dimensions: number[] }; samples: (StarSample & { requestedPoint: { x: number; y: number }; previewAccountingExact: boolean })[];
  calibration: Record<string, unknown>; limitations: string[]; artifactSha256?: Record<string, string>;
  validationSamples?: (StarSample & { accepted: boolean; profileId: string | null; reasons: string[]; modelKind: string;
    images: StarSample['images'] & { mask?: string } })[] };

test('sampling accepts bounded native points and rejects arbitrary paths, actions and unbounded controls', () => {
  assert.deepEqual(parseSamplingRequest(request), request);
  assert.equal(parseSamplingRequest({ imageId: request.imageId, action: 'overview' }).action, 'overview');
  assert.equal(parseSamplingRequest({ imageId: request.imageId, action: 'survey', options: { sampleCount: 20, maximumRadius: 16 } }).action, 'survey');
  assert.equal(parseSamplingRequest({ imageId: request.imageId, action: 'preview', points: [request.point],
    controls: { widthScale: 3, amplitudeScale: 0, betaOverride: null } }).action, 'preview');
  for (const invalid of [{ ...request, sourcePath: '/tmp/source.png' }, { ...request, imageId: '../source' },
    { ...request, action: 'extract' }, { ...request, point: undefined }, { ...request, point: { x: -1, y: 0 } },
    { ...request, point: { x: NaN, y: 0 } }, { ...request, point: { x: 1, y: 2, path: 'source' } },
    { ...request, controls: { widthScale: 3.1 } }, { ...request, controls: { amplitudeScale: Infinity } },
    { ...request, controls: { betaOverride: 1 } }, { ...request, options: { sampleCount: 20.5 } },
    { ...request, options: { maximumRadius: 129 } }, { ...request, options: { maximumCandidates: 100000 } },
    { imageId: request.imageId, action: 'preview', points: [] },
    { imageId: request.imageId, action: 'preview', points: Array(51).fill(request.point) }])
    assert.throws(() => parseSamplingRequest(invalid), TypeError);
});

async function fixture(changeResult?: (result: Result, directory: string) => Promise<void>, native?: { png: Buffer; dimensions: [number, number] }) {
  const root = await mkdtemp(join(tmpdir(), 'nebula-star-sampling-'));
  const write = async (path: string, bytes: string | Buffer) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes); };
  const json = (path: string, value: unknown) => write(path, JSON.stringify(value));
  const png = native?.png ?? await sharp({ create: { width: 16, height: 12, channels: 4, background: '#245678' } }).png().toBuffer();
  const model = await sharp({ create: { width: 16, height: 12, channels: 4, background: '#040608' } }).png().toBuffer();
  const residual = await sharp({ create: { width: 16, height: 12, channels: 4, background: '#205070' } }).png().toBuffer();
  const comparison = await sharp({ create: { width: 48, height: 12, channels: 4, background: '#000000' } })
    .composite([native ? await sharp(png).resize(16, 12).png().toBuffer() : png, model, residual].map((input, i) => ({ input, left: i * 16, top: 0 }))).png().toBuffer();
  const previews: Record<string, Buffer> = { 'overview.png': png, 'source.png': png, 'model.png': model, 'residual.png': residual, 'comparison.png': comparison };
  const source = { path: '.local/source.png', sha256: hash(png), nativeDimensions: native?.dimensions ?? [16, 12] };
  const recipe = { schema: 'cssearth-star-separation@1', source, outputDirectory: '.local/separation' };
  const recipeBytes = JSON.stringify(recipe), recipeSha = hash(recipeBytes);
  const geometry = { kind: 'fixed-publisher-wcs', wcs: { projection: 'TAN', referencePixel: [8, 6] } };
  const gateBytes = JSON.stringify({ pass: true });
  const report = { schema: 'cssearth-selected-image-alignment-report@1', pass: true, status: 'passed', sources: [{
    id: request.imageId, pass: true, status: 'passed', sourcePath: source.path, sourceSha256: source.sha256,
    sourceDimensions: source.nativeDimensions, geometry, gate: { path: 'proof/gate.json', sha256: hash(gateBytes) } }] };
  const reportBytes = JSON.stringify(report);
  const detections = JSON.stringify({ image: source, count: 1, nativePixelCentres: [[8, 6]] });
  const emptyStars = await sharp(Buffer.alloc(source.nativeDimensions[0] * source.nativeDimensions[1] * 3), {
    raw: { width: source.nativeDimensions[0], height: source.nativeDimensions[1], channels: 3 } }).png().toBuffer();
  const emptyMask = await sharp(Buffer.alloc(source.nativeDimensions[0] * source.nativeDimensions[1]), {
    raw: { width: source.nativeDimensions[0], height: source.nativeDimensions[1], channels: 1 } }).toColourspace('b-w').png().toBuffer();
  const receipt = { schema: 'cssearth-star-separation-receipt@1', source: { ...source, dtype: 'uint8' }, sourceSha256: source.sha256,
    recipeSha256: recipeSha, detectionsWrittenBeforeSeparation: true,
    verification: { maximumReconstructionErrorCodeValues: 0, changedPixelsOutsideMask: 0, encodedRoundTripExact: true },
    outputs: { 'star-detections.json': { sha256: hash(detections), bytes: Buffer.byteLength(detections) }, 'diffuse.png': { sha256: hash(png), bytes: png.length },
      'stars.png': { sha256: hash(emptyStars), bytes: emptyStars.length }, 'star-mask.png': { sha256: hash(emptyMask), bytes: emptyMask.length } } };
  const catalogue = { targets: [{ directory: 'models/test', images: [{ id: request.imageId, ...source, wcs: geometry.wcs }] }] };
  const plan = { schema: 'cssearth-image-processing-plan@1', catalogue: 'catalogue.json',
    alignmentReport: { path: 'proof/alignment.json', sha256: hash(reportBytes) },
    selections: [{ id: request.imageId, recipe: 'recipes/test.json', recipeSha256: recipeSha }] };
  await write(source.path, png); await write('recipes/test.json', recipeBytes);
  await write('proof/alignment.json', reportBytes); await write('proof/gate.json', gateBytes);
  await json('catalogue.json', catalogue); await json(planPath, plan);
  await json('.local/separation/receipt.json', receipt); await write('.local/separation/star-detections.json', detections);
  await write('.local/separation/diffuse.png', png); await write('.local/separation/stars.png', emptyStars); await write('.local/separation/star-mask.png', emptyMask);
  await write('labs/nebula/src/star-sampling.py', '# fixture runner replaces Python\n');
  const previewResult = await sharp(png).resize(native ? { width: 128, height: 128, fit: 'inside' } : { width: 8, height: 6 }).png().toBuffer({ resolveWithObject: true });
  const preview = previewResult.data, { width: previewWidth, height: previewHeight } = previewResult.info;
  await write('models/test/prepared/original.png', preview);
  await json('models/test/overlays.json', { overlays: [{ id: request.imageId, texturePath: 'prepared/original.png', widthPx: previewWidth, heightPx: previewHeight, sha256: hash(preview) }] });
  await json('labs/nebula/models/lmc-star-separation/variants.json', { schema: 'cssearth-nebula-overlay-variants@1', variants: [{
    imageId: request.imageId, sourceSha256: source.sha256, originalTextureSha256: hash(preview), receiptPath: '.local/separation/receipt.json',
    layers: [{ id: 'diffuse', label: 'Diffuse', texturePath: 'unused-diffuse.png', widthPx: previewWidth, heightPx: previewHeight, sha256: hash(preview) }] }] });
  const calls: Record<string, unknown>[] = [];
  const runner: SamplerRunner = async (work, directory) => {
    calls.push(work);
    for (const [name, bytes] of Object.entries(previews)) await writeFile(join(directory, name), bytes);
    const result: Result = { schema: 'cssearth-star-sampling-result@1', operation: work.operation, sourceSha256: source.sha256,
      nativeDimensions: source.nativeDimensions, overview: { path: 'overview.png', dimensions: source.nativeDimensions },
      samples: [{ id: 'star-8-6', point: request.point, requestedPoint: request.point, qualified: true, previewAccountingExact: true,
        cutout: { x: 0, y: 0, width: 16, height: 12 },
        metrics: { fwhmPixels: 2, fwhmMajorPixels: 2, fwhmMinorPixels: 2, ellipticity: 0, coreRadiusPixels: 1,
          haloRadiusPixels: 5, backgroundRgb: [0, 0, 0], saturatedPixels: 0, neighborCount: 0, fitRelativeRmse: .01, confidence: .95, flags: [] },
        channels: ['red', 'green', 'blue'].map(channel => ({ channel, amplitude: .1, background: 0, rmse: .01 })),
        images: { source: 'source.png', model: 'model.png', residual: 'residual.png', comparison: 'comparison.png' } }],
      calibration: { sampleCount: 1, qualifiedCount: 1, fwhmMedianPixels: 2, fwhmP10Pixels: 2, fwhmP90Pixels: 2, betaMedian: 3, controls: work.controls },
      limitations: ['Synthetic runner fixture; no full-image extraction.'] };
    if (changeResult) await changeResult(result, directory);
    await writeFile(join(directory, 'result.json'), JSON.stringify(result));
  };
  const sample = createStarSampler(root, { runner });
  return { root, write, json, png, preview, previews, source, recipe, report, receipt, catalogue, plan, detections, calls, runner, sample };
}

test('sampling uses the pinned original detections, publishes real PNGs, deduplicates/cache-reuses work and never writes its sources', async () => {
  const f = await fixture();
  try {
    const [one, two] = await Promise.all([f.sample(request), f.sample(request)]);
    assert.deepEqual(one, two); assert.equal(f.calls.length, 1);
    assert.deepEqual(f.calls[0].source, f.source);
    assert.deepEqual(f.calls[0].detections, { path: '.local/separation/star-detections.json', sha256: hash(f.detections) });
    const result = one as { imageId: string; overview: { url: string }; samples: { images: Record<string, string> }[] };
    assert.equal(result.imageId, request.imageId);
    const canonicalRoot = await realpath(f.root);
    for (const url of [result.overview.url, ...Object.values(result.samples[0].images)]) {
      assert.ok(url.startsWith(`/@fs${canonicalRoot}/.local/nebula-lab/star-sampling/`)); assert.ok(!url.includes('.pending'));
      const name = url.split('/').at(-1)!;
      assert.deepEqual(await readFile(url.slice(4)), f.previews[name]);
      const metadata = await sharp(await readFile(url.slice(4))).metadata(); assert.equal(metadata.width, name === 'comparison.png' ? 48 : 16); assert.equal(metadata.height, 12);
    }
    assert.deepEqual(await f.sample(request), one); assert.equal(f.calls.length, 1, 'cache hit does not rerun Python');
    await f.sample({ ...request, controls: { widthScale: 1.2 } }); assert.equal(f.calls.length, 2, 'profile controls bind the cache key');
    assert.deepEqual(await readFile(join(f.root, f.source.path)), f.png);
    assert.equal(await readFile(join(f.root, '.local/separation/star-detections.json'), 'utf8'), f.detections);
    await f.write(f.source.path, Buffer.from('altered source'));
    await assert.rejects(f.sample(request), /hash differs/); assert.equal(f.calls.length, 2, 'source is reverified even for cached results');
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('source preflight rejects changed recipe/report/gate/geometry and original detection bindings before any runner', async () => {
  const f = await fixture();
  try {
    for (const invalid of [{ ...request, imageId: 'unknown' }, { ...request, point: { x: 16, y: 6 } },
      { ...request, point: { x: 8, y: 12 } }]) await assert.rejects(f.sample(invalid), TypeError);
    for (const path of ['recipes/test.json', 'proof/alignment.json', 'proof/gate.json', '.local/separation/star-detections.json']) {
      const original = await readFile(join(f.root, path)); await f.write(path, Buffer.from('altered'));
      await assert.rejects(f.sample(request), /hash differs/); await f.write(path, original);
    }
    const originalCatalogue = JSON.stringify(f.catalogue);
    f.catalogue.targets[0].images[0].wcs.referencePixel[0] += 1; await f.json('catalogue.json', f.catalogue);
    await assert.rejects(f.sample(request), /verified native image registration/); await f.write('catalogue.json', originalCatalogue);
    for (const changed of [{ ...f.receipt, sourceSha256: '0'.repeat(64) }, { ...f.receipt, recipeSha256: '0'.repeat(64) },
      { ...f.receipt, detectionsWrittenBeforeSeparation: false }]) {
      await f.json('.local/separation/receipt.json', changed); await assert.rejects(f.sample(request), /not bound to this source/);
    }
    await f.json('.local/separation/receipt.json', f.receipt);
    f.plan.selections[0].recipe = '../outside.json'; await f.json(planPath, f.plan);
    await assert.rejects(f.sample(request), /Invalid local sampling path/);
    assert.equal(f.calls.length, 0, 'every preflight failure precedes analysis');
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('sampling rejects missing, escaped and invalid PNG artifacts plus unbound results', async () => {
  const changes: ((result: Result, directory: string) => Promise<void>)[] = [
    async result => { result.samples[0].images.source = 'missing.png'; },
    async result => { result.overview.path = '../outside.png'; },
    async (result, directory) => { await symlink(join(dirname(dirname(dirname(directory))), 'source.png'), join(directory, 'escaped.png'));
      result.samples[0].images.residual = 'escaped.png'; },
    async (_result, directory) => { await writeFile(join(directory, 'source.png'), 'not PNG pixels'); },
    async result => { result.sourceSha256 = '0'.repeat(64); },
    async result => { result.operation = 'survey'; },
    async result => { result.nativeDimensions = [32, 24]; },
  ];
  for (const change of changes) {
    const f = await fixture(change);
    try { await assert.rejects(f.sample(request)); assert.equal(f.calls.length, 1); }
    finally { await rm(f.root, { recursive: true, force: true }); }
  }
});

test('overview returns the pinned original preview and native extent without Python, and rejects changed preview bytes', async () => {
  const f = await fixture();
  try {
    await rm(join(f.root, 'labs/nebula/src/star-sampling.py'));
    const result = await f.sample({ imageId: request.imageId, action: 'overview' }) as {
      operation: string; sourceSha256: string; nativeDimensions: number[]; samples: unknown[]; calibration: unknown;
      sourcePreviewSha256: string; overview: { url: string; dimensions: number[] } };
    assert.equal(result.operation, 'overview'); assert.equal(result.sourceSha256, f.source.sha256);
    assert.deepEqual(result.nativeDimensions, [16, 12]); assert.deepEqual(result.overview.dimensions, [8, 6]);
    assert.deepEqual(result.samples, []); assert.equal(result.calibration, null); assert.equal(f.calls.length, 0);
    assert.equal(result.sourcePreviewSha256, hash(f.preview)); assert.deepEqual(await readFile(result.overview.url.slice(4)), f.preview);
    await f.write('models/test/prepared/original.png', f.png);
    await assert.rejects(f.sample({ imageId: request.imageId, action: 'overview' }), /hash differs/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

test('last-caller cancellation stops active work, skips cancelled queued work, removes pending outputs and frees the next job', { timeout: 5000 }, async () => {
  const f = await fixture(), started = deferred(), queued = deferred();
  const activeController = new AbortController(), queuedController = new AbortController();
  let attempts = 0, aborted = false;
  try {
    const sample = createStarSampler(f.root, { runner: async (work, directory, signal, progress) => {
      attempts++;
      const scale = (work.controls as { widthScale: number }).widthScale;
      assert.notEqual(scale, 2, 'cancelled queued work never reaches the runner');
      if (scale === 1) {
        await writeFile(join(directory, 'partial.tmp'), 'unfinished'); started.resolve();
        await new Promise<void>((_done, reject) => signal.addEventListener('abort', () => {
          aborted = true; reject(new DOMException('cancelled', 'AbortError'));
        }, { once: true }));
      }
      signal.throwIfAborted(); await f.runner(work, directory, signal, progress);
    } });
    const active = assert.rejects(sample(request, activeController.signal), { name: 'AbortError' });
    await started.promise;
    const pending = assert.rejects(sample({ ...request, controls: { widthScale: 2 } }, queuedController.signal,
      event => { if (event.message === 'Waiting for the native analysis worker.') queued.resolve(); }), { name: 'AbortError' });
    await queued.promise; queuedController.abort(); await pending;
    const next = sample({ ...request, controls: { widthScale: 1.2 } });
    activeController.abort(); await Promise.all([active, next]);
    assert.equal(aborted, true); assert.equal(attempts, 2); assert.equal(f.calls.length, 1, 'cancelled worker does not write a result');
    const entries = await readdir(join(f.root, '.local/nebula-lab/star-sampling'));
    assert.equal(entries.length, 1); assert.ok(entries.every(name => !name.endsWith('.pending')));
  } finally { activeController.abort(); queuedController.abort(); await rm(f.root, { recursive: true, force: true }); }
});

test('cancelling one deduplicated caller preserves the shared runner and forwards actual progress only to surviving callers', { timeout: 5000 }, async () => {
  const f = await fixture(), started = deferred(), joined = deferred(), finish = deferred();
  const cancelled = new AbortController(), survivor = new AbortController();
  const firstEvents: SamplingProgress[] = [], secondEvents: SamplingProgress[] = [];
  let observedSignal: AbortSignal | undefined;
  try {
    const sample = createStarSampler(f.root, { runner: async (work, directory, signal, progress) => {
      observedSignal = signal; progress({ stage: 'fitting', current: 1, total: 2, message: 'Measured star 1 of 2.' }); started.resolve();
      await finish.promise; signal.throwIfAborted();
      progress({ stage: 'fitting', current: 2, total: 2, message: 'Measured star 2 of 2.' });
      await f.runner(work, directory, signal, progress);
    } });
    const first = assert.rejects(sample(request, cancelled.signal, event => firstEvents.push(event)), { name: 'AbortError' });
    await started.promise;
    const second = sample(request, survivor.signal, event => { secondEvents.push(event); if (event.stage === 'fitting') joined.resolve(); });
    await joined.promise; cancelled.abort(); await first;
    assert.equal(observedSignal?.aborted, false); finish.resolve(); await second;
    assert.equal(f.calls.length, 1); assert.ok(secondEvents.some(event => event.stage === 'fitting' && event.current === 2));
    assert.ok(!firstEvents.some(event => event.stage === 'fitting' && event.current === 2));
  } finally { cancelled.abort(); survivor.abort(); finish.resolve(); await rm(f.root, { recursive: true, force: true }); }
});

test('disk guard preserves existing previews/cache hits and removes an oversized unpublished job', async () => {
  const f = await fixture();
  try {
    const before = await f.sample(request), calls = f.calls.length;
    const full = createStarSampler(f.root, { runner: f.runner, maximumCacheBytes: 1 });
    assert.deepEqual(await full(request), before);
    await assert.rejects(full({ ...request, controls: { widthScale: 1.1 } }), /cache is full/); assert.equal(f.calls.length, calls);
    const result = before as { overview: { url: string } }; assert.deepEqual(await readFile(result.overview.url.slice(4)), f.png);
  } finally { await rm(f.root, { recursive: true, force: true }); }
  const empty = await fixture();
  try {
    await assert.rejects(createStarSampler(empty.root, { runner: empty.runner, maximumCacheBytes: 1 })(request), /cache is full/);
    assert.equal(empty.calls.length, 1); assert.deepEqual(await readdir(join(empty.root, '.local/nebula-lab/star-sampling')), []);
  } finally { await rm(empty.root, { recursive: true, force: true }); }
});

test('HTTP overview streams real progress plus one result or error and retains JSON fallback', async () => {
  const f = await fixture();
  let handler!: (request: IncomingMessage, response: ServerResponse) => void;
  const plugin = starSamplingPlugin(f.root);
  (plugin.configureServer as (server: unknown) => void)({ middlewares: { use: (_path: string, value: typeof handler) => { handler = value; } } });
  const server = createServer((request, response) => handler(request, response));
  try {
    await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/__nebula/star-samples`;
    const post = (body: unknown, accept: string) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: accept }, body: JSON.stringify(body) });
    const overview = { imageId: request.imageId, action: 'overview' };
    const streamed = await post(overview, 'application/x-ndjson'); assert.match(streamed.headers.get('content-type')!, /x-ndjson/);
    const events = (await streamed.text()).trim().split('\n').map(line => JSON.parse(line));
    assert.ok(events.some(event => event.type === 'progress' && event.stage === 'validating' && event.current === 1));
    assert.equal(events.filter(event => event.type === 'result').length, 1); assert.equal(events.at(-1).result.operation, 'overview');
    assert.deepEqual(await (await post(overview, 'application/json')).json(), events.at(-1).result);
    const failed = (await (await post({ ...request, point: { x: 16, y: 6 } }, 'application/x-ndjson')).text()).trim().split('\n').map(line => JSON.parse(line));
    assert.equal(failed.at(-1).type, 'error'); assert.match(failed.at(-1).message, /outside/); assert.ok(!failed.some(event => event.type === 'result'));
    assert.equal(f.calls.length, 0);
  } finally { await new Promise<void>(done => server.close(() => done())); await rm(f.root, { recursive: true, force: true }); }
});

test('closing an HTTP stream kills the active child and removes its pending directory', { timeout: 5000 }, async () => {
  const f = await fixture(), controller = new AbortController();
  let handler!: (request: IncomingMessage, response: ServerResponse) => void, pid: number | undefined;
  const plugin = starSamplingPlugin(f.root);
  (plugin.configureServer as (server: unknown) => void)({ middlewares: { use: (_path: string, value: typeof handler) => { handler = value; } } });
  const server = createServer((request, response) => handler(request, response));
  const stopped = () => { if (pid === undefined) return true; try { process.kill(pid, 0); return false; } catch { return true; } };
  try {
    // Real child process with the same stdin/stdout lifecycle; no scientific fitting in this transport test.
    await f.write('labs/nebula/src/star-sampling.py', `const fs = require('node:fs'); let text = '';
process.stdin.on('data', bytes => text += bytes);
process.stdin.on('end', () => { const work = JSON.parse(text);
fs.writeFileSync(work.outputDirectory + '/child.pid', String(process.pid));
process.stdout.write(JSON.stringify({stage:'fitting',current:0,total:1,message:'Native child started.'}) + '\\n');
setInterval(() => {}, 1000); });\n`);
    await mkdir(join(f.root, '.local/nebula-lab/registration/venv/bin'), { recursive: true });
    await symlink(process.execPath, join(f.root, '.local/nebula-lab/registration/venv/bin/python'));
    await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/__nebula/star-samples`, {
      method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' }, body: JSON.stringify(request) });
    const reader = response.body!.getReader(); let text = '';
    while (!text.includes('Native child started.')) {
      const next = await reader.read(); assert.equal(next.done, false); text += new TextDecoder().decode(next.value);
    }
    const cache = join(f.root, '.local/nebula-lab/star-sampling'), pending = (await readdir(cache)).find(name => name.endsWith('.pending'))!;
    pid = Number(await readFile(join(cache, pending, 'child.pid'), 'utf8')); assert.ok(Number.isInteger(pid) && pid > 0);
    controller.abort(); await reader.cancel().catch(() => {});
    for (let i = 0; i < 100 && (!stopped() || (await readdir(cache)).length); i++) await delay(10);
    assert.equal(stopped(), true, 'HTTP disconnect must terminate the worker process'); assert.deepEqual(await readdir(cache), []);
  } finally {
    controller.abort(); if (!stopped()) process.kill(pid!, 'SIGKILL');
    await new Promise<void>(done => server.close(() => done())); await rm(f.root, { recursive: true, force: true });
  }
});

async function validationFixture(result: Result, directory: string) {
  const images = { source: 'bank-source.png', model: 'bank-model.png', residual: 'bank-residual.png', comparison: 'bank-comparison.png', mask: 'bank-mask.png' };
  for (const name of ['source', 'model', 'residual', 'comparison'] as const)
    await writeFile(join(directory, images[name]), await readFile(join(directory, result.samples[0].images[name])));
  await sharp(Buffer.alloc(16 * 12, 128), { raw: { width: 16, height: 12, channels: 1 } }).png().toFile(join(directory, images.mask));
  result.validationSamples = [{ ...structuredClone(result.samples[0]), id: 'held-out-star', accepted: true, profileId: 'profile-1',
    reasons: [], modelKind: 'shared-profile-bank', images }];
  result.calibration.profileBank = [{ id: 'profile-1' }];
  result.artifactSha256 = {};
  for (const name of await readdir(directory)) if (name.endsWith('.png')) result.artifactSha256[name] = hash(await readFile(join(directory, name)));
}

test('held-out sample images and native-grid mask become usable URLs and their hashes are checked on cache hits', async () => {
  const f = await fixture(validationFixture);
  try {
    const result = await f.sample(request) as Result, sample = result.validationSamples![0];
    assert.equal(sample.modelKind, 'shared-profile-bank'); assert.equal(sample.accepted, true); assert.equal(sample.profileId, 'profile-1');
    for (const [name, url] of Object.entries(sample.images)) {
      assert.ok(url.startsWith('/@fs')); const pixels = await readFile(url.slice(4));
      assert.equal(hash(pixels), result.artifactSha256![url.split('/').at(-1)!]);
      const metadata = await sharp(pixels).metadata(); assert.equal(metadata.width, name === 'comparison' ? 48 : 16); assert.equal(metadata.height, 12);
    }
    await writeFile(sample.images.mask!.slice(4), f.png);
    await assert.rejects(f.sample(request), /preview hash differs/); assert.equal(f.calls.length, 1, 'cached validation masks are reverified without refitting');
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('held-out artifact validation rejects escaping paths, missing hashes, wrong native grids and oversized collections', async () => {
  const changes: ((result: Result, directory: string) => Promise<void>)[] = [
    async result => { result.validationSamples![0].images.mask = '../mask.png'; },
    async result => { delete result.artifactSha256!['bank-model.png']; },
    async (result, directory) => {
      const bytes = await sharp({ create: { width: 17, height: 12, channels: 3, background: '#000' } }).png().toBuffer();
      await writeFile(join(directory, 'bank-mask.png'), bytes); result.artifactSha256!['bank-mask.png'] = hash(bytes);
    },
    async result => { result.validationSamples![0].cutout.x = 1; },
    async result => { result.validationSamples = Array(21).fill(result.validationSamples![0]); },
  ];
  for (const change of changes) {
    const f = await fixture(async (result, directory) => { await validationFixture(result, directory); await change(result, directory); });
    try { await assert.rejects(f.sample(request), TypeError); assert.equal(f.calls.length, 1); }
    finally { await rm(f.root, { recursive: true, force: true }); }
  }
});

test('changing the scientific implementation invalidates the sampling cache and records the new code snapshot', async () => {
  const f = await fixture();
  try {
    const first = await f.sample(request) as { overview: { url: string } };
    const script = '# updated shared-profile implementation\n'; await f.write('labs/nebula/src/star-sampling.py', script);
    const second = await f.sample(request) as { overview: { url: string } };
    assert.equal(f.calls.length, 2); assert.notEqual(second.overview.url, first.overview.url);
    const saved = JSON.parse(await readFile(join(dirname(second.overview.url.slice(4)), 'request.json'), 'utf8'));
    assert.equal(saved.scriptSha256, hash(script)); assert.deepEqual(await readFile(join(f.root, f.source.path)), f.png);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('explicit whole-image apply requires fresh calibration, returns separate pinned layers and composes with tone/strength', async () => {
  const f = await fixture(async (result, directory) => {
    const work = f.calls.at(-1)!;
    if (work.operation === 'preview') {
      result.calibration.profileBank = [{ id: 'profile-1' }];
      Object.assign(result, { recipe: { schema: 'cssearth-star-profile-bank@1', source: f.source, referencePoints: work.points,
        profileBank: [{ id: 'profile-1' }], scope: 'native-cutout-validation', scriptSha256: hash(await readFile(join(f.root, 'labs/nebula/src/star-sampling.py'))) } });
    }
    if (work.operation === 'apply') {
      result.samples = [];
      await writeFile(join(directory, 'diffuse.png'), f.previews['residual.png']);
      await writeFile(join(directory, 'stars.png'), f.previews['model.png']);
      await sharp(Buffer.alloc(16 * 12, 255), { raw: { width: 16, height: 12, channels: 1 } }).png().toFile(join(directory, 'star-mask.png'));
      for (const id of ['diffuse', 'stars']) await sharp(join(directory, `${id}.png`)).resize(8, 6).png().toFile(join(directory, `${id}-preview.png`));
      Object.assign(result, { appliedImage: { nativeDimensions: f.source.nativeDimensions, sourceDtype: 'uint8',
        images: { diffuse: 'diffuse.png', stars: 'stars.png', mask: 'star-mask.png' },
        previews: { diffuse: 'diffuse-preview.png', stars: 'stars-preview.png', comparison: 'comparison.png' },
        counts: { detected: 1, screened: 1, verified: 1, accepted: 1 },
        verification: { maximumReconstructionErrorCodeValues: 0, changedPixelsOutsideMask: 0, encodedRoundTripExact: true, baselineRestoredPixels: 0 },
        baselineReceiptSha256: (work.baseline as { receiptSha256: string }).receiptSha256,
        calibrationRecipeSha256: (work.calibration as { recipeSha256: string }).recipeSha256 } });
      result.artifactSha256 = {};
      for (const name of await readdir(directory)) if (name.endsWith('.png')) result.artifactSha256[name] = hash(await readFile(join(directory, name)));
    }
  });
  try {
    const previewRequest = { imageId: request.imageId, action: 'preview', points: [request.point], controls: { widthScale: 1 } };
    const calibrated = await f.sample(previewRequest) as { calibrationToken: string };
    assert.match(calibrated.calibrationToken, /^[a-f0-9]{64}\.[a-f0-9]{64}$/);
    const apply = { ...previewRequest, action: 'apply', calibrationToken: calibrated.calibrationToken };
    assert.throws(() => parseSamplingRequest({ ...apply, calibrationToken: undefined }), TypeError);
    await assert.rejects(f.sample({ ...apply, controls: { widthScale: 1.5 } }), /Calibration is stale/);
    await assert.rejects(f.sample({ ...apply, points: [{ x: 7, y: 6 }] }), /Calibration is stale/);
    await assert.rejects(f.sample({ ...apply, calibrationToken: `${calibrated.calibrationToken.split('.')[0]}.${'0'.repeat(64)}` }), /hash differs/);
    assert.equal(f.calls.length, 1, 'stale calibrations never start whole-image work');
    const approvedReceipt = JSON.stringify(f.receipt), approvedStars = await readFile(join(f.root, '.local/separation/stars.png'));
    await f.write('.local/separation/stars.png', f.png);
    await assert.rejects(f.sample(apply), /hash differs/); await f.write('.local/separation/stars.png', approvedStars);
    await f.json('.local/separation/receipt.json', { ...f.receipt, verification: { ...f.receipt.verification, changedPixelsOutsideMask: 1 } });
    await assert.rejects(f.sample(apply), /exact accounting/); await f.write('.local/separation/receipt.json', approvedReceipt);
    await f.write('.local/separation/stars.png', f.preview);
    await f.json('.local/separation/receipt.json', { ...f.receipt, outputs: { ...f.receipt.outputs, 'stars.png': { sha256: hash(f.preview) } } });
    await assert.rejects(f.sample(apply), /native pixel grid/);
    await f.write('.local/separation/stars.png', approvedStars); await f.write('.local/separation/receipt.json', approvedReceipt);
    assert.equal(f.calls.length, 1, 'invalid approved baseline never starts whole-image work');
    const applied = await f.sample(apply) as { sourceSha256: string; sourcePreviewSha256: string;
      applied: { resultId: string; native: Record<string, string>; layers: { id: string; url: string; texturePath: string; sha256: string; widthPx: number; heightPx: number }[] } };
    assert.equal(applied.sourceSha256, f.source.sha256); assert.equal(applied.sourcePreviewSha256, hash(f.preview));
    assert.equal(f.calls.length, 2); assert.deepEqual(await f.sample(apply), applied); assert.equal(f.calls.length, 2);
    const layers = await resolveAppliedSamplingLayers(f.root, applied.applied.resultId, request.imageId, hash(f.preview));
    assert.equal(layers.sourceSha256, f.source.sha256); assert.equal(layers.layers.length, 2);
    assert.ok(layers.layers.every(layer => layer.texturePath.includes('star-sampling-applied/')));
    assert.deepEqual(await resolveAppliedSamplingLayers(f.root, applied.applied.resultId, request.imageId, hash(f.preview)), layers);
    await assert.rejects(resolveAppliedSamplingLayers(f.root, applied.applied.resultId, request.imageId, '0'.repeat(64)), /original preview differs/);
    let restoreHandler!: (request: IncomingMessage, response: ServerResponse) => void;
    (starSamplingPlugin(f.root).configureServer as (server: unknown) => void)({ middlewares: { use: (_path: string, value: typeof restoreHandler) => { restoreHandler = value; } } });
    const restoreServer = createServer((request, response) => restoreHandler(request, response));
    try {
      await new Promise<void>(done => restoreServer.listen(0, '127.0.0.1', done));
      const url = `http://127.0.0.1:${(restoreServer.address() as AddressInfo).port}/__nebula/star-samples/restore`;
      const identity = { imageId: request.imageId, resultId: applied.applied.resultId, sourcePreviewSha256: hash(f.preview) };
      const post = (body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const restored = await post(identity); assert.equal(restored.status, 200);
      const saved = await restored.json();
      assert.equal(saved.imageId, request.imageId); assert.equal(saved.sourceSha256, f.source.sha256);
      assert.equal(saved.sourcePreviewSha256, hash(f.preview)); assert.deepEqual(saved.nativeDimensions, f.source.nativeDimensions);
      assert.deepEqual(saved.applied, { resultId: applied.applied.resultId, layers: applied.applied.layers });
      const stale = await post({ ...identity, sourcePreviewSha256: '0'.repeat(64) });
      assert.equal(stale.status, 400); assert.match((await stale.json()).error, /original preview differs/);
      const missing = await post({ ...identity, resultId: `${'0'.repeat(64)}.${'0'.repeat(64)}` });
      assert.equal(missing.ok, false); await missing.text();
      assert.equal(f.calls.length, 2, 'restoring saved layers never invokes analysis');
    } finally { await new Promise<void>((done, reject) => restoreServer.close(error => error ? reject(error) : done())); }
    await f.json('labs/nebula/src/subjects.json', [{ id: 'test', density: { directory: 'models/test', overlays: 'models/test/overlays.json' } }]);
    const prepareTone = createTonePreparer(f.root), tone = { ...defaultOverlayTone(), gamma: 2 };
    const toned = await prepareTone({ subjectId: 'test', target: 'image', imageId: request.imageId, imageLayer: 'diffuse',
      samplingResultId: applied.applied.resultId, removalStrength: 50, tone });
    const diffuse = applied.applied.layers.find(layer => layer.id === 'diffuse')!;
    const originalPixels = await sharp(f.preview).ensureAlpha().raw().toBuffer(), diffusePixels = await sharp(diffuse.url.slice(4)).ensureAlpha().raw().toBuffer();
    const midpoint = Uint8Array.from(originalPixels, (value, i) => Math.round((value + diffusePixels[i]) / 2));
    assert.deepEqual([...await sharp(toned.resources[0].url.slice(4)).ensureAlpha().raw().toBuffer()], [...toneRgba(midpoint, 'image', tone)]);
    const original = await prepareTone({ subjectId: 'test', target: 'image', imageId: request.imageId, imageLayer: 'original',
      samplingResultId: applied.applied.resultId, removalStrength: 50, tone: defaultOverlayTone() });
    assert.deepEqual(await readFile(original.resources[0].url.slice(4)), f.preview);
    assert.deepEqual(await readFile(join(f.root, f.source.path)), f.png, 'native source is never overwritten');
    await f.write('.local/separation/stars.png', f.png);
    await assert.rejects(resolveAppliedSamplingLayers(f.root, applied.applied.resultId, request.imageId, hash(f.preview)), /hash differs/);
    await f.write('.local/separation/stars.png', approvedStars);
    await writeFile(applied.applied.native.diffuse.slice(4), f.png);
    await assert.rejects(resolveAppliedSamplingLayers(f.root, applied.applied.resultId, request.imageId, hash(f.preview)), /preview hash differs/);
    await f.write('labs/nebula/src/star-sampling.py', '# changed implementation\n');
    await assert.rejects(f.sample(apply), /Calibration is stale/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('actual Python preview-to-apply wire produces verified synthetic native layers and resolves them for tone', { timeout: 60000 }, async t => {
  const python = resolve('.local/nebula-lab/registration/venv/bin/python');
  if (!await stat(python).catch(() => null)) { t.skip('Local native analysis environment is not installed.'); return; }
  const width = 512, height = 512, rgb = Buffer.alloc(width * height * 3), baselineStars = Buffer.alloc(rgb.length), baselineMask = Buffer.alloc(width * height);
  const seeds = [96, 256, 416].flatMap(y => [96, 256, 416].map(x => ({ x, y })));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const star = seeds.reduce((sum, seed) => sum + 170 * (1 + ((x - seed.x) ** 2 + (y - seed.y) ** 2) / 9) ** -3.2, 0);
    const broad = 110 * (1 + ((x - 336) ** 2 + (y - 336) ** 2) / 144) ** -3.2;
    for (let c = 0; c < 3; c++) {
      const i = (y * width + x) * 3 + c, gain = [1, .85, .7][c];
      rgb[i] = Math.round(12 + (star + broad) * gain); baselineStars[i] = Math.min(rgb[i] - 12, Math.round(broad * gain));
      if (baselineStars[i]) baselineMask[y * width + x] = 255;
    }
  }
  const png = await sharp(rgb, { raw: { width, height, channels: 3 } }).png().toBuffer();
  const f = await fixture(undefined, { png, dimensions: [width, height] });
  try {
    const baselineDiffuse = Buffer.from(rgb.map((value, i) => value - baselineStars[i]));
    const baselineFiles = { 'diffuse.png': await sharp(baselineDiffuse, { raw: { width, height, channels: 3 } }).png().toBuffer(),
      'stars.png': await sharp(baselineStars, { raw: { width, height, channels: 3 } }).png().toBuffer(),
      'star-mask.png': await sharp(baselineMask, { raw: { width, height, channels: 1 } }).toColourspace('b-w').png().toBuffer() };
    for (const [name, bytes] of Object.entries(baselineFiles)) {
      await f.write(`.local/separation/${name}`, bytes); f.receipt.outputs[name as keyof typeof baselineFiles] = { sha256: hash(bytes), bytes: bytes.length };
    }
    await f.json('.local/separation/receipt.json', f.receipt);
    await f.write('labs/nebula/src/star-sampling.py', await readFile('labs/nebula/src/star-sampling.py'));
    const sampler = createStarSampler(f.root, { pythonPath: python, timeoutMs: 30000, applyTimeoutMs: 30000 });
    const progress: SamplingProgress[] = [], preview = { imageId: request.imageId, action: 'preview', points: seeds.slice(0, 3) };
    const calibrated = await sampler(preview, undefined, event => progress.push(event)) as { calibrationToken?: string };
    assert.ok(calibrated.calibrationToken, 'Actual Python must produce a qualified profile bank and calibration token');
    const wrongStars = Buffer.from(baselineStars); wrongStars[0] += 1;
    const wrongPng = await sharp(wrongStars, { raw: { width, height, channels: 3 } }).png().toBuffer();
    await f.write('.local/separation/stars.png', wrongPng);
    await f.json('.local/separation/receipt.json', { ...f.receipt, outputs: { ...f.receipt.outputs, 'stars.png': { sha256: hash(wrongPng), bytes: wrongPng.length } } });
    await assert.rejects(sampler({ ...preview, action: 'apply', calibrationToken: calibrated.calibrationToken }), /baseline fails.*accounting/i,
      'Python must reject inconsistent native baseline pixels even when file hashes and claimed accounting flags are valid');
    await f.write('.local/separation/stars.png', baselineFiles['stars.png']); await f.json('.local/separation/receipt.json', f.receipt);
    const result = await sampler({ ...preview, action: 'apply', calibrationToken: calibrated.calibrationToken }, undefined, event => progress.push(event)) as {
      applied: { resultId: string; native: Record<string, string>; verification: Record<string, unknown>; counts: { accepted: number } } };
    assert.equal(result.applied.verification.encodedRoundTripExact, true); assert.ok(result.applied.counts.accepted > 0);
    const diffuse = await sharp(result.applied.native.diffuse.slice(4)).raw().toBuffer();
    const stars = await sharp(result.applied.native.stars.slice(4)).raw().toBuffer();
    assert.deepEqual(Buffer.from(diffuse.map((value, i) => value + stars[i])), rgb, 'Actual encoded native products reconstruct the untouched synthetic source');
    assert.ok(stars.every((value, i) => value >= baselineStars[i]), 'Whole-image apply never restores approved removed light, including the broader baseline-only star');
    assert.ok(diffuse.every((value, i) => value <= baselineDiffuse[i]));
    assert.equal(result.applied.verification.baselineRestoredPixels, 0);
    const layers = await resolveAppliedSamplingLayers(f.root, result.applied.resultId, request.imageId, hash(f.preview));
    assert.equal(layers.layers.length, 2);
    await f.json('labs/nebula/src/subjects.json', [{ id: 'test', density: { directory: 'models/test', overlays: 'models/test/overlays.json' } }]);
    const tone = await createTonePreparer(f.root)({ subjectId: 'test', target: 'image', imageId: request.imageId, imageLayer: 'diffuse',
      samplingResultId: result.applied.resultId, removalStrength: 50, tone: { ...defaultOverlayTone(), gamma: 2 } });
    assert.equal((await sharp(tone.resources[0].url.slice(4)).metadata()).width, width);
    assert.ok(progress.some(event => event.stage === 'fitting' && event.current > 0));
    assert.ok(progress.some(event => event.stage === 'removing-stars' && event.current > 0), 'Actual full-image tile progress is forwarded');
    assert.deepEqual(await readFile(join(f.root, f.source.path)), png);
    t.diagnostic(`Actual Python accepted ${result.applied.counts.accepted} synthetic stars; native reconstruction, apply resolver and tone all passed.`);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
