#!/usr/bin/env node
import { sha256 } from '../../src/platform/sha256.mts';
import { readFile, writeFile, mkdir, stat, realpath } from 'node:fs/promises';
import { resolve, basename, dirname, relative, isAbsolute } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { SourceMapConsumer } from 'source-map-js';
import type { RawSourceMap } from 'source-map-js';
import sharp from 'sharp';
import { isRecord } from '@cssearth/core';
import type { CompleteEvent, JsonRecord, OriginalLocation, TimelineFrame, TraceEvent, TraceLocation, TraceSelection, TraceWindow } from './trace-model.mts';
import { arrayOf, errorCode, errorMessage, hasDuration, isFiniteNumber, isTraceEvent, present, recordOf } from './trace-model.mts';
import type { CorrelatedEvidence, EvidenceInput, EvidenceTask, LocationSources } from './trace-evidence.mts';
import { correlateEvidence, allLocations } from './trace-evidence.mts';
import { loadTrace } from './load-trace.mts';
import type { CostDiagnosis, CostQuery } from './trace-costs.mts';
import { diagnoseCosts } from './trace-costs.mts';
import type { CaptureComparison, CaptureSummary, RecorderState } from './trace-capture.mts';
import { readCapture, compareCaptures } from './trace-capture.mts';
import type { InvalidationReport, InvalidationSummary } from './trace-invalidations.mts';
import { summarizeInvalidations } from './trace-invalidations.mts';
import type { AverageSeries, ComparableSeries } from './trace-chart.mts';
import { chartIdleGaps, averageFrames, validateSeries, renderAverageChart } from './trace-chart.mts';
import { buildDiagnosis, renderReport } from './trace-report.mts';

const ms = (value: number) => Math.round(value * 1000) / 1000;

const eventsOf = <E extends TraceEvent>(events: readonly E[], name: string) => events.filter(e => e.name === name);

// Nested trace slices are overlapping descriptions of the same work. Report
// their union, never the sum of RunTask + FunctionCall + its child operations.
export function occupiedMs(events: readonly { readonly ts: number; readonly dur: number }[], start: number, end: number) {
  const ranges = events.map((e): [number, number] => [Math.max(start, e.ts), Math.min(end, e.ts + e.dur)])
    .filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
  let until = start, total = 0;
  for (const [a, b] of ranges) { total += Math.max(0, b - Math.max(a, until)); until = Math.max(until, b); }
  return ms(total / 1000);
}

export function decodeWork(events: readonly TraceEvent[], start: number, end: number) {
  const slices = events.filter((e): e is CompleteEvent => /DecodeImage|Decode Image|ImageDecodeTask/.test(e.name) && e.ph === 'X' && hasDuration(e) && e.dur > 0);
  const threads = [...new Set(slices.map(e => e.tid))].map(tid => ({ tid,
    occupiedMs: occupiedMs(slices.filter(e => e.tid === tid), start, end) }));
  return { sliceCount: slices.length, threads,
    summedThreadOccupancyMs: ms(threads.reduce((total, t) => total + t.occupiedMs, 0)),
    eventNames: [...new Set(slices.map(e => e.name))],
    longestSlices: [...slices].sort((a, b) => b.dur - a.dur).slice(0, 5).map(e => ({
      name: e.name, tid: e.tid, traceStartUs: e.ts, atMs: ms((e.ts - start) / 1000), durationMs: ms(e.dur / 1000),
      pixelRefId: e.args?.pixelRefId ?? null, imageType: e.args?.imageType ?? null,
    })),
    interpretation: 'Union per thread removes nesting. Threads may overlap; this sum is not elapsed time or main-thread blocking.' };
}
export type DecodeWork = ReturnType<typeof decodeWork>;

