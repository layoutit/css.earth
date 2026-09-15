import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createTestPage } from './browser-observations.mts';
import { OBJECTS, SCENE_OBJECTS } from '../objects.mts';
import type { PreparedFocusObject } from '../prepared-focus-object.mts';

const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const host = SCENE_OBJECTS.find(object => object.classification === 'star' && object.distance.meters === 0);
assert.ok(host);
const focuses = OBJECTS.filter((object): object is PreparedFocusObject => object.kind === 'prepared-focus');
const representatives = [...new Set([
  ...['galaxy', 'galaxy-cluster', 'nebula'].map(kind => focuses.find(object => object.classification === kind)),
  ...['m_031', 'lmc', 'smc'].map(id => focuses.find(object => object.id === id)),
].filter((object): object is PreparedFocusObject => object !== undefined))];
const browser = await chromium.launch({ headless: true });
await mkdir('output/navigation-ontology-browser', { recursive: true });
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const page = await createTestPage(browser, { viewport, reducedMotion: 'reduce' });
    const errors: string[] = [], documents: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url()); });
    const response = await page.goto(new URL(host.route, origin).href, { waitUntil: 'domcontentloaded' });
    assert.equal(response?.status(), 200, 'the unmodified application must boot before testing navigation');
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout: 30000 });
    const ids = await page.locator('.planet-object-results-scroll .planet-object-link').evaluateAll(links => links.map(link => link.getAttribute('data-object-id') ?? link.getAttribute('data-prepared-focus-id')));
    assert.deepEqual(new Set(ids), new Set(OBJECTS.map(object => object.id)), 'browser search must contain the full registry');
    const camera = await page.locator('.polycss-camera').elementHandle();
    assert.ok(camera);
    const search = page.locator('.planet-sidebar-search');
    for (const object of representatives) {
      await search.fill(object.id === 'm_031' ? 'M31' : object.name);
      const result = page.locator(`.planet-object-link[data-prepared-focus-id="${object.id}"]`);
      await result.waitFor({ state: 'visible' });
      await result.press('Enter');
      await page.waitForFunction(id => new URL(location.href).searchParams.get('focus') === id, object.id);
      assert.equal(new URL(page.url()).pathname, host.route);
      assert.equal(await camera.evaluate(node => node.isConnected), true, 'focus must retain the scene camera');
      assert.equal(await page.locator('.polycss-camera').count(), 1);
      const card = page.locator(`[data-prepared-focus-card][data-prepared-focus-id="${object.id}"]`);
      await card.waitFor({ state: 'visible' });
      await card.locator('[data-information-tab="factsheet"]').click();
      const source = page.locator('[data-source-link]');
      assert.equal(await source.isVisible(), true);
      assert.equal(await source.getAttribute('aria-label'), `Sources and methods for ${object.name}`);
      assert.match(await source.getAttribute('href') ?? '', /\/blob\/[a-f0-9]{40}\/src\/objects\/[^/]+\/README\.md$/u);
      assert.equal(await page.locator('[data-source-bank]').count(), 0, 'sources need no hidden citation bank');
    }
    assert.equal(documents.length, 1, 'focus selection must not reload the scene document');
    await search.fill('galaxies');
    assert.equal(await page.locator('.planet-object-item[data-object-classification="galaxy"]:not([hidden])').count(), focuses.filter(object => object.classification === 'galaxy').length);
    await page.screenshot({ path: `output/navigation-ontology-browser/search-${viewport.width}.png` });
    const saved = new URL(representatives.find(object => object.id === 'm_031')!.route, origin).href;
    assert.equal((await page.goto(saved, { waitUntil: 'domcontentloaded' }))?.status(), 200);
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout: 30000 });
    assert.equal(new URL(page.url()).searchParams.get('focus'), 'm_031');
    await page.locator('[data-prepared-focus-card][data-prepared-focus-id="m_031"]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.polycss-camera').count(), 1);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log(`NAVIGATION_ONTOLOGY_PASS: ${OBJECTS.length} searchable identities; ${representatives.length} focus cases on desktop and mobile; one retained scene and restored links.`);
} finally { await browser.close(); }
