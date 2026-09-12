import { afterEach, expect, test, vi } from 'vitest';
import * as runtimePolicy from '../../../../site/runtime-policy.mts';
import { Surface } from '../../../platform/test/orbit-fixture.mts';
import { createPreparedWheelZoomControls } from './prepared-wheel-zoom.js';
import type { NavigationCamera, CameraDelta } from './types.ts';
import type { WheelZoomInertia } from './runtime-policy.ts';

afterEach(() => vi.unstubAllGlobals());

interface WheelEventInput { deltaY: number; timeStamp: number; ctrlKey?: boolean; deltaMode?: number; }

// The commanded response is measured without inertia; the glide it releases
// into has its own tests below.
function fixture(inertia: WheelZoomInertia | null = null) {
  vi.stubGlobal('HTMLElement', Surface);
  const surface = new Surface();
  const cameraState = { rotX: 0, rotY: 0, zoom: 1, distance: 1000 };
  const camera: NavigationCamera = { state: cameraState, update() {} };
  const controls = createPreparedWheelZoomControls({ inputSurface: surface.asElement(), camera, runtimePolicy,
    minimumZoom: .001, maximumZoom: 4, dolly: { stepPerDelta: .006 }, inertia,
    trackballMetrics() { throw new Error('Physical zoom must not acquire a surface anchor'); },
    rotate(value: CameraDelta) { if (value.distance !== undefined) cameraState.distance = value.distance; },
  });
  return { surface, camera, controls };
}

function replay(events: readonly WheelEventInput[]): number {
  const f = fixture();
  try {
    for (const event of events) {
      f.surface.tick(event.timeStamp);
      f.surface.dispatch('wheel', event);
    }
    const last = events.at(-1);
    if (!last) throw new Error('Wheel replay needs at least one event.');
    f.surface.tick(last.timeStamp + 200);
    expect(f.controls.stats().active).toBe(false);
    return f.camera.state.distance / 1000;
  } finally { f.controls.destroy(); }
}

test('physical trackpad zoom uses shared sensitivity consistently across packet size and cadence', () => {
  const sweep = (cadence: number): WheelEventInput[] => Array.from({length: 50}, (_, i) => ({deltaY: 2, timeStamp: i * cadence}));
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

test('a released wheel gesture glides on in its own direction and settles', () => {
  const f = fixture(runtimePolicy.WHEEL_ZOOM_INERTIA);
  try {
    for (let i = 0; i < 10; i++) { f.surface.tick(i * 8); f.surface.dispatch('wheel', {deltaY: 4, timeStamp: i * 8}); }
    // The commanded interval is spent: the gesture releases into its glide.
    f.surface.tick(72 + 200);
    const released = f.camera.state.distance;
    expect(f.controls.stats().gliding).toBe(true);
    f.surface.tick(72 + 216);
    expect(f.camera.state.distance).toBeGreaterThan(released);
    for (let elapsed = 232; elapsed < 2600; elapsed += 16) f.surface.tick(72 + elapsed);
    expect(f.controls.stats().gliding).toBe(false);
    expect(f.controls.stats().active).toBe(false);
    const settled = f.camera.state.distance;
    expect(settled).toBeGreaterThan(released);
    f.surface.tick(72 + 4000);
    expect(f.camera.state.distance).toBe(settled);
  } finally { f.controls.destroy(); }
});

test('a new wheel gesture takes over the glide it interrupts', () => {
  const f = fixture(runtimePolicy.WHEEL_ZOOM_INERTIA);
  try {
    for (let i = 0; i < 6; i++) { f.surface.tick(i * 8); f.surface.dispatch('wheel', {deltaY: 4, timeStamp: i * 8}); }
    f.surface.tick(40 + 200);
    expect(f.controls.stats().gliding).toBe(true);
    const glided = f.camera.state.distance;
    f.surface.dispatch('wheel', {deltaY: -4, timeStamp: 40 + 208});
    expect(f.controls.stats().gliding).toBe(false);
    f.surface.tick(40 + 216);
    expect(f.camera.state.distance).toBeLessThan(glided);
  } finally { f.controls.destroy(); }
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
