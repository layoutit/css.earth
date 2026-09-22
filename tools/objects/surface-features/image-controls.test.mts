import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { fitImageControls } from './image-controls.mts';

const close = (actual: number, expected: number, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
const transformed = (model: 'similarity' | 'reflected-similarity', coefficients: readonly [number, number, number, number], [x, y]: readonly [number, number]) => {
  const [a, b, tx, ty] = coefficients;
  return model === 'similarity' ? [a * x - b * y + tx, b * x + a * y + ty] : [-a * x + b * y + tx, b * x + a * y + ty];
};
const document = (model: 'similarity' | 'reflected-similarity', coefficients: readonly [number, number, number, number]) => {
  const points = [[0, 0], [10, 0], [0, 10], [12, 7], [-3, 8], [7, -4]] as const;
  return { schema: 'cssearth-image-controls@1', model, maximumRmsPixels: 0.001, maximumResidualPixels: 0.001,
    controls: points.map((sourcePixel, index) => ({ id: `c${index}`, partition: index < 3 ? 'fit' : 'holdout', sourcePixel, targetPixel: transformed(model, coefficients, sourcePixel) })) };
};

test('fits an independent similarity and returns reversible image-pixel mapping', () => {
  const result = fitImageControls(document('similarity', [1.25, -0.5, 20, -7]));
  result.coefficients.forEach((value, index) => close(value, [1.25, -0.5, 20, -7][index]!));
  assert.deepEqual(result.stats, { fit: { count: 3, rmsPixels: 0, maximumPixels: 0 }, holdout: { count: 3, rmsPixels: 0, maximumPixels: 0 } });
  const target = result.transform([4, -2]); close(target[0], 24); close(target[1], -11.5);
  const source = result.inverse(target); close(source[0], 4); close(source[1], -2);
});

test('fits reflected similarity for explicitly flipped image rows', () => {
  const result = fitImageControls(document('reflected-similarity', [0.3, 0.2, 500, 700]));
  result.coefficients.forEach((value, index) => close(value, [0.3, 0.2, 500, 700][index]!));
  const target = result.transform([100, 40]); close(target[0], 478); close(target[1], 732);
  const source = result.inverse(target); close(source[0], 100); close(source[1], 40);
  assert.equal(result.residuals.filter(control => control.partition === 'holdout').length, 3);
});

test('rejects collinear fits and malformed external values', () => {
  const bad = document('similarity', [1, 0, 0, 0]);
  assert.throws(() => fitImageControls({ ...bad, controls: bad.controls.map((control, index) => ({ ...control, sourcePixel: [index, 0] })) }), /collinear/u);
  assert.throws(() => fitImageControls({ ...bad, schema: 'other' }), /schema/u);
  assert.throws(() => fitImageControls({ ...bad, controls: [...bad.controls, { ...bad.controls[0], id: 'c0' }] }), /distinct/u);
  assert.throws(() => fitImageControls({ ...bad, controls: bad.controls.map(control => ({ ...control, targetPixel: [Infinity, 0] })) }), /finite/u);
  assert.throws(() => fitImageControls({ ...bad, maximumRmsPixels: -1 }), /nonnegative/u);
});

test('rejects a displaced holdout while fitting only the fit partition', () => {
  const source = document('similarity', [1, 0, 2, 3]);
  const controls = source.controls.map(control => control.partition === 'holdout' && control.id === 'c3' ? { ...control, targetPixel: [control.targetPixel[0] + 5, control.targetPixel[1]] } : control);
  assert.throws(() => fitImageControls({ ...source, maximumRmsPixels: 1, maximumResidualPixels: 2, controls }), /holdout exceeds/u);
  const accepted = fitImageControls({ ...source, maximumRmsPixels: 10, maximumResidualPixels: 10, controls });
  accepted.coefficients.forEach((value, index) => close(value, [1, 0, 2, 3][index]!));
  close(accepted.stats.holdout.maximumPixels, 5);
});

test('rejects a fit outlier even when holdouts are within thresholds', () => {
  const source = document('similarity', [1, 0, 2, 3]);
  const controls = source.controls.map(control => control.partition === 'fit' && control.id === 'c2' ? { ...control, targetPixel: [control.targetPixel[0] + 5, control.targetPixel[1]] } : control);
  assert.throws(() => fitImageControls({ ...source, maximumRmsPixels: 1, maximumResidualPixels: 2, controls }), /fit exceeds/u);
});

test('fits and inverts an affine image registration', () => {
  const coefficients = [1.1, -0.2, 4, 0.15, 0.9, -7] as const;
  const points = [[0, 0], [10, 0], [0, 10], [12, 7], [-3, 8], [7, -4]] as const;
  const source = { schema: 'cssearth-image-controls@1', model: 'affine', maximumRmsPixels: 0.001, maximumResidualPixels: 0.001,
    controls: points.map((sourcePixel, index) => ({ id: `a${index}`, partition: index < 3 ? 'fit' : 'holdout', sourcePixel,
      targetPixel: [coefficients[0] * sourcePixel[0] + coefficients[1] * sourcePixel[1] + coefficients[2], coefficients[3] * sourcePixel[0] + coefficients[4] * sourcePixel[1] + coefficients[5]] })) };
  const result = fitImageControls(source); result.coefficients.forEach((value, index) => close(value, coefficients[index]!));
  const target = result.transform([4, -2]); close(target[0], 8.8); close(target[1], -8.2);
  const recovered = result.inverse(target); close(recovered[0], 4); close(recovered[1], -2);
  assert.throws(() => fitImageControls({ ...source, controls: source.controls.map(control => ({ ...control, targetPixel: [control.targetPixel[0], 0] })) }), /zero area/u);
});
