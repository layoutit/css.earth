/** The committed architecture baseline and the ratchet against it.
 *
 * The baseline records today's folder cycles and forbidden imports. The check fails only when a change
 * adds to them; anything that disappeared is reported so the baseline can be tightened with
 * `--update-baseline`. Cycle-closing edges are judged against the layer order recorded in the baseline,
 * not a freshly computed one, so an unrelated import cannot reshuffle the greedy order and rename
 * existing edges. */
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { cycleClosingEdges, folderCycles, folderGraph, layerOrder, type FolderEdge } from './folders.mts';
import type { ImportGraph } from './graph.mts';
import { compareViolations, evaluateRules, LAYER_RULES, type LayerRule, type Violation } from './rules.mts';
import { byText, zoneOf } from './zones.mts';

export const BASELINE_PATH = 'tools/ci/architecture/baseline.json';
export const BASELINE_SCHEMA = 'cssearth-architecture-baseline@1';

export interface CycleEdge { readonly from: string; readonly to: string; readonly imports: number }
export interface Baseline {
  readonly schema: typeof BASELINE_SCHEMA;
  readonly cycles: {
    /** Folders in the largest folder cycle. */
    readonly largestCycle: number;
    /** Most dependent folder first. Cycle-closing edges point from a later folder to an earlier one. */
    readonly layerOrder: readonly string[];
    readonly cycleClosingEdges: readonly CycleEdge[];
  };
  readonly rules: Readonly<Record<string, readonly Violation[]>>;
}

export interface Measurement {
  readonly cycles: readonly (readonly string[])[];
  readonly folderEdges: readonly FolderEdge[];
  readonly rules: ReadonlyMap<string, readonly Violation[]>;
}

export function measure(graph: ImportGraph, rules: readonly LayerRule[] = LAYER_RULES): Measurement {
  const folders = folderGraph(graph);
  return { cycles: folderCycles(folders), folderEdges: folders.edges, rules: evaluateRules(graph, rules) };
}

const cycleEdge = ({ from, to, imports }: CycleEdge): CycleEdge => ({ from, to, imports });

export function createBaseline(measurement: Measurement): Baseline {
  const order = measurement.cycles.flatMap(cycle => layerOrder(cycle, measurement.folderEdges));
  return {
    schema: BASELINE_SCHEMA,
    cycles: {
      largestCycle: measurement.cycles[0]?.length ?? 0,
      layerOrder: order,
      cycleClosingEdges: cycleClosingEdges(measurement.folderEdges, measurement.cycles, order).map(cycleEdge),
    },
    rules: Object.fromEntries([...measurement.rules].sort(([left], [right]) => byText(left, right))),
  };
}

export function decodeBaseline(value: unknown): Baseline {
  const record = requireRecord(value, 'architecture baseline');
  if (record.schema !== BASELINE_SCHEMA) throw new TypeError(`architecture baseline schema must be ${BASELINE_SCHEMA}.`);
  const cycles = requireRecord(record.cycles, 'baseline cycles');
  const pair = (item: unknown, label: string): Violation => {
    const entry = requireRecord(item, label);
    return { from: requireString(entry.from, `${label} from`), to: requireString(entry.to, `${label} to`) };
  };
  const largestCycle = requireFiniteNumber(cycles.largestCycle, 'baseline largestCycle');
  if (!Number.isInteger(largestCycle) || largestCycle < 0) throw new TypeError('baseline largestCycle must be a whole number.');
  return {
    schema: BASELINE_SCHEMA,
    cycles: {
      largestCycle,
      layerOrder: requireArray(cycles.layerOrder, 'baseline layerOrder').map((zone, index) => requireString(zone, `layerOrder ${index}`)),
      cycleClosingEdges: requireArray(cycles.cycleClosingEdges, 'baseline cycleClosingEdges').map((item, index) => {
        const label = `cycle edge ${index}`;
        return { ...pair(item, label), imports: requireFiniteNumber(requireRecord(item, label).imports, `${label} imports`) };
      }),
    },
    rules: Object.fromEntries(Object.entries(requireRecord(record.rules, 'baseline rules')).map(([rule, list]) =>
      [rule, requireArray(list, `baseline rule ${rule}`).map((item, index) => pair(item, `${rule} ${index}`))])),
  };
}

/** JSON with one edge per line, so a baseline diff shows exactly the edges that changed. */
export function formatBaseline(baseline: Baseline): string {
  const line = (value: unknown) => JSON.stringify(value);
  const list = (items: readonly unknown[], indent: string) => items.length ? `[\n${items.map(item => `${indent}  ${line(item)}`).join(',\n')}\n${indent}]` : '[]';
  const rules = Object.entries(baseline.rules).map(([rule, items]) => `    ${line(rule)}: ${list(items, '    ')}`);
  return `{
  "schema": ${line(baseline.schema)},
  "cycles": {
    "largestCycle": ${baseline.cycles.largestCycle},
    "layerOrder": ${list(baseline.cycles.layerOrder, '    ')},
    "cycleClosingEdges": ${list(baseline.cycles.cycleClosingEdges, '    ')}
  },
  "rules": {${rules.length ? `\n${rules.join(',\n')}\n  ` : ''}}
}
`;
}

