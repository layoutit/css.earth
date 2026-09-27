import type { PreparedTree, PreparedVariant } from '@cssearth/renderer/rendering/prepared-presentation.ts';

export type ActivationDefinition = {
  tree: Pick<PreparedTree, 'camera' | 'scene' | 'textureBindings'> & { nodes: readonly Pick<PreparedTree['nodes'][number], 'parent'>[] };
  variants: readonly Pick<PreparedVariant, 'writes'>[];
};

/** First-paint batches preserve authored sibling order and existing geometry.
 * Selection-owned display writes remain atomic under their existing owner. */
export function prepareActivationGroups(definition: ActivationDefinition) {
  const nodes = definition.tree.nodes;
  const parents = new Set(nodes.map(node => node.parent));
  const controlled = new Set(definition.variants.flatMap(variant => variant.writes
    .filter(write => write.kind === 'style' && write.name === 'display').map(write => write.target)));
  const siblings = new Map<number, number[]>();
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    if (parents.has(index) || controlled.has(index) || index === definition.tree.camera || index === definition.tree.scene) continue;
    if (!siblings.has(node.parent)) siblings.set(node.parent, []);
    siblings.get(node.parent)!.push(index);
  }
  // Prepared references need not be stored in depth-first order. Group by
  // actual retained parent so interleaved face records do not become hundreds
  // of one- or two-leaf activation frames. Sibling order is unchanged.
  const groups: number[][] = [];
  // Texture activation never edits the tree. Small sibling runs can share a
  // frame; retaining one frame per parent would turn Earth's 966 image leaves
  // into hundreds of mostly empty frames. Keep the same prepared leaf order.
  const runs = definition.tree.textureBindings?.length ? [[...siblings.values()].flat()] : [...siblings.values()];
  for (const leaves of runs) for (let start = 0; start < leaves.length; start += 64) groups.push(leaves.slice(start, start + 64));
  return groups;
}
