import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

import sharp from "sharp";

const execFile = promisify(execFileCallback);
const ROOT = resolve(import.meta.dirname, "../../../../../..");
const FRAME_RATE = 15;
const SAMPLE_INTERVAL_MILLISECONDS = 1000 / 60;
const TRAINING_THRESHOLDS = Object.freeze({
  drivenInputMaximumEndpointResidualDegrees: 4,
  drivenInputMaximumMeanPathResidualDegrees: 8,
  drivenInputMaximumP95PathResidualDegrees: 15,
  flyMaximumPathResidualDegrees: 2.5,
  flyMaximumDurationResidualMilliseconds: 200,
  flyMaximumZoomRatioResidual: 0.2,
  inputTimingMaximumResidualMilliseconds: 20,
});
const PANEL = Object.freeze({ width: 320, height: 240 });
const TRIPTYCH = Object.freeze({ width: 960, height: 260 });
const options = parseArguments(process.argv.slice(2));
const nativeRoot = resolve(ROOT, options.native);
const browserRoot = resolve(ROOT, options.browser);
const outputRoot = resolve(ROOT, options.output);

if (!outputRoot.startsWith(resolve(ROOT, "output/playwright") + "/")) {
  throw new Error("Interaction comparison output must stay under output/playwright.");
}

async function main() {
const [nativeReport, browserReport, corpus] = await Promise.all([
  readJson(resolve(nativeRoot, "report.json")),
  readJson(resolve(browserRoot, "report.json")),
  readJson(resolve(import.meta.dirname, "interaction-corpus-v1.json")),
]);
assert.equal(
  nativeReport.qualification,
  "NATIVE_TRAINING_INTERACTION_CORPUS_PROVEN_WITH_DECLARED_EXCLUSIONS",
);
assert.equal(
  browserReport.qualification,
  "BROWSER_TRAINING_INTERACTION_CORPUS_CAPTURED",
);
assert.deepEqual(
  nativeReport.application.viewportContract.scene,
  browserReport.viewport,
);
assert.equal(browserReport.deviceScaleFactor, 1);
assert.equal(
  nativeReport.calibration.decodedRgbaSha256,
  browserReport.calibration.sourceDecodedRgbaSha256,
);

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

const includedIds = browserReport.includedScenarios.map(({ id }) => id);
const comparisons = [];
for (const id of includedIds) {
  const scenario = corpus.scenarios.find((entry) => entry.id === id);
  assert.ok(scenario, `${id}: missing corpus scenario`);
  const nativeQualification = nativeReport.scenarioQualifications.find(
    (entry) => entry.id === id,
  );
  const runs = [];
  for (let repeat = 1; repeat <= 3; repeat += 1) {
    const nativeRun = nativeReport.runs.find((entry) =>
      entry.repeat === repeat);
    const browserRun = browserReport.runs.find((entry) =>
      entry.repeat === repeat);
    assert.ok(nativeRun && browserRun, `${id}: missing repeat ${repeat}`);
    const nativeScenario = nativeRun.scenarios.find((entry) => entry.id === id);
    const browserScenario = browserRun.scenarios.find((entry) => entry.id === id);
    assert.ok(nativeScenario && browserScenario);
    runs.push(await compareRun({
      repeat,
      scenario,
      nativeScenario,
      browserScenario,
    }));
  }
  const scenarioRoot = resolve(outputRoot, id);
  await mkdir(scenarioRoot, { recursive: true });
  const visual = await renderTelemetryEvidence({
    id,
    scenario,
    run: runs.at(-1),
    scenarioRoot,
  });
  const nativeVisual = nativeReport.runs.at(-1).visualReplay.scenarios.find(
    (entry) => entry.id === id,
  );
  const browserVisual = browserReport.runs.at(-1).scenarios.find(
    (entry) => entry.id === id,
  ).screenshots;
  const aggregate = summarizeRuns(runs);
  const trainingGate = qualifyTrainingScenario(id, aggregate);
  const report = Object.freeze({
    schema: "cssmars-synchronized-interaction-comparison@1",
    id,
    nativeQualification,
    timeAlignment: Object.freeze({
      origin: "accepted scenario batch monotonic origin",
      intervalMilliseconds: SAMPLE_INTERVAL_MILLISECONDS,
      dynamicTimeWarping: false,
      endpointExtension:
        "A renderer that settles first holds its final measured state.",
    }),
    channels: Object.freeze({
      angularPathDegrees:
        "Cumulative shortest-arc rotation from consecutive camera matrices",
      zoomRatio:
        "Current zoom relative to the first measured frame",
      velocityDegreesPerSecond:
        "Central difference on the fixed 60 Hz resample",
      accelerationDegreesPerSecondSquared:
        "Central difference of fixed-axis velocity",
    }),
    aggregate,
    trainingGate,
    runs,
    visual,
    sourceRendererVisuals: Object.freeze({
      qualification:
        "SPARSE_NON_TIMING_KEYFRAMES_NOT_A_SYNCHRONIZED_RASTER_SEQUENCE",
      native: nativeVisual?.frames ?? [],
      browser: browserVisual,
    }),
  });
  const reportPath = resolve(scenarioRoot, "report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  comparisons.push(Object.freeze({
    id,
    reportPath,
    nativeQualification: nativeQualification.qualification,
    aggregate,
    trainingGate,
    visual,
  }));
  process.stdout.write(`${JSON.stringify({
    event: "interaction-comparison-complete",
    id,
    maximumAngularPathResidualDegrees:
      aggregate.maximumAngularPathResidualDegrees,
    durationResidualMilliseconds: aggregate.durationResidualMilliseconds,
  })}\n`);
}

