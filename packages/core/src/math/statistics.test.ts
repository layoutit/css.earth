import { expect, it } from 'vitest';
import { median } from '../index.js';

it('median averages the middle pair, sorts in place and gives NaN for an empty sample', () => {
  const values = [3, 1, 2, 10];
  expect(median(values)).toBe(2.5);
  expect(values).toEqual([1, 2, 3, 10]);
  expect(median([5, 1, 3])).toBe(3);
  expect(median([])).toBeNaN();
});