export interface RuleDelta { readonly rule: string; readonly added: readonly Violation[]; readonly removed: readonly Violation[]; readonly count: number; readonly baseline: number }
export interface Delta {
  readonly largestCycle: { readonly now: number; readonly baseline: number };
  readonly cycleClosing: {
    readonly now: readonly CycleEdge[]; readonly baseline: readonly CycleEdge[];
    readonly added: readonly CycleEdge[]; readonly removed: readonly CycleEdge[];
    /** Existing cycle-closing edges that carry more imports than recorded: reported, not failed. */
    readonly heavier: readonly { readonly edge: CycleEdge; readonly was: number }[];
    /** Folders now inside a cycle that the recorded layer order does not place. */
    readonly joined: readonly string[];
    /** The subset inside the largest cycle, the number the untangle plan tracks. */
    readonly largestNow: readonly CycleEdge[]; readonly largestBaseline: readonly CycleEdge[];
  };
  readonly rules: readonly RuleDelta[];
  /** Rules named in the baseline that the check no longer defines. */
  readonly unknownRules: readonly string[];
  /** An added and a removed entry of one rule that share a target or a source folder: probably a move. */
  readonly renames: readonly Rename[];
}
export interface Rename { readonly rule: string; readonly removed: Violation; readonly added: Violation }

/** Pairs each added entry with a removed one that has the same target or the same source folder. */
export function likelyRenames(rule: string, added: readonly Violation[], removed: readonly Violation[], folder: (path: string) => string = zoneOf): Rename[] {
  const unused = [...removed], pairs: Rename[] = [];
  for (const item of added) {
    const index = unused.findIndex(old => old.to === item.to || folder(old.from) === folder(item.from));
    if (index >= 0) pairs.push({ rule, removed: unused.splice(index, 1)[0]!, added: item });
  }
  return pairs;
}

const key = (item: Violation) => `${item.from}\n${item.to}`;
function difference<T extends Violation>(left: readonly T[], right: readonly Violation[]): T[] {
  const known = new Set(right.map(key));
  return left.filter(item => !known.has(key(item)));
}

export function compare(baseline: Baseline, measurement: Measurement): Delta {
  const now = cycleClosingEdges(measurement.folderEdges, measurement.cycles, baseline.cycles.layerOrder).map(cycleEdge);
  const recorded = new Map(baseline.cycles.cycleClosingEdges.map(edge => [key(edge), edge]));
  // The layer order lists the largest cycle's folders first.
  const largestNow = new Set(measurement.cycles[0] ?? []), largestBefore = new Set(baseline.cycles.layerOrder.slice(0, baseline.cycles.largestCycle));
  const rules = [...measurement.rules].map(([rule, violations]) => {
    const known = baseline.rules[rule] ?? [];
    return { rule, added: difference(violations, known), removed: difference(known, violations).sort(compareViolations), count: violations.length, baseline: known.length };
  });
  return {
    largestCycle: { now: measurement.cycles[0]?.length ?? 0, baseline: baseline.cycles.largestCycle },
    cycleClosing: {
      now, baseline: baseline.cycles.cycleClosingEdges,
      added: difference(now, baseline.cycles.cycleClosingEdges),
      removed: difference(baseline.cycles.cycleClosingEdges, now),
      heavier: now.flatMap(edge => {
        const was = recorded.get(key(edge))?.imports;
        return was !== undefined && edge.imports > was ? [{ edge, was }] : [];
      }),
      joined: measurement.cycles.flat().filter(zone => !baseline.cycles.layerOrder.includes(zone)).sort(byText),
      largestNow: now.filter(edge => largestNow.has(edge.from)),
      largestBaseline: baseline.cycles.cycleClosingEdges.filter(edge => largestBefore.has(edge.from)),
    },
    rules,
    unknownRules: Object.keys(baseline.rules).filter(rule => !measurement.rules.has(rule)),
    renames: [
      ...rules.flatMap(rule => likelyRenames(rule.rule, rule.added, rule.removed)),
      // Cycle-closing edges are already folders.
      ...likelyRenames('cycle-closing folder edge', difference(now, baseline.cycles.cycleClosingEdges),
        difference(baseline.cycles.cycleClosingEdges, now), folder => folder),
    ],
  };
}

/** Worse than the baseline: a new cycle-closing edge, a new forbidden import or a larger largest cycle. */
export function isWorse(delta: Delta): boolean {
  return delta.cycleClosing.added.length > 0 || delta.rules.some(rule => rule.added.length > 0)
    || delta.largestCycle.now > delta.largestCycle.baseline;
}

/** Better than the baseline in some way, so it can be tightened. */
export function isStale(delta: Delta): boolean {
  return delta.cycleClosing.removed.length > 0 || delta.rules.some(rule => rule.removed.length > 0)
    || delta.largestCycle.now < delta.largestCycle.baseline || delta.unknownRules.length > 0;
}
