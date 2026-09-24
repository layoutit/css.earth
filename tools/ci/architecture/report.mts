/** The architecture report: `check` against the baseline and the `map` views. Loaded by `index.mts`
 * once it has confirmed the shared packages are built. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { hasErrorCode } from '@cssearth/core';
import { resolve } from 'node:path';
import { BASELINE_PATH, compare, createBaseline, decodeBaseline, formatBaseline, isStale, isWorse, measure, type Baseline, type Delta } from './baseline.mts';
import { cycleClosingEdges, folderCycles, folderGraph, folderStats, layerOrder } from './folders.mts';
import { buildImportGraph } from './graph.mts';
import { LAYER_RULES } from './rules.mts';

const UPDATE_HINT = 'Run `pnpm check:architecture --update-baseline` and commit tools/ci/architecture/baseline.json.';
const ADDED_EDGE_LIMIT = 20;
const imports = (edges: readonly { imports: number }[]) => edges.reduce((sum, edge) => sum + edge.imports, 0);

/** The printed report: counts against the baseline, then what got worse and what got better. */
export function formatDelta(delta: Delta): string {
  const lines: string[] = [];
  const cycle = delta.cycleClosing;
  lines.push(`folders in the largest cycle: ${delta.largestCycle.now} (baseline ${delta.largestCycle.baseline})`);
  lines.push(`cycle-closing folder edges in it: ${cycle.largestNow.length}, ${imports(cycle.largestNow)} imports (baseline ${cycle.largestBaseline.length}, ${imports(cycle.largestBaseline)} imports)`);
  lines.push(`cycle-closing folder edges in all cycles: ${cycle.now.length}, ${imports(cycle.now)} imports (baseline ${cycle.baseline.length}, ${imports(cycle.baseline)} imports)`);
  for (const rule of delta.rules) lines.push(`${rule.rule}: ${rule.count} file-to-file imports (baseline ${rule.baseline})`);
  if (isWorse(delta)) {
    lines.push('', 'NEW, not allowed:');
    for (const rule of delta.rules) {
      if (!rule.added.length) continue;
      const description = LAYER_RULES.find(item => item.id === rule.rule)?.description ?? rule.rule;
      lines.push(`  ${rule.rule}: ${description}`);
      for (const item of rule.added) lines.push(`    ${item.from} -> ${item.to}`);
    }
    if (delta.largestCycle.now > delta.largestCycle.baseline) lines.push(`  the largest folder cycle grew from ${delta.largestCycle.baseline} to ${delta.largestCycle.now} folders`);
    if (cycle.joined.length) lines.push(`  folders that joined a cycle, with no recorded layer yet: ${cycle.joined.join(', ')}`);
    // Fewest imports first: a newly added import is usually a single one, while an old dependency that a
    // joining folder drags into the cycle usually carries many.
    const added = [...cycle.added].sort((left, right) => left.imports - right.imports);
    for (const edge of added.slice(0, ADDED_EDGE_LIMIT)) lines.push(`  cycle-closing folder edge ${edge.from} -> ${edge.to} (${edge.imports} imports)`);
    if (added.length > ADDED_EDGE_LIMIT) lines.push(`  …and ${added.length - ADDED_EDGE_LIMIT} more cycle-closing folder edges; run pnpm arch:map for all of them`);
    lines.push('Move the import behind a lower layer (usually a package) instead. If this is a move or rename of',
      'code that was already recorded, and nothing new depends upward, update the baseline.');
    for (const { rule, removed, added: item } of delta.renames)
      lines.push(`looks like a rename (${rule}): ${removed.from} -> ${removed.to} is gone and ${item.from} -> ${item.to} is new; if so, update the baseline.`);
  }
  for (const { edge, was } of cycle.heavier) lines.push(`note: ${edge.from} -> ${edge.to} now carries ${edge.imports} imports (was ${was})`);
  if (isStale(delta)) {
    lines.push('', 'Better than the baseline:');
    if (delta.largestCycle.now < delta.largestCycle.baseline) lines.push(`  the largest folder cycle shrank from ${delta.largestCycle.baseline} to ${delta.largestCycle.now} folders`);
    for (const edge of cycle.removed) lines.push(`  cycle-closing edge gone: ${edge.from} -> ${edge.to}`);
    for (const rule of delta.rules) for (const item of rule.removed) lines.push(`  ${rule.rule} gone: ${item.from} -> ${item.to}`);
    for (const rule of delta.unknownRules) lines.push(`  the baseline names rule ${rule}, which the check no longer has`);
    lines.push(UPDATE_HINT);
  }
  return lines.join('\n');
}

