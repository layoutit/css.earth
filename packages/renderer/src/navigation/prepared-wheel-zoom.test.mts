import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { runtimePolicy } from '../../test/runtime-policy-fixture.mts';
import { Surface } from '../../test/orbit-fixture.mts';
import { createPreparedWheelZoomControls, pinchTargetDistance } from './prepared-wheel-zoom.js';
import { cameraMotionSignalFor } from './camera-motion-signal.js';
import type { NavigationCamera, CameraDelta } from './types.ts';
import type { WheelZoomInertia } from './runtime-policy.ts';
import { stubGlobal, unstubAllGlobals } from '@cssearth/objects/node/contract';

afterEach(() => unstubAllGlobals());

interface WheelEventInput { deltaY: number; timeStamp: number; ctrlKey?: boolean; deltaMode?: number; }

// The commanded response is measured without inertia; the glide it releases
// into has its own tests below.
function fixture(inertia: WheelZoomInertia | null = null, minimumDistance?: () => number) {
  stubGlobal('HTMLElement', Surface);
  const surface = new Surface();
  const cameraState = { rotX: 0, rotY: 0, zoom: 1, distance: 1000 };
  const camera: NavigationCamera = { state: cameraState };
  const controls = createPreparedWheelZoomControls({ inputSurface: surface.asElement(), camera, runtimePolicy,
    dolly: { stepPerDelta: .006, ...(minimumDistance ? { minimumDistance } : {}) }, inertia,
    rotate(value: CameraDelta) { if (value.distance !== undefined) cameraState.distance = value.distance; },
  });
  return { surface, camera, controls };
}

function replay(events: readonly WheelEventInput[], minimumDistance?: () => number): number {
  const f = fixture(null, minimumDistance);
  try {
    for (const event of events) {
      f.surface.tick(event.timeStamp);
      f.surface.dispatch('wheel', event);
    }
    const last = events.at(-1);
    if (!last) throw new Error('Wheel replay needs at least one event.');
    f.surface.tick(last.timeStamp + 200);
    assert.equal(f.controls.stats().active, false);
    return f.camera.state.distance / 1000;
  } finally { f.controls.destroy(); }
}

test('physical trackpad zoom uses shared sensitivity consistently across packet size and cadence', () => {
  const sweep = (cadence: number): WheelEventInput[] => Array.from({length: 50}, (_, i) => ({deltaY: 2, timeStamp: i * cadence}));
  const expected = Math.exp(.006 * 100 * runtimePolicy.WHEEL_ZOOM_SPEED_MULTIPLIER);
  assert.ok(Math.abs(replay(sweep(8)) - (expected)) < 10 ** -10 / 2, `${replay(sweep(8))} is not close to ${expected}`);
  assert.ok(Math.abs(replay(sweep(240)) - (expected)) < 10 ** -10 / 2, `${replay(sweep(240))} is not close to ${expected}`);
  assert.ok(Math.abs(replay([{deltaY: 2, timeStamp: 0}, {deltaY: 98, timeStamp: 8}]) - (expected)) < 10 ** -10 / 2, `${replay([{deltaY: 2, timeStamp: 0}, {deltaY: 98, timeStamp: 8}])} is not close to ${expected}`);
  // A camera that names no closest view pinches like a swipe.
  assert.ok(Math.abs(replay([{deltaY: 100, ctrlKey: true, timeStamp: 0}]) - (expected)) < 10 ** -10 / 2, `${replay([{deltaY: 100, ctrlKey: true, timeStamp: 0}])} is not close to ${expected}`);
  assert.ok(replay([{deltaY: 1, timeStamp: 0}]) < 1.025);
  const wheel = Math.exp(.006 * 100 * runtimePolicy.WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER);
  assert.ok(Math.abs(replay([{deltaY: 100, timeStamp: 0}]) - (wheel)) < 10 ** -10 / 2, `${replay([{deltaY: 100, timeStamp: 0}])} is not close to ${wheel}`);
  assert.ok(Math.abs(replay([{deltaY: 6.25, deltaMode: 1, timeStamp: 0}]) - (wheel)) < 10 ** -10 / 2, `${replay([{deltaY: 6.25, deltaMode: 1, timeStamp: 0}])} is not close to ${wheel}`);
});

