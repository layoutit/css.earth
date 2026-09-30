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

test('a group opens on its first step unless every member says it opens on its last', () => {
  const older = { id: 'enso-2026-09-27', step: { group: 'enso', label: '27 Sept', opens: 'last' } };
  const newest = { id: 'enso-2026-09-28', step: { group: 'enso', label: '28 Sept', opens: 'last' } };
  assert.doesNotThrow(() => validateDatasetSteps('x', [older, newest]));
  assert.throws(() => validateDatasetSteps('x', [older, { id: newest.id, step: { group: 'enso', label: '28 Sept' } }]), /agree on the step it opens on/);
  assert.throws(() => validateDatasetSteps('x', [older, { ...newest, step: { ...newest.step, opens: 'newest' } }]), /opens must be "first" or "last"/);
});