const CATEGORIES = ['FireAnimationFrame', 'FunctionCall', 'RunMicrotasks', 'UpdateLayoutTree', 'Layout', 'PrePaint', 'Paint', 'Layerize', 'Commit', 'MajorGC', 'MinorGC'] as const;
type WorkCategory = typeof CATEGORIES[number];
export interface WorkStat { count: number; occupiedMs: number; maxMs: number }
export type WorkSummary = Record<WorkCategory, WorkStat>;
// Key order follows CATEGORIES.
const byCategory = (value: (name: WorkCategory) => WorkStat): WorkSummary => ({ FireAnimationFrame: value('FireAnimationFrame'),
  FunctionCall: value('FunctionCall'), RunMicrotasks: value('RunMicrotasks'), UpdateLayoutTree: value('UpdateLayoutTree'),
  Layout: value('Layout'), PrePaint: value('PrePaint'), Paint: value('Paint'), Layerize: value('Layerize'), Commit: value('Commit'),
  MajorGC: value('MajorGC'), MinorGC: value('MinorGC') });

/** FrameSleuth's input record. The brief adds the SHA-256 of the original trace bytes. */
export type AnalysisInput = Record<string, unknown> & { sha256?: string };
/** The FrameSleuth analysis fields the brief reads. */
export interface BriefAnalysis {
  input: AnalysisInput; selection: TraceSelection; window: TraceWindow;
  timeline: { displayMs?: number | null; stats: JsonRecord; frames: readonly TimelineFrame[] };
  pipeline: { available?: unknown; states?: unknown; droppedCount?: unknown; affectsSmoothnessCount?: unknown };
  longTasks: JsonRecord; garbageCollection: { occupancyMs?: unknown; maxMs?: unknown };
  capabilities: { warnings: readonly unknown[] };
}
export interface FrameAnalysis extends BriefAnalysis { timeline: BriefAnalysis['timeline'] & { source: string } }

const isTimelineFrame = (value: unknown): value is TimelineFrame => {
  const f = recordOf(value);
  return !!f && isFiniteNumber(f.index) && isFiniteNumber(f.startMs) && isFiniteNumber(f.endMs) &&
    isFiniteNumber(f.intervalMs) && isFiniteNumber(f.mainBusyMs);
};
/** FrameSleuth is loaded from another checkout, so its result is checked before use. */
export function isFrameAnalysis(value: unknown): value is FrameAnalysis {
  const a = recordOf(value), selection = recordOf(a?.selection), window = recordOf(a?.window), timeline = recordOf(a?.timeline);
  const frames = arrayOf(timeline?.frames), displayMs = timeline?.displayMs;
  return !!a && isRecord(a.input) && isFiniteNumber(selection?.rendererPid) && isFiniteNumber(selection?.rendererMainTid) &&
    isFiniteNumber(window?.startTs) && isFiniteNumber(window?.endTs) && isFiniteNumber(window?.durationMs) &&
    (displayMs == null || isFiniteNumber(displayMs)) && isRecord(timeline?.stats) && typeof timeline?.source === 'string' &&
    !!frames && frames.every(isTimelineFrame) && isRecord(a.pipeline) && isRecord(a.longTasks) &&
    isRecord(a.garbageCollection) && Array.isArray(recordOf(a.capabilities)?.warnings);
}

export interface BusyTask extends EvidenceTask {
  overlappingFrameIntervals: { index: number; startMs: number; endMs: number; intervalMs: number }[];
  work: WorkSummary; maxStyleElements: number; layoutRoots: unknown[];
  exclusive?: CostQuery; invalidations?: InvalidationSummary; recorder?: RecorderState | null;
}
export interface BriefBase extends EvidenceInput {
  schema: string; input: AnalysisInput; selection: TraceSelection; window: TraceWindow; displayBudgetMs: number;
  presentation: JsonRecord;
  pipeline: { available: unknown; states: unknown; dropOrSmoothnessMarkers: unknown; affectsSmoothness: unknown };
  longTasks: JsonRecord; mainWork: WorkSummary; imageDecoding: DecodeWork; inputEvents: Record<string, number>;
  busiestTasks: BusyTask[]; lowMainWorkGaps: TimelineFrame[]; clues: { id: string; fact: string }[]; evidenceGaps: unknown[];
}
export type CorrelatedBrief = BriefBase & CorrelatedEvidence;
export interface SourceMapStatus { file?: string; sha256?: string; status: string; reason?: unknown }
export interface BuildCall { functionName: unknown; line: unknown; column: unknown; original: unknown; excerpt: string | undefined }
export interface BuildSource {
  url: unknown; file: string; bytes?: number; sha256?: string; expected?: unknown; verification?: string;
  sourceMap?: SourceMapStatus; calls?: BuildCall[]; unavailable?: unknown;
}
export interface Processor {
  module: string; sha256: string; wrapperSha256: string; loaderSha256: string; evidenceModuleSha256: string; modules: Record<string, string>;
}
export type BriefComparison = CaptureComparison & { reportFile: string; reportSha256: string };
/** The complete brief written to agent-brief.json. */
export interface TraceBrief extends CorrelatedBrief {
  capture: CaptureSummary; costs: CostDiagnosis; invalidations: InvalidationReport; processor: Processor;
  buildSources: BuildSource[]; averageSeries: AverageSeries; comparisons: BriefComparison[]; processingSeconds?: number;
}

