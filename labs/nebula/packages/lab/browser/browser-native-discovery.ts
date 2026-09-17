/** Requires completed native SMC caches; never starts a native operation. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const processing: string[] = [];
  page.on('pageerror', error => console.error(error.message));
  page.on('request', request => {
    if (request.method() === 'POST' && /star-removal-jobs/.test(request.url())) processing.push(request.url());
  });
  await page.goto(`${process.argv[2] ?? 'http://127.0.0.1:4331'}/alignment?subject=smc-particles`);
  for (const imageId of ['smc-vista', 'smc-smash', 'smc-dss2', 'smc-allwise-wide']) {
    await page.locator('#overlay-choice').selectOption(imageId);
    console.log(`DISCOVERY_CHECK ${imageId}`);
    await page.waitForFunction(id => Boolean(localStorage.getItem(`cssearth-applied-star-image-nox-v1:${id}`)), imageId, { timeout: 90_000 });
    const diffuse = page.locator('button[data-image-layer="diffuse"]');
    await diffuse.waitFor({ state: 'visible', timeout: 90_000 });
    await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('button[data-image-layer="diffuse"]')?.disabled, undefined, { timeout: 90_000 });
    await diffuse.click();
    await page.waitForFunction(() => document.querySelector('button[data-image-layer="diffuse"]')?.getAttribute('aria-pressed') === 'true');
    const saved = await page.evaluate(id => JSON.parse(localStorage.getItem(`cssearth-applied-star-image-nox-v1:${id}`) ?? 'null'), imageId);
    assert.equal(saved.imageId, imageId); assert.equal(saved.layer, 'diffuse');
    await page.reload();
    await page.waitForFunction(() => document.querySelector('button[data-image-layer="diffuse"]')?.getAttribute('aria-pressed') === 'true', undefined, { timeout: 90_000 });
    const restored = await page.evaluate(id => JSON.parse(localStorage.getItem(`cssearth-applied-star-image-nox-v1:${id}`) ?? 'null'), imageId);
    assert.equal(restored.resultId, saved.resultId);
  }
  assert.deepEqual(processing, []);
  console.log('NATIVE_DISCOVERY_OK: four native SMC images restore layers and saved choices without processing');
} finally { await browser.close(); }
