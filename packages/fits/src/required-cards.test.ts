import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requiredFiniteCard, requiredTrimmedTextCard } from './index.js';

test('required finite numeric cards accept only finite numbers without coercion', () => {
  for (const value of [0, -0, Number.MIN_VALUE, 1e-300, 1e300, -3.5]) {
    assert.ok(Object.is(requiredFiniteCard({ KEY: value }, 'KEY', 'source'), value));
  }
  for (const value of [undefined, null, NaN, Infinity, -Infinity, '1', '', true, [], {}]) {
    assert.throws(() => requiredFiniteCard({ KEY: value }, 'KEY', 'source'), {
      name: 'Error', message: 'source carries no numeric KEY.',
    });
  }
  assert.throws(() => requiredFiniteCard({}, 'KEY', 'source'), /source carries no numeric KEY\./);
});

test('required trimmed text cards refuse blank or non-string values', () => {
  for (const [input, expected] of [[' value ', 'value'], ['\tline\n', 'line'], ["'x'", "'x'"], ['0', '0'], ['a b', 'a b']]) {
    assert.equal(requiredTrimmedTextCard({ KEY: input }, 'KEY', 'source'), expected);
  }
  for (const value of [undefined, null, '', ' \t\r\n', '\u00a0', 0, 1, NaN, true, [], {}]) {
    assert.throws(() => requiredTrimmedTextCard({ KEY: value }, 'KEY', 'source'), {
      name: 'Error', message: 'source carries no KEY.',
    });
  }
  assert.throws(() => requiredTrimmedTextCard({}, 'KEY', 'source'), /source carries no KEY\./);
});