export function buildBrief(loaded: { readonly events: readonly TraceEvent[] }, analysis: BriefAnalysis): CorrelatedBrief {
  const { rendererPid: pid, rendererMainTid: tid } = analysis.selection;
  const { startTs, endTs } = analysis.window;
  const selected = loaded.events.filter(e => e.pid === pid && e.ts + (e.dur ?? 0) >= startTs && e.ts <= endTs);
  const main = selected.filter((e): e is CompleteEvent => e.tid === tid && e.ph === 'X' && hasDuration(e) && e.dur > 0);
  const budget = analysis.timeline.displayMs ?? 16.667;
  const taskName = main.some(e => e.name === 'RunTask') ? 'RunTask' : 'ThreadControllerImpl::RunTask';
  const clippedDuration = (e: CompleteEvent) => Math.min(endTs, e.ts + e.dur) - Math.max(startTs, e.ts);
  const tasks = eventsOf(main, taskName).sort((a, b) => clippedDuration(b) - clippedDuration(a)).slice(0, 8);
  const summarize = (events: readonly CompleteEvent[], lo: number, hi: number) => byCategory(name => {
    const found = eventsOf(events, name);
    return { count: found.length, occupiedMs: occupiedMs(found, lo, hi),
      maxMs: ms(Math.max(0, ...found.map(e => Math.min(hi, e.ts + e.dur) - Math.max(lo, e.ts))) / 1000) };
  });
  // A call keeps every recorded FunctionCall field; its location fields stay unknown until read.
  const calls = (events: readonly CompleteEvent[]) => eventsOf(events, 'FunctionCall').sort((a, b) => b.dur - a.dur).slice(0, 4).map(e => {
    const call: TraceLocation & { ms: number } = { ms: ms(e.dur / 1000), ...recordOf(e.args?.data) };
    return call;
  });
  const busiestTasks = tasks.map((task): BusyTask => {
    const lo = Math.max(startTs, task.ts), hi = Math.min(endTs, task.ts + task.dur);
    const children = main.filter(e => e.ts < hi && e.ts + e.dur > lo);
    const styles = eventsOf(children, 'UpdateLayoutTree');
    const frames = analysis.timeline.frames.filter(f => startTs + f.startMs * 1000 < hi && startTs + f.endMs * 1000 > lo);
    return { traceStartUs: lo, atMs: ms((lo - startTs) / 1000), durationMs: ms((hi - lo) / 1000),
      overlappingFrameIntervals: frames.map(f => ({ index: f.index, startMs: f.startMs, endMs: f.endMs, intervalMs: f.intervalMs })),
      // Math.max coerces each element count exactly as Number() does.
      work: summarize(children, lo, hi), maxStyleElements: Math.max(0, ...styles.map(e => Number(e.args?.elementCount ?? 0))),
      layoutRoots: [...new Set(eventsOf(children, 'Layout').flatMap(e => arrayOf(recordOf(e.args?.endData)?.layoutRoots)?.map(value => {
        const root = recordOf(value);
        return root?.nodeName ?? root?.nodeId;
      }) ?? []))],
      calls: calls(children),
    };
  });
  const counts = Object.fromEntries(['wheel', 'pointermove', 'pointerdown', 'pointerup', 'click', 'objectnavigate', 'objecthoverchange'].map(type =>
    [type, selected.filter(e => e.name === 'EventDispatch' && recordOf(e.args?.data)?.type === type).length]));
  const marks = selected.filter(e => e.name.startsWith('cssEarth:') && e.ph !== 'E').map(e => ({
    name: e.name, atMs: ms((e.ts - startTs) / 1000), data: e.args?.data ?? e.args?.detail,
  }));
  const imageDecoding = decodeWork(selected, startTs, endTs);
  const mainWork = summarize(main, startTs, endTs);
  const maximumGap = [...analysis.timeline.frames].sort((a, b) => b.intervalMs - a.intervalMs)[0];
  // Low main-thread work is a clue, not proof of idleness: worker, GPU, input
  // and scheduler evidence must explain a gap before calling it a render stall.
  const sparseGaps = analysis.timeline.frames.filter(f => f.intervalMs > budget * 2 && f.mainBusyMs < Math.min(budget, f.intervalMs * .25));
  const clues: { id: string; fact: string }[] = [];
  const add = (id: string, fact: string) => clues.push({ id, fact });
  const worst = busiestTasks[0];
  if (worst) add('busy-main-task', `At +${worst.atMs} ms, a main task takes ${worst.durationMs} ms; style recalculation occupies ${worst.work.UpdateLayoutTree.occupiedMs} ms and reaches ${worst.maxStyleElements} elements.`);
  // The comparison coerces the occupancy exactly as Number() does.
  if (Number(analysis.garbageCollection.occupancyMs) > 0) add('allocation-pressure', `GC occupies ${analysis.garbageCollection.occupancyMs} ms of main-thread time; largest event ${analysis.garbageCollection.maxMs} ms.`);
  if (sparseGaps.length && maximumGap) add('sparse-gaps', `${sparseGaps.length} long presentation gaps have relatively little main-thread work. The largest overall gap is ${maximumGap.intervalMs} ms with ${maximumGap.mainBusyMs} ms main work.`);
  add('image-decode', `${imageDecoding.sliceCount} renderer image-decode slices; ${imageDecoding.summedThreadOccupancyMs} ms summed thread occupancy after removing nesting. Parallel thread time is not main-thread blocking.`);
  const styles = mainWork.UpdateLayoutTree, layers = mainWork.Layerize;
  add('rendering-cost', `Styles occupy ${styles.occupiedMs} ms and layer construction ${layers.occupiedMs} ms on main.`);
  return correlateEvidence<BriefBase>(loaded, { schema: 'cssearth-trace-brief@3', input: analysis.input, selection: analysis.selection,
    window: analysis.window, displayBudgetMs: budget, presentation: analysis.timeline.stats,
    pipeline: { available: analysis.pipeline.available, states: analysis.pipeline.states,
      dropOrSmoothnessMarkers: analysis.pipeline.droppedCount, affectsSmoothness: analysis.pipeline.affectsSmoothnessCount },
    longTasks: analysis.longTasks, mainWork, imageDecoding, inputEvents: counts,
    busiestTasks, lowMainWorkGaps: sparseGaps.slice(0, 12), clues,
    evidenceGaps: [...analysis.capabilities.warnings,
      ...(marks.some(e => e.name.startsWith('cssEarth:recording:')) ? [] : ['No recorder synchronization marks; camera/resource state cannot be reconstructed from a parallel recorder.']),
      'Bundle URLs identify names, not source bytes. A supplied --build is hashed separately and must match the traced build.',
      'Trace durations include instrumentation overhead. Categories may nest and must not be added together.',
      'Paint bounding boxes do not establish the number of opaque or alpha pixels painted.',
      'No captured image-decode slices is not proof of zero decoding; category coverage and startup outside this trace are not measured.',
      'CPU samples estimate self time and identify function entry locations, not an exact currently executing statement.'],
  });
}

