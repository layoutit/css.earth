import assert from 'node:assert/strict';
import { test } from 'node:test';
import { controlSelectors, parseEntries, requireObserved } from './reachability.mts';
import { observedFor, parseQualifications, signature } from '../qualification.mts';
import { coverageGate } from '../manifest.mts';
import type { RegisteredJourney } from '../registry.mts';
test('unobserved declarations fail, even when the control exists', () => {
  assert.throws(() => requireObserved(['control:a', 'handler:b'], []), /Declared but unobserved/u);
  assert.doesNotThrow(() => requireObserved(['control:a', 'handler:b'], ['control:a', 'handler:b']));
});
test('control identity refuses tag-only and ambiguous selectors', () => {
  const entries = parseEntries({ entries: [
    { id: 'control:a', kind: 'control', source: 'a:1', tag: 'button', selector: 'button' },
    { id: 'control:b', kind: 'control', source: 'b:1', tag: 'button', selector: '.shared' },
    { id: 'control:c', kind: 'control', source: 'c:1', tag: 'button', selector: '.shared' },
    { id: 'control:d', kind: 'control', source: 'd:1', tag: 'button', selector: '.precise' },
  ] });
  assert.deepEqual(controlSelectors(entries), [{ id: 'control:d', selector: 'button.precise' }]);
  assert.throws(() => parseEntries({ entries: [{ id: 4 }] }), /Invalid/u);
});
test('coverage uses observed current qualified pairs; deleting a driven action invalidates evidence', () => {
  const journey: RegisteredJourney = { id: 'fixture', status: { desktop: 'qualified' }, exercises: ['control:a'], async run(api) { await api.page.locator('button').click(); } };
  const evidence = [{ journey: 'fixture', profile: 'desktop', signature: signature(journey), observed: ['control:a', 'handler:b'], captures: 40, evidence: 'output/proof' }];
  assert.deepEqual(coverageGate([journey], ['control:a', 'handler:b'], [], undefined, evidence).missing, []);
  assert.deepEqual(coverageGate([journey], ['control:a'], [], undefined, []).missing, ['control:a']);
  const removed = { ...journey, async run() {} };
  assert.deepEqual(observedFor(removed, 'desktop', evidence), []);
  assert.equal(coverageGate([removed], ['control:a'], [], undefined, evidence).passed, false);
  assert.deepEqual(coverageGate([{ ...journey, status: { desktop: 'experimental' } }], ['control:a'], [], undefined, evidence).missing, ['control:a']);
  assert.throws(() => parseQualifications([{ ...evidence[0], captures: 39 }]), /Invalid/u);
});
