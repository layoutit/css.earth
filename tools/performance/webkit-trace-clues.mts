/** Evidence joins for exported WebKit captures. These are observations, not inferred causes. */
import { isRecord } from '@cssearth/core';
import { traceCauses } from './webkit-trace-causes.mts';
import { correlateEvidence, type EvidenceTask } from './trace-evidence.mts';
import { createCostIndex } from './trace-costs.mts';
import { dataOf, isFiniteNumber, isTraceEvent, recordOf, type TraceEvent, type TraceLocation } from './trace-model.mts';

const rows = (value: unknown) => Array.isArray(value) ? value.filter(isRecord) : [];
const ms = (us: number) => Math.round(us) / 1000;
const end = (event: TraceEvent) => event.ts + (event.dur ?? 0);
const stack = (value: unknown): TraceLocation[] => rows(isRecord(value) ? value.callFrames : value).map(f => ({
  functionName: f.functionName, url: f.url, lineNumber: f.lineNumber, columnNumber: f.columnNumber,
}));
const call = (event: TraceEvent): TraceLocation => {
  const d = dataOf(event);
  return { url: d.url ?? d.scriptName, lineNumber: d.lineNumber ?? d.scriptLine,
    columnNumber: d.columnNumber ?? d.scriptColumn, functionName: d.functionName };
};

/** Recover stacks lost by older flat exports. Keep capture and source clocks unchanged. */
export function restoreSchedulingStacks(trace: { traceEvents: Record<string, unknown>[] }, raw: unknown) {
  const byKey = new Map<string, TraceLocation[]>();
  const visit = (record: Record<string, unknown>) => {
    if (typeof record.type === 'string' && isFiniteNumber(record.startTime)) {
      const frames = stack(record.stackTrace ?? recordOf(record.data)?.stackTrace);
      if (frames.length) byKey.set(`${record.type}:${Math.round(record.startTime * 1e6)}`, frames);
    }
    for (const child of rows(record.children)) visit(child);
  };
  for (const e of rows(recordOf(raw)?.moment)) {
    if (e.method === 'Timeline.eventRecorded' && recordOf(e.params)?.record) {
      const record = recordOf(recordOf(e.params)?.record); if (record) visit(record);
    }
  }
  let restored = 0;
  for (const [index, event] of trace.traceEvents.entries()) {
    if (!isTraceEvent(event)) continue;
    const frames = byKey.get(`${event.args?.webkit ?? event.name}:${event.ts}`);
    if (frames) { trace.traceEvents[index] = { ...event, args: { ...event.args, data: { ...dataOf(event), stackTrace: frames } } }; restored++; }
  }
  return restored;
}

export interface ClueWindow { id: string; label: string; phase: string; startTs: number; endTs: number; }

/** Sample weights are concurrent observations, not elapsed time or a causal edge. */
function nativeContext(events: readonly TraceEvent[], lo: number, hi: number) {
  const groups = new Map<string, { process: string; thread: string; samples: number; weightMs: number; leaves: Map<string, number> }>();
  for (const event of events) {
    if (event.ts < lo || event.ts >= hi) continue;
    const args = event.args ?? {}, key = `${event.pid}:${event.tid}`;
    const entry = groups.get(key) ?? { process: String(args.process ?? `Native process ${event.pid}`),
      thread: String(args.thread ?? event.tid), samples: 0, weightMs: 0, leaves: new Map<string, number>() };
    const weight = isFiniteNumber(args.weightMs) ? args.weightMs : (event.dur ?? 0) / 1000;
    entry.samples++; entry.weightMs += weight;
    entry.leaves.set(event.name, (entry.leaves.get(event.name) ?? 0) + weight);
    groups.set(key, entry);
  }
  return { relation: 'samples whose timestamps fall inside the task; concurrent threads and recorder activity are context, not proof of causation',
    threads: [...groups.values()].sort((a, b) => b.weightMs - a.weightMs).map(group => ({ ...group, weightMs: ms(group.weightMs * 1000),
      leaves: [...group.leaves].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, weightMs]) => ({ name, weightMs: ms(weightMs * 1000) })) })) };
}