function markdown(brief: TraceBrief) {
  const tasks = brief.busiestTasks;
  return `# cssEarth trace brief\n\n${brief.input.name}\n\n` +
    `Window: ${(brief.window.durationMs / 1000).toFixed(2)} s. Display budget: ${brief.displayBudgetMs.toFixed(2)} ms. Presentation p95: ${brief.presentation.p95Ms} ms.\n\n` +
    `Chrome reports ${brief.pipeline.affectsSmoothness ?? 'unknown'} markers affecting smoothness; ${brief.longTasks.count ?? 'unknown'} main tasks exceed 50 ms. These are different measurements.\n\n` +
    `## Measured findings\n\n` + brief.clues.map(c => `- **${c.id}:** ${c.fact}`).join('\n\n') +
    `\n\n## Busiest main tasks\n\n| At (ms) | Task (ms) | Styles (ms) | Elements | Layers (ms) |\n| ---: | ---: | ---: | ---: | ---: |\n` +
    tasks.map(t => `| ${t.atMs} | ${t.durationMs} | ${t.work.UpdateLayoutTree.occupiedMs} | ${t.maxStyleElements} | ${t.work.Layerize.occupiedMs} |`).join('\n') +
    `\n\n## Navigation timing\n\n` + brief.navigations.map(n => `- **${n.from} → ${n.to}**${n.incomplete ? ' (incomplete capture)' : ''}: ` + n.phases.map(p => `${p.phase} ${p.sinceRequestMs ?? '?'} ms`).join(' · ')).join('\n') +
    `\n\n## Recurring style scheduling stacks\n\nThese are scheduling origins, not exclusive attribution of all subsequent style work.\n\n` + brief.styleInitiators.slice(0, 5).map(g => `- ${g.totalMs} ms across ${g.passCount} passes; ${g.overBudgetCount} exceed the display budget; peak ${g.maxElements} elements. Origin: ${g.initiators.map(locationLabel).join(', ') || 'no captured stack'}.`).join('\n') +
    `\n\n## Worst task context\n\n` + tasks.slice(0, 3).map(t => `- **+${t.atMs} ms:** ${present(t.navigation, 'task navigation').map(n => `${n.from} → ${n.to}, ${n.phase}, ${n.sinceRequestMs} ms after request`).join('; ') || 'outside captured navigation'}\n` +
      present(t.renderingPasses, 'task rendering passes').filter(p => p.name === 'UpdateLayoutTree').map(p => `  Style ${p.durationMs} ms / ${p.elements ?? '?'} elements. Scheduling stack: ${p.triggers.flatMap(s => s.stack.map(locationLabel)).join(' → ') || 'not captured'}.`).join('\n')).join('\n\n') +
    `\n\nFull stacks, input ages, exact timestamps, worker delivery links, source excerpts and build hashes are in agent-brief.json.\n\n## Evidence limits\n\n` + brief.evidenceGaps.map(v => `- ${v}`).join('\n') + '\n';
}

