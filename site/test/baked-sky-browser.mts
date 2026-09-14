import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createTestPage } from './browser-observations.mts';
import { SCENE_OBJECTS } from '../objects.mts';

declare global { interface Window { __bakedSkyFaces: Element[]; } }
const frame = SCENE_OBJECTS.find(object => object.id === 'sun')?.worldFrame;
assert.ok(frame, 'Sun has a prepared world frame');
const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const output = 'output/playwright/baked-sky';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome', headless: true });
try {
  const page = await createTestPage(browser, { viewport: { width: 1440, height: 900 } });
  const requests: string[] = [], errors: string[] = [];
  page.context().on('request', request => requests.push(request.url()));
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/sun/?overview=solar-system&v=MIZCE4uWPbqNv0FCxzNAAAAAP9IAxQkxWgM_sQBhZ2aaDL_ido5DYqVQAAEAAAAAAAAAAA`);
  await page.waitForFunction(() => window.__cssEarth?.ready && window.__cssEarth?.object('sun')?.ready, null, { timeout: 60000 });
  await page.evaluate(() => { window.__bakedSkyFaces = [...document.querySelectorAll('.prepared-celestial-sky [data-sky-face]')]; });
  const observe = () => page.evaluate(() => ({
    skyFaces: document.querySelectorAll('.prepared-celestial-sky [data-sky-face]').length,
    cubes: document.querySelectorAll('.prepared-celestial-sky-scene').length,
    liveStarLayers: document.querySelectorAll('.prepared-point-field, .prepared-point-field-block').length,
    textures: window.__bakedSkyFaces.map(element => (element as HTMLElement).style.backgroundImage),
    stable: window.__bakedSkyFaces.every(element => element.isConnected),
    transform: window.__cssearthTest.html('.prepared-celestial-sky-scene').style.transform,
    sunMarker: document.querySelectorAll('[data-world-context-point-source="sun"]').length,
    sunVisibility: getComputedStyle(window.__cssearthTest.element('[data-world-context-point-source="sun"]')).visibility,
    sunOpacity: Number(getComputedStyle(window.__cssearthTest.element('[data-world-context-point-source="sun"]')).opacity),
    skyVisibility: getComputedStyle(window.__cssearthTest.element('.prepared-celestial-sky')).visibility,
  }));
  const initial = await observe();
  const samples = [];
  for (const distanceM of [50 * 149597870700, 140.3 * 149597870700, 0.2 * 3.085677581491367e16, 5 * 149597870700]) {
    await page.evaluate(({ frame, distanceM }) => {
      const camera = window.__cssearthTest.object('sun').camera;
      const world = camera.captureWorldCamera(frame);
      const delta = world.pose.positionM.map((value, axis) => value - frame.originM[axis]);
      const scale = distanceM / Math.hypot(...delta);
      camera.applyWorldCamera({ ...world, pose: { ...world.pose, positionM: [
        frame.originM[0] + delta[0] * scale, frame.originM[1] + delta[1] * scale, frame.originM[2] + delta[2] * scale,
      ] } }, frame);
    }, { frame, distanceM });
    await page.waitForTimeout(250);
    const sample = await observe(); samples.push({ distanceM, ...sample });
    assert.equal(sample.skyFaces, 6); assert.equal(sample.cubes, 1); assert.equal(sample.liveStarLayers, 0);
    assert.equal(sample.stable, true); assert.deepEqual(sample.textures, initial.textures);
    assert.ok(sample.textures.every(texture => texture.includes('sky-near')));
    assert.equal(sample.skyVisibility, 'visible'); assert.equal(sample.sunMarker, 1);
  }
  const close = await observe();
  assert.equal(close.sunVisibility, 'visible'); assert.ok(close.sunOpacity > 0);
  await page.mouse.move(1000, 460); await page.mouse.down();
  await page.mouse.move(1170, 520, { steps: 18 }); await page.mouse.up();
  await page.waitForTimeout(350);
  const rotated = await observe();
  assert.notEqual(rotated.transform, close.transform); assert.equal(rotated.stable, true);
  assert.equal(rotated.liveStarLayers, 0);
  const starBanks = requests.filter(url => /stellar-neighbourhood.*\.bin(?:\?|$)/u.test(url));
  assert.deepEqual(starBanks, [], 'No star catalogue bank is fetched by the page or worker');
  assert.deepEqual(errors, []);
  await page.screenshot({ path: `${output}/sun-baked-sky.png` });
  const report = { ok: true, initial, samples, rotated, starBankRequests: starBanks, errors };
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, views: samples.length, skyFaces: rotated.skyFaces, cubes: rotated.cubes, liveStarLayers: 0, starBankRequests: 0 }));
} finally { await browser.close(); }
