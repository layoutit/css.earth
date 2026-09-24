import { describe, expect, it } from 'vitest';
import { array, boolean, dictionary, json, literal, nil, number, object, optional, parse, string, tuple, union } from './schema.js';

const message = (run: () => unknown): string => {
  try { run(); } catch (error) { if (error instanceof TypeError) return error.message; throw error; }
  throw new Error('expected a TypeError');
};

describe('structural guards (the material-composition dialect)', () => {
  const recipe = object({ id: string, size: number, tags: array(string), mode: literal('a', 'b'), flag: optional(boolean) });
  it('narrow without copying', () => {
    const value = { id: 'x', size: 1, tags: [], mode: 'a' };
    expect(parse(value, recipe)).toBe(value);
    expect(number(NaN)).toBe(false);
    expect(nil(null)).toBe(true);
    expect(tuple(number, string)([1, 'a'])).toBe(true);
    expect(tuple(number, string)([1])).toBe(false);
    expect(union(number, string)('a')).toBe(true);
    expect(dictionary(number)({ a: 1 })).toBe(true);
    expect(dictionary(number)([])).toBe(false);
    expect(json({ a: [1, 'b', null, true] })).toBe(true);
    expect(json({ a: Infinity })).toBe(false);
  });
  it('parse names the deepest failing field and its value', () => {
    expect(message(() => parse({ id: 'x', size: '1', tags: [], mode: 'a' }, recipe))).toBe('Invalid recipe structure at recipe.size ("1").');
    expect(message(() => parse({ id: 'x', size: 1, tags: [], mode: 'a', flag: 1 }, recipe, 'lens'))).toBe('Invalid lens structure at lens.flag (1).');
    expect(message(() => parse({ outer: { inner: {} } }, object({ outer: object({ inner: object({ depth: number }) }) }))))
      .toBe('Invalid recipe structure at recipe.outer.inner.depth (missing).');
    expect(message(() => parse([], recipe))).toBe('Invalid recipe structure.');
  });
});
