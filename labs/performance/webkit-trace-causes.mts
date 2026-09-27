/** Join instrumented native calls to WebKit scheduling using explicit begin/end IDs. */
import { isRecord } from '@cssearth/core';
import { dataOf, isFiniteNumber, isTraceEvent, recordOf, type TraceEvent, type TraceLocation } from './trace-model.mts';
const rows = (v: unknown) => Array.isArray(v) ? v.filter(isRecord) : [];
const end = (e: TraceEvent) => e.ts + (e.dur ?? 0);

export function javascriptStack(value: unknown): TraceLocation[] {
  if (typeof value !== 'string') return [];
  return value.split('\n').flatMap(line => {
    const m = /^(.*?)@((?:https?:\/\/|file:\/\/).*):(\d+):(\d+)$/.exec(line.trim());
    const chrome = /^\s*at (.*?) \(((?:https?:\/\/|file:\/\/).*):(\d+):(\d+)\)$/.exec(line);
    const match = m ?? chrome;
    return match ? [{ functionName: match[1], url: match[2], lineNumber: Number(match[3]), columnNumber: Number(match[4]) }] : [];
  });
}
export function traceCauses(value: unknown, diagnostic: unknown) {
  const events = rows(recordOf(value)?.traceEvents).filter((e): e is Record<string, unknown> & TraceEvent => isTraceEvent(e))
    .filter(e => e.pid === 1 && e.tid === 1).sort((a, b) => a.ts - b.ts);
  const source = recordOf(diagnostic);
  const markers = new Map<number, { startUs?: number; endUs?: number }>();
  for (const e of events) {
    const m = /^cssEarth:cause:(\d+):(begin|end)$/.exec(String(dataOf(e).message ?? ''));
    if (!m) continue;
    const id = Number(m[1]), point = markers.get(id) ?? {};
    if (m[2] === 'begin') point.startUs = e.ts; else point.endUs = e.ts;
    markers.set(id, point);
  }
  const targets = rows(source?.targets).filter(t => isFiniteNumber(t.id) && typeof t.label === 'string');
  const byTarget = new Map(targets.map(t => [t.id, t]));
  const operations = rows(source?.operations).flatMap(o => {
    if (!isFiniteNumber(o.id) || !isFiniteNumber(o.target) || typeof o.kind !== 'string' || typeof o.property !== 'string') return [];
    const marker = markers.get(o.id), target = byTarget.get(o.target);
    return [{ id: o.id, parentId: isFiniteNumber(o.parentId) ? o.parentId : null, kind: o.kind, property: o.property,
      target: target ?? { id: o.target, label: 'unknown' }, frame: o.frame, structureBefore: o.structureBefore, structureAfter: o.structureAfter, arguments: o.arguments, mounted: o.mounted, image: o.image, before: o.before, after: o.after, threw: o.threw === true,
      startUs: marker?.startUs ?? null, endUs: marker?.endUs ?? null, stack: javascriptStack(o.stack),
      clock: marker?.startUs !== undefined && marker?.endUs !== undefined ? 'paired WebKit timestamp IDs' : 'unmatched; excluded from timing joins' }];
  });
  const paired = operations.filter(o => o.startUs !== null && o.endUs !== null);
  const schedules = events.filter(e => e.name === 'ScheduleStyleRecalculation' || e.name === 'InvalidateLayout');
  const links = schedules.map(e => {
    // Exact synchronous containment, not a nearest-timestamp guess. Nested wrappers pick the innermost native call.
    const enclosing = paired.filter(o => o.startUs! <= e.ts && o.endUs! >= e.ts)
      .sort((a, b) => (a.endUs! - a.startUs!) - (b.endUs! - b.startUs!));
    return { kind: e.name, sourceUs: e.ts, operationId: enclosing[0]?.id ?? null,
      enclosingOperationIds: enclosing.map(o => o.id),
      relation: enclosing.length ? 'WebKit scheduled this pass synchronously inside the recorded native call'
        : 'WebKit scheduling event has no instrumented enclosing call',
      nodeId: dataOf(e).nodeId ?? null, reason: dataOf(e).reason ?? null };
  });
  const rendering = events.filter(e => ['UpdateLayoutTree', 'Layout', 'Paint', 'Commit'].includes(e.name) && (e.dur ?? 0) > 0);
  const styles = rendering.filter(e => e.name === 'UpdateLayoutTree');
  const commits = rendering.filter(e => e.name === 'Commit');
  const forTask = (lo: number, hi: number) => {
    // Show the completed render cycle leading into a paint/composite stall as well as the work inside it.
    const previousCommit = commits.filter(e => end(e) <= lo).at(-1);
    const cycleStartUs = previousCommit ? end(previousCommit) : (events[0]?.ts ?? lo);
    const passes = rendering.filter(e => e.ts < hi && end(e) > cycleStartUs).map(e => {
      const previousStyle = styles.filter(s => end(s) <= e.ts && s !== e).at(-1);
      const since = e.name === 'UpdateLayoutTree' ? previousStyle ? end(previousStyle) : (events[0]?.ts ?? e.ts) : cycleStartUs;
      const triggers = e.name === 'UpdateLayoutTree' || e.name === 'Layout'
        ? links.filter(l => l.sourceUs >= since && l.sourceUs <= e.ts && (e.name === 'Layout' ? l.kind === 'InvalidateLayout' : l.kind === 'ScheduleStyleRecalculation')) : [];
      return { name: e.name, sourceUs: e.ts, durationMs: (e.dur ?? 0) / 1000, inTask: e.ts >= lo && e.ts < hi,
        triggerLinks: triggers, forcedByOperationIds: paired.filter(o => o.kind === 'layout-read' && o.startUs! <= e.ts && o.endUs! >= end(e)).map(o => o.id), pendingOperationIds: paired.filter(o => o.startUs! < e.ts && o.endUs! >= since).map(o => o.id),
        relation: e.name === 'UpdateLayoutTree' ? 'all observed writes since previous completed style pass; only triggerLinks are synchronous scheduling evidence'
          : 'observed rendering order; WebKit does not expose a mutation-to-paint causal edge' };
    });
    const wanted = new Set(passes.flatMap(p => [...p.forcedByOperationIds, ...p.pendingOperationIds, ...p.triggerLinks.flatMap(l => l.enclosingOperationIds)]));
    for (const o of paired) if (o.startUs! >= cycleStartUs && o.startUs! < hi) wanted.add(o.id);
    // Retain callers' enclosing instrumented operations even if their beginning predates the last render.
    for (const o of operations.filter(o => wanted.has(o.id))) for (let parent = o.parentId; parent !== null;) {
      wanted.add(parent); parent = operations.find(o => o.id === parent)?.parentId ?? null;
    }
    return { cycleStartUs, operations: operations.filter(o => wanted.has(o.id)), passes,
      relation: 'flight phase and call stacks → observed operation → synchronously enclosed WebKit scheduler → next style/layout pass → rendering order',
      invalidatedSubtree: 'unavailable: target ancestors are not proof of invalidation scope' };
  };
  return { operations, targets, links, motion: rows(source?.motion).map(m => ({ ...m, stack: javascriptStack(m.stack) })), forTask,
    coverage: { enabled: source?.schema === 'cssearth-trace-causes@1', operations: operations.length, pairedOperations: paired.length,
      synchronousSchedulerLinks: links.filter(l => l.operationId !== null).length, unmatchedSchedulers: links.filter(l => l.operationId === null).length,
      dropped: source?.dropped ?? null, unsupported: source?.unsupported ?? [], mutationFallbackRecords: rows(source?.mutations).length },
    limitations: source ? source.limitations : ['No synchronous diagnostic capture. Use a new iPad journey; an old trace cannot recover missing write stacks.'] };
}

/** A separate lane preserves operation durations without charging them again as application CPU work. */
export function causeTraceEvents(causes: ReturnType<typeof traceCauses>): Record<string, unknown>[] {
  if (!causes.coverage.enabled) return [];
  return [{ ph: 'M', name: 'thread_name', pid: 1, tid: 3, args: { name: 'Diagnostic DOM calls (overhead included)' } },
    ...causes.operations.flatMap(o => o.startUs === null || o.endUs === null ? [] : [{ ph: 'X', pid: 1, tid: 3,
      cat: 'cssearth.causes', name: `${o.kind}: ${o.property} · ${o.target.label}`, ts: o.startUs, dur: Math.max(1, o.endUs - o.startUs),
      args: { data: { ...o, schedulerLinks: causes.links.filter(l => l.operationId === o.id) } } }])];
}
