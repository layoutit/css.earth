import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isFiniteTriple, readFiniteTriple, readNonblankText, readNonemptyText, readTextAllowEmpty } from './index.js';

const outcome = (reader: (value: unknown) => unknown, value: unknown): unknown => {
  try { return { value: reader(value) }; }
  catch (error) { if (!(error instanceof Error)) throw error; return { name: error.name, message: error.message }; }
};
test('migrated text admissions preserve values and caller diagnostics', () => {
  const variants = [
    { old: (value: unknown) => { if (typeof value !== 'string') throw new Error('Invalid compact string'); return value; },
      next: (value: unknown) => readTextAllowEmpty(value, '', () => { throw new Error('Invalid compact string'); }) },
    { old: (value: unknown) => { if (typeof value !== 'string' || !value) throw new TypeError('Expected nebula delivery text.'); return value; },
      next: (value: unknown) => readNonemptyText(value, '', () => { throw new TypeError('Expected nebula delivery text.'); }) },
    { old: (value: unknown) => { if (typeof value !== 'string' || !value.trim()) throw new TypeError('Catalogue field requires nonempty text.'); return value; },
      next: (value: unknown) => readNonblankText(value, '', () => { throw new TypeError('Catalogue field requires nonempty text.'); }) },
    { old: (value: unknown) => { assert.ok(typeof value === 'string' && value.length > 0, 'Expected text: path'); return value; },
      next: (value: unknown) => readNonemptyText(value, 'path', () => assert.fail('Expected text: path')) },
  ];
  for (const variant of variants) for (const value of [undefined, null, 0, false, [], {}, '', ' ', '\t\n', ' x '])
    assert.deepEqual(outcome(variant.next, value), outcome(variant.old, value));
});
test('compact vector admission preserves component-first diagnostics and sparse arrays', () => {
  const old = (value: unknown) => {
    if (!Array.isArray(value)) throw new Error('Invalid compact list');
    const numbers = value.map(item => { if (typeof item !== 'number' || !Number.isFinite(item)) throw new Error('Invalid compact number'); return item; });
    if (numbers.length !== 3) throw new Error('Invalid vector');
    return [numbers[0], numbers[1], numbers[2]];
  };
  const next = (value: unknown) => readFiniteTriple(value, '', message => {
    throw new Error(message.endsWith('must be an array') ? 'Invalid compact list' : message.endsWith('must be finite') ? 'Invalid compact number' : 'Invalid vector');
  }, true);
  for (const value of [null, {}, [], [NaN], [1, '2'], [1, 2], [1, 2, 3], [-0, 2, 3], [1, 2, 3, Infinity], Array(3)])
    assert.deepEqual(outcome(next, value), outcome(old, value));
});
test('finite-triple predicate preserves its sparse historical subset', () => {
  for (const value of [null, [], [1, 2], [1, 2, 3], [1, NaN, 3], [1, '2', 3], Array(3)])
    assert.equal(isFiniteTriple(value), Array.isArray(value) && value.length === 3 && value.every(Number.isFinite));
});