const contactSheetPath = resolve(outputRoot, "contact-sheet.png");
await makeContactSheet(comparisons, contactSheetPath);
const manifest = Object.freeze({
  schema: "cssmars-training-interaction-video-comparison@1",
  qualification: comparisons.every(({ trainingGate }) => trainingGate.passes)
    ? "TRAINING_DRAG_AND_FLY_CONTRACT_FIT_POST_RELEASE_INERTIA_UNPROVEN"
    : "TRAINING_INTERACTION_CONTRACT_OUTSIDE_DECLARED_THRESHOLDS",
  generatedAt: new Date().toISOString(),
  nativeReport: resolve(nativeRoot, "report.json"),
  browserReport: resolve(browserRoot, "report.json"),
  calibrationSourceDecodedRgbaSha256:
    nativeReport.calibration.decodedRgbaSha256,
  pairing: Object.freeze({
    viewport: browserReport.viewport,
    dpr: browserReport.deviceScaleFactor,
    scenarioIds: Object.freeze(includedIds),
    repeatCount: 3,
    fixedResampleMilliseconds: SAMPLE_INTERVAL_MILLISECONDS,
    dynamicTimeWarping: false,
  }),
  visualQualification:
    "TELEMETRY_RASTERIZATION_VALID_FOR_MOTION_REVIEW_NOT_RENDERER_PIXELMATCH",
  rasterDifferenceQualification:
    "INVALID_AS_RENDERER_PIXELMATCH_SPARSE_NATIVE_KEYFRAMES_ONLY",
  thresholds: TRAINING_THRESHOLDS,
  comparisons,
  contactSheetPath,
  gates: Object.freeze({
    allIncludedScenariosCompared: comparisons.length === includedIds.length,
    everyScenarioHasThreeRepeats: comparisons.every(({ aggregate }) =>
      aggregate.repeatCount === 3),
    noDynamicTimeWarping: true,
    everyScenarioHasMachineReport: comparisons.every(({ reportPath }) =>
      reportPath.endsWith("/report.json")),
    everyScenarioHasFrameSequence: comparisons.every(({ visual }) =>
      visual.triptychFrames.endsWith("/telemetry-frames/triptych")),
    everyScenarioHasFourVideos: comparisons.every(({ visual }) =>
      [visual.nativeVideo, visual.browserVideo, visual.absoluteVideo,
        visual.triptychVideo].every(Boolean)),
    exactBadFramesReported: comparisons.every(({ aggregate }) =>
      aggregate.worstFrames.length > 0),
    allTrainingChannelsWithinThreshold: comparisons.every(
      ({ trainingGate }) => trainingGate.passes,
    ),
  }),
});
const manifestPath = resolve(outputRoot, "report.json");
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
if (!Object.values(manifest.gates).every(Boolean)) process.exitCode = 1;
process.stdout.write(`${JSON.stringify({
  qualification: manifest.qualification,
  manifestPath,
  contactSheetPath,
  gates: manifest.gates,
  scenarios: comparisons.map(({ id, aggregate, trainingGate, visual }) => ({
    id,
    meanAngularPathResidualDegrees:
      aggregate.meanAngularPathResidualDegrees,
    maximumAngularPathResidualDegrees:
      aggregate.maximumAngularPathResidualDegrees,
    durationResidualMilliseconds: aggregate.durationResidualMilliseconds,
    trainingGate,
    triptychVideo: visual.triptychVideo,
  })),
}, null, 2)}\n`);
}

async function compareRun({
  repeat,
  scenario,
  nativeScenario,
  browserScenario,
}) {
  const nativeTrace = await readJson(nativeScenario.trace.path);
  assert.equal(browserScenario.nativeFrameBinding.repeat, repeat);
  assert.equal(
    browserScenario.nativeFrameBinding.traceSha256,
    nativeScenario.trace.sha256,
  );
  const nativePoints = nativeMotionPoints(nativeTrace, nativeScenario);
  const browserPoints = browserMotionPoints(browserScenario);
  const nativeDuration = nativeScenario.settlementMilliseconds;
  const browserDuration = Math.max(
    0,
    browserPoints.at(-1).milliseconds,
  );
  const endMilliseconds = Math.max(nativeDuration, browserDuration);
  const samples = resamplePair({
    nativePoints,
    browserPoints,
    endMilliseconds,
  });
  addDerivatives(samples);
  const eventTiming = compareEventTiming({
    scenario,
    nativeTrace,
    browserScenario,
  });
  const firstResponseEvent = firstResponseEventFor(scenario);
  const interruptionEvent = interruptionEventFor(scenario);
  const firstResponse = responsePair({
    eventId: firstResponseEvent?.id ?? null,
    eventTiming,
    nativePoints,
    browserPoints,
  });
  const interruption = responsePair({
    eventId: interruptionEvent?.id ?? null,
    eventTiming,
    nativePoints,
    browserPoints,
    sampledOnly: true,
  });
  const rows = samples.map((entry, index) => Object.freeze({
    frame: index,
    milliseconds: entry.milliseconds,
    nativeAngularPathDegrees: entry.native.pathDegrees,
    browserAngularPathDegrees: entry.browser.pathDegrees,
    angularPathResidualDegrees: entry.angularPathResidualDegrees,
    nativeZoomRatio: entry.native.zoomRatio,
    browserZoomRatio: entry.browser.zoomRatio,
    zoomRatioResidual: entry.zoomRatioResidual,
    nativeVelocityDegreesPerSecond:
      entry.native.velocityDegreesPerSecond,
    browserVelocityDegreesPerSecond:
      entry.browser.velocityDegreesPerSecond,
    velocityResidualDegreesPerSecond:
      entry.velocityResidualDegreesPerSecond,
    nativeAccelerationDegreesPerSecondSquared:
      entry.native.accelerationDegreesPerSecondSquared,
    browserAccelerationDegreesPerSecondSquared:
      entry.browser.accelerationDegreesPerSecondSquared,
    accelerationResidualDegreesPerSecondSquared:
      entry.accelerationResidualDegreesPerSecondSquared,
  }));
  const worstFrames = [...rows].sort((first, second) =>
    second.angularPathResidualDegrees - first.angularPathResidualDegrees)
    .slice(0, 12);
  const drivenInputWindow = summarizeDrivenInputWindow({
    scenario,
    eventTiming,
    nativePoints,
    browserPoints,
    rows,
  });
  return Object.freeze({
    repeat,
    nativeTrace: Object.freeze({
      path: nativeScenario.trace.path,
      sha256: nativeScenario.trace.sha256,
      rawFrameCount: nativeTrace.frames.length,
      measuredDurationMilliseconds: nativeDuration,
    }),
    browserTrace: Object.freeze({
      path: resolve(
        browserRoot,
        `repeat-${pad(repeat)}/${scenario.id}/trace.json`,
      ),
      rawFrameCount: browserScenario.frames.length,
      measuredDurationMilliseconds: browserDuration,
    }),
    eventTiming,
    firstResponse,
    interruption,
    endpoint: Object.freeze({
      nativeDurationMilliseconds: nativeDuration,
      browserDurationMilliseconds: browserDuration,
      durationResidualMilliseconds: browserDuration - nativeDuration,
      nativeAngularPathDegrees: samples.at(-1).native.pathDegrees,
      browserAngularPathDegrees: samples.at(-1).browser.pathDegrees,
      angularPathResidualDegrees:
        samples.at(-1).angularPathResidualDegrees,
      nativeZoomRatio: samples.at(-1).native.zoomRatio,
      browserZoomRatio: samples.at(-1).browser.zoomRatio,
      zoomRatioResidual: samples.at(-1).zoomRatioResidual,
    }),
    metrics: summarizeSamples(rows),
    drivenInputWindow,
    worstFrames: Object.freeze(worstFrames),
    samples: Object.freeze(rows),
  });
}