const fileOf = (url: unknown) => typeof url === 'string' ? url.split('/').at(-1) : undefined;
function locationLabel(c: TraceLocation) {
  const original = recordOf(c.original);
  return original ? `${original.source}:${original.line}:${original.column} (${original.name ?? c.functionName})`
    : `${c.functionName || '(anonymous)'} ${fileOf(c.url) ?? 'native'}:${c.lineNumber ?? '?'}:${c.columnNumber ?? '?'}`;
}

function isRawSourceMap(value: unknown): value is RawSourceMap {
  const map = recordOf(value);
  const strings = (list: unknown) => Array.isArray(list) && list.every(item => typeof item === 'string');
  // SourceMapConsumer checks the version and decodes the mappings itself. Its
  // declaration types `version` as a string, although source maps store 3.
  return !!map && strings(map.sources) && strings(map.names) && typeof map.mappings === 'string';
}
/** Source maps in a supplied build are external JSON. */
export function readSourceMap(text: string): SourceMapConsumer {
  const value: unknown = JSON.parse(text);
  if (!isRawSourceMap(value)) throw new TypeError('Source map needs string sources, names and mappings.');
  return new SourceMapConsumer(value);
}

export async function inspectBuild(brief: LocationSources & { readonly sourceUrls: readonly unknown[] }, build?: string | null, expectedSources: unknown = {}): Promise<BuildSource[]> {
  if (!build) return [];
  const root = await realpath(resolve(build)), output: BuildSource[] = [];
  const withinRoot = (file: string) => { const rel = relative(root, file); return !rel.startsWith('..') && !isAbsolute(rel); };
  const callSites = allLocations(brief);
  for (const url of brief.sourceUrls) {
    let pathname: string;
    // The URL constructor converts its argument exactly as String() does.
    try { pathname = decodeURIComponent(new URL(String(url)).pathname); } catch { continue; }
    const file = resolve(root, '.' + pathname), rel = relative(root, file);
    if (rel.startsWith('..') || isAbsolute(rel) || !/\.m?js$/.test(file)) continue;
    try {
      if (!withinRoot(await realpath(file))) throw Error('Source symlink leaves supplied build');
      const bytes = await readFile(file), text = bytes.toString(), lines = text.split('\n');
      const expected = recordOf(expectedSources)?.[pathname], manifest = recordOf(expected) ?? {};
      const verification = expected ? (manifest.sha256 === sha256(bytes) && manifest.bytes === bytes.length ? 'matches capture manifest' : 'MISMATCH with capture manifest') : 'provided build; capture bytes unverified';
      if (verification.startsWith('MISMATCH')) { output.push({ url, file, bytes: bytes.length, sha256: sha256(bytes), expected, verification }); continue; }
      let consumer: SourceMapConsumer | undefined, sourceMap: SourceMapStatus;
      try {
        if (!withinRoot(await realpath(file + '.map'))) throw Error('Source map symlink leaves supplied build');
        const mapBytes = await readFile(file + '.map');
        consumer = readSourceMap(mapBytes.toString());
        sourceMap = { file: file + '.map', sha256: sha256(mapBytes), status: expected ? 'provided-build-map; JS matches capture manifest, map supplied separately' : 'provided-build-map; traced bytes not independently verified' };
      } catch (error) { sourceMap = { status: 'unavailable', reason: errorCode(error) ?? errorMessage(error) }; }
      for (const c of callSites.filter(c => c.url === url)) {
        const line = c.lineNumber, column = c.columnNumber;
        if (!consumer || typeof line !== 'number' || typeof column !== 'number' || !(line > 0) || !(column > 0)) continue;
        const original = consumer.originalPositionFor({ line, column: column - 1 });
        if (!original.source) continue;
        const content = consumer.sourceContentFor(original.source, true);
        const located: OriginalLocation = { ...original, column: original.column + 1, sourceContentSha256: content == null ? null : sha256(content),
          excerpt: content?.split('\n').slice(Math.max(0, original.line - 3), original.line + 2).join('\n') ?? null };
        c.original = located;
      }
      output.push({ url, file, bytes: bytes.length, sha256: sha256(bytes), verification, sourceMap,
        calls: [...new Map(callSites.filter(c => c.url === url).map(c => [JSON.stringify([c.lineNumber, c.columnNumber]), c])).values()].map(c => ({
          functionName: c.functionName, line: c.lineNumber, column: c.columnNumber,
          original: c.original ?? null,
          // Arithmetic converts recorded positions exactly as Number() does.
          excerpt: lines[Math.max(0, Number(c.lineNumber ?? 1) - 1)]?.slice(Math.max(0, Number(c.columnNumber ?? 1) - 61), Number(c.columnNumber ?? 1) + 300),
        })) });
    } catch (error) { output.push({ url, file, unavailable: errorCode(error) ?? errorMessage(error) }); }
  }
  return output;
}

