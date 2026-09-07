import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4210';
const output = resolve('output/playwright/sky-contrast');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const dpr of [1, 2]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const id of ['mercury', 'venus', 'ceres', 'europa']) {
      await page.goto(new URL(`/${id}/`, baseUrl).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__cssEarth?.ready && document.querySelector('.prepared-point-field-stars'));
      // Wait for the existing label admission fade before comparing emphasis.
      await page.waitForTimeout(1000);
      assert.equal(await page.locator('.planet-sky-contrast-setting').isChecked(), false);
      const before = await read(page);
      assert.equal(before.mode, 'standard');
      assert.equal(before.emphasis, .35);
      assert.ok(before.stars.length > 0, 'The visible shared star field must be checked');
      await page.evaluate(() => { window.__contrastNodes = [...document.querySelector('.planet-stage').querySelectorAll('*')]; });
      if (id === 'mercury') await page.screenshot({ path: resolve(output, `standard-dpr${dpr}.png`) });
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await page.locator('.planet-sky-contrast-setting-control').click();
      const high = await read(page);
      assert.equal(high.mode, 'high');
      assert.equal(high.emphasis, 1);
      assert.deepEqual(high.stars, before.stars, 'Prepared point photometry and transforms are preserved');
      assert.equal(high.glow, 1);
      assert.ok(high.glow > before.glow, 'High contrast increases background brightness, not the reverse');
      assert.deepEqual(high.labels, before.labels, 'Labels retain their own emphasis');
      assert.deepEqual(high.bodies, before.bodies, 'Clickable body points and captions retain their presentation');
      assert.equal(high.scene, before.scene, 'Contrast must not move the camera');
      if (id === 'mercury') await page.screenshot({ path: resolve(output, `high-dpr${dpr}.png`) });
      await page.locator('.planet-sky-contrast-setting-control').click();
      const reset = await read(page);
      assert.deepEqual(reset, before);
      assert.equal(await page.evaluate(() => [...document.querySelector('.planet-stage').querySelectorAll('*')]
        .every((node, index) => node === window.__contrastNodes[index])), true);
      results.push({ id, dpr, stars: before.stars.length, standardEmphasis: before.emphasis, highEmphasis: high.emphasis, stable: true });
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ ok: true, results }, null, 2));
  console.log(JSON.stringify({ ok: true, results }));
} finally { await browser.close(); }

function read(page) {
  return page.evaluate(() => {
    const layer = document.querySelector('.prepared-point-field-stars');
    return {
      mode: document.body.dataset.skyContrast,
      scene: document.querySelector('.polycss-scene')?.getAttribute('style'),
      emphasis: Number(getComputedStyle(layer).opacity),
      glow: Number(getComputedStyle(document.querySelector('.prepared-volume-context')).opacity),
      stars: window.__cssEarthUniverse.inspect().stars.points.filter(({ element }) => getComputedStyle(element).visibility === 'visible')
        .map(({ element, reference }) => ({ style: element.getAttribute('style'), reference })),
      labels: [...document.querySelectorAll('.prepared-star-label')].map(element => element.getAttribute('style')),
      bodies: [...document.querySelectorAll('[data-context-label], [data-object-navigate]')]
        .map(element => element.getAttribute('style')),
    };
  });
}