function nativeMotionPoints(trace, scenario) {
  const firstMatrix = trace.frames[0].modelViewMatrix;
  const initialTranslation = Math.abs(firstMatrix[14]);
  const limited = trace.frames.filter((frame) =>
    (frame.monotonicNanoseconds - trace.startNanoseconds) / 1e6 <=
      scenario.settlementMilliseconds + 10);
  return cumulativeMotion(limited.map((frame) => Object.freeze({
    milliseconds:
      (frame.monotonicNanoseconds - trace.startNanoseconds) / 1e6,
    matrix: frame.modelViewMatrix,
    zoomRatio: initialTranslation / Math.abs(frame.modelViewMatrix[14]),
    phase: frame.inputPhase,
    inputSerial: frame.inputSerial,
  })));
}

function browserMotionPoints(scenario) {
  const initialZoom = scenario.frames[0].camera.zoom;
  return cumulativeMotion(scenario.frames.map((frame) => Object.freeze({
    milliseconds: frame.timestamp - scenario.input.startTimestamp,
    matrix: frame.skyboxMatrix,
    zoomRatio: frame.camera.zoom / initialZoom,
    phase: frame.activeMode,
    inputSerial: null,
  })).filter(({ milliseconds }) => milliseconds >= -10));
}

function cumulativeMotion(points) {
  assert.ok(points.length > 0);
  const sorted = [...points].sort((first, second) =>
    first.milliseconds - second.milliseconds);
  let pathDegrees = 0;
  let previous = sorted[0].matrix;
  const result = sorted.map((point, index) => {
    if (index > 0) {
      const step = rotationDifferenceDegrees(previous, point.matrix);
      if (step >= 0.001) pathDegrees += step;
      previous = point.matrix;
    }
    return Object.freeze({ ...point, pathDegrees });
  });
  if (result[0].milliseconds > 0) {
    result.unshift(Object.freeze({ ...result[0], milliseconds: 0 }));
  }
  return Object.freeze(result);
}

function resamplePair({ nativePoints, browserPoints, endMilliseconds }) {
  const count = Math.ceil(endMilliseconds / SAMPLE_INTERVAL_MILLISECONDS) + 1;
  return Array.from({ length: count }, (_, index) => {
    const milliseconds = Math.min(
      endMilliseconds,
      index * SAMPLE_INTERVAL_MILLISECONDS,
    );
    const native = interpolateMotion(nativePoints, milliseconds);
    const browser = interpolateMotion(browserPoints, milliseconds);
    return {
      milliseconds,
      native,
      browser,
      angularPathResidualDegrees:
        Math.abs(native.pathDegrees - browser.pathDegrees),
      zoomRatioResidual: Math.abs(native.zoomRatio - browser.zoomRatio),
    };
  });
}

function interpolateMotion(points, milliseconds) {
  if (milliseconds <= points[0].milliseconds) return { ...points[0] };
  if (milliseconds >= points.at(-1).milliseconds) return { ...points.at(-1) };
  let low = 0;
  let high = points.length - 1;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle].milliseconds <= milliseconds) low = middle;
    else high = middle;
  }
  const first = points[low];
  const second = points[high];
  const progress = (milliseconds - first.milliseconds) /
    (second.milliseconds - first.milliseconds);
  return {
    milliseconds,
    pathDegrees: mix(first.pathDegrees, second.pathDegrees, progress),
    zoomRatio: mix(first.zoomRatio, second.zoomRatio, progress),
    phase: progress < 0.5 ? first.phase : second.phase,
    inputSerial: progress < 0.5 ? first.inputSerial : second.inputSerial,
  };
}

