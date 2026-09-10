// Exercise the real destination shell/provider bridge with the physical camera.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { prepareLocationPoint } from '../../tools/objects/geographic-pages/prepare-location.mts';

const origin = process.env.CSSEARTH_TEST_ORIGIN ?? 'http://localhost:4210';
const output = '.local/surface-destination-browser';
const scene = JSON.parse(await readFile(new URL('../../src/planets/earth/prepared/scene.json', import.meta.url)));
const catalog = JSON.parse(await readFile(new URL('../../public/scenes/earth/earth-places.json', import.meta.url)));
const place = catalog.places.find(place => place.id === '3435910');
assert.ok(place, 'The real prepared catalogue includes Buenos Aires');
const point = prepareLocationPoint(scene, place.longitude, place.latitude);
const report = { origin, place: place.id, errors: [], catalogRequests: [], samples: [] };
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('request', request => {
    if (request.url().endsWith('/earth-places.json')) report.catalogRequests.push(request.url());
  });
  await page.goto(`${origin}/earth/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__cssEarth?.ready && window.__earth?.ready, null, { timeout: 60000 });
  const motion = page.locator('input[name="motion"]');
  if (await motion.isChecked()) await motion.uncheck({ force: true });
  assert.equal(report.catalogRequests.length, 0, 'The real prepared catalogue loads lazily');

  // Do not call camera.setState/flyToState: the native result button must supply
  // the physical surface-target option through the actual runtime provider.
  await page.locator('.planet-sidebar-search').fill(place.name);
  await page.getByRole('button', { name: `${place.name}, ${place.context}`, exact: true }).click();
  await page.locator('.planet-destination-panel').waitFor();
  await page.waitForFunction(() => window.__cssEarth?.error || (window.__cssEarth?.ready && window.__earth?.ready &&
    document.querySelector('.planet-destination-panel').ariaBusy === 'false' &&
    !window.__earth.camera.stats().dragInertia.destinationFlyTo.active));
  assert.equal(await page.evaluate(() => window.__cssEarth.error), null, 'The actual scene owner records no flight failure');
  assert.deepEqual(report.errors, [], 'The real flight preserves the world-camera rotation invariant');

  const actual = await page.evaluate(point => {
    const style = selector => getComputedStyle(document.querySelector(selector));
    const matrix = new DOMMatrix(style('.polycss-scene').transform)
      .multiply(new DOMMatrix(style('.earth-system').transform))
      .multiply(new DOMMatrix(style('.earth-body:not(.earth-body-polar)').transform));
    const target = matrix.transformPoint(new DOMPoint(...point));
    const root = document.querySelector('.polycss-camera').getBoundingClientRect();
    const state = window.__earth.camera.state();
    const [offsetX, offsetY] = state.principalOffset, focal = state.focal;
    const expected = [root.x + root.width / 2, root.y + root.height / 2];
    const depth = focal - target.z;
    const screen = [expected[0] + offsetX + (target.x - offsetX) * focal / depth,
      expected[1] + offsetY + (target.y - offsetY) * focal / depth];
    return { state, target: target.toJSON(), screen, expected, depth,
      errorPixels: Math.hypot(screen[0] - expected[0], screen[1] - expected[1]) };
  }, point);
  report.samples.push(actual);
  await page.screenshot({ path: `${output}/buenos-aires.png` });
  assert.equal(await page.locator('.planet-destination-name').innerText(), place.name);
  assert.match(await page.locator('.planet-destination-status').innerText(), /WorldCover imagery/u);
  assert.equal(actual.state.zoom, place.camera.zoom, 'Native city selection reaches its prepared zoom');
  assert.ok(Math.abs(actual.state.principalOffset[0]) > 100, 'The real desktop shell exercises its off-axis eye');
  assert.ok(actual.depth > 0 && Number.isFinite(actual.errorPixels), 'The prepared city is in front of the eye');
  assert.ok(actual.errorPixels < 2, `Native city selection misses the physical centre by ${actual.errorPixels}px`);
  assert.equal(report.catalogRequests.length, 1);
  assert.deepEqual(report.errors, []);
  console.log(`SURFACE DESTINATION PASS: native Buenos Aires selection at zoom ${actual.state.zoom}, ${actual.errorPixels.toFixed(3)}px from centre`);
} finally {
  await writeFile(`${output}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}
