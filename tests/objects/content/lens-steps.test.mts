import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateLensSteps } from '@cssearth/bake/objects/content';

const lens = (id: string, group?: string, label = id) => ({ id, ...(group ? { step: { group, label } } : {}) });

test('stepped lenses form consecutive groups of at least two with distinct labels', () => {
  assert.doesNotThrow(() => validateLensSteps('x', [lens('regions'), lens('t1', 'temperature', '1 µm'), lens('t2', 'temperature', '2 µm')]));
  assert.throws(() => validateLensSteps('x', [lens('t1', 'temperature'), lens('regions'), lens('t2', 'temperature')]), /consecutive/u);
  assert.throws(() => validateLensSteps('x', [lens('t1', 'temperature'), lens('regions')]), /at least two/u);
  assert.throws(() => validateLensSteps('x', [lens('t1', 'temperature', 'same'), lens('t2', 'temperature', 'same')]), /distinct labels/u);
  assert.throws(() => validateLensSteps('x', [lens('temperature'), lens('t1', 'temperature'), lens('t2', 'temperature')]), /must not be a lens id/u);
  assert.throws(() => validateLensSteps('x', [{ id: 't1', step: { group: 'Temperature', label: 'a' } }, { id: 't2', step: { group: 'Temperature', label: 'b' } }]), /group id/u);
});

test('a manual group carries one consistent autoplay choice', () => {
  const first = { id: 'upper', step: { group: 'pressure', label: '0.1 bar', autoplay: false } };
  const last = { id: 'lower', step: { group: 'pressure', label: '1 bar', autoplay: false } };
  assert.doesNotThrow(() => validateLensSteps('x', [first, last]));
  assert.throws(() => validateLensSteps('x', [first, { ...last, step: { ...last.step, autoplay: true } }]), /agree on autoplay/);
});
