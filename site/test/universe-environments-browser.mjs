import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { wheelWithReceipt } from './wheel-zoom-distance.mjs';
import shell from '../../src/objects/heliosphere/prepared/shell.json' with { type: 'json' };
import volume from '../../src/objects/milky-way/prepared/volume.json' with { type: 'json' };

const output = resolve('.local/universe-environments');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome', headless: true });
const errors = [], snapshots = {};
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${process.argv[2] ?? 'http://127.0.0.1:4210'}/sun/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__sun?.ready && window.__cssEarth?.ready, null, { timeout: 30000 });
  const motion = page.locator('input[name="motion"]');
  if (await motion.isChecked()) await motion.uncheck({ force: true });
  snapshots.initial = await read(page);
  assert.equal(Number(snapshots.initial.shell.shellOpacity), 0, 'shell is hidden inside the Solar System');
  assert.equal(snapshots.initial.shellFaces, shell.data.faces.length);
  assert.equal(snapshots.initial.volumeLeaves, volume.data.stacks.flatMap(stack => stack.leaves).length);
  await page.evaluate(() => { window.__environmentNodes = [...document.querySelector('.prepared-universe').querySelectorAll('*')]; });
  await page.mouse.move(1010, 460);
  await scrollTo(page, 800 * 149597870.7);
  snapshots.heliosphere = await read(page);
  assert.equal(Number(snapshots.heliosphere.shell.shellOpacity), 1);
  assert.ok(Number(snapshots.heliosphere.shell.shellVisibleFaces) > 0);
  await page.screenshot({ path: resolve(output, 'heliosphere.png') });
  await drag(page, 170, 120);
  snapshots.heliosphereRotated = await read(page);
  assert.notEqual(snapshots.heliosphereRotated.shellTransform, snapshots.heliosphere.shellTransform);
  await page.screenshot({ path: resolve(output, 'heliosphere-rotated.png') });
  await scrollTo(page, shell.data.visibility.hiddenBeyondM * 1.01 / 1000);
  assert.equal(Number((await read(page)).shell.shellOpacity), 0, 'shell fades away beyond its prepared range');
  await scrollTo(page, 1.2e18);
  await page.waitForTimeout(450);
  snapshots.galaxy = await read(page);
  await page.screenshot({ path: resolve(output, 'milky-way.png') });
  await drag(page, -260, 210);
  await page.waitForTimeout(450);
  snapshots.galaxyRotated = await read(page);
  assert.notEqual(snapshots.galaxyRotated.volumeTransform, snapshots.galaxy.volumeTransform);
  await page.screenshot({ path: resolve(output, 'milky-way-rotated.png') });
  assert.equal(snapshots.galaxyRotated.roots, 1, 'one detailed object scene throughout');
  assert.equal(snapshots.galaxyRotated.preparedRequests, snapshots.initial.preparedRequests, 'images are ready before travel');
  assert.ok(await page.evaluate(() => window.__environmentNodes.every(node => node.isConnected)), 'travel retains environment DOM');
  assert.equal(new URL(page.url()).pathname, '/sun/');
  await scrollTo(page, snapshots.initial.distanceKm);
  snapshots.returned = await read(page);
  assert.equal(Number(snapshots.returned.shell.shellOpacity), 0);
  assert.equal(snapshots.returned.roots, 1);
  assert.deepEqual(errors, []);
  console.log('UNIVERSE_ENVIRONMENTS_PASSED Sun → heliosphere → Milky Way → Sun; retained CSS scenes and decoded images.');
} finally {
  await browser.close();
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ snapshots, errors }, null, 2));
}

async function settled(page) {
  await page.waitForFunction(() => {
    const state = window.__sun.camera.stats().dragInertia;
    return !state.active && !state.wheelZoom.active;
  }, null, { timeout: 6000 });
  await page.waitForTimeout(80);
}
async function scrollTo(page, targetKm) {
  for (let step = 0; step < 24; step++) {
    const distance = await page.evaluate(() => window.__sun.camera.state().distanceKilometers);
    if (Math.abs(distance / targetKm - 1) < 1e-6) return;
    await wheelWithReceipt(page, Math.max(-300, Math.min(300, Math.log(targetKm / distance) / .006)));
    await settled(page);
  }
  throw new Error(`Native wheel did not reach ${targetKm} km.`);
}
async function drag(page, dx, dy) {
  await page.mouse.move(910, 420); await page.mouse.down();
  await page.mouse.move(910 + dx, 420 + dy, { steps: 12 });
  await page.waitForTimeout(160); await page.mouse.up(); await settled(page);
}
async function read(page) {
  return page.evaluate(() => ({
    url: location.href,
    distanceKm: window.__sun.camera.state().distanceKilometers,
    roots: document.querySelectorAll('.polycss-camera').length,
    shell: { ...document.querySelector('.prepared-surface-shell').dataset },
    shellFaces: document.querySelectorAll('[data-shell-face]').length,
    shellTransform: document.querySelector('.prepared-surface-shell-scene').style.transform,
    volumeLeaves: document.querySelectorAll('[data-volume-slice]').length,
    volumeTransform: [...document.querySelectorAll('.css-volume-scene')].map(node => node.style.transform).join('|'),
    preparedRequests: performance.getEntriesByType('resource').filter(entry => /\/(heliosphere|milky-way)\/prepared\//.test(entry.name)).length,
  }));
}
