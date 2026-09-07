import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { wheelWithReceipt } from './wheel-zoom-distance.mjs';
import shell from '../../src/objects/heliosphere/prepared/shell.json' with { type: 'json' };
import volume from '../../src/objects/milky-way/prepared/volume.json' with { type: 'json' };

const output = resolve('.local/universe-shared-sky');
const reportedView = '/mercury/?v=QMZBVmWEdTha6EHA0HFrNnyfwfqFzIA0Li5BQsczQAAAAL-57UJuUPUpP6TYXnEpHWy_4dF-IEqKvAABAAAAAAAAAAA';
const parsecKm = 3.085677581491367e13;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome', headless: true });
const errors = [], snapshots = {};
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => performance.setResourceTimingBufferSize(10000));
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${process.argv[2] ?? 'http://127.0.0.1:4210'}${reportedView}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__mercury?.ready && window.__cssEarth?.ready, null, { timeout: 30000 });
  const motion = page.locator('input[name="motion"]');
  if (await motion.isChecked()) await motion.uncheck({ force: true });
  snapshots.initial = await read(page);
  assert.equal(Number(snapshots.initial.shell.shellOpacity), 0, 'shell is hidden inside the Solar System');
  assert.equal(snapshots.initial.shellFaces, shell.data.faces.length);
  assert.equal(snapshots.initial.volumeLeaves, volume.data.stacks.flatMap(stack => stack.leaves).length);
  assert.equal(snapshots.initial.volumeImages, snapshots.initial.volumeLeaves * 3);
  assert.ok(snapshots.initial.volumeCopiesValid, 'each prepared slab owns three identical retained image planes');
  assert.equal(snapshots.initial.skyFaces, 6, 'the NASA sky must be mounted in the actual shared view');
  assert.equal(snapshots.initial.skyVisibility, 'visible');
  assert.equal(snapshots.initial.skyOpacity, 1, 'the nearby background is opaque');
  assert.equal(snapshots.initial.volumeOpacity, 0, 'the nearby view must not composite bright volume haze');
  assert.equal(snapshots.initial.volumeBrightness, .25);
  await page.screenshot({ path: resolve(output, 'mercury-reported.png') });
  await page.evaluate(() => { window.__environmentNodes = [...document.querySelector('.prepared-universe').querySelectorAll('*')]; });
  await drag(page, 190, -95);
  snapshots.nearRotated = await read(page);
  assert.notEqual(snapshots.nearRotated.skyTransform, snapshots.initial.skyTransform, 'NASA sky follows shared drag rotation');
  await page.screenshot({ path: resolve(output, 'near-rotated.png') });
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
  for (const [name, distance, opacity] of [['nearStars', .1 * parsecKm, 0], ['transition', Math.sqrt(1000) * parsecKm, .5], ['distantStars', 1001 * parsecKm, 1]]) {
    await scrollTo(page, distance);
    snapshots[name] = await read(page);
    assert.ok(Math.abs(snapshots[name].volumeOpacity - opacity) < 1e-6, `${name}: actual volume opacity follows prepared profile`);
    assert.equal(snapshots[name].skyVisibility, opacity < 1 ? 'visible' : 'hidden');
    assert.equal(snapshots[name].skyOpacity, 1, 'crossfade must keep the background opaque');
    await page.screenshot({ path: resolve(output, `${name}.png`) });
  }
  await scrollTo(page, 1.2e18);
  await page.waitForTimeout(450);
  snapshots.galaxy = await read(page);
  assert.equal(snapshots.galaxy.volumeBrightness, 1, 'accepted exterior exposure is preserved');
  await page.screenshot({ path: resolve(output, 'milky-way.png') });
  snapshots.rotationTiming = await drag(page, -260, 210);
  await page.waitForTimeout(450);
  snapshots.galaxyRotated = await read(page);
  assert.notEqual(snapshots.galaxyRotated.volumeTransform, snapshots.galaxy.volumeTransform);
  await page.screenshot({ path: resolve(output, 'milky-way-rotated.png') });
  assert.equal(snapshots.galaxyRotated.roots, 1, 'one detailed object scene throughout');
  assert.equal(snapshots.galaxyRotated.preparedRequests, snapshots.initial.preparedRequests, 'images are ready before travel');
  assert.ok(await page.evaluate(() => window.__environmentNodes.every(node => node.isConnected)), 'travel retains environment DOM');
  assert.equal(new URL(page.url()).pathname, '/mercury/');
  const beforeEmpty = snapshots.galaxyRotated.camera;
  await page.mouse.dblclick(1280, 180);
  await settled(page);
  assert.deepEqual((await read(page)).camera, beforeEmpty, 'empty sky does not navigate');
  await scrollTo(page, snapshots.initial.distanceKm);
  snapshots.returned = await read(page);
  assert.equal(Number(snapshots.returned.shell.shellOpacity), 0);
  assert.equal(snapshots.returned.roots, 1);
  assert.equal(snapshots.returned.volumeOpacity, 0);
  assert.equal(snapshots.returned.skyVisibility, 'visible');
  assert.equal(snapshots.returned.camera.pose.scene, snapshots.galaxyRotated.camera.pose.scene, 'return preserves shared observer orientation');
  await page.screenshot({ path: resolve(output, 'mercury-returned.png') });
  assert.deepEqual(errors, []);
  console.log('UNIVERSE_ENVIRONMENTS_PASSED reported Mercury view → heliosphere → NASA/volume transition → Milky Way → Mercury; retained CSS scenes and decoded images.');
} finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ snapshots, errors }, null, 2));
  for (const context of browser.contexts()) await context.close();
  await browser.close();
}

