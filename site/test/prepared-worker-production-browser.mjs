import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { previewSite } from '../../tools/preview.mjs';

const server = await previewSite({ port: 0 });
let browser;
const errors = [];
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const origin = server.resolvedUrls.local[0];
  for (const dpr of [1, 2]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: dpr });
    const workers = [];
    page.on('worker', worker => workers.push(worker));
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${origin}sun/`);
    await ready(page, 'sun');
    await page.evaluate(() => { window.__workerTestDocument = document; });
    for (const [id, name] of [['mars', 'Mars'], ['mercury', 'Mercury'], ['ceres', 'Ceres'], ['venus', 'Venus']]) {
      await page.locator('.planet-sidebar-search').fill(name);
      await page.locator(`.planet-object-link[data-object-id="${id}"]`).click();
      await ready(page, id);
      assert.equal(await page.evaluate(() => window.__workerTestDocument === document), true);
      assert.equal(await page.locator('.polycss-camera').count(), 1);
    }
    const decoders = workers.filter(worker => /\/_astro\/prepared-object-worker-.*\.js$/.test(worker.url()));
    const selectors = workers.filter(worker => /\/_astro\/point-field-selection-worker-.*\.js$/.test(worker.url()));
    assert.equal(decoders.length, 5, 'Each cold package is decoded by the emitted production worker');
    assert.equal(selectors.length, 1, 'One star selection worker survives object navigation');
    assert.deepEqual(page.workers(), selectors, 'Completed decode jobs retire; only the shared selector remains');
    console.log(`PRODUCTION WORKER PASS DPR ${dpr}: five packages, retained document, one scene, decode jobs retired, one retained selector`);
    await page.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  await server.close();
}

async function ready(page, id) {
  await page.waitForFunction(id => document.documentElement.dataset.ready === 'true' &&
    document.querySelector('.planet-stage')?.dataset.objectId === id, id, { timeout: 30000 });
}
