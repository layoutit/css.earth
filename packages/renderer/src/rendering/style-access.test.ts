import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { samePreparedStyle } from './style-access.js';

test('prepared color comparison respects CSSOM serialization without hiding changed colors', () => {
  assert.equal(samePreparedStyle('rgb(52, 62, 70)', 'background-color', 'rgb(52 62 70)'), true);
  assert.equal(samePreparedStyle('rgb(170, 187, 204)', 'backgroundColor', 'rgb(170 187 204)'), true);
  assert.equal(samePreparedStyle('rgb(52, 62, 71)', 'background-color', 'rgb(52 62 70)'), false);
  assert.equal(samePreparedStyle('rgba(52, 62, 70, 0.5)', 'background-color', 'rgb(52 62 70)'), false);
  assert.equal(samePreparedStyle('rgb(52, 62, 70)', '--custom-color', 'rgb(52 62 70)'), false);
  assert.equal(samePreparedStyle('scale(1)', 'transform', 'scale(2)'), false);
  assert.equal(samePreparedStyle('rgb(52 62 70)', 'background-color', 'rgb(52 62 70)'), true);
});
