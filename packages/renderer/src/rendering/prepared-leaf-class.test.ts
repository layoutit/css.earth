import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preparedClassNames } from './prepared-leaf-class.js';
import type { PreparedTree } from './prepared-presentation.js';

const node = (tag: string, parent: number, className: string | null) => ({ tag, parent, className, style: '', properties: [], attributes: {} });
const tree = (nodes: PreparedTree['nodes']): PreparedTree => ({ nodes, properties: [], camera: 0, scene: 0, stageClasses: [] });

test('a mesh names its leaves once: leaves ship without the leaf class and its other s children are marked', () => {
  const prepared = tree([
    node('div', -1, 'polycss-mesh x-body'),
    node('s', 0, 'prepared-leaf'), node('s', 0, 'prepared-leaf'),
    node('s', 0, 'x-surface-leaf prepared-leaf'),
    node('s', 0, 'x-polar x-polar-south'), node('s', 0, null),
    node('u', 0, null),
    node('div', -1, 'polycss-mesh x-material'), node('s', 7, 'x-material-leaf'),
  ]);
  assert.deepEqual(preparedClassNames(prepared), [
    'polycss-mesh x-body prepared-leaves',
    null, null,
    'x-surface-leaf',
    'x-polar x-polar-south prepared-other', 'prepared-other',
    null,
    // A mesh without projective leaves, and its children, ship as prepared.
    'polycss-mesh x-material', 'x-material-leaf',
  ]);
  assert.equal(preparedClassNames(prepared), preparedClassNames(prepared), 'resolved once per tree');
});
