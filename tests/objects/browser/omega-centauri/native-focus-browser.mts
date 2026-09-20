/** Native arrival, ordinary reselection and wheel zoom: never apply an inspection camera. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { parsePreparedNebulaCatalog } from '@cssearth/catalog';
import { parsePreparedWorldContext } from '../../../../src/renderers/css/dist/index.js';
import { validatePreparedVolumeLenses } from '../../../../src/renderers/css/dist/universe.js';
import { requireRecord } from '../../../../tools/source-values.mts';
import { createTestPage } from '../../../../site/test/browser-observations.mts';

const base = process.argv[2] ?? 'http://127.0.0.1:4210';
const out = resolve(process.argv[3] ?? 'output/omega-native-focus');
await mkdir(out, { recursive: true });
const pins: { path: string; bytes: number; sha256: string }[] = [];
async function input(path: string): Promise<unknown> {
  const bytes = await readFile(path);
  pins.push({ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  return JSON.parse(bytes.toString('utf8'));
}
const context = parsePreparedWorldContext(await input('src/objects/sun/prepared/world-context.json'));
const catalog = parsePreparedNebulaCatalog(await input('src/objects/omega-centauri/source/nebula.json'));
const target = catalog.objects.find(object => object.id === 'omega-centauri');
assert.ok(target);
const payload = validatePreparedVolumeLenses(requireRecord(await input('src/objects/omega-centauri/prepared/lenses.json')).data);
const radiusM = payload.framingRadiusUnits * payload.lenses[0]!.volume.frame.metersPerUnit;
const viewport = { width: 1440, height: 1000 };
const browser = await chromium.launch({ headless: true });
const page = await createTestPage(browser, { viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
const errors: string[] = [], failed: string[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`); });
const parameters = { frame: context.frame, target: target.positionM, radiusM };
const measure = () => page.evaluate(({ frame, target, radiusM }) => {
  const world = window.__cssearthTest.object('sun').camera.captureWorldCamera(frame);
  const camera = window.__cssearthTest.physicalCamera('sun');
  const distanceM = Math.hypot(...world.pose.positionM.map((value, axis) => value - target[axis]!));
  return { world, distanceM, distanceRadii: distanceM / radiusM, projectedRadiusPixels: camera.focal * radiusM / distanceM };
}, parameters);
const settle = () => page.evaluate(() => new Promise<void>(done => {
  let remaining = 20;
  const tick = () => --remaining > 0 ? requestAnimationFrame(tick) : done();
  requestAnimationFrame(tick);
}));
const contextVisibility = () => page.evaluate(() => ({
  volumes: [...document.querySelectorAll<HTMLElement>('[data-volume-lens-object]')].map(root => ({
    id: root.dataset.volumeLensObject, display: getComputedStyle(root).display, opacity: Number(getComputedStyle(root).opacity),
  })),
  overview: [...document.querySelectorAll<HTMLElement>('[data-volume-opacity]')].map(root => ({
    display: getComputedStyle(root).display, opacity: Number(getComputedStyle(root).opacity),
  })),
}));
const assertCloseContext = async () => {
  const state = await contextVisibility();
  assert.ok(state.volumes.some(bank => bank.id === 'omega-centauri' && bank.display !== 'none' && bank.opacity > 0));
  assert.ok(state.volumes.filter(bank => bank.id !== 'omega-centauri').every(bank => bank.display === 'none'),
    'A close-up must take surrounding detailed volumes out of rendering.');
  assert.ok(state.overview.length > 0 && state.overview.every(bank => bank.display === 'none'),
    'A close-up must take the detailed Milky Way overview out of rendering.');
  return state;
};
const focus = async () => {
  await page.locator('.planet-sidebar-search').fill('Omega Centauri');
  await page.locator('.planet-object-link[data-prepared-focus-id="omega-centauri"]').click();
  await settle();
};
const report: Record<string, unknown> = { base, viewport, browser: browser.version(), inputPins: pins, errors, failed };
try {
  assert.equal((await page.goto(`${base}/sun/?focus=omega-centauri`, { waitUntil: 'domcontentloaded' }))?.status(), 200);
  await page.waitForFunction(() => window.__sun?.ready, null, { timeout: 180_000 });
  await page.locator('[data-focus-lens-bank="omega-centauri"]').waitFor({ state: 'visible' });
  await page.waitForFunction(({ frame, target, radiusM }) => {
    const position = window.__cssearthTest.object('sun').camera.captureWorldCamera(frame).pose.positionM;
    const distance = Math.hypot(...position.map((value, axis) => value - target[axis]!));
    const radius = window.__cssearthTest.physicalCamera('sun').focal * radiusM / distance;
    return radius >= 150 && radius <= 300;
  }, parameters, { timeout: 30_000 });
  await settle();
  const cold = await measure(); report.cold = cold;
  // At this fixed viewport the authored cloud must occupy a useful foreground size.
  // The former unloaded-bounds arrival measured only 64 px and fails this condition.
  assert.ok(cold.projectedRadiusPixels >= 150 && cold.projectedRadiusPixels <= 300);
  report.coldContext = await assertCloseContext();
  await page.screenshot({ path: resolve(out, 'native-arrival.png') });
  await focus();
  const warm = await measure(); report.warm = warm;
  assert.ok(Math.abs(cold.distanceM / warm.distanceM - 1) < .01, 'Cold arrival and ordinary reselection must use the same prepared radius.');
  const beforeDrag = JSON.stringify(warm.world.pose.orientationXyzw);
  await page.mouse.move(720, 500); await page.mouse.down();
  await page.mouse.move(820, 530, { steps: 10 }); await page.mouse.up(); await settle();
  const dragged = await measure(); report.dragged = dragged;
  assert.notEqual(JSON.stringify(dragged.world.pose.orientationXyzw), beforeDrag, 'Ordinary drag must orbit the focused object.');
  await page.mouse.wheel(0, -5000); await settle();
  const zoomed = await measure(); report.zoomed = zoomed;
  assert.ok(zoomed.distanceM < dragged.distanceM, 'Ordinary wheel input must approach the cluster.');
  assert.ok(zoomed.distanceRadii >= .05 * (1 - 1e-8), 'Wheel input must respect the existing shared volume minimum.');
  await focus();
  const restored = await measure(); report.reselected = restored;
  assert.ok(Math.abs(restored.distanceM / warm.distanceM - 1) < .01, 'Reselection must recover framing after zoom.');
  report.reselectedContext = await assertCloseContext();
  const outwardDelta = await page.evaluate(distanceRadii => Math.log(100 / distanceRadii) /
    window.__cssearthTest.required(window.__cssearthTest.object('sun').camera.stats().dolly, 'dolly diagnostics').wheelStepPerDelta,
  restored.distanceRadii);
  await page.mouse.move(720, 500);
  await page.mouse.wheel(0, outwardDelta); await settle();
  const far = await measure(); report.zoomedOut = far;
  assert.ok(far.distanceRadii >= 32, 'Ordinary outward wheel input must leave the close-up.');
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLElement>('[data-volume-lens-object]')].some(root =>
    root.dataset.volumeLensObject !== 'omega-centauri' && getComputedStyle(root).display !== 'none' &&
    Number(getComputedStyle(root).opacity) > 0), null, { timeout: 30_000 });
  report.farContext = await contextVisibility();
  assert.ok((await contextVisibility()).overview.some(bank => bank.display !== 'none' && bank.opacity > 0),
    'Zooming out must restore the detailed galaxy context.');
  await focus();
  report.returnedContext = await assertCloseContext();
  report.rendering = await page.evaluate(() => ({
    totalElements: document.querySelectorAll('*').length,
    volumes: [...document.querySelectorAll<HTMLElement>('[data-volume-lens-object]')].map(root => ({
      id: root.dataset.volumeLensObject, display: getComputedStyle(root).display, opacity: getComputedStyle(root).opacity,
      elements: root.querySelectorAll('*').length, planes: root.querySelectorAll('.css-volume-mesh > s').length,
      stars: root.querySelectorAll('[data-catalogue-source]').length,
    })),
    galaxyOverview: [...document.querySelectorAll<HTMLElement>('[data-volume-opacity]')].map(root => ({
      opacity: root.dataset.volumeOpacity, display: getComputedStyle(root).display, elements: root.querySelectorAll('*').length,
    })),
  }));
  assert.equal(await page.evaluate(() => window.__cssEarth?.mountedObjectCount), 1);
  assert.equal(await page.locator('.planet-stage .polycss-camera').count(), 1);
  assert.deepEqual(errors, []); assert.deepEqual(failed, []);
  report.result = 'passed';
  console.log('OMEGA_NATIVE_FOCUS_PASSED', JSON.stringify({ cold: cold.projectedRadiusPixels, warm: warm.projectedRadiusPixels, zoomDistanceRadii: zoomed.distanceRadii }));
} catch (error) {
  report.result = 'failed'; report.failure = error instanceof Error ? error.message : String(error);
  if (await page.evaluate(() => !!window.__sun?.ready).catch(() => false)) report.failureState = await measure();
  throw error;
} finally {
  await writeFile(resolve(out, 'native-focus.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
