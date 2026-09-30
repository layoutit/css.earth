import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import type { Vector3 } from '@cssearth/renderer/solar-system/types.ts';
import { preparedControlPitch } from '@cssearth/engine';
import { LOPSIDED_COVERAGE, MINIMUM_COVERED_SHARE, prepareDefaultCameraAngles } from '@cssearth/bake/objects/scene';
import { authoredFocusDatasets, coverageDirection, coveredShare, faceDatasetData } from '@cssearth/bake/objects/default-view';
import * as solarGeometry from '../../../src/platform/solar-geometry.mts';

const point = (longitude: number, latitude: number, length = 0.7) => { const l = longitude * Math.PI / 180, b = latitude * Math.PI / 180;
  return [length * Math.cos(b) * Math.cos(l), length * Math.cos(b) * Math.sin(l), length * Math.sin(b)] as unknown as Vector3; };
const camera = { maximumZoom: 4, defaultZoom: 1.1, maximumControlPitchDegrees: 180, maximumScenePitchDegrees: 90 };
const variant = (datasetId: string, navigation?: Record<string, unknown>) => ({ when: { datasetId, shadows: false }, required: [], writes: [], ...(navigation ? { navigation } : {}) });
const face = (variants: unknown[], coverages: [string, Vector3][], authored: string[] = [], mapLeftEdgeLongitudeDeg = 0) =>
  faceDatasetData({ variants }, { geometry: solarGeometry, bodyId: 'iapetus', mapLeftEdgeLongitudeDeg, camera, coverages: new Map(coverages), authored: new Set(authored) }).variants as Record<string, any>[];

test('a lopsided dataset turns toward its data by the default camera rule, keeping the reader zoom', () => {
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

test('the default dataset keeps the opening camera', () => {
  const variants = faceDatasetData({ controls: { datasets: { defaultDataset: 'normal', controls: [] } }, variants: [variant('normal'), variant('temperature')] },
    { geometry: solarGeometry, bodyId: 'iapetus', mapLeftEdgeLongitudeDeg: 0, camera, authored: new Set(),
      coverages: new Map([['normal', point(274, 29)], ['temperature', point(274, 29)]]) }).variants as Record<string, any>[];
  assert.equal(variants[0]!.navigation, undefined);
  assert.ok(variants[1]!.navigation.camera);
});

test('authored focus datasets come from terrestrial focus and composite datasetFocus', () => {
  const terrestrial = { raster: { scientific: [{ id: 'elevation', focus: { longitudeDegrees: 1, latitudeDegrees: 2, zoom: 3 } }, { id: 'geology' }], observations: [{ id: 'giotto', focus: {} }] } };
  assert.deepEqual([...authoredFocusDatasets(terrestrial, { datasetFocus: { infrared: {} } })].sort(), ['elevation', 'giotto', 'infrared']);
  assert.deepEqual([...authoredFocusDatasets(undefined, undefined)], []);
});

test('a map with next to no data has no side to face, however lopsided its few cells look', () => {
  const width = 360, height = 180, missing = new Uint8Array(width * height).fill(1);
  // A few cells along one northern parallel, as a lossy minimap of an empty map reads its painted line.
  for (let x = 0; x < 60; x++) missing[20 * width + x] = 0;
  const sparse = { dataset: 'model', missing, width, height, leftEdgeLongitudeDeg: 0 };
  assert.ok(Math.hypot(...coverageDirection(sparse)) > LOPSIDED_COVERAGE, 'the stray cells alone would turn the camera');
  assert.ok(coveredShare(sparse) < MINIMUM_COVERED_SHARE);
  const half = { ...sparse, missing: Uint8Array.from({ length: width * height }, (_, i) => Number(i % width >= width / 2)) };
  assert.ok(Math.abs(coveredShare(half) - 0.5) < 1e-9);
});
