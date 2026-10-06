/** File-level import cycles inside packages/. Every import counts: runtime, type-only, dynamic and test imports. A cycle is
 * broken at its root (move the type to the module that owns it, or extract the shared piece into a leaf module), never by
 * a dynamic import or a duplicate. Every cycle fails the architecture check; there is no baseline. */
import type { ImportGraph } from './import-graph/graph.mts';
import { stronglyConnected } from './folders.mts';
import { byText } from './zones.mts';

export const FILE_CYCLE_ROOTS = ['packages/'] as const;
const inScope = (path: string) => FILE_CYCLE_ROOTS.some(root => path.startsWith(root));

/** Each set of files that reach one another through imports, sorted, largest first; a file importing itself is one too. */
export function fileCycles(graph: ImportGraph): string[][] {
  const edges = graph.edges.filter(edge => inScope(edge.from) && inScope(edge.to));
  const nodes = [...new Set(edges.flatMap(edge => [edge.from, edge.to]))].sort(byText);
  const selfImports = new Set(edges.filter(edge => edge.from === edge.to).map(edge => edge.from));
  return stronglyConnected(nodes, edges).filter(component => component.length > 1 || selfImports.has(component[0]!))
    .sort((a, b) => b.length - a.length || byText(a[0]!, b[0]!));
}

/** One directed loop through a cycle's files, from its first file back to it: the shortest, so the message names a real path. */
export function cyclePath(graph: ImportGraph, component: readonly string[]): string[] {
  const members = new Set(component), start = component[0]!;
  const next = new Map<string, string[]>();
  for (const edge of graph.edges) if (members.has(edge.from) && members.has(edge.to)) next.set(edge.from, [...(next.get(edge.from) ?? []), edge.to]);
  const previous = new Map<string, string>(), queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head]!;
    for (const target of [...new Set(next.get(node) ?? [])].sort(byText)) {
      if (target === start) {
        const path = [node];
        while (path[0] !== start) path.unshift(previous.get(path[0]!)!);
        return path;
      }
      if (!previous.has(target)) { previous.set(target, node); queue.push(target); }
    }
  }
  return [start];
}

export function checkFileCycles(graph: ImportGraph): string[] {
  return fileCycles(graph).map(component => {
    const path = cyclePath(graph, component);
    return `${component.length} files: ${[...path, path[0]].join(' -> ')}`;
  });
}
