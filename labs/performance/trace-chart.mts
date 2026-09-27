import type { TimelineFrame, TraceEvent, TraceSelection, TraceWindowBounds } from './trace-model.mts';
import { arrayOf, isFiniteNumber, recordOf } from './trace-model.mts';

// A portable series lets future captures share a chart without reparsing old traces.
export const AVERAGE_WINDOW_MS = 500;
export const AVERAGE_STEP_MS = 100;
const round = (n: number) => Math.round(n * 1000) / 1000;
const ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (value: unknown) => String(value).replace(/[&<>"']/g, c => ESCAPES[c]);

export interface IdleGap { index: number; startMs: number; endMs: number; intervalMs: number; idleMs: number; reason: string }
export interface SeriesPoint { atMs: number; meanMs: number | null; intervals: number }
interface SeriesHeader {
  schema: 'cssearth-frame-average@2'; exclusionPolicy: 'chrome-explicit-idle@1';
  windowMs: typeof AVERAGE_WINDOW_MS; stepMs: typeof AVERAGE_STEP_MS; durationMs: number;
  excludedGaps: readonly unknown[]; label?: unknown; sha256?: unknown; source?: unknown;
}
/** A validated series, possibly read from an earlier agent-brief.json. */
export interface ComparableSeries extends SeriesHeader { points: readonly SeriesPoint[] }
export interface AverageSeries extends ComparableSeries {
  label: string; sha256: string; source: string; metric: string; excludedGaps: IdleGap[]; alignment: string; points: SeriesPoint[];
}

// A presentation interval can span a period in which Chrome explicitly stopped
// requesting frames. This is idle time, not a slow animation frame. Keep all
// uncertain gaps and any interval containing dropped/smoothness-affected frames.
export function chartIdleGaps(events: readonly TraceEvent[], frames: readonly TimelineFrame[],
  { selection, window, displayBudgetMs }: { selection: TraceSelection; window: TraceWindowBounds; displayBudgetMs: number }): IdleGap[] {
  const selected = events.filter(e => e.pid === selection.rendererPid);
  const demand = selected.flatMap(e => {
    const needsBeginFrame = recordOf(e.args?.data)?.needsBeginFrame;
    return e.name === 'NeedsBeginFrameChanged' && (needsBeginFrame === 0 || needsBeginFrame === 1)
      ? [{ ts: e.ts, needsBeginFrame, layerTreeId: e.args?.layerTreeId }] : [];
  }).sort((a, b) => a.ts - b.ts);
  if (new Set(demand.map(e => e.layerTreeId)).size !== 1) return [];
  const pauses: [number, number][] = []; let from: number | null = null;
  for (const event of demand) {
    if (event.needsBeginFrame === 0) from ??= event.ts;
    else if (from !== null) { pauses.push([from, event.ts]); from = null; }
  }
  if (from !== null) pauses.push([from, window.endTs]);
  const pipeline = selected.flatMap(e => e.name === 'PipelineReporter' && e.args?.frame_reporter
    ? [{ ts: e.ts, report: recordOf(e.args.frame_reporter) ?? {} }] : []);
  const active = selected.filter(e => e.tid === selection.rendererMainTid &&
    ['FireAnimationFrame', 'FunctionCall', 'EventDispatch', 'HandlePostMessage'].includes(e.name));
  return frames.flatMap(frame => {
    if (frame.intervalMs <= displayBudgetMs * 3 || !(frame.mainBusyMs <= displayBudgetMs / 4)) return [];
    const lo = window.startTs + frame.startMs * 1000, hi = window.startTs + frame.endMs * 1000;
    const idleMs = pauses.reduce((n, [a, b]) => n + Math.max(0, Math.min(b, hi) - Math.max(a, lo)), 0) / 1000;
    if (idleMs < frame.intervalMs * .8 || active.some(e => e.ts < hi && e.ts + (e.dur ?? 0) > lo)) return [];
    const reports = pipeline.filter(e => e.ts >= lo - displayBudgetMs * 1000 && e.ts < hi).map(e => e.report);
    if (!reports.some(r => r.state === 'STATE_NO_UPDATE_DESIRED') ||
        reports.some(r => r.state === 'STATE_DROPPED' || r.affects_smoothness || r.has_high_latency)) return [];
    return [{ index: frame.index, startMs: frame.startMs, endMs: frame.endMs, intervalMs: frame.intervalMs,
      idleMs: round(idleMs), reason: 'Chrome disabled frame requests for at least 80% of this gap; no active main callback or reported dropped frame' }];
  });
}

export function averageFrames(frames: readonly { index?: number; endMs: number; intervalMs: number }[],
  { durationMs, label, sha256, source, excludedGaps = [] }: { durationMs: number; label: string; sha256: string; source: string; excludedGaps?: IdleGap[] }): AverageSeries {
  const excluded = new Set<number | undefined>(excludedGaps.map(gap => gap.index));
  const rows = frames.filter(f => !excluded.has(f.index) && Number.isFinite(f.endMs) && Number.isFinite(f.intervalMs) && f.intervalMs > 0)
    .sort((a, b) => a.endMs - b.endMs);
  const points: SeriesPoint[] = [];
  let first = 0, last = 0, sum = 0;
  const times: number[] = [];
  for (let t = 0; t < durationMs; t += AVERAGE_STEP_MS) times.push(t);
  times.push(durationMs);
  for (const t of times) {
    while (last < rows.length && rows[last].endMs <= t) sum += rows[last++].intervalMs;
    while (first < last && rows[first].endMs <= t - AVERAGE_WINDOW_MS) sum -= rows[first++].intervalMs;
    points.push({ atMs: round(t), meanMs: last > first ? round(sum / (last - first)) : null, intervals: last - first });
  }
  return { schema: 'cssearth-frame-average@2', label, sha256, source, durationMs,
    metric: 'arithmetic mean of non-idle presentation intervals ending in the trailing window',
    exclusionPolicy: 'chrome-explicit-idle@1', excludedGaps,
    windowMs: AVERAGE_WINDOW_MS, stepMs: AVERAGE_STEP_MS, alignment: 'elapsed time from selected trace window start', points };
}

function hasSeriesHeader(value: unknown): value is SeriesHeader & { points: readonly unknown[] } {
  const series = recordOf(value);
  return series?.schema === 'cssearth-frame-average@2' && series.exclusionPolicy === 'chrome-explicit-idle@1' &&
    series.windowMs === AVERAGE_WINDOW_MS && series.stepMs === AVERAGE_STEP_MS && isFiniteNumber(series.durationMs) &&
    series.durationMs > 0 && (arrayOf(series.points)?.length ?? 0) > 0 && Array.isArray(series.excludedGaps);
}
function hasValidPoints(series: SeriesHeader & { points: readonly unknown[] }): series is ComparableSeries {
  let previous = -1;
  for (const value of series.points) {
    const p = recordOf(value);
    if (!p || !isFiniteNumber(p.atMs) || p.atMs < 0 || p.atMs <= previous || p.atMs > series.durationMs + .001 ||
        (p.meanMs !== null && (!isFiniteNumber(p.meanMs) || p.meanMs <= 0)) || !Number.isInteger(p.intervals) ||
        typeof p.intervals !== 'number' || p.intervals < 0 || ((p.meanMs === null) !== (p.intervals === 0))) return false;
    previous = p.atMs;
  }
  return true;
}

export function validateSeries(series: unknown): ComparableSeries {
  if (!hasSeriesHeader(series)) throw Error('Comparison needs a current agent-brief.json with the same 500 ms idle-filtered average series; reprocess older reports.');
  if (!hasValidPoints(series)) throw Error('Invalid comparison series points.');
  return series;
}

export function renderAverageChart(series: readonly ComparableSeries[]) {
  series.forEach(s => validateSeries(s));
  const width = 1100, top = 84, left = 76, right = 30, plotHeight = 300;
  const legendRows = Math.ceil(series.length / 2), height = top + plotHeight + 118 + legendRows * 26;
  const duration = Math.max(...series.map(s => s.durationMs));
  const max = Math.max(20, ...series.flatMap(s => s.points.map(p => p.meanMs ?? 0)));
  const tick = max <= 60 ? 10 : 10 ** Math.floor(Math.log10(max / 4));
  const ceiling = Math.ceil(max * 1.08 / tick) * tick;
  const x = (t: number) => left + t / duration * (width - left - right), y = (ms: number) => top + plotHeight * (1 - ms / ceiling);
  const colors = ['#6cbcff', '#ffbd69', '#bca1ff', '#69d6b3', '#ff8b9c', '#d8df73'];
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Average frame time comparison"><rect width="100%" height="100%" fill="#0c1220"/><g font-family="system-ui,sans-serif" fill="#e2eaf6"><text x="${left}" y="32" font-size="21" font-weight="600">Frame time · 500 ms rolling average</text><text x="${left}" y="56" font-size="13" fill="#a5b4ca">Lower is better · explicit idle gaps excluded · real hitches retained</text>`;
  for (let i = 0; i <= 5; i++) {
    const value = ceiling * i / 5, at = duration * i / 5;
    svg += `<path d="M${left} ${y(value)}H${width - right}" stroke="#253046"/><text x="${left - 12}" y="${y(value) + 4}" text-anchor="end" font-size="12">${round(value)}</text><text x="${x(at)}" y="${top + plotHeight + 26}" text-anchor="middle" font-size="12">${(at / 1000).toFixed(1)}</text>`;
  }
  svg += `<text x="18" y="${top + 4}" font-size="12">ms</text><text x="${width - right}" y="${top + plotHeight + 49}" text-anchor="end" font-size="12">Elapsed seconds</text><path d="M${left} ${y(1000 / 60)}H${width - right}" stroke="#8a94a7" stroke-dasharray="4 5"/><text x="${width - right}" y="${y(1000 / 60) - 6}" text-anchor="end" font-size="11" fill="#a5b4ca">16.7 ms reference (60 Hz)</text>`;
  series.forEach((s, i) => {
    let d = '', connected = false;
    for (const p of s.points) {
      if (p.meanMs === null) { connected = false; continue; }
      d += `${connected ? 'L' : 'M'}${round(x(p.atMs))} ${round(y(p.meanMs))}`; connected = true;
    }
    const color = colors[i % colors.length], lx = left + (i % 2) * 500, ly = top + plotHeight + 78 + Math.floor(i / 2) * 26;
    svg += `<path data-trace="${escapeHtml(s.sha256 ?? s.label)}" d="${d}" fill="none" stroke="${color}" stroke-width="2.4"${i >= colors.length ? ' stroke-dasharray="7 3"' : ''}/><path d="M${lx} ${ly - 4}h24" stroke="${color}" stroke-width="3"/><text x="${lx + 34}" y="${ly}" font-size="13">${escapeHtml(String(s.label).slice(0, 58))}</text>`;
  });
  const omitted = series.map(s => s.excludedGaps.length).join(' / ');
  return svg + `<text x="${left}" y="${height - 14}" font-size="11" fill="#a5b4ca">Excluded idle intervals, legend order: ${omitted} · raw frame data unchanged</text></g></svg>`;
}
