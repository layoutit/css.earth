import type { PreparedTree } from './prepared-presentation.js';

/** The bake marks every projective leaf with this class (packages/bake/src/presentation/clean-leaves.ts). */
const LEAF_CLASS = 'prepared-leaf';
/** A mesh with projective leaves says so once, and its few other `s` children (a body's two polar caps) say they are
 * not leaves: site/object-shell.css gives `.prepared-leaves > s:not(.prepared-other)` the leaf rule. */
export const LEAVES_CLASS = 'prepared-leaves';
export const OTHER_CLASS = 'prepared-other';

const shipped = new WeakMap<PreparedTree, readonly (string | null)[]>();

/** Each node's class as it reaches the document. The prepared record names the leaf class on every leaf: about 450 class
 * attributes on a body. Here the parent of leaves carries LEAVES_CLASS, its leaves drop the leaf class, and its other `s`
 * children carry OTHER_CLASS. Resolved once per tree, for the builder and the server markup alike, so an adopted tree and
 * a built one agree. A class a body gives its own leaves stays. */
export function preparedClassNames(tree: PreparedTree): readonly (string | null)[] {
  let names = shipped.get(tree);
  if (names) return names;
  const tokens = tree.nodes.map(node => node.className?.split(/\s+/).filter(Boolean) ?? []);
  const leaf = tree.nodes.map((node, index) => node.tag === 's' && node.parent !== -1 && tokens[index]!.includes(LEAF_CLASS));
  const mesh = new Set<number>();
  for (const [index, node] of tree.nodes.entries()) if (leaf[index]) mesh.add(node.parent);
  names = Object.freeze(tree.nodes.map((node, index) => {
    const sibling = node.tag === 's' && mesh.has(node.parent);
    if (!sibling && !mesh.has(index)) return node.className;
    const own = !sibling ? tokens[index]! : leaf[index] ? tokens[index]!.filter(token => token !== LEAF_CLASS) : [...tokens[index]!, OTHER_CLASS];
    const all = mesh.has(index) ? [...own, LEAVES_CLASS] : own;
    return all.length ? all.join(' ') : null;
  }));
  shipped.set(tree, names);
  return names;
}
