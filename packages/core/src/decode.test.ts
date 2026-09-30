import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { array, boolean, choice, dictionary, nullable, number, optional, shape, text } from './index.js';

const message = (run: () => unknown): string => {
  try { run(); } catch (error) { if (error instanceof TypeError) return error.message; throw error; }
  throw new Error('expected a TypeError');
};

describe('decoders (the source-record dialect)', () => {
  it('shape decodes its fields and keeps every other field', () => {
    const parse = shape({ width: number, name: optional(text), tags: array(text) });
    const value = { width: 2, tags: ['a'], extra: { kept: true } };
    assert.deepEqual(parse(value), value);
    assert.notEqual(parse(value), value);
    assert.equal(Object.hasOwn(parse(value), 'name'), false);
    assert.equal(Object.hasOwn(parse({ ...value, name: undefined }), 'name'), true);
  });
  it('shape names the failing key after its context, level by level', () => {
    const parse = shape({ grid: shape({ width: number }) });
    assert.equal(message(() => parse({ grid: { width: '2' } })), 'Terrestrial source grid: Terrestrial source width: Source value must be finite.');
    assert.equal(message(() => parse([])), 'Source value must be an object.');
    assert.equal(message(() => shape({ path: text }, 'Geographic source')({})), 'Geographic source path: Source value must be a string.');
  });
  it('array names a failing element by its index', () => {
    assert.equal(message(() => array(number)([1, 'x'])), '1 must be finite.');
    assert.equal(message(() => shape({ bands: array(number) })({ bands: [1, 2, null] })), 'Terrestrial source bands: 2 must be finite.');
    assert.equal(message(() => array(number)({})), 'Source value must be an array.');
  });
  it('optional, nullable and dictionary pass their empty values through', () => {
    assert.equal(optional(number)(undefined), undefined);
    assert.equal(message(() => optional(number)(null)), 'Source value must be finite.');
    assert.equal(nullable(number)(null), null);
    assert.equal(message(() => nullable(number)(undefined)), 'Source value must be finite.');
    assert.deepEqual(dictionary(number)({ a: 1 }), { a: 1 });
    assert.equal(message(() => dictionary(number)({ a: 'x' })), 'Source value must be finite.');
  });
  it('boolean and choice keep their label-free messages', () => {
    assert.equal(boolean(true), true);
    assert.equal(message(() => boolean('true')), 'Expected source boolean');
    assert.equal(choice('fit', 'holdout')('fit'), 'fit');
    assert.equal(message(() => choice('fit', 'holdout')('other')), 'Unsupported source choice');
  });
});
