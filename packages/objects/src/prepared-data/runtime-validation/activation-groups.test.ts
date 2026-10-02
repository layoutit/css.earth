import { test } from 'node:test';
import assert from 'node:assert/strict';

import { requireTree } from './resources-tree.js';

function fixture() {
  return { camera: 0, scene: 1, properties: [], stageClasses: [], activationGroups: [[2, 3]],
    nodes: [{ parent: -1, className: 'polycss-camera' }, { parent: 0, className: 'polycss-scene' },
      ...Array.from({ length: 65 }, () => ({ parent: 1, className: null }))]
      .map(node => ({ ...node, tag: 'div', style: '', properties: [], attributes: {} })) };
}

test('activation accepts bounded leaf references and rejects tree containers or duplicate ownership', () => {
  assert.doesNotThrow(() => requireTree(fixture()));
  for (const groups of [[[]], [[0]], [[1]], [[100]], [[2, 2]], [[2], [2]], [Array.from({ length: 65 }, (_, i) => i + 2)]]) {
    const tree = fixture(); tree.activationGroups = groups;
    assert.throws(() => requireTree(tree), /activation/);
  }
});
