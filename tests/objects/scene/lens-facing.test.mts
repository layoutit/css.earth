import assert from 'node:assert/strict';
import { sourceTest } from '../source-test.mts';
const test = sourceTest();
import type { Vector3 } from '@cssearth/renderer/solar-system/types.ts';
import { preparedControlPitch } from '@cssearth/engine';
import { LOPSIDED_COVERAGE, prepareDefaultCameraAngles } from '@cssearth/bake/objects/scene';
import { authoredFocusLenses, faceLensData } from '@cssearth/bake/objects/default-view';
import * as solarGeometry from '../../../src/platform/solar-geometry.mts';

const point = (longitude: number, latitude: number, length = 0.7) => { const l = longitude * Math.PI / 180, b = latitude * Math.PI / 180;
  return [length * Math.cos(b) * Math.cos(l), length * Math.cos(b) * Math.sin(l), length * Math.sin(b)] as unknown as Vector3; };
const camera = { maximumZoom: 4, defaultZoom: 1.1, maximumControlPitchDegrees: 180, maximumScenePitchDegrees: 90 };
const variant = (lensId: string, navigation?: Record<string, unknown>) => ({ when: { lensId, shadows: false }, required: [], writes: [], ...(navigation ? { navigation } : {}) });
const face = (variants: unknown[], coverages: [string, Vector3][], authored: string[] = [], mapLeftEdgeLongitudeDeg = 0) =>
  faceLensData({ variants }, { geometry: solarGeometry, bodyId: 'iapetus', mapLeftEdgeLongitudeDeg, camera, coverages: new Map(coverages), authored: new Set(authored) }).variants as Record<string, any>[];

test('a lopsided lens turns toward its data by the default camera rule, keeping the reader zoom', () => {
  const [faced] = face([variant('temperature')], [['temperature', point(274, 29)]]);
  const angles = prepareDefaultCameraAngles(solarGeometry, 'iapetus', { coverage: point(274, 29) });
  assert.deepEqual(faced!.navigation.camera, { controlPitch: preparedControlPitch(angles.initialScenePitchDegrees, camera),
    controlYaw: angles.defaultControlYawDegrees, zoom: camera.defaultZoom, transition: { durationMilliseconds: faced!.navigation.camera.transition.durationMilliseconds, preserveZoom: true } });
  assert.equal(faced!.navigation.maximumZoom, camera.maximumZoom);
});

test('the map frame turns with the surface map left edge', () => {
  const [shifted] = face([variant('temperature')], [['temperature', point(94, 29)]], [], 180);
  const [plain] = face([variant('temperature')], [['temperature', point(274, 29)]]);
  assert.ok(Math.abs(shifted!.navigation.camera.controlYaw - plain!.navigation.camera.controlYaw) < 1e-9);
});

test('an even map carries no camera, even one an earlier run wrote, and keeps its zoom limit', () => {
  const [even, stale] = face([variant('normal'), variant('ice', { maximumZoom: 3, camera: { controlPitch: 1, controlYaw: 2, zoom: 1 } })],
    [['normal', point(0, 0, LOPSIDED_COVERAGE - 0.01)], ['ice', point(10, 0, 0.02)]]);
  assert.equal(even!.navigation, undefined);
  assert.deepEqual(stale!.navigation, { maximumZoom: 3, camera: null });
});

test('an authored focus is kept, whatever the coverage says', () => {
  const authoredCamera = { controlPitch: 64, controlYaw: -172, zoom: 1.15 };
  const [kept] = face([variant('infrared', { maximumZoom: 4, camera: authoredCamera })], [['infrared', point(200, -40)]], ['infrared']);
  assert.deepEqual(kept!.navigation.camera, authoredCamera);
});

test('authored focus lenses come from terrestrial focus and composite lensFocus', () => {
  const terrestrial = { raster: { scientific: [{ id: 'elevation', focus: { longitudeDegrees: 1, latitudeDegrees: 2, zoom: 3 } }, { id: 'geology' }], observations: [{ id: 'giotto', focus: {} }] } };
  assert.deepEqual([...authoredFocusLenses(terrestrial, { lensFocus: { infrared: {} } })].sort(), ['elevation', 'giotto', 'infrared']);
  assert.deepEqual([...authoredFocusLenses(undefined, undefined)], []);
});
