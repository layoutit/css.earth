/** The folder graph: per-folder statistics, strongly connected components, a layer order and the
 * cycle-closing ("feedback-arc") edges that point against it. */
import type { ImportEdge, ImportGraph } from './graph.mts';
import { areaOf, byText, zoneOf } from './zones.mts';

export interface FolderEdge { readonly from: string; readonly to: string; readonly imports: number; readonly symbols: readonly string[] }
export interface FolderStats {
  readonly zone: string; readonly files: number; readonly loc: number; readonly entries: number; readonly unused: number;
  readonly usedByZones: number; readonly usedByAreas: readonly string[]; readonly directNonPkgDeps: readonly string[];
  readonly closureNonPkg: number; readonly inBigCycle: number;
}
export interface FolderGraph { readonly zones: readonly string[]; readonly edges: readonly FolderEdge[] }

/** Production edges: neither end is a test. */
export function productionEdges(graph: ImportGraph): ImportEdge[] {
  return graph.edges.filter(edge => !edge.test && graph.files.get(edge.to)?.test === false);
}

const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1);

export function folderGraph(graph: ImportGraph): FolderGraph {
  const zones = new Set<string>();
  for (const [file, facts] of graph.files) if (!facts.test) zones.add(zoneOf(file));
  const edges = new Map<string, { from: string; to: string; imports: number; symbols: Set<string> }>();
  for (const edge of productionEdges(graph)) {
    const from = zoneOf(edge.from), to = zoneOf(edge.to);
    if (from === to) continue;
    const key = `${from}\n${to}`;
    const entry = edges.get(key) ?? { from, to, imports: 0, symbols: new Set<string>() };
    entry.imports++;
    for (const symbol of edge.symbols) entry.symbols.add(`${basename(edge.to)}#${symbol}`);
    edges.set(key, entry);
  }
  return { zones: [...zones], edges: [...edges.values()].map(edge => ({ ...edge, symbols: [...edge.symbols] })) };
}

/** Tarjan's strongly connected components, iteratively; each component's members sorted. */
export function stronglyConnected(nodes: readonly string[], edges: readonly Pick<FolderEdge, 'from' | 'to'>[]): string[][] {
  const next = new Map<string, string[]>(nodes.map(node => [node, []]));
  for (const edge of edges) next.get(edge.from)?.push(edge.to);
  let counter = 0;
  const index = new Map<string, number>(), low = new Map<string, number>(), stack: string[] = [], onStack = new Set<string>(), components: string[][] = [];
  for (const start of nodes) {
    if (index.has(start)) continue;
    const work: { node: string; position: number }[] = [{ node: start, position: 0 }];
    index.set(start, counter); low.set(start, counter++); stack.push(start); onStack.add(start);
    while (work.length) {
      const frame = work[work.length - 1]!;
      const targets = next.get(frame.node) ?? [];
      if (frame.position < targets.length) {
        const target = targets[frame.position++]!;
        if (!next.has(target)) continue;
        if (!index.has(target)) {
          index.set(target, counter); low.set(target, counter++); stack.push(target); onStack.add(target);
          work.push({ node: target, position: 0 });
        } else if (onStack.has(target)) low.set(frame.node, Math.min(low.get(frame.node)!, index.get(target)!));
        continue;
      }
      work.pop();
      const parent = work[work.length - 1];
      if (parent) low.set(parent.node, Math.min(low.get(parent.node)!, low.get(frame.node)!));
      if (low.get(frame.node) === index.get(frame.node)) {
        const component: string[] = [];
        let member: string;
        do { member = stack.pop()!; onStack.delete(member); component.push(member); } while (member !== frame.node);
        components.push(component.sort());
      }
    }
  }
  return components;
}

/** Components with more than one folder, largest first. */
export function folderCycles(graph: FolderGraph): string[][] {
  return stronglyConnected(graph.zones, graph.edges).filter(component => component.length > 1)
    .sort((left, right) => right.length - left.length || byText(left[0]!, right[0]!));
}

/** Eades–Lin–Smyth greedy minimum feedback-arc-set on one component's weighted edges. Returns a
 * layer order: most dependent folder first, most depended-on last. */
