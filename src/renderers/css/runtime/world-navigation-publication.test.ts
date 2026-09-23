import { expect, test, vi } from 'vitest';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { createWorldNavigationPublicationHub } from './world-navigation-publication.js';

const world = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5,
  pose: { positionM: [0,0,0], orientationXyzw: [0,0,0,1] } } as WorldCameraPose;
const viewport: WorldCameraViewport = { focalPixels: 800, principalOffsetPixels: [4, -3] };

test('world publication hub replays the latest sample and detaches subscribers', () => {
  const hub = createWorldNavigationPublicationHub(vi.fn());
  const listener = vi.fn();
  hub.publish(world, viewport);
  const unsubscribe = hub.subscribe(listener);
  expect(listener).toHaveBeenCalledExactlyOnceWith(world, viewport);
  unsubscribe();
  hub.publish(world, { ...viewport, focalPixels: 801 });
  expect(listener).toHaveBeenCalledOnce();
});

test('world publication hub clears all subscribers after a listener error', () => {
  const onError = vi.fn(), hub = createWorldNavigationPublicationHub(onError);
  const bad = vi.fn(() => { throw new Error('context publish failed'); });
  const good = vi.fn();
  hub.subscribe(bad); hub.subscribe(good);
  hub.publish(world, viewport);
  expect(onError).toHaveBeenCalledOnce();
  expect(good).not.toHaveBeenCalled();
  hub.publish(world, viewport);
  expect(bad).toHaveBeenCalledOnce();
});

test('equivalent publications do not repeat world work, but every camera dependency invalidates', () => {
  const hub = createWorldNavigationPublicationHub(vi.fn()), listener = vi.fn();
  hub.subscribe(listener);
  hub.publish(world, viewport);
  hub.publish(structuredClone(world), structuredClone(viewport));
  expect(listener).toHaveBeenCalledTimes(1);
  for (const next of [
    { ...world, epochJdTt: world.epochJdTt + 1 },
    { ...world, pose: { ...world.pose, positionM: [1, 0, 0] as const } },
    { ...world, pose: { ...world.pose, orientationXyzw: [0, 1, 0, 0] as const } },
  ]) hub.publish(next, viewport);
  for (const next of [{ ...viewport, widthPixels: 100 }, { ...viewport, heightPixels: 100 },
    { ...viewport, focalPixels: 900 }, { ...viewport, principalOffsetPixels: [0, 0] as const }]) hub.publish(world, next);
  expect(listener).toHaveBeenCalledTimes(8);
});
