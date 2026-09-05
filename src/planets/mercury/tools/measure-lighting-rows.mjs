#!/usr/bin/env node
// Measures how many prepared Mercury lighting-row images the runtime fetches
// (and how many bytes) while the camera dollies from close-up to
// whole-orbit scale, with and without rotation. Pure tooling: it is meant to
// be run twice (before/after a level-of-detail change) so its JSON output
// must be stable and directly comparable across runs.
//
// The lighting overlay frame index is derived from the Sun's view-direction
// z (see publishMaterialDirection in ../runtime/client.mjs): frameCount is
// 256, in 32 rows of 8 frames each (../runtime/preparedRowCache.mjs), and a
// 3-row neighbourhood is warmed around the desired row. A pure dolly (no
// rotation) does not move the Sun's view direction, so it must not fetch
// rows; rotating the camera does.
//
// Assumes the target server is already running; unlike screenshot-ladder.mjs
// this script never spawns a dev server itself.
//
// See src/planets/mercury/tools/screenshot-ladder.mjs for the argument
// parsing style and readiness convention, and
// src/planets/mercury/test/smoke-browser.mjs for the shadows-toggle and
// camera-interface conventions this script follows.

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const DEFAULT_BASE_URL = "http://127.0.0.1:4210";
const DEFAULT_OUT_DIR =
  "/private/tmp/claude-501/-Users-apresmoi-Documents-cssEarth/" +
  "77ccf69f-07a2-4417-9a0f-3e55cc967ee8/scratchpad/mercury-rows";
const LIGHTING_ROW_PATTERN = /\/scenes\/mercury\/mercury-lighting-/u;
const MERCURY_SCENE_PATTERN = /\/scenes\/mercury\//u;
const SWEEP_STEP_DEGREES = 15;
const PROBE_TIMEOUT_MS = 2000;
const READY_TIMEOUT_MS = 60_000;
const FINAL_DRAIN_MS = 1500;
const NETWORKIDLE_SETTLE_MS = 500;

const options = parseArguments(process.argv.slice(2));
const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
const outPath = resolve(options.out ?? defaultOutPath());
const viewport = parseViewport(options.viewport);
const deviceScaleFactor = options.dpr === undefined ? 2 : Number(options.dpr);
const steps = options.steps === undefined ? 48 : Number(options.steps);
const settleMs = options.settleMs === undefined ? 80 : Number(options.settleMs);

if (!Number.isInteger(steps) || steps < 2) {
  throw new TypeError(`--steps must be an integer >= 2, got "${options.steps}"`);
}
if (!Number.isFinite(deviceScaleFactor) || deviceScaleFactor <= 0) {
  throw new TypeError(`--dpr must be a positive number, got "${options.dpr}"`);
}
if (!Number.isFinite(settleMs) || settleMs < 0) {
  throw new TypeError(`--settle-ms must be a non-negative number, got "${options.settleMs}"`);
}

await mkdir(resolve(outPath, ".."), { recursive: true });

if (!(await isReachable(baseUrl))) {
  console.error(
    `Base URL ${baseUrl} is not reachable. This script does not start a ` +
    `dev server itself; start one first (see screenshot-ladder.mjs if you ` +
    `need that behaviour) and pass --base-url.`,
  );
  process.exitCode = 1;
  process.exit(1);
}

const manifest = {
  baseUrl,
  dpr: deviceScaleFactor,
  viewport,
  steps,
  startedAt: new Date().toISOString(),
  scenarios: {},
};

let browser = null;
let exitCode = 0;

const onSignal = () => {
  cleanup().finally(() => process.exit(1));
};
process.once("SIGINT", onSignal);
process.once("SIGTERM", onSignal);

