import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { sourceArray, sourceObject, sourceText } from '../../src/platform/source-catalog.mts';
import { validateObjectProvenance } from '../../src/platform/object-provenance.mts';

const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const output = resolve('output/playwright/nebula-datasets');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE
  ? { executablePath: process.env.CHROME_EXECUTABLE } : { channel: 'chrome' }) });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(30_000);
const errors: string[] = [], failed: string[] = [], cases: { objectId: string; lensId: string; sourceIds: string[] }[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`); });
let documents = 0;
page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });
const read = async (id: string, name: string): Promise<unknown> => JSON.parse(await readFile(resolve(`src/objects/${id}/prepared/${name}.json`), 'utf8'));
const rail = page.locator('[data-focus-lens-bank]:not([hidden]) > .planet-dataset-context-rail');
const selectedContext = (id: string, lens: string) => rail.and(page.locator(`[data-dataset-context-owner="${id}"]`)).locator(`[data-dataset-context="${lens}"]:not([hidden])`);
const waitReady = () => page.waitForFunction(() => document.documentElement.dataset.ready === 'true');

try {
  for (const objectId of ['helix', 'm42', 'm2-9', 'lmc']) {
    console.error(`[nebula-datasets] ${objectId}`);
    const presentation = sourceObject(await read(objectId, 'presentation'));
    const lenses = sourceArray(presentation.controls, item => sourceText(sourceObject(item).id));
    const provenance = validateObjectProvenance(await read(objectId, 'provenance'), objectId);
    assert.equal((await page.goto(`${origin}/sun/?focus=${objectId}`))?.status(), 200);
    await waitReady();
    // Initial focus navigation publishes its canonical camera URL after scene readiness.
    // Start lens assertions only after that handoff, not during its first history write.
    await page.waitForFunction(() => new URL(location.href).searchParams.has('v'));
    const card = page.locator('[data-prepared-focus-card]');
    const bank = card.locator(`[data-focus-lens-bank="${objectId}"]`);
    await bank.waitFor({ state: 'visible' });
    const stage = await page.locator('.planet-stage').elementHandle();
    const count = documents;
    assert.equal(await bank.locator('[data-focus-lens]').count(), lenses.length);
    for (const lensId of lenses) {
      const camera = await page.locator('.planet-stage .polycss-camera > .polycss-scene').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).transform));
      const button = bank.locator(`[data-focus-lens][value="${lensId}"]`);
      await button.click();
      await page.waitForFunction(({ objectId, lensId }) => document.querySelector(`[data-focus-lens-bank="${objectId}"] [data-focus-lens][value="${lensId}"]`)?.getAttribute('aria-pressed') === 'true', { objectId, lensId });
      const context = selectedContext(objectId, lensId);
      await context.waitFor({ state: 'visible' });
      const preview = bank.locator(`[data-focus-lens-details="${lensId}"] .planet-lens-texture`);
      await preview.waitFor({ state: 'visible' });
      await preview.evaluate(image => { if (!(image instanceof HTMLImageElement)) throw new TypeError('Not an image'); return image.decode(); });
      const ownSources = provenance.sources.filter(source => source.lensId === lensId);
      const sourceIds = ownSources.flatMap(source => source.sourceBinding?.kind === 'catalogued'
        ? source.sourceBinding.references.filter(ref => ref.role === 'material').map(ref => ref.catalogueId) : []);
      assert.ok(sourceIds.length > 0, 'Every lens identifies its own original image');
      for (const id of sourceIds) assert.equal(await context.locator(`[data-source="${id}"]`).first().isVisible(), true, `${objectId}/${lensId}: ${id}`);
      assert.ok(await context.locator('[data-facility], [data-mission], [data-unresolved]').count() > 0, 'Capture attribution remains explicit');
      assert.equal(documents, count, 'Switching datasets keeps the document');
      assert.equal(await stage?.evaluate(node => node.isConnected), true, 'Switching datasets retains the stage');
      assert.deepEqual(await page.locator('.planet-stage .polycss-camera > .polycss-scene').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).transform)), camera,
        'Changing the observation keeps the shared camera');
      assert.equal(new URL(page.url()).searchParams.get('focusLens'), lensId);
      cases.push({ objectId, lensId, sourceIds });
    }
    const camera = new URL(page.url()).searchParams.get('v');
    await bank.locator('[data-focus-lens][aria-pressed="true"]').click();
    assert.equal(new URL(page.url()).searchParams.get('v'), camera, 'Reselecting a dataset preserves the camera');
    assert.equal(await bank.locator('[data-focus-stars]').count(), 0, 'Dataset cards do not duplicate the shell-level 3D-stars setting.');
    await card.getByRole('radio', { name: 'Factsheet', exact: true }).press('Space');
    await rail.waitFor({ state: 'hidden' });
    await card.getByRole('radio', { name: 'Datasets', exact: true }).press('Space');
    await rail.waitFor({ state: 'visible' });
    await page.screenshot({ path: resolve(output, `${objectId}.png`) });
    await page.screenshot({ path: resolve(output, `${objectId}.jpg`), type: 'jpeg', quality: 82 });
  }
  assert.equal(cases.length, 9);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-focus-lens-bank]:not([hidden]) > .planet-dataset-context-rail')!).position === 'static');
  await rail.scrollIntoViewIfNeeded();
  assert.equal(await rail.isVisible(), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: resolve(output, 'mobile.png') });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/mercury/#dataset=enhanced`);
  await waitReady();
  await selectedContext('mercury', 'enhanced').waitFor({ state: 'visible' });
  assert.equal(await selectedContext('mercury', 'enhanced').locator('[data-mission="messenger"]').isVisible(), true);
  await page.locator('button[name="dataset"][value="topography"]').click();
  await selectedContext('mercury', 'topography').waitFor({ state: 'visible' });
  assert.equal(await selectedContext('mercury', 'topography').locator('[data-mission="messenger"]').isVisible(), true);
  assert.equal(new URL(page.url()).hash, '#dataset=topography');
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  console.log(`Verified ${cases.length} volume datasets, retained navigation, shared tabs, responsive provenance and Mercury datasets.`);
} finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ origin, cases, errors, failed }, null, 2) + '\n');
  await browser.close();
}
