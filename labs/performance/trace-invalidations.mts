import type { JsonRecord, TraceEvent, TraceLocation, TraceSelection, TraceWindowBounds } from './trace-model.mts';
import { arrayOf, dataOf, recordOf } from './trace-model.mts';

const keyOf = (frame: unknown, id: unknown) => JSON.stringify([frame, id]);
const classes = (value: unknown) => typeof value === 'string' ? value.split(/\s+/) : [];
const ownerRules: [string, (a: Record<string, unknown>) => boolean][] = [
  ['detailed PolyCSS surface', a => classes(a.class).includes('polycss-scene')],
  ['starfield', a => classes(a.class).includes('prepared-point-field')],
  ['orbits', a => 'data-context-orbit' in a || classes(a.class).includes('context-orbit-block')],
  ['world labels', a => 'data-context-label' in a],
  ['world indicators', a => 'data-context-indicator' in a],
  ['world billboards', a => 'data-context-body' in a],
  ['minimap', a => classes(a.class).includes('space-minimap')],
  ['readout', a => classes(a.class).includes('object-view-readout')],
];
// DOMSnapshot tables index strings and nodes by number.
const at = (list: readonly unknown[] | undefined, index: unknown) => typeof index === 'number' ? list?.[index] : undefined;

/** A DOMSnapshot.captureSnapshot result read from a capture directory; checked while it is indexed. */
export interface DomSnapshot { name: string; snapshot: unknown }
export interface NodeOwner { owner: string; snapshots: string[] }

export function indexNodeOwners(snapshots: readonly DomSnapshot[]): Map<string, NodeOwner> {
  const index = new Map<string, NodeOwner>();
  for (const { name, snapshot: value } of snapshots) {
    const snapshot = recordOf(value) ?? {};
    const strings = arrayOf(snapshot.strings) ?? [];
    for (const document of arrayOf(snapshot.documents) ?? []) {
      const doc = recordOf(document) ?? {};
      const frame = at(strings, doc.frameId);
      if (!frame) continue;
      const nodes = recordOf(doc.nodes) ?? {}, resolved = new Map<number, string>(), resolving = new Set<number>();
      const attributes = arrayOf(nodes.attributes), parentIndex = arrayOf(nodes.parentIndex);
      const ownerAt = (i: unknown): string => {
        if (typeof i !== 'number' || i < 0) return 'other DOM';
        const known = resolved.get(i);
        if (known !== undefined) return known;
        if (resolving.has(i)) return 'ambiguous DOM';
        resolving.add(i);
        const attrs: Record<string, unknown> = {}, raw = arrayOf(attributes?.[i]) ?? [];
        for (let j = 0; j < raw.length; j += 2) attrs[String(at(strings, raw[j]))] = at(strings, raw[j + 1]);
        const owner = ownerRules.find(([, matches]) => matches(attrs))?.[0] ?? ownerAt(parentIndex?.[i]);
        resolving.delete(i); resolved.set(i, owner); return owner;
      };
      const backendNodeId = arrayOf(nodes.backendNodeId) ?? [];
      for (let i = 0; i < backendNodeId.length; i++) {
        const id = backendNodeId[i], key = keyOf(frame, id), owner = ownerAt(i);
        const previous = index.get(key);
        if (previous) {
          previous.snapshots.push(name);
          if (previous.owner !== owner) previous.owner = 'ambiguous DOM';
        } else index.set(key, { owner, snapshots: [name] });
      }
    }
  }
  return index;
}

export interface InvalidationExample {
  traceStartUs: number; frame: unknown; nodeId: unknown; nodeName: unknown; event: string; snapshotPresence: string[];
}
export interface InvalidationOwner {
  owner: string; events: number; distinctNodes: number; reasons: { reason: unknown; events: number }[]; examples: InvalidationExample[];
}
export interface InvalidationSetter { location: TraceLocation; events: number; owners: string[]; firstTraceUs: number }
export interface StackedInvalidation {
  name: string; traceStartUs: number; reason: unknown; nodeId: unknown; frame: unknown; owner: string;
  stack: TraceLocation[]; omittedStackFrames: number;
}
export interface InvalidationSummary {
  events: number; firstStackedInvalidation: StackedInvalidation | undefined;
  owners: InvalidationOwner[]; setters: InvalidationSetter[];
}
export interface InvalidationReport extends InvalidationSummary {
  available: boolean; domOwnership: string; snapshotNodeIdentities: number; interpretation: string;
}
export interface InvalidationBrief {
  selection: TraceSelection; window: TraceWindowBounds;
  busiestTasks: readonly {
    traceStartUs: number; durationMs: number; invalidations?: InvalidationSummary;
    renderingPasses?: readonly {
      name: string; traceStartUs: number; durationMs: number; previousPassEndUs: number | null; frame: unknown;
      invalidationEvidence?: { queued: InvalidationSummary; duringPass: InvalidationSummary };
    }[];
  }[];
  costs?: { worstBusyFrames: readonly { startMs: number; endMs: number; invalidations?: InvalidationSummary }[] };
}

