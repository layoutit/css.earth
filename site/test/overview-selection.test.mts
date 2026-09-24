import { testDistance } from './navigation-test-values.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { selectionAtCamera, watchOverviewSelection } from '../overview-selection.mts';
import { systemById } from '../object-systems.mts';
import { worldCameraFromCenteredPresentation } from '../../src/renderers/css/dist/navigation.js';

import { required, objectFixture, navigationFixture } from './navigation-test-values.mts';
import type { PreparedWorldCameraFrame, WorldCameraPose } from '../../src/renderers/css/navigation/world-camera.ts';
import type { ObjectWorldNavigationListener } from '../../src/renderers/css/runtime/world-navigation-types.ts';
import type { OverviewSelection } from '../overview-selection.mts';
import { SYSTEM_VIEW_HOSTS, loadSystemView } from '../system-framing.mts';
// System framing's candidates load after the first body mounts in the app; these tests need them loaded.
await Promise.all([...SYSTEM_VIEW_HOSTS].map(id => loadSystemView(id, async host => JSON.parse(await (await import('node:fs/promises')).readFile(new URL(`../../src/objects/sun/prepared/system-views/${host}.json`, import.meta.url), 'utf8')))));
const rotation = [1, 0, 0, 0, 1, 0, 0, 0, 1] as const;
/** CSS presentation to a right-handed reference: a reflection. */
const reflection = [1, 0, 0, 0, -1, 0, 0, 0, 1] as const;
const frame = (originM: PreparedWorldCameraFrame["originM"], bodyRadiusM: number): PreparedWorldCameraFrame => ({ originM, bodyRadiusM, referenceFrame: 'test', epochJdTt: 1,
  presentationToReference: reflection, metersPerUnit: 1 });
const au = 149_597_870_700;
const sun = frame([0, 0, 0], 10), ceres = frame([70 * au, 0, 0], 1);
const objects = [objectFixture('sun', sun, { classification: 'star', systemName: 'Solar System', distance: testDistance(0) }), objectFixture('ceres', ceres, { systemName: 'Solar System' })];
const viewport = { focalPixels: 1000, principalOffsetPixels: [140, 0] as const };
const camera = (frame: PreparedWorldCameraFrame, distanceUnits: number) => worldCameraFromCenteredPresentation({ rotation, distanceUnits }, frame, viewport);
const choose = (world: WorldCameraPose, objectId: string, overview: boolean) => selectionAtCamera({ world, viewport, objects, systems: objects, objectId, overview });

test('every body switches to Solar System at 100 AU from the Sun', () => {
  for (const id of ['sun', 'ceres']) {
    assert.equal(choose(camera(sun, 99.99 * au), id, false), null);
    assert.deepEqual(choose(camera(sun, 100 * au), id, false), { overview: true, objectId: 'sun' });
    assert.deepEqual(choose(camera(sun, 100.01 * au), id, false), { overview: true, objectId: 'sun' });
  }
});

test('the threshold follows the Sun origin even in a translated world frame', () => {
  const translatedSun = frame([20 * au, -40 * au, 60 * au], 10);
  const translatedObjects = [objectFixture('sun', translatedSun, { classification: 'star', systemName: 'Solar System', distance: testDistance(0) })];
  for (const [range, expected] of [[99, null], [101, { overview: true, objectId: 'sun' }]] as const) {
    assert.deepEqual(selectionAtCamera({ world: camera(translatedSun, range * au), viewport,
      objects: translatedObjects, systems: translatedObjects, objectId: 'sun', overview: false }), expected);
  }
});

test("another star's planetary system opens its own overview, scaled by the system's prepared size", () => {
  const pc = 206_264.806 * au, host = frame([87 * pc, 0, 0], 4.6e8), planet = frame([87 * pc + 2.25e9, 0, 0], 7.3e7);
  const placed = [...objects, objectFixture('wasp-43', host, { classification: 'star', systemName: 'WASP-43 system' }),
    objectFixture('wasp-43b', planet, { classification: 'exoplanet', systemName: 'WASP-43 system' })];
  const system = required(systemById(placed, 'wasp-43'));
  assert.ok(system.exitDistanceM > 3 * 2.25e9 && system.exitDistanceM < .1 * au, "The exit scales the Sun's 100 AU to a 0.015 AU orbit");
  const at = (range: number, id = 'wasp-43b', overview = false, from = host) =>
    selectionAtCamera({ world: camera(from, range), viewport, objects: placed, systems: placed, objectId: id, overview });
  assert.equal(at(system.exitDistanceM * .99), null);
  assert.deepEqual(at(system.exitDistanceM * 1.01), { overview: true, objectId: 'wasp-43' }, 'Never the Sun: the router mounts WASP-43');
  assert.deepEqual(at(system.exitDistanceM * 1.01, 'wasp-43'), { overview: true, objectId: 'wasp-43' });
  assert.deepEqual(at(4.6e8 * 3, 'wasp-43', true), { overview: false, objectId: 'wasp-43' }, 'Approaching the star opens its card');
  assert.equal(at(4.6e8 * 3, 'sun', true, host), null, 'The Solar System overview ignores another star');
  // Framed whole, the compact system shows its star far wider than the Sun's 48 px card threshold; the card waits.
  const framed = { ...viewport, framingRadiusPixels: 250 };
  const card = (range: number) => selectionAtCamera({ world: camera(host, range), viewport: framed, objects: placed, systems: placed, objectId: 'wasp-43', overview: true });
  assert.equal(card(.04 * au), null);
  assert.deepEqual(card(.02 * au), { overview: false, objectId: 'wasp-43' });
});

