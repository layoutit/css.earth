import { createTestPage } from './browser-observations.mts';
import type { Page } from 'playwright';
// Native acceptance for every registered detailed object in one retained universe.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { SCENE_OBJECTS } from '../objects.mts';
import { browserObjects } from './browser-objects.mts';
import { wheelWithReceipt } from './wheel-zoom-distance.mts';

import { parsePreparedWorldContext } from '../../src/renderers/css/dist/index.js';
import { parse, object as schemaObject, optional, array, string } from '../../tools/objects/material-composition/data-schema.mts';
import type { ObjectEntry } from '../object-schema.mts';
import type { ObjectRuntimeDiagnostics } from '../env.d.ts';
import type { PreparedWorldCameraFrame, WorldCameraPose } from '../../src/renderers/css/navigation/world-camera.ts';
import type { PreparedWorldContextGeometry } from '../../src/renderers/css/universe/prepared-world-context.ts';
type Resources = ReturnType<ObjectRuntimeDiagnostics['runtime']['resources']>;
type Residency = { painted: string[]; missing: string[] };
type ExpectedObject = { frame: PreparedWorldCameraFrame; materialTracks: string[]; assetUrls: Record<string, string>;
  point: PreparedWorldContextGeometry['bodies'][number]; lenses: string[]; defaultLens: string | null };
type FrameSample = { time: number; id: string | undefined; roots: number; world: WorldCameraPose | undefined;
  pending: number | undefined; residency: Residency | null; materialReady: boolean | undefined; retained: boolean };
interface AllObjectWorldProbe {
  expected: Record<string, ExpectedObject>; document: Document; timeOrigin: number; selectors: string[];
  roots: HTMLElement[]; universe: Element[]; events: string[]; samples: FrameSample[]; running: boolean;
  residency(diagnostic: ObjectRuntimeDiagnostics, id: string, resources?: Resources): Residency;
  capture(): WorldCameraPose;
}
declare global { interface Window { __allObjectWorld: AllObjectWorldProbe; __sameObjectDetail: Element | null; } }
interface WorldReport {
  schema: string; startedAt: string; objects: string[]; preflightMissingFrameMutation: boolean;
  paintedReadinessMutation?: boolean; completedAt?: string; status?: 'passed' | 'failed';
  arrivals: Awaited<ReturnType<typeof proveArrival>>[];
  flights: { from: string; to: string; durationMs: number; frames: number; incomingFrames: number;
    firstIncomingResources: Residency | null; badImageFrames: number; speculativeImageFrames: number;
    maximumDetailedRoots: number; orbitProjection: Awaited<ReturnType<typeof orbitProjection>> }[];
  refocuses: { id: string; pick: Awaited<ReturnType<typeof visibleMarker>>; sameDetail: boolean; events: string[]; frames: number }[];
  zooms: { id: string; initialDistance: number; galacticDistance: number; worldBefore: WorldCameraPose; worldAfter: WorldCameraPose }[];
  errors: string[]; documentRequests: string[]; trace?: { frames: number; maximumDetailedRoots: number };
  failure?: { message: string; stack?: string; url?: string; snapshot?: unknown }; savedUrl?: unknown;
}
const origin = process.argv[2] ?? process.env.CSSEARTH_TEST_ORIGIN ?? 'http://localhost:4210';
const output = process.env.CSSEARTH_WORLD_BROWSER_OUTPUT ?? '.local/all-object-world-browser';
const context = parsePreparedWorldContext(JSON.parse(await readFile('src/objects/sun/prepared/world-context.json', 'utf8')));
const points = [context.focus, ...context.bodies];
function requireFrames(objects: readonly ObjectEntry[]) {
  assert.ok(objects.length, 'The current registry must be exercised.');
  for (const object of objects) {
    const frame = object.worldFrame, point = points.find(point => point.id === object.id);
    assert.ok(frame, `${object.id}: registry world frame is required before any flight`);
    assert.ok(point, `${object.id}: prepared context point is required`);
    assert.equal(frame.referenceFrame, context.frame.referenceFrame, `${object.id}: physical reference`);
    assert.equal(frame.epochJdTt, context.frame.epochJdTt, `${object.id}: physical epoch`);
    assert.deepEqual(frame.originM, point.positionM, `${object.id}: exact prepared centre`);
    assert.equal(frame.bodyRadiusM, point.radiusM, `${object.id}: exact prepared radius`);
  }
}
requireFrames(SCENE_OBJECTS);
assert.throws(() => requireFrames(SCENE_OBJECTS.map((object, index) => index ? object : { ...object, worldFrame: null })), /registry world frame is required/);
const controls = Object.fromEntries(await Promise.all(SCENE_OBJECTS.map(async ({ id }) => [id,
  parse(JSON.parse(await readFile(`src/objects/${id}/prepared/controls.json`, 'utf8')), schemaObject({ lenses: optional(schemaObject({ controls: array(schemaObject({ id: string })), defaultLens: string })) }), `${id} controls`)] as const)));
