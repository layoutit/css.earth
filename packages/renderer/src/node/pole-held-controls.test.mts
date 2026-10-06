import assert from 'node:assert/strict';
import test from 'node:test';
import { createCameraMotion } from '@cssearth/renderer/navigation';
import { Surface } from '@cssearth/renderer/test/orbit-fixture.mts';
import { createUnboundedMatrixDragControls } from '@cssearth/renderer/navigation/input/camera-input.ts';
import { POLE_COAST, poleHoldFor, turnPoleHeld } from '@cssearth/renderer/navigation/input/pole-held-drag.ts';
import type { CameraDelta, Quaternion, TrackballMetrics } from '@cssearth/renderer/navigation/types.ts';
import { runtimePolicy } from '../../test/runtime-policy-fixture.mts';

// A body held to its pole, 8 radii away on an 800 x 600 viewport: its disc is 126 px in radius about (400, 300).
const lean = 17.6 * Math.PI / 180;
const trackball: TrackballMetrics = { centerX: 400, centerY: 300, radius: 126, surfaceRadius: 126, focalLength: 1000, viewportWidth: 800, viewportHeight: 600, tumbleOnly: true,
  pole: [0, -Math.cos(lean), Math.sin(lean)], meridian: [1, 0, 0],
  grabSphere: { center: [0, 0, -8], radius: 1, opticalCenterX: 400, opticalCenterY: 300, focalLength: 1000 } };
const close = (actual: Quaternion | undefined, expected: Quaternion) => {
  assert.ok(actual, 'the frame published no rotation');
  expected.forEach((value, i) => assert.ok(Math.abs(actual[i]! - value) < 1e-12, `${actual} is not ${expected}`));
};

/** The real controller on a test surface, with every rotation it publishes. */
function held(t: { after(cleanup: () => void): void }) {
  // The test surface models only the input surface methods the controls use.
  const previous = globalThis.HTMLElement;
  globalThis.HTMLElement = Surface as unknown as typeof HTMLElement;
  const surface = new Surface(), rotations: CameraDelta[] = [];
  const controls = createUnboundedMatrixDragControls({ cameraMotion: createCameraMotion(), runtimePolicy, inputSurface: surface.asElement(),
    trackballMetrics: () => trackball, rotate(update) { rotations.push(update); } });
  t.after(() => { controls.destroy(); globalThis.HTMLElement = previous; });
  const hold = poleHoldFor(trackball);
  assert.ok(hold);
  return { surface, rotations, hold, controls };
}

test('a pole-held drag turns once a frame, by the frame\'s whole movement', t => {
  const { surface, rotations, hold } = held(t);
  surface.dispatch('pointerdown', { clientX: 400, clientY: 300, timeStamp: 0 });
  surface.dispatch('pointermove', { clientX: 410, clientY: 300, timeStamp: 4 });
  surface.dispatch('pointermove', { clientX: 430, clientY: 310, timeStamp: 8 });
  assert.equal(rotations.length, 0, 'a sample turned the body before its frame');
  surface.tick(16);
  assert.equal(rotations.length, 1);
  close(rotations[0]!.rotation, turnPoleHeld(hold, trackball, { startX: 400, startY: 300, endX: 430, endY: 310 }));
  surface.tick(32);
  assert.equal(rotations.length, 1, 'a frame without movement turned the body');
});

test('a release keeps the samples that came since the last frame', t => {
  const { surface, rotations, hold } = held(t);
  surface.dispatch('pointerdown', { clientX: 400, clientY: 300, timeStamp: 0 });
  surface.dispatch('pointermove', { clientX: 420, clientY: 300, timeStamp: 500 });
  surface.dispatch('pointerup', { clientX: 420, clientY: 300, timeStamp: 505 });
  assert.equal(rotations.length, 1);
  close(rotations[0]!.rotation, turnPoleHeld(hold, trackball, { startX: 400, startY: 300, endX: 420, endY: 300 }));
});

test('a press under 0.4 s coasts by half the movement of the frame before its last, and a longer one stays', t => {
  const drag = (releasedAt: number) => {
    const { surface, rotations, hold, controls } = held(t);
    surface.dispatch('pointerdown', { clientX: 400, clientY: 300, timeStamp: 0 });
    surface.dispatch('pointermove', { clientX: 410, clientY: 300, timeStamp: 10 }); surface.tick(16);
    surface.dispatch('pointermove', { clientX: 430, clientY: 300, timeStamp: 26 }); surface.tick(32);
    turnPoleHeld(hold, trackball, { startX: 400, startY: 300, endX: 410, endY: 300 });
    turnPoleHeld(hold, trackball, { startX: 410, startY: 300, endX: 430, endY: 300 });
    surface.dispatch('pointerup', { clientX: 430, clientY: 300, timeStamp: releasedAt });
    return { surface, rotations, hold, controls };
  };
  const quick = drag(40);
  assert.equal(quick.rotations.length, 2);
  quick.surface.tick(56);
  // 16 ms after the release: half of the first frame's 10 px, from where that frame began.
  close(quick.rotations[2]?.rotation, turnPoleHeld(quick.hold, trackball, { startX: 400, startY: 300, endX: 400 + 5 * Math.exp(-POLE_COAST.decayPerSecond * .016), endY: 300 }));
  for (let time = 72; time < 2000; time += 16) quick.surface.tick(time);
  // 5 px exp(-2.5 t) falls under half a pixel after 0.921 s: 57 frames of 16 ms.
  assert.equal(quick.rotations.length, 2 + 57);
  assert.equal(quick.controls.stats().activeMode, 'idle');
  assert.equal(quick.surface.frames.size, 0, 'the coast left a frame requested');

  const slow = drag(400);
  for (let time = 416; time < 600; time += 16) slow.surface.tick(time);
  assert.equal(slow.rotations.length, 2);
  assert.equal(slow.controls.stats().activeMode, 'idle');
});

test('once the pointer leaves the body the drag turns by viewport share until release', t => {
  const { surface, rotations, hold } = held(t);
  surface.dispatch('pointerdown', { clientX: 400, clientY: 300, timeStamp: 0 });
  surface.dispatch('pointermove', { clientX: 700, clientY: 300, timeStamp: 10 }); surface.tick(16);
  close(rotations[0]!.rotation, turnPoleHeld(hold, trackball, { startX: 400, startY: 300, endX: 700, endY: 300 }));
  assert.equal(hold.rotating, true, 'the pointer 300 px from the centre of a 126 px disc still panned');
  surface.dispatch('pointermove', { clientX: 420, clientY: 300, timeStamp: 26 }); surface.tick(32);
  close(rotations[1]!.rotation, turnPoleHeld(hold, trackball, { startX: 700, startY: 300, endX: 420, endY: 300 }));
  // Both ends of the next movement are over the body: still a turn by viewport share, not a pan.
  const panned = turnPoleHeld({ ...hold, rotating: false }, trackball, { startX: 420, startY: 300, endX: 440, endY: 320 });
  surface.dispatch('pointermove', { clientX: 440, clientY: 320, timeStamp: 42 }); surface.tick(48);
  const turned = turnPoleHeld(hold, trackball, { startX: 420, startY: 300, endX: 440, endY: 320 });
  close(rotations[2]!.rotation, turned);
  assert.ok(Math.max(...turned.map((value, i) => Math.abs(value - panned[i]!))) > 1e-4, 'the pan and the turn are the same here, so the stroke proves nothing');
});
