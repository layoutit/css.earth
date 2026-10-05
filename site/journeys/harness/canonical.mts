/** Causal request multisets and per-subject lifecycles; concurrent interleaving carries no contract. */
import { json, parseTrace, type Json, type Observation, type Trace } from './trace.mts';
/** Compare-time only: chunk names retain identity; content-address suffixes belong to the build layer. */
export function canonicalChunkNames(value: Json, ambiguous: readonly string[] = []): Json {
  if (typeof value === 'string') return value.replace(
    /\/_astro\/([^/\s"'<>?]+)[.-][A-Za-z0-9_-]{8,}\.([A-Za-z0-9]{1,8})(?=[\s"'<>?#):]|$)/gu,
    (url, name: string, extension: string) => ambiguous.includes(url) ? url : `/_astro/${name}.HASH.${extension}`);
  if (Array.isArray(value)) return value.map(entry => canonicalChunkNames(entry, ambiguous));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, canonicalChunkNames(entry, ambiguous)]));
  return value;
}
/** Discover ambiguity from the complete build, including assets this journey never requests. */
export function ambiguousChunks(urls: readonly string[]): string[] {
  const names = new Map<string, string[]>();
  for (const url of urls) {
    const key = canonicalChunkNames(url);
    if (typeof key !== 'string') throw new Error('Invalid canonical URL');
    const group = names.get(key) ?? []; group.push(url); names.set(key, group);
  }
  return [...names.values()].filter(group => group.length > 1).flat().sort();
}

/** Latency diagnostics stay in raw recordings; they are not fake-clock guarantees. */
function comparisonEvidence(trace: Trace): Trace {
  const copy = parseTrace(json(trace));
  copy.observations.network = copy.observations.network.filter(row => object(row.data)?.kind !== 'barrier-quiet').map(row => {
    const data = object(row.data);
    if (data) for (const key of ['issue', 'response', 'completion', 'frame', 'nativeFrameBound', 'responseStep', 'completionStep', 'framesToQuiet']) delete data[key];
    return row;
  });
  copy.observations.dom = copy.observations.dom.filter(row => object(row.data)?.kind !== 'dom-order');
  for (const row of copy.observations.dom) {
    const data = object(row.data);
    if (!data) continue;
    delete data.frame;
    for (const key of ['writes', 'events']) if (Array.isArray(data[key])) for (const value of data[key]) {
      const entry = object(value); if (entry) delete entry.frame;
    }
  }
  for (const row of copy.observations.rendering) {
    const data = object(row.data);
    if (data && Array.isArray(data.playback)) for (const value of data.playback) {
      const entry = object(value); if (entry) delete entry.currentTime;
    }
  }
  for (const family of ['network', 'dom', 'rendering'] as const)
    copy.observations[family] = copy.observations[family].map((row, sequence) => ({ ...row, sequence }));
  return copy;
}
function object(value: Json): { [key: string]: Json } | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
function stableKey(value: Json): string {
  if (Array.isArray(value)) return '[' + value.map(stableKey).join(',') + ']';
  const data = object(value);
  if (data) return '{' + Object.keys(data).sort().map(key => JSON.stringify(key) + ':' + stableKey(data[key]!)).join(',') + '}';
  return JSON.stringify(value);
}
const ordered = (rows: { step: string; data: Json }[]): Observation[] => rows.sort((a, b) =>
  stableKey([a.step, object(a.data)?.url ?? object(a.data)?.subject ?? object(a.data)?.kind ?? '', a.data]).localeCompare(stableKey([b.step, object(b.data)?.url ?? object(b.data)?.subject ?? object(b.data)?.kind ?? '', b.data]), 'en')).map((row, sequence) => ({ sequence, ...row }));
