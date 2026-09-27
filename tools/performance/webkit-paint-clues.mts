/** Evidence for mesh attachment, texture activation and decode readiness. No inferred GPU timings. */
import { isRecord } from '@cssearth/core';
import { dataOf, isTraceEvent, type TraceEvent } from './trace-model.mts';
import { traceCauses } from './webkit-trace-causes.mts';
const rows = (value: unknown) => Array.isArray(value) ? value.filter(isRecord) : [];
const urls = (value: unknown) => typeof value === 'string'
  ? [...value.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(match => match[1]!) : [];
export function paintClues(trace: unknown, diagnostic: unknown, layerSamples: readonly unknown[], baseUrl?: string) {
  const events = rows(isRecord(trace) ? trace.traceEvents : []).filter((event): event is Record<string, unknown> & TraceEvent => isTraceEvent(event));
  const source = isRecord(diagnostic) ? diagnostic : {};
  const absolute = (url: string) => { try { return new URL(url, baseUrl).href; } catch { return url; } };
  const causes = traceCauses(trace, diagnostic);
  const nativeSamples = events.filter(event => event.pid === 3 && event.ph === 'X');
  const nativeThreads = new Map(events.filter(event => event.pid === 3 && event.name === 'thread_name')
    .map(event => [event.tid, String(event.args?.name ?? event.tid)]));
  // Native timestamps use a host-wall-clock bridge, not a shared WebKit clock. These are
  // contextual samples, never exact paint ownership, image identity or elapsed-time shares.
  const nativeEvidence = (startUs: number | null, endUs: number | null) => {
    const selected = startUs === null || endUs === null ? [] : nativeSamples.filter(sample => sample.ts >= startUs && sample.ts < endUs);
    const groups = new Map<string, { thread: string; stack: string; samples: number; weightMs: number }>();
    for (const sample of selected) {
      const stack = typeof sample.args?.stack === 'string' ? sample.args.stack : sample.name;
      const key = `${sample.tid}:${stack}`;
      const group = groups.get(key) ?? { thread: nativeThreads.get(sample.tid) ?? String(sample.tid), stack, samples: 0, weightMs: 0 };
      group.samples++; group.weightMs += typeof sample.args?.weightMs === 'number' ? sample.args.weightMs : 0;
      groups.set(key, group);
    }
    const stacks = [...groups.values()].sort((a,b) => b.weightMs-a.weightMs);
    const imageWork = stacks.filter(group => /decodeWebP|createFrameImageAtIndex|createFromImagePixels|recordNativeImageUse/.test(group.stack));
    return { sampleCount: selected.length, distinctStacks: stacks.length, stacks: stacks.slice(0, 8), imageWork,
      relation: 'Approximate clock overlap only; native stacks prove execution paths, not the image URL. Concurrent weights are not elapsed-time attribution.' };
  };
  const times = new Map<number, { startUs?: number; endUs?: number }>();
  for (const event of events) {
    const match = /^cssEarth:decode:(\d+):(begin|end)$/.exec(String(dataOf(event).message ?? ''));
    if (!match) continue;
    const id = Number(match[1]), pair = times.get(id) ?? {};
    if (match[2] === 'begin') pair.startUs = event.ts; else pair.endUs = event.ts;
    times.set(id, pair);
  }
  const decodes = rows(source.decodes).filter(row => typeof row.id === 'number' && typeof row.url === 'string').map(row => ({ id: Number(row.id), url: String(row.url), status: row.status, width: row.width, height: row.height, complete: row.complete, startUs: times.get(Number(row.id))?.startUs ?? null,
    endUs: times.get(Number(row.id))?.endUs ?? null,
    native: nativeEvidence(times.get(Number(row.id))?.startUs ?? null, times.get(Number(row.id))?.endUs ?? null) }));
  const imageWrites = causes.operations.filter(operation => typeof operation.image === 'string' && operation.startUs !== null);
  const attachments = rows(source.attachments).map(attachment => {
    const operation = causes.operations.find(row => row.id === attachment.operationId);
    const nodes = rows(attachment.trees).flatMap(tree => rows(tree.nodes));
    const ids = new Set(nodes.map(node => node.target));
    const writes = imageWrites.filter(write => ids.has(write.target.id));
    const batches = new Map<unknown, typeof writes>();
    for (const write of writes) { const batch = batches.get(write.frame) ?? []; batch.push(write); batches.set(write.frame, batch); }
    // Eventual URL use identifies the asset even if its image was still suppressed at connection.
    const assets = new Map<string, Set<unknown>>();
    for (const node of nodes) for (const url of urls(node.image)) { const faces = assets.get(url) ?? new Set(); faces.add(node.target); assets.set(url, faces); }
    for (const write of writes) for (const url of urls(write.image)) { const faces = assets.get(url) ?? new Set(); faces.add(write.target.id); assets.set(url, faces); }
    const firstPaint = operation?.endUs === null || operation?.endUs === undefined ? undefined : events.find(event => event.pid === 1 && event.tid === 1 && event.name === 'Paint' && event.ts >= operation.endUs!);
    return { operationId: attachment.operationId, startUs: operation?.startUs ?? null, endUs: operation?.endUs ?? null,
      roots: rows(attachment.trees).map(tree => ({ root: tree.root, elements: tree.elements, leaves: tree.leaves, omitted: tree.omitted })),
      nativeDuringActivation: nativeEvidence(operation?.startUs ?? null, writes.length ? Math.max(...writes.map(write => write.endUs ?? write.startUs!)) : operation?.endUs ?? null),
      nodes, firstSubsequentPaintUs: firstPaint?.ts ?? null,
      firstSubsequentPaintMs: firstPaint ? (firstPaint.dur ?? 0) / 1000 : null,
      textureBatches: [...batches].map(([frame, batch]) => ({ frame, startUs: Math.min(...batch.map(row => row.startUs!)),
        endUs: Math.max(...batch.map(row => row.endUs ?? row.startUs!)), writes: batch.length,
        targets: batch.map(row => row.target.id), urls: [...new Set(batch.flatMap(row => urls(row.image)))] })),
      assets: [...assets].map(([url, faces]) => {
        const observed = decodes.filter(row => absolute(row.url) === absolute(url));
        return { url: absolute(url), referencedNodes: faces.size, decodeIds: observed.map(row => row.id),
          decodedBeforeConnection: observed.some(row => row.status === 'resolved' && row.endUs !== null && operation?.startUs !== null && operation?.startUs !== undefined && row.endUs <= operation.startUs),
          decodeObservation: observed.length ? 'observed calls; inspect completion and status' : 'unobserved; may predate instrumentation or use browser CSS decoding' };
      }), relation: 'Attachment and image writes joined by retained node ID; subsequent paint is temporal, not a proven per-node causal edge.' };
  });
  const nativeNodes = layerSamples.filter(isRecord).filter(row => row.kind === 'paint-node');
  const paints = events.filter(event => event.pid === 1 && event.tid === 1 && event.name === 'Paint');
  const expensivePaints = [...paints].sort((a, b) => (b.dur ?? 0) - (a.dur ?? 0)).slice(0, 20).map(event => {
    const data = dataOf(event);
    const nativeNode = null; // Inspector DOM refreshes remap IDs; retain descriptions without guessing cross-snapshot identity.
    const native = nativeEvidence(event.ts, event.ts + (event.dur ?? 0));
    return { sourceUs: event.ts, durationMs: (event.dur ?? 0) / 1000, data, nativeNode, nativeSampleCount: native.sampleCount, nativeStacks: native.stacks,
      nativeStackCoverage: { distinctStacks: native.distinctStacks, shown: native.stacks.length, relation: native.relation },
      identity: 'unavailable; native DOM snapshots are not an exact paint-time identity mapping' };
  });
  return { enabled: Array.isArray(source.attachments), coverage: source.paintCoverage ?? null, decodes, attachments, expensivePaints,
    nativePaintNodes: nativeNodes, paintEvents: paints.length, paintsWithNodeId: paints.filter(event => typeof dataOf(event).nodeId === 'number').length,
    limitations: ['Debug collection adds overhead; use a normal trace for timing.',
      'Native and WebKit clocks are bridged through host wall time; exact cross-profiler interval attribution is unavailable.',
      'Decode promise completion is not GPU upload completion or proof of continued image residency.',
      'Pre-install decodes are unobserved. No missing decode is automatically a failure.',
      'Paints without native node IDs cannot be exactly mapped to faces from their clip rectangles.',
      'Native node descriptions are asynchronous layer observations; their inline styles may change later.'] };
}
export function paintTraceEvents(clues: ReturnType<typeof paintClues>): Record<string, unknown>[] {
  if (!clues.enabled) return [];
  return [{ ph: 'M', pid: 1, tid: 5, name: 'thread_name', args: { name: 'Diagnostic mesh / atlas / decode evidence' } },
    ...clues.decodes.flatMap(row => row.startUs === null || row.endUs === null ? [] : [{ ph: 'X', pid: 1, tid: 5, cat: 'cssearth.paint-evidence',
      name: `Image decode: ${row.url}`, ts: row.startUs, dur: Math.max(1, row.endUs - row.startUs), args: { data: row } }]),
    ...clues.attachments.flatMap(row => row.startUs === null ? [] : [{ ph: 'i', s: 't', pid: 1, tid: 5, cat: 'cssearth.paint-evidence',
      name: `Mesh connection: ${row.roots.reduce((sum, root) => sum + Number(root.leaves ?? 0), 0)} leaves`, ts: row.startUs,
      args: { data: { ...row, nodes: undefined } } }]),
    ...clues.attachments.flatMap(row => row.textureBatches.map(batch => ({ ph: 'X', pid: 1, tid: 5, cat: 'cssearth.paint-evidence',
      name: `Texture activation: ${batch.writes} writes`, ts: batch.startUs, dur: Math.max(1, batch.endUs - batch.startUs), args: { data: batch } })))];
}
