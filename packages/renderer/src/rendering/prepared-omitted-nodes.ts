import { type PreparedTree, type PreparedVariant } from '@cssearth/objects';

const meshLeaves = new WeakMap<PreparedTree, ReadonlyMap<number, string>>();

/** The alternative mesh each leaf belongs to (`tree.meshes`). A body with several shape models (67P, Bennu, Psyche and
 * 38 others) carries one mesh per model; a selection mounts the one it names (`variant.mesh`). */
export function preparedMeshLeaves(tree: PreparedTree): ReadonlyMap<number, string> {
  let leaves = meshLeaves.get(tree);
  if (!leaves) {
    const found = new Map<number, string>();
    for (const mesh of tree.meshes ?? []) for (const [first, count] of mesh.leaves) for (let leaf = first; leaf < first + count; leaf++) found.set(leaf, mesh.name);
    meshLeaves.set(tree, leaves = found);
  }
  return leaves;
}

/** The subtrees a selection hides: those it declares (`hiddenSubtrees`, Earth's cutaway) and every node it writes
 * `display: none` on (Saturn's cutaway). */
export function hiddenSubtreeRoots(variant: PreparedVariant | undefined): Set<number> {
  return new Set([...variant?.hiddenSubtrees ?? [], ...(variant?.writes ?? []).flatMap(write =>
    write.kind === 'style' && write.name === 'display' && write.value === 'none' && write.target >= 0 ? [write.target] : [])]);
}

/** The nodes a selection leaves out of the page: the descendants of every subtree it hides (`hiddenSubtrees`), and the
 * leaves of every alternative mesh but the one it draws on. The server omits them from its markup, the first-view
 * transport keeps their records whole, and a mount creates them without attaching the mesh leaves: only the mesh the
 * dataset draws on is mounted (`commitSelection` swaps meshes when the dataset changes). */
export function omittedPreparedNodes(tree: PreparedTree, variant: PreparedVariant | undefined): Set<number> {
  const hidden = hiddenSubtreeRoots(variant), meshes = preparedMeshLeaves(tree), omitted = new Set<number>();
  tree.nodes.forEach((record, index) => {
    if (hidden.has(record.parent) || omitted.has(record.parent)) omitted.add(index);
    else if (variant && meshes.size) { const mesh = meshes.get(index); if (mesh !== undefined && mesh !== variant.mesh) omitted.add(index); }
  });
  return omitted;
}
