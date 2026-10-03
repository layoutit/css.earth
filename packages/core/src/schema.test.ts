import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { array, boolean, dictionary, json, literal, nil, number, object, optional, parse, string, tuple, union } from './schema.js';

const message = (run: () => unknown): string => {
  try { run(); } catch (error) { if (error instanceof TypeError) return error.message; throw error; }
  throw new Error('expected a TypeError');
};

describe('structural guards (the material-composition dialect)', () => {
  const recipe = object({ id: string, size: number, tags: array(string), mode: literal('a', 'b'), flag: optional(boolean) });
  it('narrow without copying', () => {
    const value = { id: 'x', size: 1, tags: [], mode: 'a' };
    assert.equal(parse(value, recipe), value);
    assert.equal(number(NaN), false);
    assert.equal(nil(null), true);
    assert.equal(tuple(number, string)([1, 'a']), true);
    assert.equal(tuple(number, string)([1]), false);
    assert.equal(union(number, string)('a'), true);
    assert.equal(dictionary(number)({ a: 1 }), true);
    assert.equal(dictionary(number)([]), false);
    assert.equal(json({ a: [1, 'b', null, true] }), true);
    assert.equal(json({ a: Infinity }), false);
  });
  it('parse names the deepest failing field and its value', () => {
    assert.equal(message(() => parse({ id: 'x', size: '1', tags: [], mode: 'a' }, recipe)), 'Invalid recipe structure at recipe.size ("1").');
    assert.equal(message(() => parse({ id: 'x', size: 1, tags: [], mode: 'a', flag: 1 }, recipe, 'dataset')), 'Invalid dataset structure at dataset.flag (1).');
    assert.equal(message(() => parse({ outer: { inner: {} } }, object({ outer: object({ inner: object({ depth: number }) }) }))), 'Invalid recipe structure at recipe.outer.inner.depth (missing).');
    assert.equal(message(() => parse([], recipe)), 'Invalid recipe structure.');
  });
});

// Shared JSON data admits retained readonly records without requiring callers to copy them.
it('JSON data accepts readonly nested source records', () => {
  const source = { nested: [null, { value: 1 }] } as const;
  const value: import('./schema.ts').JsonValue = source;
  assert.equal(json(value), true);
});
