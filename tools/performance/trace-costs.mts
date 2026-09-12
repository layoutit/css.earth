import type { CompleteEvent, TimelineFrame, TraceEvent, TraceSelection, TraceWindowBounds } from './trace-model.mts';
import { hasDuration } from './trace-model.mts';
import type { InvalidationSummary } from './trace-invalidations.mts';
import type { RecorderState } from './trace-capture.mts';

// Exclusive main-thread accounting. Script wrappers frequently contain forced
// style/layout; summing their inclusive durations would count the same time twice.
export const COST_KINDS = ['gc', 'style', 'layout', 'prepaint', 'paint', 'layers', 'commit', 'compile', 'script', 'other'] as const;
export type CostKind = typeof COST_KINDS[number];
export type ExclusiveMs = Record<CostKind, number>;
export interface CostQuery { totalMs: number; exclusiveMs: ExclusiveMs }
export interface CostIndex { coverage: string; query(lo: number, hi: number): CostQuery }

const round = (value: number) => Math.round(value * 1000) / 1000;
const task = (name: string) => name === 'RunTask' || name === 'ThreadControllerImpl::RunTask';
// Key order follows COST_KINDS.
const byKind = (value: (kind: CostKind) => number): ExclusiveMs => ({ gc: value('gc'), style: value('style'),
  layout: value('layout'), prepaint: value('prepaint'), paint: value('paint'), layers: value('layers'),
  commit: value('commit'), compile: value('compile'), script: value('script'), other: value('other') });
const NAMED_KINDS = new Map<string, CostKind>([['UpdateLayoutTree', 'style'], ['RecalculateStyles', 'style'],
  ['Layout', 'layout'], ['PrePaint', 'prepaint'], ['Paint', 'paint'], ['PaintImage', 'paint'], ['RasterTask', 'paint'],
  ['Layerize', 'layers'], ['UpdateLayerTree', 'layers'], ['Commit', 'commit'], ['CompileScript', 'compile'],
  ['EvaluateScript', 'script'], ['FunctionCall', 'script'], ['FireAnimationFrame', 'script'], ['RunMicrotasks', 'script'],
  ['EventDispatch', 'script'], ['TimerFire', 'script'], ['HandlePostMessage', 'script']]);
function kindOf(name: string): CostKind | null {
  if (/^(MajorGC|MinorGC|V8\.GC_|BlinkGC|CppGC)/.test(name)) return 'gc';
  return NAMED_KINDS.get(name) ?? null;
}
function upperBound(values: readonly number[], value: number) {
  let lo = 0, hi = values.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (values[mid] <= value) lo = mid + 1; else hi = mid; }
  return lo;
}

export function createCostIndex(events: readonly TraceEvent[], selection: TraceSelection, window: TraceWindowBounds): CostIndex {
  const main = events.filter((e): e is CompleteEvent => e.pid === selection.rendererPid && e.tid === selection.rendererMainTid &&
    e.ph === 'X' && hasDuration(e) && e.dur > 0 && Number.isFinite(e.ts) && Number.isFinite(e.dur) &&
    e.ts < window.endTs && e.ts + e.dur > window.startTs);
  const hasTasks = main.some(e => task(e.name));
  const edges: [number, CostKind | 'domain', number][] = [];
  for (const e of main) {
    const kind = kindOf(e.name);
    const lo = Math.max(window.startTs, e.ts), hi = Math.min(window.endTs, e.ts + e.dur);
    // Without tasks, account only the observed complete-event union. Do not
    // pretend that uncaptured main-thread work is zero.
    if (task(e.name) || !hasTasks) edges.push([lo, 'domain', 1], [hi, 'domain', -1]);
    if (kind) edges.push([lo, kind, 1], [hi, kind, -1]);
  }
  edges.sort((a, b) => a[0] - b[0]);
  const counts = new Map<CostKind | 'domain', number>([...COST_KINDS, 'domain' as const].map(k => [k, 0]));
  const ranges = new Map<CostKind, [number, number][]>(COST_KINDS.map(k => [k, []]));
  const count = (kind: CostKind | 'domain') => counts.get(kind) ?? 0;
  const rangesOf = (kind: CostKind) => ranges.get(kind) ?? [];
  let previous = window.startTs;
  for (let i = 0; i < edges.length;) {
    const now = edges[i][0];
    if (now > previous && count('domain') > 0) {
      const kind = COST_KINDS.find(k => count(k) > 0) ?? 'other';
      const last = rangesOf(kind).at(-1);
      if (last && last[1] === previous) last[1] = now; else rangesOf(kind).push([previous, now]);
    }
    while (i < edges.length && edges[i][0] === now) { counts.set(edges[i][1], count(edges[i][1]) + edges[i][2]); i++; }
    previous = now;
  }
  const indexes = new Map(COST_KINDS.map(kind => {
    const list = rangesOf(kind), starts = list.map(r => r[0]), prefix = [0];
    for (const [lo, hi] of list) prefix.push((prefix.at(-1) ?? 0) + hi - lo);
    const integral = (ts: number) => {
      const i = upperBound(starts, ts) - 1;
      return i < 0 ? 0 : prefix[i] + Math.max(0, Math.min(ts, list[i][1]) - list[i][0]);
    };
    return [kind, (lo: number, hi: number) => integral(hi) - integral(lo)] as const;
  }));
  return {
    coverage: hasTasks ? 'main task union' : 'observed complete-event union; task coverage unavailable',
    query(lo, hi) {
      lo = Math.max(lo, window.startTs); hi = Math.min(hi, window.endTs);
      const raw = byKind(k => hi > lo ? (indexes.get(k)?.(lo, hi) ?? 0) / 1000 : 0);
      return { totalMs: round(COST_KINDS.reduce((a, k) => a + raw[k], 0)),
        exclusiveMs: byKind(k => round(raw[k])) };
    },
  };
}