async function readBaseline(root: string): Promise<Baseline> {
  return decodeBaseline(JSON.parse(await readFile(resolve(root, BASELINE_PATH), 'utf8')));
}

export async function check(root: string, update: boolean): Promise<boolean> {
  const started = performance.now();
  const measurement = measure(await buildImportGraph(root, { details: false }));
  // Only an update may start from a missing baseline; a check without one is a broken checkout.
  const baseline = await readBaseline(root).catch((error: unknown) => {
    if (update && hasErrorCode(error, 'ENOENT')) return undefined;
    throw error;
  });
  const delta = baseline && compare(baseline, measurement);
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  if (delta) console.log(formatDelta(delta));
  if (update) {
    const next = createBaseline(measurement);
    await writeFile(resolve(root, BASELINE_PATH), formatBaseline(next));
    console.log(`\nWrote ${BASELINE_PATH}: largest cycle ${next.cycles.largestCycle} folders, ${next.cycles.cycleClosingEdges.length} cycle-closing edges (${seconds} s).`);
    return true;
  }
  const worse = delta !== undefined && isWorse(delta);
  console.log(`\n${worse ? 'ARCHITECTURE_WORSE' : 'ARCHITECTURE_OK'}: compared with ${BASELINE_PATH} in ${seconds} s.`);
  return !worse;
}

/** The prototype's JSON views, under output/architecture/ (ignored). */
export async function map(root: string): Promise<void> {
  const graph = await buildImportGraph(root, { details: true });
  const folders = folderGraph(graph), cycles = folderCycles(folders);
  const order = cycles.flatMap(cycle => layerOrder(cycle, folders.edges));
  const largest = cycles[0] ?? [], back = cycleClosingEdges(folders.edges, cycles, order);
  const inLargest = new Set(largest), largestBack = back.filter(edge => inLargest.has(edge.from));
  const inner = folders.edges.filter(edge => inLargest.has(edge.from) && inLargest.has(edge.to));
  const directory = resolve(root, 'output/architecture');
  await mkdir(directory, { recursive: true });
  const write = (name: string, value: unknown) => writeFile(resolve(directory, name), `${JSON.stringify(value, null, 1)}\n`);
  await write('edges.json', { files: Object.fromEntries(graph.files), edges: graph.edges });
  await write('zones.json', { zones: folderStats(graph, folders, cycles), zoneEdges: folders.edges, sccs: cycles });
  await write('feedback.json', { orderHighToLow: order, backEdges: back });
  const violations = measure(graph).rules;
  await write('rules.json', Object.fromEntries(LAYER_RULES.map(rule => [rule.id, { description: rule.description, violations: violations.get(rule.id) ?? [] }])));
  console.log(`files ${graph.files.size} edges ${graph.edges.length} (with symbols ${graph.edges.filter(edge => edge.symbols.length).length})`);
  console.log(`folders ${folders.zones.length}; cycles ${cycles.map(cycle => cycle.length).join(', ') || 'none'}`);
  console.log(`largest cycle: ${largest.length} folders, ${inner.length} inner edges, ${imports(inner)} imports | cycle-closing edges ${largestBack.length}, ${imports(largestBack)} imports`);
  if (back.length !== largestBack.length) console.log(`all cycles: ${back.length} cycle-closing edges, ${imports(back)} imports`);
  console.log(`wrote ${directory}`);
}
