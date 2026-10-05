import type { PreparedTree } from '../presentation/runtime-presentation-types.js';

/** The alternative meshes of a tree (`tree.meshes`): uniquely named runs of leaves under one shared parent, no leaf in two
 * meshes. `variantMeshes` are the meshes the selections name, each of which must be listed; a tree without meshes takes
 * selections that name none. */
export function requireMeshes(value: unknown, nodes: PreparedTree['nodes'], variantMeshes: readonly unknown[] = []): void {
  function fail(reason: string): never { throw new TypeError(`Prepared data: ${reason}.`); }
  const names = new Set<string>();
  if (value !== undefined) {
    if (!Array.isArray(value)) fail('meshes must be an array');
    const containers = new Set(nodes.map(node => node.parent)), taken = new Set<number>();
    let parent: number | undefined;
    for (const entry of value as readonly unknown[]) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).some(key => key !== 'name' && key !== 'leaves')) fail('a mesh has a name and its leaves');
      const { name, leaves } = entry as { name?: unknown; leaves?: unknown };
      if (typeof name !== 'string' || !name) fail('a mesh needs a name');
      if (names.has(name as string)) fail(`mesh ${String(name)} is listed twice`);
      names.add(name as string);
      if (!Array.isArray(leaves) || !leaves.length) fail(`mesh ${String(name)} lists no leaves`);
      for (const run of leaves as readonly unknown[]) {
        const [first, count] = Array.isArray(run) && run.length === 2 ? run as unknown[] : [];
        if (typeof first !== 'number' || typeof count !== 'number' || !Number.isInteger(first) || !Number.isInteger(count) || first < 0 || count < 1 || first + count > nodes.length)
          fail(`mesh ${String(name)} run ${JSON.stringify(run)} is not [first node, count] inside the tree`);
        for (let leaf = first as number; leaf < (first as number) + (count as number); leaf++) {
          if (containers.has(leaf) || taken.has(leaf) || nodes[leaf]!.parent !== (parent ??= nodes[leaf]!.parent)) fail(`mesh ${String(name)} node ${leaf} must be a leaf of the meshes' one parent, in one mesh`);
          taken.add(leaf);
        }
      }
    }
  }
  // A body with alternative meshes mounts one for each selection.
  for (const mesh of variantMeshes) if (names.size ? typeof mesh !== 'string' || !names.has(mesh) : mesh !== undefined)
    fail(`variant mesh ${String(mesh)} is not one of the tree's meshes (${[...names].join(', ') || 'none'})`);
}
