// End-to-end: real production build, real Chrome install and launch (CDP PWA
// domain), real worker lifecycle, real server outage. Headless app windows
// report display-mode: browser, so app pages get a matchMedia override for
// standalone; everything else is real.
import { createReadStream, mkdtempSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { Socket } from 'node:net';
import { extname, join, normalize } from 'node:path';
import { chromium, type BrowserContext, type CDPSession, type Page } from 'playwright';

const SKIP_TAB_VISIT = process.env.SKIP_TAB_VISIT === '1';
const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
let down = false;
const sockets = new Set<Socket>();
const server = createServer(async (request, response) => {
  if (down) { request.socket.destroy(); return; }
  let file = normalize(join('dist', decodeURIComponent(new URL(request.url ?? '/', 'http://x').pathname)));
  try {
    let info = await stat(file);
    if (info.isDirectory()) { file = join(file, 'index.html'); info = await stat(file); }
    const etag = `W/"${info.size}-${info.mtimeMs}"`;
    if (request.headers['if-none-match'] === etag) { response.writeHead(304, { etag }); response.end(); return; }
    response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'content-length': info.size, etag, 'cache-control': 'no-cache' });
    createReadStream(file).pipe(response);
  } catch { response.writeHead(404); response.end(); }
});
server.on('connection', s => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
await new Promise<void>(r => server.listen(4298, '127.0.0.1', r));
const base = 'http://127.0.0.1:4298';
const manifestId = `${base}/`;
const log = (step: string, value: unknown) => console.log(step.padEnd(34), JSON.stringify(value));

const context: BrowserContext = await chromium.launchPersistentContext(mkdtempSync('output/e2e-profile-'), { channel: 'chromium', headless: true, viewport: { width: 1280, height: 720 } });
const standalone = () => {
  const original = window.matchMedia.bind(window);
  window.matchMedia = query => query === '(display-mode: standalone)'
    ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false } as MediaQueryList
    : original(query);
};
async function ready(page: Page, path: string) {
  try {
    await page.goto(base + path, { waitUntil: 'commit', timeout: 30000 });
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout: 60000 });
    return { path, ready: true, controlled: await page.evaluate(() => !!navigator.serviceWorker.controller) };
  } catch (error) { return { path, ready: false, error: String(error).split('\n')[0].slice(0, 120) }; }
}
const workerState = (page: Page) => page.evaluate(async () => ({
  registrations: (await navigator.serviceWorker.getRegistrations()).length,
  caches: await caches.keys(),
  stored: (await caches.has('cssearth-runtime-v1')) ? (await (await caches.open('cssearth-runtime-v1')).keys()).length : 0,
}));
async function settleCopies(page: Page) {
  let last = -1, stable = 0;
  for (let i = 0; i < 60 && stable < 3; i++) {
    const { stored } = await workerState(page);
    stable = stored === last ? stable + 1 : 0; last = stored;
    await page.waitForTimeout(2000);
  }
  return last;
}

// 1. A browser tab: never controlled; Chrome's own install offer shows the button.
const tab = context.pages()[0] ?? await context.newPage();
log('1 tab /moon/', await ready(tab, '/moon/'));
await tab.waitForTimeout(3000);
log('1 tab worker state', await workerState(tab));
log('1 install offered, button shown', await tab.waitForFunction(() => document.documentElement.dataset.installable === 'true', null, { timeout: 20000 })
  .then(() => tab.evaluate(() => getComputedStyle(document.querySelector('[data-install-app]')!).display !== 'none'), () => 'no offer'));

// 2. Install through Chrome itself.
const cdp: CDPSession = await context.newCDPSession(tab);
log('2 PWA.install', await cdp.send('PWA.install' as never, { manifestId } as never).then(() => 'ok', e => String(e).slice(0, 120)));
await tab.waitForTimeout(1500);
log('2 button after install', await tab.evaluate(() => ({ installable: document.documentElement.dataset.installable ?? null, shown: getComputedStyle(document.querySelector('[data-install-app]')!).display !== 'none' })));

// 3. Launch the installed app.
const opened = context.waitForEvent('page', { timeout: 15000 });
log('3 PWA.launch', await cdp.send('PWA.launch' as never, { manifestId } as never).then(r => r, e => String(e).slice(0, 120)));
const app = await opened;
await app.waitForLoadState();
log('3 app window display-mode', await app.evaluate(() => ['browser', 'standalone'].filter(m => matchMedia(`(display-mode: ${m})`).matches)));
await app.addInitScript(standalone);
log('3 app start page', await ready(app, '/'));
await app.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20000 }).catch(() => undefined);
log('3 app controlled', await app.evaluate(() => !!navigator.serviceWorker.controller));
if (process.env.EARTH_SETTLE === '1') log('3 stored after settling on Earth', await settleCopies(app));
else log('3 stored when leaving Earth', (await workerState(app)).stored);

// 4. Visit the Moon in the app and let the copies settle.
log('4 app /moon/', await ready(app, '/moon/'));
log('4 stored files after settling', await settleCopies(app));
log('4 worker state', await workerState(app));

// 5. The same visitor opens the site in an ordinary tab, online.
if (!SKIP_TAB_VISIT) {
  const again = await context.newPage();
  log('5 tab /saturn/ online', await ready(again, '/saturn/'));
  await again.waitForTimeout(5000);
  log('5 worker state after tab visit', await workerState(again));
  await again.close();
}

// 6. Real outage, then relaunch the app.
await app.close();
down = true; for (const s of sockets) s.destroy();
const relaunched = await context.newPage();
await relaunched.addInitScript(standalone);
log('6 offline app start page', await ready(relaunched, '/'));
log('6 offline app /moon/', await ready(relaunched, '/moon/'));
await relaunched.waitForTimeout(4000);
log('6 offline moon labels visible', await relaunched.evaluate(() => [...document.querySelectorAll('[data-feature-label]')].filter(e => { const cs = getComputedStyle(e); return cs.visibility === 'visible' && Number(cs.opacity) > 0 && e.getBoundingClientRect().width > 0; }).length).catch(() => 'n/a'));
await relaunched.screenshot({ path: `output/e2e-offline-moon${SKIP_TAB_VISIT ? '-no-tab' : ''}.png` }).catch(() => undefined);
log('6 offline app /jupiter/ (never visited)', await ready(relaunched, '/jupiter/'));
await context.close();
for (const s of sockets) s.destroy();
server.close();
