import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectionAtCamera, watchCameraSelection } from './overview-selection.mts';
import { systemById } from './object-systems.mts';
import { worldCameraFromCenteredPresentation } from '@cssearth/engine';
import { objectFixture, navigationFixture, required } from './test/navigation-test-values.mts';
import type { PreparedWorldCameraFrame } from '@cssearth/objects';
import type { ObjectWorldNavigationListener } from '@cssearth/renderer/runtime/world-navigation-types.ts';
const au = 149597870700;
const frame = (x: number): PreparedWorldCameraFrame => ({ referenceFrame: 'test', epochJdTt: 1, originM: [x, 0, 0], bodyRadiusM: 1, metersPerUnit: 1, presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1] });
const sun = frame(0), ceres = frame(200 * au);
const objects = [objectFixture('sun', sun, { classification: 'star', systemName: 'Solar System' }), objectFixture('ceres', ceres, { systemName: 'Solar System' })];
const viewport = { focalPixels: 1000, principalOffsetPixels: [0, 0] as const };
const camera = (range: number) => worldCameraFromCenteredPresentation({ rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], distanceUnits: range }, sun, viewport);

test('a wide system member leaves exactly at its separation plus the system exit distance', () => {
  const system = required(systemById(objects, 'sun'));
  assert.equal(system.exitDistanceM, 100 * au);
  const choose = (range: number, exitScale = 1) => selectionAtCamera({ world: camera(range), viewport, objects, systems: objects, objectId: 'ceres', overview: false, exitScale });
  assert.equal(choose(300 * au - 1), null);
  assert.deepEqual(choose(300 * au), { overview: true, objectId: 'sun' });
  assert.equal(choose(600 * au - 1, 2), null);
  assert.deepEqual(choose(600 * au, 2), { overview: true, objectId: 'sun' });
});

test('unavailable camera publications preserve a crossing until an available return', () => {
  let listener: ObjectWorldNavigationListener | null = null, available = true, returns = 0, unsubscribed = 0;
  const timers = new Map<number, () => void>(), changes: unknown[] = [];
  const dispose = watchCameraSelection({ objects, systems: objects, objectId: 'ceres', getSelection: () => ({ objectId: 'ceres' }),
    isAvailable: () => available, onChange: (next, landed) => changes.push([next, landed]), onReturn: () => { returns++; },
    navigation: { ...navigationFixture(ceres, () => camera(0), () => ({ ...viewport, framingRadiusPixels: 1, detailHandoffDiameterPixels: 1, visibleRect: null })), subscribe(value) { listener = value; return () => { unsubscribed++; }; } },
    windowTarget: { setTimeout(callback: () => void) { timers.set(1, callback); return 1; }, clearTimeout(id: number) { timers.delete(id); } } as unknown as Window });
  const publish = (range: number) => required(listener)(camera(range), viewport);
  publish(301 * au); assert.equal(timers.size, 1);
  required(timers.get(1))(); timers.clear();
  assert.deepEqual(changes, [[{ objectId: 'solar-system' }, false]]);
  available = false; publish(290 * au); assert.equal(returns, 0);
  available = true; publish(290 * au); assert.equal(returns, 1);
  publish(280 * au); assert.equal(returns, 1);
  dispose(); assert.equal(unsubscribed, 1);
  dispose.refresh(); assert.equal(changes.length, 1);
});
