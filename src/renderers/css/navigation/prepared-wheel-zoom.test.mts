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
  const camera: NavigationCamera = { state: cameraState };
  const controls = createPreparedWheelZoomControls({ inputSurface: surface.asElement(), camera, runtimePolicy,
    dolly: { stepPerDelta: .006 }, inertia,
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
  // A pinch carries its own gain: its packets are far smaller than a swipe's.
  const pinch = Math.exp(.006 * 100 * runtimePolicy.WHEEL_ZOOM_PINCH_SPEED_MULTIPLIER);
  expect(replay([{deltaY: 100, ctrlKey: true, timeStamp: 0}])).toBeCloseTo(pinch, 10);
  expect(replay([{deltaY: 1, timeStamp: 0}])).toBeLessThan(1.025);
  const wheel = Math.exp(.006 * 100 * runtimePolicy.WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER);
  expect(replay([{deltaY: 100, timeStamp: 0}])).toBeCloseTo(wheel, 10);
  expect(replay([{deltaY: 6.25, deltaMode: 1, timeStamp: 0}])).toBeCloseTo(wheel, 10);
});

// Notches, not a precision sweep: only a discrete wheel is released into the
// glide, so these gestures must be the kind that earns one.
const notch = (index: number) => ({deltaY: 100, timeStamp: index * 60, deltaMode: 0});

test('a released wheel gesture glides on in its own direction and settles', () => {
  const f = fixture(runtimePolicy.WHEEL_ZOOM_INERTIA);
  try {
    for (let i = 0; i < 4; i++) { f.surface.tick(i * 60); f.surface.dispatch('wheel', notch(i)); }
    expect(f.controls.stats().inputKind).toBe('wheel');
    // The commanded interval is spent: the gesture releases into its glide.
    f.surface.tick(180 + 200);
    const released = f.camera.state.distance;
    expect(f.controls.stats().gliding).toBe(true);
    f.surface.tick(180 + 216);
    expect(f.camera.state.distance).toBeGreaterThan(released);
    for (let elapsed = 232; elapsed < 2600; elapsed += 16) f.surface.tick(180 + elapsed);
    expect(f.controls.stats().gliding).toBe(false);
    expect(f.controls.stats().active).toBe(false);
    const settled = f.camera.state.distance;
    expect(settled).toBeGreaterThan(released);
    f.surface.tick(180 + 4000);
    expect(f.camera.state.distance).toBe(settled);
  } finally { f.controls.destroy(); }
});

// The glide is a coast, not a second gesture. Its travel is bounded by the
// released rate over `dampingSeconds * (1 - stopRateRatio)`, so a command of
// one interval must not be roughly doubled by what follows it.
test('the glide adds a fraction of the travel its gesture commanded', () => {
  const inertia = runtimePolicy.WHEEL_ZOOM_INERTIA;
  const commanded = (() => {
    const f = fixture(null);
    try {
      f.surface.tick(0); f.surface.dispatch('wheel', notch(0));
      for (let t = 8; t < 600; t += 8) f.surface.tick(t);
      return Math.log(f.camera.state.distance / 1000);
    } finally { f.controls.destroy(); }
  })();
  const f = fixture(inertia);
  try {
    f.surface.tick(0); f.surface.dispatch('wheel', notch(0));
    for (let t = 8; t < 3000; t += 8) f.surface.tick(t);
    expect(f.controls.stats().gliding).toBe(false);
    const share = Math.log(f.camera.state.distance / 1000) / commanded - 1;
    expect(share).toBeGreaterThan(0.1);
    expect(share).toBeLessThan(0.5);
  } finally { f.controls.destroy(); }
});

// A precision pointer already arrives carrying the platform's momentum tail;
// a second decay on top of it is what reads as an overshoot.
test('a precision scroll gesture stops with its last event and is not glided', () => {
  const f = fixture(runtimePolicy.WHEEL_ZOOM_INERTIA);
  try {
    for (let i = 0; i < 10; i++) { f.surface.tick(i * 8); f.surface.dispatch('wheel', {deltaY: 4, timeStamp: i * 8}); }
    expect(f.controls.stats().inputKind).toBe('trackpad');
    for (let elapsed = 0; elapsed < 400; elapsed += 8) f.surface.tick(72 + elapsed);
    expect(f.controls.stats().gliding).toBe(false);
    expect(f.controls.stats().active).toBe(false);
    const settled = f.camera.state.distance;
    f.surface.tick(72 + 1200);
    expect(f.camera.state.distance).toBe(settled);
  } finally { f.controls.destroy(); }
});

test('a new wheel gesture takes over the glide it interrupts', () => {
  const f = fixture(runtimePolicy.WHEEL_ZOOM_INERTIA);
  try {
    for (let i = 0; i < 3; i++) { f.surface.tick(i * 60); f.surface.dispatch('wheel', notch(i)); }
    f.surface.tick(120 + 200);
    expect(f.controls.stats().gliding).toBe(true);
    const glided = f.camera.state.distance;
    f.surface.dispatch('wheel', {deltaY: -100, timeStamp: 120 + 208, deltaMode: 0});
    expect(f.controls.stats().gliding).toBe(false);
    f.surface.tick(120 + 216);
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