function addDerivatives(samples) {
  for (let index = 0; index < samples.length; index += 1) {
    for (const owner of ["native", "browser"]) {
      const before = samples[Math.max(0, index - 1)];
      const after = samples[Math.min(samples.length - 1, index + 1)];
      const elapsed = Math.max(
        SAMPLE_INTERVAL_MILLISECONDS,
        after.milliseconds - before.milliseconds,
      );
      samples[index][owner].velocityDegreesPerSecond =
        (after[owner].pathDegrees - before[owner].pathDegrees) /
        elapsed * 1000;
    }
    samples[index].velocityResidualDegreesPerSecond = Math.abs(
      samples[index].native.velocityDegreesPerSecond -
      samples[index].browser.velocityDegreesPerSecond,
    );
  }
  for (let index = 0; index < samples.length; index += 1) {
    const before = samples[Math.max(0, index - 1)];
    const after = samples[Math.min(samples.length - 1, index + 1)];
    const elapsed = Math.max(
      SAMPLE_INTERVAL_MILLISECONDS,
      after.milliseconds - before.milliseconds,
    );
    for (const owner of ["native", "browser"]) {
      samples[index][owner].accelerationDegreesPerSecondSquared =
        (after[owner].velocityDegreesPerSecond -
          before[owner].velocityDegreesPerSecond) / elapsed * 1000;
    }
    samples[index].accelerationResidualDegreesPerSecondSquared = Math.abs(
      samples[index].native.accelerationDegreesPerSecondSquared -
      samples[index].browser.accelerationDegreesPerSecondSquared,
    );
  }
}

function compareEventTiming({ scenario, nativeTrace, browserScenario }) {
  const acceptedBrowser = browserScenario.input.acceptedEvents.filter(
    ({ type }) => ["pointerdown", "pointermove", "pointerup", "wheel"]
      .includes(type),
  );
  assert.equal(acceptedBrowser.length, scenario.events.length);
  return Object.freeze(scenario.events.map((event, index) => {
    const native = nativeTrace.accepted.find((entry) => entry.id === event.id);
    const browser = acceptedBrowser[index];
    assert.ok(native && browser, `${scenario.id}/${event.id}: input mismatch`);
    const nativeMilliseconds =
      native.acceptedMonotonicSeconds * 1000 -
      nativeTrace.startNanoseconds / 1e6;
    const browserMilliseconds =
      browser.timeStamp - browserScenario.input.startTimestamp;
    return Object.freeze({
      id: event.id,
      kind: event.kind,
      sourceMilliseconds: event.atMilliseconds,
      nativeAcceptedMilliseconds: nativeMilliseconds,
      browserAcceptedMilliseconds: browserMilliseconds,
      acceptedTimingResidualMilliseconds:
        browserMilliseconds - nativeMilliseconds,
      nativeInputSerial: native.acceptedInputSerial,
    });
  }));
}

function responsePair({
  eventId,
  eventTiming,
  nativePoints,
  browserPoints,
  sampledOnly = false,
}) {
  if (eventId === null) return null;
  const timing = eventTiming.find((entry) => entry.id === eventId);
  assert.ok(timing);
  const nativeResponse = sampledOnly
    ? nextSample(nativePoints, timing.nativeAcceptedMilliseconds)
    : firstMotionResponse(nativePoints, timing.nativeAcceptedMilliseconds);
  const browserResponse = sampledOnly
    ? nextSample(browserPoints, timing.browserAcceptedMilliseconds)
    : firstMotionResponse(browserPoints, timing.browserAcceptedMilliseconds);
  return Object.freeze({
    eventId,
    nativeLatencyMilliseconds:
      nativeResponse?.milliseconds - timing.nativeAcceptedMilliseconds,
    browserLatencyMilliseconds:
      browserResponse?.milliseconds - timing.browserAcceptedMilliseconds,
    latencyResidualMilliseconds:
      (browserResponse?.milliseconds - timing.browserAcceptedMilliseconds) -
      (nativeResponse?.milliseconds - timing.nativeAcceptedMilliseconds),
    interpretation: sampledOnly
      ? "next camera sample after accepted interruption input"
      : "first camera sample changing by 0.02 degrees or 0.0005 zoom ratio",
  });
}

function firstMotionResponse(points, milliseconds) {
  const baseline = interpolateMotion(points, milliseconds);
  return points.find((point) => point.milliseconds >= milliseconds && (
    Math.abs(point.pathDegrees - baseline.pathDegrees) >= 0.02 ||
    Math.abs(point.zoomRatio - baseline.zoomRatio) >= 0.0005
  )) ?? points.at(-1);
}

function nextSample(points, milliseconds) {
  return points.find((point) => point.milliseconds >= milliseconds) ??
    points.at(-1);
}

function firstResponseEventFor(scenario) {
  return scenario.events.find(({ kind }) => kind === "drag") ??
    scenario.events.find(({ kind, clickCount }) =>
      kind === "up" && clickCount === 2) ??
    scenario.events.find(({ kind }) => kind === "wheel") ?? null;
}

function interruptionEventFor(scenario) {
  if (scenario.id.includes("fly-to-interrupted-by-drag")) {
    return scenario.events.find(({ id }) => id === "drag-over-threshold");
  }
  if (scenario.id.includes("wheel-during-fly-to")) {
    return scenario.events.find(({ kind }) => kind === "wheel");
  }
  if (scenario.id.includes("repeated-double-click")) {
    return scenario.events.find(({ id }) => id === "second-up-2");
  }
  return null;
}

