/** Opt-in real-browser extraction mutations on a controlled static page; not a real-site baseline. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium, webkit, type Browser } from 'playwright';
import { startServer } from './server.mts';
import { recorder } from './recorder.mts';
import { journeyApi } from './api.mts';
import { compareDirectories } from './differ.mts';
import { parseTrace, json, type Family, families } from './trace.mts';
import { profiles } from './profiles.mts';
const exec = promisify(execFile);
const enabled = process.env.JOURNEY_MUTATIONS === '1';
interface Mutation { name: string; primary: Family; families: Family[]; script: string; route?: 'status' | 'failure' | 'redirect' }
const cases: Mutation[] = [
  { name: 'network-volatile-initiator', primary: 'network', families: ['network'], script: "await fetch('/probe/a')" },
  { name: 'parser-scripted-text', primary: 'dom', families: ['dom'], script: "document.querySelector('style').firstChild.nodeValue += ' '" },
  { name: 'network-repeat', primary: 'network', families: ['network'], script: "await fetch('/probe/a'); await fetch('/probe/a')" },
  { name: 'network-status', primary: 'network', families: ['network'], route: 'status', script: "await fetch('/probe/a')" },
  { name: 'network-failure', primary: 'network', families: ['network', 'errors'], route: 'failure', script: "await fetch('/probe/a').catch(() => {})" },
  { name: 'network-order', primary: 'network', families: ['network'], script: "await fetch('/probe/b'); await fetch('/probe/a')" },
  { name: 'network-cancellation', primary: 'network', families: ['network'], script: "const controller = new AbortController(); const pending = fetch('/probe/a', { signal: controller.signal }); setTimeout(() => controller.abort(), 16); await pending.catch(() => {})" },
  { name: 'network-redirect', primary: 'network', families: ['network'], route: 'redirect', script: "await fetch('/probe/a')" },
  { name: 'dom-transient', primary: 'dom', families: ['dom'], script: "const node = document.createElement('span'); document.body.append(node); node.remove()" },
  { name: 'dom-classification', primary: 'dom', families: ['dom'], script: "document.dispatchEvent(new CustomEvent('objectmotionchange', { detail: { active: true, coasting: true } })); const node = document.querySelector('.object-stage'); node.style.transform = 'translateX(1px)'; node.style.transform = ''; await Promise.resolve(); document.dispatchEvent(new CustomEvent('objectmotionchange', { detail: { active: false, coasting: false } }))" },
  { name: 'dom-attribute', primary: 'dom', families: ['dom'], script: "document.querySelector('.object-stage').setAttribute('aria-label', 'changed')" },
  { name: 'rendering-geometry', primary: 'rendering', families: ['rendering'], script: '' },
  { name: 'rendering-screenshot', primary: 'rendering', families: ['rendering'], script: '' },
  { name: 'content-text', primary: 'content', families: ['dom', 'rendering', 'content'], script: "document.querySelector('.object-sidebar').firstChild.nodeValue = 'Changed text'" },
  { name: 'content-title', primary: 'content', families: ['dom', 'content'], script: "document.title = 'Changed title'" },
  { name: 'content-url-history', primary: 'content', families: ['content'], script: "history.pushState({ changed: true }, '', '?changed=1')" },
  { name: 'content-data', primary: 'content', families: ['dom', 'content'], script: "document.documentElement.dataset.changed = 'yes'" },
  { name: 'errors-pageerror', primary: 'errors', families: ['errors'], script: "queueMicrotask(() => { throw new Error('deliberate-pageerror') })" },
  { name: 'errors-rejection', primary: 'errors', families: ['errors'], script: "Promise.reject(new Error('deliberate-rejection'))" },
  { name: 'errors-console-error', primary: 'errors', families: ['errors'], script: "console.error('deliberate-console-error')" },
  { name: 'errors-console-warning', primary: 'errors', families: ['errors'], script: "console.warn('deliberate-console-warning')" },
  { name: 'errors-worker', primary: 'errors', families: ['errors'], script: "const worker = new Worker('/probe/worker.js'); await new Promise(done => worker.addEventListener('error', done)); worker.terminate()" },
];
cases.push({ name: 'content-history-values', primary: 'content', families: ['content'], script: "history.replaceState({ choice: 'head', nested: { number: 2 } }, '', location.href)" });
cases.push({ name: 'rendering-playback', primary: 'rendering', families: ['rendering'], script: "document.getAnimations()[0].play()" });
cases.push({ name: 'input-timestamp', primary: 'content', families: ['content', 'rendering'], script: '' });
const html = `<!doctype html><html><head><title>Detector fixture</title><style>
body { margin: 0; background: white; color: black; font: 16px Arial; }
.object-stage { position: absolute; left: 10px; top: 100px; width: 40px; height: 40px; background: black; }
.geometry:hover ~ .object-stage { left: 11px; }
.pixel:hover ~ .object-stage { background: red; }
.geometry { position: absolute; left: 100px; top: 100px; width: 20px; height: 20px; }
.pixel { position: absolute; left: 150px; top: 100px; width: 20px; height: 20px; }
</style></head><body><div class="geometry"></div><div class="pixel"></div><div class="object-stage"></div>
<div class="object-ui-layer"><div class="object-sidebar">Original text</div></div>
<script>document.documentElement.dataset.ready = 'true';</script></body></html>`;
async function record(browser: Browser, engine: 'chromium' | 'webkit', origin: string, redirectOrigin: string, out: string, mutation: Mutation, changed: boolean) {
  const profile = profiles[`${engine}-desktop`]; if (!profile) throw new Error('Missing desktop');
  const context = await browser.newContext(profile), page = await context.newPage();
  try {
    if (mutation.name === 'input-timestamp') await page.addInitScript(() => {
      // Exercise a sender clock outside the virtual RAF coordinate, even on engines that already align it.
      window.addEventListener('wheel', event => Object.defineProperty(event, 'timeStamp', { value: -1, configurable: true }), { capture: true });
    });
    await page.clock.install({ time: new Date('2025-12-31T23:59:59.000Z') });
    await page.clock.pauseAt(new Date('2026-01-01T00:00:00.000Z'));
    await page.route('**/probe/**', async route => {
      if (route.request().url().endsWith('worker.js')) { await route.fulfill({ contentType: 'text/javascript', body: changed ? "throw new Error('deliberate-worker')" : "self.postMessage('healthy')" }); return; }
      if (changed && mutation.route === 'status') { await route.fulfill({ status: 201, body: 'a' }); return; }
      if (changed && mutation.route === 'failure') { await route.abort('failed'); return; }
      if (changed && mutation.route === 'redirect' && route.request().url().endsWith('/a')) {
        await route.continue({ url: redirectOrigin + '/redirect' }); return;
      }
      if (changed && mutation.name === 'network-cancellation') await new Promise(done => setTimeout(done, 100));
      await route.fulfill({ status: 200, body: 'a' });
    });
    const trace = parseTrace({ schema: 'cssearth-journey@1', journey: mutation.name, profile: `${engine}-desktop`,
      toolchain: { browser: browser.version(), profile: json(profile) }, exercises: ['fixture:recorder'],
      observations: { network: [], dom: [], rendering: [], content: [], errors: [] } });
    const recording = await recorder(page, trace, origin, out, engine, { orderings: mutation.name === 'network-order' ? [['/probe/a', '/probe/b']] : [], volatileInitiators: mutation.name === 'network-volatile-initiator' ? [{ url: '/probe/a', scripts: ['/probe/caller.js', '/probe/other.js'], cause: 'Controlled concurrent caller feature' }] : [] }), api = journeyApi(page, origin, recording);
    await api.load('/milky-way/', 'before');
    if (mutation.name === 'rendering-playback') {
      await page.evaluate(() => {
        const target = document.querySelector('.object-stage');
        if (!target) throw new Error('Missing native animation target');
        const animation = target.animate([{ opacity: 1 }, { opacity: 1 }], { duration: 10000, iterations: Infinity });
        animation.id = 'fixture-light-curve'; animation.pause(); animation.currentTime = 0;
      });
      await recording.playback('before-playback');
    }
    if (mutation.name === 'content-history-values') await page.evaluate(() => history.replaceState({ choice: 'base', nested: { number: 1 } }, '', location.href));
    recording.setStep('after');
    if (mutation.name === 'input-timestamp') {
      await page.evaluate(perturbed => {
        document.addEventListener('wheel', event => {
          if (perturbed) Object.defineProperty(event, 'timeStamp', { value: performance.now() + 1 });
          const field = document.querySelector('.object-sidebar');
          if (!field) throw new Error('Missing input clock fixture');
          field.textContent = event.timeStamp === performance.now() ? 'aligned' : 'unaligned';
        }, { once: true });
      }, changed);
      await api.input('wheel', () => page.mouse.wheel(0, -120));
    }
    let script = changed ? mutation.script : mutation.name.startsWith('network-') ? "await fetch('/probe/a')" : '';
    if (!changed && mutation.name === 'network-order') script = "await fetch('/probe/a'); await fetch('/probe/b')";
    if (!changed && mutation.name === 'errors-worker') script = "const worker = new Worker('/probe/worker.js'); await new Promise(done => worker.addEventListener('message', done)); worker.terminate()";
    if (mutation.name === 'network-volatile-initiator') script = `await fetch('/probe/a')`;
    const source = mutation.name === 'network-volatile-initiator' ? `\n//# sourceURL=/probe/${changed ? 'regression' : 'caller'}.js` : '';
    const evaluate = page.evaluate(`(async () => { ${script} })()` + source);
    // Step concurrently: cancellation and error injections intentionally use fake timers.
    await api.frames(4); await evaluate; await api.frames(4);
    if (changed && mutation.name === 'rendering-geometry') await page.mouse.move(110, 110);
    if (changed && mutation.name === 'rendering-screenshot') await page.mouse.move(160, 110);
    await api.barrier('after', '/milky-way/');
    if (mutation.name === 'rendering-playback') await recording.playback('after-playback');
    await recording.save();
  } finally { await context.close(); }
}
test('browser recorder mutations', { skip: !enabled, timeout: 180000 }, async t => {
  const root = resolve(process.env.MUTATION_OUT ?? 'output/journeys/browser-mutations');
  await mkdir(resolve(root, 'dist/scenes'), { recursive: true });
  await mkdir(resolve(root, 'dist/milky-way'), { recursive: true });
  await mkdir(resolve(root, 'tmp'), { recursive: true }); process.env.TMPDIR = resolve(root, 'tmp');
  await writeFile(resolve(root, 'dist/milky-way/index.html'), html);
  const server = await startServer(resolve(root, 'dist'));
  const redirect = createServer((request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    if (request.url === '/redirect') { response.writeHead(302, { location: '/target' }); response.end(); }
    else { response.writeHead(200); response.end('a'); }
  });
  await new Promise<void>(done => redirect.listen(0, '127.0.0.1', done));
  const address = redirect.address(); if (!address || typeof address === 'string') throw new Error('Redirect server failed');
  const redirectOrigin = `http://127.0.0.1:${address.port}`;
  const results: string[] = [];
  try {
    for (const engine of ['chromium', 'webkit'] as const) {
      const browser = await (engine === 'chromium' ? chromium : webkit).launch({ headless: true });
      try {
        for (const mutation of cases.filter(value => (engine === 'chromium' || value.name !== 'network-volatile-initiator') && (!process.env.MUTATION_ONLY || value.name === process.env.MUTATION_ONLY))) {
          await t.test(`${engine} ${mutation.name}`, async () => {
            const at = Date.now(), out = resolve(root, engine, mutation.name);
            await record(browser, engine, server.origin, redirectOrigin, resolve(out, 'base'), mutation, false);
            await record(browser, engine, server.origin, redirectOrigin, resolve(out, 'control'), mutation, false);
            assert.deepEqual(await compareDirectories(resolve(out, 'base'), resolve(out, 'control')), [], 'unperturbed control must match');
            await record(browser, engine, server.origin, redirectOrigin, resolve(out, 'head'), mutation, true);
            const differences = await compareDirectories(resolve(out, 'base'), resolve(out, 'head'));
            const actual = [...new Set(differences.map(row => row.family))].sort();
            assert.ok(actual.includes(mutation.primary), `Detector missing: ${mutation.primary}; ${JSON.stringify(differences)}`);
            const expected = engine === 'webkit' && mutation.name === 'network-failure' ? ['network'] : mutation.families;
            assert.deepEqual(actual, [...expected].sort(), JSON.stringify(differences));
            results.push(`| ${engine} | ${mutation.name} | ${actual.join(', ')} | 0 | ${(Date.now() - at) / 1000} s |`);
          });
        }
      } finally { await browser.close(); }
    }
  } finally {
    await server.close(); await new Promise<void>(done => redirect.close(() => done()));
    await writeFile(resolve(root, 'results.md'), '| Engine | Mutation | Families | Assertion exit | Cost |\n| --- | --- | --- | --- | --- |\n' + results.join('\n') + '\n');
  }
});
test('delete recorder detector mutations', { skip: !enabled || process.env.MUTATION_ONLY !== undefined || process.env.DELETE_DETECTORS !== '1', timeout: 180000 }, async () => {
  const root = resolve('output/journeys/deleted-recorder');
  await mkdir(root, { recursive: true });
  const source = await readFile(resolve(import.meta.dirname, 'recorder.mts'), 'utf8');
  let resultsNative = 0;
  const exemplars: Record<Family, string> = { network: 'network-repeat', dom: 'dom-transient', rendering: 'rendering-screenshot', content: 'content-url-history', errors: 'errors-console-error' };
  try {
    for (const file of ['server-child.mts', 'server.mts', 'profiles.mts', 'recorder.mts', 'reachability.mts', 'listener-resolver.mts', 'binding-sites.mts', 'history.mts', 'api.mts', 'trace.mts', 'differ.mts', 'png.mts', 'canonical.mts', 'volatile.mts', 'probe.mts', 'recorder.mutation.test.mts']) {
      let text = await readFile(resolve(import.meta.dirname, file), 'utf8');
      if (file === 'server-child.mts') text = text.replace('../../server/preview.mts', '../../../../site/server/preview.mts');
      if (file === 'server.mts') text = text.replace("'../../..'", "'../../../..'");
      await writeFile(resolve(root, file), text);
    }
    for (const family of [...families, 'rendering'] as const) {
      const needle = '    const rows = trace.observations[family];';
      assert.ok(source.includes(needle));
      const nativePlayback = family === 'rendering' && resultsNative++ > 0;
      const playbackNeedle = "      add('rendering', { playback: json(input) });";
      if (nativePlayback) assert.ok(source.includes(playbackNeedle));
      await writeFile(resolve(root, 'recorder.mts'), nativePlayback
        ? source.replace(playbackNeedle, '      void input;')
        : source.replace(needle, `    if (family === '${family}') return;\n${needle}`));
      const value = nativePlayback ? 'rendering-playback' : exemplars[family]; if (!value) throw new Error('Missing exemplar');
      await assert.rejects(exec(process.execPath, ['--test', resolve(root, 'recorder.mutation.test.mts')], {
        cwd: process.cwd(), env: { ...process.env, MUTATION_ONLY: value, MUTATION_OUT: resolve(root, family), DELETE_DETECTORS: '0', NODE_TEST_CONTEXT: undefined }, timeout: 90000,
      }), error => error instanceof Error && 'code' in error && error.code === 1 && 'stdout' in error && typeof error.stdout === 'string' && error.stdout.includes(`Detector missing: ${family}`) && error.stdout.includes(`not ok 1 - chromium ${value}`) && error.stdout.includes(`not ok 2 - webkit ${value}`));
    }
    const apiSource = await readFile(resolve(import.meta.dirname, 'api.mts'), 'utf8');
    const timestamp = "        if (eventType === 'wheel') Object.defineProperty(event, 'timeStamp', { value: performance.now(), configurable: true });";
    assert.ok(apiSource.includes(timestamp));
    await writeFile(resolve(root, 'api.mts'), apiSource.replace(timestamp, ''));
    await assert.rejects(exec(process.execPath, ['--test', resolve(root, 'recorder.mutation.test.mts')], {
      cwd: process.cwd(), env: { ...process.env, MUTATION_ONLY: 'input-timestamp', MUTATION_OUT: resolve(root, 'input-timestamp'), DELETE_DETECTORS: '0', NODE_TEST_CONTEXT: undefined }, timeout: 90000,
    }), error => error instanceof Error && 'code' in error && error.code === 1 && 'stdout' in error && typeof error.stdout === 'string'
      && error.stdout.includes('Detector missing: content') && error.stdout.includes('not ok 1 - chromium input-timestamp') && error.stdout.includes('not ok 2 - webkit input-timestamp'));
  } finally { await rm(root, { recursive: true, force: true }); }
});
