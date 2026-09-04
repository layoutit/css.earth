import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile, execFileSync } from "node:child_process";
import {
  access,
  mkdir,
  open,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

import sharp from "sharp";

import {
  getViewInfo,
  saveScreenShot,
  setViewInfo,
  waitForStreaming,
} from "./controller.mjs";
import { loadInteractionCorpus } from "./interaction-corpus.mjs";
import {
  decodeNativeMotionTrace,
  matrixMaximumError,
  nativeScenarioTrace,
} from "./native-motion-trace-reader.mjs";
import { nativeInteractionScenarios } from "./native-interaction-driver.mjs";

const execFileAsync = promisify(execFile);
const workspaceRoot = resolve(import.meta.dirname, "../../../../../..");
const evidenceRoot = resolve(
  workspaceRoot,
  "output/playwright/google-earth-pro-mars-interaction-video-v1",
);
const options = parseArguments(process.argv.slice(2));
const outputRoot = resolve(options.output);
const reportPath = resolve(outputRoot, "report.json");
const launchScript = resolve(import.meta.dirname, "launch-headless.mjs");
const calibrationMapScript = resolve(
  import.meta.dirname,
  "prepare-google-calibration-map.mjs",
);
const calibrationVerificationScript = resolve(
  import.meta.dirname,
  "prepare-calibration-surface.mjs",
);
const appPath = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/interaction-video/" +
    "Google Earth Pro Mars Oracle.app",
);
const executablePath = resolve(appPath, "Contents/MacOS/Google Earth");
const windowAuditPath = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/interaction-video/window-audit",
);
const bundleIdentifier =
  "dev.polycss.GoogleEarthProMarsInteractionVideoOracle";
const appName = `id:${bundleIdentifier}`;
const layerManifestPath = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/layer-oracles/manifest.json",
);
const cacheIndexPath = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/calibration/google-cache-index.json",
);
const calibrationManifestPath = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/calibration/manifest.json",
);
const nativeRegistrationPath = resolve(
  evidenceRoot,
  "native-registration/registration.json",
);
const browserRegistrationPath = resolve(
  evidenceRoot,
  "browser-registration/registration.json",
);
const provenCacheTransformKeyPath = resolve(
  evidenceRoot,
  "native-registration/mapping/cache-transform-key.bin",
);
const corpusPath = resolve(
  import.meta.dirname,
  "interaction-corpus-v1.json",
);
const repeatabilityThresholds = Object.freeze({
  maximumMatrixElementAbsoluteError: 0.05,
  maximumEndpointAngularDegrees: 0.01,
  maximumEndpointDistanceMeters: 10_000,
  maximumInstrumentationMilliseconds: 50,
});
const nativeViewportContract = Object.freeze({
  content: Object.freeze({ width: 1728, height: 959 }),
  scene: Object.freeze({ width: 1408, height: 959 }),
  sceneOffset: Object.freeze({ x: 320, y: 0 }),
  authority:
    "B4 configured Google window content minus the 1408x959 SaveScreenShot scene",
});
const auditPoses = Object.freeze([
  camera(0, 0, 11_000_000),
  camera(0, 90, 11_000_000),
  camera(0, 179, 11_000_000),
  camera(0, -179, 11_000_000),
  camera(45, 0, 11_000_000),
  camera(-45, 90, 11_000_000),
  camera(75, -135, 11_000_000),
  camera(-75, 135, 11_000_000),
  camera(89, 0, 11_000_000),
  camera(-89, 0, 11_000_000),
  camera(20, 45, 8_500_000),
  camera(-20, -45, 16_000_000),
]);

if (options.set !== "training" || options.repeat !== 3) {
  throw new Error(
    "This evidence contract requires --set training --repeat 3.",
  );
}
assertSafeOutputRoot(outputRoot);
await Promise.all([
  access(executablePath),
  access(windowAuditPath),
  access(layerManifestPath),
  access(cacheIndexPath),
  access(nativeRegistrationPath),
  access(browserRegistrationPath),
  access(provenCacheTransformKeyPath),
]);
const [
  layerManifest,
  calibrationManifest,
  nativeRegistration,
  browserRegistration,
  corpusBytes,
] = await Promise.all([
  readJson(layerManifestPath),
  readJson(calibrationManifestPath),
  readJson(nativeRegistrationPath),
  readJson(browserRegistrationPath),
  readFile(corpusPath),
]);
assert.equal(
  nativeRegistration.qualification,
  "NATIVE_GOOGLE_GEOMETRY_CALIBRATION_REGISTRATION_PROVEN",
);
assert.equal(
  browserRegistration.qualification,
  "BROWSER_RETAINED_CALIBRATION_REGISTRATION_PROVEN",
);
assert.equal(
  calibrationManifest.source.decodedRgbaSha256,
  nativeRegistration.calibration.sourceDecodedRgbaSha256,
);
const calibrationVerification = JSON.parse((await execFileAsync(
  process.execPath,
  [calibrationVerificationScript, "--verify"],
  { cwd: workspaceRoot, maxBuffer: 16 * 1024 * 1024 },
)).stdout);
assert.equal(
  calibrationVerification.sourceDecodedRgbaSha256,
  calibrationManifest.source.decodedRgbaSha256,
);
const corpus = await loadInteractionCorpus({ set: options.set });
const nativeDensity = browserRegistration.densities.find(
  ({ density }) => density === 1,
);
assert.ok(nativeDensity);
const geometryFor = (scenario) => {
  const capture = nativeDensity.captures.find(({ nativeCamera }) =>
    sameCamera(nativeCamera, scenario.startCamera));
  assert.ok(capture, `${scenario.id}: no measured native disc`);
  return Object.freeze({
    viewport: nativeViewportContract.content,
    crop: Object.freeze({
      ...browserRegistration.crop,
      left: nativeViewportContract.sceneOffset.x +
        browserRegistration.crop.left,
    }),
    disc: capture.nativeDisc,
  });
};
const driverScenarios = await nativeInteractionScenarios({
  set: options.set,
  geometryFor,
});
assert.deepEqual(
  driverScenarios.map(({ scenario }) => scenario.id),
  corpus.scenarios.map(({ id }) => id),
);

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
const runs = [];
for (let repeat = 1; repeat <= options.repeat; repeat += 1) {
  runs.push(await captureRepeat({
    repeat,
    captureVisualReplay: repeat === options.repeat,
  }));
}