// Keep only each object's small expectation record; loading every retained
// runtime concurrently exhausts Node's heap with a large open-ended registry.
const presentations: Record<string, Pick<ExpectedObject, "materialTracks" | "assetUrls">> = {};
for (const { id } of SCENE_OBJECTS) {
  const definition = parse(JSON.parse(await readFile(`src/objects/${id}/prepared/runtime.json`, 'utf8')), schemaObject({ materials: array(schemaObject({ id: string })), assets: schemaObject({ entries: array(schemaObject({ key: string, url: string })) }) }), `${id} runtime expectations`);
  presentations[id] = { materialTracks: definition.materials.map(track => track.id),
    assetUrls: Object.fromEntries(definition.assets.entries.map(entry => [entry.key, entry.url])) };
}
const expected: Record<string, ExpectedObject> = Object.fromEntries(SCENE_OBJECTS.map(({ id, worldFrame }) => {
  const point = points.find(point => point.id === id);
  assert.ok(worldFrame); assert.ok(point);
  return [id, {
  frame: worldFrame, ...presentations[id], point,
  lenses: controls[id].lenses?.controls.map(lens => lens.id) ?? [], defaultLens: controls[id].lenses?.defaultLens ?? null,
} ] as const; }));
// The flight walk covers the representative sample; CSSEARTH_TEST_OBJECTS=all flies every object.
const walk = browserObjects();
const report: WorldReport = { schema: 'cssearth-all-object-world-browser@1', startedAt: new Date().toISOString(),
  objects: walk.map(object => object.id), preflightMissingFrameMutation: true,
  arrivals: [], flights: [], refocuses: [], zooms: [], errors: [], documentRequests: [] };
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome', headless: true });
const page = await createTestPage(browser, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }).catch(async error => { await browser.close(); throw error; });
try {
  await page.addInitScript(() => performance.setResourceTimingBufferSize(10000));
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) report.documentRequests.push(request.url()); });
  const initial = walk[0];
  const response = await page.goto(new URL(initial.route, origin).href, { waitUntil: 'domcontentloaded' });
  assert.ok(response?.ok(), 'Initial object document loads successfully.');
  await ready(page, initial.id);
  await page.evaluate(expected => {
    const selectors = ['.planet-stage', '.planet-sidebar', '.planet-input-surface', '.prepared-universe'];
    const roots = selectors.map(selector => {
      const root = document.querySelector(selector);
      if (!(root instanceof HTMLElement)) throw new Error(`Shared application root is missing: ${selector}`);
      return root;
    });
    const universe = [roots[3], ...roots[3].querySelectorAll('*')];
    const probe: AllObjectWorldProbe = window.__allObjectWorld = { expected, document, timeOrigin: performance.timeOrigin,
      selectors, roots, universe, events: [], samples: [], running: true,
    residency(diagnostic, id, resources = diagnostic.runtime.resources()) {
      const warmed = new Set(resources.warmed);
      const readyUrls = new Set(resources.images.entries.filter(entry => entry.ready).map(entry => new URL(entry.url, location.href).href));
      const painted = [...new Set([...resources.committed, ...resources.used])];
      const missing = painted.filter(key => !warmed.has(key) && !readyUrls.has(new URL(probe.expected[id].assetUrls[key], location.href).href));
      return { painted, missing };
    },
    capture() {
      const app = window.__cssEarth;
      if (!app) throw new Error('Scene diagnostics are missing.');
      const diagnostic = app.object();
      if (!diagnostic) throw new Error('Object diagnostics are missing.');
      return diagnostic.camera.captureWorldCamera(probe.expected[app.activeObjectId].frame);
    } };
    document.addEventListener('objectnavigate', event => { if (!(event instanceof CustomEvent) || typeof event.detail?.objectId !== 'string') throw new Error('Invalid object navigation event.'); probe.events.push(event.detail.objectId); }, { capture: true });
    const sample = () => {
      if (!probe.running) return;
      const id = window.__cssEarth?.activeObjectId, diagnostic = id ? window.__cssEarth?.object(id) : undefined;
      probe.samples.push({ time: performance.now(), id, roots: document.querySelectorAll('.polycss-camera').length,
        world: diagnostic && id ? diagnostic.camera.captureWorldCamera(probe.expected[id].frame) : undefined,
        pending: diagnostic?.renderStats.textureStats.pendingInteractiveImageCount,
        residency: diagnostic && id ? probe.residency(diagnostic, id) : null,
        materialReady: diagnostic?.runtime.selection().ready,
        retained: probe.universe.every(node => node.isConnected) });
      requestAnimationFrame(sample);
    };
    sample();
    const id = window.__cssearthTest.scene().activeObjectId, diagnostic = window.__cssearthTest.object(id), resources = diagnostic.runtime.resources();
    const key = resources.committed[0], url = new URL(probe.expected[id].assetUrls[key], location.href).href;
    const mutant = { ...resources, warmed: resources.warmed.filter(value => value !== key),
      images: { ...resources.images, entries: resources.images.entries.map(entry => new URL(entry.url, location.href).href === url ? { ...entry, ready: false } : entry) } };
    if (!key || !probe.residency(diagnostic, id, mutant).missing.includes(key)) throw new Error('Deleting actual committed image readiness must fail the painted-resource proof.');
  }, expected);
  report.paintedReadinessMutation = true;
  await pauseMotion();
  const initialBackground = await backgroundRequests();
  assert.ok(initialBackground.length > 0, 'Prepared universe image requests are observable before navigation.');
  report.arrivals.push(await proveArrival(initial.id));
  // Start at the first route, then visit every other route and return through
  // the first native navbar entry: every current object is a flight destination.
  for (const object of [...walk.slice(1), initial]) {
    const sampledWorlds = await flight(object.id);
    if (object.id === 'earth') await savedWorldRoundTrip(object.id, sampledWorlds);
    if (['earth', 'jupiter'].includes(object.id)) await refocus(object.id);
    if (['earth', 'saturn'].includes(object.id)) await galaxyRoundTrip(object.id, initialBackground);
  }
  assert.deepEqual(new Set(report.flights.map(flight => flight.to)), new Set(walk.map(object => object.id)));
  assert.ok(report.flights.some(flight => (flight.orbitProjection?.pieces ?? 0) > 0), 'Actual midflight orbit segments were measured.');
  assert.equal(report.documentRequests.length, 1, 'Every navbar flight and same-route focus retains one document.');
  assert.deepEqual(report.errors, [], 'No browser exceptions across all current objects.');
  assertRetained(await snapshot(), 'final');
  const trace = await page.evaluate(() => {
    window.__allObjectWorld.running = false;
    return window.__allObjectWorld.samples;
  });
  assert.ok(trace.every(sample => sample.roots <= 1), 'One detailed renderer throughout every frame.');
  assert.ok(trace.every(sample => sample.retained), 'Entire prepared universe survives every frame.');
  report.trace = { frames: trace.length, maximumDetailedRoots: trace.reduce((maximum, sample) => Math.max(maximum, sample.roots), 0) };
  report.completedAt = new Date().toISOString();
  report.status = 'passed';
  console.log(`ALL_OBJECT_WORLD_BROWSER_PASSED: ${walk.length} native flights; Earth/Jupiter refocus; Earth/Saturn galaxy round trips; one retained universe.`);
} catch (error) {
  report.status = 'failed'; report.failure = { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined };
  if (page) {
    report.failure.url = page.url();
    report.failure.snapshot = await snapshot().catch(error => ({ error: error instanceof Error ? error.message : String(error) }));
    await page.screenshot({ path: `${output}/failure.png` }).catch(() => {});
  }
  throw error;
} finally {
  await browser.close();
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
}