test('a star outside every system keeps its scene until the camera is as far from it as the Sun is', () => {
  const pc = 206_264.806 * au, lone = frame([168 * pc, 0, 0], 5e11);
  const placed = [...objects, objectFixture('betelgeuse', lone, { classification: 'star', systemName: 'Orion' })];
  assert.equal(systemById(placed, 'betelgeuse'), null);
  const at = (range: number) => selectionAtCamera({ world: camera(lone, range), viewport, objects: placed, systems: placed, objectId: 'betelgeuse', overview: false });
  for (const range of [100 * au, 50 * pc, 167.99 * pc]) assert.equal(at(range), null);
  assert.deepEqual(at(168 * pc), { overview: true, objectId: 'sun' });
});

test('only approaching the Sun opens a card, with separate entry and exit thresholds', () => {
  assert.equal(choose(camera(sun, 1281), 'sun', true), null);
  assert.equal(choose(camera(sun, 1000), 'sun', true), null);
  assert.deepEqual(choose(camera(sun, 100), 'sun', true), { overview: false, objectId: 'sun' });
  assert.equal(choose(camera(sun, 1000), 'sun', false), null, 'Small zoom reversal keeps the card');
  assert.equal(choose(camera(ceres, 10), 'sun', true), null, 'A close Ceres still requires explicit selection');
});

test('camera sampling settles before changing selection and releases timers and subscriptions', () => {
  let listener: ObjectWorldNavigationListener | null = null;
  const getListener = () => required(listener);
  let serial = 0, available = true;
  const timers = new Map<number, () => void>(), changes: OverviewSelection[] = [];
  const dispose = watchOverviewSelection({ objects, systems: objects, objectId: 'ceres', getOverview: () => false,
    isAvailable: () => available, onChange: next => changes.push(next),
    navigation: { ...navigationFixture(ceres, () => camera(ceres, 100), () => ({ ...viewport, framingRadiusPixels: 1, detailHandoffDiameterPixels: 1, visibleRect: null })), subscribe(value) { listener = value; return () => { listener = null; }; } },
    windowTarget: { setTimeout(callback: () => void) { timers.set(++serial, callback); return serial; }, clearTimeout(id: number) { timers.delete(id); } } as unknown as Window });
  getListener()(camera(sun, 101 * au), viewport);
  const firstTimer = [...timers.keys()][0];
  getListener()(camera(sun, 102 * au), viewport);
  assert.equal([...timers.keys()][0], firstTimer, 'Continued zoom does not postpone the crossing');
  getListener()(camera(sun, 99 * au), viewport);
  assert.equal(timers.size, 0);
  assert.deepEqual(changes, [], 'A transient crossing does not deselect');
  getListener()(camera(sun, 101 * au), viewport);
  available = false;
  [...timers.values()][0](); timers.clear();
  assert.deepEqual(changes, [], 'A selection flight owns the camera until it settles');
  available = true;
  getListener()(camera(sun, 101 * au), viewport);
  [...timers.values()][0](); timers.clear();
  assert.equal(changes.length, 1);
  getListener()(camera(sun, 102 * au), viewport);
  dispose();
  assert.equal(listener, null); assert.equal(timers.size, 0);
});

test('continuous outward camera updates cannot postpone the Sun overview flip', () => {
  let listener: ObjectWorldNavigationListener | null = null;
  const getListener = () => required(listener);
  const timers = new Map<number, () => void>(), changes: OverviewSelection[] = [];
  let serial = 0;
  const dispose = watchOverviewSelection({ objects, systems: objects, objectId: 'sun', getOverview: () => false,
    isAvailable: () => true, onChange: next => changes.push(next),
    navigation: { ...navigationFixture(ceres, () => camera(ceres, 100), () => ({ ...viewport, framingRadiusPixels: 1, detailHandoffDiameterPixels: 1, visibleRect: null })), subscribe(value) { listener = value; return () => {}; } },
    windowTarget: { setTimeout(callback: () => void) { timers.set(++serial, callback); return serial; }, clearTimeout(id: number) { timers.delete(id); } } as unknown as Window });
  for (let step = 0; step < 100; step++) getListener()(camera(sun, (101 + step) * au), viewport);
  assert.equal(serial, 1, 'The first crossing keeps its original timer throughout continuous movement');
  [...timers.values()][0](); timers.clear();
  assert.deepEqual(changes, [{ objectId: 'sun', overview: true }]);
  dispose();
});
