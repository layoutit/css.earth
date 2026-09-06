#!/usr/bin/env node
import { gzipSync } from "node:zlib";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const outputDirectory = path.resolve(
  process.argv[2] ?? "output/playwright/saturn-performance",
);
const baseUrl = process.argv[3] ?? "http://127.0.0.1:4210/saturn/";
const deviceScaleFactor = parsePositiveNumber(process.argv[4] ?? "1", "DPR");
const viewport = Object.freeze({
  width: parsePositiveInteger(process.argv[5] ?? "1499", "viewport width"),
  height: parsePositiveInteger(process.argv[6] ?? "1236", "viewport height"),
});
const dragCycles = parsePositiveInteger(process.argv[7] ?? "1", "drag cycles");
const featureMode = process.argv[8] ?? "default";
if (!["default", "minor-on"].includes(featureMode)) {
  throw new TypeError("Feature mode must be default or minor-on.");
}
const traceCategories = [
  "-*",
  "benchmark",
  "cc",
  "devtools.timeline",
  "blink.user_timing",
  "toplevel",
  "disabled-by-default-devtools.timeline.frame",
  "disabled-by-default-v8.gc",
].join(",");

await fs.mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });

try {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.__saturnLongTasks = [];
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__saturnLongTasks.push({
            startTime: entry.startTime,
            duration: entry.duration,
            name: entry.name,
          });
        }
      });
      observer.observe({ type: "longtask", buffered: true });
    } catch {}
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(() =>
    window.__saturn?.ready === true &&
    document.documentElement.dataset.ready === "true");
  if (featureMode === "minor-on") {
    await page.locator('.planet-settings input[name="moons"]')
      .evaluate((element) => element.click());
    await page.waitForFunction(() =>
      window.__saturn.features.state().minorMoons === true);
  }
  await page.waitForTimeout(1_000);

  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  await cdp.send("Tracing.start", {
    categories: traceCategories,
    options: "record-as-much-as-possible",
    transferMode: "ReturnAsStream",
  });
  const initialMetrics = await cdp.send("Performance.getMetrics");
  const initial = await page.evaluate(() => {
    performance.mark("saturn-trace-start");
    window.__saturnTraceNodes = [...window.__saturn.stableNodes];
    return snapshot();

    function snapshot() {
      const scene = document.querySelector(".polycss-scene");
      const camera = document.querySelector(".polycss-camera");
      return {
        domNodes: document.getElementsByTagName("*").length,
        stableNodes: window.__saturn.stableNodes.length,
        retainedLeaves: window.__saturn.dom.retainedLeafCount,
        retainedGroups: window.__saturn.dom.retainedTransformGroupCount,
        animationCount: document.getAnimations().length,
        cameraContain: getComputedStyle(camera).contain,
        cameraOverflow: getComputedStyle(camera).overflow,
        cameraPointerEvents: getComputedStyle(camera).pointerEvents,
        scenePointerEvents: getComputedStyle(scene).pointerEvents,
        cameraState: window.__saturn.camera.state(),
        runtimeStats: window.__saturn.animation.stats(),
        textureCaches: {
          orbit: window.__saturn.renderStats.textureStats.orbitMaterialCache,
          shadows: window.__saturn.renderStats.textureStats.moonShadowCache,
          interior:
            window.__saturn.renderStats.textureStats.interiorAtmosphereCache,
        },
      };
    }
  });

  await page.waitForTimeout(10_000);
  await page.evaluate(() => performance.mark("saturn-trace-interaction-start"));
  const dragX = viewport.width * 0.6;
  const dragStartY = viewport.height * 0.485;
  const dragUpperY = viewport.height * 0.283;
  const dragLowerY = viewport.height * 0.582;
  for (let cycle = 0; cycle < dragCycles; cycle += 1) {
    await page.mouse.move(dragX, dragStartY);
    await page.mouse.down();
    await page.mouse.move(dragX, dragUpperY, { steps: 60 });
    await page.mouse.move(dragX, dragLowerY, { steps: 60 });
    await page.mouse.up();
  }
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(250);
  await page.mouse.wheel(0, 120);
  await page.evaluate(() => performance.mark("saturn-trace-interaction-end"));
  await page.waitForTimeout(5_000);

  const final = await page.evaluate(() => {
    performance.mark("saturn-trace-end");
    const current = [...window.__saturn.stableNodes];
    return {
      domNodes: document.getElementsByTagName("*").length,
      stableNodes: current.length,
      retainedLeaves: window.__saturn.dom.retainedLeafCount,
      retainedGroups: window.__saturn.dom.retainedTransformGroupCount,
      animationCount: document.getAnimations().length,
      stableNodeReferences:
        current.length === window.__saturnTraceNodes.length &&
        current.every((node, index) => node === window.__saturnTraceNodes[index]),
      stableDomIdentity: window.__saturn.assertStableDomIdentity(),
      cameraState: window.__saturn.camera.state(),
      runtimeStats: window.__saturn.animation.stats(),
      textureCaches: {
        orbit: window.__saturn.renderStats.textureStats.orbitMaterialCache,
        shadows: window.__saturn.renderStats.textureStats.moonShadowCache,
        interior:
          window.__saturn.renderStats.textureStats.interiorAtmosphereCache,
      },
      longTasks: window.__saturnLongTasks,
      marks: performance.getEntriesByType("mark")
        .filter(({ name }) => name.startsWith("saturn-trace-"))
        .map(({ name, startTime }) => ({ name, startTime })),
    };
  });
  const finalMetrics = await cdp.send("Performance.getMetrics");
  const trace = await stopAndReadTrace(cdp);
  const report = {
    browser: "Google Chrome",
    headless: true,
    route: baseUrl,
    viewport: [viewport.width, viewport.height],
    deviceScaleFactor,
    dragCycles,
    featureMode,
    errors,
    initial,
    final,
    metricDelta: metricDelta(initialMetrics.metrics, finalMetrics.metrics),
    analysis: analyzeTrace(trace.traceEvents ?? []),
  };
  await Promise.all([
    fs.writeFile(
      path.join(outputDirectory, "report.json"),
      `${JSON.stringify(report, null, 2)}\n`,
    ),
    fs.writeFile(
      path.join(outputDirectory, "chrome-trace.json.gz"),
      gzipSync(JSON.stringify(trace), { level: 9 }),
    ),
  ]);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}