try {
  browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
  });

  for (const scenarioName of ["pure-dolly", "dolly-orbit"]) {
    const result = await runScenario(browser, scenarioName, {
      baseUrl,
      viewport,
      deviceScaleFactor,
      steps,
      settleMs,
    });
    manifest.scenarios[scenarioName] = result;
    if (result.readyFailure) exitCode = 1;
    console.log(summaryLine(scenarioName, result));
  }

  await writeFile(outPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outPath}`);
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  exitCode = 1;
} finally {
  await cleanup();
  process.removeListener("SIGINT", onSignal);
  process.removeListener("SIGTERM", onSignal);
}

process.exitCode = exitCode;

async function cleanup() {
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
}

async function runScenario(browserInstance, scenarioName, config) {
  const { baseUrl: url, viewport: vp, deviceScaleFactor: dpr, steps: stepCount, settleMs: settle } = config;

  // Fresh context per scenario: asset URLs carry no content hash, and
  // per-scenario byte counting requires an isolated HTTP cache so a warm
  // cache from the other scenario cannot suppress a response body.
  const context = await browserInstance.newContext({
    viewport: vp,
    deviceScaleFactor: dpr,
  });
  const page = await context.newPage();

  const problems = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      problems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    problems.push(`pageerror: ${error.message}`);
  });

  const responsePromises = [];
  page.on("response", (response) => {
    const responseUrl = response.url();
    if (!MERCURY_SCENE_PATTERN.test(responseUrl)) return;
    const fireTime = Date.now();
    responsePromises.push((async () => {
      let bytes = 0;
      let bytesSource = "body";
      try {
        const body = await response.body();
        bytes = body.length;
      } catch (error) {
        const headerLength = response.headers()["content-length"];
        if (headerLength !== undefined && Number.isFinite(Number(headerLength))) {
          bytes = Number(headerLength);
          bytesSource = "content-length-header";
        } else {
          bytes = 0;
          bytesSource = "unavailable";
        }
        problems.push(
          `note: response.body() failed for ${responseUrl} ` +
          `(${error instanceof Error ? error.message : String(error)}); ` +
          `fell back to ${bytesSource} (${bytes} bytes)`,
        );
      }
      return { url: responseUrl, status: response.status(), bytes, bytesSource, fireTime };
    })());
  });

  let readyFailure = null;
  try {
    const navResponse = await page.goto(new URL("/mercury/", url).href, {
      waitUntil: "networkidle",
    });
    if (!navResponse || !navResponse.ok()) {
      throw new Error(`Navigation returned status ${navResponse?.status() ?? "n/a"}`);
    }
    await page.waitForFunction(() =>
      window.__cssEarth?.ready === true &&
      window.__mercury?.ready === true &&
      document.documentElement.dataset.ready === "true",
    { timeout: READY_TIMEOUT_MS });
  } catch (error) {
    readyFailure = error instanceof Error ? error.message : String(error);
  }

  if (readyFailure) {
    console.error(`[${scenarioName}] page never became ready: ${readyFailure}`);
    await context.close().catch(() => {});
    return {
      readyFailure,
      rowRequests: 0,
      rowBytes: 0,
      rowUrls: [],
      distinctRowUrls: 0,
      allMercuryRequests: 0,
      allMercuryBytes: 0,
      performanceRowRequests: 0,
      performanceRowBytes: { encodedBodySize: 0, transferSize: 0 },
      materialCacheStart: null,
      materialCacheEnd: null,
      steps: [],
      problems,
    };
  }

  try {
    await page.evaluate(() => window.__mercury?.pause?.());
  } catch (error) {
    problems.push(`pause() threw: ${error instanceof Error ? error.message : String(error)}`);
  }

  // The row cache is only exercised with shadows on.
  await page.locator('input[name="shadows"]').evaluate((control) => {
    control.checked = true;
    control.dispatchEvent(new Event("change", { bubbles: true }));
  });

  const cameraStats = await page.evaluate(() => window.__mercury.camera.stats());
  const defaultPitch = cameraStats.defaultControlPitchDegrees;
  const defaultYaw = cameraStats.defaultControlYawDegrees;
  const maximumDistanceKilometers = cameraStats.dolly.maximumDistanceKilometers;

  const closeState = await page.evaluate(([controlPitch, controlYaw]) =>
    window.__mercury.camera.setState({ controlPitch, controlYaw, zoom: 1.1 }),
  [defaultPitch, defaultYaw]);
  const closeDistanceKilometers = closeState.distanceKilometers;

  await nextPaint(page);
  await page.waitForTimeout(settle);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(NETWORKIDLE_SETTLE_MS);

  // Start counting.
  const markWallTime = Date.now();
  const markPerfTime = await page.evaluate(() => performance.now());
  const materialCacheStart = await page.evaluate(() =>
    window.__mercury.renderStats.textureStats.materialCache());

  const stepRecords = [];
  const distanceLadder = geometricLadder(
    closeDistanceKilometers,
    maximumDistanceKilometers,
    stepCount,
  );

  if (scenarioName === "pure-dolly") {
    for (let index = 0; index < distanceLadder.length; index += 1) {
      await recordStep(page, stepRecords, problems, "ladder", index, {
        distanceKilometers: distanceLadder[index],
      }, settle);
    }
  } else if (scenarioName === "dolly-orbit") {
    const yawAdvancePerStep = 360 / stepCount;
    for (let index = 0; index < distanceLadder.length; index += 1) {
      await recordStep(page, stepRecords, problems, "ladder", index, {
        distanceKilometers: distanceLadder[index],
        controlYaw: defaultYaw + index * yawAdvancePerStep,
      }, settle);
    }
    for (const [phase, controlPitch] of [
      ["sweep-default-pitch", defaultPitch],
      ["sweep-pitch-80", 80],
    ]) {
      for (let sweepYaw = 0; sweepYaw <= 360; sweepYaw += SWEEP_STEP_DEGREES) {
        await recordStep(page, stepRecords, problems, phase, stepRecords.length, {
          distanceKilometers: maximumDistanceKilometers,
          controlYaw: defaultYaw + sweepYaw,
          controlPitch,
        }, settle);
      }
    }
  } else {
    throw new Error(`Unknown scenario: ${scenarioName}`);
  }

  // Let in-flight requests finish.
  await page.waitForTimeout(FINAL_DRAIN_MS);

  const materialCacheEnd = await page.evaluate(() =>
    window.__mercury.renderStats.textureStats.materialCache());

  const performanceEntries = await page.evaluate((mark) =>
    performance.getEntriesByType("resource")
      .filter((entry) => entry.name.includes("/scenes/mercury/mercury-lighting-") &&
        entry.startTime > mark)
      .map((entry) => ({
        name: entry.name,
        startTime: entry.startTime,
        encodedBodySize: entry.encodedBodySize,
        transferSize: entry.transferSize,
      })),
  markPerfTime);

  const allResponses = await Promise.all(responsePromises);
  const countedResponses = allResponses.filter(({ fireTime }) => fireTime >= markWallTime);
  const rowResponses = countedResponses.filter(({ url: responseUrl }) =>
    LIGHTING_ROW_PATTERN.test(responseUrl));

  // Attribute each row response to the camera step in force when it fired,
  // so requests made while the geometry legitimately needs rows separate
  // from those made once a coarser level of detail has taken over.
  const stepInForce = (fireTime) => {
    let current = null;
    for (const step of stepRecords) {
      if (step.wallTime <= fireTime) current = step;
      else break;
    }
    return current;
  };
  const rowUrls = rowResponses.map(({ url: responseUrl, status, bytes, bytesSource, fireTime }) => {
    const step = stepInForce(fireTime);
    return {
      url: responseUrl,
      status,
      bytes,
      bytesSource,
      step: step ? `${step.phase}#${step.index}` : null,
      lodStage: step?.lod?.stage ?? null,
      silhouetteDiameter: step?.camera ? step.camera.silhouetteRadius * 2 : null,
    };
  });
  const rowRequestsByStage = {};
  for (const record of rowUrls) {
    const key = record.lodStage ?? "unknown";
    rowRequestsByStage[key] ??= { requests: 0, bytes: 0 };
    rowRequestsByStage[key].requests += 1;
    rowRequestsByStage[key].bytes += record.bytes;
  }

  await context.close();

  return {
    readyFailure: null,
    rowRequests: rowResponses.length,
    rowBytes: rowResponses.reduce((sum, { bytes }) => sum + bytes, 0),
    rowUrls,
    rowRequestsByStage,
    distinctRowUrls: new Set(rowUrls.map(({ url: responseUrl }) => responseUrl)).size,
    allMercuryRequests: countedResponses.length,
    allMercuryBytes: countedResponses.reduce((sum, { bytes }) => sum + bytes, 0),
    performanceRowRequests: performanceEntries.length,
    performanceRowBytes: {
      encodedBodySize: performanceEntries.reduce(
        (sum, entry) => sum + (entry.encodedBodySize || 0), 0),
      transferSize: performanceEntries.reduce(
        (sum, entry) => sum + (entry.transferSize || 0), 0),
    },
    materialCacheStart,
    materialCacheEnd,
    closeDistanceKilometers,
    maximumDistanceKilometers,
    defaultControlPitchDegrees: defaultPitch,
    defaultControlYawDegrees: defaultYaw,
    steps: stepRecords,
    problems,
  };
}

