import { testDistance } from '../navigation/navigation-test-values.test-support.mts';
import { readSystemViewFile } from '../world/system-view-file.test-support.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { selectionAtCamera, watchCameraSelection } from '../overview-selection.mts';
import { subjectOf, type SceneSubject } from '../scene/scene-subject.mts';
import { systemById } from '../object-systems.mts';
import { type PreparedWorldCameraFrame } from '@cssearth/objects';
import { worldCameraFromCenteredPresentation, type WorldCameraPose } from '@cssearth/engine';

import { required, objectFixture, navigationFixture } from '../navigation/navigation-test-values.test-support.mts';
import type { ObjectWorldNavigationListener } from '@cssearth/renderer/runtime/world-navigation-types.ts';
import { SYSTEM_VIEW_HOSTS, loadSystemView } from '../system-framing.mts';
// System framing's candidates load after the first body mounts in the app; these tests need them loaded.
await Promise.all([...SYSTEM_VIEW_HOSTS].map(id => loadSystemView(id, readSystemViewFile)));
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

test('a flight that lands as far from a body as its star is opens the system; a zoom by hand does not', () => {
  const at = (range: number, landed: boolean) => selectionAtCamera({ world: camera(ceres, range * au), viewport, objects, systems: objects, objectId: 'ceres', overview: false, landed });
  assert.equal(at(20, false), null, 'a hand zoom keeps the body out to the exit distance');
  assert.equal(at(20, true), null, 'a landing near the body keeps it');
  assert.deepEqual(at(71, true), { overview: true, objectId: 'sun' });
  assert.equal(selectionAtCamera({ world: camera(sun, 50 * au), viewport, objects, systems: objects, objectId: 'sun', overview: false, landed: true }), null, 'the star itself is its system');
});

