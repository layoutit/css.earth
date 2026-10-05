/** Random history identity normalization never drops serials or user state values. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { historyValues } from './history.mts';
const first = 'a'.repeat(32), second = 'b'.repeat(32);
test('entry aliases preserve serial, distinct sessions and every state value', () => {
  const prefixes = new Map<string, string>();
  assert.deepEqual(historyValues({ cssEarthEntry: first + '-1', cssEarthView: '/dione/', custom: { choice: 'thermal', count: 2 } }, prefixes),
    { cssEarthEntry: 'session-0-1', cssEarthView: '/dione/', custom: { choice: 'thermal', count: 2 } });
  assert.deepEqual(historyValues({ cssEarthEntry: first + '-2' }, prefixes), { cssEarthEntry: 'session-0-2' });
  assert.deepEqual(historyValues({ cssEarthEntry: second + '-1' }, prefixes), { cssEarthEntry: 'session-1-1' });
  assert.deepEqual(historyValues({ cssEarthEntry: 'malformed', custom: false }, prefixes), { cssEarthEntry: 'malformed', custom: false });
});