async function recordStep(page, stepRecords, problems, phase, index, params, settle) {
  const wallTime = Date.now();
  const setStateResult = await page.evaluate((setStateParams) => {
    try {
      const camera = window.__mercury?.camera;
      if (!camera || typeof camera.setState !== "function") {
        return { ok: false, error: "window.__mercury.camera.setState is not available", state: null };
      }
      const state = camera.setState(setStateParams);
      return { ok: true, error: null, state: state ?? null };
    } catch (error) {
      return {
        ok: false,
        error: (error && (error.stack || error.message)) || String(error),
        state: null,
      };
    }
  }, params);

  if (!setStateResult.ok) {
    problems.push(`[${phase}#${index}] setState error: ${setStateResult.error}`);
  }

  await nextPaint(page);
  await page.waitForTimeout(settle);

  const skyState = await page.evaluate(() => window.__mercury.sky.state());
  const state = setStateResult.state;

  stepRecords.push({
    index,
    phase,
    wallTime,
    requestedDistanceKilometers: params.distanceKilometers ?? null,
    requestedControlYaw: params.controlYaw ?? null,
    requestedControlPitch: params.controlPitch ?? null,
    camera: state && {
      distanceKilometers: state.distanceKilometers,
      zoom: state.zoom,
      silhouetteRadius: state.silhouetteRadius,
      controlYaw: state.controlYaw,
    },
    materialFrame: skyState?.materialFrame ?? null,
    ...(skyState && "lod" in skyState ? { lod: skyState.lod } : {}),
  });
}

