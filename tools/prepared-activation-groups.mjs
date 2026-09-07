/** First-paint batches preserve authored sibling order and existing geometry.
 * Selection-owned display writes remain atomic under their existing owner. */
export function prepareActivationGroups(definition) {
  const nodes = definition.tree.nodes;
  const parents = new Set(nodes.map(node => node.parent));
  const controlled = new Set(definition.variants.flatMap(variant => variant.writes
    .filter(write => write.kind === 'style' && write.name === 'display').map(write => write.target)));
  const groups = [];
  let parent = -2, group = null;
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    if (parents.has(index) || controlled.has(index) || index === definition.tree.camera || index === definition.tree.scene) continue;
    if (node.parent !== parent || !group || group.length === 64) {
      group = []; groups.push(group); parent = node.parent;
    }
    group.push(index);
  }
  return groups;
}
