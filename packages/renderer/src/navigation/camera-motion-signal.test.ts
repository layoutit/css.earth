import { expect, test } from 'vitest';
import { cameraMotionSignalFor } from './camera-motion-signal.js';
import type { CameraMotionState } from './camera-motion-signal.js';

const driven = { active: true, coasting: false }, coasting = { active: true, coasting: true }, still = { active: false, coasting: false };

test('a released drag coasts until it stops, and each change is announced once', () => {
  const surface = new EventTarget(), heard: CameraMotionState[] = [], told: CameraMotionState[] = [];
  surface.addEventListener('objectmotionchange', event => heard.push((event as CustomEvent<CameraMotionState>).detail));
  const signal = cameraMotionSignalFor(surface);
  expect(cameraMotionSignalFor(surface)).toBe(signal);
  signal.subscribe(state => told.push(state));
  signal.begin('drag');
  // The throw begins before the drag ends: one change, to coasting.
  signal.begin('inertia');
  signal.end('drag');
  expect(signal.coasting).toBe(true);
  signal.end('inertia');
  signal.end('inertia');
  expect(told).toEqual([driven, coasting, still]);
  expect(heard).toEqual(told);
});

test('a hand that takes over a coast steers again', () => {
  const signal = cameraMotionSignalFor(new EventTarget()), told: CameraMotionState[] = [];
  const unsubscribe = signal.subscribe(state => told.push(state));
  signal.begin('glide');
  signal.begin('zoom');
  expect(signal).toMatchObject(driven);
  signal.end('glide');
  signal.end('zoom');
  expect(told).toEqual([coasting, driven, still]);
  unsubscribe();
  signal.begin('fly-to');
  expect(told).toHaveLength(3);
});