function summarizeSamples(rows) {
  return Object.freeze({
    sampleCount: rows.length,
    meanAngularPathResidualDegrees: mean(rows.map((entry) =>
      entry.angularPathResidualDegrees)),
    percentile95AngularPathResidualDegrees: percentile(rows.map((entry) =>
      entry.angularPathResidualDegrees), 0.95),
    maximumAngularPathResidualDegrees: maximum(rows.map((entry) =>
      entry.angularPathResidualDegrees)),
    meanVelocityResidualDegreesPerSecond: mean(rows.map((entry) =>
      entry.velocityResidualDegreesPerSecond)),
    percentile95VelocityResidualDegreesPerSecond: percentile(rows.map((entry) =>
      entry.velocityResidualDegreesPerSecond), 0.95),
    maximumVelocityResidualDegreesPerSecond: maximum(rows.map((entry) =>
      entry.velocityResidualDegreesPerSecond)),
    meanAccelerationResidualDegreesPerSecondSquared: mean(rows.map((entry) =>
      entry.accelerationResidualDegreesPerSecondSquared)),
    percentile95AccelerationResidualDegreesPerSecondSquared:
      percentile(rows.map((entry) =>
        entry.accelerationResidualDegreesPerSecondSquared), 0.95),
    maximumAccelerationResidualDegreesPerSecondSquared: maximum(rows.map(
      (entry) => entry.accelerationResidualDegreesPerSecondSquared)),
    meanZoomRatioResidual: mean(rows.map((entry) =>
      entry.zoomRatioResidual)),
    maximumZoomRatioResidual: maximum(rows.map((entry) =>
      entry.zoomRatioResidual)),
  });
}

function summarizeRuns(runs) {
  const metric = (key) => runs.map((run) => run.metrics[key]);
  const durationResiduals = runs.map((run) =>
    run.endpoint.durationResidualMilliseconds);
  const bad = runs.flatMap((run) => run.worstFrames.map((frame) => ({
    repeat: run.repeat,
    ...frame,
  }))).sort((first, second) =>
    second.angularPathResidualDegrees - first.angularPathResidualDegrees)
    .slice(0, 20);
  const drivenWindows = runs.map(({ drivenInputWindow }) =>
    drivenInputWindow).filter(Boolean);
  return Object.freeze({
    repeatCount: runs.length,
    meanAngularPathResidualDegrees:
      mean(metric("meanAngularPathResidualDegrees")),
    percentile95AngularPathResidualDegrees:
      maximum(metric("percentile95AngularPathResidualDegrees")),
    maximumAngularPathResidualDegrees:
      maximum(metric("maximumAngularPathResidualDegrees")),
    meanVelocityResidualDegreesPerSecond:
      mean(metric("meanVelocityResidualDegreesPerSecond")),
    maximumVelocityResidualDegreesPerSecond:
      maximum(metric("maximumVelocityResidualDegreesPerSecond")),
    meanAccelerationResidualDegreesPerSecondSquared:
      mean(metric("meanAccelerationResidualDegreesPerSecondSquared")),
    maximumAccelerationResidualDegreesPerSecondSquared:
      maximum(metric("maximumAccelerationResidualDegreesPerSecondSquared")),
    meanZoomRatioResidual: mean(metric("meanZoomRatioResidual")),
    maximumZoomRatioResidual: maximum(metric("maximumZoomRatioResidual")),
    durationResidualMilliseconds: mean(durationResiduals),
    durationResidualRangeMilliseconds: Object.freeze([
      Math.min(...durationResiduals),
      Math.max(...durationResiduals),
    ]),
    inputTimingResidualMilliseconds: Object.freeze({
      mean: mean(runs.flatMap((run) => run.eventTiming.map((entry) =>
        Math.abs(entry.acceptedTimingResidualMilliseconds)))),
      maximum: maximum(runs.flatMap((run) => run.eventTiming.map((entry) =>
        Math.abs(entry.acceptedTimingResidualMilliseconds)))),
    }),
    drivenInputWindow: drivenWindows.length === 0
      ? null
      : Object.freeze({
        qualification:
          "VALID_ACCEPTED_INPUT_WINDOW_POST_RELEASE_THROW_EXCLUDED",
        repeatCount: drivenWindows.length,
        meanPathResidualDegrees: mean(drivenWindows.map(({ metrics }) =>
          metrics.meanAngularPathResidualDegrees)),
        maximumP95PathResidualDegrees: maximum(drivenWindows.map(
          ({ metrics }) => metrics.percentile95AngularPathResidualDegrees,
        )),
        meanEndpointResidualDegrees: mean(drivenWindows.map(
          ({ endpointAngularPathResidualDegrees }) =>
            endpointAngularPathResidualDegrees,
        )),
        maximumEndpointResidualDegrees: maximum(drivenWindows.map(
          ({ endpointAngularPathResidualDegrees }) =>
            endpointAngularPathResidualDegrees,
        )),
        postReleaseInertiaQualification:
          "UNAVAILABLE_IN_HEADLESS_NATIVE_CAPTURE_SOURCE_CONTRACT_USED",
      }),
    worstFrames: Object.freeze(bad),
  });
}

function summarizeDrivenInputWindow({
  scenario,
  eventTiming,
  nativePoints,
  browserPoints,
  rows,
}) {
  const dragEvents = scenario.events.filter(({ kind }) => kind === "drag");
  if (dragEvents.length === 0) return null;
  const lastDragIndex = scenario.events.findIndex(({ id }) =>
    id === dragEvents.at(-1).id);
  const release = scenario.events.slice(lastDragIndex + 1).find(
    ({ kind }) => kind === "up",
  );
  if (!release) return null;
  const releaseTiming = eventTiming.find(({ id }) => id === release.id);
  const lastDragTiming = eventTiming.find(({ id }) =>
    id === dragEvents.at(-1).id);
  assert.ok(releaseTiming && lastDragTiming);
  const cutoffMilliseconds = Math.min(
    releaseTiming.nativeAcceptedMilliseconds,
    releaseTiming.browserAcceptedMilliseconds,
  ) - 0.001;
  const drivenRows = rows.filter(({ milliseconds }) =>
    milliseconds <= cutoffMilliseconds);
  assert.ok(drivenRows.length >= 2);
  const nativeEndpoint = [...nativePoints].reverse().find(({ inputSerial }) =>
    inputSerial === lastDragTiming.nativeInputSerial);
  const browserEndpoint = [...browserPoints].reverse().find(({ phase }) =>
    phase === "drag");
  assert.ok(nativeEndpoint && browserEndpoint);
  return Object.freeze({
    qualification: "VALID_ACCEPTED_INPUT_WINDOW",
    cutoffMilliseconds,
    releaseEventId: release.id,
    endpointAngularPathResidualDegrees: Math.abs(
      nativeEndpoint.pathDegrees - browserEndpoint.pathDegrees,
    ),
    nativeEndpointAngularPathDegrees: nativeEndpoint.pathDegrees,
    browserEndpointAngularPathDegrees: browserEndpoint.pathDegrees,
    metrics: summarizeSamples(drivenRows),
  });
}

