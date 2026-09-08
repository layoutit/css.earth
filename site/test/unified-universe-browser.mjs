// Native navigation/picking/wheel acceptance over one retained physical universe.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { wheelWithReceipt } from './wheel-zoom-distance.mjs';
import preparedVolume from '../../src/objects/milky-way/prepared/volume.json' with { type: 'json' };

const origin = process.argv[2] ?? process.env.CSSEARTH_TEST_ORIGIN ?? 'http://localhost:4210';
const output = '.local/unified-universe-browser';
const routes = ['sun', 'mercury', 'venus'];
const pickingOnly = process.argv.includes('--picking');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome', headless: true });
const report = { mode: pickingOnly ? 'picking' : 'full', flights: [], zooms: [], registration: [], errors: [], documentRequests: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) report.documentRequests.push(request.url()); });
  await page.goto(`${origin}/sun/`, { waitUntil: 'domcontentloaded' });
  await ready(page, 'sun');
  await page.evaluate(async () => {
    const { OBJECTS } = await import('/site/objects.mjs');
    const selectors = ['.planet-stage', '.planet-sidebar', '.planet-input-surface', '.prepared-universe', '.prepared-volume-context', '.prepared-point-field', '.prepared-world-context'];
    const roots = selectors.map(selector => document.querySelector(selector));
    if (roots.some(root => !root)) throw new Error('All universe and shell roots must exist before first interaction.');
    const probe = window.__unifiedProof = {
      document, timeOrigin: performance.timeOrigin, selectors, roots,
      universe: [roots[3], ...roots[3].querySelectorAll('*')],
      frames: Object.fromEntries(OBJECTS.filter(object => object.worldFrame).map(object => [object.id, object.worldFrame])),
      samples: [], events: [], running: true,
    };
    probe.capture = () => {
      const id = window.__cssEarth.activeObjectId;
      return window[`__${id}`]?.camera.captureWorldCamera(probe.frames[id]);
    };
    document.addEventListener('objectnavigate', event => probe.events.push(event.detail.objectId), { capture: true });
    const sample = () => {
      if (!probe.running) return;
      const id = window.__cssEarth?.activeObjectId, diagnostic = window[`__${id}`];
      probe.samples.push({ time: performance.now(), id, roots: document.querySelectorAll('.polycss-camera').length,
        world: diagnostic?.camera.captureWorldCamera(probe.frames[id]),
        materialReady: diagnostic?.runtime.selection().ready,
        pending: diagnostic?.renderStats.textureStats.pendingInteractiveImageCount });
      requestAnimationFrame(sample);
    };
    sample();
  });
  await pauseMotion(page);
  const initialResources = await backgroundRequests(page);
  let commonWorld;
  for (const id of pickingOnly ? [] : routes) {
    if (id !== 'sun') await flight(page, id, 'nav');
    const closeView = await capture(page);
    const initialDistance = await distance(page);
    await page.mouse.move(1010, 460);
    if (id === 'sun') {
      const close = await sunPoint(page);
      assert.equal(close.visibility, 'hidden', 'close photosphere owns the resolved Sun disc');
      await scrollTo(page, 1e10);
      const far = await sunPoint(page);
      assert.notEqual(far.visibility, 'hidden', 'distant Sun remains a visible point');
      assert.ok(far.opacity > 0.1 && far.width > far.physicalDiameter && far.background.includes('point-atlas'),
        'far Sun uses the prepared stellar PSF and retains unresolved brightness');
      report.sunHandoff = { close, far };
      await page.screenshot({ path: `${output}/sun-far-point.png` });
    }
    await scrollTo(page, 1.8e18);
    const galactic = await snapshot(page);
    assert.equal(galactic.scale, 'galactic', `${id}: native wheel reaches galaxy`);
    assert.equal(galactic.volumeOpacity, 1);
    assert.equal(galactic.path, `/${id}/`);
    sameOrientation(galactic.world, closeView, `${id}: dolly preserves physical orientation`);
    assert.deepEqual(await backgroundRequests(page), initialResources, `${id}: all background images ready before zoom`);
    assertRetained(galactic, id);
    await page.screenshot({ path: `${output}/${id}-galaxy.png` });
    await emptyDoubleClick(page, id);
    // Use exactly the same Sun-ICRF observer to expose route-dependent frame or
    // background calibration. This arranges a measurement; travel itself stays native.
    if (!commonWorld) {
      await scrollTo(page, 3.085677581491367e13);
      commonWorld = await capture(page);
    } else await applyWorld(page, commonWorld);
    await page.waitForTimeout(650);
    const registered = await backgroundProjection(page);
    assert.ok(Object.keys(registered.stars).length > 10, 'common observer sees actual catalogue stars');
    if (report.registration.length) sameProjection(registered, report.registration[0].projection, id);
    report.registration.push({ id, projection: registered });
    // Restore the measured galactic endpoint, then traverse the entire distance
    // back through the native wheel owner (no diagnostic jump to close detail).
    await applyWorld(page, galactic.world);
    await scrollTo(page, initialDistance);
    const returned = await snapshot(page);
    assertRetained(returned, id);
    samePose(returned.world, closeView, `${id}: round trip`);
    assert.equal(returned.pending, 0, `${id}: detail already decoded on arrival`);
    assert.equal(returned.materialReady, true);
    if (id === 'sun') assert.equal((await sunPoint(page)).visibility, 'hidden', 'return restores photosphere ownership');
    report.zooms.push({ id, initialDistance, galactic, returned });
    console.log(`UNIFIED ZOOM PASS ${id}: native wheel, retained universe, matching physical orientation`);
  }
  if (!pickingOnly) await flight(page, 'sun', 'nav');
  for (const id of ['mercury', 'venus', 'sun']) {
    await flight(page, id, 'pick');
    await refocus(page, id);
  }
  const final = await snapshot(page);
  assertRetained(final, 'final');
  assert.equal(report.documentRequests.length, 1, 'all six selections retain one document');
  // Replacing a retained leaf with an identical-looking node must turn the
  // identity assertion red; a count-only test would incorrectly accept this.
  await page.evaluate(() => {
    const node = document.querySelector('.css-volume-mesh > s');
    const replacement = node.cloneNode(true);
    window.__unifiedLeafMutation = { node, replacement };
    node.replaceWith(replacement);
  });
  try {
    report.retentionMutant = await snapshot(page);
    assert.throws(() => assertRetained(report.retentionMutant, 'mutation'), /original universe nodes/);
  } finally {
    await page.evaluate(() => {
      const { node, replacement } = window.__unifiedLeafMutation;
      replacement.replaceWith(node); delete window.__unifiedLeafMutation;
    });
  }
  assertRetained(await snapshot(page), 'mutation restoration');
  assert.deepEqual(report.errors, []);
  console.log(pickingOnly
    ? 'UNIFIED_UNIVERSE_PICKING_PASSED: three native rendered-target flights and retained-identity mutation.'
    : 'UNIFIED_UNIVERSE_BROWSER_PASSED: six native flights; three galaxy round trips; one retained universe and detailed scene.');
} finally {
  await browser.close();
  await writeFile(`${output}/${pickingOnly ? 'picking-report' : 'report'}.json`, JSON.stringify(report, null, 2));
}

