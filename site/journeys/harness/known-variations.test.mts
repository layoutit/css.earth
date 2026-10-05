/** Finite sets widen one named measure; neighboring values and unseen outcomes stay red. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseVariations, variationsFor, applyKnownVariations } from './known-variations.mts';
import { compareTraces } from './differ.mts';
import { json, parseTrace, type Trace } from './trace.mts';
function fixture(count: number): Trace {
  return parseTrace({ schema: 'cssearth-journey@1', journey: 'earth-system-deep-link', profile: 'chromium-desktop', toolchain: {}, exercises: [],
    observations: { network: [11, 16, 17, 18, 19].map((page, sequence) => ({ sequence, step: 'deep-link', data: { url: `/scenes/earth/earth-surface-page-${page}-level-${page === 11 ? 480 : 400}.webp`, count: page === 11 ? count : 1, status: 200 } })), dom: [], rendering: [], content: [], errors: [] } });
}
test('the texture count set accepts only one/two and preserves every neighboring measure', () => {
  const first = fixture(1), second = fixture(2);
  assert.deepEqual(compareTraces(first, second), []);
  assert.throws(() => applyKnownVariations(fixture(3)), /outside allowed/u);
  const status = fixture(2); const data = status.observations.network[0]!.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Missing fixture');
  data.status = 500;
  assert.equal(compareTraces(first, status)[0]?.family, 'network');
  const otherStep = fixture(2); otherStep.observations.network[0]!.step = 'another';
  assert.throws(() => applyKnownVariations(otherStep), /Missing or ambiguous/u);
  const otherJourney = fixture(2); otherJourney.journey = 'dione';
  assert.deepEqual(applyKnownVariations(otherJourney).observations, otherJourney.observations);
  const forged = fixture(1); forged.knownVariations = variationsFor(first.journey).map(row => json({ ...row, allowed: [1, 2, 3] }));
  assert.throws(() => applyKnownVariations(forged), /tracked declaration/u);
  const normalized = applyKnownVariations(first);
  assert.deepEqual(applyKnownVariations(normalized), normalized, 'Comparison is idempotent');
  assert.equal(first.observations.network[0]?.data && JSON.stringify(first.observations.network[0].data).includes('"count":1'), true, 'Raw evidence remains exact');
});
test('declarations refuse wildcard scope, duplicate targets and arbitrary added fields', () => {
  const row = variationsFor('earth-system-deep-link').find(row => row.measure.includes('page-11-'))!;
  assert.throws(() => parseVariations([{ ...row, measure: '["network","*","count"]' }]), /one exact measure/u);
  assert.throws(() => parseVariations([row, row]), /Duplicate known/u);
  assert.throws(() => parseVariations([{ ...row, allowed: [1, 1] }]), /Duplicate variation/u);
  assert.throws(() => parseVariations([{ ...row, family: 'errors' }]), /Invalid/u);
});
test('the tracked caption histories accept both lengths and refuse a changed property', () => {
  const declarations = variationsFor('beta-pictoris-system');
  const writes = declarations.find(row => row.measure.endsWith(',"writes"]'))!;
  const measure: unknown = JSON.parse(writes.measure);
  if (!Array.isArray(measure) || typeof measure[1] !== 'string') throw new Error('Missing caption subject');
  const subject = measure[1];
  function caption(index: number) {
    const trace = fixture(1); trace.journey = 'beta-pictoris-system'; trace.observations.network = [];
    const history = writes.allowed[index]; if (!Array.isArray(history)) throw new Error('Missing history');
    trace.observations.dom = [{ sequence: 0, step: 'select-host', data: { subject, count: history.length, writes: structuredClone(history) } }];
    return trace;
  }
  assert.deepEqual(compareTraces(caption(0), caption(1)), []);
  const changed = caption(0); const data = changed.observations.dom[0]!.data;
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.writes)) throw new Error('Missing history');
  const first = data.writes[0]; if (!first || typeof first !== 'object' || Array.isArray(first)) throw new Error('Missing write');
  first.key = 'another property';
  assert.throws(() => applyKnownVariations(changed), /outside allowed/u);
  // The property deletion mutation must defeat the acceptance test, not merely a comment.
  const undeclared = caption(1); undeclared.journey = 'beta-without-declaration';
  const baseline = caption(0); baseline.journey = undeclared.journey;
  assert.equal(compareTraces(baseline, undeclared)[0]?.family, 'dom');
});
