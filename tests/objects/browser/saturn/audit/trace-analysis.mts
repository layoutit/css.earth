import { required } from '../../../../../tools/test-values.mts';
import { hasDuration, hasFrameReporter, type ChromeTraceEvent, type ChromeDurationEvent, type ChromePipelineEvent, type ChromeFrameReporter } from '../../comets/chrome-trace-values.mts';

export function metricDelta(before: readonly {name:string;value:number}[], after: readonly {name:string;value:number}[]) {
  const beforeByName = new Map(before.map(({ name, value }) => [name, value]));
  const names = [
    "TaskDuration",
    "ScriptDuration",
    "LayoutDuration",
    "RecalcStyleDuration",
    "JSHeapUsedSize",
    "Nodes",
    "LayoutCount",
    "RecalcStyleCount",
  ];
  return Object.fromEntries(names.map((name) => {
    const value = after.find((metric) => metric.name === name)?.value ?? 0;
    const initial = beforeByName.get(name) ?? 0;
    return [name, Number((value - initial).toFixed(6))];
  }));
}

export function analyzeTrace(events: readonly ChromeTraceEvent[]) {
  const threadNames = new Map<string,string>();
  for (const event of events) {
    if (event.ph === "M" && event.name === "thread_name") {
      threadNames.set(
        `${event.pid}:${event.tid}`,
        event.args?.name ?? event.args?.data?.name ?? "",
      );
    }
  }
  const candidates = [...threadNames]
    .filter(([, name]) => name === "CrRendererMain")
    .map(([key]) => key.split(":").map(Number));
  let selected: {pid:number;tid:number} | null = null;
  let selectedScore = -1;
  for (const [pid, tid] of candidates) {
    const score = events.filter((event) =>
      event.pid === pid && event.tid === tid && event.ph === "X" &&
      /^(?:RunTask|Paint|FunctionCall)$/u.test(event.name??"")).length;
    if (score > selectedScore) {
      selected = { pid, tid };
      selectedScore = score;
    }
  }
  if (!selected) throw new Error("Trace has no renderer main thread");
  const selectedThread=selected;
  const main = events.filter(hasDuration).filter((event) =>
    event.pid === selectedThread.pid && event.tid === selectedThread.tid &&
    event.ph === "X" && Number.isFinite(event.dur));
  const renderer = events.filter(hasDuration).filter((event) =>
    event.pid === selectedThread.pid && event.ph === "X" && Number.isFinite(event.dur));
  const rendererProcessEvents = events.filter((event) =>
    event.pid === selectedThread.pid);
  const measured = events.filter(hasDuration).filter((event) =>
    event.ph === "X" && Number.isFinite(event.dur));
  const tasks = main.filter((event) =>
    event.name === "RunTask" || event.name?.endsWith("::RunTask"));
  const pipelineBegins = events.filter(hasFrameReporter).filter((event) =>
    event.pid === selectedThread.pid &&
    event.name === "PipelineReporter" && event.ph === "b" &&
    event.args?.frame_reporter);
  const markTimes = new Map(events
    .filter((event) => event.ph === "I" &&
      String(event.name).startsWith("saturn-trace-"))
    .map((event) => [event.name, event.ts]));
  const idleStart = markTimes.get("saturn-trace-start");
  const interactionStart = markTimes.get("saturn-trace-interaction-start");
  const interactionEnd = markTimes.get("saturn-trace-interaction-end");
  const traceEnd = markTimes.get("saturn-trace-end");
  return {
    rendererMainThread: selected,
    pipeline: summarizePipeline(pipelineBegins),
    preparedRowRequests: summarizePreparedRowRequests(rendererProcessEvents),
    longMainThreadTasks: tasks.filter(({ dur }) => dur >= 50_000).map(({ ts, dur }) => ({
      startTraceMicroseconds: ts,
      durationMilliseconds: Number((dur / 1_000).toFixed(3)),
    })),
    timeline: {
      updateLayoutTree: summarize(main, /^(?:UpdateLayoutTree|RecalculateStyles)$/u),
      layout: summarize(main, /^(?:Layout|UpdateLayoutTree)$/u),
      prePaint: summarize(main, /^PrePaint$/u),
      paint: summarize(main, /^(?:Paint|PaintImage)$/u),
      hitTest: summarize(renderer, /^HitTest$/u),
      layerize: summarize(main, /^(?:Layerize|UpdateLayerTree)$/u),
      commit: summarize(renderer, /^(?:Commit|CommitLoad|CompositeLayers|UpdateLayerTree)$/u),
      eventDispatch: summarize(main, /^EventDispatch$/u),
      functionCall: summarize(main, /^FunctionCall$/u),
      microtaskCheckpoint: summarize(
        main,
        /^BlinkScheduler_PerformMicrotaskCheckpoint$/u,
      ),
      gc: summarize(main, /^(?:MinorGC|MajorGC)$/u),
      imageDecode: summarize(
        measured,
        /^(?:ImageDecodeTask|Decode Image|Decode LazyPixelRef)$/u,
      ),
    },
    windows: {
      idle: analyzeWindow(
        main,
        renderer,
        rendererProcessEvents,
        pipelineBegins,
        idleStart,
        interactionStart,
      ),
      interaction: analyzeWindow(
        main,
        renderer,
        rendererProcessEvents,
        pipelineBegins,
        interactionStart,
        interactionEnd,
      ),
      settle: analyzeWindow(
        main,
        renderer,
        rendererProcessEvents,
        pipelineBegins,
        interactionEnd,
        traceEnd,
      ),
    },
  };
}



