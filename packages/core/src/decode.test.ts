import { describe, expect, it } from 'vitest';
import { array, boolean, choice, dictionary, nullable, number, optional, shape, text } from './index.js';

const message = (run: () => unknown): string => {
  try { run(); } catch (error) { if (error instanceof TypeError) return error.message; throw error; }
  throw new Error('expected a TypeError');
};

describe('decoders (the source-record dialect)', () => {
  it('shape decodes its fields and keeps every other field', () => {
    const parse = shape({ width: number, name: optional(text), tags: array(text) });
    const value = { width: 2, tags: ['a'], extra: { kept: true } };
    expect(parse(value)).toEqual(value);
    expect(parse(value)).not.toBe(value);
    expect(Object.hasOwn(parse(value), 'name')).toBe(false);
    expect(Object.hasOwn(parse({ ...value, name: undefined }), 'name')).toBe(true);
  });
  it('shape names the failing key after its context, level by level', () => {
    const parse = shape({ grid: shape({ width: number }) });
    expect(message(() => parse({ grid: { width: '2' } }))).toBe('Terrestrial source grid: Terrestrial source width: Source value must be finite.');
    expect(message(() => parse([]))).toBe('Source value must be an object.');
    expect(message(() => shape({ path: text }, 'Geographic source')({}))).toBe('Geographic source path: Source value must be a string.');
  });
  it('array names a failing element by its index', () => {
    expect(message(() => array(number)([1, 'x']))).toBe('1 must be finite.');
    expect(message(() => shape({ bands: array(number) })({ bands: [1, 2, null] }))).toBe('Terrestrial source bands: 2 must be finite.');
    expect(message(() => array(number)({}))).toBe('Source value must be an array.');
  });
  it('optional, nullable and dictionary pass their empty values through', () => {
    expect(optional(number)(undefined)).toBeUndefined();
    expect(message(() => optional(number)(null))).toBe('Source value must be finite.');
    expect(nullable(number)(null)).toBeNull();
    expect(message(() => nullable(number)(undefined))).toBe('Source value must be finite.');
    expect(dictionary(number)({ a: 1 })).toEqual({ a: 1 });
    expect(message(() => dictionary(number)({ a: 'x' }))).toBe('Source value must be finite.');
  });
  it('boolean and choice keep their label-free messages', () => {
    expect(boolean(true)).toBe(true);
    expect(message(() => boolean('true'))).toBe('Expected source boolean');
    expect(choice('fit', 'holdout')('fit')).toBe('fit');
    expect(message(() => choice('fit', 'holdout')('other'))).toBe('Unsupported source choice');
  });
});
