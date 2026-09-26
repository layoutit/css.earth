import { createCameraMotion } from '@cssearth/renderer/navigation';
import assert from 'node:assert/strict';
import type { PositionM } from '@cssearth/engine';
import type { WorldCameraPose, PreparedWorldCameraFrame } from '@cssearth/renderer/navigation/world-camera.ts';
import type { ObjectWorldNavigation } from '@cssearth/renderer/runtime/world-navigation-types.ts';
import type { ObjectEntry } from '../object-schema.mts';

export function required<T>(value: T | null | undefined): T {
  assert.ok(value !== null && value !== undefined, 'The test requires this prepared value.');
  return value;
}
export function position(values: readonly number[]): PositionM {
  assert.equal(values.length, 3);
  assert.ok(values.every(Number.isFinite));
  return [values[0], values[1], values[2]];
}
export function quaternion(values: readonly number[]): WorldCameraPose['pose']['orientationXyzw'] {
  assert.equal(values.length, 4);
  assert.ok(values.every(Number.isFinite));
  return [values[0], values[1], values[2], values[3]];
}
export function navigationFixture(frame: PreparedWorldCameraFrame, capture: () => WorldCameraPose,
  optics: ObjectWorldNavigation['optics']): ObjectWorldNavigation {
  return { motion: createCameraMotion(), frame, capture, optics, apply() { throw new Error('This fixture only samples the camera.'); },
    preparedFocus: () => null, setPreparedFocus() {},
    async flyToPreparedFocus() { throw new Error('This fixture does not fly the camera.'); },
    subscribe() { throw new Error('This fixture does not subscribe to camera changes.'); } };
}
export function objectFixture(id: string, worldFrame: PreparedWorldCameraFrame, overrides: Partial<ObjectEntry> = {}): ObjectEntry {
  return { kind: 'scene', id, name: id, systemName: id, classification: 'planet', color: '#000000', distance: testDistance(1),
    route: `/${id}/`, description: id, worldFrame, discovery: { featured: false, imagery: false, illustration: false },
    async loadScene() { throw new Error('This fixture does not mount a scene.'); }, ...overrides };
}

export const unusedSharedView: import('@cssearth/renderer/runtime/object-scene.ts').ObjectSharedView = {
  capture: () => null,
  async restore() { throw new Error('This fixture does not restore shared URLs.'); },
  subscribe() { return () => {}; },
};

export const testDistance = (value: number) => ({ meters: value * 149597870700, value, unit: 'AU' as const, quantity: 'geometric' as const, referencePoint: 'heliocentre' as const, epochJdTt: 2461286.5 });

/** Session-only fixtures never measure or present a native frame. */
export const unusedMountOptions: Pick<import('../browser-types.mts').MountOptions, 'viewport' | 'framePresenter' | 'cameraMotion'> = {
  cameraMotion: createCameraMotion(),
  viewport: { read() { throw new Error('No native measurement in this fixture.'); }, subscribe: () => () => {}, destroy() {} },
  framePresenter: { present() { throw new Error('No native publication in this fixture.'); } },
};
