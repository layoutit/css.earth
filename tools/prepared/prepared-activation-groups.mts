import type { PreparedTree, PreparedVariant } from '../../src/renderers/css/rendering/prepared-presentation.ts';

export type ActivationDefinition = {
  tree: Pick<PreparedTree, 'camera' | 'scene'> & { nodes: readonly Pick<PreparedTree['nodes'][number], 'parent'>[] };
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
  for (const leaves of siblings.values()) for (let start = 0; start < leaves.length; start += 64) groups.push(leaves.slice(start, start + 64));
  return groups;
}