const VALUE_OPTIONS = ['--out', '--url', '--build', '--framesleuth', '--compare', '--capture', '--label'];

export async function main(argv: readonly string[]): Promise<{ output: string; brief: TraceBrief } | undefined> {
  const options: { compare: string[]; out?: string; url?: string; build?: string; framesleuth?: string; capture?: string; label?: string } = { compare: [] };
  let input: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]; if (arg === '--') continue;
    if (arg === '--help' || arg === '-h') {
      console.log('node tools/performance/trace-brief.mts <trace.json[.gz]> [--out directory] [--label name] [--compare prior/agent-brief.json] [--capture directory] [--url page-substring] [--build built-site] [--framesleuth module]\nRepeat --compare to overlay saved traces. The chart always uses a 500 ms mean. Sidecar metadata is discovered beside the trace.\nFrameSleuth defaults to the sibling cssGraphics checkout, or CSSEARTH_FRAMESLEUTH.'); return;
    }
    if (VALUE_OPTIONS.includes(arg)) {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw Error(`Missing value for ${arg}`);
      i++;
      if (arg === '--compare') options.compare.push(resolve(value));
      else if (arg === '--out') options.out = value;
      else if (arg === '--url') options.url = value;
      else if (arg === '--build') options.build = value;
      else if (arg === '--framesleuth') options.framesleuth = value;
      else if (arg === '--capture') options.capture = value;
      else options.label = value;
    } else if (!input && !arg.startsWith('-')) input = resolve(arg);
    else throw Error(`Unexpected argument: ${arg}`);
  }
  if (!input) throw Error('Provide a Chrome trace .json or .json.gz. Use --help for options.');
  // Validate old series before loading a potentially multi-gigabyte new trace.
  const baselines: { file: string; sha256: string; brief: unknown; series: ComparableSeries }[] = [];
  for (const file of options.compare) {
    const bytes = await readFile(file), baseline: unknown = JSON.parse(bytes.toString());
    const series = validateSeries(recordOf(baseline)?.averageSeries);
    baselines.push({ file, sha256: sha256(bytes), brief: baseline, series });
  }
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const sleuthPath = resolve(options.framesleuth ?? process.env.CSSEARTH_FRAMESLEUTH ?? resolve(root, '../cssGraphics/scripts/frame-sleuth.mjs'));
  await stat(sleuthPath).catch(() => { throw Error(`FrameSleuth not found at ${sleuthPath}. Set CSSEARTH_FRAMESLEUTH or --framesleuth to cssGraphics/scripts/frame-sleuth.mjs.`); });
  const started = performance.now();
  const sleuth: unknown = await import(pathToFileURL(sleuthPath).href);
  const analyzeTrace = recordOf(sleuth)?.analyzeTrace, renderFrameChartSvg = recordOf(sleuth)?.renderFrameChartSvg;
  if (typeof analyzeTrace !== 'function' || typeof renderFrameChartSvg !== 'function')
    throw Error(`FrameSleuth at ${sleuthPath} must export analyzeTrace and renderFrameChartSvg.`);
  console.log('Reading trace and matching renderer…');
  const loaded = await loadTrace(input), sourceHash = loaded.sha256;
  const analysisValue: unknown = analyzeTrace(loaded, { top: 5, ...(options.url ? { url: options.url } : {}) });
  if (!isFrameAnalysis(analysisValue)) throw Error('FrameSleuth analysis lacks the selection, window or timeline the brief needs.');
  const analysis = analysisValue;
  // Trace events are external. Joins read only events whose compared fields have Chrome's JSON types.
  const events = loaded.events.filter(isTraceEvent);
  const correlated = buildBrief({ events }, analysis);
  correlated.input.sha256 = sourceHash;
  const capture = await readCapture(input, events, analysis.selection, options.capture);
  const withCapture = Object.assign(correlated, { capture: capture.summary });
  const withCosts = Object.assign(withCapture, { costs: diagnoseCosts(events, withCapture, analysis) });
  const withInvalidations = Object.assign(withCosts, { invalidations: summarizeInvalidations(events, withCosts, capture.snapshots) });
  for (const task of withInvalidations.busiestTasks) task.recorder = capture.stateAt(task.traceStartUs);
  for (const frame of [...withInvalidations.costs.worstBusyFrames, ...withInvalidations.costs.longestPresentationGaps])
    frame.recorder = capture.stateAt(withInvalidations.window.startTs + frame.startMs * 1000);
  withInvalidations.sourceUrls = [...new Set(allLocations(withInvalidations).map(l => l.url).filter(Boolean))];
  const modules: Record<string, string> = {};
  const withProcessor = Object.assign(withInvalidations, { processor: { module: sleuthPath, sha256: sha256(await readFile(sleuthPath)), wrapperSha256: sha256(await readFile(import.meta.filename)),
    loaderSha256: sha256(await readFile(new URL('./load-trace.mts', import.meta.url))),
    evidenceModuleSha256: sha256(await readFile(new URL('./trace-evidence.mts', import.meta.url))), modules } });
  for (const name of ['trace-costs', 'trace-capture', 'trace-invalidations', 'trace-chart', 'trace-report'])
    modules[name] = sha256(await readFile(new URL(`./${name}.mts`, import.meta.url)));
  const withSources = Object.assign(withProcessor, { buildSources: await inspectBuild(withProcessor, options.build ?? capture.servedDirectory, capture.expectedSources) });
  for (const source of withSources.buildSources.filter(s => s.verification?.startsWith('MISMATCH')))
    withSources.evidenceGaps.push(`Source bytes mismatch capture: ${source.url}. Source-map attribution withheld.`);
  if (!withSources.buildSources.some(s => s.sourceMap?.status?.startsWith('provided-build-map'))) withSources.evidenceGaps.push('No original-source maps supplied. Generated bundle locations/excerpts are available with --build; original filenames cannot be reconstructed reliably.');
  const output = resolve(options.out ?? resolve(root, 'output/performance/trace-briefs', basename(input).replace(/\.json(?:\.gz)?$/, '') + '-' + sourceHash.slice(0, 8)));
  if (relative(output, input) === '' || (!relative(output, input).startsWith('..') && !isAbsolute(relative(output, input))))
    throw Error('Use an output directory that does not contain the input trace.');
  if (baselines.some(b => resolve(dirname(b.file)) === output)) throw Error('Output would overwrite a comparison report. Choose another --out directory.');
  const withSeries = Object.assign(withSources, { averageSeries: averageFrames(analysis.timeline.frames, { durationMs: analysis.window.durationMs,
    label: options.label ?? (capture.summary.available ? basename(capture.summary.directory) : basename(input)),
    sha256: sourceHash, source: analysis.timeline.source,
    excludedGaps: chartIdleGaps(events, analysis.timeline.frames, withSources) }) });
  const brief: TraceBrief = Object.assign(withSeries, { comparisons: baselines.map(b => ({ ...compareCaptures(b.brief, withSeries), reportFile: b.file, reportSha256: b.sha256 })) });
  const series = [...new Map([...baselines.map(b => b.series), brief.averageSeries].map(s => [s.sha256 ?? s.label, s])).values()];
  const chart = renderAverageChart(series);
  const diagnosis = buildDiagnosis(brief);
  await mkdir(output, { recursive: true });
  if (analysis.timeline.frames.length) {
    const frameChart: unknown = renderFrameChartSvg(analysisValue);
    if (typeof frameChart !== 'string') throw Error('FrameSleuth frame chart must be SVG text.');
    await writeFile(resolve(output, 'frame-times.svg'), frameChart);
  }
  await writeFile(resolve(output, 'performance.svg'), chart);
  await sharp(Buffer.from(chart), { density: 144 }).png().toFile(resolve(output, 'performance.png'));
  await writeFile(resolve(output, 'performance-chart.json'), JSON.stringify({ schema: 'cssearth-performance-chart@1', series }, null, 2));
  const md = `Status: ${diagnosis.status}\n\n![500 ms average comparison](performance.svg)\n\nStart with diagnosis.json. Individual hitches remain in frame-times.svg.\n\n` + markdown(brief);
  brief.processingSeconds = ms((performance.now() - started) / 1000);
  await writeFile(resolve(output, 'agent-brief.json'), JSON.stringify(brief, null, 2));
  await writeFile(resolve(output, 'README.md'), md);
  await writeFile(resolve(output, 'analysis.json'), JSON.stringify(analysisValue));
  await writeFile(resolve(output, 'diagnosis.json'), JSON.stringify(diagnosis, null, 2));
  await writeFile(resolve(output, 'report.html'), renderReport(brief, diagnosis, chart, output));
  console.log(`Ready in ${brief.processingSeconds}s: ${output}\n${diagnosis.status}. ${brief.clues[0]?.fact ?? 'No main tasks captured.'}\nRead diagnosis.json first. Chart: performance.svg. The raw trace remains unchanged.`);
  return { output, brief };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main(process.argv.slice(2)).catch((error: unknown) => { console.error(errorMessage(error)); process.exitCode = 1; });
