/**
 * Every body that records an observer-camera derivation states, in its recipe, exactly the camera fields its pinned
 * inputs give. Without this the eight numbers per frame are hand-copied constants and the derivation is code the
 * build never runs. The disc centre is part of the derivation, so it is checked too: nothing in the recipe is fitted.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { deriveObserverCameras, loadObserverCameraInputs, parseObserverCameras, recipeFields, zimpolExposure, OBSERVER_CAMERAS_FILE, OBSERVER_CAMERAS_SCHEMA } from './observer-cameras.mts';
import { loadCameraShape } from './shape-camera-mosaic.mts';
import { radialTerrainForLens } from './radial-models.mts';

const ROOT = resolve(import.meta.dirname, '../../..'), OBJECTS = resolve(ROOT, 'src/objects');
const bodies = readdirSync(OBJECTS).filter(id => existsSync(resolve(OBJECTS, id, 'source', OBSERVER_CAMERAS_FILE))).sort();

test('at least the five SPHERE photograph bodies record their derivation', () => {
  for (const id of ['ausonia', 'kalliope', 'kleopatra', 'psyche', 'sylvia']) assert.ok(bodies.includes(id), `${id} records an observer-camera derivation`);
});

for (const id of bodies) test(`${id}: the recipe states the cameras its pinned inputs derive`, async () => {
  const sourceDirectory = resolve(OBJECTS, id, 'source');
  const { record, recipe, frames } = await loadObserverCameraInputs(sourceDirectory);
  const mesh = await loadCameraShape(sourceDirectory, radialTerrainForLens(recipe as unknown as Parameters<typeof radialTerrainForLens>[0], record.lensId));
  const derived = await deriveObserverCameras(sourceDirectory, record, frames, mesh, ROOT);
  assert.equal(derived.length, frames.length);
  for (const [index, camera] of derived.entries()) {
    const stated = frames[index].stated, fields = recipeFields(camera);
    for (const [key, value] of Object.entries(fields)) assert.deepEqual(stated[key], value, `${id} ${camera.id} ${key}: recipe states ${JSON.stringify(stated[key])}, the pinned inputs give ${JSON.stringify(value)}`);
    assert.ok(camera.limb.limbBins >= 8 && camera.limb.movedPixels < 0.5, `${id} ${camera.id}: the limb fit settled (${camera.limb.limbBins} bins, last move ${camera.limb.movedPixels} px)`);
    // The two sub-points are consistent with the phase angle the geometry implies, whichever way the frame is handed.
    const point = (latitude: number, longitude: number) => [Math.cos(latitude * Math.PI / 180) * Math.cos(longitude * Math.PI / 180), Math.cos(latitude * Math.PI / 180) * Math.sin(longitude * Math.PI / 180), Math.sin(latitude * Math.PI / 180)];
    const a = point(camera.observerLatitude, camera.observerWestLongitude), s = point(camera.sunLatitude, camera.sunWestLongitude);
    const phase = Math.acos(Math.max(-1, Math.min(1, a[0] * s[0] + a[1] * s[1] + a[2] * s[2]))) * 180 / Math.PI;
    assert.ok(phase >= 0 && phase < 40, `${id} ${camera.id}: a main-belt body seen from Earth has a small phase angle (${phase.toFixed(1)})`);
  }
});

test('the record refuses a rotation model it cannot evaluate', () => {
  const base = { schema: OBSERVER_CAMERAS_SCHEMA, lensId: 'zimpol', ephemeris: { observer: 'a', heliocentric: 'b' }, epoch: 'exposure-midpoint', centre: { method: 'limb', edgeFraction: 0.25 } };
  assert.doesNotThrow(() => parseObserverCameras({ ...base, rotation: { kind: 'spin-record', path: 'p', columnOrder: 'latitude-first' } }));
  assert.doesNotThrow(() => parseObserverCameras({ ...base, rotation: { kind: 'iau-pck', path: 'p', body: 2000004 } }));
  assert.throws(() => parseObserverCameras({ ...base, rotation: { kind: 'spin-record', path: 'p' } }), /column order/);
  assert.throws(() => parseObserverCameras({ ...base, rotation: { kind: 'iau-pck', path: 'p' } }), /body code/);
  assert.throws(() => parseObserverCameras({ ...base, rotation: { kind: 'spin-record', path: 'p', columnOrder: 'latitude-first' }, epoch: 'exposure-start' }), /exposure-midpoint/);
  assert.throws(() => parseObserverCameras({ ...base, schema: 'other', rotation: { kind: 'spin-record', path: 'p', columnOrder: 'latitude-first' } }), /schema/);
});

test('a frame header states its exposure, and the midpoint is half the stated exposure after the start', () => {
  const exposure = zimpolExposure({ 'DATE-OBS': "'2018-06-08T05:27:05.809'", 'ESO DET SEQ1 EXPTIME': '81.29684', 'ESO INS3 OPTI5 NAME': "'N_R     '", CD1_1: '-1.00833333333333E-6' });
  assert.equal(exposure.filter, 'N_R');
  assert.ok(Math.abs(exposure.exposureSeconds - 81.29684) < 1e-9);
  assert.ok(Math.abs(exposure.pixelAngleMicroradians - 0.017599) < 1e-6);
  assert.ok(Math.abs(exposure.startJd - 2458277.7271505) < 1e-6, `start ${exposure.startJd}`);
  assert.throws(() => zimpolExposure({ 'DATE-OBS': "'2018-06-08T05:27:05.809'", 'ESO INS3 OPTI5 NAME': "'N_R'", CD1_1: '1e-6' }), /exposure time/);
});