async function stopAndReadTrace(session) {
  const complete = new Promise((resolve) =>
    session.once("Tracing.tracingComplete", resolve));
  await session.send("Tracing.end");
  const { stream } = await complete;
  let json = "";
  for (;;) {
    const chunk = await session.send("IO.read", { handle: stream });
    json += chunk.base64Encoded
      ? Buffer.from(chunk.data, "base64").toString("utf8")
      : chunk.data;
    if (chunk.eof) break;
  }
  await session.send("IO.close", { handle: stream });
  return JSON.parse(json);
}

function metricDelta(before, after) {
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

function analyzeTrace(events) {
  const threadNames = new Map();
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
  let selected = null;
  let selectedScore = -1;
  for (const [pid, tid] of candidates) {
    const score = events.filter((event) =>
      event.pid === pid && event.tid === tid && event.ph === "X" &&
      /^(?:RunTask|Paint|FunctionCall)$/u.test(event.name)).length;
    if (score > selectedScore) {
      selected = { pid, tid };
      selectedScore = score;
    }
  }
  if (!selected) throw new Error("Trace has no renderer main thread");
  const main = events.filter((event) =>
    event.pid === selected.pid && event.tid === selected.tid &&
    event.ph === "X" && Number.isFinite(event.dur));
  const renderer = events.filter((event) =>
    event.pid === selected.pid && event.ph === "X" && Number.isFinite(event.dur));
  const rendererProcessEvents = events.filter((event) =>
    event.pid === selected.pid);
  const measured = events.filter((event) =>
    event.ph === "X" && Number.isFinite(event.dur));
  const tasks = main.filter((event) =>
    event.name === "RunTask" || event.name.endsWith("::RunTask"));
  const pipelineBegins = events.filter((event) =>
    event.pid === selected.pid &&
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

function parsePositiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new TypeError(`${label} must be a positive integer.`);
  }
  return parsed;
}

function parsePositiveNumber(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new TypeError(`${label} must be a positive number.`);
  }
  return parsed;
}

function analyzeWindow(main, renderer, processEvents, pipeline, start, end) {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
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

function summarizePipeline(events) {
  const states = Object.create(null);
  const sequences = new Map();
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
  const hasState = (sequence, state) =>
    sequence.some((reporter) => reporter.state === state);
  const presented = (sequence) =>
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

function summarizePreparedRowRequests(events, start = -Infinity, end = Infinity) {
  const rowPattern = /saturn-(?:orbit-material|moon-shadows|interior-[^/]+)-row-\d{2}(?:@2x)?\.webp$/u;
  const requests = events.filter((event) =>
    event.name === "ResourceSendRequest" &&
    event.ts >= start && event.ts < end &&
    rowPattern.test(event.args?.data?.url ?? ""));
  const urls = requests.map((event) => event.args.data.url);
  const uniqueUrls = new Set(urls);
  const requestIds = new Set(requests.map((event) =>
    event.args.data.requestId));
  const finishedBytes = events.filter((event) =>
    event.name === "ResourceFinish" && requestIds.has(event.args?.data?.requestId))
    .reduce((total, event) =>
      total + Math.max(0, event.args?.data?.encodedDataLength ?? 0), 0);
  return {
    requestCount: requests.length,
    uniqueUrlCount: uniqueUrls.size,
    repeatRequestCount: requests.length - uniqueUrls.size,
    encodedBytes: finishedBytes,
  };
}

function summarize(events, pattern) {
  const durations = events
    .filter(({ name }) => pattern.test(name))
    .map(({ dur }) => dur / 1_000)
    .sort((a, b) => a - b);
  const total = durations.reduce((sum, value) => sum + value, 0);
  return {
    count: durations.length,
    totalMilliseconds: Number(total.toFixed(3)),
    p95Milliseconds: percentile(durations, 0.95),
    maximumMilliseconds: durations.length
      ? Number(durations.at(-1).toFixed(3))
      : 0,
  };
}

function percentile(values, fraction) {
  if (values.length === 0) return 0;
  return Number(values[Math.min(
    values.length - 1,
    Math.floor(values.length * fraction),
  )].toFixed(3));
}
