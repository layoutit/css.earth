import { expect, it } from 'vitest';
import { canonical, isArray } from './index.js';

it('isArray narrows without trusting elements', () => {
  expect(isArray([1])).toBe(true);
  expect(isArray({ length: 0 })).toBe(false);
});

it('canonical sorts object keys recursively and keeps array order', () => {
  expect(JSON.stringify(canonical({ b: [{ d: 1, c: 2 }], a: null }))).toBe('{"a":null,"b":[{"c":2,"d":1}]}');
});
