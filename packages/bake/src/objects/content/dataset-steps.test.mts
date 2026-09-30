import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateDatasetSteps } from '@cssearth/bake/objects/content';

const dataset = (id: string, group?: string, label = id) => ({ id, ...(group ? { step: { group, label } } : {}) });

test('stepped datasets form consecutive groups of at least two with distinct labels', () => {
  assert.doesNotThrow(() => validateDatasetSteps('x', [dataset('regions'), dataset('t1', 'temperature', '1 µm'), dataset('t2', 'temperature', '2 µm')]));
  assert.throws(() => validateDatasetSteps('x', [dataset('t1', 'temperature'), dataset('regions'), dataset('t2', 'temperature')]), /consecutive/u);
  assert.throws(() => validateDatasetSteps('x', [dataset('t1', 'temperature'), dataset('regions')]), /at least two/u);
  assert.throws(() => validateDatasetSteps('x', [dataset('t1', 'temperature', 'same'), dataset('t2', 'temperature', 'same')]), /distinct labels/u);
  assert.throws(() => validateDatasetSteps('x', [dataset('temperature'), dataset('t1', 'temperature'), dataset('t2', 'temperature')]), /must not be a dataset id/u);
  assert.throws(() => validateDatasetSteps('x', [{ id: 't1', step: { group: 'Temperature', label: 'a' } }, { id: 't2', step: { group: 'Temperature', label: 'b' } }]), /group id/u);
});

test('a manual group carries one consistent autoplay choice', () => {
  const first = { id: 'upper', step: { group: 'pressure', label: '0.1 bar', autoplay: false } };
  const last = { id: 'lower', step: { group: 'pressure', label: '1 bar', autoplay: false } };
  assert.doesNotThrow(() => validateDatasetSteps('x', [first, last]));
  assert.throws(() => validateDatasetSteps('x', [first, { ...last, step: { ...last.step, autoplay: true } }]), /agree on autoplay/);
});
