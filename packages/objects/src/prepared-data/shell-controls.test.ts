import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requireObjectControls } from './shell-controls.js';

test('shell controls validate unknown rows and retain their actual content', () => {
  const content = { datasets: { defaultDataset: 'surface', controls: [{ id: 'surface' }] }, settings: null };
  assert.equal(requireObjectControls(content), content);
  for (const controls of [[null], [3], [{ id: 'surface' }, { id: 'surface' }]]) {
    assert.throws(() => requireObjectControls({ ...content, datasets: { ...content.datasets, controls } }),
      { message: 'Object unknown dataset IDs/default are invalid.' });
  }
  assert.throws(() => requireObjectControls({ settings: null }),
    { message: 'Object unknown must export its datasets and settings content.' });
});

test('the shared controls validator retains the deeper cloud-reference and cycle-state checks', () => {
  const content = { datasets: { defaultDataset: 'cloud', controls: [
    { id: 'surface', label: 'Surface' },
    { id: 'cloud', label: 'Cloud', volume: { objectId: 'cloud-object', datasetId: 'observation', surface: 'surface' } },
  ] }, settings: { controls: [{ kind: 'cycle' as const, name: 'speed', label: 'Speed', state: 'normal' }] } };
  assert.equal(requireObjectControls(content), content);
  assert.throws(() => requireObjectControls({ ...content, datasets: { ...content.datasets, controls: [
    content.datasets.controls[0], { ...content.datasets.controls[1], volume: { objectId: 'cloud-object', datasetId: 'observation', surface: 'missing' } },
  ] } }), { message: 'Object unknown dataset cloud must name a cloud object, its dataset and a prepared surface dataset.' });
  assert.throws(() => requireObjectControls({ ...content, settings: { controls: [{ ...content.settings.controls[0], state: '' }] } }),
    { message: 'Object unknown settings controls are invalid.' });
});