async function ready(page, id) {
  await page.waitForFunction(id => {
    if (window.__cssEarth?.error) throw new Error(window.__cssEarth.error);
    return window.__cssEarth?.ready && window.__cssEarth.activeObjectId === id && window[`__${id}`]?.ready;
  }, id, { timeout: 60000 });
}
async function pauseMotion(page) {
  const input = page.locator('input[name="motion"]');
  if (await input.count() && await input.isChecked()) await input.uncheck({ force: true });
}
async function capture(page) { return page.evaluate(() => window.__unifiedProof.capture()); }
async function distance(page) { return page.evaluate(() => window[`__${window.__cssEarth.activeObjectId}`].camera.state().distanceKilometers); }
async function applyWorld(page, world) {
  await page.evaluate(world => {
    const id = window.__cssEarth.activeObjectId;
    window[`__${id}`].camera.applyWorldCamera(world, window.__unifiedProof.frames[id]);
  }, world);
}
async function snapshot(page) {
  return page.evaluate(() => {
    const probe = window.__unifiedProof, id = window.__cssEarth.activeObjectId, diagnostic = window[`__${id}`];
    return { id, path: location.pathname, world: probe.capture(), scale: document.querySelector('.planet-stage').dataset.contextScale,
      roots: document.querySelectorAll('.polycss-camera').length,
      sameDocument: probe.document === document && probe.timeOrigin === performance.timeOrigin,
      retained: probe.selectors.every((selector, i) => document.querySelector(selector) === probe.roots[i]) && probe.universe.every(node => node.isConnected),
      slices: document.querySelectorAll('.css-volume-mesh > s').length,
      slots: document.querySelectorAll('.prepared-point-field-block > s').length,
      volumeOpacity: Number(document.querySelector('.prepared-volume-context').dataset.volumeOpacity),
      materialReady: diagnostic.runtime.selection().ready,
      pending: diagnostic.renderStats.textureStats.pendingInteractiveImageCount };
  });
}
function assertRetained(value, label) {
  assert.equal(value.sameDocument, true, `${label}: one document`);
  assert.equal(value.retained, true, `${label}: original universe nodes remain connected`);
  assert.equal(value.roots, 1, `${label}: exactly one detailed scene`);
  assert.equal(value.slices, preparedVolume.data.stacks.flatMap(stack => stack.leaves).length * 3);
  assert.equal(value.slots, 4096);
}
async function flight(page, to, mode) {
  const from = await page.evaluate(() => window.__cssEarth.activeObjectId);
  const pick = mode === 'pick' ? await visibleMarker(page, to) : null;
  if (mode === 'nav') await page.locator('.planet-sidebar-search').fill(to);
  const before = await page.evaluate(() => ({ index: window.__unifiedProof.samples.length, events: window.__unifiedProof.events.length, time: performance.now() }));
  if (pick) await page.mouse.dblclick(pick.x, pick.y, { delay: 90 });
  else await page.locator(`.planet-object-link[data-object-id="${to}"]`).click();
  try {
    if (pick) await page.waitForFunction(count => window.__unifiedProof.events.length > count,
      before.events, { timeout: 2000 });
    await ready(page, to);
  } catch (error) {
    report.failedFlight = { from, to, mode, pick, state: await snapshot(page),
      events: await page.evaluate(() => window.__unifiedProof.events) };
    await page.screenshot({ path: `${output}/failed-${mode}-${from}-${to}.png` });
    throw error;
  }
  if (mode === 'nav') await page.locator('.planet-sidebar-search').fill('');
  await pauseMotion(page);
  const arrived = await snapshot(page);
  assertRetained(arrived, `${from} → ${to}`);
  assert.equal(arrived.materialReady, true);
  assert.equal(arrived.pending, 0);
  const trace = await page.evaluate(before => ({ samples: window.__unifiedProof.samples.slice(before.index),
    events: window.__unifiedProof.events.slice(before.events), durationMs: performance.now() - before.time }), before);
  assert.ok(trace.samples.length > 20, 'flight paints intermediate frames');
  assert.ok(trace.samples.every(sample => sample.roots <= 1), 'no overlapping detailed scenes in flight');
  const destination = trace.samples.filter(sample => sample.id === to && sample.world);
  assert.ok(destination.length > 0);
  assert.ok(destination.every(sample => sample.pending === 0), 'destination bank decoded before its first painted approach frame');
  const poses = trace.samples.filter(sample => sample.world);
  for (let i = 1; i < poses.length; i++) {
    const a = poses[i - 1].world.pose.orientationXyzw, b = poses[i].world.pose.orientationXyzw;
    const angle = 2 * Math.acos(Math.min(1, Math.abs(a.reduce((sum, value, axis) => sum + value * b[axis], 0))));
    assert.ok(angle < 0.2, `continuous physical orientation through handoff (${angle} radians)`);
  }
  if (pick) assert.deepEqual(trace.events, [to], 'rendered target selects exactly once');
  report.flights.push({ from, to, mode, pick, arrived, ...trace });
  await page.screenshot({ path: `${output}/${mode}-${from}-${to}.png` });
  console.log(`UNIFIED FLIGHT PASS ${mode} ${from} → ${to}: ${trace.samples.length} frames`);
}
async function refocus(page, id) {
  const pick = await visibleMarker(page, id);
  const before = await page.evaluate(() => ({ events: window.__unifiedProof.events.length,
    samples: window.__unifiedProof.samples.length }));
  await page.evaluate(() => { window.__selectedDetailProof = document.querySelector('.polycss-camera'); });
  await page.mouse.dblclick(pick.x, pick.y, { delay: 90 });
  await page.waitForFunction(({ id, distanceKilometers }) => window.__cssEarth.activeObjectId === id &&
    window[`__${id}`].camera.state().distanceKilometers < distanceKilometers / 50 &&
    window.__cssEarth.playback.reason !== 'unavailable', { id, distanceKilometers: pick.distanceKilometers }, { timeout: 30000 });
  const result = await page.evaluate(before => ({
    sameDetail: document.querySelector('.polycss-camera') === window.__selectedDetailProof,
    events: window.__unifiedProof.events.slice(before.events),
    samples: window.__unifiedProof.samples.length - before.samples,
  }), before);
  assert.equal(result.sameDetail, true, `${id}: same-object focus retains its detailed renderer`);
  assert.deepEqual(result.events, [id], `${id}: native double-click selects once`);
  assert.ok(result.samples > 20, `${id}: refocus paints intermediate frames`);
  assertRetained(await snapshot(page), `${id} refocus`);
  report.refocuses ??= []; report.refocuses.push({ id, pick, ...result });
  console.log(`UNIFIED REFOCUS PASS ${id}: native double-click returns to retained detail`);
}

