/** Fresh-checkout status is tracked; only the current lane's observed IDs earn coverage. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { declarations, validateDeclaration } from './manifest-qualification.mts';
import { journeys, selectJourneys } from './registry.mts';
import { coverageGate } from './manifest.mts';
import { parseRunObservations, signature } from './qualification.mts';
import { requireObserved } from './harness/reachability.mts';
test('qualified declarations require all measurement fields and refuse date fields', () => {
  const measured = declarations['neptune-system']!['chromium-desktop']!;
  assert.equal(validateDeclaration(measured, 'chromium-desktop').status, 'qualified');
  assert.throws(() => validateDeclaration({ status: 'qualified' }, 'chromium-desktop'), /measure/u);
  for (const key of Object.keys(measured.measure!)) {
    const measure = Object.fromEntries(Object.entries(measured.measure!).filter(([field]) => field !== key));
    assert.throws(() => validateDeclaration({ status: 'qualified', measure }, 'chromium-desktop'), /measure/u);
  }
  assert.throws(() => validateDeclaration({ ...measured, measure: { ...measured.measure, date: 'today' } }, 'chromium-desktop'), /date-free/u);
  assert.throws(() => validateDeclaration({ ...measured, measure: { ...measured.measure, engines: ['webkit'] } }, 'chromium-desktop'), /measure/u);
});
test('fresh checkout selects declared pairs, earns no credit from status, and action deletion is red', () => {
  const selected = selectJourneys('chromium-desktop');
  assert.equal(selected.length, Object.values(declarations).filter(row => row['chromium-desktop']?.status === 'qualified').length);
  assert.ok(selected.length > 0);
  const journey = journeys.find(row => row.id === 'neptune-system')!;
  const ids = journey.exercises;
  assert.equal(coverageGate([journey], ids, [], 'chromium-desktop', []).passed, false);
  const lane = parseRunObservations([{ journey: journey.id, profile: 'chromium-desktop', signature: signature(journey), observed: ids, captures: 2, evidence: 'output/current-lane' }]);
  assert.equal(coverageGate([journey], ids, [], 'chromium-desktop', lane).passed, true);
  for (const id of ids) {
    const observed = ids.filter(value => value !== id);
    assert.throws(() => requireObserved(ids, observed), /Declared but unobserved/u);
    assert.equal(coverageGate([journey], ids, [], 'chromium-desktop', [{ ...lane[0]!, observed }]).passed, false);
  }
  assert.throws(() => parseRunObservations([{ ...lane[0], captures: 0 }]), /capture count/u);
});
