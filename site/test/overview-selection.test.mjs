import assert from 'node:assert/strict';
import test from 'node:test';
import { overviewExitDistance, selectionAtCamera, watchOverviewSelection } from '../overview-selection.mjs';
import { worldCameraFromCenteredPresentation } from '../../src/renderers/css/dist/navigation.js';

const rotation = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const frame = (originM, bodyRadiusM) => ({ originM, bodyRadiusM, referenceFrame: 'test', epochJdTt: 1,
  presentationToReference: rotation, metersPerUnit: 1 });
const sun = frame([0, 0, 0], 10), ceres = frame([1000, 0, 0], 1);
const objects = [{ id: 'sun', classification: 'star', distanceAu: 0, worldFrame: sun }, { id: 'ceres', worldFrame: ceres }];
const viewport = { focalPixels: 1000, principalOffsetPixels: [140, 0] };
const camera = (frame, distanceUnits) => worldCameraFromCenteredPresentation({ rotation, distanceUnits }, frame, viewport);
const choose = (world, objectId, overview) => selectionAtCamera({ world, viewport, objects, objectId, overview });

test('deselection uses physical orbital scale, not the selected body radius alone', () => {
  assert.equal(overviewExitDistance(ceres, sun), 1500);
  assert.equal(choose(camera(ceres, 1400), 'ceres', false), null);
  assert.deepEqual(choose(camera(ceres, 1600), 'ceres', false), { overview: true, objectId: 'sun' });
  assert.equal(overviewExitDistance(sun, sun), 1280);
});

test('only approaching the Sun opens a card, with separate entry and exit thresholds', () => {
  assert.equal(choose(camera(sun, 1281), 'sun', true), null);
  assert.equal(choose(camera(sun, 1000), 'sun', true), null);
  assert.deepEqual(choose(camera(sun, 100), 'sun', true), { overview: false, objectId: 'sun' });
  assert.equal(choose(camera(sun, 1000), 'sun', false), null, 'Small zoom reversal keeps the card');
  assert.equal(choose(camera(ceres, 10), 'sun', true), null, 'A close Ceres still requires explicit selection');
});

test('camera sampling settles before changing selection and releases timers and subscriptions', () => {
  let listener, serial = 0, available = true;
  const timers = new Map(), changes = [];
  const dispose = watchOverviewSelection({ objects, objectId: 'ceres', getOverview: () => false,
    isAvailable: () => available, onChange: next => changes.push(next),
    navigation: { subscribe(value) { listener = value; return () => { listener = null; }; } },
    windowTarget: { setTimeout(callback) { timers.set(++serial, callback); return serial; }, clearTimeout(id) { timers.delete(id); } } });
  listener(camera(ceres, 1600), viewport);
  const firstTimer = [...timers.keys()][0];
  listener(camera(ceres, 1700), viewport);
  assert.equal([...timers.keys()][0], firstTimer, 'Continued zoom does not postpone the crossing');
  listener(camera(ceres, 1400), viewport);
  assert.equal(timers.size, 0);
  assert.deepEqual(changes, [], 'A transient crossing does not deselect');
  listener(camera(ceres, 1600), viewport);
  available = false;
  [...timers.values()][0](); timers.clear();
  assert.deepEqual(changes, [], 'A selection flight owns the camera until it settles');
  available = true;
  listener(camera(ceres, 1600), viewport);
  [...timers.values()][0](); timers.clear();
  assert.equal(changes.length, 1);
  listener(camera(ceres, 1700), viewport);
  dispose();
  assert.equal(listener, null); assert.equal(timers.size, 0);
});

test('continuous outward camera updates cannot postpone the Sun overview flip', () => {
  let listener;
  const timers = new Map(), changes = [];
  let serial = 0;
  const dispose = watchOverviewSelection({ objects, objectId: 'sun', getOverview: () => false,
    isAvailable: () => true, onChange: next => changes.push(next),
    navigation: { subscribe(value) { listener = value; return () => {}; } },
    windowTarget: { setTimeout(callback) { timers.set(++serial, callback); return serial; }, clearTimeout(id) { timers.delete(id); } } });
  for (let step = 0; step < 100; step++) listener(camera(sun, 1300 + step), viewport);
  assert.equal(serial, 1, 'The first crossing keeps its original timer throughout continuous movement');
  [...timers.values()][0](); timers.clear();
  assert.deepEqual(changes, [{ objectId: 'sun', overview: true }]);
  dispose();
});