async function ready(page: Page, id: string) {
  await page.waitForFunction(id => {
    if (window.__cssEarth?.error) throw new Error(window.__cssEarth.error);
    const diagnostic = window.__cssEarth?.object(id);
    const selection = diagnostic?.runtime.selection();
    return window.__cssEarth?.ready && window.__cssearthTest.scene().activeObjectId === id && diagnostic?.ready && selection?.ready && !selection.pending &&
      diagnostic.renderStats.textureStats.pendingInteractiveImageCount === 0;
  }, id, { timeout: 60000 });
}
async function pauseMotion() {
  const input = page.locator('input[name="motion"]');
  assert.equal(await input.count(), 1, 'The shared shell keeps its motion control.');
  if (await input.isChecked()) await input.uncheck({ force: true });
}
async function capture() { return page.evaluate(() => window.__allObjectWorld.capture()); }
async function distance() { return page.evaluate(() => window.__cssearthTest.physicalCamera().distanceKilometers); }
async function snapshot() {
  return page.evaluate(() => {
    const probe = window.__allObjectWorld, id = window.__cssearthTest.scene().activeObjectId, diagnostic = window.__cssearthTest.object(id);
    return { id, path: location.pathname, world: probe.capture(),
      roots: document.querySelectorAll('.polycss-camera').length,
      sameDocument: probe.document === document && probe.timeOrigin === performance.timeOrigin,
      retained: probe.selectors.every((selector, index) => document.querySelector(selector) === probe.roots[index]) && probe.universe.every(node => node.isConnected),
      universeNodes: probe.universe.length, liveUniverseNodes: window.__cssearthTest.html('.prepared-universe').querySelectorAll('*').length + 1,
      markerIds: [...document.querySelectorAll<HTMLElement>('[data-context-body]')].map(node => node.dataset.contextBody),
      scale: window.__cssearthTest.html('.planet-stage').dataset.contextScale,
      volumeOpacity: Number(window.__cssearthTest.html('.prepared-volume-context').dataset.volumeOpacity),
      selection: diagnostic.runtime.selection(), materials: diagnostic.material.state(),
      pending: diagnostic.renderStats.textureStats.pendingInteractiveImageCount,
      residency: probe.residency(diagnostic, id),
      startupDecodedAssets: diagnostic.renderStats.visibleAssetsDecodedBeforeMount,
      texturedLeaves: [...document.querySelectorAll('.polycss-camera [style]')].filter(node => getComputedStyle(node).backgroundImage !== 'none').length,
      lensButtons: [...document.querySelectorAll<HTMLButtonElement>('button[name="dataset"]')].map(button => ({ id: button.value, disabled: button.disabled,
        visible: button.getClientRects().length > 0 && getComputedStyle(button).visibility === 'visible',
        pressed: button.getAttribute('aria-pressed') })) };
  });
}
function assertRetained(state: Awaited<ReturnType<typeof snapshot>>, label: string) {
  assert.equal(state.sameDocument, true, `${label}: same document`);
  assert.equal(state.retained, true, `${label}: original shared roots and universe descendants`);
  assert.equal(state.universeNodes, state.liveUniverseNodes, `${label}: no universe subtree growth`);
  assert.equal(state.roots, 1, `${label}: exactly one detailed renderer`);
  assert.deepEqual(new Set(state.markerIds), new Set(points.map(point => point.id)), `${label}: all prepared context objects remain mounted`);
}
async function proveArrival(id: string) {
  const state = await snapshot(), contract = expected[id];
  assertRetained(state, id);
  assert.equal(state.id, id); assert.equal(state.path, `/${id}/`);
  assert.equal(state.selection.ready, true, `${id}: material selection is ready`);
  assert.equal(state.selection.pending, false, `${id}: no pending material request`);
  assert.equal(state.pending, 0, `${id}: all interactive images decoded on arrival`);
  assert.deepEqual(state.residency.missing, [], `${id}: committed and consumed assets are decoded`);
  assert.ok(state.startupDecodedAssets > 0, `${id}: source startup assets decoded before detailed mount`);
  assert.deepEqual(Object.keys(state.materials).sort(), [...contract.materialTracks].sort(), `${id}: every prepared material track is committed`);
  assert.ok(state.texturedLeaves > 0, `${id}: actual retained material textures exist`);
  assert.deepEqual(state.lensButtons.map(button => button.id), contract.lenses, `${id}: every supported lens control survived migration`);
  assert.ok(state.lensButtons.every(button => !button.disabled), `${id}: supported lens controls are enabled`);
  assert.ok(state.lensButtons.every(button => button.visible), `${id}: every supported lens control is visible in the selected information panel`);
  assert.equal(state.selection.committed?.lensId, contract.defaultLens, `${id}: default lens is committed`);
  assert.deepEqual(state.lensButtons.filter(button => button.pressed === 'true').map(button => button.id), contract.defaultLens ? [contract.defaultLens] : []);
  const alternate = contract.lenses.find(lens => lens !== contract.defaultLens);
  if (alternate) {
    for (const lens of [alternate, contract.defaultLens]) {
      await page.locator(`button[name="dataset"][value="${lens}"]`).click();
      await page.waitForFunction(({ id, lens }) => {
        const state = window.__cssearthTest.object(id).runtime.selection();
        return state?.ready && !state.pending && state.committed?.lensId === lens;
      }, { id, lens }, { timeout: 30000 });
      const selected = await snapshot();
      assertRetained(selected, `${id} lens ${lens}`);
      assert.equal(selected.pending, 0);
      assert.deepEqual(selected.lensButtons.filter(button => button.pressed === 'true').map(button => button.id), [lens]);
    }
  }
  const alignment = await markerAlignment(id);
  await page.screenshot({ path: `${output}/arrival-${id}.png` });
  console.log(`ALL OBJECT ARRIVAL PASS ${id}: ${contract.lenses.length} lens controls, decoded detail, aligned physical marker`);
  return { id, lensCount: contract.lenses.length, alternate: alternate ?? null, texturedLeaves: state.texturedLeaves,
    startupDecodedAssets: state.startupDecodedAssets, paintedResourceCount: state.residency.painted.length, alignment };
}
async function markerAlignment(id: string) {
  const measured = await page.evaluate(id => {
    const probe = window.__allObjectWorld, frame = probe.expected[id].frame, point = probe.expected[id].point;
    const diagnostic = window.__cssearthTest.object(id), camera = window.__cssearthTest.physicalCamera(id), world = probe.capture();
    const [x, y, z, w] = world.pose.orientationXyzw;
    // Independently transform the prepared ICRF point by the inverse observer quaternion.
    const v = point.positionM.map((value, axis) => value - world.pose.positionM[axis]);
    const eye = [(1 - 2*y*y - 2*z*z)*v[0] + (2*x*y + 2*z*w)*v[1] + (2*x*z - 2*y*w)*v[2],
      (2*x*y - 2*z*w)*v[0] + (1 - 2*x*x - 2*z*z)*v[1] + (2*y*z + 2*x*w)*v[2],
      (2*x*z + 2*y*w)*v[0] + (2*y*z - 2*x*w)*v[1] + (1 - 2*x*x - 2*y*y)*v[2]];
    const root = window.__cssearthTest.html('.polycss-camera').getBoundingClientRect();
    const marker = window.__cssearthTest.html(`[data-context-body="${id}"]`).getBoundingClientRect();
    const depth = -eye[2];
    return { actual: [marker.x + marker.width / 2, marker.y + marker.height / 2],
      expected: [root.x + root.width / 2 + camera.principalOffset[0] + camera.focal * eye[0] / depth,
        root.y + root.height / 2 + camera.principalOffset[1] + camera.focal * eye[1] / depth],
      actualDiameter: marker.width,
      expectedDiameter: Math.max(2.4, 2 * camera.focal * frame.bodyRadiusM / Math.sqrt(depth * depth - frame.bodyRadiusM ** 2)),
      depthM: depth, radiusM: frame.bodyRadiusM };
  }, id);
  assert.ok(measured.depthM > measured.radiusM, `${id}: observer is outside the visible body`);
  assert.ok(measured.actual.every((value, axis) => Math.abs(value - measured.expected[axis]) < .1), `${id}: context marker and detailed physical centre align (${JSON.stringify(measured)})`);
  assert.ok(Math.abs(measured.actualDiameter - measured.expectedDiameter) < .1, `${id}: marker has the physical body radius`);
  return measured;
}
async function flight(to: string) {
  const from = await page.evaluate(() => window.__cssearthTest.scene().activeObjectId);
  await page.locator('.planet-sidebar-search').fill(to);
  const before = await page.evaluate(() => ({ index: window.__allObjectWorld.samples.length, time: performance.now() }));
  console.log(`ALL OBJECT FLIGHT START ${from} → ${to}`);
  await page.locator(`.planet-object-link[data-object-id="${to}"]`).click();
  let finished = false;
  const orbitMeasurement = (async () => {
    while (!finished) {
      const measured = await orbitProjection();
      if ((measured?.pieces ?? 0) > 0) return measured;
      await page.waitForTimeout(60);
    }
    return null;
  })();
  const readyArrival = ready(page, to).finally(() => { finished = true; });
  const [, orbitAlignment] = await Promise.all([readyArrival, orbitMeasurement]);
  if (orbitAlignment) assert.ok(orbitAlignment.maximumErrorPixels < .01, `${to}: actual midflight orbit lines use the detailed physical camera`);
  await pauseMotion();
  const trace = await page.evaluate(before => ({ samples: window.__allObjectWorld.samples.slice(before.index), durationMs: performance.now() - before.time }), before);
  assert.ok(trace.samples.length > 12, `${from} → ${to}: intermediate flight frames are rendered`);
  assert.ok(trace.samples.every(sample => sample.roots <= 1 && sample.retained), `${to}: one detail and retained universe throughout flight`);
  const incoming = trace.samples.filter(sample => sample.id === to && sample.world);
  assert.ok(incoming.length > 0, `${to}: incoming approach frames are observed`);
  const badFrames = incoming.filter(sample => !sample.materialReady || !sample.residency || sample.residency.missing.length > 0);
  assert.deepEqual(badFrames, [], `${to}: committed surfaces and consumed material addresses are decoded from the first incoming frame`);
  report.flights.push({ from, to, durationMs: trace.durationMs, frames: trace.samples.length,
    incomingFrames: incoming.length, firstIncomingResources: incoming[0].residency, badImageFrames: badFrames.length,
    speculativeImageFrames: incoming.filter(sample => (sample.pending ?? 0) > 0).length,
    maximumDetailedRoots: Math.max(...trace.samples.map(sample => sample.roots)), orbitProjection: orbitAlignment });
  report.arrivals.push(await proveArrival(to));
  const worlds = trace.samples.flatMap(sample => sample.world ? [sample.world] : []);
  const count = Math.min(12, worlds.length);
  return Array.from({ length: count }, (_, index) => worlds[Math.floor(index * (worlds.length - 1) / Math.max(1, count - 1))]);
}