export function layerOrder(component: readonly string[], edges: readonly FolderEdge[]): string[] {
  const members = new Set(component);
  const inner = edges.filter(edge => members.has(edge.from) && members.has(edge.to));
  const remaining = new Set(component), head: string[] = [], tail: string[] = [];
  const degree = (node: string, direction: 'out' | 'in') => inner.reduce((sum, edge) =>
    remaining.has(edge.from) && remaining.has(edge.to) && (direction === 'out' ? edge.from : edge.to) === node ? sum + edge.imports : sum, 0);
  while (remaining.size) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const node of [...remaining]) if (degree(node, 'out') === 0) { tail.unshift(node); remaining.delete(node); changed = true; }
      for (const node of [...remaining]) if (degree(node, 'in') === 0) { head.push(node); remaining.delete(node); changed = true; }
    }
    if (!remaining.size) break;
    let best: string | undefined, bestDelta = -Infinity;
    for (const node of remaining) {
      const delta = degree(node, 'out') - degree(node, 'in');
      if (delta > bestDelta) { bestDelta = delta; best = node; }
    }
    head.push(best!); remaining.delete(best!);
  }
  return [...head, ...tail];
}

/** Edges inside a cycle that point against the layer order: removing them all leaves no folder cycle.
 * An edge touching a folder the order does not know is cycle-closing too: a new folder inside a cycle
 * has no agreed place yet. Sorted by imports, then by name. */
export function cycleClosingEdges(edges: readonly FolderEdge[], cycles: readonly (readonly string[])[], order: readonly string[]): FolderEdge[] {
  const component = new Map<string, number>();
  cycles.forEach((members, id) => { for (const member of members) component.set(member, id); });
  const position = new Map(order.map((zone, index) => [zone, index]));
  return edges.filter(edge => {
    const id = component.get(edge.from);
    if (id === undefined || id !== component.get(edge.to)) return false;
    const from = position.get(edge.from), to = position.get(edge.to);
    return from === undefined || to === undefined || from > to;
  }).sort((left, right) => right.imports - left.imports || byText(left.from, right.from) || byText(left.to, right.to));
}

/** Per-folder statistics, as the prototype's `zones.json` reported them. */
export function folderStats(graph: ImportGraph, folders: FolderGraph, cycles: readonly (readonly string[])[]): FolderStats[] {
  const production = productionEdges(graph), imported = new Set(production.map(edge => edge.to));
  const out = new Map<string, Set<string>>(), incoming = new Map<string, Set<string>>();
  for (const edge of folders.edges) {
    (out.get(edge.from) ?? out.set(edge.from, new Set()).get(edge.from)!).add(edge.to);
    (incoming.get(edge.to) ?? incoming.set(edge.to, new Set()).get(edge.to)!).add(edge.from);
  }
  const cycleSize = new Map<string, number>();
  for (const members of cycles) for (const member of members) cycleSize.set(member, members.length);
  const totals = new Map<string, { files: number; loc: number; entries: number; unused: number }>();
  for (const [file, facts] of graph.files) {
    if (facts.test) continue;
    const zone = zoneOf(file), total = totals.get(zone) ?? { files: 0, loc: 0, entries: 0, unused: 0 };
    total.files++; total.loc += facts.loc;
    if (facts.script || facts.entryHint) total.entries++;
    else if (!imported.has(file) && !/\.(json|css|astro|d\.m?ts)$/u.test(file) && !file.includes('/pages/')) total.unused++;
    totals.set(zone, total);
  }
  const closure = (zone: string) => {
    const seen = new Set<string>(), queue = [zone];
    while (queue.length) for (const next of out.get(queue.pop()!) ?? []) if (!seen.has(next)) { seen.add(next); queue.push(next); }
    seen.delete(zone);
    return [...seen];
  };
  const notPackage = (zone: string) => !zone.startsWith('packages/');
  return folders.zones.map(zone => {
    const total = totals.get(zone) ?? { files: 0, loc: 0, entries: 0, unused: 0 }, users = [...incoming.get(zone) ?? []];
    return {
      zone, ...total, usedByZones: users.length,
      usedByAreas: [...new Set(users.map(areaOf))].filter(area => area !== areaOf(zone)),
      directNonPkgDeps: [...out.get(zone) ?? []].filter(notPackage),
      closureNonPkg: closure(zone).filter(notPackage).length,
      inBigCycle: cycleSize.get(zone) ?? 0,
    };
  }).sort((left, right) => byText(left.zone, right.zone));
}