function qualifyTrainingScenario(id, aggregate) {
  const inputTimingPasses =
    aggregate.inputTimingResidualMilliseconds.maximum <=
      TRAINING_THRESHOLDS.inputTimingMaximumResidualMilliseconds;
  if (aggregate.drivenInputWindow !== null) {
    const window = aggregate.drivenInputWindow;
    return Object.freeze({
      channel: "accepted-driven-input-window",
      postReleaseInertia:
        window.postReleaseInertiaQualification,
      observed: Object.freeze({
        meanPathResidualDegrees: window.meanPathResidualDegrees,
        maximumP95PathResidualDegrees:
          window.maximumP95PathResidualDegrees,
        maximumEndpointResidualDegrees:
          window.maximumEndpointResidualDegrees,
      }),
      passes: inputTimingPasses &&
        window.meanPathResidualDegrees <=
          TRAINING_THRESHOLDS.drivenInputMaximumMeanPathResidualDegrees &&
        window.maximumP95PathResidualDegrees <=
          TRAINING_THRESHOLDS.drivenInputMaximumP95PathResidualDegrees &&
        window.maximumEndpointResidualDegrees <=
          TRAINING_THRESHOLDS.drivenInputMaximumEndpointResidualDegrees,
    });
  }
  const isFittedFly = id.includes("repeated-double-click") ||
    id.includes("wheel-during-fly-to");
  return Object.freeze({
    channel: isFittedFly ? "complete-fly-to" : "unsupported",
    passes: isFittedFly && inputTimingPasses &&
      aggregate.maximumAngularPathResidualDegrees <=
        TRAINING_THRESHOLDS.flyMaximumPathResidualDegrees &&
      Math.abs(aggregate.durationResidualMilliseconds) <=
        TRAINING_THRESHOLDS.flyMaximumDurationResidualMilliseconds &&
      aggregate.maximumZoomRatioResidual <=
        TRAINING_THRESHOLDS.flyMaximumZoomRatioResidual,
  });
}

async function renderTelemetryEvidence({ id, scenario, run, scenarioRoot }) {
  const frameRoot = resolve(scenarioRoot, "telemetry-frames");
  const nativeFrames = resolve(frameRoot, "native");
  const browserFrames = resolve(frameRoot, "browser");
  const absoluteFrames = resolve(frameRoot, "absolute");
  const triptychFrames = resolve(frameRoot, "triptych");
  await Promise.all([nativeFrames, browserFrames, absoluteFrames,
    triptychFrames].map((path) => mkdir(path, { recursive: true })));
  const source = run.samples;
  const endMilliseconds = source.at(-1).milliseconds;
  const frameCount = Math.max(2, Math.ceil(endMilliseconds / 1000 * FRAME_RATE));
  const maxPath = Math.max(1, ...source.flatMap((entry) => [
    entry.nativeAngularPathDegrees,
    entry.browserAngularPathDegrees,
    entry.angularPathResidualDegrees,
  ]));
  const eventTimes = run.eventTiming.map((entry) =>
    entry.sourceMilliseconds);
  for (let index = 0; index < frameCount; index += 1) {
    const milliseconds = frameCount === 1
      ? endMilliseconds
      : index / (frameCount - 1) * endMilliseconds;
    const sampleIndex = Math.min(
      source.length - 1,
      Math.round(milliseconds / SAMPLE_INTERVAL_MILLISECONDS),
    );
    const panels = [
      drawPanel({ kind: "NATIVE", source, sampleIndex, maxPath, eventTimes }),
      drawPanel({ kind: "BROWSER", source, sampleIndex, maxPath, eventTimes }),
      drawPanel({ kind: "ABS DIFF", source, sampleIndex, maxPath, eventTimes }),
    ];
    const file = `frame_${String(index).padStart(4, "0")}.png`;
    await Promise.all([
      writeRgbPng(resolve(nativeFrames, file), panels[0], PANEL),
      writeRgbPng(resolve(browserFrames, file), panels[1], PANEL),
      writeRgbPng(resolve(absoluteFrames, file), panels[2], PANEL),
      writeRgbPng(
        resolve(triptychFrames, file),
        joinPanels(panels, id),
        TRIPTYCH,
      ),
    ]);
  }
  const videos = {
    nativeVideo: resolve(scenarioRoot, "native-telemetry.mp4"),
    browserVideo: resolve(scenarioRoot, "browser-telemetry.mp4"),
    absoluteVideo: resolve(scenarioRoot, "absolute-telemetry.mp4"),
    triptychVideo: resolve(scenarioRoot, "triptych-telemetry.mp4"),
  };
  await Promise.all([
    encodeVideo(nativeFrames, videos.nativeVideo),
    encodeVideo(browserFrames, videos.browserVideo),
    encodeVideo(absoluteFrames, videos.absoluteVideo),
    encodeVideo(triptychFrames, videos.triptychVideo),
  ]);
  const timelinePath = resolve(scenarioRoot, "timeline.png");
  await sharp(resolve(
    triptychFrames,
    `frame_${String(frameCount - 1).padStart(4, "0")}.png`,
  )).toFile(timelinePath);
  const csvPath = resolve(scenarioRoot, "timeline.csv");
  await writeFile(csvPath, rowsToCsv(run.samples));
  return Object.freeze({
    qualification:
      "SYNCHRONIZED_CAMERA_TELEMETRY_NOT_RAW_RENDERER_RASTER",
    frameRate: FRAME_RATE,
    frameCount,
    panelOrder: Object.freeze(["native", "browser", "absolute difference"]),
    triptychFrames,
    timelinePath,
    csvPath,
    ...videos,
  });
}

