import type { TraceEvent, TraceLocation, TraceSelection, TraceWindowBounds } from './trace-model.mts';
import { arrayOf, dataOf, isFiniteNumber, isInstantPhase, recordOf } from './trace-model.mts';
import type { InvalidationSummary } from './trace-invalidations.mts';

// Mechanical correlations only. Scheduling a recalculation does not prove that
// one setter caused every element to become dirty; samples are estimates.
const ms = (us: number) => Math.round(us) / 1000;
const locationKey = (f: TraceLocation) => JSON.stringify([f.url, f.lineNumber, f.columnNumber, f.functionName]);
const frameOf = (e: TraceEvent) => dataOf(e).frame;
const stackOf = (e: TraceEvent): readonly unknown[] => arrayOf(dataOf(e).stackTrace) ?? [];
const compactStack = (e: TraceEvent): TraceLocation[] => stackOf(e).slice(0, 8).map(entry => {
  const { functionName, url, lineNumber, columnNumber } = recordOf(entry) ?? {};
  return { functionName, url, lineNumber, columnNumber };
});

export interface SampleLocation { url: unknown; functionName: unknown; lineNumber: number | null; columnNumber: number | null }
export interface CpuSample { ts: number; dur: number; location: SampleLocation }
export interface Hotspot extends SampleLocation { sampleCount: number; sampledMs: number; original?: unknown }

export function collectSamples(events: readonly TraceEvent[], pid: number, tid: number): CpuSample[] {
  const samples: CpuSample[] = [];
  const profiles = events.filter(e => e.pid === pid && e.tid === tid && e.name === 'Profile' && e.ph === 'P');
  for (const profile of profiles) {
    const startTime = recordOf(profile.args?.data)?.startTime;
    if (!isFiniteNumber(startTime)) continue;
    // Chrome emits chunks on a collector thread. The profile ID is the join.
    const chunks = events.filter(e => e.pid === pid && e.name === 'ProfileChunk' && e.ph === 'P'
      && e.id === profile.id).sort((a, b) => a.ts - b.ts);
    const nodes = new Map<unknown, Readonly<Record<string, unknown>>>();
    for (const chunk of chunks) for (const value of arrayOf(recordOf(dataOf(chunk).cpuProfile)?.nodes) ?? []) {
      const node = recordOf(value);
      if (node) nodes.set(node.id, node);
    }
    let ts = startTime;
    for (const chunk of chunks) {
      const data = dataOf(chunk), timeDeltas = arrayOf(data.timeDeltas);
      for (const [i, id] of (arrayOf(recordOf(data.cpuProfile)?.samples) ?? []).entries()) {
        // Math.max coerces a delta exactly as Number() does.
        const duration = Math.max(0, Number(timeDeltas?.[i] ?? 0)), frame = recordOf(nodes.get(id)?.callFrame);
        const start = ts; ts += duration;
        if (!frame || (frame.codeType !== 'JS' && !frame.url)) continue;
        samples.push({ ts: start, dur: duration, location: {
          url: frame.url ?? '', functionName: frame.functionName || '(anonymous)',
          lineNumber: isFiniteNumber(frame.lineNumber) ? frame.lineNumber + 1 : null,
          columnNumber: isFiniteNumber(frame.columnNumber) ? frame.columnNumber + 1 : null,
        } });
      }
    }
  }
  return samples;
}

export function sampledHotspots(samples: readonly CpuSample[], lo: number, hi: number, limit = 12): Hotspot[] {
  const groups = new Map<string, SampleLocation & { sampleCount: number; sampledUs: number }>();
  for (const sample of samples) {
    const duration = Math.min(hi, sample.ts + sample.dur) - Math.max(lo, sample.ts);
    if (duration <= 0) continue;
    const key = locationKey(sample.location);
    const group = groups.get(key) ?? { ...sample.location, sampleCount: 0, sampledUs: 0 };
    group.sampleCount++; group.sampledUs += duration; groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.sampledUs - a.sampledUs).slice(0, limit)
    .map(({ sampledUs, ...g }) => ({ ...g, sampledMs: ms(sampledUs) }));
}

