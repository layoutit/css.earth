import assert from 'node:assert/strict';
import test from 'node:test';
import { magnifierPoint } from './star-position-picker.js';
import { overviewPoint } from './star-sampling-controls.js';

test('overview clicks use the native pixel-centre convention without cropping or aspect distortion', () => {
  assert.deepEqual(overviewPoint(150, 100, 300, 200, [9000, 6000]), { x: 4499.5, y: 2999.5 });
  assert.deepEqual(overviewPoint(0, 0, 300, 200, [9000, 6000]), { x: 0, y: 0 });
  assert.deepEqual(overviewPoint(300, 200, 300, 200, [9000, 6000]), { x: 8999, y: 5999 });
  assert.deepEqual(overviewPoint(75, 20, 300, 200, [9000, 6000]), { x: 2249.5, y: 599.5 });
  assert.throws(() => overviewPoint(1, 1, 0, 200, [9000, 6000]), TypeError);
});

test('magnified selection stays in original native coordinates, including cutout offsets', () => {
  assert.deepEqual(magnifierPoint(65, 65, 130, 130, { x: 500, y: 700, width: 128, height: 128 }), { x: 563.5, y: 763.5 });
  assert.deepEqual(magnifierPoint(0, 0, 130, 130, { x: 500, y: 700, width: 128, height: 128 }), { x: 500, y: 700 });
  assert.deepEqual(magnifierPoint(130, 130, 130, 130, { x: 500, y: 700, width: 128, height: 128 }), { x: 627, y: 827 });
});
