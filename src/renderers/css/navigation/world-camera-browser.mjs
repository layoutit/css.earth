// Real retained camera owner: full-pose adoption, input, resize and URL restore.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import PREPARED_MERCURY_SCENE from '../../../../src/planets/mercury/prepared/scene.json' with { type: 'json' };

const base = process.argv[2] ?? 'http://127.0.0.1:4211';
const directory = resolve('.local/world-camera-owner');
await mkdir(directory, { recursive: true });
const frame = PREPARED_MERCURY_SCENE.worldFrame;
assert.ok(frame, 'The checked-in Mercury preparation must supply its physical frame.');
const errors = [], report = {};
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });
const near = (a, b, tolerance = .0002) => {
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i] - b[i]) <= tolerance, `${a[i]} != ${b[i]}`);
};
function rotated([x, y, z, w], vector) {
  const [a, b, c] = vector, tx = 2 * (y * c - z * b), ty = 2 * (z * a - x * c), tz = 2 * (x * b - y * a);
  return [a + w * tx + y * tz - z * ty, b + w * ty + z * tx - x * tz, c + w * tz + x * ty - y * tx];
}
function withCentre(world, oldCentre, newCentre) {
  const shift = rotated(world.pose.orientationXyzw, newCentre.map((component, i) => (oldCentre[i] - component) * frame.metersPerUnit));
  return { ...world, pose: { ...world.pose, positionM: world.pose.positionM.map((component, i) => component + shift[i]) } };
}
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(new URL('/mercury/?owner-proof=1#physical', base).href, { waitUntil: 'networkidle' });
  await ready(page);
  const initial = await read(page);
  assert.ok(Math.abs(initial.camera.silhouetteRadius * 2 - 1440 * .36) < 1e-6,
    'Physical responsive framing must realize the requested36% viewport width.');
  report.initial = initial;
  const depth = initial.camera.distance / Math.hypot(1, ...initial.camera.principalOffset.map(value => value / initial.camera.focal));
  const initialCentre = [-initial.camera.principalOffset[0] * depth / initial.camera.focal,
    -initial.camera.principalOffset[1] * depth / initial.camera.focal, -depth];
  const centre = [initialCentre[0] + 250, initialCentre[1] - 80, initialCentre[2] - 100];
  const desired = withCentre(initial.world, initialCentre, centre);
  await apply(page, desired);
  const applied = await read(page);
  near(applied.world.pose.positionM, desired.pose.positionM);
  near(applied.world.pose.orientationXyzw, desired.pose.orientationXyzw, 1e-12);
  near(applied.camera.bodyCenterKilometers.map(value => value * 1000 / frame.metersPerUnit), centre, 1e-8);
  await assertMarkerCentre(page);
  report.applied = applied;

  // A world camera survives layout and optical changes without moving the eye.
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.waitForTimeout(250);
  const resized = await read(page);
  near(resized.world.pose.positionM, applied.world.pose.positionM);
  near(resized.world.pose.orientationXyzw, applied.world.pose.orientationXyzw, 1e-12);
  assert.equal(resized.camera.distance, applied.camera.distance);
  await assertMarkerCentre(page);
  report.resized = resized;

  // Pointer ownership resumes from the last matrix and centre, including roll.
  await page.mouse.move(950, 420);
  await page.mouse.down();
  const held = await read(page);
  near(held.world.pose.positionM, resized.world.pose.positionM);
  await page.mouse.move(1010, 465, { steps: 8 });
  await page.mouse.up();
  await settled(page);
  const dragged = await read(page);
  assert.notEqual(dragged.camera.pose.scene, resized.camera.pose.scene);
  near(dragged.camera.bodyCenterKilometers, resized.camera.bodyCenterKilometers, 1e-8);
  await page.mouse.move(960, 460);
  await page.mouse.wheel(0, 160);
  await settled(page);
  const wheeled = await read(page);
  assert.ok(wheeled.camera.distance > dragged.camera.distance);
  near(wheeled.camera.bodyCenterKilometers.map(value => value / wheeled.camera.distance),
    dragged.camera.bodyCenterKilometers.map(value => value / dragged.camera.distance), 1e-12);
  report.afterInput = wheeled;

  // The URL carries the translated observer, not a centred reconstruction.
  await page.waitForTimeout(250);
  assert.ok(new URL(page.url()).searchParams.get('v'));
  await page.reload({ waitUntil: 'networkidle' });
  await ready(page);
  const restored = await read(page);
  near(restored.world.pose.positionM, wheeled.world.pose.positionM, .01);
  near(restored.world.pose.orientationXyzw, wheeled.world.pose.orientationXyzw, 1e-11);
  near(restored.camera.bodyCenterKilometers, wheeled.camera.bodyCenterKilometers, 1e-8);
  assert.equal(new URL(page.url()).hash, '#physical');
  report.restored = restored;
  console.log('WORLD CAMERA: pose, resize, native input and v4 restore passed');

  // A legal observer just outside the surface must not fail input calibration.
  const nearCentre = [0, 0, -frame.bodyRadiusM / frame.metersPerUnit * 1.001];
  const currentCentre = restored.camera.bodyCenterKilometers.map(value => value * 1000 / frame.metersPerUnit);
  const closeWorld = withCentre(restored.world, currentCentre, nearCentre);
  await apply(page, closeWorld);
  const close = await read(page);
  near(close.world.pose.positionM, closeWorld.pose.positionM);
  assert.ok(Number.isFinite(close.camera.zoom) && close.camera.zoom > 0);
  assert.ok(Math.abs(close.camera.distance - Math.hypot(...nearCentre)) < 1e-8);
  report.nearSurface = close;
  await apply(page, restored.world);

  // Hidden bodies cannot leave stale marker targets or visible geometry.
  const behindCentre = [0, 0, 1500];
  const behind = withCentre(restored.world, currentCentre, behindCentre);
  await apply(page, behind);
  const hidden = await page.evaluate(() => ({ scene: document.querySelector('.mercury-scene').hidden,
    marker: document.querySelector('.mercury-body-marker').hidden }));
  assert.deepEqual(hidden, { scene: true, marker: true });
  await apply(page, restored.world);
  await assertMarkerCentre(page);
  assert.equal(await page.evaluate(() => window.__mercury.assertStableDomIdentity()), true);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: resolve(directory, 'translated-camera.png') });
  // Probe the actual hit targets at the event boundary. The router's flight
  // response has its own integration gate; capture prevents leaving this owner.
  await page.evaluate(() => {
    window.__ownerSelections = [];
    document.addEventListener('objectnavigate', event => {
      window.__ownerSelections.push(event.detail);
      event.stopPropagation();
    }, { capture: true });
    window.__mercury.camera.setState({ distance: 5e7,
      pose: { schema: 'cssearth-camera-pose@2', scene: 'matrix3d(-1,0,0,0,0,1,0,0,0,0,-1,0,0,0,0,1)' } });
  });
  const target = page.locator('.planet-heliocentric-body-target[data-body="venus"]');
  for (const locator of [target, page.locator('.mercury-caption[data-object-navigate="venus"]')]) {
    await locator.waitFor({ state: 'visible' });
    const bounds = await locator.boundingBox();
    assert.ok(bounds);
    await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  }
  assert.deepEqual(await page.evaluate(() => window.__ownerSelections), [{ objectId: 'venus' }, { objectId: 'venus' }]);
  await page.evaluate(() => window.__mercury.camera.setState({ distance: 1250 }));
  assert.equal(await target.evaluate(element => element.style.pointerEvents), 'none');
  await target.dispatchEvent('click');
  assert.equal(await page.evaluate(() => window.__ownerSelections.length), 2);
  assert.equal(await page.locator('.mercury-caption[data-object-navigate="venus"]').count(), 0);
  assert.equal(await page.evaluate(() => window.__mercury.assertStableDomIdentity()), true);
  report.bodySelection = 'visible marker/caption emit; hidden target and stale caption are inert';
  report.ok = true;
  console.log('WORLD CAMERA OWNER PASS: pose, resize, input, URL, near surface, retained DOM and body selection');
} finally {
  await writeFile(resolve(directory, 'report.json'), JSON.stringify({ ...report, errors }, null, 2));
  await browser.close();
}