export interface CostFrame extends CostQuery {
  index: number; startMs: number; endMs: number; intervalMs: number;
  dominant: CostKind; mainShare: number | null; classification: string;
  recorder?: RecorderState | null; invalidations?: InvalidationSummary;
}
export interface CostPhase extends CostQuery { name: string; source: string; startMs: number; endMs: number; durationMs: number }
export interface CostDiagnosis {
  coverage: string; interpretation: string; total: CostQuery;
  worstBusyFrames: CostFrame[]; longestPresentationGaps: CostFrame[];
  bins: (CostQuery & { startMs: number; endMs: number })[]; phases: CostPhase[];
}
export interface CostBrief {
  selection: TraceSelection; window: TraceWindowBounds; displayBudgetMs: number;
  busiestTasks: readonly { traceStartUs: number; durationMs: number; exclusive?: CostQuery }[];
  phaseMarks?: readonly { name: string; atMs: number; traceStartUs: number }[];
  navigations?: readonly { from: unknown; to: unknown; phases: readonly { phase: unknown; atMs: number }[] }[];
}
type FrameBounds = Pick<TimelineFrame, 'index' | 'startMs' | 'endMs' | 'intervalMs'>;

export function diagnoseCosts(events: readonly TraceEvent[], brief: CostBrief, analysis: { timeline: { frames: readonly FrameBounds[] } }): CostDiagnosis {
  const index = createCostIndex(events, brief.selection, brief.window), { startTs, endTs } = brief.window;
  const frames = analysis.timeline.frames.map(f => ({ index: f.index, startMs: f.startMs, endMs: f.endMs,
    intervalMs: f.intervalMs, ...index.query(startTs + f.startMs * 1000, startTs + f.endMs * 1000) }));
  type Row = typeof frames[number];
  const rank = (rows: readonly Row[], property: 'totalMs' | 'intervalMs') => [...rows].sort((a, b) => b[property] - a[property]).slice(0, 8);
  const describe = (f: Row): CostFrame => ({ ...f, dominant: COST_KINDS.reduce((a, b) => f.exclusiveMs[a] >= f.exclusiveMs[b] ? a : b),
    mainShare: f.intervalMs > 0 ? round(f.totalMs / f.intervalMs) : null,
    classification: f.totalMs > brief.displayBudgetMs ? 'main-thread budget exceeded'
      : f.intervalMs > brief.displayBudgetMs * 1.5 ? 'presentation gap; main-thread work alone does not explain it' : 'within nominal main-thread budget' });
  for (const t of brief.busiestTasks) t.exclusive = index.query(t.traceStartUs, t.traceStartUs + t.durationMs * 1000);
  const phases: { name: string; source: string; startMs: number; endMs: number }[] = [];
  const open = new Map<string, { atMs: number; traceStartUs: number }>();
  for (const m of brief.phaseMarks ?? []) {
    const match = /^cssEarth:journey:(.+)-(start|end)$/.exec(m.name);
    if (!match) continue;
    if (match[2] === 'start') open.set(match[1], m);
    else {
      const first = open.get(match[1]);
      if (!first) continue;
      open.delete(match[1]);
      if (m.traceStartUs > first.traceStartUs) phases.push({ name: match[1], source: 'journey marks', startMs: first.atMs, endMs: m.atMs });
    }
  }
  for (const n of brief.navigations ?? []) {
    const sorted = [...n.phases].sort((a, b) => a.atMs - b.atMs);
    for (let i = 0; i + 1 < sorted.length; i++) if (sorted[i + 1].atMs > sorted[i].atMs) {
      phases.push({ name: `${n.from} → ${n.to}: ${sorted[i].phase} → ${sorted[i + 1].phase}`,
        source: 'navigation marks', startMs: sorted[i].atMs, endMs: sorted[i + 1].atMs });
    }
  }
  const bins: CostDiagnosis['bins'] = [], count = Math.min(180, Math.max(1, frames.length));
  for (let i = 0; i < count; i++) {
    const lo = startTs + (endTs - startTs) * i / count, hi = startTs + (endTs - startTs) * (i + 1) / count;
    bins.push({ startMs: round((lo - startTs) / 1000), endMs: round((hi - startTs) / 1000), ...index.query(lo, hi) });
  }
  return { coverage: index.coverage, interpretation: 'Exclusive categories partition observed main work. Specific rendering/GC slices take precedence over enclosing script. Other is task time without a categorized slice.',
    total: index.query(startTs, endTs), worstBusyFrames: rank(frames, 'totalMs').map(describe),
    longestPresentationGaps: rank(frames, 'intervalMs').map(describe), bins,
    phases: phases.map(p => ({ ...p, durationMs: round(p.endMs - p.startMs),
      ...index.query(startTs + p.startMs * 1000, startTs + p.endMs * 1000) })),
  };
}
