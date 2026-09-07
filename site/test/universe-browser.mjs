import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { wheelWithReceipt } from './wheel-zoom-distance.mjs';
import preparedVolume from '../../src/objects/milky-way/prepared/volume.json' with { type: 'json' };
import { OBJECTS } from '../objects.mjs';

const base = process.argv[2] ?? 'http://127.0.0.1:4210';
const output = resolve('.local/milky-way-integration');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome', headless: true });
const errors = [], checks = [], snapshots = {};
const check = (name, value) => { checks.push({ name, passed: Boolean(value) }); assert.ok(value, name); };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${base}/sun/`, { waitUntil: 'domcontentloaded' });
  await ready(page);
  const motion = page.locator('input[name="motion"]');
  if (await motion.isChecked()) await motion.uncheck({ force: true });
  snapshots.initial = await read(page);
  await page.screenshot({ path: resolve(output, 'sun-integrated.png') });
  check('one selected object with all prepared volume leaves ready', snapshots.initial.roots === 1 && snapshots.initial.slices === 288 && snapshots.initial.stable);
  check('detailed object and contextual layers share the same rendered focal length', await page.evaluate(() => {
    const root = document.querySelector('.polycss-camera');
    const cssFocal = parseFloat(getComputedStyle(root).perspective);
    const renderedFocal = cssFocal * root.getBoundingClientRect().width / root.offsetWidth;
    return Math.abs(renderedFocal - window.__sun.camera.state().focal) < 0.01;
  }));
  await page.evaluate(() => { window.__universeNodes = [...document.querySelector('.planet-stage').querySelectorAll('*')]; });
  const initialDistance = snapshots.initial.camera.distanceKilometers;
  const loadedBefore = await volumeRequests(page);
  await page.mouse.move(1010, 460);
  await scrollTo(page, 1e10);
  snapshots.system = await read(page);
  await page.screenshot({ path: resolve(output, 'solar-system-integrated.png') });
  check('scroll exposes real prepared solar-system orbits', snapshots.system.visibleOrbits > 100 && snapshots.system.scale === 'system');
  const objectLabels = await page.locator('[data-context-label]').evaluateAll(nodes => nodes.map(node => ({
    id: node.dataset.contextLabel, visible: getComputedStyle(node).visibility !== 'hidden' && Number(getComputedStyle(node).opacity) > 0,
  })));
  check('scene labels belong to prepared objects and remain visible at solar-system scale',
    objectLabels.some(label => label.visible) && objectLabels.every(label => OBJECTS.some(object => object.id === label.id)));
  check('contextual Sun overlaps the detailed object coordinate centre', await page.evaluate(() => {
    const body = document.querySelector('.polycss-camera').getBoundingClientRect();
    const marker = document.querySelector('[data-context-body="sun"]').getBoundingClientRect();
    return Math.hypot(marker.x + marker.width / 2 - body.x - body.width / 2,
      marker.y + marker.height / 2 - body.y - body.height / 2) < 0.1;
  }));
  const starRequestsBefore = await starRequests(page);
  await scrollTo(page, 3.085677581491367e13);
  await page.waitForTimeout(250);
  snapshots.stars = await read(page);
  await page.screenshot({ path: resolve(output, 'stellar-neighbourhood-integrated.png') });
  check('the complete catalogue feeds bounded exact-position star slots', snapshots.stars.starField.catalogueCount === 109389 &&
    snapshots.stars.starField.consideredCount === 109389 && snapshots.stars.starSlots === 4096 && Number(snapshots.stars.starField.visiblePoints) > 50 &&
    snapshots.stars.starField.individualPoints === snapshots.stars.starField.visiblePoints);
  check('the same galaxy volume remains visible inside the stellar neighbourhood', snapshots.stars.volumeOpacity === 1 && snapshots.initial.volumeOpacity === 1);
  check('background catalogue stars do not create labels for unavailable objects', await page.locator('.prepared-star-label').count() === 0);
  check('the incompatible photographic background is retired at solar scale', await page.locator('.prepared-context-sky-fade').evaluate(node => getComputedStyle(node).visibility === 'hidden'));
  const nearbyPositions = await starPositions(page);
  await scrollTo(page, 3.085677581491367e15);
  await page.waitForTimeout(250);
  snapshots.distantStars = await read(page);
  await page.screenshot({ path: resolve(output, 'stellar-neighbourhood-distant.png') });
  const distantPositions = await starPositions(page);
  check('catalogued stars change projection as the observer moves',
    Object.entries(nearbyPositions).some(([id, transform]) => distantPositions[id] && distantPositions[id] !== transform));
  check('stellar textures were ready before leaving the solar system', await starRequests(page) === starRequestsBefore);
  await scrollTo(page, 1.8e18);
  snapshots.galaxy = await read(page);
  await page.screenshot({ path: resolve(output, 'milky-way-integrated.png') });
  check('scroll reaches the prepared Milky Way without changing route', snapshots.galaxy.scale === 'galactic' && snapshots.galaxy.volumeOpacity === 1 && new URL(page.url()).pathname === '/sun/');
  check('scroll retains the original scene nodes', await page.evaluate(() => window.__universeNodes.every(node => node.isConnected)));
  check('galaxy textures were ready before the first scroll', await volumeRequests(page) === loadedBefore);
  check('volume uses accepted 3D CSS transforms', snapshots.galaxy.volumeTransforms.every(value => value.startsWith('matrix3d(')));
  check('prepared galactic Sun anchor shares the same physical projection', await page.evaluate(anchor => {
    const camera = document.querySelector('.css-volume-camera'), scene = document.querySelector('.css-volume-scene');
    const style = getComputedStyle(camera), rect = camera.getBoundingClientRect();
    const focal = parseFloat(style.perspective), [originX, originY] = style.perspectiveOrigin.split(' ').map(parseFloat);
    const point = new DOMPoint(anchor[1] * 50, anchor[0] * 50, anchor[2] * 50).matrixTransform(new DOMMatrix(getComputedStyle(scene).transform));
    const x = rect.x + originX + focal * (rect.width / 2 + point.x - originX) / (focal - point.z);
    const y = rect.y + originY + focal * (rect.height / 2 + point.y - originY) / (focal - point.z);
    const body = document.querySelector('.polycss-camera').getBoundingClientRect();
    return Math.hypot(x - body.x - body.width / 2, y - body.y - body.height / 2) < 0.1;
  }, preparedVolume.data.anchors.find(anchor => anchor.id === 'sun').positionUnits));

  const beforeEmpty = JSON.stringify(snapshots.galaxy.camera);
  await page.mouse.dblclick(1280, 180);
  await settled(page);
  check('double-clicking empty sky leaves the observer unchanged', JSON.stringify((await read(page)).camera) === beforeEmpty);
  await page.mouse.move(960, 490); await page.mouse.down();
  await page.mouse.move(1050, 560, { steps: 10 }); await page.waitForTimeout(180); await page.mouse.up();
  await settled(page);
  snapshots.rotated = await read(page);
  check('galaxy rotates through the existing shared input', snapshots.rotated.camera.pose.scene !== snapshots.galaxy.camera.pose.scene);
  await page.waitForFunction(() => new URLSearchParams(location.search).has('v'));
  await page.waitForTimeout(450);
  const savedUrl = page.url(), saved = await read(page);
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready(page); await settled(page);
  snapshots.restored = await read(page);
  check('compact URL restores galactic distance and rotation',
    close(snapshots.restored.camera.distanceKilometers, saved.camera.distanceKilometers) &&
    snapshots.restored.camera.pose.scene === saved.camera.pose.scene && snapshots.restored.volumeOpacity === 1);
  check('URL remains compact', new URL(savedUrl).searchParams.get('v').length <= 150);
  await page.mouse.move(1010, 460);
  await scrollTo(page, initialDistance);
  snapshots.returned = await read(page);
  await page.screenshot({ path: resolve(output, 'sun-returned.png') });
  check('scroll returns to the detailed Sun and the same galactic background', close(snapshots.returned.camera.distanceKilometers, initialDistance) && snapshots.returned.volumeOpacity === 1 && snapshots.returned.roots === 1 && snapshots.returned.stable);
  check('no browser errors throughout the journey', errors.length === 0);
  console.log(`UNIVERSE_BROWSER_PASSED ${checks.length} checks; Sun → solar system → Milky Way → Sun.`);
} finally {
  await browser.close();
  await writeFile(resolve(output, 'universe-report.json'), JSON.stringify({ checks, errors, snapshots }, null, 2));
}

async function ready(page) {
  await page.waitForFunction(() => window.__sun?.ready && window.__cssEarth?.ready && document.documentElement.dataset.ready === 'true', null, { timeout: 25000 });
}
async function settled(page) {
  await page.waitForFunction(() => {
    const state = window.__sun?.camera.stats().dragInertia;
    return state && !state.active && !state.wheelZoom.active;
  }, null, { timeout: 6000 });
  await page.waitForTimeout(80);
}
async function scrollTo(page, targetKilometers) {
  for (let step = 0; step < 40; step++) {
    const current = await page.evaluate(() => window.__sun.camera.state().distanceKilometers);
    if (close(current, targetKilometers)) return;
    const delta = Math.log(targetKilometers / current) / 0.006;
    await wheelWithReceipt(page, Math.max(-300, Math.min(300, delta)));
    await settled(page);
  }
  throw new Error(`Scroll failed to reach ${targetKilometers} km.`);
}
function close(a, b) { return Math.abs(a / b - 1) < 1e-6; }
async function volumeRequests(page) {
  return page.evaluate(() => performance.getEntriesByType('resource').filter(entry => entry.name.includes('/milky-way/prepared/slices/')).length);
}
async function starRequests(page) {
  return page.evaluate(() => performance.getEntriesByType('resource').filter(entry => entry.name.includes('/stellar-neighbourhood/prepared/')).length);
}
async function starPositions(page) {
  return page.evaluate(() => Object.fromEntries(window.__cssEarthUniverse.inspect().stars.points
    .filter(({ element, reference }) => reference && element.style.visibility !== 'hidden')
    .map(({ element, reference }) => [reference, element.style.transform])));
}
async function read(page) {
  return page.evaluate(() => ({
    camera: window.__sun.camera.state(),
    scale: document.querySelector('.planet-stage').dataset.contextScale,
    roots: document.querySelectorAll('.polycss-camera').length,
    slices: document.querySelectorAll('.css-volume-mesh > s').length,
    stable: window.__sun.assertStableDomIdentity(),
    starField: (({ points, ...stats }) => stats)(window.__cssEarthUniverse.inspect().stars),
    starSlots: document.querySelectorAll('.prepared-point-field-stars > s').length,
    volumeOpacity: Number(document.querySelector('.prepared-volume-context').dataset.volumeOpacity),
    volumeTransforms: [...document.querySelectorAll('.css-volume-scene')].map(node => getComputedStyle(node).transform),
    visibleOrbits: window.__cssEarthUniverse.inspect().bodies.flatMap(body => body.orbit).filter(node => getComputedStyle(node).visibility !== 'hidden').length,
  }));
}
