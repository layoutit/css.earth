/** Deleting the native action must lose both its handler and control in both engines. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, webkit } from 'playwright';
import { SourceMapGenerator } from 'source-map-js';
import { coverageGate } from '../manifest.mts';
import { signature, parseRunObservations } from '../qualification.mts';
import type { RegisteredJourney } from '../registry.mts';
import { reachability, requireObserved, installTap } from './reachability.mts';
for (const engine of ['chromium', 'webkit'] as const) test(`${engine}: native action deletion turns observed reachability red`, { skip: process.env.JOURNEY_MUTATIONS !== '1' }, async () => {
  const root = await mkdtemp(resolve('output/journeys/tap-'));
  const file = 'site/journeys/fixture.mts';
  const source = '\n\nbutton.addEventListener("click", callback);';
  const script = 'const button=document.querySelector("button"); let hits=0; function callback(){hits++} button.addEventListener("click",callback); button.addEventListener("click",callback);';
  const position = script.indexOf('button.addEventListener');
  const map = new SourceMapGenerator({ file: 'probe.js' });
  map.addMapping({ generated: { line: 1, column: position }, original: { line: 3, column: 0 }, source: '../' + file });
  await mkdir(resolve(root, '_astro'), { recursive: true });
  await mkdir(resolve(root, 'site/journeys'), { recursive: true });
  await writeFile(resolve(root, file), source);
  await writeFile(resolve(root, '_astro/probe.js.map'), map.toString());
  const server = createServer((request, response) => {
    response.setHeader('content-type', request.url === '/_astro/probe.js' ? 'text/javascript' : 'text/html');
    response.end(request.url === '/_astro/probe.js' ? script : '<button class="action">Go</button><script src="/_astro/probe.js"></script>');
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No port');
  const browser = await (engine === 'chromium' ? chromium : webkit).launch();
  try {
    for (const removed of [false, true]) {
      const page = await browser.newPage();
      const read = await reachability(page, root, [
        { id: 'handler:site:journeys:fixture:module:click:1', kind: 'handler', source: file + ':1', eventTypes: ['click'] },
        { id: 'control:fixture', kind: 'control', source: file + ':1', tag: 'button', selector: '.action' },
      ], root);
      await page.goto(`http://127.0.0.1:${address.port}/`);
      const action = removed ? async () => {} : async () => { await page.locator('button').click(); };
      await action();
      const evidence = await read();
      const required = ['handler:site:journeys:fixture:module:click:1', 'control:fixture'];
      const journey: RegisteredJourney = { id: 'fixture', status: { desktop: 'qualified' }, exercises: required, run: action };
      const gate = coverageGate([journey], required, [], undefined, parseRunObservations([{ journey: 'fixture', profile: 'desktop', signature: signature(journey), observed: evidence.observed, captures: 1, evidence: 'output/current-run' }]));
      assert.equal(gate.passed, !removed, 'Action deletion must turn coverage red');
      if (removed) { assert.deepEqual(evidence.observed, []); assert.throws(() => requireObserved(required, evidence.observed), /unobserved/u); }
      else {
        assert.deepEqual(evidence.observed, ['control:fixture', 'handler:site:journeys:fixture:module:click:1']);
        assert.doesNotThrow(() => requireObserved(required, evidence.observed));
        assert.equal(await page.evaluate('hits'), 1, 'Duplicate registration must remain one invocation');
        await page.evaluate('button.removeEventListener("click",callback)');
        await page.locator('button').click();
        assert.equal(await page.evaluate('hits'), 1, 'Original callback removal must remove its tap');
      }
      if (!removed) await page.evaluate(() => {
        const target = new EventTarget(); let calls = 0;
        const listener = () => { calls++; };
        target.addEventListener('proof', listener, { once: true });
        target.dispatchEvent(new Event('proof')); target.dispatchEvent(new Event('proof'));
        target.addEventListener('proof', listener, { once: true }); target.dispatchEvent(new Event('proof'));
        const controller = new AbortController();
        target.addEventListener('proof', listener, { signal: controller.signal }); controller.abort();
        target.dispatchEvent(new Event('proof'));
        target.addEventListener('proof', listener); target.dispatchEvent(new Event('proof'));
        target.removeEventListener('proof', listener); target.dispatchEvent(new Event('proof'));
        if (calls !== 3) throw new Error('Once/re-registration/signal/removal semantics changed');
      });
      await page.close();
    }
  } finally {
    await browser.close(); await new Promise<void>(done => server.close(() => done())); await rm(root, { recursive: true, force: true });
  }
});

test('a native host link cannot masquerade as the external-source anchor sharing its classes', { skip: process.env.JOURNEY_MUTATIONS !== '1' }, async () => {
  const root = await mkdtemp(resolve('output/journeys/alias-'));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const read = await reachability(page, root, [{ id: 'control:external', kind: 'control', source: 'site/source.astro:1', tag: 'a', selector: '.row.preview', markup: '<a class="row preview" target="_blank" href={source.url}>' }]);
    await page.route('http://127.0.0.1:1/', route => route.fulfill({ contentType: 'text/html', body: '<a class="object-link row preview" href="#host">Native host</a><a id="same" class="row preview" href="#same" target="_self">Native same classes</a><a class="row preview" href="#source" target="_blank">Source</a>' }));
    await page.goto('http://127.0.0.1:1/');
    await page.locator('.object-link').click();
    assert.deepEqual((await read()).observed, [], 'The extra class and different target identify another producer');
    await page.locator('#same').click();
    assert.deepEqual((await read()).observed, [], 'Identical classes do not override a different fixed target');
    const mutant = await browser.newPage();
    await mutant.addInitScript(installTap, [{ id: 'control:external', selector: 'a.row.preview' }]);
    await mutant.route('http://127.0.0.1:1/', route => route.fulfill({ contentType: 'text/html', body: '<a class="object-link row preview" href="#host">Native host</a>' }));
    await mutant.goto('http://127.0.0.1:1/'); await mutant.locator('.object-link').click();
    const falseCredit: unknown = await mutant.evaluate(() => {
      const probe: unknown = Reflect.get(window, '__journeyReachability');
      if (!probe || typeof probe !== 'object' || !('read' in probe) || typeof probe.read !== 'function') throw new Error('Missing mutant tap');
      return probe.read();
    });
    if (!falseCredit || typeof falseCredit !== 'object' || !('controls' in falseCredit)) throw new Error('Missing mutant controls');
    assert.throws(() => assert.deepEqual(falseCredit.controls, []), /deep-equal/u, 'Deleting the fingerprint must turn alias rejection red');
    await mutant.close();
  } finally { await browser.close(); await rm(root, { recursive: true, force: true }); }
});
for (const engine of ['chromium', 'webkit'] as const) test(`${engine}: RAF credit requires an invoked callback; cancellation and deletion lose credit`, { skip: process.env.JOURNEY_MUTATIONS !== '1' }, async () => {
  const root = await mkdtemp(resolve('output/journeys/raf-'));
  const file = 'site/journeys/raf-fixture.mts';
  const source = 'function start() { requestAnimationFrame(tick); } function tick() { requestAnimationFrame(done); }';
  const script = 'function done(){} function tick(){requestAnimationFrame(done)} function start(){return requestAnimationFrame(tick)} window.start=start;';
  const map = new SourceMapGenerator({ file: 'probe.js' });
  for (const [generated, original] of [[script.indexOf('requestAnimationFrame(done)'), source.indexOf('requestAnimationFrame(done)')], [script.indexOf('requestAnimationFrame(tick)'), source.indexOf('requestAnimationFrame(tick)')]]) {
    if (generated === undefined || original === undefined) throw new Error('Missing RAF source position');
    map.addMapping({ generated: { line: 1, column: generated }, original: { line: 1, column: original }, source: '../' + file });
  }
  await mkdir(resolve(root, '_astro'), { recursive: true }); await mkdir(resolve(root, 'site/journeys'), { recursive: true });
  await writeFile(resolve(root, file), source); await writeFile(resolve(root, '_astro/probe.js.map'), map.toString());
  const server = createServer((request, response) => {
    response.setHeader('content-type', request.url === '/_astro/probe.js' ? 'text/javascript' : 'text/html');
    response.end(request.url === '/_astro/probe.js' ? script : '<script src="/_astro/probe.js"></script>');
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing server port');
  const browser = await (engine === 'chromium' ? chromium : webkit).launch();
  try {
    for (const mode of ['run', 'cancel', 'delete']) {
      const page = await browser.newPage();
      await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') }); await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
      const ids = ['handler:site:journeys:raf-fixture:start:animation-frame:1', 'handler:site:journeys:raf-fixture:tick:animation-frame:1'];
      const read = await reachability(page, root, ids.map(id => ({ id, kind: 'handler', source: file + ':1', eventTypes: ['animation-frame'], mechanism: 'raf-sole-driver' })), root);
      await page.goto(`http://127.0.0.1:${address.port}/`);
      await page.evaluate(mode => { const start: unknown = Reflect.get(window, 'start'); if (typeof start !== 'function') throw new Error('Missing start'); if (mode !== 'delete') { const id = start(); if (mode === 'cancel') cancelAnimationFrame(id); } }, mode);
      assert.deepEqual((await read()).observed, [], 'Registration alone has no credit');
      await page.clock.runFor(48);
      assert.deepEqual((await read()).observed, mode === 'run' ? ids : []);
      await page.close();
    }
  } finally { await browser.close(); await new Promise<void>(done => server.close(() => done())); await rm(root, { recursive: true, force: true }); }
});
