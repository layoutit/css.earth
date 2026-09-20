import { required } from '../../tools/test-values.mts';
import type { SCENE_OBJECTS } from '../objects.mts';
import { createTestPage } from './browser-observations.mts';
import type { Page } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { scrollToDistance as scrollTo } from './wheel-zoom-distance.mts';
import volume from '../../src/objects/milky-way/prepared/volume.json' with { type: 'json' };
import context from '../../src/objects/sun/prepared/world-context.json' with { type: 'json' };

const output = process.env.GALAXY_HANDOFF_OUTPUT ?? '.local/galaxy-handoff';
const parsecKm = 3.085677581491367e13;
const reported = '/sun/?v=QMJCPggu1DfsP78xu57ddXumwnJb4eAJKY4_1druhMxGfj_U7dzCwKAIP-IyYcFa6EcAAQAAAAAAAAAA';
declare global { interface Window { __handoffFrame:NonNullable<typeof SCENE_OBJECTS[number]['worldFrame']>; __handoffNodes:Element[]; } }
type HandoffSample = Awaited<ReturnType<typeof read>> & {background:Awaited<ReturnType<typeof backgroundSignal>>};
const samples:HandoffSample[] = [], errors:string[] = [];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await createTestPage(browser, { viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => performance.setResourceTimingBufferSize(10000));
  await page.goto(new URL(reported, process.argv[2] ?? 'http://localhost:4210').href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__sun?.ready && window.__cssEarth?.ready, null, { timeout: 30000 });
  const motion = page.locator('input[name="motion"]');
  if (await motion.isChecked()) await motion.uncheck({ force: true });
  await page.evaluate(async () => {
    const { SCENE_OBJECTS } = await import('/site/objects.mts');
    window.__handoffFrame = window.__cssearthTest.required(window.__cssearthTest.required(SCENE_OBJECTS.find(object => object.id === 'sun'), 'Sun object').worldFrame, 'Sun frame');
    window.__handoffNodes = [...window.__cssearthTest.element('.prepared-universe').querySelectorAll('*')];
  });
  await page.waitForTimeout(600);
  const initialKm = await page.evaluate(() => window.__cssearthTest.physicalCamera('sun').distanceKilometers);
  const starFadeStartPc = context.stars.fadeStartDistanceM / (parsecKm * 1000);
  const starFadeFullPc = context.stars.fullDistanceM / (parsecKm * 1000);
  for (const distance of [initialKm / parsecKm, starFadeStartPc, Math.sqrt(starFadeStartPc * starFadeFullPc), starFadeFullPc,
    1, 10, 97.8159, 200, 500, 1000, 2255.4, 3500, 5000, 10000]) {
    await scrollTo(page, distance * parsecKm);
    await page.waitForTimeout(250);
    const observation = await read(page);
    const png = await page.screenshot({ path: `${output}/journey-${samples.length}.png` });
    const snapshot = {...observation, background:await backgroundSignal(png)};
    samples.push(snapshot);
    assert.equal(snapshot.roots, 1);
    // The baked neighbourhood stars layer over the photograph, so a face has
    // more than one node; the cube is still six faces.
    assert.deepEqual(snapshot.skyFaceNames, ['nx', 'ny', 'nz', 'px', 'py', 'pz']);
    assert.equal(snapshot.skyFaces % 6, 0);
    // Native computed opacity is serialized to fewer digits than the prepared weights.
    const expectedSkyContribution = 1 - snapshot.volumeCompositeOpacity;
    assert.ok(Math.abs(snapshot.skyContribution - expectedSkyContribution) < 1e-6,
      'one prepared background continuously replaces the other');
    assert.ok(Math.abs(snapshot.volumeCompositeOpacity - snapshot.volumeOpacity * snapshot.volumeBrightness) < 1e-6);
    assert.ok(Math.abs((1 - snapshot.volumeCompositeOpacity) * snapshot.skyOpacity - snapshot.skyContribution) < 1e-6,
      'actual source-over coefficients preserve the prepared sky contribution');
    assert.equal(snapshot.volumeWeight, 1);
    if (snapshot.skyContribution > 1e-8) assert.equal(snapshot.skyVisibility, 'visible');
    else assert.equal(snapshot.skyVisibility, 'hidden');
    assert.ok(await page.evaluate(() => window.__handoffNodes.every(node => node.isConnected)), 'travel retains every environment node');
  }
  const initial = samples[0], fading = samples[2], farOnly = samples[3];
  assert.equal(initial.skyContribution, 1);
  assert.equal(fading.skyContribution, 1, 'the plain Milky Way replaces the baked nearby stars without dimming the background');
  assert.equal(farOnly.skyContribution, 1); assert.equal(farOnly.skyVisibility, 'visible');
  assert.ok(samples.every(sample => sample.background.mean >= initial.background.mean * .75),
    'the outward path must not develop a dark background trough');
  assert.ok(context.stars.fullDistanceM < volume.data.sky.parallax.metersPerCssPixel * 50,
    'the baked nearby-star cube retires long before the camera can approach a cube face');
  assert.equal(required(samples.at(-1)).requests, initial.requests, 'the entire prepared image bank is ready before travel');
  await scrollTo(page, initialKm); await page.waitForTimeout(600);
  const returned = await read(page);
  assert.equal(returned.skyContribution, 1); assert.equal(returned.skyVisibility, 'visible');
  assert.ok(returned.skyMatrix.every((value, axis) => Math.abs(value - initial.skyMatrix[axis]) < 1e-5));
  assert.deepEqual(errors, []);
  console.log('GALAXY_HANDOFF_PASSED source-faithful Solar sky, bounded observer validity, retained images, outward and return.');
} finally {
  await writeFile(`${output}/journey-report.json`, JSON.stringify({ samples, errors }, null, 2));
  await browser.close();
}