function analyzeWindow(main: readonly ChromeDurationEvent[], renderer: readonly ChromeDurationEvent[], processEvents: readonly ChromeTraceEvent[], pipeline: readonly ChromePipelineEvent[], start: number | undefined, end: number | undefined) {
  if (start===undefined || end===undefined || !Number.isFinite(start) || !Number.isFinite(end)) return null;
  const mainEvents = main.filter((event) => event.ts >= start && event.ts < end);
  const rendererEvents = renderer.filter((event) =>
    event.ts >= start && event.ts < end);
  return {
    durationMilliseconds: Number(((end - start) / 1_000).toFixed(3)),
    pipeline: summarizePipeline(pipeline.filter((event) =>
      event.ts >= start && event.ts < end)),
    updateLayoutTree: summarize(
      mainEvents,
      /^(?:UpdateLayoutTree|RecalculateStyles)$/u,
    ),
    prePaint: summarize(mainEvents, /^PrePaint$/u),
    paint: summarize(mainEvents, /^(?:Paint|PaintImage)$/u),
    hitTest: summarize(rendererEvents, /^HitTest$/u),
    layerize: summarize(mainEvents, /^(?:Layerize|UpdateLayerTree)$/u),
    eventDispatch: summarize(mainEvents, /^EventDispatch$/u),
    functionCall: summarize(mainEvents, /^FunctionCall$/u),
    microtaskCheckpoint: summarize(
      mainEvents,
      /^BlinkScheduler_PerformMicrotaskCheckpoint$/u,
    ),
    preparedRowRequests: summarizePreparedRowRequests(
      processEvents,
      start,
      end,
    ),
  };
}