export interface PhaseMark { name: string; atMs: number; traceStartUs: number; detail: unknown }
export interface NavigationPhase { phase: unknown; atMs: number; sinceRequestMs: number | null }
export interface NavigationSpan {
  id: unknown; from: unknown; to: unknown; phases: NavigationPhase[];
  requestedAtMs: number | null; endedAtMs: number | null; incomplete: boolean; observedEndMs: number;
}

export function navigationSpans(events: readonly TraceEvent[], startTs: number, endTs: number): { marks: PhaseMark[]; navigations: NavigationSpan[] } {
  const groups = new Map<string, { id: unknown; from: unknown; to: unknown; phases: { phase: unknown; atMs: number }[] }>();
  const marks: PhaseMark[] = [];
  for (const e of events) {
    // Async measure starts share the phase name but are backdated to the request.
    // Use instant marks, otherwise every phase appears to happen at click time.
    if (!/^cssEarth:(navigation|journey|recording):/.test(e.name) || !isInstantPhase(e.ph)) continue;
    let detail = dataOf(e).detail ?? e.args?.detail;
    if (typeof detail === 'string') { try { detail = JSON.parse(detail); } catch { detail = null; } }
    const mark = { name: e.name, atMs: ms(e.ts - startTs), traceStartUs: e.ts, detail: detail ?? null };
    marks.push(mark);
    const described = recordOf(detail);
    if (!e.name.startsWith('cssEarth:navigation:') || described?.id == null) continue;
    const key = JSON.stringify([described.id, described.from, described.to]);
    const group = groups.get(key) ?? { id: described.id, from: described.from, to: described.to, phases: [] };
    group.phases.push({ phase: described.phase ?? e.name.split(':').at(-1), atMs: mark.atMs });
    groups.set(key, group);
  }
  return { marks, navigations: [...groups.values()].map(g => {
    const requested = g.phases.find(p => p.phase === 'requested')?.atMs ?? null;
    // RegExp#test converts the phase to a string exactly as String() does.
    const finished = g.phases.find(p => /^(finished|cancelled|aborted|failed)$/.test(String(p.phase)))?.atMs ?? null;
    return { ...g, requestedAtMs: requested, endedAtMs: finished,
      incomplete: requested === null || finished === null,
      phases: g.phases.map(p => ({ ...p, sinceRequestMs: requested === null ? null : ms((p.atMs - requested) * 1000) })),
      observedEndMs: finished ?? ms(endTs - startTs) };
  }) };
}

export interface StyleTrigger {
  name: string; traceStartUs: number; atMs: number; nodeId: unknown; reason: unknown;
  stack: TraceLocation[]; stackDepth: number; omittedStackFrames: number;
}
export interface RenderingPass {
  name: string; traceStartUs: number; atMs: number; durationMs: number; frame: unknown;
  previousPassEndUs: number | null; elements: unknown; dirtyObjects: unknown; totalObjects: unknown;
  triggerCount: number; triggers: StyleTrigger[]; omittedTriggers: number;
  invalidationEvidence?: { queued: InvalidationSummary; duringPass: InvalidationSummary };
}