async function read(page: Page) {
  return page.evaluate(() => {
    const sky = document.querySelector('.prepared-celestial-sky');
    return {
      distancePc: window.__cssearthTest.physicalCamera('sun').distanceKilometers / 3.085677581491367e13,
      world: window.__cssearthTest.required(window.__cssearthTest.object('sun').camera.captureWorldCamera(window.__handoffFrame), 'shared world pose'),
      roots: document.querySelectorAll('.polycss-camera').length,
      skyFaces: document.querySelectorAll('[data-sky-face]').length,
      skyFaceNames: [...new Set([...document.querySelectorAll('[data-sky-face]')].map(face => face.getAttribute('data-sky-face')))].sort(),
      skyMatrix: Array.from(new DOMMatrix(window.__cssearthTest.html('.prepared-celestial-sky-scene').style.transform).toFloat64Array()),
      skyContribution: Number(window.__cssearthTest.htmlElement(sky).dataset.skyContribution), skyVisibility: getComputedStyle(window.__cssearthTest.required(sky, 'computed style element')).visibility,
      volumeOpacity: Number(window.__cssearthTest.html('.prepared-volume-context').dataset.volumeOpacity),
      volumeCompositeOpacity: Number(getComputedStyle(window.__cssearthTest.required(document.querySelector('.prepared-volume-context'), 'computed style element')).opacity),
      volumeBrightness: Number(window.__cssearthTest.html('.prepared-volume-image').dataset.volumeBrightness),
      skyOpacity: Number(getComputedStyle(window.__cssearthTest.required(sky, 'computed style element')).opacity),
      volumeWeight: Number(getComputedStyle(window.__cssearthTest.required(document.querySelector('.prepared-volume-image'), 'computed style element')).opacity),
      requests: performance.getEntriesByType('resource').filter(entry => /\/milky-way\/prepared\//.test(entry.name)).length,
    };
  });
}

async function backgroundSignal(png:Buffer) {
  const { data, info } = await sharp(png).extract({ left: 380, top: 60, width: 1040, height: 780 })
    .removeAlpha().resize(104, 78).blur(2).raw().toBuffer({ resolveWithObject: true });
  const values = [];
  for (let offset = 0; offset < data.length; offset += info.channels) values.push((.2126 * data[offset] + .7152 * data[offset + 1] + .0722 * data[offset + 2]) / 255);
  values.sort((a, b) => a - b);
  return { mean: values.reduce((sum, value) => sum + value, 0) / values.length, median: values[Math.floor(values.length / 2)] };
}
