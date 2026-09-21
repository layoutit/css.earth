import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { chromium } from 'playwright';
import { conformanceBrowserLaunch } from './conformance-browser-launch.mts';

// The content-addressed object catalogue: proves the client cold-gates its
// JSON index, materializes a bounded row window, keeps it bounded across
// navigation, and remains pixel-identical to the server-rendered fallback.
// Runs against a production build
// (diagnostics disabled), so readiness and identity come from the same
// document attributes the shell itself publishes, not the dev-only
// `window.__cssEarth` inspection API.
const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const output = resolve('output/playwright/catalogue-fragment');
await mkdir(output, { recursive: true });
const browser = await chromium.launch((await conformanceBrowserLaunch({ evidenceDirectory: output })).options);
const cases: string[] = [];
const measurements: Record<string, unknown> = {};

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => consoleErrors.push(error.message));
  const catalogueRequests: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/catalogue/')) catalogueRequests.push(request.url()); });

  await page.goto(`${origin}/saturn/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  await page.waitForTimeout(500);
  measurements.cold = await census(page);
  assert.equal(catalogueRequests.length, 0, 'an untouched page does not fetch the object catalogue');
  assert.equal((measurements.cold as Awaited<ReturnType<typeof census>>).connectedRows, 0);
  const coldResources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name));
  assert.equal(coldResources.some(url => /-features\.json(?:\?|$)/u.test(url)), false, 'an untouched page does not fetch surface features');
  assert.equal(coldResources.some(url => url.includes('level-2048')), false, 'an untouched page does not fetch fine texture pages');
  const browserPanel = page.locator('.planet-object-browser');
  // Opening browse/search is the explicit demand that starts the shared fetch.
  await page.locator('.planet-sidebar-search').fill('all objects');
  await page.waitForFunction(() => document.querySelectorAll('[data-catalogue-window] > .planet-object-item').length > 10,
    undefined, { timeout: 20000 });
  measurements.search = await census(page);
  assert.deepEqual(catalogueRequests.map(url => new URL(url).pathname.endsWith('.json')), [true],
    `the JSON catalogue is fetched exactly once (saw ${catalogueRequests.join(', ')})`);
  assert.ok((measurements.search as Awaited<ReturnType<typeof census>>).connectedRows <= 28,
    'the live catalogue never connects more than its fixed row budget');
  assert.equal((measurements.search as Awaited<ReturnType<typeof census>>).logicalRows, 1285);
  const saturnLink = browserPanel.locator('a.planet-object-link[data-object-id="saturn"]');
  await saturnLink.waitFor({ state: 'attached' });
  assert.equal(await saturnLink.getAttribute('aria-current'), 'page', 'Saturn is marked current once the catalogue loads');
  assert.equal((await saturnLink.getAttribute('class') ?? '').includes('is-active'), true);
  const livePixels = await captureResults(page, `${output}/windowed-all-objects.png`);
  await browserPanel.locator('[data-catalogue-index="0"] a').focus();
  for (let index = 0; index < 35; index++) await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement?.closest('[data-catalogue-index]')?.getAttribute('data-catalogue-index')), '35');
  assert.ok((await census(page)).connectedRows <= 28, 'keyboard navigation recycles the same bounded row window');
  cases.push('Cold bootstrap loads no catalogue; first search loads one JSON index and connects at most 28 rows');
  console.log(cases.at(-1));

  await page.locator('.planet-sidebar-search').fill('vesta');
  const vestaLink = browserPanel.locator('a.planet-object-link[data-object-id="vesta"]');
  await vestaLink.waitFor({ state: 'visible' });
  await vestaLink.click();
  await page.waitForURL(url => url.pathname === '/vesta/');
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true' && document.body.dataset.objectShell === 'vesta');
  await page.locator('.planet-sidebar-search').fill('vesta');
  const currentVesta = browserPanel.locator('a.planet-object-link[data-object-id="vesta"]');
  await currentVesta.waitFor({ state: 'visible' });
  assert.equal(await currentVesta.getAttribute('aria-current'), 'page', 'Vesta becomes the marked row');
  assert.equal((await currentVesta.getAttribute('class') ?? '').includes('is-active'), true);
  measurements.navigation = await census(page);
  await page.screenshot({ path: `${output}/vesta-marked.png` });
  cases.push('In-app navigation Saturn -> Vesta reuses the bounded catalogue and moves the current-row marker');
  console.log(cases.at(-1));
  assert.equal(catalogueRequests.length, 1, `navigating never re-fetches the catalogue (saw ${catalogueRequests.length})`);

  // The Milky Way overview link a page's own catalogue rows carry
  // (`?overview=milky-way` on the Sun's route) is the same zoom-out
  // destination a continuous wheel journey reaches; landing on it directly
  // exercises the same `objectBrowser.setOverview` path deterministically,
  // since precise camera-distance targeting needs the dev-only diagnostics API.
  await page.goto(`${origin}/sun/?overview=milky-way`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  await page.waitForFunction(() => document.documentElement.dataset.selection === 'milky-way', undefined, { timeout: 20000 });
  await page.screenshot({ path: `${output}/sun-zoomed-to-milky-way.png` });
  cases.push('Zooming out from the Sun reaches the Milky Way overview');
  console.log(cases.at(-1));

  assert.deepEqual(consoleErrors, [], `no console errors: ${consoleErrors.join(' | ')}`);
  await context.close();

  // No-JS: the root route searches for "saturn" and reaches the object, using
  // only the no-JS search function's server-side merge of the same fragment.
  const noJsContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
  const noJsPage = await noJsContext.newPage();
  await noJsPage.goto(`${origin}/saturn/?q=all+objects`, { waitUntil: 'domcontentloaded' });
  const fallbackPixels = await captureResults(noJsPage, `${output}/server-all-objects.png`);
  assert.equal(livePixels.width, fallbackPixels.width);
  assert.equal(livePixels.height, fallbackPixels.height);
  const diff = new PNG({ width: livePixels.width, height: livePixels.height });
  const changedPixels = pixelmatch(livePixels.data, fallbackPixels.data, diff.data,
    livePixels.width, livePixels.height, { threshold: 0, includeAA: true });
  await writeFile(`${output}/window-vs-server-diff.png`, PNG.sync.write(diff));
  assert.equal(changedPixels, 0, 'the bounded live rows are pixel-identical to the server-rendered rows');
  measurements.pixelmatch = { changedPixels, comparedPixels: livePixels.width * livePixels.height, threshold: 0 };
  cases.push('The windowed live sidebar and server-rendered fallback match at pixelmatch threshold 0');
  console.log(cases.at(-1));

  await noJsPage.goto(`${origin}/?q=saturn`, { waitUntil: 'domcontentloaded' });
  const saturnResult = noJsPage.locator('.planet-object-browser a.planet-object-link[data-object-id="saturn"]');
  assert.equal(await saturnResult.isVisible(), true, 'no-JS search for "saturn" from / shows the Saturn row');
  await noJsPage.screenshot({ path: `${output}/no-js-search-saturn.png` });
  await saturnResult.click();
  await noJsPage.waitForURL(url => url.pathname === '/saturn/');
  assert.equal(await noJsPage.locator('.planet-stage').getAttribute('data-object-id'), 'saturn', 'no-JS reaches the object page');
  await noJsPage.screenshot({ path: `${output}/no-js-reached-saturn.png` });
  cases.push('No-JS /?q=saturn shows Saturn and reaches its page on click, with no client script');
  console.log(cases.at(-1));
  await noJsContext.close();
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify({ origin, cases, measurements }, null, 2) + '\n');
  await browser.close();
}

async function census(page: import('playwright').Page) {
  const cdp = await page.context().newCDPSession(page);
  try {
    const [dom, heap] = await Promise.all([cdp.send('Memory.getDOMCounters'), cdp.send('Runtime.getHeapUsage')]);
    return page.evaluate(({ dom, heap }) => {
      const window = document.querySelector('[data-catalogue-window]');
      const first = window?.querySelector('.planet-object-item');
      return { elements: document.getElementsByTagName('*').length, domNodes: dom.nodes,
        eventListeners: dom.jsEventListeners, heapUsedBytes: heap.usedSize,
        sidebarElements: document.querySelector('.planet-object-browser')?.getElementsByTagName('*').length ?? 0,
        connectedRows: window?.querySelectorAll('.planet-object-item').length ?? 0,
        logicalRows: Number(first?.getAttribute('aria-setsize') ?? 0) };
    }, { dom, heap });
  } finally { await cdp.detach(); }
}

async function captureResults(page: import('playwright').Page, path: string) {
  const clip = await page.locator('#object-category-results').boundingBox();
  if (!clip) throw new Error('The object results panel has no rendered box.');
  const bytes = await page.screenshot({ path, clip });
  return PNG.sync.read(bytes);
}
