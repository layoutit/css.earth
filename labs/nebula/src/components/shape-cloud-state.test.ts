import assert from 'node:assert/strict';
import test from 'node:test';
import { componentScope, editShapeComponents } from './shape-cloud-state.js';
import type { ShapeCloudComponent, ShapeCloudSettings } from '../reconstruction/shape-cloud/types.js';

function fixture(): ShapeCloudSettings {
  const base: ShapeCloudComponent = { id: 'a', label: 'A', memberIds: ['arc-a'], groupId: 'one', shape: 'shell', operation: 'add', x: 100, y: 200,
    radiusX: 40, radiusY: 20, rotationDegrees: 10, weight: 1, thickness: .1, softness: .05, depth: .65, enabled: true };
  return { exposure: .8, components: [base, { ...base, id: 'b', memberIds: ['arc-b'], x: 160, radiusX: 80, rotationDegrees: 35 },
    { ...base, id: 'c', memberIds: ['arc-c'], groupId: 'two', x: 300 }] };
}
test('bulk shape edits preserve relative centers, angles, and size ratios', () => {
  const settings = fixture(), selected = settings.components[0]!;
  const moved = editShapeComponents(settings, selected, 'all', 'x', 140);
  assert.deepEqual(moved.components.map(item => item.x), [140, 200, 340]);
  const rotated = editShapeComponents(settings, selected, 'all', 'rotationDegrees', 20);
  assert.deepEqual(rotated.components.map(item => item.rotationDegrees), [20, 45, 20]);
  const resized = editShapeComponents(settings, selected, 'group', 'radiusX', 60);
  assert.deepEqual(resized.components.map(item => item.radiusX), [60, 120, 40]);
  assert.equal(settings.components[0]!.x, 100, 'The source settings were mutated.');
});
test('scope uses actual group membership and emission edits share a value', () => {
  const settings = fixture(), selected = settings.components[0]!;
  assert.deepEqual(componentScope(settings.components, selected, 'selected').map(item => item.id), ['a']);
  assert.deepEqual(componentScope(settings.components, selected, 'group').map(item => item.id), ['a', 'b']);
  assert.deepEqual(editShapeComponents(settings, selected, 'group', 'weight', 2).components.map(item => item.weight), [2, 2, 1]);
});
