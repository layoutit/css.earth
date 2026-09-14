import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { inspectContextAvailability } from '../../tools/prepare-context-availability.mts';

// Run against an isolated development checkout with Helix absent and LMC installed.
// This test never removes or prepares the developer's assets.
const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const availability = await inspectContextAvailability();
assert.equal(availability.helix?.available, false, 'Fixture requires an unavailable Helix package.');
assert.equal(availability.lmc?.available, true, 'Fixture requires the actual installed LMC package.');
const output = resolve('output/playwright/context-availability'); await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE
  ? { executablePath: process.env.CHROME_EXECUTABLE } : { channel: 'chrome' }) });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
page.setDefaultTimeout(30_000);
const errors: string[] = [], failed: string[] = [];
let documents = 0;
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`); });
page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });
const ready = () => page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
const card = page.locator('[data-prepared-focus-card]');
try {
  assert.equal((await page.goto(`${origin}/sun/`))?.status(), 200);
  await ready();
  assert.equal(await page.locator('[data-volume-lens-object="helix"]').count(), 0);
  assert.equal(await page.locator('[data-focus-lens-bank="helix"]').count(), 0);
  await page.screenshot({ path: resolve(output, 'sun.png') });

  const stage = await page.locator('.planet-stage').elementHandle(); assert.ok(stage);
  const before = documents;
  await page.getByRole('searchbox', { name: 'Search celestial objects...' }).fill('Helix');
  await page.locator('[data-prepared-focus-id="helix"]').click();
  await card.locator('[data-focus-unavailable]').waitFor({ state: 'visible' });
  assert.match(await card.locator('[data-focus-unavailable]').innerText(), /Helix Nebula.*unavailable/);
  assert.equal(await card.locator('[data-focus-distance]').innerText(), '216 pc');
  assert.equal(await card.getByRole('tab', { name: 'Datasets', exact: true }).isVisible(), false);
  assert.equal(documents, before, 'Unavailable selection preserves the document.');
  assert.equal(await stage.evaluate(node => node.isConnected), true);
  await page.screenshot({ path: resolve(output, 'helix-unavailable.png') });

  await page.goto(`${origin}/sun/?focus=helix&focusLens=eso-vista`); await ready();
  await card.locator('[data-focus-unavailable]').waitFor({ state: 'visible' });
  assert.equal(new URL(page.url()).searchParams.get('focus'), 'helix');
  await page.setViewportSize({ width: 390, height: 844 });
  const handle = page.getByRole('button', { name: 'Resize information sheet' });
  await handle.click();
  await page.waitForFunction(() => document.body.dataset.sheet !== 'peek');
  await card.locator('[data-focus-unavailable]').scrollIntoViewIfNeeded();
  const notice = await card.locator('[data-focus-unavailable]').boundingBox(); assert.ok(notice);
  assert.ok(notice.y >= 0 && notice.y + notice.height <= 844, 'The complete unavailable message fits in the opened sheet.');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: resolve(output, 'helix-mobile.png') });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/sun/?focus=lmc`); await ready();
  const bank = page.locator('[data-focus-lens-bank="lmc"]'); await bank.waitFor({ state: 'visible' });
  assert.equal(await card.locator('[data-focus-unavailable]').isVisible(), false);
  const volume = await page.locator('[data-volume-lens-object="lmc"]').elementHandle(); assert.ok(volume);
  const selections = await bank.locator('[data-focus-lens]').evaluateAll(nodes => nodes.map(node => {
    if (!(node instanceof HTMLButtonElement)) throw new TypeError('Expected lens button'); return node.value;
  }));
  const lensDocuments = documents;
  for (const id of selections) {
    await bank.locator(`[data-focus-lens][value="${id}"]`).click();
    await page.waitForFunction(id => document.querySelector('[data-volume-lens-object="lmc"]')?.getAttribute('data-selected-lens') === id, id);
    assert.equal(await volume.evaluate(node => node.isConnected), true, 'Lens selection retains the installed volume.');
  }
  assert.equal(documents, lensDocuments);
  await page.screenshot({ path: resolve(output, 'lmc-available.png') });
  assert.deepEqual(errors, []); assert.deepEqual(failed, []);
  console.log('PASS: Sun startup, retained search, unavailable direct lens link, mobile notice and all installed LMC lenses.');
} finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ origin, availability, documents, errors, failed }, null, 2) + '\n');
  await browser.close();
}
