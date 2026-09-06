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
      await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
      assert.equal(await page.locator('.planet-sky-contrast-setting').isChecked(), false);
      const before = await read(page);
      assert.equal(before.mode, 'standard');
      assert.equal(before.stars.length, 1599);
      assert.ok(before.stars.every(star => near(star.opacity, star.luminance * .35) && star.shadow === 'none'));
      await page.evaluate(() => { window.__contrastNodes = [...document.querySelector('.planet-stage').querySelectorAll('*')]; });
      if (id === 'mercury') await page.screenshot({ path: resolve(output, `standard-dpr${dpr}.png`) });
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await page.locator('.planet-sky-contrast-setting-control').click();
      const high = await read(page);
      assert.equal(high.mode, 'high');
      assert.ok(high.stars.every(star => near(star.opacity, star.luminance) && star.shadow !== 'none'));
      assert.ok(high.faces.every((url, index) => url !== before.faces[index]));
      assert.deepEqual(high.bodies, before.bodies, 'Clickable body points and captions keep their presentation');
      assert.equal(high.scene, before.scene, 'Contrast must not move the camera');
      if (id === 'mercury') await page.screenshot({ path: resolve(output, `high-dpr${dpr}.png`) });
      await page.locator('.planet-sky-contrast-setting-control').click();
      const reset = await read(page);
      assert.deepEqual(reset.stars, before.stars);
      assert.deepEqual(reset.faces, before.faces);
      assert.equal(await page.evaluate(() => [...document.querySelector('.planet-stage').querySelectorAll('*')]
        .every((node, index) => node === window.__contrastNodes[index])), true);

      // Test-only navigation binding exercises the clickable exception without
      // inventing a production galaxy destination or mounting another object.
      const target = await page.evaluate(async () => {
        const { bindObjectNavigationTarget } = await import('/src/renderers/css/dist/navigation.js');
        const star = document.querySelector('.planet-cubic-sky-star');
        const target = bindObjectNavigationTarget(star, document.querySelector('.planet-stage'));
        target.update('venus', 'Venus');
        const bright = { opacity: Number(getComputedStyle(star).opacity), shadow: getComputedStyle(star).boxShadow,
          luminance: Number(star.style.getPropertyValue('--planet-cubic-sky-star-luminance')), tabIndex: star.tabIndex };
        target.destroy();
        return { ...bright, restored: Number(getComputedStyle(star).opacity) };
      });
      assert.ok(near(target.opacity, target.luminance) && target.shadow !== 'none' && target.tabIndex === 0);
      assert.ok(near(target.restored, target.luminance * .35), 'Losing the click action restores background emphasis');
      results.push({ id, dpr, defaultHighContrast: false, stars: before.stars.length, standardOpacity: before.stars[0].opacity,
        highOpacity: high.stars[0].opacity, clickableOpacity: target.opacity, stable: true });
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ ok: true, results }, null, 2));
  console.log(JSON.stringify({ ok: true, results }));
} finally { await browser.close(); }

function near(a, b) { return Math.abs(a - b) < .00001; }
function read(page) {
  return page.evaluate(() => ({
    mode: document.body.dataset.skyContrast,
    scene: document.querySelector('.polycss-scene')?.getAttribute('style'),
    stars: [...document.querySelectorAll('.planet-cubic-sky-star')].map(element => ({
      opacity: Number(getComputedStyle(element).opacity), shadow: getComputedStyle(element).boxShadow,
      luminance: Number(element.style.getPropertyValue('--planet-cubic-sky-star-luminance')),
    })),
    faces: [...document.querySelectorAll('.planet-cubic-sky-face')].map(element => getComputedStyle(element).backgroundImage),
    bodies: [...document.querySelectorAll('.planet-heliocentric-system-marker, .planet-heliocentric-caption')]
      .map(element => element.getAttribute('style')),
  }));
}
