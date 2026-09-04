import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright";
import sharp from "sharp";

import { browserInteractionScenarios } from
  "./mars-calibration-interaction-driver.mjs";

const ROOT = resolve(import.meta.dirname, "../..");
const EVIDENCE_ROOT = resolve(
  ROOT,
  "output/playwright/google-earth-pro-mars-interaction-video-v1",
);
const CALIBRATION_ROOT = resolve(
  ROOT,
  ".local/oracles/google-earth-pro/calibration",
);
const NATIVE_REPORT_PATH = resolve(EVIDENCE_ROOT, "native-training/report.json");
const BROWSER_REGISTRATION_PATH = resolve(
  EVIDENCE_ROOT,
  "browser-registration/registration.json",
);
const virtualSurfaceUrl = "/__cssmars_oracle/mars-calibration-surface@2x.png";
const virtualPolesUrl = "/__cssmars_oracle/mars-calibration-poles@2x.png";

export async function captureMarsBrowserInteractionCorpus(args) {
  const options = parseArguments(args);
  if (options.set !== "training" || options.repeat !== 3 || !options.trace) {
    throw new Error(
      "Browser interaction evidence requires --set training --repeat 3 --trace.",
    );
  }
  const outputRoot = resolve(ROOT, options.output);
  if (!outputRoot.startsWith(resolve(ROOT, "output/playwright") + "/")) {
    throw new Error("Browser interaction output must stay under output/playwright.");
  }
  const [nativeReport, registration, calibrationManifest, atlasManifest] =
    await Promise.all([
      readJson(NATIVE_REPORT_PATH),
      readJson(BROWSER_REGISTRATION_PATH),
      readJson(resolve(CALIBRATION_ROOT, "manifest.json")),
      readJson(resolve(CALIBRATION_ROOT, "css-earth/manifest.json")),
    ]);
  assert.equal(
    nativeReport.qualification,
    "NATIVE_TRAINING_INTERACTION_CORPUS_PROVEN_WITH_DECLARED_EXCLUSIONS",
  );
  assert.equal(
    registration.qualification,
    "BROWSER_RETAINED_CALIBRATION_REGISTRATION_PROVEN",
  );
  const validNative = nativeReport.scenarioQualifications.filter(
    ({ qualification }) => qualification !== "INVALID_EXCLUDED_FROM_FITTING",
  );
  const nativeQualificationById = new Map(validNative.map((entry) => [
    entry.id,
    entry,
  ]));
  const validIds = new Set(validNative.map(({ id }) => id));
  const density = registration.densities.find((entry) => entry.density === 1);
  assert.ok(density);
  const surfaceAtlas = atlasManifest.atlases.find(
    ({ id }) => id === "projective-surface-2x",
  );
  const polesAtlas = atlasManifest.atlases.find(
    ({ id }) => id === "polar-atlas-2x",
  );
  assert.ok(surfaceAtlas && polesAtlas);
  assert.equal(
    calibrationManifest.source.decodedRgbaSha256,
    atlasManifest.sourceDecodedRgbaSha256,
  );
  const [surfaceBytes, polesBytes] = await Promise.all([
    readFile(resolve(CALIBRATION_ROOT, surfaceAtlas.path)),
    readFile(resolve(CALIBRATION_ROOT, polesAtlas.path)),
  ]);
  assert.equal(sha256(surfaceBytes), surfaceAtlas.encodedSha256);
  assert.equal(sha256(polesBytes), polesAtlas.encodedSha256);

  const geometryFor = (scenario) => {
    const registrationCapture = density.captures.find(({ nativeCamera }) =>
      sameCamera(nativeCamera, scenario.startCamera));
    assert.ok(registrationCapture, `${scenario.id}: missing browser registration`);
    return Object.freeze({
      viewport: registration.viewport,
      crop: registration.crop,
      disc: registrationCapture.nativeDisc,
    });
  };
  const allScenarios = await browserInteractionScenarios({
    set: options.set,
    geometryFor,
  });
  const scenarios = allScenarios.filter(({ scenario }) =>
    validIds.has(scenario.id)).map((entry) => Object.freeze({
    ...entry,
    nativeQualification: nativeQualificationById.get(entry.scenario.id),
    nativeFrameBindings: Object.freeze(nativeReport.runs.map((run) => {
      const nativeScenario = run.scenarios.find(
        ({ id }) => id === entry.scenario.id,
      );
      assert.ok(nativeScenario, `${entry.scenario.id}: missing native run`);
      return Object.freeze({
        repeat: run.repeat,
        tracePath: nativeScenario.trace.path,
        traceSha256: nativeScenario.trace.sha256,
        frameCount: nativeScenario.trace.frameCount,
      });
    })),
  }));
  assert.equal(scenarios.length, validNative.length);

  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
  });
  const runs = [];
  try {
    for (let repeat = 1; repeat <= options.repeat; repeat += 1) {
      runs.push(await captureRepeat({
        browser,
        repeat,
        outputRoot,
        options,
        registration,
        density,
        scenarios,
        surfaceBytes,
        polesBytes,
      }));
    }
  } finally {
    await browser.close();
  }

  const repeatability = qualifyRepeatability(runs, scenarios);
  const captureGates = Object.freeze({
    requestedSetCaptured: scenarios.length === validNative.length,
    requestedRepeatCountCaptured: runs.length === options.repeat,
    allInputsDispatched: runs.every(({ scenarios: entries }) =>
      entries.every(({ input }) =>
        input.dispatchedCount === input.requestedCount)),
    allInputsAccepted: runs.every(({ scenarios: entries }) =>
      entries.every(({ input }) => input.acceptedCount === input.requestedCount)),
    allScenariosSettled: runs.every(({ scenarios: entries }) =>
      entries.every(({ settled }) => settled)),
    allFrameSequencesCaptured: runs.every(({ scenarios: entries }) =>
      entries.every(({ frames }) => frames.length >= 2 &&
        frames.every((frame, index) => index === 0 ||
          frame.timestamp > frames[index - 1].timestamp))),
    nativeFrameBindingsComplete: runs.every(({ repeat, scenarios: entries }) =>
      entries.every(({ nativeFrameBinding }) =>
        nativeFrameBinding.repeat === repeat &&
        nativeFrameBinding.traceSha256.length === 64 &&
        nativeFrameBinding.frameCount > 0)),
    allRetainedIdentitiesStable: runs.every(({ retained }) =>
      retained.identityStable),
    noRuntimeDomGrowth: runs.every(({ retained }) => retained.domGrowth === 0),
    noBrowserFailures: runs.every(({ browserFailures }) =>
      browserFailures.length === 0),
    noExternalRequests: runs.every(({ externalRequests }) =>
      externalRequests.length === 0),
    longTaskObservationComplete: runs.every(({ longTaskObserverInstalled }) =>
      longTaskObserverInstalled),
    compositorTraceCaptured: runs.every(({ trace }) =>
      trace.bytes > 0 && trace.sha256.length === 64),
    layoutAndStyleCountersCaptured: runs.every(({ performance }) =>
      Number.isFinite(performance.layoutCountDelta) &&
      Number.isFinite(performance.recalcStyleCountDelta)),
  });
  const repeatabilityDiagnostic = Object.freeze({
    allScenariosRepeatable: repeatability.every(({ repeatable }) => repeatable),
    stableScenarioIds: Object.freeze(repeatability.filter(
      ({ repeatable }) => repeatable,
    ).map(({ id }) => id)),
    unstableScenarioIds: Object.freeze(repeatability.filter(
      ({ repeatable }) => !repeatable,
    ).map(({ id }) => id)),
    qualification:
      "PREFIT_BROWSER_BEHAVIOR_DIAGNOSTIC_NOT_A_CAPTURE_VALIDITY_GATE",
  });
  const qualification = Object.values(captureGates).every(Boolean)
    ? "BROWSER_TRAINING_INTERACTION_CORPUS_CAPTURED"
    : "INVALID_BROWSER_TRAINING_INTERACTION_CORPUS_GATE_FAILED";
  const report = Object.freeze({
    schema: "cssmars-browser-interaction-corpus@1",
    qualification,
    generatedAt: new Date().toISOString(),
    browser: "Google Chrome via Playwright and CDP",
    baseUrl: options.baseUrl,
    viewport: registration.viewport,
    deviceScaleFactor: 1,
    calibration: Object.freeze({
      sourceDecodedRgbaSha256:
        calibrationManifest.source.decodedRgbaSha256,
      binding: "harness-only CDP stylesheet and prepared atlas interception",
      productionRuntimeChanged: false,
    }),
    nativeReference: NATIVE_REPORT_PATH,
    includedScenarios: validNative,
    excludedNativeScenarios: nativeReport.scenarioQualifications.filter(
      ({ qualification: value }) => value === "INVALID_EXCLUDED_FROM_FITTING",
    ),
    inputClock:
      "CDP TimeSinceEpoch source timestamps with browser event timestamps recorded in capture listeners",
    gates: captureGates,
    repeatabilityDiagnostic,
    repeatability,
    runs,
  });
  const reportPath = resolve(outputRoot, "report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    qualification,
    reportPath,
    gates: captureGates,
    repeatabilityDiagnostic,
    repeatability,
  }, null, 2)}\n`);
  if (qualification.startsWith("INVALID")) process.exitCode = 1;
}

async function captureRepeat({
  browser,
  repeat,
  outputRoot,
  options,
  registration,
  density,
  scenarios,
  surfaceBytes,
  polesBytes,
}) {
  const runRoot = resolve(outputRoot, `repeat-${pad(repeat)}`);
  await mkdir(runRoot, { recursive: true });
  const context = await browser.newContext({
    viewport: registration.viewport,
    deviceScaleFactor: 1,
    colorScheme: "dark",
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const browserFailures = [];
  const browserWarnings = [];
  const externalRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserFailures.push(`console error: ${message.text()}`);
    } else if (message.type() === "warning") {
      browserWarnings.push(message.text());
    }
  });
  page.on("pageerror", (error) => browserFailures.push(
    `pageerror: ${error.message}`,
  ));
  page.on("request", (request) => {
    const { hostname } = new URL(request.url());
    if (!["127.0.0.1", "localhost"].includes(hostname)) {
      externalRequests.push(request.url());
    }
  });
  await page.route("**/@vite/client", (route) => route.fulfill({
    status: 200,
    contentType: "text/javascript",
    body: [
      "const noop = () => {};",
      "export const createHotContext = () => ({",
      "  accept: noop, acceptExports: noop, decline: noop, dispose: noop,",
      "  prune: noop, invalidate: noop, on: noop, off: noop, send: noop,",
      "});",
      "export const injectQuery = (url) => url;",
      "export const updateStyle = noop;",
      "export const removeStyle = noop;",
      "",
    ].join("\n"),
  }));
  await page.route(`**${virtualSurfaceUrl}`, (route) => route.fulfill({
    status: 200,
    contentType: "image/png",
    body: surfaceBytes,
  }));
  await page.route(`**${virtualPolesUrl}`, (route) => route.fulfill({
    status: 200,
    contentType: "image/png",
    body: polesBytes,
  }));
  try {
    const response = await page.goto(options.baseUrl, { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200);
    await waitForMars(page);
    await installOracleStyleSheet(cdp);
    await page.evaluate(async ({ surfaceUrl, polesUrl }) => {
      const decode = (source) => {
        const image = new Image();
        image.decoding = "sync";
        image.src = source;
        return image.decode();
      };
      await Promise.all([decode(surfaceUrl), decode(polesUrl)]);
      window.__mars.pause();
      for (const animation of document.getAnimations()) {
        animation.currentTime = 0;
        animation.pause();
      }
      const stage = document.querySelector(".planet-stage");
      const nodes = [...stage.querySelectorAll("*")];
      const state = {
        active: false,
        frames: [],
        events: [],
        longTasks: [],
        nodes,
        parents: nodes.map((node) => node.parentNode),
        initialNodeCount: nodes.length,
        longTaskObserverInstalled: false,
      };
      const matrix = (value) => Array.from(new DOMMatrix(value || undefined)
        .toFloat64Array());
      const sample = (timestamp) => {
        if (!state.active) return;
        const camera = window.__mars.view();
        const sceneTransform = document.querySelector(
          ".polycss-scene",
        ).style.transform;
        const skyboxTransform = document.querySelector(
          ".planet-cubic-sky-orientation",
        ).style.transform;
        state.frames.push({
          timestamp,
          camera,
          sceneTransform,
          sceneMatrix: matrix(sceneTransform),
          skyboxTransform,
          skyboxMatrix: matrix(skyboxTransform),
          activeMode: window.__mars.camera.stats().dragInertia.activeMode,
        });
        requestAnimationFrame(sample);
      };
      for (const type of ["pointerdown", "pointermove", "pointerup",
        "pointercancel", "wheel", "dblclick"]) {
        stage.addEventListener(type, (event) => {
          if (!state.active) return;
          state.events.push({
            type,
            timeStamp: event.timeStamp,
            clientX: event.clientX,
            clientY: event.clientY,
            button: event.button,
            buttons: event.buttons,
            detail: event.detail,
            deltaY: event.deltaY ?? null,
          });
        }, true);
      }
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            state.longTasks.push({
              startTime: entry.startTime,
              duration: entry.duration,
            });
          }
        });
        observer.observe({ type: "longtask", buffered: true });
        state.longTaskObserverInstalled = true;
      } catch {}
      window.__marsBrowserMotionOracle = state;
      window.__marsBrowserMotionStart = () => {
        state.frames = [];
        state.events = [];
        state.longTasks = [];
        state.active = true;
        requestAnimationFrame(sample);
        return performance.now();
      };
      window.__marsBrowserMotionStop = () => {
        state.active = false;
        return {
          frames: state.frames,
          events: state.events,
          longTasks: state.longTasks,
          longTaskObserverInstalled: state.longTaskObserverInstalled,
        };
      };
    }, { surfaceUrl: virtualSurfaceUrl, polesUrl: virtualPolesUrl });
    await twoFrames(page);
    await Promise.all([
      cdp.send("Performance.enable"),
      cdp.send("Tracing.start", {
        transferMode: "ReturnAsStream",
        categories: [
          "devtools.timeline",
          "blink.user_timing",
          "disabled-by-default-devtools.timeline.frame",
        ].join(","),
      }),
    ]);
    const metricsBefore = await performanceMetrics(cdp);
    const entries = [];
    for (const entry of scenarios) {
      const registrationCapture = density.captures.find(({ nativeCamera }) =>
        sameCamera(nativeCamera, entry.scenario.startCamera));
      assert.ok(registrationCapture);
      entries.push(await captureScenario({
        page,
        cdp,
        repeat,
        runRoot,
        entry,
        registrationCapture,
        crop: registration.crop,
      }));
      process.stdout.write(`${JSON.stringify({
        event: "browser-timing-scenario-complete",
        repeat,
        scenario: entry.scenario.id,
      })}\n`);
    }
    const metricsAfter = await performanceMetrics(cdp);
    const tracePath = resolve(runRoot, "chrome-trace.json");
    const trace = await stopTracing(cdp, tracePath);
    const retained = await page.evaluate(() => {
      const state = window.__marsBrowserMotionOracle;
      const stage = document.querySelector(".planet-stage");
      return {
        identityStable: state.nodes.every((node, index) =>
          node.isConnected && node.parentNode === state.parents[index]),
        domGrowth: stage.querySelectorAll("*").length - state.initialNodeCount,
        stableDomAssertion: window.__mars.assertStableDomIdentity(),
      };
    });
    const longTasks = entries.flatMap(({ longTasks: values }) => values);
    const run = Object.freeze({
      repeat,
      runRoot,
      browserFailures: Object.freeze(browserFailures),
      browserWarnings: Object.freeze(browserWarnings),
      externalRequests: Object.freeze(externalRequests),
      longTaskObserverInstalled: entries.every(
        ({ longTaskObserverInstalled }) => longTaskObserverInstalled,
      ),
      retained: Object.freeze(retained),
      longTasks: Object.freeze(longTasks),
      performance: Object.freeze({
        before: metricsBefore,
        after: metricsAfter,
        layoutCountDelta: metric(metricsAfter, "LayoutCount") -
          metric(metricsBefore, "LayoutCount"),
        recalcStyleCountDelta: metric(metricsAfter, "RecalcStyleCount") -
          metric(metricsBefore, "RecalcStyleCount"),
      }),
      trace,
      scenarios: Object.freeze(entries),
    });
    await writeFile(
      resolve(runRoot, "run-summary.json"),
      `${JSON.stringify(run, null, 2)}\n`,
    );
    return run;
  } finally {
    await cdp.detach().catch(() => {});
    await context.close();
  }
}

async function captureScenario({
  page,
  cdp,
  repeat,
  runRoot,
  entry,
  registrationCapture,
  crop,
}) {
  const scenarioRoot = resolve(runRoot, entry.scenario.id);
  await mkdir(scenarioRoot, { recursive: true });
  await page.evaluate(({ endpoint, zoom }) => {
    window.__mars.setView({
      controlPitch: endpoint.controlPitch,
      controlYaw: endpoint.controlYaw,
      zoom,
    });
    const roll = endpoint.screenRollDegrees ?? 0;
    document.querySelector(".polycss-camera").style.rotate = `${roll}deg`;
    document.querySelector(".planet-cubic-sky-orientation").style.rotate =
      `${roll}deg`;
  }, {
    endpoint: registrationCapture.browserEndpoint,
    zoom: registrationCapture.zoom,
  });
  await twoFrames(page);
  const initialPath = resolve(scenarioRoot, "initial.png");
  await captureCrop(page, crop, initialPath);
  const startTimestamp = await page.evaluate(() =>
    window.__marsBrowserMotionStart());
  const started = process.hrtime.bigint();
  const sourceEpochMilliseconds = Date.now();
  const dispatches = [];
  let buttons = 0;
  for (const event of entry.events) {
    const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
    if (elapsed < event.atMilliseconds) {
      await delay(event.atMilliseconds - elapsed);
    }
    const timestamp = (sourceEpochMilliseconds + event.atMilliseconds) / 1000;
    const before = Number(process.hrtime.bigint() - started) / 1e6;
    if (event.kind === "wheel") {
      await cdp.send("Input.dispatchMouseEvent", {
        type: "mouseWheel",
        x: event.x,
        y: event.y,
        deltaX: 0,
        deltaY: event.deltaY,
        modifiers: 0,
        timestamp,
      });
    } else {
      const type = event.kind === "down"
        ? "mousePressed"
        : event.kind === "up"
          ? "mouseReleased"
          : "mouseMoved";
      if (event.kind === "down") buttons = 1;
      if (event.kind === "up") buttons = 0;
      await cdp.send("Input.dispatchMouseEvent", {
        type,
        x: event.x,
        y: event.y,
        button: event.kind === "move" || event.kind === "drag"
          ? "none"
          : "left",
        buttons,
        clickCount: event.clickCount ?? 1,
        modifiers: 0,
        timestamp,
      });
    }
    dispatches.push(Object.freeze({
      id: event.id,
      kind: event.kind,
      sourceOffsetMilliseconds: event.atMilliseconds,
      actualOffsetMilliseconds:
        Number(process.hrtime.bigint() - started) / 1e6,
      dispatchDurationMilliseconds:
        Number(process.hrtime.bigint() - started) / 1e6 - before,
    }));
  }
  await page.waitForFunction(() =>
    window.__mars.camera.stats().dragInertia.activeMotionCount === 0,
  null, { timeout: 15_000 });
  await twoFrames(page);
  const captured = await page.evaluate(() => window.__marsBrowserMotionStop());
  const finalCamera = await page.evaluate(() => window.__mars.view());
  const stats = await page.evaluate(() => window.__mars.camera.stats());
  const finalPath = resolve(scenarioRoot, "settled.png");
  await captureCrop(page, crop, finalPath);
  const result = Object.freeze({
    id: entry.scenario.id,
    startCamera: entry.scenario.startCamera,
    tags: entry.scenario.tags,
    nativeQualification: entry.nativeQualification,
    nativeFrameBinding: entry.nativeFrameBindings.find(
      ({ repeat: nativeRepeat }) => nativeRepeat === repeat,
    ),
    input: Object.freeze({
      requestedCount: entry.events.length,
      dispatchedCount: dispatches.length,
      sourceEpochMilliseconds,
      startTimestamp,
      events: Object.freeze(dispatches),
      acceptedEvents: Object.freeze(captured.events),
      acceptedCount: captured.events.filter(({ type }) =>
        ["pointerdown", "pointermove", "pointerup", "wheel"].includes(type))
        .length,
    }),
    frames: Object.freeze(captured.frames),
    longTasks: Object.freeze(captured.longTasks),
    longTaskObserverInstalled: captured.longTaskObserverInstalled,
    settled: stats.dragInertia.activeMotionCount === 0,
    finalCamera,
    stats,
    screenshots: Object.freeze({ initial: initialPath, settled: finalPath }),
  });
  await writeFile(
    resolve(scenarioRoot, "trace.json"),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  return result;
}

function qualifyRepeatability(runs, scenarios) {
  return scenarios.map(({ scenario }) => {
    const entries = runs.map((run) => run.scenarios.find(
      ({ id }) => id === scenario.id,
    ));
    const pitch = spread(entries.map(({ finalCamera }) =>
      finalCamera.controlPitch));
    const yaw = circularSpread(entries.map(({ finalCamera }) =>
      finalCamera.controlYaw));
    const zoom = spread(entries.map(({ finalCamera }) => finalCamera.zoom));
    return Object.freeze({
      id: scenario.id,
      maximumPitchSpreadDegrees: pitch,
      maximumYawSpreadDegrees: yaw,
      maximumZoomSpread: zoom,
      thresholds: Object.freeze({
        maximumPitchSpreadDegrees: 0.5,
        maximumYawSpreadDegrees: 0.5,
        maximumZoomSpread: 0.02,
      }),
      repeatable: pitch <= 0.5 && yaw <= 0.5 && zoom <= 0.02,
    });
  });
}

async function installOracleStyleSheet(cdp) {
  await Promise.all([
    cdp.send("DOM.enable"),
    cdp.send("CSS.enable"),
    cdp.send("Page.enable"),
  ]);
  const frameTree = await cdp.send("Page.getFrameTree");
  const { styleSheetId } = await cdp.send("CSS.createStyleSheet", {
    frameId: frameTree.frameTree.frame.id,
  });
  await cdp.send("CSS.setStyleSheetText", {
    styleSheetId,
    text: `
      body > :not(.planet-stage) { display: none !important; }
      .planet-stage { inset: 0 !important; }
      .planet-stage > .planet-render-root { translate: 0 0 !important; }
      .mars-body > s:not(.mars-pole) {
        background-image: url("${virtualSurfaceUrl}") !important;
      }
      .mars-body > .mars-pole {
        background-image: url("${virtualPolesUrl}") !important;
      }
      .mars-material-counter, .mars-moon-orbit,
      .planet-directional-sun { display: none !important; }
      .planet-render-root, .polycss-scene, .mars-system,
      .mars-body, .mars-body > s { pointer-events: auto !important; }
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
      }
    `,
  });
}

async function performanceMetrics(cdp) {
  return (await cdp.send("Performance.getMetrics")).metrics;
}

function metric(metrics, name) {
  return metrics.find((entry) => entry.name === name)?.value ?? NaN;
}

async function stopTracing(cdp, path) {
  const complete = new Promise((accept) =>
    cdp.once("Tracing.tracingComplete", accept));
  await cdp.send("Tracing.end");
  const { stream } = await complete;
  const chunks = [];
  while (true) {
    const result = await cdp.send("IO.read", { handle: stream });
    chunks.push(Buffer.from(result.data, result.base64Encoded
      ? "base64" : "utf8"));
    if (result.eof) break;
  }
  await cdp.send("IO.close", { handle: stream });
  const bytes = Buffer.concat(chunks);
  await writeFile(path, bytes);
  return Object.freeze({ path, bytes: bytes.length, sha256: sha256(bytes) });
}

async function captureCrop(page, crop, path) {
  const full = await page.screenshot({ type: "png" });
  await sharp(full).extract(crop).png().toFile(path);
}

async function waitForMars(page) {
  await page.waitForFunction(() =>
    window.__mars?.ready === true &&
    document.documentElement.dataset.ready === "true" &&
    document.querySelector(".planet-stage")?.getAttribute("aria-busy") ===
      "false",
  );
}

async function twoFrames(page) {
  await page.evaluate(() => new Promise((accept) =>
    requestAnimationFrame(() => requestAnimationFrame(accept))));
}

function parseArguments(args) {
  const parsed = {
    set: null,
    repeat: 0,
    trace: false,
    output:
      "output/playwright/google-earth-pro-mars-interaction-video-v1/" +
      "browser-training",
    baseUrl: "http://127.0.0.1:4210/mars/",
  };
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--set") parsed.set = args[++index];
    else if (value === "--repeat") parsed.repeat = Number(args[++index]);
    else if (value === "--trace") parsed.trace = true;
    else if (value === "--output") parsed.output = args[++index];
    else if (value === "--base-url") parsed.baseUrl = args[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return Object.freeze(parsed);
}

function sameCamera(first, second) {
  return first.latitude === second.latitude &&
    first.longitude === second.longitude &&
    first.distance === second.distance && first.tilt === second.tilt &&
    first.azimuth === second.azimuth;
}

function spread(values) {
  return Math.max(...values) - Math.min(...values);
}

function circularSpread(values) {
  let maximum = 0;
  for (const first of values) {
    for (const second of values) {
      maximum = Math.max(
        maximum,
        Math.abs(((second - first + 540) % 360) - 180),
      );
    }
  }
  return maximum;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function delay(milliseconds) {
  return new Promise((accept) => setTimeout(accept, milliseconds));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