export function summarizeInvalidations(events: readonly TraceEvent[], brief: InvalidationBrief, snapshots: readonly DomSnapshot[] = []): InvalidationReport {
  const owners = indexNodeOwners(snapshots), { startTs, endTs } = brief.window;
  const selected = events.filter(e => e.pid === brief.selection.rendererPid && e.tid === brief.selection.rendererMainTid &&
    e.ts >= startTs && e.ts <= endTs && /InvalidationTracking/.test(e.name)).sort((a, b) => a.ts - b.ts);
  const summarize = (rows: readonly TraceEvent[]): InvalidationSummary => {
    type OwnerGroup = { owner: string; events: number; nodeIds: Set<string>; reasons: Map<unknown, number>; examples: InvalidationExample[] };
    const groups = new Map<string, OwnerGroup>();
    const setters = new Map<string, { location: TraceLocation; events: number; owners: Set<string>; firstTraceUs: number }>();
    for (const e of rows) {
      const data = dataOf(e), identity = keyOf(data.frame, data.nodeId), match = owners.get(identity);
      const owner = match?.owner ?? 'unresolved';
      const group: OwnerGroup = groups.get(owner) ?? { owner, events: 0, nodeIds: new Set(), reasons: new Map(), examples: [] };
      group.events++;
      if (data.nodeId != null && data.frame) group.nodeIds.add(identity);
      const reason = data.reason ?? e.name;
      group.reasons.set(reason, (group.reasons.get(reason) ?? 0) + 1);
      if (group.examples.length < 3) group.examples.push({ traceStartUs: e.ts, frame: data.frame ?? null, nodeId: data.nodeId ?? null,
        nodeName: data.nodeName ?? null, event: e.name, snapshotPresence: match?.snapshots ?? [] });
      groups.set(owner, group);
      const top = arrayOf(data.stackTrace)?.[0];
      if (top) {
        const frame: JsonRecord = recordOf(top) ?? {};
        const key = JSON.stringify([frame.url, frame.lineNumber, frame.columnNumber, frame.functionName]);
        const setter = setters.get(key) ?? { location: { ...frame }, events: 0, owners: new Set(), firstTraceUs: e.ts };
        setter.events++; setter.owners.add(owner); setters.set(key, setter);
      }
    }
    const firstStacked = rows.find(e => arrayOf(dataOf(e).stackTrace)?.length);
    const first = firstStacked && dataOf(firstStacked);
    const stackTrace = arrayOf(first?.stackTrace) ?? [];
    return { events: rows.length,
      firstStackedInvalidation: firstStacked && first && { name: firstStacked.name, traceStartUs: firstStacked.ts, reason: first.reason ?? null,
        nodeId: first.nodeId ?? null, frame: first.frame ?? null, owner: owners.get(keyOf(first.frame, first.nodeId))?.owner ?? 'unresolved',
        stack: stackTrace.slice(0, 8).map(entry => {
          const { url, functionName, lineNumber, columnNumber } = recordOf(entry) ?? {};
          return { url, functionName, lineNumber, columnNumber };
        }),
        omittedStackFrames: Math.max(0, stackTrace.length - 8) },
      owners: [...groups.values()].sort((a, b) => b.events - a.events).map(g => ({
      owner: g.owner, events: g.events, distinctNodes: g.nodeIds.size,
      reasons: [...g.reasons].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([reason, events]) => ({ reason, events })), examples: g.examples })),
      setters: [...setters.values()].sort((a, b) => b.events - a.events).slice(0, 8).map(s => ({ ...s, owners: [...s.owners] })) };
  };
  const slice = (lo: number, hi: number, frame?: unknown) => {
    let a = 0, b = selected.length;
    while (a < b) { const m = (a + b) >>> 1; if (selected[m].ts < lo) a = m + 1; else b = m; }
    const out: TraceEvent[] = [];
    for (let i = a; i < selected.length && selected[i].ts < hi; i++) if (!frame || dataOf(selected[i]).frame === frame) out.push(selected[i]);
    return out;
  };
  for (const task of brief.busiestTasks) {
    task.invalidations = summarize(slice(task.traceStartUs, task.traceStartUs + task.durationMs * 1000));
    for (const pass of task.renderingPasses ?? []) {
      const kind = pass.name === 'Layout' ? /Layout/ : /Style/;
      pass.invalidationEvidence = {
        queued: summarize(slice(pass.previousPassEndUs ?? startTs, pass.traceStartUs, pass.frame).filter(e => kind.test(e.name))),
        duringPass: summarize(slice(pass.traceStartUs, pass.traceStartUs + pass.durationMs * 1000, pass.frame).filter(e => kind.test(e.name))),
      };
    }
  }
  for (const frame of brief.costs?.worstBusyFrames ?? []) frame.invalidations = summarize(slice(startTs + frame.startMs * 1000, startTs + frame.endMs * 1000));
  return { available: selected.length > 0, domOwnership: owners.size ? 'snapshot ancestry joined by document frame and backend node ID' : 'unavailable',
    snapshotNodeIdentities: owners.size,
    interpretation: 'Counts describe captured invalidation events, not CSS selectors, unique mutations or milliseconds. During-pass events can describe propagation. Snapshot ancestry is observed before/after capture, not exact per-frame DOM state; conflicting ancestry is marked ambiguous.',
    ...summarize(selected) };
}
