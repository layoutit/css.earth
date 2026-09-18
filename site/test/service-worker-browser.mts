// Offline worker contract in real engines: Chromium, WebKit and Firefox run the
// bundled worker and the page's registration code against a small synthetic
// site. "Offline" is a real outage of the test server, because Playwright's
// offline switch in WebKit also blocks worker responses.
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { gzipSync } from 'node:zlib';
import type { AddressInfo, Socket } from 'node:net';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { build } from 'esbuild';
import { chromium, firefox, webkit, type BrowserType, type Page } from 'playwright';

import { bundleServiceWorker } from '../../tools/service-worker-bundle.mts';
import { NETWORK_DOWN_WINDOW_MS } from '../service-worker/policy.mts';

const REGISTRATION = fileURLToPath(new URL('../service-worker-registration.mts', import.meta.url));
const ENGINES: Record<string, BrowserType> = { chromium, webkit, firefox };
const selected = (process.env.SERVICE_WORKER_ENGINES ?? 'chromium,webkit,firefox').split(',');

async function registrationScript(enabled: boolean): Promise<string> {
  const result = await build({
    stdin: { contents: `import { registerServiceWorker } from ${JSON.stringify(REGISTRATION)}; registerServiceWorker(window, ${enabled});`, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, format: 'iife', target: 'es2022', write: false,
  });
  return result.outputFiles[0]!.text;
}

// One deploy of the synthetic site: a page, a named data file the page reads,
// the worker and the registration script. Changing `version` is a deploy.
class Site {
  version = 1;
  down = false;
  offlineSupport = true;
  workerSuffix = '';
  private sockets = new Set<Socket>();
  private server = createServer((request, response) => { void this.handle(request, response); });
  private worker = '';
  private register = { on: '', off: '' };

  async start() {
    this.worker = await bundleServiceWorker({ minify: false });
    this.register = { on: await registrationScript(true), off: await registrationScript(false) };
    this.server.on('connection', socket => { this.sockets.add(socket); socket.on('close', () => this.sockets.delete(socket)); });
    await new Promise<void>(accept => this.server.listen(0, '127.0.0.1', accept));
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  outage() { this.down = true; for (const socket of this.sockets) socket.destroy(); }

  async stop() { for (const socket of this.sockets) socket.destroy(); await new Promise(accept => this.server.close(accept)); }

  private async handle(request: IncomingMessage, response: ServerResponse) {
    if (this.down) { request.socket.destroy(); return; }
    const path = new URL(request.url ?? '/', 'http://site').pathname;
    const send = (type: string, body: string) => {
      const etag = `W/"${path}-${this.version}-${this.workerSuffix}-${this.offlineSupport}"`;
      if (request.headers['if-none-match'] === etag) { response.writeHead(304, { etag }); response.end(); return; }
      // Compressed like the production host, so stored copies must not replay transport headers.
      const compressed = gzipSync(body);
      response.writeHead(200, { 'content-type': type, etag, 'cache-control': 'no-cache', 'content-encoding': 'gzip', 'content-length': compressed.length });
      response.end(compressed);
    };
    if (path === '/alpha/' || path === '/beta/') {
      send('text/html; charset=utf-8', `<!doctype html><title>fixture</title><meta name="deploy" content="v${this.version}">
<body><output id="data"></output><script>
fetch('/scenes/alpha/data.json').then(r => r.json()).then(d => { document.getElementById('data').value = d.version; document.documentElement.dataset.ready = 'true'; });
</script><script src="/register.js"></script>`);
    } else if (path === '/scenes/alpha/data.json') {
      send('application/json', JSON.stringify({ version: `v${this.version}` }));
    } else if (path === '/register.js') {
      send('text/javascript', this.offlineSupport ? this.register.on : this.register.off);
    } else if (path === '/sw.js') {
      send('text/javascript', `${this.worker}\n${this.workerSuffix}`);
    } else {
      response.writeHead(404); response.end();
    }
  }
}

async function open(page: Page, url: string) {
  await page.goto(url);
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  return page.evaluate(() => ({
    deploy: document.querySelector('meta[name=deploy]')?.getAttribute('content'),
    data: (document.getElementById('data') as HTMLOutputElement).value,
    controlled: !!navigator.serviceWorker.controller,
  }));
}

// Waits until the worker's stored copies of the page and its data file match a deploy.
async function storedVersion(page: Page, base: string, version: string) {
  const deadline = Date.now() + 20_000;
  for (;;) {
    const stored = await page.evaluate(async origin => {
      if (!(await caches.has('cssearth-runtime-v1'))) return null;
      const cache = await caches.open('cssearth-runtime-v1');
      const html = await (await cache.match(`${origin}/alpha/`))?.text();
      const data = await (await cache.match(`${origin}/scenes/alpha/data.json`))?.json();
      return { page: html?.match(/content="(v\d+)"/)?.[1], data: data?.version };
    }, base);
    if (stored?.page === version && stored.data === version) return;
    if (Date.now() > deadline) assert.fail(`stored copies never reached ${version}: ${JSON.stringify(stored)}`);
    await page.waitForTimeout(250);
  }
}

const liveData = (page: Page) => page.evaluate(async () => (await (await fetch('/scenes/alpha/data.json')).json()).version);
const state = (page: Page) => page.evaluate(async () => ({
  registrations: (await navigator.serviceWorker.getRegistrations()).length,
  caches: (await caches.keys()).filter(name => name.startsWith('cssearth-')),
}));

for (const name of selected) {
  const engine = ENGINES[name];
  if (!engine) throw new Error(`Unknown engine ${name}.`);

  test(`${name}: the offline worker never keeps a visitor on stale content`, async t => {
    const site = new Site();
    const base = await site.start();
    const browser = await engine.launch({ headless: true });
    t.after(async () => { await browser.close(); await site.stop(); });
    let page = await (await browser.newContext()).newPage();

    if (name === 'firefox') {
      // Firefox tabs are never controlled, and a worker left by an earlier build is removed.
      assert.equal((await open(page, `${base}/alpha/`)).controlled, false);
      assert.equal((await state(page)).registrations, 0);
      await page.evaluate(async () => { await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready; await (await caches.open('cssearth-runtime-v1')).put('/planted', new Response('old')); });
      await open(page, `${base}/alpha/`);
      await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistrations()).length === 0);
      assert.deepEqual(await state(page), { registrations: 0, caches: [] });
      return;
    }

    await t.test('a visit is stored for offline use', async () => {
      await open(page, `${base}/alpha/`);
      await page.waitForFunction(() => !!navigator.serviceWorker.controller);
      await storedVersion(page, base, 'v1');
    });

    await t.test('after a deploy, online visitors see it at once and the stored copies follow', async () => {
      site.version = 2;
      assert.deepEqual(await open(page, `${base}/alpha/`), { deploy: 'v2', data: 'v2', controlled: true });
      await storedVersion(page, base, 'v2');
    });

    await t.test('offline, visited pages load from storage and unvisited pages fail', async () => {
      site.outage();
      assert.deepEqual(await open(page, `${base}/alpha/`), { deploy: 'v2', data: 'v2', controlled: true });
      await assert.rejects(page.goto(`${base}/beta/`));
      // Reopening the app after that failure still finds the stored page. A new
      // tab avoids racing Chromium's late-committing error page for /beta/.
      page = await page.context().newPage();
      assert.deepEqual(await open(page, `${base}/alpha/`), { deploy: 'v2', data: 'v2', controlled: true });
    });

    await t.test('when the connection returns, fresh files arrive without a reload', async () => {
      site.version = 3;
      site.down = false;
      // Within the window after the failure, storage still answers first.
      assert.equal(await liveData(page), 'v2');
      await page.waitForTimeout(NETWORK_DOWN_WINDOW_MS + 500);
      assert.equal(await liveData(page), 'v3');
    });

    await t.test('an updated worker takes over and deletes caches it does not own', async () => {
      await page.evaluate(async () => { await (await caches.open('cssearth-runtime-v0')).put('/planted', new Response('old')); });
      site.workerSuffix = '// updated worker';
      await open(page, `${base}/alpha/`);
      await page.waitForFunction(async () => !(await caches.has('cssearth-runtime-v0')));
    });

    await t.test('turning offline support off removes the worker and every copy', async () => {
      site.offlineSupport = false;
      await open(page, `${base}/alpha/`);
      await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistrations()).length === 0);
      await page.waitForFunction(async () => (await caches.keys()).every(name => !name.startsWith('cssearth-')));
      assert.deepEqual(await state(page), { registrations: 0, caches: [] });
    });
  });
}
