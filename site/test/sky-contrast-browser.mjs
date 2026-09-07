import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { wheelWithReceipt } from './wheel-zoom-distance.mjs';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4210';
const objects = process.env.SKY_CONTRAST_OBJECT ? [process.env.SKY_CONTRAST_OBJECT] : ['mercury', 'venus', 'ceres', 'europa'];
const dprs = process.env.SKY_CONTRAST_DPR ? [Number(process.env.SKY_CONTRAST_DPR)] : [1, 2];
assert.ok(objects.every(id => /^[a-z][a-z0-9-]*$/u.test(id)) && dprs.every(dpr => Number.isFinite(dpr) && dpr > 0));
const output = resolve('output/playwright/sky-contrast');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const dpr of dprs) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const id of objects) {
      await page.goto(new URL(`/${id}/`, baseUrl).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__cssEarth?.ready && document.querySelector('.prepared-point-field-stars'));
      const motion = page.locator('input[name="motion"]');
      if (await motion.isChecked()) await motion.uncheck({ force: true });
      await checkContrast(page, id, dpr, 'near', 0);
      await page.mouse.move(1010, 460);
      await scrollTo(page, 1001 * 3.085677581491367e13);
      await checkContrast(page, id, dpr, 'galaxy', 1);
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ ok: true, results }, null, 2));
  console.log(JSON.stringify({ ok: true, results }));
} finally { await browser.close(); }

async function checkContrast(page, id, dpr, view, expectedVolumeOpacity) {
  // Wait for the existing label admission fade before comparing emphasis.
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('.planet-sky-contrast-setting').isChecked(), false);
  const before = await read(page);
  assert.equal(before.mode, 'standard'); assert.equal(before.emphasis, .35);
  assert.equal(before.volumeOpacity, expectedVolumeOpacity);
  assert.ok(Math.abs(before.glow - before.preparedGlow) < 1e-6, 'Standard brightness uses the prepared distance gain');
  assert.ok(before.glow < 1, 'This view must exercise the brightness override');
  assert.equal(before.roots, 1);
  if (view === 'near') assert.ok(before.stars.length > 0, 'The visible shared star field must be checked');
  assert.equal(before.sky.visibility, view === 'near' ? 'visible' : 'hidden');
  await page.evaluate(() => { window.__contrastNodes = [...document.querySelector('.planet-stage').querySelectorAll('*')]; });
  await page.screenshot({ path: resolve(output, `${id}-${view}-standard-dpr${dpr}.png`) });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.locator('.planet-sky-contrast-setting-control').click();
  const high = await read(page);
  assert.equal(high.mode, 'high'); assert.equal(high.emphasis, 1);
  assert.equal(high.glow, 1, 'High contrast raises only the completed volume image to full brightness');
  assert.ok(high.glow > before.glow);
  assert.equal(high.volumeOpacity, before.volumeOpacity, 'Contrast must never change the NASA-to-volume crossfade');
  assert.deepEqual(high.sky, before.sky, 'The nearby NASA background keeps its own appearance and orientation');
  assert.deepEqual(high.stars, before.stars, 'Prepared point photometry and transforms are preserved');
  assert.deepEqual(high.labels, before.labels, 'Labels retain their own emphasis');
  assert.deepEqual(high.bodies, before.bodies, 'Clickable body points and captions retain their presentation');
  assert.equal(high.scene, before.scene, 'Contrast must not move the camera');
  assert.equal(high.roots, 1);
  await page.screenshot({ path: resolve(output, `${id}-${view}-high-dpr${dpr}.png`) });
  await page.locator('.planet-sky-contrast-setting-control').click();
  assert.deepEqual(await read(page), before);
  assert.equal(await page.evaluate(() => [...document.querySelector('.planet-stage').querySelectorAll('*')]
    .every((node, index) => node === window.__contrastNodes[index])), true);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  results.push({ id, dpr, view, stars: before.stars.length, standardEmphasis: before.emphasis, highEmphasis: high.emphasis,
    standardBrightness: before.glow, highBrightness: high.glow, volumeOpacity: high.volumeOpacity, stable: true });
}

async function scrollTo(page, targetKm) {
  for (let attempt = 0; attempt < 24; attempt++) {
    const current = await page.evaluate(() => window[`__${window.__cssEarth.activeObjectId}`].camera.state().distanceKilometers);
    if (Math.abs(current / targetKm - 1) < 1e-6) return;
    const step = await page.evaluate(() => window[`__${window.__cssEarth.activeObjectId}`].camera.stats().dolly.wheelStepPerDelta);
    await wheelWithReceipt(page, Math.max(-300, Math.min(300, Math.log(targetKm / current) / step)));
    await page.waitForFunction(() => { const state = window[`__${window.__cssEarth.activeObjectId}`].camera.stats().dragInertia; return !state.active && !state.wheelZoom.active; }, null, { timeout: 6000 });
  }
  throw new Error(`Native wheel did not reach ${targetKm} km.`);
}

function read(page) {
  return page.evaluate(() => {
    const layer = document.querySelector('.prepared-point-field-stars');
    return {
      mode: document.body.dataset.skyContrast,
      scene: document.querySelector('.polycss-scene')?.getAttribute('style'),
      roots: document.querySelectorAll('.polycss-camera').length,
      emphasis: Number(getComputedStyle(layer).opacity),
      volumeOpacity: Number(getComputedStyle(document.querySelector('.prepared-volume-context')).opacity),
      glow: Number(getComputedStyle(document.querySelector('.prepared-volume-image')).opacity),
      preparedGlow: Number(document.querySelector('.prepared-volume-image').dataset.volumeBrightness),
      sky: { opacity: getComputedStyle(document.querySelector('.prepared-celestial-sky')).opacity,
        visibility: getComputedStyle(document.querySelector('.prepared-celestial-sky')).visibility,
        transform: document.querySelector('.prepared-celestial-sky-scene').style.transform },
      stars: [...layer.querySelectorAll('[data-star-slot]')].filter(element => getComputedStyle(element).visibility === 'visible')
        .map(element => ({ style: element.getAttribute('style'), reference: element.dataset.starReference })),
      labels: [...document.querySelectorAll('.prepared-star-label')].map(element => element.getAttribute('style')),
      bodies: [...document.querySelectorAll('[data-context-label], [data-object-navigate]')]
        .map(element => element.getAttribute('style')),
    };
  });
}