async function ready(page) {
  await page.waitForFunction(() => window.__cssEarth?.ready === true && window.__mercury?.ready === true,
    null, { timeout: 30000 });
}
async function apply(page, world) {
  await page.evaluate(({ world, frame }) => window.__mercury.camera.applyWorldCamera(world, frame), { world, frame });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function read(page) {
  return page.evaluate(frame => { const camera = window.__mercury.camera.state(); return {
    camera: { ...camera, pose: camera.pose }, world: window.__mercury.camera.captureWorldCamera(frame),
  }; }, frame);
}
async function settled(page) {
  await page.waitForTimeout(700);
  await page.waitForFunction(() => {
    const state = window.__mercury.camera.stats().dragInertia;
    return !state.active && !state.wheelZoom.active;
  }, null, { timeout: 10000 });
}
async function assertMarkerCentre(page) {
  const measured = await page.evaluate(() => {
    const state = window.__mercury.camera.state(), root = document.querySelector('.mercury-camera').getBoundingClientRect();
    const marker = document.querySelector('.mercury-body-marker').getBoundingClientRect();
    const centre = state.bodyCenterKilometers, depth = -centre[2];
    return { actual: [marker.x + marker.width / 2, marker.y + marker.height / 2], expected: [
      root.x + root.width / 2 + state.principalOffset[0] + state.focal * centre[0] / depth,
      root.y + root.height / 2 + state.principalOffset[1] + state.focal * centre[1] / depth] };
  });
  near(measured.actual, measured.expected, .03);
}