const pinch = runtimePolicy.WHEEL_ZOOM_PINCH;
const fullPinch = Math.log(pinch.fullPinchFingerRatio);

test('a pinch keeps a share of the way left near a body and zooms a fixed factor far out', () => {
  // u, the log distance left plus one notch, starts at 2 here: inside the bend.
  const near = pinchTargetDistance(Math.exp(2 - .6), 1, fullPinch, pinch, .6);
  assert.ok(Math.abs(((Math.log(near) + .6) / 2) - (pinch.nearRemainingPerFullPinch)) < 10 ** -10 / 2, `${((Math.log(near) + .6) / 2)} is not close to ${pinch.nearRemainingPerFullPinch}`);
  const far = pinchTargetDistance(Math.exp(30), 1, fullPinch, pinch, .6);
  assert.ok(Math.abs((Math.exp(30) / far) - (pinch.farZoomPerFullPinch)) < 10 ** -6 / 2, `${(Math.exp(30) / far)} is not close to ${pinch.farZoomPerFullPinch}`);
});

test('a pinch in and back out returns across the bend, and never passes the closest view', () => {
  for (const origin of [1, 1.3, 20, 1e6, 1e17]) {
    for (const step of [.1, fullPinch, 5 * fullPinch]) {
      const inward = pinchTargetDistance(origin, 1, step, pinch, .6);
      assert.ok(inward >= 1);
      assert.ok(inward <= origin);
      if (inward > 1) assert.ok(Math.abs((pinchTargetDistance(inward, 1, -step, pinch, .6) / origin) - (1)) < 10 ** -9 / 2, `${(pinchTargetDistance(inward, 1, -step, pinch, .6) / origin)} is not close to ${1}`);
    }
  }
  // An observer restored inside the closest view pinches from where it stands.
  assert.ok(pinchTargetDistance(.5, 1, -fullPinch, pinch, .6) > .5);
});

test('a pinch wheel moves by the pinch rule once the camera names its closest view', () => {
  const step = -100;
  const expected = pinchTargetDistance(1000, 400, -step / pinch.wheelDeltaPerFingerLogStep, pinch, .6) / 1000;
  assert.ok(Math.abs(replay([{deltaY: step / 2, ctrlKey: true, timeStamp: 0}, {deltaY: step / 2, ctrlKey: true, timeStamp: 8}], () => 400) - (expected)) < 10 ** -10 / 2, `${replay([{deltaY: step / 2, ctrlKey: true, timeStamp: 0}, {deltaY: step / 2, ctrlKey: true, timeStamp: 8}], () => 400)} is not close to ${expected}`);
  // The wheel itself keeps its notch.
  assert.ok(Math.abs(replay([{deltaY: 100, timeStamp: 0}], () => 400) - (Math.exp(.6))) < 10 ** -10 / 2, `${replay([{deltaY: 100, timeStamp: 0}], () => 400)} is not close to ${Math.exp(.6)}`);
});

// Notches, not a precision sweep: only a discrete wheel is released into the
// glide, so these gestures must be the kind that earns one.
const notch = (index: number) => ({deltaY: 100, timeStamp: index * 60, deltaMode: 0});

