import assert from 'node:assert/strict';
import test from 'node:test';
import { workspaceObjects } from './workspace-objects';
test('standalone workspaces remain selectable when a historical base is absent', () => {
  const objects = [{ id: 'base' }, { id: 'saved', sourceSubjectId: 'base' }, { id: 'standalone', sourceSubjectId: 'retired' }];
  assert.deepEqual(workspaceObjects(objects).map(object => object.id), ['base', 'standalone']);
});
