#!/usr/bin/env node
import { gzipSync } from "node:zlib";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium, type CDPSession } from "playwright";

import { parseChromeTrace } from '../../comets/chrome-trace-values.mts';
import { analyzeTrace, metricDelta } from './trace-analysis.mts';
declare global { interface Window { __saturnLongTasks:{startTime:number;duration:number;name:string}[];__saturnTraceNodes:readonly Element[] } }
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
  const errors: string[] = [];
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
      .evaluate((element) => {
if (!(element instanceof HTMLElement)) throw new Error("Expected HTMLElement observation");
return element.click(); });
    await page.waitForFunction(() =>
      {
      function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
return requiredDiagnostics(window.__saturn).features.state().minorMoons === true; });
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
    function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }

    function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }

    performance.mark("saturn-trace-start");
    window.__saturnTraceNodes = [...requiredDiagnostics(window.__saturn).stableNodes];
    return snapshot();

    function snapshot() {
      const scene = requiredElement(document.querySelector(".polycss-scene"));
      const camera = requiredElement(document.querySelector(".polycss-camera"));
      return {
        domNodes: document.getElementsByTagName("*").length,
        stableNodes: requiredDiagnostics(window.__saturn).stableNodes.length,
        retainedLeaves: requiredDiagnostics(window.__saturn).dom.retainedLeafCount,
        retainedNodes: requiredDiagnostics(window.__saturn).dom.retainedInitialNodeCount,
        animationCount: document.getAnimations().length,
        cameraContain: getComputedStyle(camera).contain,
        cameraOverflow: getComputedStyle(camera).overflow,
        cameraPointerEvents: getComputedStyle(camera).pointerEvents,
        scenePointerEvents: getComputedStyle(scene).pointerEvents,
        cameraState: requiredDiagnostics(window.__saturn).camera.state(),
        runtimeStats: requiredDiagnostics(window.__saturn).runtime.playback(),
        textureCaches: requiredDiagnostics(window.__saturn).runtime.resources().pools,
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
    function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }

    performance.mark("saturn-trace-end");
    const current = [...requiredDiagnostics(window.__saturn).stableNodes];
    return {
      domNodes: document.getElementsByTagName("*").length,
      stableNodes: current.length,
      retainedLeaves: requiredDiagnostics(window.__saturn).dom.retainedLeafCount,
      retainedNodes: requiredDiagnostics(window.__saturn).dom.retainedInitialNodeCount,
      animationCount: document.getAnimations().length,
      stableNodeReferences:
        current.length === window.__saturnTraceNodes.length &&
        current.every((node, index) => node === window.__saturnTraceNodes[index]),
      stableDomIdentity: requiredDiagnostics(window.__saturn).assertStableDomIdentity(),
      cameraState: requiredDiagnostics(window.__saturn).camera.state(),
      runtimeStats: requiredDiagnostics(window.__saturn).runtime.playback(),
      textureCaches: requiredDiagnostics(window.__saturn).runtime.resources().pools,
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

async function stopAndReadTrace(session: CDPSession) {
  const complete = new Promise<string>((resolve,reject) =>
    session.once("Tracing.tracingComplete", event=>{if(event.stream)resolve(event.stream);else reject(new Error("Chrome trace stream is missing"));}));
  await session.send("Tracing.end");
  const stream = await complete;
  let json = "";
  for (;;) {
    const chunk = await session.send("IO.read", { handle: stream });
    json += chunk.base64Encoded
      ? Buffer.from(chunk.data, "base64").toString("utf8")
      : chunk.data;
    if (chunk.eof) break;
  }
  await session.send("IO.close", { handle: stream });
  return parseChromeTrace(JSON.parse(json));
}


function parsePositiveInteger(value: string, label: string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new TypeError(`${label} must be a positive integer.`);
  }
  return parsed;
}


function parsePositiveNumber(value: string, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new TypeError(`${label} must be a positive number.`);
  }
  return parsed;
}
