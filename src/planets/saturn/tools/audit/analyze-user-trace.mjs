import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";

const tracePath = resolve(process.argv[2]);
const outputPath = resolve(process.argv[3]);
const compressed = await readFile(tracePath);
const trace = JSON.parse(gunzipSync(compressed));
const events = trace.traceEvents ?? [];

const saturnCommit = events.find((event) =>
  event.name === "FrameCommittedInBrowser" &&
  event.args?.data?.url?.includes("/saturn/"));
const rendererPid = saturnCommit?.args?.data?.processId;
if (!rendererPid) throw new Error("Saturn renderer process was not found.");

const mainThread = events.find((event) =>
  event.ph === "M" && event.pid === rendererPid &&
  event.name === "thread_name" &&
  (event.args?.name ?? event.args?.data?.name) === "CrRendererMain");
if (!mainThread) throw new Error("Saturn renderer main thread was not found.");

const main = events.filter((event) =>
  event.pid === rendererPid && event.tid === mainThread.tid &&
  event.ph === "X" && Number.isFinite(event.ts) && Number.isFinite(event.dur));
const navigationStart = events.find((event) =>
  event.pid === rendererPid && event.name === "navigationStart" &&
  event.args?.data?.documentLoaderURL?.includes("/saturn/"))?.ts;
const inputs = events.filter((event) => event.ph === "b" &&
  event.name.startsWith("InputLatency::") && Number.isFinite(event.ts));
const actionInputs = inputs.filter((event) =>
  /InputLatency::(?:MouseDown|MouseWheel|TouchStart|GestureScrollBegin|GestureScrollUpdate)/u
    .test(event.name));
const firstInput = actionInputs.length
  ? Math.min(...actionInputs.map(({ ts }) => ts))
  : null;
const lastInput = actionInputs.length
  ? Math.max(...actionInputs.map(({ ts }) => ts))
  : null;
const traceStart = Math.min(...main.map(({ ts }) => ts));
const traceEnd = Math.max(...main.map(({ ts, dur }) => ts + dur));

const windows = {
  all: summarizeWindow(traceStart, traceEnd),
  startup: Number.isFinite(navigationStart) && Number.isFinite(firstInput)
    ? summarizeWindow(navigationStart, firstInput)
    : null,
  interaction: Number.isFinite(firstInput) && Number.isFinite(lastInput)
    ? summarizeWindow(firstInput, lastInput + 1)
    : null,
  settle: Number.isFinite(lastInput) && lastInput < traceEnd
    ? summarizeWindow(lastInput + 1, traceEnd)
    : null,
};

const domStats = events.filter((event) => event.name === "DOMStats")
  .map((event) => event.args?.data ?? event.args)
  .filter(Boolean);
const report = {
  schema: "cssearth-saturn-real-device-trace@1",
  sourcePath: tracePath,
  sha256: createHash("sha256").update(compressed).digest("hex"),
  compressedBytes: compressed.byteLength,
  metadata: trace.metadata ?? null,
  saturn: {
    url: saturnCommit.args.data.url,
    rendererPid,
    rendererMainTid: mainThread.tid,
  },
  inputEventCount: inputs.length,
  actionInputEventCount: actionInputs.length,
  windows,
  domStats: {
    sampleCount: domStats.length,
    maximumElementCount: maximum(domStats, "totalElements"),
  },
};
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

function summarizeWindow(start, end) {
  const selectedMain = main.filter(({ ts }) => ts >= start && ts < end);
  const tasks = selectedMain.filter(({ name }) =>
    name === "RunTask" || name.endsWith("::RunTask"));
  const pipeline = events.filter((event) =>
    event.pid === rendererPid && event.name === "PipelineReporter" &&
    event.ph === "b" && event.ts >= start && event.ts < end &&
    event.args?.frame_reporter);
  return {
    durationMilliseconds: Number(((end - start) / 1_000).toFixed(3)),
    tasks: durations(tasks),
    longTasks: tasks.filter(({ dur }) => dur >= 50_000)
      .map(({ ts, dur }) => ({
        offsetMilliseconds: Number(((ts - start) / 1_000).toFixed(3)),
        durationMilliseconds: Number((dur / 1_000).toFixed(3)),
      })),
    timeline: {
      updateLayoutTree: named(selectedMain, /^(?:UpdateLayoutTree|RecalculateStyles)$/u),
      layout: named(selectedMain, /^Layout$/u),
      prePaint: named(selectedMain, /^PrePaint$/u),
      paint: named(selectedMain, /^(?:Paint|PaintImage)$/u),
      layerize: named(selectedMain, /^(?:Layerize|UpdateLayerTree)$/u),
      functionCall: named(selectedMain, /^FunctionCall$/u),
      eventDispatch: named(selectedMain, /^EventDispatch$/u),
    },
    pipeline: summarizePipeline(pipeline),
  };
}

function named(eventsToMeasure, pattern) {
  return durations(eventsToMeasure.filter(({ name }) => pattern.test(name)));
}

function durations(eventsToMeasure) {
  const values = eventsToMeasure.map(({ dur }) => dur / 1_000)
    .filter(Number.isFinite).sort((left, right) => left - right);
  return {
    count: values.length,
    totalMilliseconds: round(values.reduce((sum, value) => sum + value, 0)),
    p95Milliseconds: percentile(values, 0.95),
    maximumMilliseconds: values.length ? round(values.at(-1)) : 0,
  };
}

function summarizePipeline(pipeline) {
  const states = Object.create(null);
  const sequences = new Map();
  for (const event of pipeline) {
    const reporter = event.args.frame_reporter;
    states[reporter.state ?? "UNKNOWN"] =
      (states[reporter.state ?? "UNKNOWN"] ?? 0) + 1;
    const key = `${reporter.frame_source}:${reporter.frame_sequence}`;
    const sequence = sequences.get(key) ?? [];
    sequence.push(reporter);
    sequences.set(key, sequence);
  }
  const values = [...sequences.values()];
  const has = (sequence, state) =>
    sequence.some((reporter) => reporter.state === state);
  return {
    states,
    reporterCount: pipeline.length,
    uniqueFrameSequences: sequences.size,
    partialFrameSequences: values.filter((sequence) =>
      has(sequence, "STATE_PRESENTED_PARTIAL")).length,
    partialPairedWithPresentedAll: values.filter((sequence) =>
      has(sequence, "STATE_PRESENTED_PARTIAL") &&
      has(sequence, "STATE_PRESENTED_ALL")).length,
    droppedFrameSequences: values.filter((sequence) =>
      has(sequence, "STATE_DROPPED")).length,
    affectsSmoothness: pipeline.filter((event) =>
      event.args.frame_reporter.affects_smoothness).length,
    checkerboarded: pipeline.filter((event) =>
      event.args.frame_reporter.checkerboarded_needs_raster ||
      event.args.frame_reporter.checkerboarded_needs_record).length,
    missingContent: pipeline.filter((event) =>
      event.args.frame_reporter.has_missing_content).length,
  };
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  return round(values[Math.min(values.length - 1,
    Math.floor(values.length * fraction))]);
}

function maximum(values, key) {
  return values.reduce((result, value) =>
    Math.max(result, Number(value[key]) || 0), 0);
}

function round(value) {
  return Number(value.toFixed(3));
}
