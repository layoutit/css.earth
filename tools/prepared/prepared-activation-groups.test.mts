import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { prepareActivationGroups, type ActivationDefinition } from '@cssearth/bake/presentation';

test('preparation bounds sibling batches without changing retained geometry or selection ownership', () => {
  const definition: ActivationDefinition = { tree: { camera: 0, scene: 1,
    nodes: [{ parent: -1 }, { parent: 0 }, { parent: 1 },
      ...Array.from({ length: 140 }, () => ({ parent: 2 })), { parent: 1 }] },
    variants: [{ writes: [{ kind: 'style', name: 'display', target: 5, value: '' }] }] };
  const before = structuredClone(definition), groups = prepareActivationGroups(definition);
  assert.deepEqual(groups.map(group => group.length), [64, 64, 11, 1]);
  assert.deepEqual(groups.flat(), Array.from({ length: 141 }, (_, i) => i + 3).filter(i => i !== 5));
  assert.deepEqual(definition, before);
});

test('interleaved prepared references form bounded sibling batches, not one frame per leaf', () => {
  const definition: ActivationDefinition = { tree: { camera: 0, scene: 1, nodes: [{ parent: -1 }, { parent: 0 },
    { parent: 1 }, { parent: 1 }, ...Array.from({ length: 128 }, (_, i) => ({ parent: 2 + i % 2 }))] }, variants: [] };
  const groups = prepareActivationGroups(definition);
  assert.deepEqual(groups.map(group => group.length), [64, 64]);
  assert.deepEqual(groups[0], Array.from({ length: 64 }, (_, i) => 4 + 2 * i));
  assert.deepEqual(groups[1], Array.from({ length: 64 }, (_, i) => 5 + 2 * i));
});
