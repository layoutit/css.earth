import { createTestPage } from './browser-observations.mts';
import type { Page } from 'playwright';
import assert from 'node:assert/strict';
import { OBJECTS } from '../objects.mts';
import type { ObjectEntry } from '../object-schema.mts';
import { required } from './navigation-test-values.mts';

type Snapshot = Awaited<ReturnType<typeof read>>;
type SnapshotName = 'initial' | 'nearRotated' | 'heliosphere' | 'heliosphereRotated' | 'nearStars' | 'transition' | 'distantStars' | 'translated' | 'galaxy' | 'galaxyRotated' | 'returned';
declare global { interface Window {
  __environmentFrames: Record<string, ObjectEntry['worldFrame']>;
  __environmentNodes: Element[];
  __environmentFrameTimes: number[];
  __environmentTrackFrames: boolean;
} }
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { scrollToDistance as scrollTo } from './wheel-zoom-distance.mts';
import shell from '../../src/objects/heliosphere/prepared/shell.json' with { type: 'json' };
import volume from '../../src/objects/milky-way/prepared/volume.json' with { type: 'json' };
import worldContext from '../../src/planets/sun/prepared/world-context.json' with { type: 'json' };

const output = resolve(process.env.UNIVERSE_BROWSER_OUTPUT ?? '.local/universe-shared-sky');
const reportedView = '/mercury/?v=QMZBVmWEdTha6EHA0HFrNnyfwfqFzIA0Li5BQsczQAAAAL-57UJuUPUpP6TYXnEpHWy_4dF-IEqKvAABAAAAAAAAAAA';
const opacityProfile = worldContext.volume.opacityProfile;
const brightnessProfile = worldContext.volume.brightnessProfile;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome', headless: true });
const errors: string[] = [];
const snapshots: Partial<Record<SnapshotName, Snapshot>> & { rotationTiming?: Awaited<ReturnType<typeof drag>> } = {};
try {
  const page = await createTestPage(browser, { viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => performance.setResourceTimingBufferSize(10000));
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${process.argv[2] ?? 'http://127.0.0.1:4210'}${reportedView}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__mercury?.ready && window.__cssEarth?.ready, null, { timeout: 30000 });
  // A restored system-wide Mercury view automatically settles into Sun overview.
  // Wait for that handoff before starting a separate pointer gesture.
  await page.waitForFunction(() => window.__cssEarth?.activeObjectId === 'sun' && window.__sun?.ready, null, { timeout: 30000 });
  const motion = page.locator('input[name="motion"]');
  if (await motion.isChecked()) await motion.uncheck({ force: true });
  await page.evaluate(frames => { window.__environmentFrames = frames; },
    Object.fromEntries(OBJECTS.map(object => [object.id, object.worldFrame] as const)));
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
  assert.equal(snapshots.initial.volumeBrightness, brightnessProfile.nearOpacity);
  await page.screenshot({ path: resolve(output, 'mercury-reported.png') });
  await page.evaluate(() => { window.__environmentNodes = [...window.__cssearthTest.element('.prepared-universe').querySelectorAll('*')]; });
  await drag(page, 190, -95);
  snapshots.nearRotated = await read(page);
  assert.notEqual(snapshots.nearRotated.skyTransform, snapshots.initial.skyTransform, 'NASA sky follows shared drag rotation');
  await page.screenshot({ path: resolve(output, 'near-rotated.png') });
  await page.mouse.move(1010, 460);
  await scrollTo(page, 800 * 149597870.7);
  assert.equal(Number((await read(page)).shell.shellOpacity), 0, 'heliosphere stays off at shell distance by default');
  await page.locator('.planet-settings-action').click();
  await page.locator('.planet-settings label').filter({ hasText: 'Heliosphere' }).click();
  await page.locator('.planet-settings-action').click();
  snapshots.heliosphere = await read(page);
  assert.equal(Number(snapshots.heliosphere.shell.shellOpacity), 1);
  assert.ok(Number(snapshots.heliosphere.shell.shellVisibleFaces) > 0);
  await page.screenshot({ path: resolve(output, 'heliosphere.png') });
  await drag(page, 170, 120);
  snapshots.heliosphereRotated = await read(page);
  assert.notEqual(snapshots.heliosphereRotated.shellTransform, snapshots.heliosphere.shellTransform);
  await page.screenshot({ path: resolve(output, 'heliosphere-rotated.png') });
  await page.locator('.planet-settings-action').click();
  await page.locator('.planet-settings label').filter({ hasText: 'Heliosphere' }).click();
  assert.equal(Number((await read(page)).shell.shellOpacity), 0, 'disabling the shell updates a stationary camera');
  await page.locator('.planet-settings label').filter({ hasText: 'Heliosphere' }).click();
  await page.locator('.planet-settings-action').click();
  await scrollTo(page, shell.data.visibility.hiddenBeyondM * 1.01 / 1000);
  assert.equal(Number((await read(page)).shell.shellOpacity), 0, 'shell fades away beyond its prepared range');
  for (const [name, distance, opacity] of [
    ['nearStars', opacityProfile.fadeStartDistanceM / 2000, 0],
    ['transition', Math.sqrt(opacityProfile.fadeStartDistanceM * opacityProfile.fullDistanceM) / 1000, .5],
    ['distantStars', opacityProfile.fullDistanceM * 1.01 / 1000, 1],
  ] as const) {
    await scrollTo(page, distance);
    snapshots[name] = await read(page);
    assert.ok(Math.abs(snapshots[name].volumeOpacity - opacity) < 1e-6, `${name}: actual volume opacity follows prepared profile`);
    assert.equal(snapshots[name].skyVisibility, opacity < 1 ? 'visible' : 'hidden');
    assert.ok(Math.abs(snapshots[name].volumeCompositeOpacity - opacity * snapshots[name].volumeBrightness) < 1e-6);
    assert.ok(Math.abs((1 - snapshots[name].volumeCompositeOpacity) * snapshots[name].skyOpacity - (1 - opacity)) < 1e-6,
      'actual background composition preserves the prepared sky contribution');
    assert.equal(snapshots[name].volumeImageOpacity, 1, 'exposure no longer nests inside the handoff');
    await page.screenshot({ path: resolve(output, `${name}.png`) });
  }
  await scrollTo(page, Math.max(opacityProfile.fullDistanceM * 2, brightnessProfile.fadeStartDistanceM) / 1000);
  snapshots.translated = await read(page);
  assertPhysicalTranslation(required(snapshots.distantStars), snapshots.translated);
  await page.screenshot({ path: resolve(output, 'volume-translated.png') });
  await scrollTo(page, 1.2e18);
  await page.waitForTimeout(450);
  snapshots.galaxy = await read(page);
  assert.equal(snapshots.galaxy.volumeBrightness, brightnessProfile.fullOpacity, 'accepted exterior exposure is preserved');
  await page.screenshot({ path: resolve(output, 'milky-way.png') });
  snapshots.rotationTiming = await drag(page, -260, 210);
  await page.waitForTimeout(450);
  snapshots.galaxyRotated = await read(page);
  assert.notEqual(snapshots.galaxyRotated.volumeTransform, snapshots.galaxy.volumeTransform);
  await page.screenshot({ path: resolve(output, 'milky-way-rotated.png') });
  assert.equal(snapshots.galaxyRotated.roots, 1, 'one detailed object scene throughout');
  assert.equal(snapshots.galaxyRotated.preparedRequests, snapshots.initial.preparedRequests, 'images are ready before travel');
  assert.ok(await page.evaluate(() => window.__environmentNodes.every(node => node.isConnected)), 'travel retains environment DOM');
  assert.equal(new URL(page.url()).pathname, '/sun/');
  assert.equal(new URL(page.url()).searchParams.get('overview'), 'solar-system');
  const beforeEmpty = snapshots.galaxyRotated.camera;
  await page.mouse.dblclick(1280, 180);
  await settled(page);
  assert.deepEqual((await read(page)).camera, beforeEmpty, 'empty sky does not navigate');
  await scrollTo(page, 2e6);
  snapshots.returned = await read(page);
  assert.equal(Number(snapshots.returned.shell.shellOpacity), 0);
  assert.equal(snapshots.returned.roots, 1);
  assert.equal(snapshots.returned.volumeOpacity, 0);
  assert.ok([snapshots.initial, snapshots.transition, snapshots.distantStars, snapshots.returned]
    .every((snapshot, index) => Math.abs(required(snapshot).volumeOpacity - [0, .5, 1, 0][index]) < 1e-6), 'native round trip traverses the complete prepared handoff');
  assert.equal(snapshots.returned.skyVisibility, 'visible');
  assert.equal(snapshots.returned.camera.pose.scene, snapshots.galaxyRotated.camera.pose.scene, 'return preserves shared observer orientation');
  assert.equal(new URL(page.url()).searchParams.has('overview'), false, 'approaching the Sun restores its card');
  await page.screenshot({ path: resolve(output, 'sun-returned.png') });
  assert.deepEqual(errors, []);
  console.log('UNIVERSE_ENVIRONMENTS_PASSED reported Mercury view → heliosphere → NASA/volume transition → Milky Way → Sun; retained CSS scenes and decoded images.');
} finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ snapshots, errors }, null, 2));
  for (const context of browser.contexts()) await context.close();
  await browser.close();
}