function networkRecords(raw: unknown) {
  type Request = { id: string; url: string; startUs: number; endUs: number | null; status: unknown;
    decodedBytes: number; transferredBytes: number | null; failure: unknown; initiator: TraceLocation[] };
  const requests: Request[] = [], active = new Map<string, Request>();
  for (const e of rows(recordOf(raw)?.moment)) {
    const p = recordOf(e.params); if (!p || !isFiniteNumber(p.timestamp)) continue;
    const id = `${String(e.source)}:${String(p.requestId)}`;
    if (e.method === 'Network.requestWillBeSent') {
      const prior = active.get(id);
      if (prior && p.redirectResponse) { prior.endUs = p.timestamp * 1e6; prior.status = recordOf(p.redirectResponse)?.status; }
      const r = { id, url: String(recordOf(p.request)?.url ?? ''), startUs: p.timestamp * 1e6,
        endUs: null, status: null, decodedBytes: 0, transferredBytes: null, failure: null,
        initiator: stack(recordOf(p.initiator)?.stackTrace) };
      requests.push(r); active.set(id, r);
    }
    const r = active.get(id); if (!r) continue;
    if (e.method === 'Network.responseReceived') r.status = recordOf(p.response)?.status ?? null;
    if (e.method === 'Network.dataReceived' && isFiniteNumber(p.dataLength)) r.decodedBytes += p.dataLength;
    if (e.method === 'Network.loadingFinished' || e.method === 'Network.loadingFailed') {
      r.endUs = p.timestamp * 1e6;
      if (e.method === 'Network.loadingFailed') r.failure = p.errorText ?? 'loadingFailed';
      const bytes = recordOf(p.metrics)?.responseBodyBytesReceived;
      if (isFiniteNumber(bytes)) r.transferredBytes = bytes;
    }
  }
  return requests;
}

