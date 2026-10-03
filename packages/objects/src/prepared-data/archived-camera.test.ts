import assert from 'node:assert/strict';
import test from 'node:test';
import { ARCHIVED_CAMERA_SCHEMA, parseArchivedCamera, parseMatrixArchivedCamera } from './archived-camera.js';

const camera = { schema: ARCHIVED_CAMERA_SCHEMA, matrix: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]],
  rayMatrix: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], positionKm: [0, 0, 1], sunDirection: [1, 0, 0] };

test('archived camera preserves authored parsing and separate geometric admission', () => {
  assert.equal(ARCHIVED_CAMERA_SCHEMA, 'cssearth-archived-camera@1');
  assert.deepEqual(parseArchivedCamera(camera), camera);
  assert.deepEqual(parseMatrixArchivedCamera(camera), camera);
  const loose = { ...camera, schema: 'legacy-camera', matrix: [[1]] };
  assert.deepEqual(parseArchivedCamera(loose), loose);
  for (const invalid of [loose, { ...camera, matrix: [[1, 2, 3]] }, { ...camera, rayMatrix: [[1, 2]] },
    { ...camera, positionKm: [1] }, { ...camera, sunDirection: [2, 0, 0] }]) {
    assert.throws(() => parseMatrixArchivedCamera(invalid), /^Error: Invalid archived source camera\.$/u);
  }
  assert.throws(() => parseArchivedCamera({ ...camera, positionKm: ['bad'] }), TypeError);
});