async function orbitProjection() {
  return page.evaluate(() => {
    const probe = window.__allObjectWorld, id = window.__cssearthTest.scene().activeObjectId, diagnostic = window.__cssearthTest.object(id);
    const cameraElement = document.querySelector('.polycss-camera');
    if (!diagnostic || !cameraElement) return null;
    const contextElement = document.querySelector<HTMLElement>('.prepared-world-context');
    if (!contextElement || contextElement.hidden || !(Number(getComputedStyle(contextElement).opacity) > 0)) return null;
    const camera = window.__cssearthTest.physicalCamera(id), world = probe.capture(), root = cameraElement.getBoundingClientRect();
    const stage = window.__cssearthTest.html('.planet-stage').getBoundingClientRect();
    const [x, y, z, w] = world.pose.orientationXyzw;
    const offset = [root.x + root.width / 2 + camera.principalOffset[0] - stage.x - stage.width / 2,
      root.y + root.height / 2 + camera.principalOffset[1] - stage.y - stage.height / 2];
    const project = (point: readonly number[]) => {
      const v = point.map((value, axis) => value - world.pose.positionM[axis]);
      const eye = [(1-2*y*y-2*z*z)*v[0]+(2*x*y+2*z*w)*v[1]+(2*x*z-2*y*w)*v[2],
        (2*x*y-2*z*w)*v[0]+(1-2*x*x-2*z*z)*v[1]+(2*y*z+2*x*w)*v[2],
        (2*x*z+2*y*w)*v[0]+(2*y*z-2*x*w)*v[1]+(1-2*x*x-2*y*y)*v[2]];
      return [offset[0] + camera.focal * eye[0] / -eye[2], offset[1] + camera.focal * eye[1] / -eye[2]];
    };
    let pieces = 0, maximumErrorPixels = 0;
    for (const { point } of Object.values(probe.expected)) {
      if (!point.orbit) continue;
      const vertices = point.orbit.verticesM.map(project);
      for (const node of window.__cssearthTest.required(window.__cssearthTest.universe().inspect().bodies.find(body => body.id === point.id), `orbit ${point.id}`).orbit as HTMLElement[]) {
        if (getComputedStyle(node).visibility === 'hidden' || !(Number(node.style.opacity) > 0)) continue;
        const m = new DOMMatrix(node.style.transform), p = [m.e, m.f], q = [m.e + m.a, m.f + m.b];
        let nearest = Infinity;
        for (let index = 0; index < vertices.length; index++) {
          const a = vertices[index], b = vertices[(index + 1) % vertices.length];
          const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
          if (!(length > 1e-10) || !Number.isFinite(length)) continue;
          const error = (point: readonly number[]) => Math.abs(dy * (point[0] - a[0]) - dx * (point[1] - a[1])) / length;
          nearest = Math.min(nearest, Math.max(error(p), error(q)));
        }
        pieces++; maximumErrorPixels = Math.max(maximumErrorPixels, nearest);
      }
    }
    return { id, pieces, maximumErrorPixels };
  });
}

