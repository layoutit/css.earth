import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { meshProfile, omittedPreparedNodes } from './prepared-omitted-nodes.js';
import type { PreparedTree, PreparedVariant } from './prepared-presentation.js';

test('a selection omits the descendants of its hidden subtrees and the leaves of every mesh it hides', () => {
  const record = (parent: number, style = '') => ({ parent, tag: 'div', className: null, style, properties: [], attributes: {} });
  const tree = { nodes: [record(-1), record(0), record(1, 'display:var(--x-a-display, none)'), record(1, 'display:var(--x-b-display, none)'),
    record(0), record(4)], properties: [], camera: 0, scene: 0, stageClasses: [] } as unknown as PreparedTree;
  const variant = { when: {}, required: [], materials: [], hiddenSubtrees: [4], writes: [
    { kind: 'style', target: 1, name: '--x-a-display', value: 'block' }, { kind: 'style', target: 1, name: '--x-b-display', value: 'none' }] } as unknown as PreparedVariant;
  assert.deepEqual(([...omittedPreparedNodes(tree, variant)]), [3, 5]);
  assert.equal(meshProfile('transform:none;display:var(--comet-67p-osiris-display, none)'), '--comet-67p-osiris-display');
  assert.equal(meshProfile('display:block'), null);
});
