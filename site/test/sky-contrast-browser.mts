import {parsePreparedWorldContext} from "../../src/renderers/css/dist/index.js";
declare global {interface Window {__contrastNodes:Element[];}}
import { createTestPage } from './browser-observations.mts';
import type { Page } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { scrollToDistance as scrollTo } from './wheel-zoom-distance.mts';
import contextInput from '../../src/planets/sun/prepared/world-context.json' with { type: 'json' };

const worldContext=parsePreparedWorldContext(contextInput);
const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4210';
const objects = process.env.SKY_CONTRAST_OBJECT ? [process.env.SKY_CONTRAST_OBJECT] : ['mercury', 'venus', 'ceres', 'europa'];
const dprs = process.env.SKY_CONTRAST_DPR ? [Number(process.env.SKY_CONTRAST_DPR)] : [1, 2];
assert.ok(objects.every(id => /^[a-z][a-z0-9-]*$/u.test(id)) && dprs.every(dpr => Number.isFinite(dpr) && dpr > 0));
const output = resolve(process.env.SKY_CONTRAST_OUTPUT ?? 'output/playwright/sky-contrast');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results:unknown[] = [];
try {
  for (const dpr of dprs) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
    const page = await createTestPage(context), errors:string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const id of objects) {
      await page.goto(new URL(`/${id}/`, baseUrl).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__cssEarth?.ready && document.querySelector('.prepared-point-field-stars'));
      const motion = page.locator('input[name="motion"]');
      if (await motion.isChecked()) await motion.uncheck({ force: true });
      await checkContrast(page, id, dpr, 'near', 0);
      await page.mouse.move(1010, 460);
      await scrollTo(page, Math.sqrt(worldContext.volume.fadeStartDistanceM * worldContext.volume.fullDistanceM) / 1000);
      await checkContrast(page, id, dpr, 'transition', .5);
      await scrollTo(page, worldContext.volume.fullDistanceM * 1.01 / 1000);
      await checkContrast(page, id, dpr, 'galaxy', 1);
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ ok: true, results }, null, 2));
  console.log(JSON.stringify({ ok: true, results }));
} finally { await browser.close(); }

async function checkContrast(page: Page, id:string, dpr:number, view:"near"|"transition"|"galaxy", expectedVolumeOpacity:number) {
  // Wait for the existing label admission fade before comparing emphasis.
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('.planet-sky-contrast-setting').isChecked(), false);
  const before = await read(page);
  assert.equal(before.mode, 'standard'); assert.equal(before.emphasis, .5);
  assert.ok(Math.abs(before.volumeOpacity - expectedVolumeOpacity) < 1e-6);
  assert.ok(Math.abs(before.volumeCompositeOpacity - before.volumeOpacity * before.preparedGlow) < 1e-6,
    'Standard composition uses the prepared distance gain');
  assert.equal(before.imageOpacity, 1);
  assert.ok(before.preparedGlow < 1, 'This view must exercise the brightness override');
  assert.equal(before.roots, 1);
  if (view === 'near') assert.ok(before.stars.length > 0, 'The visible shared star field must be checked');
  assert.equal(before.sky.visibility, view === 'galaxy' ? 'hidden' : 'visible');
  await page.evaluate(() => { window.__contrastNodes = [...window.__cssearthTest.element('.planet-stage').querySelectorAll('*')]; });
  await page.screenshot({ path: resolve(output, `${id}-${view}-standard-dpr${dpr}.png`) });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.locator('.planet-sky-contrast-setting-control').click();
  const high = await read(page);
  assert.equal(high.mode, 'high'); assert.equal(high.emphasis, 1);
  assert.ok(Math.abs(high.volumeCompositeOpacity - high.volumeOpacity) < 1e-6, 'High contrast uses full volume brightness');
  assert.equal(high.imageOpacity, 1);
  if (view !== 'near') assert.ok(high.volumeCompositeOpacity > before.volumeCompositeOpacity);
  assert.equal(high.volumeOpacity, before.volumeOpacity, 'Contrast must never change the NASA-to-volume crossfade');
  assert.equal(high.sky.transform, before.sky.transform);
  assert.equal(high.sky.visibility, before.sky.visibility);
  for (const snapshot of [before, high]) assert.ok(Math.abs((1 - snapshot.volumeCompositeOpacity) * Number(snapshot.sky.opacity) - (1 - snapshot.volumeOpacity)) < 1e-6,
    'Contrast preserves the NASA contribution and orientation');
  assert.deepEqual(high.stars, before.stars, 'Prepared point photometry and transforms are preserved');
  assert.deepEqual(high.labels, before.labels, 'Labels retain their own emphasis');
  assert.deepEqual(high.bodies, before.bodies, 'Clickable body points and captions retain their presentation');
  assert.equal(high.scene, before.scene, 'Contrast must not move the camera');
  assert.equal(high.roots, 1);
  await page.screenshot({ path: resolve(output, `${id}-${view}-high-dpr${dpr}.png`) });
  await page.locator('.planet-sky-contrast-setting-control').click();
  assert.deepEqual(await read(page), before);
  assert.equal(await page.evaluate(() => [...window.__cssearthTest.element('.planet-stage').querySelectorAll('*')]
    .every((node, index) => node === window.__contrastNodes[index])), true);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  results.push({ id, dpr, view, stars: before.stars.length, standardEmphasis: before.emphasis, highEmphasis: high.emphasis,
    standardBrightness: before.preparedGlow, highBrightness: 1, volumeOpacity: high.volumeOpacity, stable: true });
}


function read(page: Page) {
  return page.evaluate(() => {
    const layer = document.querySelector('.prepared-point-field-stars');
    return {
      mode: document.body.dataset.skyContrast,
      scene: document.querySelector('.polycss-scene')?.getAttribute('style'),
      roots: document.querySelectorAll('.polycss-camera').length,
      emphasis: Number(getComputedStyle(window.__cssearthTest.required(layer, 'computed style element')).opacity),
      volumeOpacity: Number(window.__cssearthTest.html('.prepared-volume-context').dataset.volumeOpacity),
      volumeCompositeOpacity: Number(getComputedStyle(window.__cssearthTest.required(document.querySelector('.prepared-volume-context'), 'computed style element')).opacity),
      imageOpacity: Number(getComputedStyle(window.__cssearthTest.required(document.querySelector('.prepared-volume-image'), 'computed style element')).opacity),
      preparedGlow: Number(window.__cssearthTest.html('.prepared-volume-image').dataset.volumeBrightness),
      sky: { opacity: getComputedStyle(window.__cssearthTest.required(document.querySelector('.prepared-celestial-sky'), 'computed style element')).opacity,
        visibility: getComputedStyle(window.__cssearthTest.required(document.querySelector('.prepared-celestial-sky'), 'computed style element')).visibility,
        transform: window.__cssearthTest.html('.prepared-celestial-sky-scene').style.transform },
      stars: window.__cssearthTest.universe().inspect().stars.points.filter(({ element }) => getComputedStyle(element).visibility === 'visible')
        .map(({ element, reference }) => ({ style: element.getAttribute('style'), reference })),
      labels: [...document.querySelectorAll('.prepared-star-label')].map(element => element.getAttribute('style')),
      bodies: [...document.querySelectorAll('[data-context-label], [data-object-navigate]')]
        .map(element => element.getAttribute('style')),
    };
  });
}