async function visibleMarker(page, to) {
  for (const distanceKilometers of [1e8, 3e8, 8e8]) for (let yaw = 0; yaw < 360; yaw += 30) {
    const found = await page.evaluate(({ to, distanceKilometers, yaw }) => {
      const diagnostic = window[`__${window.__cssEarth.activeObjectId}`];
      diagnostic.camera.setState({ distanceKilometers,
        pose: { schema: 'cssearth-camera-pose@2', scene: new DOMMatrix().rotateAxisAngle(1, 0, 0, 35).rotateAxisAngle(0, 1, 0, yaw).toString() } });
      const targets = [...document.querySelectorAll(`[data-object-navigate="${to}"],.planet-heliocentric-body-target[data-body="${to}"]`)];
      for (const target of targets) {
        const style = getComputedStyle(target), rect = target.getBoundingClientRect();
        const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
        if (target.hidden || style.visibility === 'hidden' || style.pointerEvents === 'none' || Number(style.opacity) === 0 ||
          x < 390 || x > innerWidth - 60 || y < 80 || y > innerHeight - 80) continue;
        if (!document.elementFromPoint(x, y)?.closest('.planet-input-surface')) continue;
        return { x, y, yaw, distanceKilometers };
      }
      return null;
    }, { to, distanceKilometers, yaw });
    if (found) return found;
  }
  throw new Error(`No rendered selectable ${to} target in the shared physical context.`);
}
async function emptyDoubleClick(page, id) {
  const point = await page.evaluate(() => {
    for (const [x, y] of [[1280, 180], [1200, 720], [500, 150]]) {
      if (!document.elementFromPoint(x, y)?.closest('.planet-input-surface')) continue;
      if (document.elementsFromPoint(x, y).some(node => node.dataset?.objectNavigate && getComputedStyle(node).pointerEvents === 'auto')) continue;
      return { x, y };
    }
    return null;
  });
  assert.ok(point, 'blank native input point exists');
  const before = await capture(page), count = await page.evaluate(() => window.__unifiedProof.events.length);
  await page.mouse.dblclick(point.x, point.y, { delay: 65 });
  await page.waitForTimeout(650);
  samePose(await capture(page), before, `${id}: empty double-click is inert`);
  assert.equal(await page.evaluate(() => window.__unifiedProof.events.length), count);
}
async function settled(page) {
  await page.waitForFunction(() => {
    const stats = window[`__${window.__cssEarth.activeObjectId}`]?.camera.stats().dragInertia;
    return stats && !stats.active && !stats.wheelZoom.active;
  }, null, { timeout: 6000 });
}
async function scrollTo(page, target) {
  for (let i = 0; i < 45; i++) {
    const current = await distance(page);
    if (Math.abs(current / target - 1) < 1e-6) return;
    const step = await page.evaluate(() => window[`__${window.__cssEarth.activeObjectId}`].camera.stats().dolly.wheelStepPerDelta);
    await wheelWithReceipt(page, Math.max(-300, Math.min(300, Math.log(target / current) / step)));
    await settled(page);
  }
  throw new Error(`Native wheel failed to reach ${target} km.`);
}
async function backgroundRequests(page) {
  return page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name)
    .filter(name => name.includes('/milky-way/prepared/') || name.includes('/stellar-neighbourhood/prepared/')).sort());
}
async function backgroundProjection(page) {
  return page.evaluate(() => ({
    volume: [...document.querySelectorAll('.css-volume-scene')].map(node => {
      const matrix = new DOMMatrix(getComputedStyle(node).transform);
      // Translation depends on the observer; compare it too at this fixed world pose.
      return Array.from(matrix.toFloat64Array());
    }),
    sky: Array.from(new DOMMatrix(getComputedStyle(document.querySelector('.prepared-celestial-sky-scene')).transform).toFloat64Array()),
    stars: Object.fromEntries(window.__cssEarthUniverse.inspect().stars.points
      .filter(({ element, reference }) => reference && element.style.visibility !== 'hidden' && Number(element.style.opacity) > 0)
      .map(({ element, reference }) => [reference, element.style.transform])),
  }));
}
function sameProjection(actual, expected, id) {
  actual.sky.forEach((value, i) => assert.ok(Math.abs(value - expected.sky[i]) < .001, `${id}: same world observer gives the same celestial sky matrix`));
  assert.equal(actual.volume.length, expected.volume.length);
  actual.volume.forEach((matrix, axis) => matrix.forEach((value, i) => {
    assert.ok(Math.abs(value - expected.volume[axis][i]) < 0.001, `${id}: same world observer gives the same galaxy matrix`);
  }));
  const shared = Object.keys(actual.stars).filter(key => expected.stars[key]);
  assert.ok(shared.length > 10, `${id}: shared actual stars visible`);
  for (const key of shared) assert.equal(actual.stars[key], expected.stars[key], `${id}: ${key} physical projection`);
}
function sameOrientation(actual, expected, label) {
  assert.equal(actual.referenceFrame, expected.referenceFrame);
  assert.equal(actual.epochJdTt, expected.epochJdTt);
  const a = actual.pose.orientationXyzw, b = expected.pose.orientationXyzw;
  const sign = a.reduce((sum, value, i) => sum + value * b[i], 0) < 0 ? -1 : 1;
  assert.ok(a.every((value, i) => Math.abs(value - sign * b[i]) < 1e-8), label);
}
function samePose(actual, expected, label) {
  sameOrientation(actual, expected, label);
  const scale = Math.max(1, Math.hypot(...expected.pose.positionM));
  assert.ok(actual.pose.positionM.every((value, i) => Math.abs(value - expected.pose.positionM[i]) < Math.max(0.05, scale * 2e-6)), label);
}

async function sunPoint(page) {
  return page.locator('[data-world-context-point-source="sun"]').evaluate(node => {
    const style = getComputedStyle(node);
    return { visibility: style.visibility, opacity: Number(style.opacity), width: node.getBoundingClientRect().width,
      physicalDiameter: Number(node.dataset.pointSourceDiameter), background: style.backgroundImage };
  });
}
