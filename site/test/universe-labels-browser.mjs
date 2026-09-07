import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { wheelWithReceipt } from './wheel-zoom-distance.mjs';

const output = '.local/universe-labels';
const base = process.argv[2] ?? 'http://localhost:4210';
const views = {
  system: '/uranus/?v=QMJB54fM-XsVFj9j5GnO9K65whzE2WxJheE_3YCeF77iXj--hUwc8N6Rv-NXAOxJ6FAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  shell: '/uranus/?v=QIJCEaGXXp-Hmj-Nz2srNnuTwkWObfbbotW_24bS6vu0br_QPSQpGBnZv-I7hUkhvnMAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
};
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], snapshots = {};
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  async function open(path) {
    await page.goto(new URL(path, base).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__cssEarth?.ready && window[`__${window.__cssEarth.activeObjectId}`]?.ready, null, { timeout: 30000 });
    const motion = page.locator('input[name="motion"]');
    if (await motion.isChecked()) await motion.uncheck({ force: true });
    await page.waitForTimeout(800);
  }
  await open(views.system);
  snapshots.system = await read(page);
  assert.equal(snapshots.system.roots, 1);
  assert.ok(snapshots.system.labels.some(label => label.id === 'sun'));
  assert.ok(!snapshots.system.labels.some(label => /Rigil Kentaurus/i.test(label.text)), 'reported star caption inside the system footprint must be hidden');
  assertNoOverlaps(snapshots.system.labels);
  assert.ok(!snapshots.system.labels.some(label => ['io', 'europa', 'ganymede', 'callisto', 'titan', 'mimas', 'phobos', 'deimos'].includes(label.id)), 'moon captions stay hidden in the compact system overview');
  await page.screenshot({ path: `${output}/system.png` });

  await open(views.shell);
  snapshots.shell = await read(page);
  assert.ok(snapshots.shell.labels.some(label => label.text === 'Heliosphere'), 'the visible shell has its caption');
  assertNoOverlaps(snapshots.shell.labels);
  await page.screenshot({ path: `${output}/heliosphere.png` });
  await page.evaluate(() => { window.__labelJourneyNodes = [...document.querySelector('.prepared-universe').querySelectorAll('*')]; });
  await scrollTo(page, 2.4e18);
  await page.waitForTimeout(800);
  snapshots.galaxy = await read(page);
  assert.ok(snapshots.galaxy.labels.some(label => label.id === 'sun'), 'Sun locator caption remains at galaxy scale');
  assert.ok(snapshots.galaxy.labels.some(label => label.text === 'Milky Way'), 'the exterior galaxy has its caption');
  assert.ok(!snapshots.galaxy.labels.some(label => label.text === 'Heliosphere'), 'retired shell leaves no stale caption');
  assertNoOverlaps(snapshots.galaxy.labels);
  assert.ok(await page.evaluate(() => window.__labelJourneyNodes.every(node => node.isConnected)), 'zoom retains environment and label DOM');
  await page.screenshot({ path: `${output}/galaxy.png` });
  snapshots.sunRotation = await rotateAndReadSun(page);
  assert.ok(snapshots.sunRotation.length > 10 && snapshots.sunRotation.every(sample => sample.opacity > .99 && sample.visible),
    'Sun locator caption stays painted throughout native galaxy rotation');
  const sunBox = await page.locator('[data-context-label="sun"]').boundingBox();
  assert.ok(sunBox, 'Sun text has a native hit target');
  // The retained transparent input surface picks the scene text underneath it.
  await page.mouse.dblclick(sunBox.x + sunBox.width / 2, sunBox.y + sunBox.height / 2, { delay: 90 });
  await page.waitForFunction(() => window.__cssEarth.activeObjectId === 'sun' && window.__sun?.ready, null, { timeout: 30000 });
  assert.equal(await page.locator('.polycss-camera').count(), 1);
  assert.ok(await page.evaluate(() => window.__labelJourneyNodes.every(node => node.isConnected)), 'Sun label navigation retains the shared environment');
  assert.deepEqual(errors, []);
  console.log('UNIVERSE_LABELS_PASSED compact system priority → heliosphere caption → galaxy/Sun captions → Sun navigation; retained scene.');
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify({ snapshots, errors }, null, 2));
  await browser.close();
}
function assertNoOverlaps(labels) {
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
    const a = labels[i], b = labels[j];
    assert.ok(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top, `${a.text} overlaps ${b.text}`);
  }
}
async function rotateAndReadSun(page) {
  await page.evaluate(() => {
    window.__sunRotationSamples = []; window.__trackSunRotation = true;
    const sample = () => {
      const label = document.querySelector('[data-context-label="sun"]'), style = getComputedStyle(label);
      window.__sunRotationSamples.push({ opacity: Number(style.opacity), visible: style.visibility !== 'hidden' });
      if (window.__trackSunRotation) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.mouse.move(1050, 550); await page.mouse.down();
  await page.mouse.move(1200, 450, { steps: 18 }); await page.mouse.up();
  await page.waitForFunction(() => !window[`__${window.__cssEarth.activeObjectId}`].camera.stats().dragInertia.active, null, { timeout: 6000 });
  await page.waitForTimeout(250);
  return page.evaluate(() => { window.__trackSunRotation = false; return window.__sunRotationSamples; });
}
async function scrollTo(page, targetKm) {
  await page.mouse.move(1010, 460);
  for (let attempt = 0; attempt < 24; attempt++) {
    const current = await page.evaluate(() => window[`__${window.__cssEarth.activeObjectId}`].camera.state().distanceKilometers);
    if (Math.abs(current / targetKm - 1) < 1e-6) return;
    const step = await page.evaluate(() => window[`__${window.__cssEarth.activeObjectId}`].camera.stats().dolly.wheelStepPerDelta);
    await wheelWithReceipt(page, Math.max(-300, Math.min(300, Math.log(targetKm / current) / step)));
    await page.waitForFunction(() => { const state = window[`__${window.__cssEarth.activeObjectId}`].camera.stats().dragInertia; return !state.active && !state.wheelZoom.active; }, null, { timeout: 6000 });
  }
  throw new Error(`Native wheel did not reach ${targetKm} km`);
}
async function read(page) {
  return page.evaluate(() => {
    const visible = element => {
      for (let node = element; node instanceof HTMLElement; node = node.parentElement) {
        const s = getComputedStyle(node);
        if (node.hidden || s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < .001) return false;
      }
      return true;
    };
    const nodes = [...document.querySelectorAll('[data-context-label],.prepared-star-label,[data-environment-label]')];
    return { roots: document.querySelectorAll('.polycss-camera').length,
      labels: nodes.filter(visible).map(element => {
        const rect = element.getBoundingClientRect();
        return { id: element.dataset.contextLabel ?? '', text: element.textContent, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
      }),
      locator: document.querySelector('[data-context-focus-locator="sun"]')?.getAttribute('style'),
    };
  });
}