async function settled(page: Page) {
  await page.waitForFunction(() => {
    const state = window.__cssearthTest.object().camera.stats().dragInertia;
    return !state.active && !state.wheelZoom.active;
  }, null, { timeout: 6000 });
  await page.waitForTimeout(80);
}

async function drag(page: Page, dx: number, dy: number) {
  await page.evaluate(() => {
    window.__environmentFrameTimes = []; window.__environmentTrackFrames = true; let previous: number | undefined;
    const frame = (time: number) => {
      if (previous !== undefined) window.__environmentFrameTimes.push(time - previous);
      previous = time;
      if (window.__environmentTrackFrames) requestAnimationFrame(frame);
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
    window.__environmentTrackFrames = false;
    const times = window.__environmentFrameTimes.slice(1).sort((a, b) => a - b);
    return { samples: times.length, medianMs: times[Math.floor(times.length / 2)], p95Ms: times[Math.floor(times.length * .95)], maxMs: times.at(-1) };
  });
}
async function read(page: Page) {
  return page.evaluate(() => ({
    url: location.href,
    distanceKm: window.__cssearthTest.object().camera.state().distanceKilometers,
    camera: window.__cssearthTest.object().camera.state(),
    world: window.__cssearthTest.object().camera.captureWorldCamera(window.__cssearthTest.required(window.__environmentFrames[window.__cssearthTest.scene().activeObjectId], 'current world frame')),
    roots: document.querySelectorAll('.polycss-camera').length,
    shell: { ...window.__cssearthTest.html('.prepared-surface-shell').dataset },
    shellFaces: document.querySelectorAll('[data-shell-face]').length,
    shellTransform: window.__cssearthTest.html('.prepared-surface-shell-scene').style.transform,
    volumeLeaves: document.querySelectorAll('.css-volume-mesh > s:nth-child(3n + 1)').length,
    volumeImages: document.querySelectorAll('.css-volume-mesh > s').length,
    volumeCopiesValid: [...document.querySelectorAll('.css-volume-mesh')].every(mesh => {
      const images = [...mesh.children].map(node => { if (!(node instanceof HTMLElement)) throw new Error('Volume image must be HTML.'); return node; });
      return images.length % 3 === 0 && images.every((node, index) => {
        const copy = index % 3, original = images[index - copy], alpha = Number(node.style.opacity);
        return node.style.transform === original.style.transform && node.style.backgroundImage === original.style.backgroundImage &&
          (copy === 0 ? node.style.opacity === '' : node.style.opacity !== '' && alpha >= 0 && alpha <= 1 &&
            node.style.opacity === images[copy].style.opacity);
      });
    }),
    volumeTransform: [...document.querySelectorAll<HTMLElement>('.css-volume-scene')].map(node => node.style.transform).join('|'),
    volumeMatrices: [...document.querySelectorAll<HTMLElement>('.css-volume-scene')].map(node => Array.from(new DOMMatrix(node.style.transform).toFloat64Array())),
    volumeOpacity: Number(window.__cssearthTest.html('.prepared-volume-context').dataset.volumeOpacity),
    volumeCompositeOpacity: Number(getComputedStyle(window.__cssearthTest.element('.prepared-volume-context')).opacity),
    volumeBrightness: Number(window.__cssearthTest.html('.prepared-volume-image').dataset.volumeBrightness),
    volumeImageOpacity: Number(getComputedStyle(window.__cssearthTest.element('.prepared-volume-image')).opacity),
    skyFaces: document.querySelectorAll('[data-sky-face]').length,
    skyOpacity: Number(getComputedStyle(window.__cssearthTest.element('.prepared-celestial-sky')).opacity),
    skyVisibility: getComputedStyle(window.__cssearthTest.element('.prepared-celestial-sky')).visibility,
    skyTransform: window.__cssearthTest.html('.prepared-celestial-sky-scene').style.transform,
    preparedRequests: performance.getEntriesByType('resource').filter(entry => /\/(heliosphere|milky-way)\/prepared\//.test(entry.name)).length,
  }));
}

function assertPhysicalTranslation(before: Snapshot, after: Snapshot) {
  for (const snapshot of [before, after]) {
    assert.equal(snapshot.skyVisibility, 'hidden', 'physical travel check must be entirely volume-owned');
    assert.equal(snapshot.volumeOpacity, 1);
    assert.equal(snapshot.roots, 1);
  }
  const a = before.world.pose.orientationXyzw, b = after.world.pose.orientationXyzw;
  const sign = a.reduce((sum, n, i) => sum + n * b[i], 0) < 0 ? -1 : 1;
  assert.ok(a.every((n, i) => Math.abs(n - sign * b[i]) < 1e-8), 'native dolly preserves physical orientation');
  const displacementM = Math.hypot(...after.world.pose.positionM.map((n, i) => n - before.world.pose.positionM[i]));
  assert.ok(displacementM > 0, 'the physical observer must actually translate');
  const expectedCssDisplacement = displacementM * 50 / volume.data.frame.metersPerUnit;
  before.volumeMatrices.forEach((matrix, axis) => {
    const translated = after.volumeMatrices[axis];
    for (let i = 0; i < 12; i++) assert.ok(Math.abs(translated[i] - matrix[i]) < 1e-8, 'fixed orientation preserves volume rotation');
    const actual = Math.hypot(...[12, 13, 14].map(i => translated[i] - matrix[i]));
    // Chrome serializes CSS transforms to fewer digits than the physical pose.
    assert.ok(Math.abs(actual - expectedCssDisplacement) < .02,
      'volume translation must equal the actual observer displacement in the prepared physical scale');
    assert.ok(actual > 1e-4, 'volume projection must change during travel, even with fixed orientation');
  });
}