async function settled(page) {
  await page.waitForFunction(() => {
    const state = window.__mercury.camera.stats().dragInertia;
    return !state.active && !state.wheelZoom.active;
  }, null, { timeout: 6000 });
  await page.waitForTimeout(80);
}
async function scrollTo(page, targetKm) {
  for (let step = 0; step < 24; step++) {
    const distance = await page.evaluate(() => window.__mercury.camera.state().distanceKilometers);
    if (Math.abs(distance / targetKm - 1) < 1e-6) return;
    await wheelWithReceipt(page, Math.max(-300, Math.min(300, Math.log(targetKm / distance) / .006)));
    await settled(page);
  }
  throw new Error(`Native wheel did not reach ${targetKm} km.`);
}
async function drag(page, dx, dy) {
  await page.evaluate(() => {
    window.__frameTimes = []; window.__trackFrames = true; let previous;
    const frame = time => {
      if (previous !== undefined) window.__frameTimes.push(time - previous);
      previous = time;
      if (window.__trackFrames) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  await page.mouse.move(910, 420); await page.mouse.down();
  for (let step = 1; step <= 30; step++) {
    await page.mouse.move(910 + dx * step / 30, 420 + dy * step / 30);
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(160); await page.mouse.up(); await settled(page);
  return page.evaluate(() => {
    window.__trackFrames = false;
    const times = window.__frameTimes.slice(1).sort((a, b) => a - b);
    return { samples: times.length, medianMs: times[Math.floor(times.length / 2)], p95Ms: times[Math.floor(times.length * .95)], maxMs: times.at(-1) };
  });
}
async function read(page) {
  return page.evaluate(() => ({
    url: location.href,
    distanceKm: window.__mercury.camera.state().distanceKilometers,
    camera: window.__mercury.camera.state(),
    roots: document.querySelectorAll('.polycss-camera').length,
    shell: { ...document.querySelector('.prepared-surface-shell').dataset },
    shellFaces: document.querySelectorAll('[data-shell-face]').length,
    shellTransform: document.querySelector('.prepared-surface-shell-scene').style.transform,
    volumeLeaves: document.querySelectorAll('.css-volume-mesh > s:nth-child(3n + 1)').length,
    volumeImages: document.querySelectorAll('.css-volume-mesh > s').length,
    volumeCopiesValid: [...document.querySelectorAll('.css-volume-mesh')].every(mesh => {
      const images = [...mesh.children];
      return images.length % 3 === 0 && images.every((node, index) => {
        const original = images[index - index % 3];
        return node.style.transform === original.style.transform && node.style.backgroundImage === original.style.backgroundImage &&
          node.style.opacity === (index % 3 ? `var(--volume-optical-copy-${index % 3}, 0)` : '');
      });
    }),
    volumeTransform: [...document.querySelectorAll('.css-volume-scene')].map(node => node.style.transform).join('|'),
    volumeOpacity: Number(getComputedStyle(document.querySelector('.prepared-volume-context')).opacity),
    volumeBrightness: Number(getComputedStyle(document.querySelector('.prepared-volume-image')).opacity),
    skyFaces: document.querySelectorAll('[data-sky-face]').length,
    skyOpacity: Number(getComputedStyle(document.querySelector('.prepared-celestial-sky')).opacity),
    skyVisibility: getComputedStyle(document.querySelector('.prepared-celestial-sky')).visibility,
    skyTransform: document.querySelector('.prepared-celestial-sky-scene').style.transform,
    preparedRequests: performance.getEntriesByType('resource').filter(entry => /\/(heliosphere|milky-way)\/prepared\//.test(entry.name)).length,
  }));
}