test('a body inside an object with a scene of its own hands the view to it once the camera is outside that object', () => {
  const kpc = 206_264.806e3 * au, cloud = frame([50 * kpc, 0, 0], 5 * kpc), star = frame([52 * kpc, 0, 0], 3e10);
  const placed = [...objects, objectFixture('cloud', cloud, { classification: 'galaxy' }), objectFixture('cepheid', star, { classification: 'star' })];
  // 2 kpc from the Cloud's centre, inside its 5 kpc: outside it from every direction 7 kpc from the star.
  const inside = { id: 'cloud', originM: cloud.originM, radiusM: cloud.bodyRadiusM };
  const at = (range: number, extra: Partial<Parameters<typeof selectionAtCamera>[0]> = {}) =>
    selectionAtCamera({ world: camera(star, range), viewport, objects: placed, systems: placed, objectId: 'cepheid', overview: false, inside, ...extra });
  assert.equal(at(6.9 * kpc), null, 'the star keeps its scene while the camera may be inside what it is inside');
  assert.deepEqual(at(7.01 * kpc), { overview: false, objectId: 'cloud' });
  assert.equal(at(9 * kpc, { restRangeM: 5 * kpc }), null, 'a scene that came to rest far out lasts twice as far');
  assert.deepEqual(at(10.01 * kpc, { restRangeM: 5 * kpc }), { overview: false, objectId: 'cloud' });
  assert.equal(at(8 * kpc, { exitScale: 1.25 }), null);
  // A body at that centre (a galaxy's black hole) lasts out to the object's radius.
  const centre = { id: 'cloud', originM: star.originM, radiusM: cloud.bodyRadiusM };
  assert.equal(at(4.9 * kpc, { inside: centre }), null);
  assert.deepEqual(at(5.01 * kpc, { inside: centre }), { overview: false, objectId: 'cloud' });
  // A flight that landed far out chose a framing of the whole world: the Sun's overview shows it, as without the object.
  assert.deepEqual(at(60 * kpc, { landed: true }), { overview: true, objectId: 'sun' });
  assert.deepEqual(at(60 * kpc, { inside: null }), { overview: true, objectId: 'sun' });
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

test('a galaxy that comes to rest farther out than the Sun is keeps its scene to twice that range', () => {
  // The LMC, 49.6 kpc away, is framed from farther than that.
  const kpc = 206_264_806 * au, galaxy = frame([49.6 * kpc, 0, 0], 5 * kpc);
  const placed = [...objects, objectFixture('lmc', galaxy, { classification: 'galaxy', systemName: 'Local Group' })];
  assert.equal(systemById(placed, 'lmc'), null);
  const at = (range: number, restRangeM?: number) => selectionAtCamera({ world: camera(galaxy, range), viewport, objects: placed, systems: placed, objectId: 'lmc', overview: false, restRangeM });
  assert.deepEqual(at(80 * kpc), { overview: true, objectId: 'sun' });
  for (const range of [80 * kpc, 120 * kpc, 159.9 * kpc]) assert.equal(at(range, 80 * kpc), null);
  assert.deepEqual(at(160 * kpc, 80 * kpc), { overview: true, objectId: 'sun' });
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
  const timers = new Map<number, () => void>(), changes: SceneSubject[] = [];
  const dispose = watchCameraSelection({ objects, systems: objects, objectId: 'ceres', getSelection: () => ({ objectId: 'ceres' }),
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
  // A pill's flight holds the watcher off all the way out; where it lands is settled at once, without a settle timer.
  available = false;
  getListener()(camera(sun, 150 * au), viewport);
  assert.equal(timers.size, 0);
  available = true;
  dispose.refresh();
  assert.equal(changes.length, 2);
  getListener()(camera(sun, 102 * au), viewport);
  dispose();
  assert.equal(listener, null); assert.equal(timers.size, 0);
});

test('continuous outward camera updates cannot postpone the Sun overview flip, and clearly past the exit it flips at once', () => {
  let listener: ObjectWorldNavigationListener | null = null;
  const getListener = () => required(listener);
  const timers = new Map<number, () => void>(), changes: SceneSubject[] = [];
  let serial = 0;
  const dispose = watchCameraSelection({ objects, systems: objects, objectId: 'sun', getSelection: () => ({ objectId: 'sun' }),
    isAvailable: () => true, onChange: next => changes.push(next),
    navigation: { ...navigationFixture(ceres, () => camera(ceres, 100), () => ({ ...viewport, framingRadiusPixels: 1, detailHandoffDiameterPixels: 1, visibleRect: null })), subscribe(value) { listener = value; return () => {}; } },
    windowTarget: { setTimeout(callback: () => void) { timers.set(++serial, callback); return serial; }, clearTimeout(id: number) { timers.delete(id); } } as unknown as Window });
  for (let step = 0; step < 20; step++) getListener()(camera(sun, (101 + step) * au), viewport);
  assert.equal(serial, 1, 'The first crossing keeps its original timer throughout continuous movement');
  assert.deepEqual(changes, [], 'near the threshold the crossing still has to last');
  // A quarter past the exit distance the camera is leaving: the flip starts without waiting for the timer, so it is done
  // before the zoom reaches the scene's far limit.
  for (let step = 20; step < 100; step++) getListener()(camera(sun, (101 + step) * au), viewport);
  assert.deepEqual(changes, [subjectOf('sun', 'system')], 'once, however long the zoom goes on');
  assert.equal(timers.size, 0, 'and its timer is gone');
  dispose();
});

test('a crossing out of a body is reported once, and so is the camera coming back inside', () => {
  let listener: ObjectWorldNavigationListener | null = null;
  const getListener = () => required(listener);
  const timers = new Map<number, () => void>(), changes: [SceneSubject, boolean][] = [];
  let serial = 0, returns = 0;
  // The body's scene stays mounted after the report (its system's scene waits for the camera to rest), so the watcher
  // goes on answering for the body.
  const dispose = watchCameraSelection({ objects, systems: objects, objectId: 'ceres', getSelection: () => ({ objectId: 'ceres' }),
    isAvailable: () => true, onChange: (next, landed) => changes.push([next, landed]), onReturn: () => { returns++; },
    navigation: { ...navigationFixture(ceres, () => camera(ceres, 100), () => ({ ...viewport, framingRadiusPixels: 1, detailHandoffDiameterPixels: 1, visibleRect: null })), subscribe(value) { listener = value; return () => {}; } },
    windowTarget: { setTimeout(callback: () => void) { timers.set(++serial, callback); return serial; }, clearTimeout(id: number) { timers.delete(id); } } as unknown as Window });
  getListener()(camera(sun, 101 * au), viewport);
  [...timers.values()][0]!(); timers.clear();
  assert.deepEqual(changes, [[subjectOf('sun', 'system'), false]], 'the crossing, once it has lasted');
  for (const range of [110, 400, 5000]) getListener()(camera(sun, range * au), viewport);
  assert.equal(changes.length, 1, 'not again while the camera stays outside');
  assert.equal(timers.size, 0, 'and no timer waits on it');
  assert.equal(returns, 0);
  getListener()(camera(sun, 90 * au), viewport);
  assert.equal(returns, 1, 'back inside');
  getListener()(camera(sun, 80 * au), viewport);
  assert.equal(returns, 1, 'told once');
  for (let step = 0; step < 60; step++) getListener()(camera(sun, (101 + step) * au), viewport);
  assert.equal(changes.length, 2, 'and the next crossing is reported again');
  dispose();
});

test("an approach to the system's star is reported once from its overview, and withdrawn when the camera backs away", () => {
  let listener: ObjectWorldNavigationListener | null = null;
  const getListener = () => required(listener);
  const timers = new Map<number, () => void>(), changes: SceneSubject[] = [];
  let serial = 0, returns = 0;
  // The star's system stays the committed selection after the report: the star's card waits for the camera to rest.
  const dispose = watchCameraSelection({ objects, systems: objects, objectId: 'sun', getSelection: () => subjectOf('sun', 'system'),
    isAvailable: () => true, onChange: next => changes.push(next), onReturn: () => { returns++; },
    navigation: { ...navigationFixture(sun, () => camera(sun, 1281), () => ({ ...viewport, framingRadiusPixels: 1, detailHandoffDiameterPixels: 1, visibleRect: null })), subscribe(value) { listener = value; return () => {}; } },
    windowTarget: { setTimeout(callback: () => void) { timers.set(++serial, callback); return serial; }, clearTimeout(id: number) { timers.delete(id); } } as unknown as Window });
  const settle = () => { const pending = [...timers.values()]; timers.clear(); for (const run of pending) run(); };
  getListener()(camera(sun, 100), viewport); settle();
  assert.deepEqual(changes, [{ objectId: 'sun' }]);
  getListener()(camera(sun, 90), viewport); getListener()(camera(sun, 60), viewport);
  assert.deepEqual([changes.length, timers.size, returns], [1, 0, 0], 'not again while the camera stays close');
  getListener()(camera(sun, 1281), viewport);
  assert.equal(returns, 1, 'backed away before it rested');
  getListener()(camera(sun, 100), viewport); settle();
  assert.equal(changes.length, 2, 'and the next approach is reported again');
  dispose();
});