function renderingPasses(main: readonly TraceEvent[], startTs: number): RenderingPass[] {
  const scheduled = new Map<unknown, TraceEvent[]>(), invalidated = new Map<unknown, TraceEvent[]>();
  const previousEnds = new Map<string, number>(), passes: RenderingPass[] = [];
  for (const e of main) {
    const frame = frameOf(e);
    // Never associate mutations from another document/iframe, or an unknown one.
    if (!frame) continue;
    // Node invalidations are separate evidence. Mixing them into this queue
    // used to bury the first scheduling call under thousands of leaf events.
    if (e.name === 'ScheduleStyleRecalculation') {
      const pending = scheduled.get(frame) ?? []; pending.push(e); scheduled.set(frame, pending);
    }
    if (e.name === 'InvalidateLayout') {
      const pending = invalidated.get(frame) ?? []; pending.push(e); invalidated.set(frame, pending);
    }
    if (!['UpdateLayoutTree', 'Layout'].includes(e.name)) continue;
    const queue = e.name === 'Layout' ? invalidated : scheduled;
    const pending = queue.get(frame) ?? []; queue.delete(frame);
    const passKey = JSON.stringify([frame, e.name]);
    passes.push({ name: e.name, traceStartUs: e.ts, atMs: ms(e.ts - startTs), durationMs: ms(e.dur ?? 0), frame,
      previousPassEndUs: previousEnds.get(passKey) ?? null,
      elements: e.args?.elementCount ?? null, dirtyObjects: dataOf(e).dirtyObjects ?? null,
      totalObjects: dataOf(e).totalObjects ?? null,
      triggerCount: pending.length, triggers: pending.slice(0, 8).map(t => ({ name: t.name,
        traceStartUs: t.ts, atMs: ms(t.ts - startTs), nodeId: dataOf(t).nodeId ?? null,
        reason: dataOf(t).reason ?? null, stack: compactStack(t), stackDepth: stackOf(t).length,
        omittedStackFrames: Math.max(0, stackOf(t).length - 8) })),
      omittedTriggers: Math.max(0, pending.length - 8),
    });
    previousEnds.set(passKey, e.ts + (e.dur ?? 0));
  }
  return passes;
}

export interface RecentInput { type: unknown; atMs: number; ageMs: number; relation: string }
export interface TaskNavigation { id: unknown; from: unknown; to: unknown; phase: unknown; sinceRequestMs: number | null }
/** A busy task receives its correlated evidence in place. */
export interface EvidenceTask {
  traceStartUs: number; atMs: number; durationMs: number; calls: TraceLocation[];
  renderingPasses?: RenderingPass[]; sampledJsSelf?: Hotspot[]; recentInputs?: RecentInput[]; navigation?: TaskNavigation[];
}
export interface EvidenceInput {
  selection: TraceSelection; window: TraceWindowBounds; displayBudgetMs: number;
  evidenceGaps: unknown[]; busiestTasks: EvidenceTask[];
}
export interface StyleInitiatorGroup {
  initiators: TraceLocation[]; passCount: number; overBudgetCount: number; totalMs: number; maxMs: number; maxElements: number; exampleAtMs: number[];
}
export interface MessageDelivery {
  traceId: string; sentAtMs: number; handledAtMs: number; senderTid: number | undefined; receiverTid: number | undefined;
  deliveryDelayMs: number; handlerMs: number; senderStack: TraceLocation[]; omittedStackFrames: number; relation: string;
}
export interface EvidenceCoverage { jsSamples: number; styleSchedulingStacks: number; detailedInvalidations: number; navigationMarks: number }
export interface CorrelatedEvidence {
  phaseMarks: PhaseMark[]; phaseMarksTruncated: boolean; navigations: NavigationSpan[]; sampledJsSelf: Hotspot[];
  styleInitiatorGroupCount: number; styleInitiators: StyleInitiatorGroup[];
  messageDelivery: { matchedCount: number; slowest: MessageDelivery[] };
  evidenceCoverage: EvidenceCoverage; sourceUrls: unknown[];
}

