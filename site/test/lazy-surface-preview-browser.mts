import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const deviceScaleFactor of [1, 2]) {
    const page = await browser.newPage({ deviceScaleFactor });
    const requested = [];
    await page.route('**/__preview-*.png', route => {
      requested.push(new URL(route.request().url()).pathname);
      return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') });
    });
    await page.route('**/__preview-fixture', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
    await page.goto(`${origin}/__preview-fixture`);
    await page.evaluate(async () => {
      const { createSurfaceMinimap } = await import('/site/surface-minimap.mts');
      document.body.innerHTML = `<details><summary>Surface Lens</summary>${['a','b'].map(id =>
        `<div data-lens-details ${id === 'b' ? 'hidden' : ''}><div class="planet-surface-minimap">
          <img data-surface-preview-src="/__preview-${id}.png" width="200" height="100" alt="Prepared surface">
          <span class="planet-minimap-viewport"></span></div></div>`).join('')}</details>`;
      window.minimap = createSurfaceMinimap({ drawer: document.body, documentTarget: document, windowTarget: window });
    });
    await page.waitForTimeout(100);
    assert.deepEqual(requested, [], 'Closed accordion must not request either preview');
    assert.equal(await page.locator('img[src]').count(), 0);
    await page.locator('summary').click();
    await page.waitForFunction(() => document.querySelector('img[src]')?.complete);
    assert.deepEqual(requested, ['/__preview-a.png']);
    await page.locator('summary').click(); await page.locator('summary').click();
    await page.waitForTimeout(100);
    assert.deepEqual(requested, ['/__preview-a.png'], 'Reopening reuses the same image');
    await page.evaluate(() => { for (const panel of document.querySelectorAll('[data-lens-details]')) panel.hidden = !panel.hidden; });
    await page.waitForFunction(() => document.querySelectorAll('img[src]').length === 2);
    assert.deepEqual(requested, ['/__preview-a.png', '/__preview-b.png']);
    await page.evaluate(() => window.minimap.destroy());
    await page.close();
  }
} finally { await browser.close(); }
console.log('LAZY SURFACE PREVIEW PASS: request ownership and reuse at DPR 1/2');
