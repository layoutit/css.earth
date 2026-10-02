import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOrZero, normalize3OrZero, normalize3OrZeroNonPositive, normalizeOrThrow, normalize3Unchecked } from '../index.js';

function identical(actual: readonly number[], expected: readonly number[]) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => assert.ok(Object.is(value, expected[index]), `component ${index}`));
}

const corpus = [
  { input: [3, 4, 0], expected: [.6, .8, 0] },
  { input: [0, -0, 0], expected: [0, -0, 0] },
  { input: [Number.MIN_VALUE, 0, -0], expected: [1, 0, -0] },
  { input: [1e-300, 0, 0], expected: [1, 0, 0] },
  { input: [1e300, 0, 0], expected: [1, 0, 0] },
  { input: [Infinity, 1, -0], expected: [NaN, 0, -0] },
];

test('zero-divisor fallback preserves signs, denormals, tiny and huge values', () => {
  for (const { input, expected } of corpus) {
    identical(normalizeOrZero(input), expected);
    identical(normalize3OrZero(input), expected);
  }
  identical(normalizeOrZero([NaN, 2, -0]), [NaN, 2, -0]);
  identical(normalize3OrZero([NaN, 2, -0]), [NaN, 2, -0]);
  identical(normalizeOrZero([]), []);
  identical(normalizeOrZero([3, 4]), [.6, .8]);
  identical(normalize3OrZero([3, 4]), [.6, .8, NaN]);
  identical(normalizeOrZero([0, 0, 0, 2]), [0, 0, 0, 1]);
  identical(normalize3OrZero([0, 0, 0, 2]), [0, 0, 0]);
});

test('non-positive length policy returns positive zeros, including for NaN', () => {
  identical(normalize3OrZeroNonPositive([0, -0, 0]), [0, 0, 0]);
  identical(normalize3OrZeroNonPositive([NaN, 2, -0]), [0, 0, 0]);
  for (const { input, expected } of corpus.filter(({ input }) => Math.hypot(...input) > 0)) {
    identical(normalize3OrZeroNonPositive(input), expected);
  }
});

test('throw policy preserves the caller error object and accepts infinite length', () => {
  const failure = new RangeError('Direction has no magnitude.');
  for (const input of [[0, -0, 0], [NaN, 1, 2], []]) {
    assert.throws(() => normalizeOrThrow(input, () => failure), error => error === failure);
  }
  for (const { input, expected } of corpus.filter(({ input }) => Math.hypot(...input) > 0)) {
    identical(normalizeOrThrow(input, () => { throw new Error('unexpected failure'); }), expected);
  }
});

test('unchecked division produces NaNs for zero and NaN length', () => {
  identical(normalize3Unchecked([0, -0, 0]), [NaN, NaN, NaN]);
  identical(normalize3Unchecked([NaN, 2, -0]), [NaN, NaN, NaN]);
  for (const { input, expected } of corpus.filter(({ input }) => Math.hypot(...input) > 0)) {
    identical(normalize3Unchecked(input), expected);
  }
});
