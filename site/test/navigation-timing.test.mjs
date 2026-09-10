import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createNavigationTiming } from '../navigation-timing.mts';

test('navigation timing records phases once and bounds retained entries without clearing unrelated timing', () => {
  performance.mark('unrelated');
  const first = createNavigationTiming({ performance }, 'source', 'destination');
  first.mark('first-motion'); first.mark('first-motion');
  const name = 'cssEarth:navigation:first-motion';
  assert.equal(performance.getEntriesByName(name, 'measure').length, 1);
  const before = performance.getEntriesByName(name, 'measure')[0];
  assert.equal(before.detail.to, 'destination');
  const second = createNavigationTiming({ performance }, 'destination', 'another');
  second.mark('first-motion');
  const after = performance.getEntriesByName(name, 'measure');
  assert.equal(after.length, 1);
  assert.ok(after[0].detail.id > before.detail.id);
  assert.equal(after[0].detail.to, 'another');
  assert.equal(performance.getEntriesByName('unrelated').length, 1);
  for (const phase of ['requested', 'first-motion']) {
    performance.clearMarks(`cssEarth:navigation:${phase}`);
    performance.clearMeasures(`cssEarth:navigation:${phase}`);
  }
  performance.clearMarks('unrelated');
});

test('timing is optional in non-browser hosts', () => {
  assert.doesNotThrow(() => createNavigationTiming({}, 'a', 'b').mark('first-motion'));
});
