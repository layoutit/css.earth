import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foregroundSelection } from './foreground.mts';

test('one fixed foreground component excludes rear material without renormalizing or losing ambient density', () => {
  const inputs = { stars: [{ name: 'A', at: [1, 0, .7] as const }, { name: 'B', at: [-1, 0, .7] as const }] };
  const field = { inputs, near: () => 2, density: () => 3 };
  const selection = foregroundSelection(field);
  for (const z of [-137, -136, -10, 0, .699, .7, 2]) {
    const expected = z > -136 && z < .7 ? 2 : 0;
    assert.equal(selection.selected(0, 0, z), expected);
    assert.equal(selection.selected(0, 0, z) + selection.remaining(0, 0, z), 3);
  }
  assert.equal(selection.metadata.selectedColumnRenormalized, false);
  assert.deepEqual(selection.earthEye, [0, 0, -136]);
  assert.throws(() => foregroundSelection({ ...field, inputs: { ...inputs, stars: [] } }), /stars are required/);
});
