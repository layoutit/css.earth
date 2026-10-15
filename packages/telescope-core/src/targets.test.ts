import assert from 'node:assert/strict';
import { it as test } from 'node:test';
import { resolveTarget } from './targets.js';

const catalogue = [{ id: 'emilylakdawalla', name: 'Emilylakdawalla', aliases: ['274860', '2009 RE26', '(274860) Emilylakdawalla'] }];

test('resolves explicit numbered and provisional designations in normalized forms', () => {
  for (const requested of ['emilylakdawalla', '274860', '2009 RE26', '2009RE26', '(274860) Emilylakdawalla']) {
    const resolution = resolveTarget(requested, catalogue);
    assert.deepEqual(resolution.status === 'resolved' ? resolution.canonical : resolution, { id: 'emilylakdawalla', name: 'Emilylakdawalla' });
  }
});

test('does not choose a catalogue-order winner for colliding designations', () => {
  const resolution = resolveTarget('2009 RE26', [...catalogue, { id: 'different-object', name: 'Different object', aliases: ['2009RE26'] }]);
  assert.deepEqual(resolution, { status: 'ambiguous', requested: '2009 RE26', candidates: [
    { id: 'different-object', name: 'Different object', matchedBy: 'alias' },
    { id: 'emilylakdawalla', name: 'Emilylakdawalla', matchedBy: 'alias' },
  ] });
});


test('interactive pickers can request six nearest suggestions without changing default resolution', () => {
  const targets = Array.from({ length: 8 }, (_, index) => ({ id: `star-${index}`, name: `Star ${index}`, aliases: [] }));
  const legacy = resolveTarget('unknown', targets), picker = resolveTarget('unknown', targets, { nearest: true, suggestionLimit: 6 });
  assert.deepEqual(legacy, { status: 'unknown', requested: 'unknown', suggestions: [] });
  assert.ok(picker.status === 'unknown'); assert.equal(picker.suggestions.length, 6);
});
