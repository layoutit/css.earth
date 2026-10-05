/** Native witness and proxy safety controls; no application code is substituted. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, webkit } from 'playwright';
import { recorder } from './recorder.mts';
import { parseTrace } from './trace.mts';
import { profiles } from './profiles.mts';
import { nativeVisibilityBrowser } from './native-visibility.mts';
import { journeyApi } from './api.mts';
import { startCacheGuard } from './cache-guard.mts';
const enabled = process.env.JOURNEY_MUTATIONS === '1';
const fixture = `<!doctype html><title>Native witness</title><style>.object-input-surface,.object-stage{width:90vw;height:60vh}.object-stage{position:absolute;z-index:-1}.object-stage s{display:block;width:20px;height:20px;background:red}button:focus-visible{outline:3px solid red}</style><div class="object-stage"><s></s></div><div class="object-input-surface"><input aria-label="Native keyboard target"><button>First</button><button>Second</button></div>`;
for (const engine of ['chromium', 'webkit'] as const) test(`${engine}: native DPR resize Tab and touch are required; dispatch cannot replace input`, { skip: !enabled, timeout: 30000 }, async () => {
  await mkdir('output/journeys', { recursive: true }); const root = await mkdtemp(resolve('output/journeys/witness-'));
  const browser = await (engine === 'chromium' ? chromium : webkit).launch();
  try {
    const profile = profiles[engine === 'chromium' ? 'mobile-touch' : 'webkit-mobile-touch']!;
    const context = await browser.newContext(profile), page = await context.newPage();
    const trace = parseTrace({ schema: 'cssearth-journey@1', journey: 'witness', profile: engine, toolchain: { profile }, exercises: [], observations: { network: [], dom: [], rendering: [], content: [], errors: [] } });
    const record = await recorder(page, trace, 'http://127.0.0.1', root, engine);
    await page.goto('data:text/html,' + encodeURIComponent(fixture));
    await record.capabilityWitness('DPR');
    await page.evaluate(() => { const stage = document.querySelector('.object-stage'); if (!stage) throw new Error('Missing fixture stage'); Reflect.set(window, '__removedStage', stage); stage.remove(); });
    await assert.rejects(record.capabilityWitness('DPR'));
    await page.evaluate(() => { const stage: unknown = Reflect.get(window, '__removedStage'); if (!(stage instanceof Element)) throw new Error('Missing fixture stage'); document.body.prepend(stage); });
    await assert.rejects(record.capabilityWitness('responsive'));
    await page.setViewportSize({ width: 820, height: 1094 }); await page.waitForFunction(() => {
      const read: unknown = Reflect.get(window, '__journeyCapabilities');
      if (typeof read !== 'function') return false;
      const state: unknown = read();
      return state !== null && typeof state === 'object' && Array.isArray(Reflect.get(state, 'resizes')) && Reflect.get(state, 'resizes').some((row: { width: number }) => row.width === 820);
    });
    await record.capabilityWitness('responsive');
    await assert.rejects(record.capabilityWitness('tabFocus'));
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })));
    await assert.rejects(record.capabilityWitness('tabFocus'));
    await page.keyboard.press('Tab'); await record.capabilityWitness('tabFocus');
    await assert.rejects(record.capabilityWitness('touch'));
    await page.evaluate(() => document.querySelector('button')!.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true })));
    await assert.rejects(record.capabilityWitness('touch'));
    await page.locator('button').first().tap(); await record.capabilityWitness('touch');
    if (engine === 'chromium') {
      await assert.rejects(record.capabilityWitness('penPointer'));
      const box = await page.locator('button').first().boundingBox(); if (!box) throw new Error('Missing native pen target');
      const session = await context.newCDPSession(page), point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      try {
        await session.send('Input.dispatchMouseEvent', { ...point, pointerType: 'pen', type: 'mousePressed', button: 'left', clickCount: 1, force: 0.5 });
        await session.send('Input.dispatchMouseEvent', { ...point, pointerType: 'pen', type: 'mouseReleased', button: 'left', clickCount: 1 });
        await record.capabilityWitness('penPointer');
      } finally { await session.detach(); }
    }
    await assert.rejects(record.capabilityWitness('visibility'));
    await record.observed();
    for (const id of ['DPR', 'responsive', 'tabFocus', 'touch']) assert.ok(trace.observed?.includes('capability:' + id));
    await page.goto('data:text/html,' + encodeURIComponent(fixture + '<style>input:focus-visible,button:focus-visible{outline:none!important;box-shadow:none!important;text-decoration:none!important}</style>'));
    await page.keyboard.press('Tab'); await assert.rejects(record.capabilityWitness('tabFocus'));
    await context.close();
  } finally { await browser.close(); await rm(root, { recursive: true, force: true }); }
});
test('Chromium proxy preserves native cache, refuses foreign traffic before upstream transport and rejects unguarded browsers', { skip: !enabled, timeout: 30000 }, async () => {
  await mkdir('output/journeys', { recursive: true }); const root = await mkdtemp(resolve('output/journeys/cache-witness-'));
  let assetRequests = 0;
  const server = createServer((request, response) => {
    if (request.url === '/asset.js') { assetRequests++; response.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'public,max-age=3600' }); response.end('window.cachedAsset=true'); }
    else { response.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' }); response.end(fixture + '<script src="/asset.js"></script>'); }
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing fixture origin');
  const origin = `http://127.0.0.1:${address.port}`, guard = await startCacheGuard();
  const browser = await chromium.launch(guard.launchOptions);
  try {
    await guard.verify(browser);
    const context = await browser.newContext(), page = await context.newPage();
    const trace = parseTrace({ schema: 'cssearth-journey@1', journey: 'cache-witness', profile: 'chromium-desktop', toolchain: {}, exercises: ['capability:coldWarmCache'], observations: { network: [], dom: [], rendering: [], content: [], errors: [] } });
    const record = await recorder(page, trace, origin, root, 'chromium', { cacheGuard: guard });
    record.loadStarted('/'); await page.goto(origin); await assert.rejects(record.capabilityWitness('coldWarmCache'));
    record.loadStarted('/'); await page.goto(origin); await record.capabilityWitness('coldWarmCache');
    assert.equal(assetRequests, 1, 'warm native hit must not visit the fixture server');
    await record.observed(); assert.ok(trace.observed?.includes('capability:coldWarmCache'));
    await page.evaluate(() => fetch('http://journey.invalid/no-transport').catch(() => null));
    assert.ok(guard.blocked.some(url => url.includes('journey.invalid')));
    await context.close();
    const unguarded = await chromium.launch({ args: ['--enable-automation'] });
    try { await assert.rejects(guard.verify(unguarded), /not launched behind/u); } finally { await unguarded.close(); }
  } finally { await browser.close(); await guard.close(); server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); await rm(root, { recursive: true, force: true }); }
});

test('native wildcard bypass mutation is rejected without any foreign navigation', { skip: !enabled, timeout: 30000 }, async () => {
  const guard = await startCacheGuard();
  const browser = await chromium.launch({ ...guard.launchOptions, proxy: { server: guard.origin, bypass: '*;<-loopback>' } });
  try {
    await assert.rejects(guard.verify(browser), /not launched behind/u);
  } finally { await browser.close(); await guard.close(); }
});
test('coast witness refuses stale completion while driven and resets for the next coast', { skip: !enabled, timeout: 30000 }, async () => {
  await mkdir('output/journeys', { recursive: true }); const root = await mkdtemp(resolve('output/journeys/coast-state-'));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const trace = parseTrace({ schema: 'cssearth-journey@1', journey: 'coast-state', profile: 'chromium-desktop', toolchain: {}, exercises: [], observations: { network: [], dom: [], rendering: [], content: [], errors: [] } });
    const record = await recorder(page, trace, 'http://127.0.0.1', root, 'chromium');
    await page.goto('data:text/html,' + encodeURIComponent(fixture));
    const signal = async (active: boolean, coasting: boolean, type = 'objectmotionchange') => page.evaluate(detail => {
      document.dispatchEvent(new CustomEvent(detail.type, { bubbles: true, detail: { active: detail.active, coasting: detail.coasting } }));
    }, { active, coasting, type });
    await assert.rejects(record.capabilityWitness('coast'));
    await signal(true, true); await signal(false, false); await record.capabilityWitness('coast');
    await signal(true, false); await assert.rejects(record.capabilityWitness('coast'), /currently observed rest/u);
    await signal(true, true); await signal(false, false, 'objectrotationchange');
    await assert.rejects(record.capabilityWitness('coast'), /currently observed rest/u);
    await signal(false, false); await record.capabilityWitness('coast');
  } finally { await browser.close(); await rm(root, { recursive: true, force: true }); }
});

test('headed Chromium native tabs emit trusted visibility; deleting the driver loses its witness', { skip: !enabled, timeout: 30000 }, async () => {
  await mkdir('output/journeys', { recursive: true }); const root = await mkdtemp(resolve('output/journeys/native-visibility-'));
  let workerScripts = 0;
  const server = createServer((request, response) => {
    if (request.url === '/sw.js') { workerScripts++; response.setHeader('content-type', 'text/javascript'); response.end('self.addEventListener("fetch",()=>{});'); }
    else { response.setHeader('content-type', 'text/html'); response.end(fixture); }
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing visibility fixture address');
  const origin = `http://127.0.0.1:${address.port}`;
  const profile = profiles['chromium-desktop-visibility']!;
  let native: Awaited<ReturnType<typeof nativeVisibilityBrowser>> | undefined;
  try {
    native = await nativeVisibilityBrowser(profile, root);
    const context = await native.newContext(), page = await context.newPage(); await native.prepare(page);
    const trace = parseTrace({ schema: 'cssearth-journey@1', journey: 'native-visibility', profile: 'chromium-desktop-visibility', toolchain: { profile }, exercises: ['capability:visibility'], observations: { network: [], dom: [], rendering: [], content: [], errors: [] } });
    const record = await recorder(page, trace, origin, root, 'chromium', { cacheGuard: native.cacheGuard });
    await page.goto(origin);
    await record.capabilityWitness('DPR');
    const worker = await page.evaluate(async () => {
      try { await navigator.serviceWorker.register('/sw.js'); return 'unexpected-success'; } catch { return 'blocked'; }
    });
    assert.equal(worker, 'blocked'); assert.equal(workerScripts, 0, 'Blocked service-worker script never reaches upstream');
    await assert.rejects(record.capabilityWitness('visibility'), /real trusted/u, 'Deleting native tab activation must lose the witness');
    const api = journeyApi(page, origin, record);
    await api.visibilityTransition(async () => assert.equal(await page.evaluate(() => document.visibilityState), 'hidden'));
    assert.equal(await page.evaluate(() => document.visibilityState), 'visible');
    await record.observed(); assert.ok(trace.observed?.includes('capability:visibility'));
    const evidence = await readFile(resolve(root, 'capabilities.raw.json'), 'utf8');
    assert.ok(evidence.includes('"hidden"')); assert.ok(evidence.includes('"visible"')); assert.ok(evidence.includes('"trusted": true'));
    await page.close();
  } finally { await native?.close(); server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); await rm(root, { recursive: true, force: true }); }
});
