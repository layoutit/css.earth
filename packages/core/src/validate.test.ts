import { describe, expect, it } from 'vitest';
import {
  checks, failure, hasErrorCode, isFiniteNumber, isPlainRecord, isRecord, requireArray, requireBoolean, requireFiniteNumber,
  requireNonemptyText, requirePositive, requireRecord, requireString,
} from './index.js';

class Box { value = 1; }
const thrown = (run: () => unknown): { name: string; message: string } => {
  try { run(); } catch (error) { if (error instanceof Error) return { name: error.name, message: error.message }; throw error; }
  throw new Error('expected a throw');
};

describe('predicates', () => {
  it('isRecord accepts any non-array object and isPlainRecord only plain ones', () => {
    for (const value of [{}, { a: 1 }, new Box(), Object.create(null)]) expect(isRecord(value)).toBe(true);
    for (const value of [null, undefined, [], 0, '', 'x', true]) expect(isRecord(value)).toBe(false);
    expect(isPlainRecord({ a: 1 })).toBe(true);
    expect(isPlainRecord(JSON.parse('{"a":1}'))).toBe(true);
    for (const value of [new Box(), Object.create(null), [], null, new Date(0)]) expect(isPlainRecord(value)).toBe(false);
  });
  it('isFiniteNumber rejects NaN, infinities and numeric strings', () => {
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(-1.5)).toBe(true);
    for (const value of [NaN, Infinity, -Infinity, '1', null]) expect(isFiniteNumber(value)).toBe(false);
  });
  it('hasErrorCode matches a string code among the given ones', () => {
    const error = Object.assign(new Error('missing'), { code: 'ENOENT' });
    expect(hasErrorCode(error, 'ENOENT')).toBe(true);
    expect(hasErrorCode(error, 'EACCES', 'ENOENT')).toBe(true);
    expect(hasErrorCode(error, 'EACCES')).toBe(false);
    expect(hasErrorCode({ code: 1 }, '1')).toBe(false);
    expect(hasErrorCode(null, 'ENOENT')).toBe(false);
  });
});

describe('getters (the tools/sources/source-values dialect)', () => {
  it('return the value unchanged', () => {
    const value = { a: 1 }, list = [1];
    expect(requireRecord(value)).toBe(value);
    expect(requireArray(list)).toBe(list);
    expect(requireString('')).toBe('');
    expect(requireFiniteNumber(-0)).toBe(-0);
    expect(requirePositive(2)).toBe(2);
    expect(requireBoolean(false)).toBe(false);
    expect(requireNonemptyText('x')).toBe('x');
  });
  it('throw TypeError with the historical messages', () => {
    expect(thrown(() => requireRecord([]))).toEqual({ name: 'TypeError', message: 'Source value must be an object.' });
    expect(thrown(() => requireRecord(null, 'Manifest'))).toEqual({ name: 'TypeError', message: 'Manifest must be an object.' });
    expect(thrown(() => requireArray({}, 'Rows')).message).toBe('Rows must be an array.');
    expect(thrown(() => requireString(1)).message).toBe('Source value must be a string.');
    expect(thrown(() => requireFiniteNumber(NaN, 'Scale')).message).toBe('Scale must be finite.');
    expect(thrown(() => requireFiniteNumber('1')).message).toBe('Source value must be finite.');
    expect(thrown(() => requirePositive(0, 'Radius')).message).toBe('Radius must be positive.');
    expect(thrown(() => requirePositive(Infinity, 'Radius')).message).toBe('Radius must be finite.');
    expect(thrown(() => requireBoolean('true', 'Flag')).message).toBe('Flag must be boolean.');
    expect(thrown(() => requireNonemptyText('', 'Name')).message).toBe('Name must be nonempty text.');
    expect(requireNonemptyText(' ', 'Name')).toBe(' ');
  });
  it('accept class instances as records, like isRecord', () => {
    const box = new Box();
    expect(requireRecord(box)).toBe(box);
  });
  it('name an element by its index when mapped over an array', () => {
    const finite: (value: unknown) => number = requireFiniteNumber, string: (value: unknown) => string = requireString;
    expect(thrown(() => requireArray([1, 'x']).map(finite)).message).toBe('1 must be finite.');
    expect(thrown(() => ['a', 2].map(string)).message).toBe('1 must be a string.');
  });
});

describe('labelled checks (the renderer dialect)', () => {
  const check = checks(failure('Prepared presentation: '));
  const message = (run: () => unknown) => thrown(run).message;
  it('prefix and close every message', () => {
    expect(thrown(() => check.finite('x', 'scale'))).toEqual({ name: 'TypeError', message: 'Prepared presentation: scale must be finite.' });
    expect(message(() => check.array({}, 'rows'))).toBe('Prepared presentation: rows must be an array.');
    expect(message(() => check.positive(-1, 'size'))).toBe('Prepared presentation: size must be positive.');
    expect(message(() => check.boolean(0, 'flag'))).toBe('Prepared presentation: flag must be boolean.');
  });
  it('record accepts only plain records and, when listed, only known fields', () => {
    const value = { a: 1 };
    expect(check.record(value, 'entry', ['a', 'b'])).toBe(value);
    expect(message(() => check.record(new Box(), 'entry'))).toBe('Prepared presentation: entry must be a plain record.');
    expect(message(() => check.record([], 'entry'))).toBe('Prepared presentation: entry must be a plain record.');
    expect(message(() => check.record({ a: 1, c: 2 }, 'entry', ['a']))).toBe('Prepared presentation: unsupported entry field c.');
  });
  it('text requires content unless empty text is allowed', () => {
    expect(message(() => check.text('', 'name'))).toBe('Prepared presentation: name must be a string with content.');
    expect(check.text('', 'name', true)).toBe('');
    expect(message(() => check.text(1, 'name', true))).toBe('Prepared presentation: name must be a string.');
  });
  it('integer, choice, unique and numbers keep their wording', () => {
    expect(check.integer(3, 'count', 1)).toBe(3);
    expect(message(() => check.integer(0.5, 'count'))).toBe('Prepared presentation: count must be an integer at least 0.');
    expect(message(() => check.integer(0, 'count', 1))).toBe('Prepared presentation: count must be an integer at least 1.');
    expect(check.choice('b', ['a', 'b'] as const, 'mode')).toBe('b');
    expect(message(() => check.choice('c', ['a', 'b'], 'mode'))).toBe('Prepared presentation: unsupported mode.');
    expect(message(() => check.unique(['a', 'a'], 'ids'))).toBe('Prepared presentation: ids has duplicate identities.');
    expect(check.numbers([1, 2], 'pair', 2)).toEqual([1, 2]);
    expect(message(() => check.numbers([1, NaN], 'pair'))).toBe('Prepared presentation: pair must be finite.');
    expect(message(() => check.numbers([1], 'pair', 2))).toBe('Prepared presentation: pair has incompatible dimensions.');
  });
  it('an unprefixed failure gives the plain getter wording', () => {
    const plain = checks(failure());
    expect(message(() => plain.finite(null, 'Scale'))).toBe('Scale must be finite.');
  });
});