test('a released wheel gesture glides on in its own direction and settles', () => {
  const f = fixture(runtimePolicy.WHEEL_ZOOM_INERTIA);
  const moving: { active: boolean; coasting: boolean }[] = [];
  cameraMotionSignalFor(f.surface.asElement()).subscribe(state => moving.push(state));
  try {
    for (let i = 0; i < 4; i++) { f.surface.tick(i * 60); f.surface.dispatch('wheel', notch(i)); }
    assert.equal(f.controls.stats().inputKind, 'wheel');
    // The notches drive the camera; the released glide coasts on inertia (camera-motion-signal.ts).
    assert.deepEqual(moving, [{ active: true, coasting: false }]);
    // The commanded interval is spent: the gesture releases into its glide.
    f.surface.tick(180 + 200);
    const released = f.camera.state.distance;
    assert.equal(f.controls.stats().gliding, true);
    assert.deepEqual(moving.at(-1), { active: true, coasting: true });
    f.surface.tick(180 + 216);
    assert.ok(f.camera.state.distance > released);
    for (let elapsed = 232; elapsed < 2600; elapsed += 16) f.surface.tick(180 + elapsed);
    assert.equal(f.controls.stats().gliding, false);
    assert.equal(f.controls.stats().active, false);
    assert.deepEqual(moving, [{ active: true, coasting: false }, { active: true, coasting: true }, { active: false, coasting: false }]);
    const settled = f.camera.state.distance;
    assert.ok(settled > released);
    f.surface.tick(180 + 4000);
    assert.equal(f.camera.state.distance, settled);
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
    assert.equal(f.controls.stats().gliding, false);
    const share = Math.log(f.camera.state.distance / 1000) / commanded - 1;
    assert.ok(share > 0.1);
    assert.ok(share < 0.5);
  } finally { f.controls.destroy(); }
});

// A precision pointer already arrives carrying the platform's momentum tail;
// a second decay on top of it is what reads as an overshoot.
test('a precision scroll gesture stops with its last event and is not glided', () => {
  const f = fixture(runtimePolicy.WHEEL_ZOOM_INERTIA);
  try {
    for (let i = 0; i < 10; i++) { f.surface.tick(i * 8); f.surface.dispatch('wheel', {deltaY: 4, timeStamp: i * 8}); }
    assert.equal(f.controls.stats().inputKind, 'trackpad');
    for (let elapsed = 0; elapsed < 400; elapsed += 8) f.surface.tick(72 + elapsed);
    assert.equal(f.controls.stats().gliding, false);
    assert.equal(f.controls.stats().active, false);
    const settled = f.camera.state.distance;
    f.surface.tick(72 + 1200);
    assert.equal(f.camera.state.distance, settled);
  } finally { f.controls.destroy(); }
});

test('a new wheel gesture takes over the glide it interrupts', () => {
  const f = fixture(runtimePolicy.WHEEL_ZOOM_INERTIA);
  try {
    for (let i = 0; i < 3; i++) { f.surface.tick(i * 60); f.surface.dispatch('wheel', notch(i)); }
    f.surface.tick(120 + 200);
    assert.equal(f.controls.stats().gliding, true);
    const glided = f.camera.state.distance;
    f.surface.dispatch('wheel', {deltaY: -100, timeStamp: 120 + 208, deltaMode: 0});
    assert.equal(f.controls.stats().gliding, false);
    f.surface.tick(120 + 216);
    assert.ok(f.camera.state.distance < glided);
  } finally { f.controls.destroy(); }
});

test('reversing or stopping a trackpad gesture drops unfinished zoom immediately', () => {
  const f = fixture();
  f.surface.dispatch('wheel', {deltaY: 10, timeStamp: 0}); f.surface.tick(80);
  const outward = f.camera.state.distance;
  f.surface.dispatch('wheel', {deltaY: -1, timeStamp: 80}); f.surface.tick(100);
  assert.ok(f.camera.state.distance < outward);
  f.controls.stop();
  const stopped = f.camera.state.distance; f.surface.tick(300);
  assert.equal(f.camera.state.distance, stopped);
  assert.equal(f.surface.frames.size, 0);
  f.controls.destroy();
  assert.equal(f.surface.listenerCount(), 0);
});