/** Adds the correlated sections to the brief in place and returns it. */
export function correlateEvidence<T extends EvidenceInput>(loaded: { readonly events: readonly TraceEvent[] }, brief: T): T & CorrelatedEvidence {
  const { rendererPid: pid, rendererMainTid: tid } = brief.selection;
  const { startTs, endTs } = brief.window;
  const selected = loaded.events.filter(e => e.pid === pid && e.ts + (e.dur ?? 0) >= startTs && e.ts <= endTs).sort((a, b) => a.ts - b.ts);
  const main = selected.filter(e => e.tid === tid);
  const { marks, navigations } = navigationSpans(main, startTs, endTs);
  const passes = renderingPasses(main, startTs);
  const samples = collectSamples(loaded.events, pid, tid);
  const inputs = main.filter(e => e.name === 'EventDispatch' && /^(wheel|pointermove|pointerdown|pointerup|click|objectnavigate)$/.test(String(dataOf(e).type)));
  for (const task of brief.busiestTasks) {
    const lo = task.traceStartUs, hi = lo + task.durationMs * 1000;
    task.renderingPasses = passes.filter(p => p.traceStartUs + p.durationMs * 1000 > lo && p.traceStartUs < hi);
    task.sampledJsSelf = sampledHotspots(samples, lo, hi, 5);
    const latestByType = new Map<unknown, TraceEvent>();
    for (const e of inputs) {
      if (e.ts > lo) break;
      latestByType.set(dataOf(e).type, e);
    }
    task.recentInputs = [...latestByType.values()].filter(e => lo - e.ts <= 1000000).map(e => ({
      type: dataOf(e).type, atMs: ms(e.ts - startTs), ageMs: ms(lo - e.ts), relation: 'preceding input; not a causal attribution',
    }));
    task.navigation = navigations.filter(n => {
      // A navigation without phases has no start and never contains the task.
      const start = n.requestedAtMs ?? n.phases.at(0)?.atMs;
      return start !== undefined && start <= task.atMs && n.observedEndMs >= task.atMs;
    }).map(n => ({ id: n.id, from: n.from, to: n.to,
      phase: n.phases.filter(p => p.atMs <= task.atMs).at(-1)?.phase,
      sinceRequestMs: n.requestedAtMs === null ? null : ms((task.atMs - n.requestedAtMs) * 1000) }));
  }
  // Group the *set* of recorded initiators per style pass. Do not charge the
  // whole pass independently to each stack when several initiators were logged.
  const groups = new Map<string, StyleInitiatorGroup>();
  for (const pass of passes.filter(p => p.name === 'UpdateLayoutTree')) {
    const tops = [...new Map(pass.triggers.flatMap(t => t.stack[0] ? [t.stack[0]] : []).map(top => [locationKey(top), top])).values()];
    const key = JSON.stringify(tops.map(locationKey).sort());
    const g = groups.get(key) ?? { initiators: tops, passCount: 0, overBudgetCount: 0, totalMs: 0, maxMs: 0, maxElements: 0, exampleAtMs: [] };
    g.passCount++; g.totalMs += pass.durationMs;
    g.overBudgetCount += Number(pass.durationMs > brief.displayBudgetMs);
    // Math.max coerces the element count exactly as Number() does.
    g.maxMs = Math.max(g.maxMs, pass.durationMs); g.maxElements = Math.max(g.maxElements, Number(pass.elements ?? 0));
    if (g.exampleAtMs.length < 5) g.exampleAtMs.push(pass.atMs);
    groups.set(key, g);
  }
  const schedules = new Map<string, TraceEvent>(), messages: MessageDelivery[] = [];
  for (const e of selected) {
    const id = dataOf(e).traceId;
    if (id == null) continue;
    if (e.name === 'SchedulePostMessage') schedules.set(String(id), e);
    if (e.name !== 'HandlePostMessage') continue;
    const sent = schedules.get(String(id));
    if (!sent) continue;
    messages.push({ traceId: String(id), sentAtMs: ms(sent.ts - startTs), handledAtMs: ms(e.ts - startTs),
      senderTid: sent.tid, receiverTid: e.tid, deliveryDelayMs: ms(e.ts - sent.ts), handlerMs: ms(e.dur ?? 0),
      senderStack: compactStack(sent), omittedStackFrames: Math.max(0, stackOf(sent).length - 8), relation: 'joined by Chrome postMessage traceId; delay includes scheduling/transport, not just worker compute' });
  }
  const correlated = Object.assign(brief, {
    phaseMarks: marks, phaseMarksTruncated: false,
    navigations,
    sampledJsSelf: sampledHotspots(samples, startTs, endTs),
    styleInitiatorGroupCount: groups.size,
    styleInitiators: [...groups.values()].sort((a, b) => b.totalMs - a.totalMs).slice(0, 20).map(g => ({ ...g, totalMs: ms(g.totalMs * 1000) })),
    messageDelivery: { matchedCount: messages.length,
      slowest: messages.sort((a, b) => b.deliveryDelayMs - a.deliveryDelayMs).slice(0, 8) },
    evidenceCoverage: { jsSamples: samples.length, styleSchedulingStacks: passes.reduce((s, p) => s + p.triggers.filter(t => t.stack.length).length, 0),
      detailedInvalidations: main.filter(e => /InvalidationTracking/.test(e.name)).length,
      navigationMarks: marks.filter(m => m.name.startsWith('cssEarth:navigation:')).length },
  });
  correlated.evidenceGaps.push('A ScheduleStyleRecalculation stack identifies the scheduling call. It does not enumerate all setters or attribute the whole style pass to that call.');
  if (!correlated.evidenceCoverage.detailedInvalidations) correlated.evidenceGaps.push('Per-node style invalidations were not captured. Exact affected selectors/setters require a separate trace with disabled-by-default-devtools.timeline.invalidationTracking.');
  return Object.assign(correlated, { sourceUrls: [...new Set(allLocations(correlated).map(l => l.url).filter(Boolean))] });
}

