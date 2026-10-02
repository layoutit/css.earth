import type { PreparedTree } from './prepared-presentation.js';

/** The bake marks every projective leaf with this class (packages/bake/src/presentation/clean-leaves.ts). */
const LEAF_CLASS = 'prepared-leaf';
/** A mesh whose `s` children are all projective leaves says so once (site/object-shell.css gives `.prepared-leaves > s`
 * the leaf rule), and its leaves ship without a class. */
export const LEAVES_CLASS = 'prepared-leaves';

const shipped = new WeakMap<PreparedTree, readonly (string | null)[]>();

/** Each node's class as it reaches the document. The prepared record names the leaf class on every leaf: about 450 class
 * attributes on a body. Where every `s` child of a parent carries it, the parent carries LEAVES_CLASS and those children
 * drop it; a parent with any other `s` child keeps its leaves as prepared. Resolved once per tree, for the builder and the
 * server markup alike, so an adopted tree and a built one agree. */
export function preparedClassNames(tree: PreparedTree): readonly (string | null)[] {
  let names = shipped.get(tree);
  if (names) return names;
  const tokens = tree.nodes.map(node => node.className?.split(/\s+/).filter(Boolean) ?? []);
  const leaves = tree.nodes.map(() => 0), others = tree.nodes.map(() => 0);
  for (const [index, node] of tree.nodes.entries()) if (node.parent !== -1 && node.tag === 's') {
    if (tokens[index]!.includes(LEAF_CLASS)) leaves[node.parent]!++; else others[node.parent]!++;
  }
  const hoisted = (parent: number) => parent !== -1 && leaves[parent]! > 0 && others[parent] === 0;
  names = Object.freeze(tree.nodes.map((node, index) => {
    const leaf = node.tag === 's' && hoisted(node.parent), mesh = hoisted(index);
    if (!leaf && !mesh) return node.className;
    const own = leaf ? tokens[index]!.filter(token => token !== LEAF_CLASS) : tokens[index]!;
    const all = mesh ? [...own, LEAVES_CLASS] : own;
    return all.length ? all.join(' ') : null;
  }));
  shipped.set(tree, names);
  return names;
}