function drawPanel({ kind, source, sampleIndex, maxPath, eventTimes }) {
  const buffer = Buffer.alloc(PANEL.width * PANEL.height * 3);
  fill(buffer, PANEL.width, PANEL.height, [5, 8, 13]);
  const color = kind === "NATIVE"
    ? [68, 218, 214]
    : kind === "BROWSER"
      ? [255, 176, 76]
      : [255, 82, 104];
  rect(buffer, PANEL.width, 0, 0, PANEL.width, 4, color);
  drawText(buffer, PANEL.width, 12, 12, kind, color, 2);
  const entry = source[sampleIndex];
  const value = kind === "NATIVE"
    ? entry.nativeAngularPathDegrees
    : kind === "BROWSER"
      ? entry.browserAngularPathDegrees
      : entry.angularPathResidualDegrees;
  const zoom = kind === "NATIVE"
    ? entry.nativeZoomRatio
    : kind === "BROWSER"
      ? entry.browserZoomRatio
      : 1 + entry.zoomRatioResidual;
  const centerX = 160;
  const centerY = 78;
  const radius = clamp(Math.round(37 * Math.sqrt(zoom)), 24, 62);
  circle(buffer, PANEL.width, centerX, centerY, radius, [44, 53, 66]);
  circle(buffer, PANEL.width, centerX, centerY, radius - 1, color);
  line(buffer, PANEL.width, centerX - radius, centerY,
    centerX + radius, centerY, [27, 34, 45]);
  line(buffer, PANEL.width, centerX, centerY - radius,
    centerX, centerY + radius, [27, 34, 45]);
  const angle = value * Math.PI / 180;
  line(buffer, PANEL.width, centerX, centerY,
    Math.round(centerX + Math.cos(angle) * (radius - 4)),
    Math.round(centerY + Math.sin(angle) * (radius - 4)), color);
  drawText(buffer, PANEL.width, 218, 24,
    `${value.toFixed(1)} DEG`, [202, 210, 222], 1);
  drawText(buffer, PANEL.width, 218, 38,
    `${entry.milliseconds.toFixed(0)} MS`, [128, 140, 158], 1);
  const graph = Object.freeze({ left: 18, top: 139, right: 302, bottom: 220 });
  rect(buffer, PANEL.width, graph.left, graph.top,
    graph.right - graph.left + 1, graph.bottom - graph.top + 1, [13, 18, 27]);
  line(buffer, PANEL.width, graph.left, graph.bottom,
    graph.right, graph.bottom, [53, 63, 79]);
  for (const time of eventTimes) {
    const x = Math.round(mix(graph.left, graph.right,
      time / source.at(-1).milliseconds));
    line(buffer, PANEL.width, x, graph.top, x, graph.bottom, [28, 38, 52]);
  }
  const points = source.slice(0, sampleIndex + 1).map((sample) => {
    const channel = kind === "NATIVE"
      ? sample.nativeAngularPathDegrees
      : kind === "BROWSER"
        ? sample.browserAngularPathDegrees
        : sample.angularPathResidualDegrees;
    return [
      Math.round(mix(graph.left, graph.right,
        sample.milliseconds / source.at(-1).milliseconds)),
      Math.round(mix(graph.bottom, graph.top, channel / maxPath)),
    ];
  });
  for (let index = 1; index < points.length; index += 1) {
    line(buffer, PANEL.width, ...points[index - 1], ...points[index], color);
  }
  const progressX = Math.round(mix(graph.left, graph.right,
    entry.milliseconds / source.at(-1).milliseconds));
  line(buffer, PANEL.width, progressX, graph.top, progressX,
    graph.bottom, [225, 231, 240]);
  return buffer;
}

function joinPanels(panels, id) {
  const buffer = Buffer.alloc(TRIPTYCH.width * TRIPTYCH.height * 3);
  fill(buffer, TRIPTYCH.width, TRIPTYCH.height, [4, 6, 10]);
  for (let panelIndex = 0; panelIndex < panels.length; panelIndex += 1) {
    for (let y = 0; y < PANEL.height; y += 1) {
      const sourceOffset = y * PANEL.width * 3;
      const targetOffset = ((y + 20) * TRIPTYCH.width +
        panelIndex * PANEL.width) * 3;
      panels[panelIndex].copy(
        buffer,
        targetOffset,
        sourceOffset,
        sourceOffset + PANEL.width * 3,
      );
    }
  }
  drawText(
    buffer,
    TRIPTYCH.width,
    10,
    6,
    id.replaceAll("training-", "").toUpperCase(),
    [186, 197, 214],
    1,
  );
  return buffer;
}

async function makeContactSheet(comparisons, path) {
  const rows = [];
  for (const comparison of comparisons) {
    rows.push(await sharp(comparison.visual.timelinePath)
      .resize({ width: 720 })
      .png()
      .toBuffer());
  }
  await sharp({
    create: {
      width: 720,
      height: rows.length * 195,
      channels: 3,
      background: { r: 4, g: 6, b: 10 },
    },
  }).composite(rows.map((input, index) => ({
    input,
    top: index * 195,
    left: 0,
  }))).png().toFile(path);
}

async function encodeVideo(frames, output) {
  await execFile("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-framerate", String(FRAME_RATE),
    "-i", resolve(frames, "frame_%04d.png"),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", output,
  ], { maxBuffer: 16 * 1024 * 1024 });
}

async function writeRgbPng(path, data, { width, height }) {
  await sharp(data, { raw: { width, height, channels: 3 } })
    .png({ compressionLevel: 6 })
    .toFile(path);
}