function geometricLadder(start, end, count) {
  if (!(start > 0) || !(end > 0)) {
    throw new RangeError(`geometricLadder requires positive bounds, got ${start} -> ${end}`);
  }
  if (count <= 1) return [end];
  const ratio = Math.pow(end / start, 1 / (count - 1));
  const values = [];
  for (let index = 0; index < count; index += 1) {
    values.push(index === count - 1 ? end : start * Math.pow(ratio, index));
  }
  return values;
}

function summaryLine(scenarioName, result) {
  if (result.readyFailure) {
    return `[${scenarioName}] FAILED: page never became ready: ${result.readyFailure}`;
  }
  return `[${scenarioName}] rowRequests=${result.rowRequests} rowBytes=${result.rowBytes} ` +
    `distinctRowUrls=${result.distinctRowUrls} allMercuryRequests=${result.allMercuryRequests} ` +
    `allMercuryBytes=${result.allMercuryBytes} performanceRowRequests=${result.performanceRowRequests} ` +
    `performanceRowBytes.encodedBodySize=${result.performanceRowBytes.encodedBodySize} ` +
    `performanceRowBytes.transferSize=${result.performanceRowBytes.transferSize} ` +
    `problems=${result.problems.length}`;
}

async function nextPaint(page) {
  await page.evaluate(() => new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function isReachable(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    return true;
  } catch {
    return false;
  }
}

function defaultOutPath() {
  const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
  return resolve(DEFAULT_OUT_DIR, `${timestamp}.json`);
}

function parseViewport(value) {
  if (!value) return { width: 1440, height: 900 };
  const match = /^(\d+)x(\d+)$/.exec(value);
  if (!match) throw new TypeError(`--viewport must look like WxH, got "${value}"`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

function parseArguments(argumentsList) {
  const parsed = {};
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (!argument.startsWith("--")) continue;
    const equalsIndex = argument.indexOf("=");
    let key;
    let value;
    if (equalsIndex !== -1) {
      key = argument.slice(2, equalsIndex);
      value = argument.slice(equalsIndex + 1);
    } else {
      key = argument.slice(2);
      const next = argumentsList[index + 1];
      if (next !== undefined && !next.startsWith("--")) {
        value = next;
        index += 1;
      } else {
        value = "true";
      }
    }
    parsed[toCamelCase(key)] = value;
  }
  return parsed;
}

function toCamelCase(key) {
  return key.replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
}