export function traceClues(value: unknown, raw: unknown, windows: readonly ClueWindow[], styleWrites: unknown = null, causeData: unknown = null) {
  const causes = traceCauses(value, causeData);
  const root = recordOf(value), events = rows(root?.traceEvents).filter((e): e is Record<string, unknown> & TraceEvent => isTraceEvent(e)).sort((a, b) => a.ts - b.ts);
  const main = events.filter(e => e.pid === 1 && e.tid === 1);
  const nativeSamples = events.filter(e => e.cat === 'native' && e.ph === 'X');
  const startTs = events.reduce((n, e) => Math.min(n, e.ts), Infinity), endTs = events.reduce((n, e) => Math.max(n, end(e)), -Infinity) + 1;
  const tasks = main.filter(e => e.name === 'RunTask' && (e.dur ?? 0) > 0);
  const costs = createCostIndex(events, { rendererPid: 1, rendererMainTid: 1 }, { startTs, endTs });
  const calls = main.filter(e => e.name === 'FunctionCall' && (e.dur ?? 0) > 0);
  const marks = main.filter(e => e.name === 'TimeStamp' && String(dataOf(e).message).startsWith('cssEarth:navigation:'));
  const flights = windows.filter(w => w.phase === 'flight');
  const context = (ts: number) => {
    const flight = flights.find(w => ts >= w.startTs && ts < w.endTs);
    const phase = marks.filter(m => m.ts <= ts && (!flight || m.ts >= flight.startTs)).at(-1);
    return { flight: flight?.label ?? null, viewId: flight?.id ?? 'full',
      phase: flight && phase ? String(dataOf(phase).message).split(':').at(-1) : null };
  };
  const epoch = recordOf(root?.metadata)?.stopwatchEpochMs;
  const screens = main.filter(e => e.name === 'Screenshot');
  const image = (e: TraceEvent | undefined) => e && isFiniteNumber(epoch) ? {
    sourceUs: e.ts, file: `screens/${Math.round(epoch + e.ts / 1000)}.jpg`,
  } : null;
  const snapshots = main.filter(e => e.args?.webkit === 'cssEarth residency');
  const requests = networkRecords(raw);
  const diagnostic = recordOf(styleWrites);
  const marker = main.find(e => dataOf(e).message === 'cssEarth:capture:style-writes-start');
  const diagnosticEpoch = diagnostic?.epochMs;
  const diagnosticStartUs = marker?.ts ?? (isFiniteNumber(epoch) && isFiniteNumber(diagnosticEpoch) ? (diagnosticEpoch - epoch) * 1000 : null);
  const stateChanges = diagnosticStartUs === null ? [] : rows(diagnostic?.stateChanges).flatMap(c =>
    isFiniteNumber(c.at) ? [{ ...c, sourceUs: diagnosticStartUs + c.at * 1000 }] : []);
  // Keep every over-budget task, plus each flight's worst task even if it fits.
  const selected = new Set(tasks.filter(t => (t.dur ?? 0) > 1e6 / 60));
  for (const f of flights) {
    const worst = tasks.filter(t => t.ts < f.endTs && end(t) > f.startTs).sort((a, b) => (b.dur ?? 0) - (a.dur ?? 0))[0];
    if (worst) selected.add(worst);
  }
  const evidence = correlateEvidence({ events }, {
    selection: { rendererPid: 1, rendererMainTid: 1 }, window: { startTs, endTs }, displayBudgetMs: 1000 / 60,
    evidenceGaps: [], busiestTasks: [...selected].sort((a, b) => a.ts - b.ts).map((t, i): EvidenceTask & { id: string } => ({
      id: `task-${String(i + 1).padStart(3, '0')}`, traceStartUs: t.ts, atMs: ms(t.ts - startTs), durationMs: ms(t.dur ?? 0),
      calls: calls.filter(c => c.ts >= t.ts && end(c) <= end(t)).map(call),
    })),
  });
  // rAF/timer scheduling is joined by ID, with cancellation and reuse respected.
  const pending = new Map<string, TraceEvent>(), schedules = new Map<TraceEvent, TraceEvent>();
  for (const e of main) {
    const raf = /AnimationFrame$/.test(e.name), timer = /^Timer/.test(e.name);
    if (!raf && !timer) continue;
    const d = dataOf(e), id = raf ? d.id : d.timerId;
    if (id == null) continue;
    const key = `${raf ? 'raf' : 'timer'}:${String(id)}`;
    if (e.name === 'RequestAnimationFrame' || e.name === 'TimerInstall') pending.set(key, e);
    if (e.name === 'CancelAnimationFrame' || e.name === 'TimerRemove') pending.delete(key);
    if (e.name === 'FireAnimationFrame' || e.name === 'TimerFire') {
      const request = pending.get(key); if (request) schedules.set(e, request);
      if (raf || (request && dataOf(request).singleShot === true)) pending.delete(key);
    }
  }
  const samples = rows(recordOf(raw)?.moment).filter(e => e.method === 'ScriptProfiler.trackingComplete').flatMap(e =>
    rows(recordOf(recordOf(e.params)?.samples)?.stackTraces).flatMap(s => isFiniteNumber(s.timestamp) && s.timestamp > 0 ? [{
      sourceUs: s.timestamp * 1e6, target: e.source, frames: rows(s.stackFrames).map((f): TraceLocation => ({
        url: f.url, functionName: f.name, lineNumber: f.line, columnNumber: f.column,
      })),
    }] : []));
  const details = evidence.busiestTasks.map(task => {
    const lo = task.traceStartUs, hi = lo + task.durationMs * 1000;
    const before = snapshots.filter(e => e.ts <= lo).at(-1), after = snapshots.find(e => e.ts >= hi);
    const scheduling = [...schedules].filter(([fired]) => fired.ts >= lo && fired.ts < hi).map(([fired, request]) => ({
      fired: fired.name, id: dataOf(fired).id ?? dataOf(fired).timerId, requestUs: request.ts, firedUs: fired.ts,
      delayMs: ms(fired.ts - request.ts), stack: stack(dataOf(request).stackTrace), relation: 'matched callback ID; elapsed delay is not CPU work',
    }));
    const relevant = requests.filter(r => r.startUs <= hi && (r.endUs ?? endTs) >= lo);
    const chain = causes.forTask(lo, hi);
    return { ...task, chain, ...context(lo), ...costs.query(lo, hi), startTs: lo, endTs: hi,
      // Include the scheduling point and neighboring native frames in each task slice.
      contextStartUs: Math.min(lo, ...chain.operations.flatMap(o => o.startUs === null ? [] : [o.startUs]), ...scheduling.map(s => s.requestUs),
        ...(task.renderingPasses ?? []).flatMap(p => p.triggers.map(t => t.traceStartUs)),
        screens.filter(e => e.ts <= lo).at(-1)?.ts ?? lo),
      contextEndUs: Math.max(hi, (screens.find(e => e.ts >= hi)?.ts ?? hi) + 1), scheduling,
      screenshots: { before: image(screens.filter(e => e.ts <= lo).at(-1)), after: image(screens.find(e => e.ts >= hi)) },
      residency: { before: before ? { sourceUs: before.ts, ageMs: ms(lo - before.ts), value: dataOf(before) } : null,
        after: after ? { sourceUs: after.ts, ageMs: ms(after.ts - hi), value: dataOf(after) } : null,
        relation: 'nearest recorded snapshots; changes may span other tasks' },
      mutationContext: { changes: stateChanges.filter(c => c.sourceUs >= (before?.ts ?? lo) && c.sourceUs <= hi),
        relation: 'MutationObserver delivery time, not exact setter time; absence is not proof of no mutation' },
      networkInFlight: relevant, nativeSamples: nativeContext(nativeSamples, lo, hi), timedSamples: samples.filter(s => s.sourceUs >= lo && s.sourceUs < hi),
    };
  });
  // Synchronous style/layout inside a JS call is stronger evidence than nearby timestamps.
  const forced = main.filter(e => ['UpdateLayoutTree', 'Layout'].includes(e.name) && (e.dur ?? 0) > 0).flatMap(e => {
    const parent = calls.filter(c => c.ts <= e.ts && end(c) >= end(e)).sort((a, b) => (a.dur ?? 0) - (b.dur ?? 0))[0];
    return parent ? [{ sourceUs: e.ts, durationMs: ms(e.dur ?? 0), kind: e.name, caller: call(parent), ...context(e.ts) }] : [];
  });
  const groups = new Map<string, typeof forced>();
  for (const f of forced) { const key = JSON.stringify([f.kind, f.caller]); const list = groups.get(key) ?? []; list.push(f); groups.set(key, list); }
  const repeatedSynchronousRendering = [...groups.values()].map(list => ({
    kind: list[0]!.kind, caller: list[0]!.caller, count: list.length, totalMs: ms(list.reduce((s, v) => s + v.durationMs * 1000, 0)),
    maxMs: Math.max(...list.map(v => v.durationMs)), flights: [...new Set(list.map(v => v.flight))], occurrences: list,
    relation: 'rendering nested inside this JS callback; this does not identify which earlier mutation dirtied styles',
  })).sort((a, b) => b.totalMs - a.totalMs);
  const paintByPhase = windows.filter(w => w.phase === 'handoff' || w.phase === 'approach' || w.phase === 'reveal').map(w => {
    const paint = main.filter(e => e.name === 'Paint' && e.ts < w.endTs && end(e) > w.startTs);
    return { viewId: w.id, label: w.label, passes: paint.length, ...costs.query(w.startTs, w.endTs),
      maxPaintMs: paint.reduce((n, e) => Math.max(n, ms(Math.min(end(e), w.endTs) - Math.max(e.ts, w.startTs))), 0) };
  });
  const released = main.filter(e => e.args?.webkit === 'cssEarth scene released').map(e => {
    const d = dataOf(e), after = recordOf(d.after), lifetime = recordOf(after?.lifetime), resources = recordOf(after?.resources);
    const images = recordOf(resources?.images), owners = lifetime?.ownerCount, pending = resources?.pending;
    const anomaly = lifetime?.disposed === false || (isFiniteNumber(owners) && owners > 0) || rows(images?.entries).length > 0 || (Array.isArray(pending) && pending.length > 0);
    return { objectId: d.objectId, sourceUs: e.ts, ...context(e.ts), anomaly,
      disposed: lifetime?.disposed, owners, imageEntries: Array.isArray(images?.entries) ? images.entries.length : null,
      pending: Array.isArray(pending) ? pending.length : null, connectedNodes: after?.connectedNodes,
      relation: 'scene-owned resources after disposal; shared stage may stay connected; not GPU reclamation evidence' };
  });
  const byUrl = new Map<string, typeof requests>();
  for (const r of requests) { const list = byUrl.get(r.url) ?? []; list.push(r); byUrl.set(r.url, list); }
  const profile = rows(recordOf(raw)?.moment).filter(e => e.method === 'ScriptProfiler.trackingComplete');
  const profileTimes = profile.flatMap(e => rows(recordOf(recordOf(e.params)?.samples)?.stackTraces)).map(s => s.timestamp);
  return { causes: { coverage: causes.coverage, targets: causes.targets, motion: causes.motion, limitations: causes.limitations }, tasks: details, repeatedSynchronousRendering, paintByPhase, releases: released,
    domSnapshots: snapshots.map(e => ({ sourceUs: e.ts, ...context(e.ts), ...dataOf(e) })),
    network: { requests, repeatedUrls: [...byUrl].filter(([, r]) => r.length > 1).map(([url, r]) => ({ url, requests: r })),
      failures: requests.filter(r => r.failure || (isFiniteNumber(r.status) && r.status >= 400)),
      relation: 'in-flight overlap is temporal context, not proof of a render dependency; repeated URLs may be legitimate revalidation' },
    styleInitiators: evidence.styleInitiators,
    coverage: { ...evidence.evidenceCoverage, stateChanges: stateChanges.length, styleWriteDiagnostics: diagnostic !== undefined, navigationMarks: marks.length, nativeScreens: screens.length, residencySnapshots: snapshots.length,
      networkRequests: requests.length, profileSamples: profileTimes.length, timedProfileSamples: profileTimes.filter(t => isFiniteNumber(t) && t > 0).length },
    limitations: ['Native screen grabs are sparse samples, not every display frame.',
      'WebKit paint events do not identify the DOM node or CSS property that invalidated it.',
      'Scheduling stacks explain who requested a pass; they do not assign all its cost to that setter.',
      'Untimed ScriptProfiler samples cannot be assigned to individual stalls.',
      ...(diagnostic ? [] : ['No style-write diagnostic log: exact attribute/value changes are unavailable; use --style-writes for a diagnostic run.']),
      ...(snapshots.length ? [] : ['No scene residency snapshots were recorded.']),
      ...(requests.length ? [] : ['No raw network requests were available.'])],
  };
}
