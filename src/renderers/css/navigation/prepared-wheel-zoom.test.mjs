import { afterEach, expect, test, vi } from 'vitest';
import * as runtimePolicy from '../../../../site/runtime-policy.mjs';
import { Surface } from '../../../platform/test/orbit-fixture.mjs';
import { createPreparedWheelZoomControls } from './prepared-wheel-zoom.js';

afterEach(() => vi.unstubAllGlobals());

function fixture(dolly = { stepPerDelta: .006 }) {
  vi.stubGlobal('HTMLElement', Surface);
  const surface = new Surface(), camera = { state: { zoom: 1, distance: 1000 } };
  const controls = createPreparedWheelZoomControls({ inputSurface: surface, camera, runtimePolicy,
    minimumZoom: .001, maximumZoom: 4, dolly,
    trackballMetrics() { throw new Error('Physical zoom must not acquire a surface anchor'); },
    rotate(value) { camera.state.distance = value.distance; },
  });
  return { surface, camera, controls };
}

function replay(events) {
  const f = fixture();
  try {
    for (const event of events) {
      f.surface.tick(event.timeStamp);
      f.surface.dispatch('wheel', event);
    }
    f.surface.tick(events.at(-1).timeStamp + 200);
    expect(f.controls.stats().active).toBe(false);
    return f.camera.state.distance / 1000;
  } finally { f.controls.destroy(); }
}

test('physical trackpad zoom uses shared sensitivity consistently across packet size and cadence', () => {
  const sweep = cadence => Array.from({length: 50}, (_, i) => ({deltaY: 2, timeStamp: i * cadence}));
  const expected = Math.exp(.006 * 100 * runtimePolicy.WHEEL_ZOOM_SPEED_MULTIPLIER);
  expect(replay(sweep(8))).toBeCloseTo(expected, 10);
  expect(replay(sweep(240))).toBeCloseTo(expected, 10);
  expect(replay([{deltaY: 2, timeStamp: 0}, {deltaY: 98, timeStamp: 8}])).toBeCloseTo(expected, 10);
  expect(replay([{deltaY: 100, ctrlKey: true, timeStamp: 0}])).toBeCloseTo(expected, 10);
  expect(replay([{deltaY: 1, timeStamp: 0}])).toBeLessThan(1.025);
  const wheel = Math.exp(.006 * 100 * runtimePolicy.WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER);
  expect(replay([{deltaY: 100, timeStamp: 0}])).toBeCloseTo(wheel, 10);
  expect(replay([{deltaY: 6.25, deltaMode: 1, timeStamp: 0}])).toBeCloseTo(wheel, 10);
});

test('reversing or stopping a trackpad gesture drops unfinished zoom immediately', () => {
  const f = fixture();
  f.surface.dispatch('wheel', {deltaY: 10, timeStamp: 0}); f.surface.tick(80);
  const outward = f.camera.state.distance;
  f.surface.dispatch('wheel', {deltaY: -1, timeStamp: 80}); f.surface.tick(100);
  expect(f.camera.state.distance).toBeLessThan(outward);
  f.controls.stop();
  const stopped = f.camera.state.distance; f.surface.tick(300);
  expect(f.camera.state.distance).toBe(stopped);
  expect(f.surface.frames.size).toBe(0);
  f.controls.destroy();
  expect(f.surface.listenerCount()).toBe(0);
});

test('touch pinch preserves the prepared distance origin while ordinary page scrolling stays disabled', () => {
  const f = fixture({ stepPerDelta: .006, distanceOrigin: 900 });
  f.controls.update({ wheel: false });
  f.surface.dispatch('wheel', { deltaY: -100, timeStamp: 0 });
  f.surface.tick(300);
  expect(f.camera.state.distance).toBe(1000);
  f.controls.pinch(2, { x: 100, y: 100 });
  expect(f.camera.state.distance).toBe(950);
  f.controls.pinch(.5, { x: 100, y: 100 });
  expect(f.camera.state.distance).toBe(1000);
  expect(f.surface.frames.size).toBe(0);
  f.controls.destroy();
  f.controls.pinch(2, { x: 100, y: 100 });
  expect(f.camera.state.distance).toBe(1000);
});
