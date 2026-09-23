import { createCameraMotion } from '../navigation/camera-motion.js';
import { expect, test } from 'vitest';
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
  expect(relative[0]).toBeCloseTo(0, 6);
  expect(relative[1]).toBeCloseTo(0, 6);
  expect(relative[2]).toBeCloseTo(5000, 6);
  const half = surfaceOrbitPose(world, [...origin], rotation, 0.5, 4000);
  const halfRelative = half.pose.positionM.map((value, axis) => value - origin[axis]!);
  expect(Math.hypot(...halfRelative)).toBeCloseTo(4000, 6);
  expect(Math.atan2(halfRelative[2]!, halfRelative[0]!)).toBeCloseTo(Math.PI / 4, 6);
  expect(Math.hypot(...half.pose.orientationXyzw)).toBeCloseTo(1, 9);
});

test('a flight applies eased poses each frame, ends on the target, and yields to any other camera write', async () => {
  const applied: WorldCameraPose[] = [];
  let current = world, time = 0;
  const frames: (() => void)[] = [];
  const navigation = { motion: createCameraMotion(), frame: { originM: [...origin] }, capture: () => current, apply(pose: WorldCameraPose) { current = pose; applied.push(pose); } } as unknown as ObjectWorldNavigation;
  const windowTarget = { requestAnimationFrame: (callback: (t: number) => void) => { frames.push(() => callback(time)); return frames.length; }, cancelAnimationFrame() {}, performance: { now: () => time } };
  const flight = flyToSurfaceDirection(navigation, { directionWorld: [0, 1, 0], distanceM: 6000, durationMilliseconds: 100, windowTarget });
  for (time = 0; frames.length; time += 25) frames.shift()!();
  expect(await flight.done).toEqual({ completed: true });
  const relative = current.pose.positionM.map((value, axis) => value - origin[axis]!);
  expect(relative[1]).toBeCloseTo(6000, 6);
  expect(applied.length).toBeGreaterThan(3);
  // A new camera owner interrupts even a write smaller than the old position tolerance.
  const interrupted = flyToSurfaceDirection(navigation, { directionWorld: [1, 0, 0], distanceM: 5000, durationMilliseconds: 100, windowTarget });
  time = 0; frames.shift()!();
  navigation.motion.cancel();
  current = { ...current, pose: { ...current.pose, positionM: [current.pose.positionM[0] + 0.001, current.pose.positionM[1], current.pose.positionM[2]] } };
  time = 25; frames.shift()!();
  expect(await interrupted.done).toEqual({ completed: false });
  expect(frames).toHaveLength(0);
  const immediate = flyToSurfaceDirection(navigation, { directionWorld: [0, 0, 1], distanceM: 7000, reducedMotion: true, windowTarget });
  expect(await immediate.done).toEqual({ completed: true });
  expect(current.pose.positionM[2] - origin[2]).toBeCloseTo(7000, 6);
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
  await Promise.resolve(); expect(complete).toBe(false);
  const replacement = motion.start({ windowTarget, advance: () => 'complete' });
  expect(await surface.done).toEqual({ completed: false });
  surface.cancel(); acknowledge(true); await Promise.resolve();
  expect(replacement.signal.aborted).toBe(false);
  const [replacementId, replacementPaint] = [...frames][0]!; frames.delete(replacementId); replacementPaint(0);
  expect(await replacement.finished).toEqual({ completed: true });
  expect(frames.size).toBe(0);
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
  expect(samples).toEqual([0]);
  let settled = false; void flight.finished.then(() => { settled = true; });
  acknowledge(true); await nextTurn();
  expect(samples).toEqual([0, 1]);
  expect(settled).toBe(false);
  acknowledge(true);
  expect(await flight.finished).toEqual({ completed: true });
  expect(motion.signal).toBeUndefined();
  expect(frames.size).toBe(0);
});
