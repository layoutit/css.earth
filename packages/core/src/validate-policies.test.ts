import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isRecord, isFiniteNumber, isNonemptyText,
  readNonArrayRecord, readFiniteNumber, readTextAllowEmpty, readNonemptyText, readNonblankText,
  readPositiveNumber, readSafeIntegerAtLeast,
} from './validate.js';

class Box { value = 1; }
const values: unknown[] = [null, undefined, [], [1, 2], [1, 2, 3, 4], { length: 3 }, {}, new Box(), Object.create(null),
  NaN, Infinity, -Infinity, -0, 0, -1, 0.5, 1, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 1e100,
  '', ' ', '\t\n', '12', ' x ', true];
const numeric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const policies: { name: string; predicate: (value: unknown) => boolean; reader?: (value: unknown) => unknown; accepts: (value: unknown) => boolean }[] = [
  { name: 'non-array record (includes class and null prototype)', predicate: isRecord,
    reader: value => readNonArrayRecord(value, 'value'), accepts: value => value !== null && typeof value === 'object' && !Array.isArray(value) },
  { name: 'finite number', predicate: isFiniteNumber, reader: value => readFiniteNumber(value, 'value'), accepts: numeric },
  { name: 'text allowing empty', predicate: value => typeof value === 'string', reader: value => readTextAllowEmpty(value, 'value'), accepts: value => typeof value === 'string' },
  { name: 'nonempty text allowing whitespace', predicate: isNonemptyText, reader: value => readNonemptyText(value, 'value'), accepts: value => typeof value === 'string' && value.length > 0 },
  { name: 'nonblank text preserving whitespace', predicate: value => typeof value === 'string' && value.trim().length > 0, reader: value => readNonblankText(value, 'value'), accepts: value => typeof value === 'string' && value.trim().length > 0 },
  { name: 'positive finite number', predicate: value => numeric(value) && value > 0, reader: value => readPositiveNumber(value, 'value'), accepts: value => numeric(value) && value > 0 },
  ...[-1, 0, 1].map(minimum => ({ name: `safe integer at least ${minimum}`,
    predicate: (value: unknown) => numeric(value) && Number.isSafeInteger(value) && value >= minimum, reader: (value: unknown) => readSafeIntegerAtLeast(value, minimum, 'value'),
    accepts: (value: unknown) => numeric(value) && Number.isSafeInteger(value) && value >= minimum })),
];
for (const policy of policies) test(policy.name, () => {
  for (const value of values) {
    const accepted = policy.accepts(value);
    assert.equal(policy.predicate(value), accepted);
    if (policy.reader) {
      if (accepted) assert.equal(policy.reader(value), value);
      else assert.throws(() => policy.reader!(value), TypeError);
    }
  }
});
test('caller-owned failures preserve assertion and ordinary Error classes', () => {
  assert.throws(() => readNonArrayRecord(null, 'value', message => assert.fail(message)), assert.AssertionError);
  assert.throws(() => readFiniteNumber(NaN, 'value', message => { throw new Error(message); }), { name: 'Error' });
});
test('explicit readers pin their default diagnostics', () => {
  const cases: { run: () => unknown; message: string }[] = [
    { run: () => readNonArrayRecord(null, 'value'), message: 'value must be an object.' },
    { run: () => readFiniteNumber(NaN, 'value'), message: 'value must be finite.' },
    { run: () => readTextAllowEmpty(null, 'value'), message: 'value must be a string.' },
    { run: () => readNonemptyText('', 'value'), message: 'value must be a string with content.' },
    { run: () => readNonblankText(' ', 'value'), message: 'value must be nonblank text.' },
    { run: () => readPositiveNumber(0, 'value'), message: 'value must be positive.' },
    { run: () => readSafeIntegerAtLeast(0, 1, 'value'), message: 'value must be a safe integer at least 1.' },
  ];
  for (const { run, message } of cases) assert.throws(run, { name: 'TypeError', message });
});
