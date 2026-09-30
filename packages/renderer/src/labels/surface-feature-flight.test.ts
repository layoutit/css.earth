import { createCameraMotion } from '../navigation/camera-motion.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { flyToSurfaceDirection, surfaceOrbitPose, surfaceOrbitRotation } from './surface-feature-flight.js';
import type { WorldCameraPose } from '../navigation/world-camera.js';
import type { ObjectWorldNavigation } from '../runtime/world-navigation-types.js';

const origin = [1000, -2000, 3000] as const;
const world: WorldCameraPose = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, pose: { positionM: [origin[0] + 5000, origin[1], origin[2]], orientationXyzw: [0, 0, 0, 1] } };

test('the orbit rotation carries the eye direction onto the target direction and keeps the distance', () => {
  const rotation = surfaceOrbitRotation(world, [...origin], [0, 0, 1]);
  const end = surfaceOrbitPose(world, [...origin], rotation, 1, 5000);
  const relative = end.pose.positionM.map((value, axis) => value - origin[axis]!);
  assert.ok(Math.abs(relative[0] - (0)) < 10 ** -6 / 2, `${relative[0]} is not close to ${0}`);
  assert.ok(Math.abs(relative[1] - (0)) < 10 ** -6 / 2, `${relative[1]} is not close to ${0}`);
  assert.ok(Math.abs(relative[2] - (5000)) < 10 ** -6 / 2, `${relative[2]} is not close to ${5000}`);
  const half = surfaceOrbitPose(world, [...origin], rotation, 0.5, 4000);
  const halfRelative = half.pose.positionM.map((value, axis) => value - origin[axis]!);
  assert.ok(Math.abs(Math.hypot(...halfRelative) - (4000)) < 10 ** -6 / 2, `${Math.hypot(...halfRelative)} is not close to ${4000}`);
  assert.ok(Math.abs(Math.atan2(halfRelative[2]!, halfRelative[0]!) - (Math.PI / 4)) < 10 ** -6 / 2, `${Math.atan2(halfRelative[2]!, halfRelative[0]!)} is not close to ${Math.PI / 4}`);
  assert.ok(Math.abs(Math.hypot(...half.pose.orientationXyzw) - (1)) < 10 ** -9 / 2, `${Math.hypot(...half.pose.orientationXyzw)} is not close to ${1}`);
});

test('a flight applies eased poses each frame, ends on the target, and yields to any other camera write', async () => {
  const applied: WorldCameraPose[] = [];
  let current = world, time = 0;
  const frames: (() => void)[] = [];
  const navigation = { motion: createCameraMotion(), frame: { originM: [...origin] }, capture: () => current, apply(pose: WorldCameraPose) { current = pose; applied.push(pose); } } as unknown as ObjectWorldNavigation;
  const windowTarget = { requestAnimationFrame: (callback: (t: number) => void) => { frames.push(() => callback(time)); return frames.length; }, cancelAnimationFrame() {}, performance: { now: () => time } };
  const flight = flyToSurfaceDirection(navigation, { directionWorld: [0, 1, 0], distanceM: 6000, durationMilliseconds: 100, windowTarget });
  for (time = 0; frames.length; time += 25) frames.shift()!();
  assert.deepEqual((await flight.done), { completed: true });
  const relative = current.pose.positionM.map((value, axis) => value - origin[axis]!);
  assert.ok(Math.abs(relative[1] - (6000)) < 10 ** -6 / 2, `${relative[1]} is not close to ${6000}`);
  assert.ok(applied.length > 3);
  // A new camera owner interrupts even a write smaller than the old position tolerance.
  const interrupted = flyToSurfaceDirection(navigation, { directionWorld: [1, 0, 0], distanceM: 5000, durationMilliseconds: 100, windowTarget });
  time = 0; frames.shift()!();
  navigation.motion.cancel();
  current = { ...current, pose: { ...current.pose, positionM: [current.pose.positionM[0] + 0.001, current.pose.positionM[1], current.pose.positionM[2]] } };
  time = 25; frames.shift()!();
  assert.deepEqual((await interrupted.done), { completed: false });
  assert.equal(frames.length, 0);
  const immediate = flyToSurfaceDirection(navigation, { directionWorld: [0, 0, 1], distanceM: 7000, reducedMotion: true, windowTarget });
  assert.deepEqual((await immediate.done), { completed: true });
  assert.ok(Math.abs((current.pose.positionM[2] - origin[2]) - (7000)) < 10 ** -6 / 2, `${(current.pose.positionM[2] - origin[2])} is not close to ${7000}`);
});


test('replacement owns completion while an old surface publication is still awaiting presentation', async () => {
  const motion = createCameraMotion(), frames = new Map<number, FrameRequestCallback>();
  let next = 0, acknowledge!: (shown: boolean) => void;
  const windowTarget = { performance: { now: () => 0 },
    requestAnimationFrame(callback: FrameRequestCallback) { frames.set(++next, callback); return next; },
    cancelAnimationFrame(id: number) { frames.delete(id); } };
  const navigation = { motion, frame: { originM: [...origin] }, capture: () => world,
    apply: () => new Promise<boolean>(resolve => { acknowledge = resolve; }) } as unknown as ObjectWorldNavigation;
  const surface = flyToSurfaceDirection(navigation, { directionWorld: [0, 1, 0], distanceM: 6000, reducedMotion: true, windowTarget });
  let complete = false; void surface.done.then(() => { complete = true; });
  await Promise.resolve(); assert.equal(complete, false);
  const replacement = motion.start({ windowTarget, advance: () => 'complete' });
  assert.deepEqual((await surface.done), { completed: false });
  surface.cancel(); acknowledge(true); await Promise.resolve();
  assert.equal(replacement.signal.aborted, false);
  const [replacementId, replacementPaint] = [...frames][0]!; frames.delete(replacementId); replacementPaint(0);
  assert.deepEqual((await replacement.finished), { completed: true });
  assert.equal(frames.size, 0);
});

test('requesting arrival while a frame is pending waits for the final displayed sample', async () => {
  const motion = createCameraMotion(), frames = new Map<number, FrameRequestCallback>(), samples: number[] = [];
  let next = 0, acknowledge!: (shown: boolean) => void;
  const windowTarget = { performance: { now: () => 0 },
    requestAnimationFrame(callback: FrameRequestCallback) { frames.set(++next, callback); return next; },
    cancelAnimationFrame(id: number) { frames.delete(id); } };
  const flight = motion.fly({ windowTarget, durationMilliseconds: 1000, inputSpeedUp: 4,
    sample(progress) { samples.push(progress); return new Promise<boolean>(resolve => { acknowledge = resolve; }); } });
  const [id, paint] = [...frames][0]!; frames.delete(id); paint(0);
  motion.arrive();
  assert.deepEqual(samples, [0]);
  let settled = false; void flight.finished.then(() => { settled = true; });
  acknowledge(true); await nextTurn();
  assert.deepEqual(samples, [0, 1]);
  assert.equal(settled, false);
  acknowledge(true);
  assert.deepEqual((await flight.finished), { completed: true });
  assert.equal(motion.signal, undefined);
  assert.equal(frames.size, 0);
});