type StackedLocations = { readonly stack: readonly TraceLocation[] } | undefined;
interface InvalidationLocations { readonly setters: readonly { readonly location: TraceLocation }[]; readonly firstStackedInvalidation?: StackedLocations }
/** The brief sections that carry call locations. Source-map lookup annotates these objects in place. */
export interface LocationSources {
  readonly sampledJsSelf: readonly TraceLocation[];
  readonly busiestTasks: readonly {
    readonly calls: readonly TraceLocation[]; readonly sampledJsSelf?: readonly TraceLocation[];
    readonly renderingPasses?: readonly {
      readonly triggers: readonly { readonly stack: readonly TraceLocation[] }[];
      readonly invalidationEvidence?: { readonly queued: InvalidationLocations; readonly duringPass: InvalidationLocations };
    }[];
    readonly invalidations?: InvalidationLocations;
  }[];
  readonly styleInitiators?: readonly { readonly initiators: readonly TraceLocation[] }[];
  readonly messageDelivery?: { readonly slowest: readonly { readonly senderStack: readonly TraceLocation[] }[] };
  readonly invalidations?: InvalidationLocations;
}

export function allLocations(brief: LocationSources): TraceLocation[] {
  return [...brief.sampledJsSelf, ...brief.busiestTasks.flatMap(t => [...t.calls, ...(t.sampledJsSelf ?? []),
    ...(t.renderingPasses ?? []).flatMap(p => p.triggers.flatMap(s => s.stack))]),
    ...(brief.styleInitiators ?? []).flatMap(g => g.initiators),
    ...(brief.messageDelivery?.slowest ?? []).flatMap(m => m.senderStack),
    ...(brief.invalidations?.setters ?? []).map(s => s.location),
    ...(brief.invalidations?.firstStackedInvalidation?.stack ?? []),
    ...brief.busiestTasks.flatMap(t => (t.renderingPasses ?? []).flatMap(p => [
      ...(p.invalidationEvidence?.queued.firstStackedInvalidation?.stack ?? []),
      ...(p.invalidationEvidence?.duringPass.firstStackedInvalidation?.stack ?? []),
    ])),
    ...brief.busiestTasks.flatMap(t => (t.invalidations?.setters ?? []).map(s => s.location))];
}
