import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { resolveTarget } from './targets.mts';

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
