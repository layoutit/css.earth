import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import {
  checks, failure, hasErrorCode, isFiniteNumber, isRecord, requireArray, requireFiniteNumber,
  requireNonemptyText, requirePositive, requireRecord, requireString,
} from './index.js';

class Box { value = 1; }
const thrown = (run: () => unknown): { name: string; message: string } => {
  try { run(); } catch (error) { if (error instanceof Error) return { name: error.name, message: error.message }; throw error; }
  throw new Error('expected a throw');
};

describe('predicates', () => {
  it('isRecord accepts any non-array object', () => {
    for (const value of [{}, { a: 1 }, new Box(), Object.create(null)]) assert.equal(isRecord(value), true);
    for (const value of [null, undefined, [], 0, '', 'x', true]) assert.equal(isRecord(value), false);
  });
  it('isFiniteNumber rejects NaN, infinities and numeric strings', () => {
    assert.equal(isFiniteNumber(0), true);
    assert.equal(isFiniteNumber(-1.5), true);
    for (const value of [NaN, Infinity, -Infinity, '1', null]) assert.equal(isFiniteNumber(value), false);
  });
  it('hasErrorCode matches a string code among the given ones', () => {
    const error = Object.assign(new Error('missing'), { code: 'ENOENT' });
    assert.equal(hasErrorCode(error, 'ENOENT'), true);
    assert.equal(hasErrorCode(error, 'EACCES', 'ENOENT'), true);
    assert.equal(hasErrorCode(error, 'EACCES'), false);
    assert.equal(hasErrorCode({ code: 1 }, '1'), false);
    assert.equal(hasErrorCode(null, 'ENOENT'), false);
  });
});

describe('getters (the bake objects/sources source-values dialect)', () => {
  it('return the value unchanged', () => {
    const value = { a: 1 }, list = [1];
    assert.equal(requireRecord(value), value);
    assert.equal(requireArray(list), list);
    assert.equal(requireString(''), '');
    assert.equal(requireFiniteNumber(-0), -0);
    assert.equal(requirePositive(2), 2);
    assert.equal(requireNonemptyText('x'), 'x');
  });
  it('throw TypeError with the historical messages', () => {
    assert.deepEqual(thrown(() => requireRecord([])), { name: 'TypeError', message: 'Source value must be an object.' });
    assert.deepEqual(thrown(() => requireRecord(null, 'Manifest')), { name: 'TypeError', message: 'Manifest must be an object.' });
    assert.equal(thrown(() => requireArray({}, 'Rows')).message, 'Rows must be an array.');
    assert.equal(thrown(() => requireString(1)).message, 'Source value must be a string.');
    assert.equal(thrown(() => requireFiniteNumber(NaN, 'Scale')).message, 'Scale must be finite.');
    assert.equal(thrown(() => requireFiniteNumber('1')).message, 'Source value must be finite.');
    assert.equal(thrown(() => requirePositive(0, 'Radius')).message, 'Radius must be positive.');
    assert.equal(thrown(() => requirePositive(Infinity, 'Radius')).message, 'Radius must be finite.');
    assert.equal(thrown(() => requireNonemptyText('', 'Name')).message, 'Name must be nonempty text.');
    assert.equal(requireNonemptyText(' ', 'Name'), ' ');
  });
  it('accept class instances as records, like isRecord', () => {
    const box = new Box();
    assert.equal(requireRecord(box), box);
  });
  it('name an element by its index when mapped over an array', () => {
    const finite: (value: unknown) => number = requireFiniteNumber, string: (value: unknown) => string = requireString;
    assert.equal(thrown(() => requireArray([1, 'x']).map(finite)).message, '1 must be finite.');
    assert.equal(thrown(() => ['a', 2].map(string)).message, '1 must be a string.');
  });
});

describe('labelled checks (the renderer dialect)', () => {
  const check = checks(failure('Prepared presentation: '));
  const message = (run: () => unknown) => thrown(run).message;
  it('prefix and close every message', () => {
    assert.deepEqual(thrown(() => check.finite('x', 'scale')), { name: 'TypeError', message: 'Prepared presentation: scale must be finite.' });
    assert.equal(message(() => check.array({}, 'rows')), 'Prepared presentation: rows must be an array.');
    assert.equal(message(() => check.positive(-1, 'size')), 'Prepared presentation: size must be positive.');
    assert.equal(message(() => check.boolean(0, 'flag')), 'Prepared presentation: flag must be boolean.');
  });
  it('record accepts only plain records and, when listed, only known fields', () => {
    const value = { a: 1 };
    assert.equal(check.record(value, 'entry', ['a', 'b']), value);
    assert.equal(message(() => check.record(new Box(), 'entry')), 'Prepared presentation: entry must be a plain record.');
    assert.equal(message(() => check.record([], 'entry')), 'Prepared presentation: entry must be a plain record.');
    assert.equal(message(() => check.record({ a: 1, c: 2 }, 'entry', ['a'])), 'Prepared presentation: unsupported entry field c.');
  });
  it('text requires content unless empty text is allowed', () => {
    assert.equal(message(() => check.text('', 'name')), 'Prepared presentation: name must be a string with content.');
    assert.equal(check.text('', 'name', true), '');
    assert.equal(message(() => check.text(1, 'name', true)), 'Prepared presentation: name must be a string.');
  });
  it('integer, choice, unique and numbers keep their wording', () => {
    assert.equal(check.integer(3, 'count', 1), 3);
    assert.equal(message(() => check.integer(0.5, 'count')), 'Prepared presentation: count must be an integer at least 0.');
    assert.equal(message(() => check.integer(0, 'count', 1)), 'Prepared presentation: count must be an integer at least 1.');
    assert.equal(check.choice('b', ['a', 'b'] as const, 'mode'), 'b');
    assert.equal(message(() => check.choice('c', ['a', 'b'], 'mode')), 'Prepared presentation: unsupported mode.');
    assert.equal(message(() => check.unique(['a', 'a'], 'ids')), 'Prepared presentation: ids has duplicate identities.');
    assert.deepEqual(check.numbers([1, 2], 'pair', 2), [1, 2]);
    assert.equal(message(() => check.numbers([1, NaN], 'pair')), 'Prepared presentation: pair must be finite.');
    assert.equal(message(() => check.numbers([1], 'pair', 2)), 'Prepared presentation: pair has incompatible dimensions.');
  });
  it('an unprefixed failure gives the plain getter wording', () => {
    const plain = checks(failure());
    assert.equal(message(() => plain.finite(null, 'Scale')), 'Scale must be finite.');
  });
});

describe('composite finite and nonempty-string readers', () => {
  it('preserves exact tuple dimensions, finite admission and legacy diagnostics', async () => {
    const { requireFiniteTriple, requireNonemptyString } = await import('./index.js');
    assert.deepEqual(requireFiniteTriple([1, 2, 3], 'point'), [1, 2, 3]);
    assert.equal(requireNonemptyString(' ', 'title'), ' ');
    for (const bad of [[], [1, 2], [1, 2, 3, 4], null]) assert.throws(() => requireFiniteTriple(bad, 'point'), { message: 'point must contain three numbers.' });
    for (const bad of [[1, NaN, 3], [1, '2', 3]]) assert.throws(() => requireFiniteTriple(bad, 'point'), { message: 'point must be finite.' });
    for (const bad of ['', null, 1]) assert.throws(() => requireNonemptyString(bad, 'title'), { message: 'title must be a string.' });
  });
});
