import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareActivationGroups } from './prepared-activation-groups.mjs';

test('preparation bounds sibling batches without changing retained geometry or selection ownership', () => {
  const definition = { tree: { camera: 0, scene: 1,
    nodes: [{ parent: -1 }, { parent: 0 }, { parent: 1 },
      ...Array.from({ length: 140 }, () => ({ parent: 2 })), { parent: 1 }] },
    variants: [{ writes: [{ kind: 'style', name: 'display', target: 5 }] }] };
  const before = structuredClone(definition), groups = prepareActivationGroups(definition);
  assert.deepEqual(groups.map(group => group.length), [64, 64, 11, 1]);
  assert.deepEqual(groups.flat(), Array.from({ length: 141 }, (_, i) => i + 3).filter(i => i !== 5));
  assert.deepEqual(definition, before);
});
