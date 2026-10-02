import type { PreparedTree } from '../runtime-presentation-types.js';

export function requireTextureBindings(value: unknown, nodes: PreparedTree['nodes']) {
  if (value === undefined) return;
  function fail(): never { throw new TypeError('Invalid prepared leaf texture binding.'); }
  if (!Array.isArray(value)) fail();
  const keys = new Set<string>(), leaves = new Set<number>(), parents = new Set(nodes.map(node => node.parent));
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
        Object.keys(entry).some(key => !['target', 'name', 'leaves'].includes(key))) fail();
    const { target, name, leaves: targets } = entry;
    if (!Number.isInteger(target) || target < -1 || target >= nodes.length || typeof name !== 'string' ||
        !(name.startsWith('--') || name === 'backgroundImage' || name === 'background-image') ||
        keys.has(`${target}:${name}`) || !Array.isArray(targets) || !targets.length) fail();
    keys.add(`${target}:${name}`);
    for (const leaf of targets) {
      if (!Number.isInteger(leaf) || leaf < 0 || leaf >= nodes.length || parents.has(leaf) || leaves.has(leaf)) fail();
      let ancestor = leaf;
      while (ancestor !== target && ancestor >= 0) ancestor = nodes[ancestor].parent;
      if (ancestor !== target) fail();
      leaves.add(leaf);
    }
  }
}
