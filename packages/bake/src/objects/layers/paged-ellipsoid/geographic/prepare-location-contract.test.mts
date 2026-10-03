import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { preparedScenePitch } from '@cssearth/engine';
import { parsePreparedObjectRuntime, parsePreparedDestinations, PREPARED_DESTINATIONS_SCHEMA } from '@cssearth/objects';
import { prepareLocationPoint, prepareLocationCamera } from './prepare-location.ts';
import { parseGeographicScene, parseBodyAttitude, parsePlacesConfig } from './source-records.ts';

const apply = (matrix: readonly number[], point: readonly number[]) => [0, 1, 2].map(row =>
  matrix[row * 3] * point[0] + matrix[row * 3 + 1] * point[1] + matrix[row * 3 + 2] * point[2]);
function rotate(point: readonly number[], axis: 'x' | 'y' | 'z', degrees: number) {
  const c = Math.cos(degrees * Math.PI / 180), s = Math.sin(degrees * Math.PI / 180), [x, y, z] = point;
  return axis === 'x' ? [x, c * y - s * z, s * y + c * z]
    : axis === 'y' ? [c * x + s * z, y, -s * x + c * z] : [c * x - s * y, s * x + c * y, z];
}

test('prepared geographic destination aligns with the retained body and passes the objects catalogue parser', async () => {
  const read = async (path: string): Promise<unknown> => JSON.parse(await readFile(new URL('../../../../../../../' + path, import.meta.url), 'utf8'));
  const rawScene = await read('src/objects/earth/prepared/scene.json');
  const config = parsePlacesConfig(await read('src/objects/earth/source/preparation/paged-ellipsoid.json'));
  const scene = parseGeographicScene(rawScene);
  const camera = parsePreparedObjectRuntime(await read('src/objects/earth/prepared/runtime.json')).camera;
  assert.equal(camera.maximumControlPitchDegrees, config.camera.maximumControlPitchDegrees);
  assert.equal(camera.maximumScenePitchDegrees, config.camera.maximumScenePitchDegrees);
  assert.ok(rawScene && typeof rawScene === 'object');
  const body = parseBodyAttitude(Reflect.get(rawScene, config.sceneBodyKey));
  const point = prepareLocationPoint(scene, -58.3816, -34.6037);
  const destination = prepareLocationCamera(scene, point, 2048, { body, camera: config.camera });
  let local = apply(body.bodyMatrix, point);
  local = rotate(local, 'y', destination.controlYaw);
  local = rotate(local, 'x', preparedScenePitch(destination.controlPitch, camera));
  // Scaling cannot change the solved direction; the generated camera transports
  // the same geographic point on the shared forward axis for any body radius.
  assert.ok(Math.hypot(local[0]!, local[1]!) < 1e-10);
  assert.ok(local[2]! > 0);
  assert.equal(destination.zoom, 2048);
  const parsed = parsePreparedDestinations({ schema: PREPARED_DESTINATIONS_SCHEMA, places: [{ id: '1', name: 'Buenos Aires',
    names: ['Buenos Aires'], context: 'Argentina', searchContext: 'argentina', camera: destination }] }, { objectId: 'fixture', count: 1 });
  assert.equal(parsed[0]?.id, '1');
});
