import { array, fail, integer, numbers, record } from './guards.js';
import { ancestor, nodeReference } from './resources-tree.js';
import type { PreparedTree } from '../rendering/prepared-presentation.js';

export function requireDepthPartitions(value: unknown, tree: PreparedTree): number[] {
  if (value === undefined) return [];
  const plan = record(value, 'depth partitions', ['groups', 'order']);
  const groups = array(plan.groups, 'depth groups'), roots = new Set<number>(), scenes = new Set<number>();
  if (groups.length < 2 || groups.length > 128) fail('depth partitions require 2 to 128 retained groups');
  for (const input of groups) {
    const group = record(input, 'depth group', ['root', 'scene']);
    const root = nodeReference(group.root, tree), scene = nodeReference(group.scene, tree);
    if (tree.nodes[root].parent !== tree.camera || !ancestor(scene, root, tree) || roots.has(root) ||
        scenes.has(scene) || [tree.scene, tree.camera].includes(scene)) fail('depth group must own an independent projected carrier');
    roots.add(root); scenes.add(scene);
  }
  const ordered = new Set<number>();
  function visit(value: unknown, depth = 0) {
    if (depth > 64) fail('depth order exceeds prepared traversal bound');
    const entry = record(value, 'depth order');
    if (Object.hasOwn(entry, 'group')) {
      record(entry, 'depth leaf', ['group']);
      const group = integer(entry.group, 'depth group index');
      if (group >= groups.length || ordered.has(group)) fail('depth order requires each group exactly once');
      ordered.add(group);
    } else if (Object.hasOwn(entry, 'sequence')) {
      record(entry, 'depth sequence', ['sequence']);
      const sequence = array(entry.sequence, 'depth sequence');
      if (sequence.length < 2 || sequence.length > groups.length) fail('depth sequence requires 2 to group-count entries');
      for (const child of sequence) visit(child, depth + 1);
    } else {
      record(entry, 'depth split', ['plane', 'back', 'front']);
      const plane = numbers(entry.plane, 'depth plane', 4);
      if (Math.abs(Math.hypot(...plane.slice(0, 3)) - 1) > 1e-6) fail('depth split requires a normalized finite plane');
      visit(entry.back, depth + 1); visit(entry.front, depth + 1);
    }
  }
  visit(plan.order);
  if (ordered.size !== groups.length) fail('depth order must cover every group');
  return [...scenes];
}
