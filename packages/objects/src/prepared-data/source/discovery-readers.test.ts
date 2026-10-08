import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { SHAPE_MODEL_SCHEMA, readShapeModelDiscovery, readRuntimeCamera, readRuntimeCameraPrefix } from './discovery-readers.js';
import { OBJECT_RUNTIME_SCHEMA } from '../runtime/object-controls.js';
import { PREPARED_DESTINATIONS_SCHEMA, readDestinationSettlements } from '../content/prepared-destinations.js';

test('shape discovery validates its schema and projects dataset/science', () => {
  const value = { schema: SHAPE_MODEL_SCHEMA, surfaces: [{ dataset: 'shape', science: { kind: 'neutral-shape' }, image: 'unused' }] };
  assert.deepEqual(readShapeModelDiscovery(value), { surfaces: [{ id: 'shape', science: { kind: 'neutral-shape' } }] });
  assert.throws(() => readShapeModelDiscovery({ ...value, schema: 'wrong' }));
  assert.throws(() => readShapeModelDiscovery({ ...value, surfaces: [{ dataset: 7 }] }));
  assert.throws(() => readShapeModelDiscovery({ ...value, surfaces: [{ dataset: 'shape', science: { kind: false } }] }));
});
test('settlement subset requires schema/count and finite coordinates', () => {
  const pin = { objectId: 'earth', count: 1 }, value = { schema: PREPARED_DESTINATIONS_SCHEMA, places: [{ id: 12, name: 'City', latitude: 1, longitude: 2 }] };
  assert.deepEqual(readDestinationSettlements(value, pin), [{ id: '12', name: 'City', latitudeDeg: 1, longitudeDeg: 2 }]);
  assert.throws(() => readDestinationSettlements({ ...value, schema: 'wrong' }, pin));
  assert.throws(() => readDestinationSettlements(value, { ...pin, count: 2 }));
  assert.throws(() => readDestinationSettlements({ ...value, places: [{ ...value.places[0], latitude: NaN }] }, pin));
});
test('runtime camera prefix and full projection validate the same envelope', () => {
  assert.throws(() => readRuntimeCamera({ schema: 'wrong', camera: {} }));
  assert.throws(() => readRuntimeCamera({ schema: OBJECT_RUNTIME_SCHEMA, camera: {} }));
  assert.throws(() => readRuntimeCameraPrefix(JSON.stringify({ schema: 'wrong', camera: {} })));
  assert.equal(readRuntimeCameraPrefix('{"schema":'), null);
  // The consumer takes the stored runtime's head through its reader and delegates the check; it cannot return an unchecked camera.
  const source = readFileSync(new URL('../../../../../site/build/prepare/prepare-object-discovery.mts', import.meta.url), 'utf8');
  assert.match(source, /readPreparedRuntimeHead\(preparedDirectory, \['schema', 'camera'\]\)/u);
  assert.match(source, /readRuntimeCamera\(head\)/u);
});

test('full and truncated transports admit the same valid camera and reject a wrong envelope', () => {
  const camera = { cameraModel: 'accumulated-matrix3d', pitchBounded: false, yawBounded: false,
    minimumControlPitchDegrees: -90, maximumControlPitchDegrees: 90, defaultControlPitchDegrees: 0,
    defaultControlYawDegrees: 0, initialScenePitchDegrees: 0, maximumScenePitchDegrees: 90,
    minimumZoom: 1, maximumZoom: 2, defaultZoom: 1, sceneScale: 1, logicalBodyDiameter: 1,
    responsiveFit: { model: 'continuous-aspect-smoothstep', portraitBaseWidthShare: 1, narrowPortraitWidthShareGain: 0,
      landscapeWidthShareGain: 0, narrowPortraitAspectRatio: .5, portraitAspectRatio: .75, squareAspectRatio: 1,
      maximumHeightShare: 1, maximumMobilePreviewShare: 1, minimumZoom: 1, maximumZoom: 2 } };
  const value = { schema: OBJECT_RUNTIME_SCHEMA, camera };
  assert.equal(readRuntimeCamera(value), camera);
  const prefix = JSON.stringify(value).slice(0, -1) + ',"largeUnfinishedDataset":';
  assert.deepEqual(readRuntimeCameraPrefix(prefix)?.camera, camera);
  assert.throws(() => readRuntimeCamera({ ...value, schema: 'wrong' }));
  assert.throws(() => readRuntimeCameraPrefix(prefix.replace(OBJECT_RUNTIME_SCHEMA, 'wrong')));
});

test('discovery schema identifiers retain historical spellings', () => {
  assert.equal(SHAPE_MODEL_SCHEMA, 'cssearth-shape-model@2');
  assert.equal(OBJECT_RUNTIME_SCHEMA, 'cssearth-object-runtime@5');
  assert.equal(PREPARED_DESTINATIONS_SCHEMA, 'cssearth-prepared-destinations@1');
});
