import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { chromium, type Page } from 'playwright';
import { conformanceBrowserLaunch } from './conformance-browser-launch.mts';

const [baselineOrigin, candidateOrigin, outputArgument] = process.argv.slice(2);
assert.match(baselineOrigin ?? '', /^https?:\/\//u, 'Baseline origin is required.');
assert.match(candidateOrigin ?? '', /^https?:\/\//u, 'Candidate origin is required.');
const output = resolve(outputArgument ?? 'output/playwright/universe-performance-ab');
await mkdir(output, { recursive: true });

const launch = await conformanceBrowserLaunch({ channel: 'chrome', evidenceDirectory: output });
const browser = await chromium.launch(launch.options);
try {
  const [baseline, candidate] = await Promise.all([
    measure(baselineOrigin!, 'baseline'),
    measure(candidateOrigin!, 'candidate'),
  ]);
  const pixels = {
    cold: compare(baseline.cold.png, candidate.cold.png),
    navigation: compare(baseline.navigation.png, candidate.navigation.png),
  };
  const report = { browser: browser.version(), chromeLaunch: launch.diagnostics, pixels,
    baseline: withoutPng(baseline), candidate: withoutPng(candidate) };
  await writeFile(resolve(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  assert.equal(pixels.cold, 0, 'Cold Earth pixels changed.');
  assert.equal(pixels.navigation, 0, 'Post-navigation Earth pixels changed.');
  assert.equal(candidate.cold.residency.catalogResident, 'false');
  assert.equal(candidate.cold.residency.imageLayerResidentBankCount, '0');
  assert.equal(candidate.cold.residency.imageLayerLoadingBankCount, '0');
  assert.ok(candidate.cold.elements < baseline.cold.elements, 'Cold publication must retain fewer elements.');
  assert.ok(candidate.cold.dom.nodes < baseline.cold.dom.nodes, 'Cold publication must retain fewer DOM nodes.');
  assert.ok(candidate.navigation.dom.nodes < baseline.navigation.dom.nodes, 'Navigation must retain fewer DOM nodes.');
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }

async function measure(origin: string, label: string) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
    reducedMotion: 'reduce', colorScheme: 'dark' });
  const problems: string[] = [];
  const preparePage = (page: Page) => {
    page.setDefaultTimeout(60_000);
    page.on('pageerror', error => problems.push(error.message));
    page.on('console', message => { if (message.type() === 'error') problems.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`); });
  };
  let page = await context.newPage();
  preparePage(page);
  try {
    await page.goto(`${origin}/earth/`, { waitUntil: 'domcontentloaded' });
    await ready(page, 'earth');
    const cold = { ...await snapshot(page), png: await screenshot(page, `${label}-cold.png`) };
    // Preserve the browser context's HTTP cache while terminating any background work owned by the cold page.
    // Reloading that still-busy page conflates warm bootstrap with its eager requests and can never quiesce.
    await page.close();
    page = await context.newPage();
    preparePage(page);
    await page.goto(`${origin}/earth/`, { waitUntil: 'domcontentloaded' });
    await ready(page, 'earth');
    const warm = await snapshot(page);
    for (const id of ['saturn', 'mercury', 'earth']) {
      await page.locator('.planet-sidebar-search').fill(id);
      await page.locator(`a.planet-object-link[data-object-id="${id}"]`).click();
      await ready(page, id);
    }
    const navigation = { ...await snapshot(page), png: await screenshot(page, `${label}-navigation.png`) };
    return { cold, warm, navigation, problems };
  } finally { await context.close(); }
}

async function ready(page: Page, id: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.waitForFunction(id => document.documentElement.dataset.ready === 'error' ||
      (document.documentElement.dataset.ready === 'true' && document.querySelector<HTMLElement>('.planet-stage')?.dataset.objectId === id), id);
    // Vite may optimize a dependency and reload immediately after the first ready marker.
    // Require the marker to survive a short quiet window before sampling the page.
    await page.waitForTimeout(250);
    const state = await page.evaluate(id => ({ ready: document.documentElement.dataset.ready,
      objectId: document.querySelector<HTMLElement>('.planet-stage')?.dataset.objectId }), id);
    assert.notEqual(state.ready, 'error', `${id}: renderer failed`);
    if (state.ready === 'true' && state.objectId === id) {
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      return;
    }
  }
  assert.fail(`${id}: renderer did not remain ready`);
}

async function snapshot(page: Page) {
  const session = await page.context().newCDPSession(page);
  await session.send('Performance.enable');
  const [{ metrics }, dom, heap, browser] = await Promise.all([
    session.send('Performance.getMetrics'), session.send('Memory.getDOMCounters'), session.send('Runtime.getHeapUsage'),
    page.evaluate(() => {
      const root = document.querySelector<HTMLElement>('.prepared-universe');
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const totals = resources.reduce((sum, entry) => ({ transferBytes: sum.transferBytes + entry.transferSize,
        encodedBytes: sum.encodedBytes + entry.encodedBodySize, decodedBytes: sum.decodedBytes + entry.decodedBodySize }),
      { transferBytes: 0, encodedBytes: 0, decodedBytes: 0 });
      return { elements: document.querySelectorAll('*').length, resources: resources.length, totals,
        residency: { catalogResident: root?.dataset.catalogResident,
          catalogLoading: root?.dataset.catalogLoading,
          imageLayerDeclaredBankCount: root?.dataset.imageLayerDeclaredBankCount,
          imageLayerResidentBankCount: root?.dataset.imageLayerResidentBankCount,
          imageLayerLoadingBankCount: root?.dataset.imageLayerLoadingBankCount },
      };
    }),
  ]);
  await session.detach();
  return { ...browser, dom, heap, metrics: Object.fromEntries(metrics.map(metric => [metric.name, metric.value])) };
}

async function screenshot(page: Page, name: string) {
  const png = await page.locator('.planet-stage').screenshot({
    animations: 'disabled',
    // The stage fills the viewport, so a clipped element screenshot would also
    // include sibling product chrome painted above it. Match embed mode and
    // compare only the rendered celestial scene.
    style: ':is(.planet-ui-layer, .space-minimap) { visibility: hidden !important; }',
  });
  await writeFile(resolve(output, name), png);
  return png;
}

function compare(leftBytes: Buffer, rightBytes: Buffer) {
  const left = PNG.sync.read(leftBytes), right = PNG.sync.read(rightBytes);
  assert.equal(left.width, right.width); assert.equal(left.height, right.height);
  return pixelmatch(left.data, right.data, null, left.width, left.height, { threshold: 0 });
}

function withoutPng<T extends { cold: { png: Buffer }; navigation: { png: Buffer } }>(run: T) {
  const { png: _cold, ...cold } = run.cold, { png: _navigation, ...navigation } = run.navigation;
  return { ...run, cold, navigation };
}
