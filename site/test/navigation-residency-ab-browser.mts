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
const output = resolve(outputArgument ?? 'output/playwright/navigation-residency-ab');
await mkdir(output, { recursive: true });

const launch = await conformanceBrowserLaunch({ channel: 'chrome', evidenceDirectory: output });
const browser = await chromium.launch(launch.options);
try {
  // Cold Vite compilation is CPU-heavy enough that two concurrent dev servers
  // can starve one page before DOMContentLoaded. Run the matched journeys in
  // sequence; each browser context remains isolated and starts cold.
  const baseline = await measure(baselineOrigin!, 'baseline');
  const candidate = await measure(candidateOrigin!, 'candidate');
  const pixels = {
    scene: await compare(baseline.scene, candidate.scene, 'scene-diff.png'),
    shell: await compare(baseline.shell, candidate.shell, 'shell-diff.png'),
  };
  const report = { browser: browser.version(), chromeLaunch: launch.diagnostics, pixels,
    baseline: withoutPng(baseline), candidate: withoutPng(candidate) };
  await writeFile(resolve(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);

  assert.equal(pixels.scene, 0, 'Rendered scene pixels changed.');
  assert.equal(pixels.shell, 0, 'Product shell pixels changed.');
  for (const [label, sample] of [['cycle 1', candidate.cycle1], ['cycle 2', candidate.cycle2]] as const) {
    assert.equal(sample.fragments?.activeDocuments, 0, `${label} retained a parsed navigation document.`);
    assert.equal(sample.fragments?.inFlightEntries, 0, `${label} still had an encoded navigation request in flight.`);
    assert.ok((sample.fragments?.encodedEntries ?? Infinity) <= 4, `${label} exceeded encoded fragment capacity.`);
  }
  assert.ok(candidate.cycle2.dom.documents < baseline.cycle2.dom.documents,
    'Candidate retained no fewer documents than baseline.');
  assert.ok(candidate.cycle2.dom.nodes < baseline.cycle2.dom.nodes,
    'Candidate retained no fewer DOM nodes than baseline.');
  assert.ok(delta(candidate, 'documents') <= delta(baseline, 'documents'),
    'Document growth during the second cycle exceeded baseline.');
  assert.ok(delta(candidate, 'nodes') <= delta(baseline, 'nodes'),
    'DOM-node growth during the second cycle exceeded baseline.');
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }

async function measure(origin: string, label: string) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
    reducedMotion: 'reduce', colorScheme: 'dark' });
  const problems: string[] = [];
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  page.on('pageerror', error => problems.push(error.message));
  page.on('console', message => { if (message.type() === 'error') problems.push(message.text()); });
  page.on('response', response => { if (response.status() >= 500) problems.push(`${response.status()} ${response.url()}`); });
  try {
    await page.goto(`${origin}/earth/`, { waitUntil: 'domcontentloaded' });
    await ready(page, 'earth');
    await navigateCycle(page);
    const cycle1 = await snapshot(page);
    await navigateCycle(page);
    const cycle2 = await snapshot(page);
    const scene = await screenshot(page, `${label}-scene.png`, true);
    const shell = await screenshot(page, `${label}-shell.png`, false);
    return { cycle1, cycle2, problems, scene, shell };
  } finally { await context.close(); }
}

async function navigateCycle(page: Page) {
  for (const id of ['saturn', 'mercury', 'earth']) {
    await page.locator('.planet-sidebar-search').fill(id);
    await page.locator(`a.planet-object-link[data-object-id="${id}"]`).click();
    await ready(page, id);
  }
}

async function ready(page: Page, id: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.waitForFunction(id => document.documentElement.dataset.ready === 'error' ||
      (document.documentElement.dataset.ready === 'true' && document.querySelector<HTMLElement>('.planet-stage')?.dataset.objectId === id), id);
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
  await session.send('HeapProfiler.collectGarbage');
  await page.waitForTimeout(100);
  const [dom, heap, browserState] = await Promise.all([
    session.send('Memory.getDOMCounters'),
    session.send('Runtime.getHeapUsage'),
    page.evaluate(() => {
      const fragments: unknown = Reflect.get(window, Symbol.for('cssearth.navigation-fragments'));
      const inspect = typeof fragments === 'object' && fragments !== null ? Reflect.get(fragments, 'inspect') : null;
      return { elements: document.querySelectorAll('*').length,
        fragments: typeof inspect === 'function' ? Reflect.apply(inspect, fragments, []) : null };
    }),
  ]);
  await session.detach();
  return { ...browserState, dom, heap };
}

async function screenshot(page: Page, name: string, sceneOnly: boolean) {
  const png = sceneOnly
    ? await page.locator('.planet-stage').screenshot({ animations: 'disabled',
      style: ':is(.planet-ui-layer, .space-minimap) { visibility: hidden !important; }' })
    : await page.screenshot({ animations: 'disabled' });
  await writeFile(resolve(output, name), png);
  return png;
}

async function compare(leftBytes: Buffer, rightBytes: Buffer, diffName: string) {
  const left = PNG.sync.read(leftBytes), right = PNG.sync.read(rightBytes);
  assert.equal(left.width, right.width); assert.equal(left.height, right.height);
  const diff = new PNG({ width: left.width, height: left.height });
  const pixels = pixelmatch(left.data, right.data, diff.data, left.width, left.height,
    { threshold: 0, includeAA: true });
  await writeFile(resolve(output, diffName), PNG.sync.write(diff));
  return pixels;
}

function withoutPng<T extends { scene: Buffer; shell: Buffer }>(run: T) {
  const { scene: _scene, shell: _shell, ...report } = run;
  return report;
}

function delta(run: { cycle1: { dom: { documents: number; nodes: number } };
  cycle2: { dom: { documents: number; nodes: number } } }, key: 'documents' | 'nodes') {
  return run.cycle2.dom[key] - run.cycle1.dom[key];
}
