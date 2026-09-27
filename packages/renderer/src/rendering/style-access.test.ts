import { expect, test } from 'vitest';
import { samePreparedStyle } from './style-access.js';

test('prepared color comparison respects CSSOM serialization without hiding changed colors', () => {
  expect(samePreparedStyle('rgb(52, 62, 70)', 'background-color', 'rgb(52 62 70)')).toBe(true);
  expect(samePreparedStyle('rgb(170, 187, 204)', 'backgroundColor', 'rgb(170 187 204)')).toBe(true);
  expect(samePreparedStyle('rgb(52, 62, 71)', 'background-color', 'rgb(52 62 70)')).toBe(false);
  expect(samePreparedStyle('rgba(52, 62, 70, 0.5)', 'background-color', 'rgb(52 62 70)')).toBe(false);
  expect(samePreparedStyle('rgb(52, 62, 70)', '--custom-color', 'rgb(52 62 70)')).toBe(false);
  expect(samePreparedStyle('scale(1)', 'transform', 'scale(2)')).toBe(false);
  expect(samePreparedStyle('rgb(52 62 70)', 'background-color', 'rgb(52 62 70)')).toBe(true);
});
