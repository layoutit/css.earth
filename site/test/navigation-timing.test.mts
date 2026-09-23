import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { performance, PerformanceMark, PerformanceMeasure } from 'node:perf_hooks';
import { SourceEvidence } from './source-evidence-values.mts';
import { requireFiniteNumber } from '../../tools/sources/source-values.mts';
import { createNavigationTiming } from '../navigation/navigation-timing.mts';

test('navigation timing records phases once and bounds retained entries without clearing unrelated timing', () => {
  performance.mark('unrelated');
  const first = createNavigationTiming({ performance } as unknown as Window, 'source', 'destination');
  first.mark('first-motion'); first.mark('first-motion');
  const name = 'cssEarth:navigation:first-motion';
  assert.equal(performance.getEntriesByName(name, 'measure').length, 1);
  const before = performance.getEntriesByName(name, 'measure')[0];
  assert.ok(before instanceof PerformanceMeasure);
  const beforeDetail = SourceEvidence.parse(before.detail);
  assert.equal(beforeDetail.text('to'), 'destination');
  const second = createNavigationTiming({ performance } as unknown as Window, 'destination', 'another');
  second.mark('first-motion');
  const after = performance.getEntriesByName(name, 'measure');
  assert.equal(after.length, 1);
  assert.ok(after[0] instanceof PerformanceMeasure);
  const afterDetail = SourceEvidence.parse(after[0].detail);
  assert.ok(requireFiniteNumber(afterDetail.field('id')) > requireFiniteNumber(beforeDetail.field('id')));
  assert.equal(afterDetail.text('to'), 'another');
  assert.equal(performance.getEntriesByName('unrelated').length, 1);
  for (const phase of ['requested', 'first-motion']) {
    performance.clearMarks(`cssEarth:navigation:${phase}`);
    performance.clearMeasures(`cssEarth:navigation:${phase}`);
  }
  performance.clearMarks('unrelated');
});

test('a settled navigation records no later phase', () => {
  const timing = createNavigationTiming({ performance } as unknown as Window, 'source', 'destination');
  timing.mark('finished'); timing.mark('cancelled'); timing.mark('mounted');
  const finished = performance.getEntriesByName('cssEarth:navigation:finished', 'mark')[0];
  assert.ok(finished instanceof PerformanceMark);
  const id = requireFiniteNumber(SourceEvidence.parse(finished.detail).field('id'));
  for (const phase of ['cancelled', 'mounted']) {
    const late = performance.getEntriesByName(`cssEarth:navigation:${phase}`, 'mark').filter(entry => entry instanceof PerformanceMark && SourceEvidence.parse(entry.detail).field('id') === id);
    assert.equal(late.length, 0, `${phase} recorded after finished`);
  }
  for (const phase of ['requested', 'finished', 'cancelled', 'mounted']) {
    performance.clearMarks(`cssEarth:navigation:${phase}`);
    performance.clearMeasures(`cssEarth:navigation:${phase}`);
  }
});

test('timing is optional in non-browser hosts', () => {
  assert.doesNotThrow(() => createNavigationTiming({} as Window, 'a', 'b').mark('first-motion'));
});
