import { expect, test, vi } from 'vitest';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { stageWorldViewport } from './object-runtime.js';
import { createWorldNavigationPublicationHub } from './world-navigation-publication.js';

const world = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5,
  pose: {} } as WorldCameraPose;
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

test('stage viewport conversion accounts for camera-root placement', () => {
  const stage = { getBoundingClientRect: () => ({ left: 100, top: 40, width: 1000, height: 700 }) } as HTMLElement;
  const camera = { getBoundingClientRect: () => ({ left: 300, top: 100, width: 600, height: 500 }) } as HTMLElement;
  expect(stageWorldViewport(stage, camera, 900, [12, -8])).toEqual({
    focalPixels: 900, principalOffsetPixels: [12, -48],
  });
});