const scenarioQualifications = qualifyScenarios(runs);
const gates = Object.freeze({
  requestedSetCaptured: options.set === "training" &&
    driverScenarios.length === corpus.scenarios.length,
  requestedRepeatCountCaptured: runs.length === options.repeat,
  allProcessesHeadless: runs.every(({ headless }) =>
    headless.every(({ audit }) => audit.visibleWindowCount === 0 &&
      audit.frontmostApplication?.pid !== audit.oraclePid)),
  everyFreshProcessReaped: runs.every(({ process }) => process.reaped),
  allInputsAcceptedAndDelivered: runs.every(({ scenarios }) =>
    scenarios.every(({ input }) =>
      input.acceptedCount === input.requestedCount &&
      input.deliveredCount === input.requestedCount &&
      input.rejectedCount === 0)),
  allSourceTimestampsBound: runs.every(({ scenarios }) =>
    scenarios.every(({ input }) => input.records
      .filter(({ event }) => event === "native-input-posted")
      .every(({ sourceMonotonicSeconds }) =>
        Number.isFinite(sourceMonotonicSeconds)))),
  allFrameSequencesComplete: runs.every(({ scenarios }) =>
    scenarios.every(({ trace }) =>
      trace.frameCount > 0 && trace.frameSequenceGapCount === 0)),
  noInstrumentationLongTask: runs.every(({ scenarios }) =>
    scenarios.every(({ trace }) =>
      trace.instrumentation.maximumMilliseconds <
        repeatabilityThresholds.maximumInstrumentationMilliseconds)),
  timingRunsExcludeCalibrationHook: runs.every(({ timing }) =>
    timing.calibrationHookAttached === false),
  calibrationBoundAfterTiming: runs.at(-1).calibration !== null &&
    runs.at(-1).calibration.mappingCount > 0 &&
    runs.at(-1).calibration.bindingCount > 0,
  visualReplayCapturedAfterTiming: runs.at(-1).visualReplay !== null &&
    runs.at(-1).visualReplay.scenarios.every(({ frames }) =>
      frames.length === 4),
  repeatabilityEvaluatedForEveryScenario:
    scenarioQualifications.length === driverScenarios.length,
  stableBaselineSubsetAvailable: scenarioQualifications.filter(
    ({ id, qualification }) => id.includes("baseline") &&
      qualification === "VALID_FOR_FITTING",
  ).length >= 3,
  stableInterruptionTrajectorySubsetAvailable: scenarioQualifications.filter(
    ({ id, trajectoryRepeatable }) => !id.includes("baseline") &&
      trajectoryRepeatable,
  ).length >= 2,
  unstableComponentsExplicitlyExcluded: scenarioQualifications.every(
    ({ qualification, trajectoryRepeatable, settledEndpointRepeatable }) =>
      qualification === "VALID_FOR_FITTING"
        ? trajectoryRepeatable && settledEndpointRepeatable
        : qualification ===
            "VALID_FOR_TRAJECTORY_FITTING_ENDPOINT_EXCLUDED"
          ? trajectoryRepeatable && !settledEndpointRepeatable
          : !trajectoryRepeatable,
  ),
});
const qualification = Object.values(gates).every(Boolean)
  ? "NATIVE_TRAINING_INTERACTION_CORPUS_PROVEN_WITH_DECLARED_EXCLUSIONS"
  : "INVALID_NATIVE_TRAINING_CORPUS_GATE_FAILED";
