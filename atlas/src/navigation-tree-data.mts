import { sha256 } from '../../src/platform/sha256.mts';
import { NAVIGATION_TREE_SCHEMA, type NavigationTreePayload, type NavigationTreeRecord } from '../../src/navigation/navigation-tree-schema.mts';
import { treeCount, type TreeNode } from './objects.mts';
import { treeMarker } from './tree-marker.mts';

export interface NavigationTreeArtifact {
  text: string;
  bytes: number;
  sha256: string;
  url: string;
}

/** Compact, deferred data for branches the server intentionally did not materialize. */
export function navigationTreeArtifact(tree: readonly TreeNode[]): NavigationTreeArtifact {
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
  const text = JSON.stringify({ schema: NAVIGATION_TREE_SCHEMA, roots: tree.map(node => node.key), nodes } satisfies NavigationTreePayload);
  const digest = sha256(text);
  return { text, bytes: Buffer.byteLength(text), sha256: digest, url: `/navigation-tree/${digest}.json` };
}
