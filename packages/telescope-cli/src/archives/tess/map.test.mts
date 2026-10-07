import assert from 'node:assert/strict';
import test from 'node:test';
import { brightnessTable, LEAST_STEPS, NARROW_DECIMALS, VALUE_DECIMALS, written } from './map.mts';

test('a map is written to five decimals of its mean, and to seven when at five its range would hold under 256 steps', () => {
  assert.deepEqual([VALUE_DECIMALS, NARROW_DECIMALS, LEAST_STEPS], [5, 7, 256]);
  // A star whose light swings by a few percent: 0.97 to 1.03 is 6,000 steps of the fifth decimal.
  assert.deepEqual(written([[0.9700049, 1.0300051], [1.0000149, 0.9999951]]), [[0.97, 1.03001], [1.00001, 1]]);
  // Shangcheng in sector 52: 0.99995 to 1.00005 is ten such steps, 11 values in all at five decimals.
  const narrow = [[0.999953712, 1.000046288], [1.000001234, 0.999998766]];
  assert.deepEqual(written(narrow), [[0.9999537, 1.0000463], [1.0000012, 0.9999988]]);
  // The rule turns at 256 steps, on the map's own range and nothing else.
  assert.deepEqual(written([[1, 1.00256049]]), [[1, 1.00256]]); assert.deepEqual(written([[1, 1.00255949]]), [[1, 1.0025595]]);
  assert.deepEqual(written([[2.5, 2.50256049]]), [[2.5, 2.50256]]);
});

test('a table\'s line holds a narrow map\'s seven decimals, and a wide map\'s line is as it was', () => {
  const shape = { longitudes: [-180, 0, 180], latitudes: [-90, 90], degree: 5, inclinationDegrees: 60, periodDays: 1, residual: 0, noise: 0, starry: '1.2.0' };
  const lines = (values: number[][]) => brightnessTable('a map', { ...shape, values: written(values) }).trimEnd().split('\n').slice(5);
  assert.deepEqual(lines([[0.999953712, 1.000046288, 0.999953712], [1.000001234, 0.999998766, 1.000001234]]), [
    '      0.00000    -90.00000    100.00463', '    180.00000    -90.00000     99.99537', '    360.00000    -90.00000    100.00463',
    '      0.00000     90.00000     99.99988', '    180.00000     90.00000    100.00012', '    360.00000     90.00000     99.99988']);
  // The last two decimals of a wide map's line stay zero, as in every table written before the rule.
  for (const line of lines([[0.9700049, 1.0300051, 0.9700049], [1.0000149, 0.9999951, 1.0000149]])) assert.match(line, /\d\.\d{3}00$/u);
});
