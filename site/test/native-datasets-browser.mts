import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, type Page } from 'playwright';
import { conformanceBrowserLaunch } from './conformance-browser-launch.mts';

declare global { interface Window { __datasetNodes: Element[]; __datasetChanges: string[]; } }
const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const output = resolve('output/playwright/native-datasets');
await mkdir(output, { recursive: true });
const browser = await chromium.launch((await conformanceBrowserLaunch({ evidenceDirectory: output })).options);
const cases: string[] = [];
const selected = (page: Page, id: string) => page.locator(`.planet-information-panel button[name="dataset"][value="${id}"]`);
async function settleSheet(page: Page) {
  // Script-disabled pages cannot schedule the timers used by browser-side polling.
  for (let i = 0; i < 40; i++) {
    if (await page.locator('.planet-sidebar').evaluate(node => getComputedStyle(node).transform) === 'none') return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
const style = (page: Page) => selected(page, 'ultraviolet').evaluate(node => {
  const css = getComputedStyle(node);
  return ['font', 'color', 'background', 'padding', 'height', 'border'].map(name => css.getPropertyValue(name));
});
try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport });
    const page = await context.newPage();
    const scripts: string[] = [];
    page.on('request', request => { if (request.resourceType() === 'script') scripts.push(request.url()); });
    await page.goto(`${origin}/saturn/`, { waitUntil: 'domcontentloaded' });
    if (viewport.width < 821) {
      await page.locator('.planet-sheet-handle').check(); await settleSheet(page);
      assert.equal(await page.locator('.explorer-brand-row').isVisible(), true, 'The wordmark heads the controls and stays with the header behind the sheet');
    }
    const initial = await page.locator('.planet-stage').innerHTML();
    for (const id of ['ultraviolet', 'cross-section', 'normal']) {
      await selected(page, id).click();
      await page.waitForURL(url => url.searchParams.get('dataset') === id);
      if (viewport.width < 821) await settleSheet(page);
      assert.equal(await selected(page, id).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator(`[data-lens-details="${id}"]`).isVisible(), true);
      assert.equal(await page.locator('.planet-stage').getAttribute('data-prepared-dataset'), id);
      assert.equal(await page.locator('.polycss-scene').count(), 1);
      assert.equal(await page.locator('.planet-stage [data-prepared-node]').count(), 972);
      const html = await page.locator('.planet-stage').innerHTML();
      if (id === 'normal') assert.equal(html, initial);
      else assert.notEqual(html, initial);
      if (id === 'cross-section') assert.equal(await page.locator('.planet-stage').getAttribute('data-view'), 'interior');
      if (id === 'ultraviolet') await page.screenshot({ path: `${output}/native-${viewport.width}.png` });
    }
    await page.goBack({ waitUntil: 'domcontentloaded' });
    assert.equal(await selected(page, 'cross-section').getAttribute('aria-pressed'), 'true');
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.equal(await page.locator('.planet-stage').getAttribute('data-view'), 'interior');
    await page.getByRole('searchbox').fill('Titan');
    await page.getByRole('searchbox').press('Enter');
    await page.waitForURL(url => url.searchParams.get('q') === 'Titan');
    assert.equal(new URL(page.url()).searchParams.get('dataset'), 'cross-section');
    assert.equal(await page.locator('.planet-stage').getAttribute('data-view'), 'interior');
    assert.equal(await page.locator('.planet-object-browser a[data-object-id="titan"]').isVisible(), true);
    await page.getByRole('link', { name: 'Clear search', exact: true }).click();
    await page.waitForURL(url => !url.searchParams.has('q') && url.searchParams.get('dataset') === 'cross-section');
    assert.equal(await page.locator('.planet-stage').getAttribute('data-view'), 'interior');
    assert.deepEqual(scripts, []);
    cases.push(`No JS at ${viewport.width}px: textures, cross-section, default, history, reload and search retain one selected scene`);
    console.log(cases.at(-1));
    await context.close();
  }
  // Vite can reload its first scripted page after optimizing dependencies.
  // Let that development-only reload finish in a separate disposable document;
  // the following contexts must retain every node through the actual handoff.
  const warm = await browser.newContext();
  const warmPage = await warm.newPage();
  await warmPage.goto(`${origin}/saturn/?dataset=ultraviolet`);
  await warmPage.waitForFunction(() => document.documentElement.dataset.ready === 'true', undefined, { timeout: 90_000 });
  await warm.close();
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/*', async route => {
      if (route.request().resourceType() === 'script') await gate;
      await route.continue();
    });
    await page.goto(`${origin}/saturn/?dataset=ultraviolet`, { waitUntil: 'commit' });
    await selected(page, 'ultraviolet').waitFor({ state: 'visible' });
    await page.locator('[data-prepared-node="971"]').waitFor({ state: 'attached' });
    const nativeStyle = await style(page);
    await page.evaluate(() => {
      window.__datasetNodes = [...document.querySelectorAll('.planet-stage [data-prepared-node], .planet-information-panel button[name="dataset"]')];
      window.__datasetChanges = [];
      const stage = document.querySelector('.planet-stage')!;
      new MutationObserver(records => {
        for (const record of records) if (record.type === 'attributes' && record.attributeName === 'data-lens') {
          window.__datasetChanges.push(record.oldValue ?? 'default');
        }
      }).observe(stage, { attributes: true, attributeOldValue: true });
    });
    release();
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', undefined, { timeout: 90_000 });
    assert.equal(await page.locator('.planet-stage').getAttribute('data-lens'), 'ultraviolet');
    assert.equal(await selected(page, 'ultraviolet').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(await style(page), nativeStyle);
    assert.equal(await page.evaluate(() => window.__datasetNodes.every(node => node.isConnected)), true);
    assert.equal(await page.evaluate(() => window.__datasetChanges.every(value => value === 'ultraviolet')), true, 'No default dataset flash during adoption');
    let navigations = 0;
    page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations++; });
    await selected(page, 'thermal').click();
    await page.waitForFunction(() => document.querySelector('.planet-stage')?.getAttribute('data-lens') === 'thermal');
    assert.equal(new URL(page.url()).searchParams.get('dataset'), 'thermal');
    assert.equal(navigations, 0);
    assert.equal(await page.evaluate(() => window.__datasetNodes.every(node => node.isConnected)), true);
    assert.equal(await page.locator('.polycss-scene').count(), 1);
    await page.screenshot({ path: `${output}/enhanced-${viewport.width}.png` });
    cases.push(`Delayed JS at ${viewport.width}px adopts the selected dataset, all scene/control nodes and identical button styles, then switches in place`);
    console.log(cases.at(-1));
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.route('**/objects/saturn/*.json', route => route.abort());
  await page.goto(`${origin}/saturn/?dataset=ultraviolet`);
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'error', undefined, { timeout: 60_000 });
  assert.equal(await selected(page, 'thermal').isEnabled(), true);
  await selected(page, 'thermal').click();
  await page.waitForURL(url => url.searchParams.get('dataset') === 'thermal');
  assert.equal(await page.locator('.planet-stage').getAttribute('data-lens'), 'thermal');
  assert.equal(await page.locator('.polycss-scene').count(), 1);
  cases.push('Failed JS transport leaves dataset submits usable and renders the next choice through the same server path');
  console.log(cases.at(-1));
  await context.close();
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify({ origin, cases }, null, 2) + '\n');
  await browser.close();
}