async function savedWorldRoundTrip(id: string, sampledWorlds: readonly WorldCameraPose[]) {
  const original = await capture(), frame = expected[id].frame;
  let reader: Page | undefined;
  let measured: { world: WorldCameraPose; center: ReturnType<ObjectRuntimeDiagnostics["camera"]["state"]>["bodyCenterKilometers"]; offsetPixels: number } | undefined;
  try {
    for (const world of sampledWorlds) {
      await page.evaluate(({ id, frame, world }) => window.__cssearthTest.object(id).camera.applyWorldCamera(world, frame), { id, frame, world });
      measured = await page.evaluate(({ id, frame }) => {
        const camera = window.__cssearthTest.physicalCamera(id), center = camera.bodyCenterKilometers;
        return { world: window.__cssearthTest.object(id).camera.captureWorldCamera(frame), center,
          offsetPixels: center ? Math.hypot(camera.principalOffset[0] + camera.focal * center[0] / -center[2],
            camera.principalOffset[1] + camera.focal * center[1] / -center[2]) : 0 };
      }, { id, frame });
      if (Number.isFinite(measured.offsetPixels) && measured.offsetPixels > 8) break;
    }
    assert.ok(measured?.center && Number.isFinite(measured.offsetPixels) && measured.offsetPixels > 8, `${id}: a real flight sample must contain a translated off-axis observer`);
    const measuredWorld = measured.world, measuredCenter = measured.center;
    await page.waitForTimeout(200);
    const savedUrl = page.url();
    assert.ok(new URL(savedUrl).searchParams.get('v'), `${id}: the actual URL owner bakes the sampled flight pose`);
    await page.screenshot({ path: `${output}/${id}-offaxis-saved.png` });
    reader = await createTestPage(browser, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    reader.on('pageerror', error => report.errors.push(error.message));
    await reader.goto(savedUrl, { waitUntil: 'domcontentloaded' });
    await ready(reader, id);
    const restored = await reader.evaluate(({ id, frame }) => ({
      world: window.__cssearthTest.object(id).camera.captureWorldCamera(frame), center: window.__cssearthTest.physicalCamera(id).bodyCenterKilometers,
      roots: document.querySelectorAll('.polycss-camera').length, ready: window.__cssearthTest.object(id).runtime.selection().ready,
    }), { id, frame });
    sameOrientation(restored.world, measured.world, `${id} saved URL`);
    const positionErrorM = Math.hypot(...restored.world.pose.positionM.map((value, axis) => value - measuredWorld.pose.positionM[axis]));
    const centreErrorKm = restored.center ? Math.hypot(...restored.center.map((value, axis) => value - measuredCenter[axis])) : Infinity;
    assert.ok(positionErrorM < Math.max(.01, Math.hypot(...measured.world.pose.positionM) * 1e-11), `${id}: saved URL restores the full translated world position`);
    assert.ok(centreErrorKm < Math.max(1e-8, Math.hypot(...measured.center) * 1e-11), `${id}: saved URL retains body-centre translation without a heliocentric renderer`);
    assert.equal(restored.roots, 1); assert.equal(restored.ready, true);
    await reader.screenshot({ path: `${output}/${id}-offaxis-restored.png` });
    report.savedUrl = { id, savedUrl, offsetPixels: measured.offsetPixels, positionErrorM, centreErrorKm, before: measured, restored };
    console.log(`ALL OBJECT SAVED URL PASS ${id}: off-axis native-flight observer restored`);
  } finally {
    if (reader) await reader.close();
    await page.evaluate(({ id, frame, world }) => window.__cssearthTest.object(id).camera.applyWorldCamera(world, frame), { id, frame, world: original });
    assertRetained(await snapshot(), `${id} URL proof restoration`);
  }
}
async function visibleMarker(id: string) {
  for (const distanceKilometers of [1e8, 3e8, 8e8]) for (let yaw = 0; yaw < 360; yaw += 30) {
    const found = await page.evaluate(({ id, distanceKilometers, yaw }) => {
      const diagnostic = window.__cssearthTest.object();
      diagnostic.camera.setState({ distanceKilometers,
        pose: { schema: 'cssearth-camera-pose@2', scene: new DOMMatrix().rotateAxisAngle(1, 0, 0, 35).rotateAxisAngle(0, 1, 0, yaw).toString() } });
      const targets = document.querySelectorAll<HTMLElement>(`[data-object-navigate="${id}"],.planet-heliocentric-body-target[data-body="${id}"]`);
      for (const target of targets) {
        const style = getComputedStyle(target), rect = target.getBoundingClientRect();
        const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
        if (target.hidden || style.visibility === 'hidden' || style.pointerEvents === 'none' || Number(style.opacity) === 0 ||
          x < 390 || x > innerWidth - 60 || y < 80 || y > innerHeight - 80) continue;
        if (document.elementFromPoint(x, y)?.closest('.planet-input-surface')) return { x, y, yaw, distanceKilometers };
      }
      return null;
    }, { id, distanceKilometers, yaw });
    if (found) return found;
  }
  throw new Error(`${id}: no rendered selectable same-route target`);
}
async function refocus(id: string) {
  const pick = await visibleMarker(id);
  const before = await page.evaluate(() => {
    window.__sameObjectDetail = document.querySelector('.polycss-camera');
    return { events: window.__allObjectWorld.events.length, samples: window.__allObjectWorld.samples.length };
  });
  await page.mouse.dblclick(pick.x, pick.y, { delay: 90 });
  await page.waitForFunction(({ id, distanceKilometers }) => window.__cssearthTest.scene().activeObjectId === id &&
    window.__cssearthTest.physicalCamera(id).distanceKilometers < distanceKilometers / 50 &&
    window.__cssearthTest.scene().playback.reason !== 'unavailable', { id, distanceKilometers: pick.distanceKilometers }, { timeout: 30000 });
  const result = await page.evaluate(before => ({ sameDetail: document.querySelector('.polycss-camera') === window.__sameObjectDetail,
    events: window.__allObjectWorld.events.slice(before.events), frames: window.__allObjectWorld.samples.length - before.samples }), before);
  assert.equal(result.sameDetail, true, `${id}: refocus preserves detailed renderer`);
  assert.deepEqual(result.events, [id], `${id}: native double-click selects exactly once`);
  assert.ok(result.frames > 12, `${id}: refocus animates`);
  assertRetained(await snapshot(), `${id} refocus`);
  report.refocuses.push({ id, pick, ...result });
  console.log(`ALL OBJECT REFOCUS PASS ${id}: native double-click retained detail`);
}
async function settled() {
  await page.waitForFunction(() => {
    const stats = window.__cssearthTest.object()?.camera.stats().dragInertia;
    return stats && !stats.active && !stats.wheelZoom.active;
  }, null, { timeout: 6000 });
}
async function scrollTo(target: number) {
  await page.mouse.move(1010, 460);
  for (let index = 0; index < 45; index++) {
    const current = await distance();
    if (Math.abs(current / target - 1) < 1e-6) return;
    const step = await page.evaluate(() => window.__cssearthTest.required(window.__cssearthTest.object().camera.stats().dolly, "physical dolly").wheelStepPerDelta);
    await wheelWithReceipt(page, Math.max(-300, Math.min(300, Math.log(target / current) / step)));
    await settled();
  }
  throw new Error(`Native wheel failed to reach ${target} km`);
}
async function galaxyRoundTrip(id: string, initialBackground: readonly string[]) {
  const before = await capture(), initialDistance = await distance();
  console.log(`ALL OBJECT GALAXY START ${id}`);
  await scrollTo(1.8e18);
  const galactic = await snapshot();
  assert.equal(galactic.scale, 'galactic'); assert.equal(galactic.volumeOpacity, 1);
  assertRetained(galactic, `${id} galaxy`); sameOrientation(galactic.world, before, id);
  assert.deepEqual(await backgroundRequests(), initialBackground, `${id}: prepared universe asset bank remains fixed`);
  await page.screenshot({ path: `${output}/${id}-galaxy.png` });
  await scrollTo(initialDistance);
  const returned = await snapshot();
  assertRetained(returned, `${id} return`); sameOrientation(returned.world, before, id);
  const tolerance = Math.max(.05, Math.hypot(...before.pose.positionM) * 2e-6);
  assert.ok(returned.world.pose.positionM.every((value, axis) => Math.abs(value - before.pose.positionM[axis]) < tolerance), `${id}: native wheel returns to same physical observer`);
  assert.equal(returned.selection.ready, true); assert.equal(returned.pending, 0);
  report.zooms.push({ id, initialDistance, galacticDistance: 1.8e18, worldBefore: before, worldAfter: returned.world });
  await page.screenshot({ path: `${output}/${id}-galaxy-return.png` });
  console.log(`ALL OBJECT GALAXY PASS ${id}: native wheel round trip and retained materials`);
}
async function backgroundRequests() {
  return page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name)
    .filter(name => name.includes('/milky-way/prepared/slices/') || name.includes('/stellar-neighbourhood/prepared/')).sort());
}
function sameOrientation(actual: WorldCameraPose, expected: WorldCameraPose, id: string) {
  const a = actual.pose.orientationXyzw, b = expected.pose.orientationXyzw;
  const sign = a.reduce((sum, value, index) => sum + value * b[index], 0) < 0 ? -1 : 1;
  assert.ok(a.every((value, index) => Math.abs(value - sign * b[index]) < 1e-8), `${id}: physical orientation remains stable during dolly`);
}