function rotationDifferenceDegrees(first, second) {
  const left = rotation3(first);
  const right = transpose3(rotation3(second));
  const relative = multiply3(left, right);
  const cosine = clamp(
    (relative[0][0] + relative[1][1] + relative[2][2] - 1) / 2,
    -1,
    1,
  );
  return Math.acos(cosine) * 180 / Math.PI;
}

function rotation3(matrix) {
  const rows = [
    [matrix[0], matrix[4], matrix[8]],
    [matrix[1], matrix[5], matrix[9]],
    [matrix[2], matrix[6], matrix[10]],
  ];
  return rows.map((row) => {
    const length = Math.hypot(...row);
    return row.map((value) => value / length);
  });
}

function multiply3(first, second) {
  return first.map((row) => row.map((_, column) =>
    row.reduce((sum, value, index) =>
      sum + value * second[index][column], 0)));
}

function transpose3(matrix) {
  return matrix[0].map((_, column) => matrix.map((row) => row[column]));
}

function rowsToCsv(rows) {
  const headers = Object.keys(rows[0]);
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) =>
    row[header]).join(",")).join("\n")}\n`;
}

function fill(buffer, width, height, color) {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) pixel(buffer, width, x, y, color);
  }
}

function rect(buffer, width, x, y, rectangleWidth, rectangleHeight, color) {
  for (let row = y; row < y + rectangleHeight; row += 1) {
    for (let column = x; column < x + rectangleWidth; column += 1) {
      pixel(buffer, width, column, row, color);
    }
  }
}

function line(buffer, width, x0, y0, x1, y1, color) {
  let currentX = x0;
  let currentY = y0;
  const deltaX = Math.abs(x1 - x0);
  const stepX = x0 < x1 ? 1 : -1;
  const deltaY = -Math.abs(y1 - y0);
  const stepY = y0 < y1 ? 1 : -1;
  let error = deltaX + deltaY;
  while (true) {
    pixel(buffer, width, currentX, currentY, color);
    if (currentX === x1 && currentY === y1) break;
    const twice = 2 * error;
    if (twice >= deltaY) {
      error += deltaY;
      currentX += stepX;
    }
    if (twice <= deltaX) {
      error += deltaX;
      currentY += stepY;
    }
  }
}

function circle(buffer, width, centerX, centerY, radius, color) {
  let x = radius;
  let y = 0;
  let error = 0;
  while (x >= y) {
    for (const [offsetX, offsetY] of [
      [x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x],
      [y, -x], [x, -y],
    ]) pixel(buffer, width, centerX + offsetX, centerY + offsetY, color);
    y += 1;
    if (error <= 0) error += 2 * y + 1;
    if (error > 0) {
      x -= 1;
      error -= 2 * x + 1;
    }
  }
}

function pixel(buffer, width, x, y, color) {
  if (x < 0 || y < 0 || x >= width || y >= buffer.length / 3 / width) return;
  const offset = (Math.round(y) * width + Math.round(x)) * 3;
  buffer[offset] = color[0];
  buffer[offset + 1] = color[1];
  buffer[offset + 2] = color[2];
}

const FONT = Object.freeze({
  " ": ["000", "000", "000", "000", "000"],
  "-": ["000", "000", "111", "000", "000"],
  ".": ["000", "000", "000", "000", "010"],
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  A: ["010", "101", "111", "101", "101"],
  B: ["110", "101", "110", "101", "110"],
  C: ["111", "100", "100", "100", "111"],
  D: ["110", "101", "101", "101", "110"],
  E: ["111", "100", "110", "100", "111"],
  F: ["111", "100", "110", "100", "100"],
  G: ["111", "100", "101", "101", "111"],
  H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"],
  J: ["001", "001", "001", "101", "111"],
  K: ["101", "101", "110", "101", "101"],
  L: ["100", "100", "100", "100", "111"],
  M: ["101", "111", "111", "101", "101"],
  N: ["101", "111", "111", "111", "101"],
  O: ["111", "101", "101", "101", "111"],
  P: ["111", "101", "111", "100", "100"],
  Q: ["111", "101", "101", "111", "001"],
  R: ["110", "101", "110", "101", "101"],
  S: ["111", "100", "111", "001", "111"],
  T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "111"],
  V: ["101", "101", "101", "101", "010"],
  W: ["101", "101", "111", "111", "101"],
  X: ["101", "101", "010", "101", "101"],
  Y: ["101", "101", "010", "010", "010"],
  Z: ["111", "001", "010", "100", "111"],
});

function drawText(buffer, width, x, y, text, color, scale) {
  let cursor = x;
  for (const character of text) {
    const glyph = FONT[character] ?? FONT[" "];
    for (let row = 0; row < glyph.length; row += 1) {
      for (let column = 0; column < glyph[row].length; column += 1) {
        if (glyph[row][column] !== "1") continue;
        rect(buffer, width, cursor + column * scale, y + row * scale,
          scale, scale, color);
      }
    }
    cursor += 4 * scale;
  }
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maximum(values) {
  return Math.max(...values);
}

function percentile(values, fraction) {
  const sorted = [...values].sort((first, second) => first - second);
  return sorted[Math.min(sorted.length - 1,
    Math.floor(sorted.length * fraction))];
}

function mix(first, second, progress) {
  return first + (second - first) * progress;
}

function clamp(value, minimum, maximumValue) {
  return Math.max(minimum, Math.min(maximumValue, value));
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function parseArguments(args) {
  const parsed = { native: null, browser: null, output: null };
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--native") parsed.native = args[++index];
    else if (value === "--browser") parsed.browser = args[++index];
    else if (value === "--output") parsed.output = args[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!parsed.native || !parsed.browser || !parsed.output) {
    throw new Error("--native, --browser, and --output are required.");
  }
  return Object.freeze(parsed);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

await main();
