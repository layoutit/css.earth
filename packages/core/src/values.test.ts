import { it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { canonical, isArray } from './index.js';

it('isArray narrows without trusting elements', () => {
  assert.equal(isArray([1]), true);
  assert.equal(isArray({ length: 0 }), false);
});

it('canonical sorts object keys recursively and keeps array order', () => {
  assert.equal(JSON.stringify(canonical({ b: [{ d: 1, c: 2 }], a: null })), '{"a":null,"b":[{"c":2,"d":1}]}');
});
