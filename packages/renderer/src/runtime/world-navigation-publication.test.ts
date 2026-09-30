import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { createWorldNavigationPublicationHub } from './world-navigation-publication.js';

const world = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5,
  pose: { positionM: [0,0,0], orientationXyzw: [0,0,0,1] } } as WorldCameraPose;
const viewport: WorldCameraViewport = { focalPixels: 800, principalOffsetPixels: [4, -3] };

test('world publication hub replays the latest sample and detaches subscribers', () => {
  const hub = createWorldNavigationPublicationHub(mock.fn(() => {}));
  const listener = mock.fn(() => {});
  hub.publish(world, viewport);
  const unsubscribe = hub.subscribe(listener);
  assert.equal(listener.mock.callCount(), 1); assert.deepEqual(listener.mock.calls[0]!.arguments, [world, viewport]);
  unsubscribe();
  hub.publish(world, { ...viewport, focalPixels: 801 });
  assert.equal(listener.mock.callCount(), 1);
});

test('world publication hub clears all subscribers after a listener error', () => {
  const onError = mock.fn(() => {}), hub = createWorldNavigationPublicationHub(onError);
  const bad = mock.fn(() => { throw new Error('context publish failed'); });
  const good = mock.fn(() => {});
  hub.subscribe(bad); hub.subscribe(good);
  hub.publish(world, viewport);
  assert.equal(onError.mock.callCount(), 1);
  assert.equal(good.mock.callCount(), 0);
  hub.publish(world, viewport);
  assert.equal(bad.mock.callCount(), 1);
});

test('equivalent publications do not repeat world work, but every camera dependency invalidates', () => {
  const hub = createWorldNavigationPublicationHub(mock.fn(() => {})), listener = mock.fn(() => {});
  hub.subscribe(listener);
  hub.publish(world, viewport);
  hub.publish(structuredClone(world), structuredClone(viewport));
  assert.equal(listener.mock.callCount(), 1);
  for (const next of [
    { ...world, epochJdTt: world.epochJdTt + 1 },
    { ...world, pose: { ...world.pose, positionM: [1, 0, 0] as const } },
    { ...world, pose: { ...world.pose, orientationXyzw: [0, 1, 0, 0] as const } },
  ]) hub.publish(next, viewport);
  for (const next of [{ ...viewport, widthPixels: 100 }, { ...viewport, heightPixels: 100 },
    { ...viewport, focalPixels: 900 }, { ...viewport, principalOffsetPixels: [0, 0] as const }]) hub.publish(world, next);
  assert.equal(listener.mock.callCount(), 8);
});
