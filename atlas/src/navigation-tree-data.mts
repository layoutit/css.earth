import { NAVIGATION_TREE_SCHEMA, type NavigationTreePayload, type NavigationTreeRecord } from '../../src/navigation/navigation-tree-schema.mts';
import { treeCount, type TreeNode } from './objects.mts';
import { treeMarker } from './tree-marker.mts';

/** Where the application shell fetches the branches it did not render (`site/pages/navigation-tree.json.ts`). */
export const NAVIGATION_TREE_URL = '/navigation-tree.json';

/** Compact, deferred data for branches the server intentionally did not materialize. */
export function navigationTreeText(tree: readonly TreeNode[]): string {
  const nodes: Record<string, NavigationTreeRecord> = {};
  const visit = (node: TreeNode) => {
    if (nodes[node.key]) throw new Error(`Duplicate Atlas navigation key: ${node.key}.`);
    nodes[node.key] = {
      label: node.label,
      objectId: node.object?.id ?? null,
      place: node.object?.group === 'context' || !node.object,
      count: treeCount(node),
      marker: node.object ? treeMarker(node.object.id, '') : null,
      children: node.children.map(child => child.key),
      href: node.href,
      focusId: node.focusId,
    };
    for (const child of node.children) visit(child);
  };
  for (const root of tree) visit(root);
  return JSON.stringify({ schema: NAVIGATION_TREE_SCHEMA, roots: tree.map(node => node.key), nodes } satisfies NavigationTreePayload);
}