function summarizePipeline(events: readonly ChromePipelineEvent[]) {
  const states: Record<string,number> = {};
  const sequences = new Map<string,ChromeFrameReporter[]>();
  for (const event of events) {
    const reporter = event.args.frame_reporter;
    const state = reporter.state ?? "UNKNOWN";
    states[state] = (states[state] ?? 0) + 1;
    const key = `${reporter.frame_source}:${reporter.frame_sequence}`;
    const sequence = sequences.get(key) ?? [];
    sequence.push(reporter);
    sequences.set(key, sequence);
  }
  const sequenceValues = [...sequences.values()];
  const hasState = (sequence: readonly ChromeFrameReporter[], state: string) =>
    sequence.some((reporter) => reporter.state === state);
  const presented = (sequence: readonly ChromeFrameReporter[]) =>
    hasState(sequence, "STATE_PRESENTED_ALL") ||
    hasState(sequence, "STATE_PRESENTED_PARTIAL");
  return {
    states,
    reporterCount: events.length,
    uniqueFrameSequences: sequences.size,
    forkedReporters: events.filter((event) =>
      event.args.frame_reporter.frame_type === "FORKED").length,
    partialReporters: events.filter((event) =>
      event.args.frame_reporter.state === "STATE_PRESENTED_PARTIAL").length,
    partialFrameSequences: sequenceValues.filter((sequence) =>
      hasState(sequence, "STATE_PRESENTED_PARTIAL")).length,
    partialPairedWithPresentedAll: sequenceValues.filter((sequence) =>
      hasState(sequence, "STATE_PRESENTED_PARTIAL") &&
      hasState(sequence, "STATE_PRESENTED_ALL")).length,
    smoothnessAffectingPartialSequences: sequenceValues.filter((sequence) =>
      sequence.some((reporter) =>
        reporter.state === "STATE_PRESENTED_PARTIAL" &&
        reporter.affects_smoothness)).length,
    droppedFrameSequences: sequenceValues.filter((sequence) =>
      hasState(sequence, "STATE_DROPPED")).length,
    droppedWithoutPresentation: sequenceValues.filter((sequence) =>
      hasState(sequence, "STATE_DROPPED") && !presented(sequence)).length,
    affectsSmoothness: events.filter((event) =>
      event.args.frame_reporter.affects_smoothness).length,
    compositorAnimation: events.filter((event) =>
      event.args.frame_reporter.has_compositor_animation).length,
    mainAnimation: events.filter((event) =>
      event.args.frame_reporter.has_main_animation).length,
    checkerboarded: events.filter((event) =>
      event.args.frame_reporter.checkerboarded_needs_raster ||
      event.args.frame_reporter.checkerboarded_needs_record).length,
    missingContent: events.filter((event) =>
      event.args.frame_reporter.has_missing_content).length,
  };
}

function summarizePreparedRowRequests(events: readonly ChromeTraceEvent[], start = -Infinity, end = Infinity) {
  const rowPattern = /saturn-(?:orbit-material|moon-shadows|interior-[^/]+)-row-\d{2}(?:@2x)?\.webp$/u;
  const requests = events.filter((event) =>
    event.name === "ResourceSendRequest" &&
    event.ts >= start && event.ts < end &&
    rowPattern.test(event.args?.data?.url ?? ""));
  const urls = requests.map((event) => required(event.args?.data?.url));
  const uniqueUrls = new Set(urls);
  const requestIds = new Set(requests.map((event) =>
    required(event.args?.data?.requestId)));
  const finishedBytes = events.filter((event) =>
    event.name === "ResourceFinish" && event.args?.data?.requestId !== undefined && requestIds.has(event.args.data.requestId))
    .reduce((total, event) =>
      total + Math.max(0, event.args?.data?.encodedDataLength ?? 0), 0);
  return {
    requestCount: requests.length,
    uniqueUrlCount: uniqueUrls.size,
    repeatRequestCount: requests.length - uniqueUrls.size,
    encodedBytes: finishedBytes,
  };
}

function summarize(events: readonly ChromeDurationEvent[], pattern: RegExp) {
  const durations = events
    .filter(({ name }) => pattern.test(name??""))
    .map(({ dur }) => dur / 1_000)
    .sort((a, b) => a - b);
  const total = durations.reduce((sum, value) => sum + value, 0);
  return {
    count: durations.length,
    totalMilliseconds: Number(total.toFixed(3)),
    p95Milliseconds: percentile(durations, 0.95),
    maximumMilliseconds: durations.length
      ? Number(required(durations.at(-1)).toFixed(3))
      : 0,
  };
}

function percentile(values: readonly number[], fraction: number) {
  if (values.length === 0) return 0;
  return Number(values[Math.min(
    values.length - 1,
    Math.floor(values.length * fraction),
  )].toFixed(3));
}