/** The raw recorder keeps bytes; the cross-build identity contract compares their size class. */
function comparisonSize(data: { [key: string]: Json }): { [key: string]: Json } {
  const result = { ...data };
  if (typeof result.contentBytes === 'number') {
    result.sizeClass ??= result.contentBytes === 0 ? 0 : Math.ceil(Math.log2(result.contentBytes));
    delete result.contentBytes;
  }
  return result;
}
export function canonicalNetwork(rows: Observation[]): Observation[] {
  if (!rows.some(row => object(row.data)?.kind === 'request')) return rows.map(row => {
    const data = object(row.data); return data ? { ...row, data: comparisonSize(data) } : row;
  });
  const requests = new Map<number, { step: string; data: { [key: string]: Json } }>();
  const extra: { step: string; data: Json }[] = [];
  for (const row of rows) {
    const data = object(row.data);
    if (!data || typeof data.id !== 'number') { extra.push({ step: row.step, data: row.data }); continue; }
    if (data.kind === 'request') requests.set(data.id, { step: row.step, data: { ...data } });
    else {
      const request = requests.get(data.id);
      if (!request) throw new Error('Response without a recorded request');
      for (const [key, value] of Object.entries(data)) if (!['kind', 'id', 'url'].includes(key)) request.data[key] = value;
      if (['response', 'finished', 'failed'].includes(String(data.kind))) request.data.outcome = data.kind;
    }
  }
  const counts = new Map<string, { step: string; data: { [key: string]: Json }; count: number }>();
  for (const request of requests.values()) {
    const data = comparisonSize(request.data);
    if (typeof data.redirectedFrom === 'number') data.redirectedFrom = requests.get(data.redirectedFrom)?.data.url ?? 'unresolved';
    delete data.id; delete data.kind;
    const key = stableKey([request.step, data]);
    const entry = counts.get(key);
    if (entry) entry.count++; else counts.set(key, { step: request.step, data, count: 1 });
  }
  return ordered([...extra, ...[...counts.values()].map(row => ({ step: row.step, data: { ...row.data, count: row.count } }))]);
}
export function canonicalDom(rows: Observation[]): Observation[] {
  if (!rows.some(row => typeof object(row.data)?.subject === 'string' && !Array.isArray(object(row.data)?.writes))) return rows;
  const subjects = new Map<string, { step: string; subject: string; writes: Json[] }>();
  const barriers: { step: string; data: Json }[] = [];
  for (const row of rows) {
    const data = object(row.data);
    if (!data || typeof data.subject !== 'string') { barriers.push({ step: row.step, data: row.data }); continue; }
    const key = JSON.stringify([row.step, data.subject]);
    let entry = subjects.get(key);
    if (!entry) { entry = { step: row.step, subject: data.subject, writes: [] }; subjects.set(key, entry); }
    const write = { ...data }; delete write.subject;
    if (write.volatile === 'html-parser-text-chunks') {
      if (typeof write.parserFinalText !== 'string') throw new Error('Missing parser text bound');
      const previous = object(entry.writes[entry.writes.length - 1] ?? null);
      if (!previous || previous.volatile !== 'html-parser-text-chunks') throw new Error('Parser continuation without an initial text attachment');
      const count = typeof previous.parserChunkCount === 'number' ? previous.parserChunkCount + 1 : 1;
      previous.parserChunkCount = count;
      previous.withinBound = count <= write.parserFinalText.length;
      continue;
    }
    if (typeof write.parserFinalText === 'string' && typeof write.key === 'string' && write.key.includes('<+#text>')) {
      write.volatile = 'html-parser-text-chunks'; write.parserChunkCount = 0; write.withinBound = true;
      write.cause = 'Streaming HTML parsers append raw style/script/noscript text at transport chunk boundaries; script text setters are tracked separately.';
    }
    entry.writes.push(write);
  }
  for (const entry of subjects.values()) for (const write of entry.writes) { const data = object(write); if (data?.volatile === 'html-parser-text-chunks') delete data.parserChunkCount; }
  return ordered([...barriers, ...[...subjects.values()].map(row => ({ step: row.step, data: { subject: row.subject, count: row.writes.length, writes: row.writes } }))]);
}
export function canonicalTrace(trace: Trace, compareChunks = false): Trace {
  trace = comparisonEvidence(trace);
  if (compareChunks) trace = parseTrace(canonicalChunkNames(json(trace), trace.chunkAmbiguities));
  const dom = canonicalDom(trace.observations.dom);
  const declarations: Json[] = [];
  for (const row of dom) {
    const data = object(row.data);
    if (!data || !Array.isArray(data.writes)) continue;
    for (const write of data.writes) { const value = object(write); if (value?.volatile === 'html-parser-text-chunks' && typeof value.parserFinalText === 'string') declarations.push({ family: 'dom', subject: data.subject ?? '', feature: 'html-parser-text-chunks', cause: value.cause ?? '', bound: { minimumChunks: 0, maximumChunks: value.parserFinalText.length, finalTextExact: true } }); }
  }
  const existing = (trace.volatile ?? []).filter(value => object(value)?.family !== 'dom');
  return { ...trace, volatile: [...existing, ...declarations], observations: { ...trace.observations, network: canonicalNetwork(trace.observations.network), dom } };
}
/** Histogram includes all changed leaves, collapsed to path templates; never changes comparison. */
export function differenceHistogram(base: Json, head: Json, path = '$', result = new Map<string, number>()): Map<string, number> {
  if (base === head) return result;
  const a = object(base), b = object(head);
  if (Array.isArray(base) && Array.isArray(head)) {
    if (base.length !== head.length) result.set(path + '.length', (result.get(path + '.length') ?? 0) + 1);
    for (let i = 0; i < Math.min(base.length, head.length); i++) differenceHistogram(base[i]!, head[i]!, path + '[*]', result);
  } else if (a && b) {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) differenceHistogram(a[key] ?? null, b[key] ?? null, path + '.' + key, result);
  } else result.set(path, (result.get(path) ?? 0) + 1);
  return result;
}
export function traceHistogram(base: Trace, head: Trace) {
  return differenceHistogram(json(canonicalTrace(base, true).observations), json(canonicalTrace(head, true).observations));
}
