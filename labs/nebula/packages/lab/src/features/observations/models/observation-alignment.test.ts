import assert from 'node:assert/strict';
import test from 'node:test';
import { adjustedMatrix, imageCorners, readAdjustment, readObservations, transform, unchanged } from './model.js';

function fixture() {
  const source = { width: 6000, height: 4000, url: 'https://example.org/original.tif', page: 'https://example.org/source', sha256: 'a'.repeat(64), credit: 'Observation credit' };
  const row = { id: 'a', label: 'Source A', source, layers: { original: { path: '.local/a.webp', width: 1500, height: 1000 } },
    imageToFrame: [.12, .04, -.04, .12, 170, 50], registration: { status: 'verified', matchedStars: 80, rmsPixels: .2, maxResidualPixels: .8 } };
  return { schema: 'cssearth-nebula-observations@1', id: 'any-nebula', frame: { width: 1024, height: 1024, fieldArcminutes: [60, 60], centerIcrsDegrees: [12, -20], northUp: true }, images: [row, { ...row, id: 'b', label: 'Source B' }] };
}

test('alignment uses native image edges regardless of preview resolution', () => {
  const data = readObservations(fixture()), image = data.images[0]!;
  const matrix = adjustedMatrix(image, data.frame, unchanged);
  assert.deepEqual(matrix, image.imageToFrame);
  assert.deepEqual(imageCorners(image, matrix), [[170, 50], [890, 290], [10, 530], [730, 770]]);
  assert.notDeepEqual(imageCorners(image, matrix)[3], transform(matrix, [image.layers.original.width, image.layers.original.height]));
});

test('manual fit rotates around registered center and leaves original registration intact', () => {
  const data = readObservations(fixture()), image = data.images[0]!, prior = [...image.imageToFrame];
  const oldCenter = transform(image.imageToFrame, [3000, 2000]);
  const next = adjustedMatrix(image, data.frame, { x: 1, y: 2, scale: 2, rotation: 90 });
  const center = transform(next, [3000, 2000]);
  assert.ok(Math.abs(center[0] - oldCenter[0] - 1024 / 60) < 1e-10);
  assert.ok(Math.abs(center[1] - oldCenter[1] + 2 * 1024 / 60) < 1e-10, 'Positive north moves upward.');
  const before = transform(image.imageToFrame, [4000, 2000]), after = transform(next, [4000, 2000]);
  assert.ok(Math.abs(after[0] - center[0] + 2 * (before[1] - oldCenter[1])) < 1e-10);
  assert.ok(Math.abs(after[1] - center[1] - 2 * (before[0] - oldCenter[0])) < 1e-10);
  assert.deepEqual(image.imageToFrame, prior);
});

test('invalid sky registration and unsafe source paths fail at JSON boundary', () => {
  const singular = fixture(); singular.images[0]!.imageToFrame = [1, 1, 1, 1, 0, 0];
  assert.throws(() => readObservations(singular), /Invalid observation/);
  const outside = fixture(); outside.images[0]!.layers.original.path = '../source.webp';
  assert.throws(() => readObservations(outside), /Invalid observation image layer/);
  const invalidFit = { x: NaN, y: 0, rotation: 0, scale: -1 };
  assert.deepEqual(readAdjustment(invalidFit), unchanged);
});
