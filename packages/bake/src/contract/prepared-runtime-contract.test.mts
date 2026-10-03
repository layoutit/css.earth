import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { loadObjectTestDefinition } from '@cssearth/objects/node/contract';
import { requireObjectRuntimeDefinition } from './index.ts';

const test = sourceTest();
for (const id of ['earth', 'saturn', 'uranus', 'neptune', 'ryugu', 'venus', 'mercury']) {
  test(`bake validates the restored ${id} runtime`, async () => {
    const definition = requireObjectRuntimeDefinition(await loadObjectTestDefinition(id));
    assert.equal(definition.id, id);
    assert.ok(definition.tree.nodes.length > 0);
  });
}