const report = Object.freeze({
  schema: "cssmars-google-earth-native-interaction-corpus@1",
  qualification,
  generatedAt: new Date().toISOString(),
  application: Object.freeze({
    appPath,
    executablePath,
    executableSha256: sha256(await readFile(executablePath)),
    rendererSha256:
      "11c6efe1ea0a75535485ab3804a09fc6f2ad3dd7c43f8c7d695a48d928890cd0",
    bundleIdentifier,
    launchArgument: "-multiple",
    viewportContract: nativeViewportContract,
  }),
  corpus: Object.freeze({
    path: corpusPath,
    sha256: sha256(corpusBytes),
    set: options.set,
    scenarioCount: corpus.scenarios.length,
    repeatCount: options.repeat,
  }),
  calibration: Object.freeze({
    decodedRgbaSha256: calibrationManifest.source.decodedRgbaSha256,
    nativeRegistration: nativeRegistrationPath,
    binding:
      "Authoritative timing runs exclude the calibration layer hook. The exact cache-addressed DXT1 mapping and calibration screenshots are installed only after every timing scenario in the final repeat.",
  }),
  traceContract: Object.freeze({
    authority: "native frame-synchronous OpenGL present records",
    timingClock: "mach monotonic time converted by recorded timebase",
    visualReplayAuthority: false,
    visualReplayPurpose:
      "Reviewable calibration frames only; screenshot work is excluded from timing and fit.",
    repeatabilityThresholds,
  }),
  gates,
  scenarioQualifications,
  runs: runs.map(summarizeRun),
});
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  qualification,
  reportPath,
  gates,
  scenarioQualifications,
}, null, 2)}\n`);
if (qualification.startsWith("INVALID")) process.exitCode = 1;

async function captureRepeat({ repeat, captureVisualReplay }) {
  const runRoot = resolve(outputRoot, `repeat-${pad(repeat)}`);
  const launchRoot = resolve(runRoot, "launch");
  const inputPath = resolve(runRoot, "input-control.json");
  const tracePath = resolve(runRoot, "frames.bin");
  const layerRoot = resolve(runRoot, "calibration-binding");
  const rawRoot = resolve(layerRoot, "google-rgba");
  const mappingRoot = resolve(layerRoot, "mapping");
  const mappingPath = resolve(mappingRoot, "texture-map.tsv");
  const layerControlPath = resolve(layerRoot, "mode.bin");
  const layerAuditPath = resolve(layerRoot, "programs.tsv");
  const controlLogPath = resolve(layerRoot, "control.tsv");
  const installLogPath = resolve(layerRoot, "install.tsv");
  const drawAuditPath = resolve(layerRoot, "draws.jsonl");
  const bindingLogPath = resolve(layerRoot, "bindings.jsonl");
  await Promise.all([
    mkdir(launchRoot, { recursive: true }),
    mkdir(rawRoot, { recursive: true }),
    mkdir(mappingRoot, { recursive: true }),
  ]);
  await writeInputControl(inputPath, 0, []);
  await writeLayerControl(layerControlPath, {
    mode: "cal-audit",
    atmosphere: false,
    sun: false,
    revision: 1,
  });
  await writeFile(mappingPath, "");
  const provenCacheTransformKey = await readFile(
    provenCacheTransformKeyPath,
  );
  assert.equal(
    sha256(provenCacheTransformKey),
    "f85c2c79f9dc4cbff876e6d943bcb52578f59f0a890040e7b7333f02b6f7d936",
  );
  await writeFile(
    resolve(mappingRoot, "cache-transform-key.bin"),
    provenCacheTransformKey,
  );
  const processPreflight = await assertNoLiveOracleProcesses();
  let oraclePid = null;
  let termination = null;
  const headless = [];
  const measured = [];
  let visualReplay = null;
  let calibration = null;
  try {
    const launchResult = await execFileAsync(process.execPath, [
      launchScript,
      launchRoot,
    ], {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        CSSMARS_ORACLE_INPUT_FILE: inputPath,
        CSSMARS_ORACLE_MOTION_TRACE: tracePath,
        CSSMARS_ORACLE_MOTION_TRACE_DETAIL: "full",
        CSSMARS_ORACLE_ATMOSPHERE: "off",
        CSSMARS_ORACLE_SUN: "off",
        CSSMARS_ORACLE_CONTENT_WIDTH:
          String(nativeViewportContract.content.width),
        CSSMARS_ORACLE_CONTENT_HEIGHT:
          String(nativeViewportContract.content.height),
        CSSMARS_GOOGLE_EARTH_APP_PATH: appPath,
        CSSMARS_GOOGLE_EARTH_WINDOW_AUDIT: windowAuditPath,
      },
      maxBuffer: 4 * 1024 * 1024,
    });
    const launch = JSON.parse(launchResult.stdout);
    oraclePid = launch.pid;
    await waitForEvent(
      launchRoot,
      (event) => event.event === "ready",
      60_000,
    );
    await waitForEvent(
      launchRoot,
      (event) => event.event === "native-input-control-ready",
      60_000,
    );
    headless.push(headlessRecord(oraclePid, `repeat-${repeat}-ready`));
    for (let index = 0; index < driverScenarios.length; index += 1) {
      const entry = driverScenarios[index];
      const revision = 100 + index * 100;
      measured.push(await runMeasuredScenario({
        entry,
        revision,
        inputPath,
        launchRoot,
        oraclePid,
      }));
      process.stdout.write(`${JSON.stringify({
        event: "native-timing-scenario-complete",
        repeat,
        scenario: entry.scenario.id,
      })}\n`);
    }
    if (captureVisualReplay) {
      const mapping = await prepareCalibrationBinding({
        oraclePid,
        layerControlPath,
        layerAuditPath,
        controlLogPath,
        installLogPath,
        drawAuditPath,
        rawRoot,
        mappingRoot,
        mappingPath,
        bindingLogPath,
      });
      visualReplay = await captureVisualReplays({
        runRoot,
        inputPath,
        launchRoot,
        oraclePid,
      });
      const bindings = await readJsonLines(bindingLogPath);
      calibration = Object.freeze({
        mappingCount: mapping.mappingCount,
        mappingReportPath: mapping.reportPath,
        mappingSha256: sha256(await readFile(mapping.reportPath)),
        bindingLogPath,
        bindingCount: bindings.filter(({ mapped }) => mapped).length,
        sourceDecodedRgbaSha256:
          calibrationManifest.source.decodedRgbaSha256,
        installedAfterTiming: true,
      });
    }
    headless.push(headlessRecord(oraclePid, `repeat-${repeat}-complete`));
    termination = await requestGracefulExit({
      inputPath,
      launchRoot,
      pid: oraclePid,
    });
    const allEvents = await readEvents(launchRoot);
    const traceBytes = await readFile(tracePath);
    const decoded = decodeNativeMotionTrace(traceBytes);
    const scenarios = [];
    for (const measurement of measured) {
      const trace = nativeScenarioTrace({
        decoded,
        events: allEvents,
        revision: measurement.revision,
        revisions: measurement.revisions,
        tailMs: measurement.traceTailMilliseconds,
      });
      const traceRoot = resolve(
        runRoot,
        "scenarios",
        measurement.id,
      );
      await mkdir(traceRoot, { recursive: true });
      const traceJsonPath = resolve(traceRoot, "trace.json");
      await writeFile(traceJsonPath, `${JSON.stringify(trace, null, 2)}\n`);
      const revisionEvents = allEvents.filter(({ revision }) =>
        measurement.revisions.includes(revision));
      const input = summarizeInput(
        measurement.requestedEvents,
        measurement.revisions,
        revisionEvents,
      );
      scenarios.push(Object.freeze({
        ...measurement,
        input,
        trace: Object.freeze({
          path: traceJsonPath,
          sha256: sha256(await readFile(traceJsonPath)),
          rawTracePath: tracePath,
          rawTraceSha256: sha256(traceBytes),
          frameCount: trace.frameCount,
          frameSequenceGapCount: frameSequenceGapCount(trace.frames),
          sampleFrames: trace.sampleFrames,
          expectedCameraInputSerials: trace.expectedCameraInputSerials,
          missingCameraInputSerials: trace.missingCameraInputSerials,
          cadence: trace.cadence,
          instrumentation: trace.instrumentation,
        }),
      }));
    }
    const run = Object.freeze({
      repeat,
      runRoot,
      process: Object.freeze({
        pid: oraclePid,
        executablePath,
        executableSha256: sha256(await readFile(executablePath)),
        preflight: processPreflight,
        termination,
        reaped: !processExists(oraclePid),
      }),
      headless: Object.freeze(headless),
      timing: Object.freeze({ calibrationHookAttached: false }),
      calibration,
      trace: Object.freeze({
        path: tracePath,
        bytes: traceBytes.length,
        sha256: sha256(traceBytes),
        header: decoded.header,
        frameCount: decoded.frames.length,
      }),
      scenarios: Object.freeze(scenarios),
      visualReplay,
    });
    await writeFile(
      resolve(runRoot, "run-summary.json"),
      `${JSON.stringify(summarizeRun(run), null, 2)}\n`,
    );
    return run;
  } finally {
    if (oraclePid !== null && processExists(oraclePid)) {
      await requestGracefulExit({ inputPath, launchRoot, pid: oraclePid });
    }
  }
}

async function runMeasuredScenario({
  entry,
  revision,
  inputPath,
  launchRoot,
  oraclePid,
}) {
  await setViewInfo({ ...entry.scenario.startCamera, speed: 10, appName });
  await waitForStreaming({
    appName,
    timeoutMilliseconds: 30_000,
    intervalMilliseconds: 200,
    stableReadings: 5,
  });
  await waitForStableCamera();
  await delay(250);
  const before = await getViewInfo({ appName });
  const revisions = Object.freeze([revision]);
  const started = process.hrtime.bigint();
  await writeInputControl(
    inputPath,
    revision,
    entry.events.map((event) => ({
      ...event,
      sourceOffsetMilliseconds: event.atMilliseconds,
    })),
  );
  await waitForRevisionDelivered(
    launchRoot,
    revision,
    entry.events.map(({ id }) => id),
  );
  const after = await waitForStableCamera();
  const settlementMilliseconds =
    Number(process.hrtime.bigint() - started) / 1e6;
  const traceTailMilliseconds = Math.max(
    1600,
    Math.ceil(
      settlementMilliseconds - entry.events.at(-1).atMilliseconds + 250,
    ),
  );
  const audit = headlessRecord(oraclePid, entry.scenario.id);
  return Object.freeze({
    id: entry.scenario.id,
    revision,
    revisions,
    startCamera: entry.scenario.startCamera,
    tags: entry.scenario.tags,
    expectedMeasuredOutputs: entry.scenario.expectedMeasuredOutputs,
    requestedEvents: entry.events,
    settlementMilliseconds,
    traceTailMilliseconds,
    before,
    after,
    cameraDelta: numericDelta(before, after),
    headless: audit,
  });
}

async function captureVisualReplays({
  runRoot,
  inputPath,
  launchRoot,
  oraclePid,
}) {
  const visualRoot = resolve(runRoot, "visual-replay");
  await mkdir(visualRoot, { recursive: true });
  const scenarios = [];
  for (let index = 0; index < driverScenarios.length; index += 1) {
    const entry = driverScenarios[index];
    const revision = 2000 + index;
    const scenarioRoot = resolve(visualRoot, entry.scenario.id);
    await mkdir(scenarioRoot, { recursive: true });
    await setViewInfo({ ...entry.scenario.startCamera, speed: 10, appName });
    await waitForStableCamera();
    await delay(200);
    const finalInputOffset = entry.events.at(-1).atMilliseconds;
    const finalOffset = Math.ceil((finalInputOffset + 1600) / 100) * 100;
    const targets = Object.freeze([
      0,
      finalInputOffset,
      Math.min(finalOffset, finalInputOffset + 650),
      finalOffset,
    ]);
    const frames = [];
    const initial = await captureVisualFrame({
      scenarioRoot,
      index: 0,
      targetMilliseconds: 0,
      actualMilliseconds: 0,
    });
    frames.push(initial);
    const started = process.hrtime.bigint();
    await writeInputControl(inputPath, revision, entry.events);
    await waitForEvent(launchRoot, (event) =>
      event.event === "native-input-batch-accepted" &&
      event.revision === revision);
    for (let targetIndex = 1; targetIndex < targets.length;
      targetIndex += 1) {
      const targetMilliseconds = targets[targetIndex];
      const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
      if (elapsed < targetMilliseconds) {
        await delay(targetMilliseconds - elapsed);
      }
      const actualMilliseconds = Number(
        process.hrtime.bigint() - started,
      ) / 1e6;
      frames.push(await captureVisualFrame({
        scenarioRoot,
        index: targetIndex,
        targetMilliseconds,
        actualMilliseconds,
      }));
    }
    await waitForRevisionDelivered(
      launchRoot,
      revision,
      entry.events.map(({ id }) => id),
    );
    const audit = headlessRecord(
      oraclePid,
      `${entry.scenario.id}-visual-replay`,
    );
    scenarios.push(Object.freeze({
      id: entry.scenario.id,
      revision,
      authority: "NON_TIMING_VISUAL_REPLAY",
      audit,
      frames: Object.freeze(frames),
    }));
    process.stdout.write(`${JSON.stringify({
      event: "native-visual-replay-complete",
      scenario: entry.scenario.id,
      frameCount: frames.length,
    })}\n`);
  }
  const manifestPath = resolve(visualRoot, "manifest.json");
  const manifest = Object.freeze({
    schema: "cssmars-native-calibration-visual-replay@1",
    qualification: "NON_TIMING_VISUAL_REPLAY",
    keyframeOffsets:
      "scenario start, final input, 650 ms after final input, and 1600 ms tail",
    scenarios: Object.freeze(scenarios),
  });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return Object.freeze({
    manifestPath,
    manifestSha256: sha256(await readFile(manifestPath)),
    scenarios: manifest.scenarios,
  });

  async function captureVisualFrame({
    scenarioRoot,
    index,
    targetMilliseconds,
    actualMilliseconds,
  }) {
    const basename = resolve(scenarioRoot, `frame-${padFrame(index)}`);
    const raw = await saveScreenShot({ path: basename, appName });
    const path = `${basename}.png`;
    await cropNativeScreenshot(raw.path, path);
    return Object.freeze({
      index,
      targetMilliseconds,
      actualMilliseconds,
      path,
      sha256: sha256(await readFile(path)),
    });
  }
}

function qualifyScenarios(runs) {
  return driverScenarios.map(({ scenario }) => {
    const entries = runs.map((run) => run.scenarios.find(({ id }) =>
      id === scenario.id));
    assert.ok(entries.every(Boolean));
    let maximumMatrixElementAbsoluteError = 0;
    for (let repeatIndex = 1; repeatIndex < entries.length;
      repeatIndex += 1) {
      const reference = entries[0].trace.sampleFrames;
      const candidate = entries[repeatIndex].trace.sampleFrames;
      const sampleCount = Math.min(reference.length, candidate.length);
      for (let index = 0; index < sampleCount; index += 1) {
        maximumMatrixElementAbsoluteError = Math.max(
          maximumMatrixElementAbsoluteError,
          matrixMaximumError(
            reference[index].modelViewMatrix,
            candidate[index].modelViewMatrix,
          ),
          matrixMaximumError(
            reference[index].projectionMatrix,
            candidate[index].projectionMatrix,
          ),
        );
      }
    }
    let maximumEndpointAngularDegrees = 0;
    let maximumEndpointDistanceMeters = 0;
    for (let first = 0; first < entries.length; first += 1) {
      for (let second = first + 1; second < entries.length; second += 1) {
        maximumEndpointAngularDegrees = Math.max(
          maximumEndpointAngularDegrees,
          Math.abs(entries[first].after.latitude -
            entries[second].after.latitude),
          longitudeDistance(
            entries[first].after.longitude,
            entries[second].after.longitude,
          ),
        );
        maximumEndpointDistanceMeters = Math.max(
          maximumEndpointDistanceMeters,
          Math.abs(entries[first].after.distance -
            entries[second].after.distance),
        );
      }
    }
    const inputComplete = entries.every(({ input }) =>
      input.acceptedCount === input.requestedCount &&
      input.deliveredCount === input.requestedCount &&
      input.rejectedCount === 0);
    const frameComplete = entries.every(({ trace }) =>
      trace.frameCount > 0 && trace.frameSequenceGapCount === 0);
    const trajectoryRepeatable = maximumMatrixElementAbsoluteError <=
      repeatabilityThresholds.maximumMatrixElementAbsoluteError;
    const settledEndpointRepeatable = maximumEndpointAngularDegrees <=
        repeatabilityThresholds.maximumEndpointAngularDegrees &&
      maximumEndpointDistanceMeters <=
        repeatabilityThresholds.maximumEndpointDistanceMeters;
    const qualification = inputComplete && frameComplete
      ? trajectoryRepeatable && settledEndpointRepeatable
        ? "VALID_FOR_FITTING"
        : trajectoryRepeatable
          ? "VALID_FOR_TRAJECTORY_FITTING_ENDPOINT_EXCLUDED"
          : "INVALID_EXCLUDED_FROM_FITTING"
      : "INVALID_EXCLUDED_FROM_FITTING";
    return Object.freeze({
      id: scenario.id,
      qualification,
      inputComplete,
      frameComplete,
      repeatable: trajectoryRepeatable && settledEndpointRepeatable,
      trajectoryRepeatable,
      settledEndpointRepeatable,
      maximumMatrixElementAbsoluteError,
      maximumEndpointAngularDegrees,
      maximumEndpointDistanceMeters,
      thresholds: repeatabilityThresholds,
    });
  });
}

function summarizeInput(requested, revisions, recorded) {
  const accepted = recorded.filter(({ event }) =>
    event === "native-input-accepted");
  const posted = recorded.filter(({ event }) =>
    event === "native-input-posted");
  const rejected = recorded.filter(({ event }) =>
    event === "native-input-rejected");
  const firstAccepted = accepted[0]?.acceptedMonotonicSeconds ?? null;
  const sourceTimelineLags = accepted.map((event) => {
    const requestedEvent = requested.find(({ id }) => id === event.id);
    return requestedEvent && firstAccepted !== null
      ? (event.acceptedMonotonicSeconds - firstAccepted) * 1000 -
        requestedEvent.atMilliseconds
      : null;
  }).filter(Number.isFinite);
  return Object.freeze({
    requestedCount: requested.length,
    acceptedCount: accepted.length,
    postedCount: posted.length,
    deliveredCount: posted.filter(({ delivered }) => delivered).length,
    rejectedCount: rejected.length,
    revisions: Object.freeze([...revisions]),
    deliveryContract:
      "Each complete scenario is accepted once and scheduled from one monotonic origin; accepted handler-entry timestamps prove the realized event timing.",
    maximumAbsoluteSourceTimelineLagMilliseconds:
      sourceTimelineLags.length === 0
      ? null
      : Math.max(...sourceTimelineLags.map(Math.abs)),
    records: Object.freeze(recorded),
  });
}

function summarizeRun(run) {
  return Object.freeze({
    repeat: run.repeat,
    runRoot: run.runRoot,
    process: run.process,
    headless: run.headless,
    timing: run.timing,
    calibration: run.calibration,
    trace: run.trace,
    scenarios: run.scenarios.map((scenario) => Object.freeze({
      id: scenario.id,
      revision: scenario.revision,
      startCamera: scenario.startCamera,
      tags: scenario.tags,
      before: scenario.before,
      after: scenario.after,
      cameraDelta: scenario.cameraDelta,
      settlementMilliseconds: scenario.settlementMilliseconds,
      traceTailMilliseconds: scenario.traceTailMilliseconds,
      headless: scenario.headless,
      input: scenario.input,
      trace: scenario.trace,
    })),
    visualReplay: run.visualReplay,
  });
}

async function prepareCalibrationBinding({
  oraclePid,
  layerControlPath,
  layerAuditPath,
  controlLogPath,
  installLogPath,
  drawAuditPath,
  rawRoot,
  mappingRoot,
  mappingPath,
  bindingLogPath,
}) {
  attachLayerHook({
    pid: oraclePid,
    hookPath: layerManifest.hook.path,
    layerControlPath,
    layerAuditPath,
    controlLogPath,
    installLogPath,
    drawAuditPath,
    rawRoot,
    mappingPath,
    bindingLogPath,
  });
  await waitForHookInstallation({
    pid: oraclePid,
    hookPath: layerManifest.hook.path,
    installLogPath,
  });
  await waitForLayerControl(controlLogPath, 1);
  for (const pose of auditPoses) {
    await setViewInfo({ ...pose, speed: 10, appName });
    await waitForStableCamera();
    await delay(350);
  }
  await waitForFile(drawAuditPath);
  const mapping = JSON.parse((await execFileAsync(process.execPath, [
    calibrationMapScript,
    "--audit",
    drawAuditPath,
    "--output",
    mappingRoot,
    "--cache-index",
    cacheIndexPath,
    "--revision",
    "1",
  ], {
    cwd: workspaceRoot,
    maxBuffer: 16 * 1024 * 1024,
  })).stdout);
  assert.ok(mapping.ok && mapping.mappingCount > 0);
  await writeLayerControl(layerControlPath, {
    mode: "cal",
    atmosphere: false,
    sun: false,
    revision: 2,
  });
  await waitForLayerControl(controlLogPath, 2);
  await delay(350);
  return mapping;
}

function attachLayerHook({
  pid,
  hookPath,
  layerControlPath,
  layerAuditPath,
  controlLogPath,
  installLogPath,
  drawAuditPath,
  rawRoot,
  mappingPath,
  bindingLogPath,
}) {
  execFileSync("/usr/bin/lldb", [
    "-b",
    "-p",
    String(pid),
    "-o",
    lldbSetEnvironment("CSSMARS_ORACLE_LAYER_MODE_FILE", layerControlPath),
    "-o",
    lldbSetEnvironment("CSSMARS_ORACLE_LAYER_AUDIT_LOG", layerAuditPath),
    "-o",
    lldbSetEnvironment("CSSMARS_ORACLE_LAYER_INSTALL_LOG", installLogPath),
    "-o",
    lldbSetEnvironment("CSSMARS_ORACLE_LAYER_CONTROL_LOG", controlLogPath),
    "-o",
    lldbSetEnvironment("CSSMARS_ORACLE_CALIBRATION_AUDIT_LOG", drawAuditPath),
    "-o",
    lldbSetEnvironment("CSSMARS_ORACLE_CALIBRATION_DUMP_DIR", rawRoot),
    "-o",
    lldbSetEnvironment("CSSMARS_ORACLE_CALIBRATION_MAP", mappingPath),
    "-o",
    lldbSetEnvironment(
      "CSSMARS_ORACLE_CALIBRATION_BINDING_LOG",
      bindingLogPath,
    ),
    "-o",
    `expr (void*)dlopen(${lldbString(hookPath)}, 2)`,
    "-o",
    "detach",
    "-o",
    "quit",
  ], { stdio: "pipe", maxBuffer: 4 * 1024 * 1024 });
}

async function waitForHookInstallation({ pid, hookPath, installLogPath }) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    let install = "";
    try {
      install = await readFile(installLogPath, "utf8");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    const openFiles = execFileSync("/usr/sbin/lsof", ["-p", String(pid)], {
      encoding: "utf8",
    });
    if (openFiles.includes(hookPath) &&
        install.includes("reboundDrawArrays=1") &&
        install.includes("reboundDrawElements=1")) return;
    await delay(50);
  }
  throw new Error("Calibration hook did not bind to Google draw calls.");
}

async function writeLayerControl(path, {
  mode,
  atmosphere,
  sun,
  revision,
}) {
  if (Buffer.byteLength(mode) > 15) throw new Error("Layer mode is too long.");
  const bytes = Buffer.alloc(32);
  bytes.write(mode, 0, 15, "utf8");
  bytes[16] = atmosphere ? 49 : 48;
  bytes[17] = sun ? 49 : 48;
  bytes.writeUInt32LE(revision, 20);
  try {
    const descriptor = await open(path, "r+");
    try {
      await descriptor.write(bytes, 0, bytes.length, 0);
      await descriptor.sync();
    } finally {
      await descriptor.close();
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await writeFile(path, bytes);
  }
}

async function waitForLayerControl(path, revision) {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    try {
      const source = await readFile(path, "utf8");
      if (source.includes(`revision=${revision}\t`) &&
          source.includes("atmosphere=0\tsun=0")) return;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    await delay(50);
  }
  throw new Error(`Layer control revision ${revision} was not observed.`);
}

async function waitForRevisionDelivered(launchRoot, revision, ids) {
  const expected = new Set(ids);
  const started = Date.now();
  while (Date.now() - started < 35_000) {
    const events = (await readEvents(launchRoot)).filter((event) =>
      event.revision === revision);
    const delivered = new Set(events.filter(({ event, delivered: value }) =>
      event === "native-input-posted" && value).map(({ id }) => id));
    const rejected = events.filter(({ event }) =>
      event === "native-input-rejected");
    if (rejected.length > 0) {
      throw new Error(
        `Native revision ${revision} rejected input: ${JSON.stringify(rejected)}`,
      );
    }
    if ([...expected].every((id) => delivered.has(id))) return;
    await delay(20);
  }
  throw new Error(`Native revision ${revision} did not deliver every input.`);
}

async function waitForStableCamera() {
  const started = Date.now();
  let previous = await getViewInfo({ appName });
  let stableReadings = 0;
  while (Date.now() - started < 15_000) {
    await delay(120);
    const current = await getViewInfo({ appName });
    const delta = numericDelta(previous, current);
    const stable = Math.abs(delta.latitude) < 1e-8 &&
      Math.abs(delta.longitude) < 1e-8 &&
      Math.abs(delta.distance) < 0.01 &&
      Math.abs(delta.tilt) < 1e-8 && Math.abs(delta.azimuth) < 1e-8;
    stableReadings = stable ? stableReadings + 1 : 0;
    if (stableReadings >= 4) return current;
    previous = current;
  }
  throw new Error("Native camera did not stabilize.");
}

async function requestGracefulExit({ inputPath, launchRoot, pid }) {
  if (!processExists(pid)) {
    return Object.freeze({ mode: "already-exited", reaped: true });
  }
  await writeInputControl(inputPath, Date.now(), [], { terminate: true });
  try {
    await waitForEvent(
      launchRoot,
      (event) => event.event === "native-termination-started",
      5_000,
    );
  } catch {
    process.kill(pid, "SIGTERM");
  }
  const started = Date.now();
  while (Date.now() - started < 5_000) {
    if (!processExists(pid)) {
      return Object.freeze({
        mode: "in-process-graceful",
        graceMilliseconds: Date.now() - started,
        reaped: true,
      });
    }
    await delay(100);
  }
  const stateBeforeForce = readProcessState(pid);
  if (stateBeforeForce.includes("E")) {
    throw new Error(`Native oracle ${pid} entered exit-pending state.`);
  }
  process.kill(pid, "SIGKILL");
  const forcedAt = Date.now();
  while (Date.now() - forcedAt < 5_000) {
    if (!processExists(pid)) {
      return Object.freeze({
        mode: "verified-force-after-grace-period",
        graceMilliseconds: forcedAt - started,
        forceReapMilliseconds: Date.now() - forcedAt,
        stateBeforeForce,
        reaped: true,
      });
    }
    await delay(100);
  }
  throw new Error(`Native oracle ${pid} was not reaped after exact cleanup.`);
}

async function writeInputControl(path, revision, events, {
  terminate = false,
} = {}) {
  const temporaryPath = `${path}.next`;
  await writeFile(temporaryPath, `${JSON.stringify({
    schema: "cssmars-google-earth-pro-native-input@1",
    revision,
    events,
    terminate,
  })}\n`);
  await rename(temporaryPath, path);
}

async function waitForEvent(launchRoot, predicate, timeout = 20_000) {
  const started = Date.now();
  while (Date.now() - started <= timeout) {
    for (const event of await readEvents(launchRoot)) {
      if (predicate(event)) return event;
    }
    await delay(25);
  }
  throw new Error("Timed out waiting for native oracle event evidence.");
}

async function readEvents(launchRoot) {
  try {
    const source = await readFile(resolve(launchRoot, "events.jsonl"), "utf8");
    return source.trim().split("\n").filter(Boolean).map((line) =>
      JSON.parse(line));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function readJsonLines(path) {
  try {
    const source = await readFile(path, "utf8");
    return source.trim().split("\n").filter(Boolean).map((line) =>
      JSON.parse(line));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function waitForFile(path) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      const bytes = await readFile(path);
      if (bytes.length > 0) return;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    await delay(50);
  }
  throw new Error(`Expected native evidence file was not written: ${path}`);
}

async function cropNativeScreenshot(rawPath, path) {
  const metadata = await sharp(rawPath).metadata();
  const crop = browserRegistration.crop;
  assert.equal(metadata.width, browserRegistration.viewport.width);
  assert.ok(metadata.height >= crop.top + crop.height);
  await sharp(rawPath).extract(crop).png().toFile(path);
}

function headlessRecord(pid, stage) {
  const audit = auditWindows(pid);
  assertHeadless(audit, pid, stage);
  return Object.freeze({ stage, audit: Object.freeze({ ...audit, oraclePid: pid }) });
}

function auditWindows(pid) {
  return JSON.parse(execFileSync(windowAuditPath, [String(pid)], {
    encoding: "utf8",
  }));
}

function assertHeadless(audit, pid, stage) {
  if (audit.visibleWindowCount !== 0 ||
      audit.frontmostApplication?.pid === pid) {
    throw new Error(`Native oracle is not headless at ${stage}.`);
  }
}

async function assertNoLiveOracleProcesses() {
  const { stdout } = await execFileAsync("/bin/ps", [
    "-axo",
    "pid=,state=,command=",
  ]);
  const matches = stdout.split("\n").flatMap((line) => {
    const match = line.match(/^\s*(\d+)\s+(\S+)\s+(.+)$/u);
    if (!match) return [];
    const [, pid, state, command] = match;
    if (command !== executablePath &&
        !command.startsWith(`${executablePath} `)) return [];
    return [{ pid: Number(pid), state, command }];
  });
  const live = matches.filter(({ state }) => !state.includes("E"));
  if (live.length > 0) {
    throw new Error(
      "Refusing to launch while an exact repository-local oracle is live:\n" +
      live.map(({ pid, state, command }) =>
        `${pid} ${state} ${command}`).join("\n"),
    );
  }
  return Object.freeze({
    qualification: matches.length === 0
      ? "NO_REPOSITORY_LOCAL_ORACLE_PROCESSES"
      : "ONLY_EXIT_PENDING_REPOSITORY_LOCAL_ORACLES_TOLERATED",
    exitPendingProcesses: Object.freeze(matches),
  });
}

function frameSequenceGapCount(frames) {
  let count = 0;
  for (let index = 1; index < frames.length; index += 1) {
    if (frames[index].frameSequence !==
        frames[index - 1].frameSequence + 1) count += 1;
  }
  return count;
}

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    throw error;
  }
}

function readProcessState(pid) {
  try {
    return execFileSync("/bin/ps", ["-o", "state=", "-p", String(pid)], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
}

function camera(latitude, longitude, distance) {
  return Object.freeze({ latitude, longitude, distance, tilt: 0, azimuth: 0 });
}

function sameCamera(first, second) {
  return first.latitude === second.latitude &&
    first.longitude === second.longitude && first.distance === second.distance &&
    first.tilt === second.tilt && first.azimuth === second.azimuth;
}

function numericDelta(first, second) {
  return Object.freeze({
    latitude: second.latitude - first.latitude,
    longitude: longitudeDelta(first.longitude, second.longitude),
    distance: second.distance - first.distance,
    tilt: second.tilt - first.tilt,
    azimuth: longitudeDelta(first.azimuth, second.azimuth),
  });
}

function longitudeDelta(first, second) {
  return ((second - first + 540) % 360) - 180;
}

function longitudeDistance(first, second) {
  return Math.abs(longitudeDelta(first, second));
}

function lldbSetEnvironment(name, value) {
  return `expr (int)setenv(${lldbString(name)}, ${lldbString(value)}, 1)`;
}

function lldbString(value) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function parseArguments(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!["--set", "--repeat", "--output"].includes(key) ||
        value === undefined) {
      throw new Error(
        "Usage: capture-native-interaction-corpus.mjs --set training " +
        "--repeat 3 --output <native-training>",
      );
    }
    values[key.slice(2)] = value;
  }
  return Object.freeze({
    set: values.set,
    repeat: Number.parseInt(values.repeat, 10),
    output: values.output,
  });
}

function assertSafeOutputRoot(path) {
  if (!path.startsWith(`${evidenceRoot}/`) || path === evidenceRoot ||
      path.split("/").at(-1) !== "native-training") {
    throw new Error(`Unsafe native training output root: ${path}`);
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function padFrame(value) {
  return String(value).padStart(4, "0");
}

function delay(milliseconds) {
  return new Promise((accept) => setTimeout(accept, milliseconds));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
