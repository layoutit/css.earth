import { createHash } from "node:crypto";
import { execFile, execFileSync } from "node:child_process";
import {
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

import {
  getViewInfo,
  setViewInfo,
  waitForStreaming,
} from "./controller.mjs";

const execFileAsync = promisify(execFile);
const workspaceRoot = resolve(import.meta.dirname, "../../../../../..");
const options = parseArguments(process.argv.slice(2));
const outputRoot = resolve(options.output);
const launchScript = resolve(import.meta.dirname, "launch-headless.mjs");
const executablePath = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/native-input/" +
    "Google Earth Pro Mars Native Input Oracle.app/Contents/MacOS/Google Earth",
);
const appPath = resolve(executablePath, "../../..");
const windowAuditPath = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/native-input/window-audit",
);
const bundleIdentifier = "dev.polycss.GoogleEarthProMarsNativeInputOracle";
const appName = `id:${bundleIdentifier}`;
const initialCamera = Object.freeze({
  latitude: 0,
  longitude: 0,
  distance: 11_000_000,
  tilt: 0,
  azimuth: 0,
  speed: 10,
});
const inputEvents = Object.freeze(dragEvents({
  from: [0.46, 0.44],
  to: [0.62, 0.57],
  steps: 12,
  interval: 32,
}));
const matrixTolerance = Object.freeze({
  maximumElementAbsoluteError: 0.05,
  sampleOffsetsMilliseconds: Object.freeze([
    0, 16, 33, 50, 67, 100, 150, 250, 400, 650, 1_000, 1_400,
  ]),
});

await mkdir(outputRoot, { recursive: true });
const sessionRoot = resolve(outputRoot, `session-${Date.now()}`);
await mkdir(sessionRoot, { recursive: true });

const uninstrumented = await captureRun({
  id: "uninstrumented-control",
  mode: "off",
});
const timingControls = [];
const fullRuns = [];
for (let index = 0; index < options.repeat; index += 1) {
  timingControls.push(await captureRun({
    id: `repeat-${String(index + 1).padStart(2, "0")}-present-control`,
    mode: "present-only",
  }));
  fullRuns.push(await captureRun({
    id: `repeat-${String(index + 1).padStart(2, "0")}-full`,
    mode: "full",
  }));
}

const repeatability = compareFullRuns(fullRuns);
const performance = fullRuns.map((run, index) => {
  const control = timingControls[index];
  return Object.freeze({
    repeat: index + 1,
    fullMissedDisplayFrames: run.trace.cadence.missedDisplayFrames,
    presentControlMissedDisplayFrames:
      control.trace.cadence.missedDisplayFrames,
    additionalMissedDisplayFrames:
      run.trace.cadence.missedDisplayFrames -
      control.trace.cadence.missedDisplayFrames,
    fullMaximumInstrumentationMilliseconds:
      run.trace.instrumentation.maximumMilliseconds,
    fullTotalInstrumentationMilliseconds:
      run.trace.instrumentation.totalMilliseconds,
    instrumentationDisplayFrameUpperBound:
      run.trace.instrumentation.totalMilliseconds / (1000 / 60),
    fullMedianInstrumentationMilliseconds:
      run.trace.instrumentation.medianMilliseconds,
    presentControlMedianInstrumentationMilliseconds:
      control.trace.instrumentation.medianMilliseconds,
    fullScenarioWallMilliseconds: run.scenario.wallMilliseconds,
    uninstrumentedScenarioWallMilliseconds:
      uninstrumented.scenario.wallMilliseconds,
    fullScenarioCpuMilliseconds: run.scenario.cpuMilliseconds,
    uninstrumentedScenarioCpuMilliseconds:
      uninstrumented.scenario.cpuMilliseconds,
    fullMaximumInputDispatchLagMilliseconds:
      run.scenario.maximumInputDispatchLagMilliseconds,
    uninstrumentedMaximumInputDispatchLagMilliseconds:
      uninstrumented.scenario.maximumInputDispatchLagMilliseconds,
  });
});
const gates = Object.freeze({
  requestedRepeatCountMet: fullRuns.length === options.repeat,
  completeFrameSequences: fullRuns.every((run) =>
    run.trace.missingFrameSequenceCount === 0),
  completeCameraInputSequences: fullRuns.every((run) =>
    run.trace.missingCameraInputSerials.length === 0),
  cameraChanged: fullRuns.every((run) =>
    run.trace.distinctModelViewMatrixCount > 1 &&
    Object.values(run.scenario.cameraDelta).some((value) =>
      Math.abs(value) > 1e-7)),
  cameraSamplesRepeatable:
    repeatability.maximumElementAbsoluteError <=
      matrixTolerance.maximumElementAbsoluteError,
  noInstrumentationLongTask: fullRuns.every((run) =>
    run.trace.instrumentation.maximumMilliseconds < 50),
  noMoreThanOneAdditionalMissedFrame: performance.every((entry) =>
    entry.instrumentationDisplayFrameUpperBound <= 1),
  everyRunReaped: [
    uninstrumented,
    ...timingControls,
    ...fullRuns,
  ].every(({ process }) => process.reaped),
});
const passed = Object.values(gates).every(Boolean);
const report = Object.freeze({
  schema: "cssmars-google-earth-pro-native-motion-smoke@1",
  qualification: passed
    ? "NATIVE_FRAME_SYNCHRONOUS_MOTION_PROVEN"
    : "INVALID_NATIVE_MOTION_TRACE_GATE_FAILED",
  generatedAt: new Date().toISOString(),
  sessionRoot,
  application: Object.freeze({
    executablePath,
    executableSha256: sha256(await readFile(executablePath)),
    launchArgument: "-multiple",
  }),
  contract: Object.freeze({
    input: inputEvents,
    initialCamera,
    trace: Object.freeze({
      format: "packed little-endian binary",
      nativeSchema: "cssmars-google-earth-pro-motion-trace@2",
      presentBoundary: "-[NSOpenGLContext flushBuffer]",
      cameraState: "OpenGL model-view and projection matrices at present",
      viewport: "GL_VIEWPORT at present",
      inputSequenceJoin: "acceptedInputSerial in events.jsonl",
      dispatch:
        "one event after prior acceptance with source minimum inter-event delay",
      navigationState:
        "input-derived phase only; post-release native mode remains unresolved",
      buffering:
        "8192 fixed records; batches drained on a serial queue outside render",
    }),
    matrixTolerance,
    displayFrameBudgetMilliseconds: 1000 / 60,
    instrumentationLongTaskMilliseconds: 50,
    maximumAdditionalMissedDisplayFrames: 1,
  }),
  gates,
  repeatability,
  performance: Object.freeze(performance),
  uninstrumentedControl: summarizeRun(uninstrumented),
  presentControls: Object.freeze(timingControls.map(summarizeRun)),
  fullRuns: Object.freeze(fullRuns.map(summarizeRun)),
});
const reportPath = resolve(outputRoot, "native-motion-smoke.json");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  ok: passed,
  reportPath,
  qualification: report.qualification,
  gates,
  repeatability,
  performance,
}, null, 2)}\n`);
if (!passed) {
  throw new Error(`Native motion trace gates failed; inspect ${reportPath}.`);
}

async function captureRun({ id, mode }) {
  const runRoot = resolve(sessionRoot, id);
  const launchRoot = resolve(runRoot, "launch");
  const inputPath = resolve(runRoot, "input-control.json");
  const tracePath = mode === "off" ? null : resolve(runRoot, "frames.bin");
  await mkdir(runRoot, { recursive: true });
  await writeControl(inputPath, 0, []);
  const processPreflight = await assertNoLiveOracleProcesses();
  let oraclePid = null;
  let termination = null;
  let terminationAttempted = false;
  try {
    const environment = {
      ...process.env,
      CSSMARS_ORACLE_INPUT_FILE: inputPath,
      CSSMARS_ORACLE_ATMOSPHERE: "off",
      CSSMARS_ORACLE_SUN: "off",
      CSSMARS_GOOGLE_EARTH_APP_PATH: appPath,
      CSSMARS_GOOGLE_EARTH_WINDOW_AUDIT: windowAuditPath,
    };
    if (tracePath !== null) {
      environment.CSSMARS_ORACLE_MOTION_TRACE = tracePath;
      environment.CSSMARS_ORACLE_MOTION_TRACE_DETAIL = mode;
    } else {
      delete environment.CSSMARS_ORACLE_MOTION_TRACE;
      delete environment.CSSMARS_ORACLE_MOTION_TRACE_DETAIL;
    }
    const launchResult = await execFileAsync(process.execPath, [
      launchScript,
      launchRoot,
    ], {
      cwd: workspaceRoot,
      env: environment,
      maxBuffer: 4 * 1024 * 1024,
    });
    const launch = JSON.parse(launchResult.stdout);
    oraclePid = launch.pid;
    await waitForEvent(launchRoot, (event) => event.event === "ready");
    await waitForEvent(
      launchRoot,
      (event) => event.event === "native-input-control-ready",
    );
    assertHeadless(auditWindows(oraclePid), oraclePid, `${id}:ready`);
    await setViewInfo({ ...initialCamera, appName });
    await waitForStreaming({ appName });
    await waitForStableCamera();
    await delay(350);
    const before = await getViewInfo({ appName });
    const cpuBefore = readCpuMilliseconds(oraclePid);
    const started = process.hrtime.bigint();
    for (let index = 0; index < inputEvents.length; index += 1) {
      if (index > 0) {
        await delay(
          inputEvents[index].atMilliseconds -
            inputEvents[index - 1].atMilliseconds,
        );
      }
      const revision = index + 1;
      await writeControl(inputPath, revision, [{
        ...inputEvents[index],
        sequenceOffsetMilliseconds: inputEvents[index].atMilliseconds,
        atMilliseconds: 0,
      }]);
      await waitForEvent(launchRoot, (event) =>
        event.event === "native-input-posted" &&
        event.revision === revision &&
        event.id === inputEvents[index].id &&
        event.delivered === true);
      if (tracePath !== null &&
          ["drag", "up"].includes(inputEvents[index].kind)) {
        await waitForTraceInputSerial(tracePath, revision);
      }
    }
    await delay(1_500);
    const after = await getViewInfo({ appName });
    const ended = process.hrtime.bigint();
    const cpuAfter = readCpuMilliseconds(oraclePid);
    assertHeadless(auditWindows(oraclePid), oraclePid, `${id}:after-input`);
    await delay(150);
    const scenarioEvents = (await readEvents(launchRoot)).filter((event) =>
      event.revision >= 1 && event.revision <= inputEvents.length);
    const scenario = Object.freeze({
      before,
      after,
      cameraDelta: numericDelta(before, after),
      wallMilliseconds: Number(ended - started) / 1e6,
      cpuMilliseconds: cpuAfter - cpuBefore,
      requestedEventCount: inputEvents.length,
      acceptedEventCount: scenarioEvents.filter(({ event }) =>
        event === "native-input-accepted").length,
      deliveredEventCount: scenarioEvents.filter(({ event, delivered }) =>
        event === "native-input-posted" && delivered === true).length,
      rejectedEventCount: scenarioEvents.filter(({ event }) =>
        event === "native-input-rejected").length,
      maximumInputDispatchLagMilliseconds:
        maximumInputDispatchLag(scenarioEvents),
    });
    terminationAttempted = true;
    termination = await requestGracefulExit({
      inputPath,
      launchRoot,
      pid: oraclePid,
    });
    const trace = tracePath === null
      ? null
      : await inspectTrace({ tracePath, events: scenarioEvents });
    const run = Object.freeze({
      id,
      mode,
      runRoot,
      process: Object.freeze({
        pid: oraclePid,
        reaped: !processExists(oraclePid),
        termination,
        processPreflight,
      }),
      scenario,
      trace,
    });
    await writeFile(
      resolve(runRoot, "run-summary.json"),
      `${JSON.stringify(run, null, 2)}\n`,
    );
    return run;
  } finally {
    if (oraclePid !== null && processExists(oraclePid) &&
        !terminationAttempted) {
      terminationAttempted = true;
      await requestGracefulExit({ inputPath, launchRoot, pid: oraclePid });
    }
  }
}

async function inspectTrace({ tracePath, events }) {
  const bytes = await readFile(tracePath);
  const decoded = decodeMotionTrace(bytes);
  const accepted = events.filter(({ event }) =>
    event === "native-input-accepted");
  const acceptedSerials = accepted.map(({ acceptedInputSerial }) =>
    acceptedInputSerial);
  const cameraAcceptedSerials = accepted
    .filter(({ kind }) => ["drag", "up"].includes(kind))
    .map(({ acceptedInputSerial }) => acceptedInputSerial);
  const firstAcceptedNanoseconds = accepted[0].acceptedMonotonicSeconds * 1e9;
  const lastAcceptedNanoseconds = accepted.at(-1).acceptedMonotonicSeconds * 1e9;
  const scenarioFrames = decoded.frames.filter((frame) =>
    frame.monotonicNanoseconds >= firstAcceptedNanoseconds - 5_000_000 &&
    frame.monotonicNanoseconds <= lastAcceptedNanoseconds + 1_500_000_000);
  const observedSerials = new Set(scenarioFrames.map(({ inputSerial }) =>
    inputSerial));
  const frameSequenceGaps = [];
  for (let index = 1; index < decoded.frames.length; index += 1) {
    const expected = decoded.frames[index - 1].frameSequence + 1;
    if (decoded.frames[index].frameSequence !== expected) {
      frameSequenceGaps.push(Object.freeze({
        after: decoded.frames[index - 1].frameSequence,
        before: decoded.frames[index].frameSequence,
      }));
    }
  }
  const modelViewKeys = new Set(scenarioFrames
    .filter(({ matricesCaptured }) => matricesCaptured)
    .map(({ modelViewMatrix }) => JSON.stringify(modelViewMatrix)));
  const sampleFrames = matrixTolerance.sampleOffsetsMilliseconds.map(
    (offsetMilliseconds) => closestFrame(
      scenarioFrames.filter(({ matricesCaptured }) => matricesCaptured),
      lastAcceptedNanoseconds + offsetMilliseconds * 1e6,
    ),
  ).filter(Boolean);
  return Object.freeze({
    path: tracePath,
    bytes: bytes.length,
    sha256: sha256(bytes),
    header: decoded.header,
    frameCount: decoded.frames.length,
    scenarioFrameCount: scenarioFrames.length,
    firstFrameSequence: decoded.frames[0]?.frameSequence ?? null,
    lastFrameSequence: decoded.frames.at(-1)?.frameSequence ?? null,
    missingFrameSequenceCount: frameSequenceGaps.length,
    frameSequenceGaps: Object.freeze(frameSequenceGaps),
    expectedInputSerials: Object.freeze(acceptedSerials),
    observedInputSerials: Object.freeze([...observedSerials].sort((a, b) =>
      a - b)),
    missingInputSerials: Object.freeze(acceptedSerials.filter((serial) =>
      !observedSerials.has(serial))),
    expectedCameraInputSerials: Object.freeze(cameraAcceptedSerials),
    missingCameraInputSerials: Object.freeze(
      cameraAcceptedSerials.filter((serial) => !observedSerials.has(serial)),
    ),
    distinctModelViewMatrixCount: modelViewKeys.size,
    sampleFrames: Object.freeze(sampleFrames),
    cadence: cadenceStatistics(scenarioFrames),
    instrumentation: instrumentationStatistics(scenarioFrames),
  });
}

function decodeMotionTrace(bytes) {
  if (bytes.length < 40 || bytes.toString("ascii", 0, 7) !== "CSMOTN2") {
    throw new Error("Motion trace has an invalid binary header.");
  }
  const header = Object.freeze({
    magic: bytes.toString("ascii", 0, 7),
    version: bytes.readUInt32LE(8),
    headerSize: bytes.readUInt32LE(12),
    recordSize: bytes.readUInt32LE(16),
    flags: bytes.readUInt32LE(20),
    timebaseNumerator: bytes.readUInt32LE(24),
    timebaseDenominator: bytes.readUInt32LE(28),
    ringCapacity: Number(bytes.readBigUInt64LE(32)),
  });
  if (header.version !== 2 || header.headerSize !== 40 ||
      header.recordSize !== 220 ||
      (bytes.length - header.headerSize) % header.recordSize !== 0) {
    throw new Error("Motion trace size does not match schema 2.");
  }
  const phases = [
    "idle",
    "move",
    "drag-held",
    "post-release-unresolved",
    "wheel",
    "double-click-fly-to",
  ];
  const toNanoseconds = (ticks) => Number(
    ticks * BigInt(header.timebaseNumerator) /
      BigInt(header.timebaseDenominator),
  );
  const frames = [];
  for (let offset = header.headerSize;
       offset + header.recordSize <= bytes.length;
       offset += header.recordSize) {
    const started = bytes.readBigUInt64LE(offset + 32);
    const ended = bytes.readBigUInt64LE(offset + 40);
    const instrumentationEnded = bytes.readBigUInt64LE(offset + 48);
    frames.push(Object.freeze({
      frameSequence: Number(bytes.readBigUInt64LE(offset)),
      inputSerial: Number(bytes.readBigUInt64LE(offset + 8)),
      inputRevision: Number(bytes.readBigUInt64LE(offset + 16)),
      inputIdentifierHash: bytes.readBigUInt64LE(offset + 24).toString(),
      monotonicNanoseconds: toNanoseconds(started),
      presentEndedNanoseconds: toNanoseconds(ended),
      instrumentationEndedNanoseconds: toNanoseconds(instrumentationEnded),
      presentDurationNanoseconds: toNanoseconds(ended - started),
      instrumentationNanoseconds: toNanoseconds(
        instrumentationEnded - started,
      ),
      threadId: Number(bytes.readBigUInt64LE(offset + 56)),
      context: `0x${bytes.readBigUInt64LE(offset + 64).toString(16)}`,
      viewport: Object.freeze(Array.from({ length: 4 }, (_, index) =>
        bytes.readInt32LE(offset + 72 + index * 4))),
      modelViewMatrix: Object.freeze(Array.from({ length: 16 }, (_, index) =>
        bytes.readFloatLE(offset + 88 + index * 4))),
      projectionMatrix: Object.freeze(Array.from({ length: 16 }, (_, index) =>
        bytes.readFloatLE(offset + 152 + index * 4))),
      inputPhase: phases[bytes[offset + 216]] ?? "unknown",
      currentContext: bytes[offset + 217] === 1,
      matricesCaptured: bytes[offset + 218] === 1,
    }));
  }
  return Object.freeze({ header, frames: Object.freeze(frames) });
}

function cadenceStatistics(frames) {
  const intervals = frames.slice(1).map((frame, index) =>
    (frame.monotonicNanoseconds - frames[index].monotonicNanoseconds) / 1e6);
  const displayBudget = 1000 / 60;
  return Object.freeze({
    sampleCount: intervals.length,
    minimumMilliseconds: minimum(intervals),
    medianMilliseconds: percentile(intervals, 0.5),
    percentile95Milliseconds: percentile(intervals, 0.95),
    maximumMilliseconds: maximum(intervals),
    missedDisplayFrames: intervals.reduce((total, interval) =>
      total + Math.max(0, Math.floor(interval / displayBudget) - 1), 0),
    intervalsOver50Milliseconds: intervals.filter((value) => value >= 50)
      .length,
  });
}

function instrumentationStatistics(frames) {
  const values = frames.map(({ instrumentationNanoseconds }) =>
    instrumentationNanoseconds / 1e6);
  return Object.freeze({
    sampleCount: values.length,
    minimumMilliseconds: minimum(values),
    medianMilliseconds: percentile(values, 0.5),
    percentile95Milliseconds: percentile(values, 0.95),
    maximumMilliseconds: maximum(values),
    totalMilliseconds: values.reduce((total, value) => total + value, 0),
    longTaskCount: values.filter((value) => value >= 50).length,
  });
}

async function waitForTraceInputSerial(tracePath, inputSerial) {
  const started = Date.now();
  while (Date.now() - started < 10_000) {
    try {
      const bytes = await readFile(tracePath);
      if (bytes.length >= 40 && bytes.toString("ascii", 0, 7) === "CSMOTN2") {
        const headerSize = bytes.readUInt32LE(12);
        const recordSize = bytes.readUInt32LE(16);
        const completeRecordCount = Math.floor(
          (bytes.length - headerSize) / recordSize,
        );
        const finalRecordOffset = headerSize +
          (completeRecordCount - 1) * recordSize;
        for (let offset = finalRecordOffset;
             offset >= headerSize &&
               offset >= finalRecordOffset - recordSize * 255;
             offset -= recordSize) {
          if (Number(bytes.readBigUInt64LE(offset + 8)) === inputSerial) {
            return;
          }
        }
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    await delay(10);
  }
  throw new Error(
    `Timed out waiting for rendered frame carrying input serial ${inputSerial}.`,
  );
}

function compareFullRuns(runs) {
  const reference = runs[0].trace.sampleFrames;
  let maximumElementAbsoluteError = 0;
  const comparisons = [];
  for (let runIndex = 1; runIndex < runs.length; runIndex += 1) {
    const candidate = runs[runIndex].trace.sampleFrames;
    const sampleCount = Math.min(reference.length, candidate.length);
    let runMaximum = 0;
    for (let index = 0; index < sampleCount; index += 1) {
      runMaximum = Math.max(
        runMaximum,
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
    maximumElementAbsoluteError = Math.max(
      maximumElementAbsoluteError,
      runMaximum,
    );
    comparisons.push(Object.freeze({
      referenceRun: runs[0].id,
      candidateRun: runs[runIndex].id,
      comparedSampleCount: sampleCount,
      maximumElementAbsoluteError: runMaximum,
    }));
  }
  return Object.freeze({
    maximumElementAbsoluteError,
    tolerance: matrixTolerance.maximumElementAbsoluteError,
    comparisons: Object.freeze(comparisons),
  });
}

function summarizeRun(run) {
  return Object.freeze({
    id: run.id,
    mode: run.mode,
    runRoot: run.runRoot,
    process: run.process,
    scenario: run.scenario,
    trace: run.trace,
  });
}

function closestFrame(frames, targetNanoseconds) {
  let selected = null;
  let selectedDistance = Infinity;
  for (const frame of frames) {
    const distance = Math.abs(frame.monotonicNanoseconds - targetNanoseconds);
    if (distance >= selectedDistance) continue;
    selected = frame;
    selectedDistance = distance;
  }
  return selected === null ? null : Object.freeze({
    targetNanoseconds,
    actualNanoseconds: selected.monotonicNanoseconds,
    timingErrorMilliseconds: selectedDistance / 1e6,
    frameSequence: selected.frameSequence,
    inputSerial: selected.inputSerial,
    inputPhase: selected.inputPhase,
    viewport: selected.viewport,
    modelViewMatrix: selected.modelViewMatrix,
    projectionMatrix: selected.projectionMatrix,
  });
}

async function waitForStableCamera() {
  const started = Date.now();
  let previous = await getViewInfo({ appName });
  let stableReadings = 0;
  while (Date.now() - started < 15_000) {
    await delay(150);
    const current = await getViewInfo({ appName });
    const delta = numericDelta(previous, current);
    const stable = Math.abs(delta.latitude) < 1e-8 &&
      Math.abs(delta.longitude) < 1e-8 &&
      Math.abs(delta.distance) < 0.01 &&
      Math.abs(delta.tilt) < 1e-8 &&
      Math.abs(delta.azimuth) < 1e-8;
    stableReadings = stable ? stableReadings + 1 : 0;
    if (stableReadings >= 5) return current;
    previous = current;
  }
  throw new Error("Native camera did not become stable before input.");
}

async function requestGracefulExit({ inputPath, launchRoot, pid }) {
  if (!processExists(pid)) {
    return Object.freeze({ mode: "already-exited", reaped: true });
  }
  await writeControl(inputPath, Date.now(), [], { terminate: true });
  await waitForEvent(
    launchRoot,
    (event) => event.event === "native-termination-started",
    5_000,
  );
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
    throw new Error(
      `Native oracle ${pid} entered exit-pending state during graceful exit.`,
    );
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
  throw new Error(
    `Native oracle ${pid} was not reaped after bounded graceful and forced exit.`,
  );
}

async function writeControl(
  path,
  revision,
  events,
  { terminate = false } = {},
) {
  const temporaryPath = `${path}.next`;
  await writeFile(temporaryPath, `${JSON.stringify({
    schema: "cssmars-google-earth-pro-native-input@1",
    revision,
    events,
    terminate,
  })}\n`);
  await rename(temporaryPath, path);
}

async function waitForEvent(
  launchRoot,
  predicate,
  timeoutMilliseconds = 20_000,
) {
  const started = Date.now();
  while (Date.now() - started <= timeoutMilliseconds) {
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
        !command.startsWith(`${executablePath} `)) {
      return [];
    }
    return [{ pid: Number(pid), state, command }];
  });
  const live = matches.filter(({ state }) => !state.includes("E"));
  if (live.length > 0) {
    throw new Error(
      "Refusing to launch while a repository-local native oracle is live:\n" +
      live.map(formatProcess).join("\n"),
    );
  }
  return Object.freeze({
    qualification: matches.length === 0
      ? "NO_REPOSITORY_LOCAL_ORACLE_PROCESSES"
      : "ONLY_EXIT_PENDING_REPOSITORY_LOCAL_ORACLES_TOLERATED",
    exitPendingProcesses: Object.freeze(matches),
  });
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

function dragEvents({ from, to, steps, interval }) {
  const events = [{
    id: "drag-move-start",
    kind: "move",
    atMilliseconds: 0,
    x: from[0],
    y: from[1],
  }, {
    id: "drag-down",
    kind: "down",
    atMilliseconds: interval,
    x: from[0],
    y: from[1],
  }];
  for (let step = 1; step <= steps; step += 1) {
    const progress = step / steps;
    events.push({
      id: `drag-step-${step}`,
      kind: "drag",
      atMilliseconds: interval * (step + 1),
      x: from[0] + (to[0] - from[0]) * progress,
      y: from[1] + (to[1] - from[1]) * progress,
    });
  }
  events.push({
    id: "drag-up",
    kind: "up",
    atMilliseconds: interval * (steps + 2),
    x: to[0],
    y: to[1],
  });
  return events;
}

function maximumInputDispatchLag(events) {
  const batches = new Map(events
    .filter(({ event }) => event === "native-input-batch-accepted")
    .map((event) => [event.revision, event]));
  const posted = events.filter(({ event }) => event === "native-input-posted");
  if (posted.length === 0 || posted.some((event) =>
    !batches.has(event.revision))) {
    return Infinity;
  }
  return maximum(posted.map((event) => {
    const batch = batches.get(event.revision);
    return (event.postedMonotonicSeconds - batch.acceptedMonotonicSeconds) *
      1e3 - event.requestedMilliseconds;
  }));
}

function numericDelta(before, after) {
  return Object.freeze(Object.fromEntries(
    ["latitude", "longitude", "distance", "tilt", "azimuth"].map((key) =>
      [key, after[key] - before[key]]),
  ));
}

function matrixMaximumError(left, right) {
  return Math.max(...left.map((value, index) =>
    Math.abs(value - right[index])));
}

function percentile(values, proportion) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(
    sorted.length - 1,
    Math.floor(sorted.length * proportion),
  )];
}

function minimum(values) {
  return values.length === 0 ? null : Math.min(...values);
}

function maximum(values) {
  return values.length === 0 ? null : Math.max(...values);
}

function readCpuMilliseconds(pid) {
  const value = execFileSync("/bin/ps", ["-o", "time=", "-p", String(pid)], {
    encoding: "utf8",
  }).trim();
  const match = value.match(/^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/u);
  if (!match) return 0;
  const [, days = "0", hours = "0", minutes, seconds] = match;
  return (((Number(days) * 24 + Number(hours)) * 60 + Number(minutes)) * 60 +
    Number(seconds)) * 1_000;
}

function readProcessState(pid) {
  return execFileSync("/bin/ps", ["-o", "state=", "-p", String(pid)], {
    encoding: "utf8",
  }).trim();
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

function formatProcess({ pid, state, command }) {
  return `${pid} ${state} ${command}`;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function delay(milliseconds) {
  return new Promise((accept) => setTimeout(accept, milliseconds));
}

function parseArguments(args) {
  const result = {
    repeat: 3,
    output:
      "output/playwright/google-earth-pro-mars-interaction-video-v1/" +
      "native-motion-smoke",
  };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--repeat") {
      result.repeat = Number.parseInt(args[++index], 10);
    } else if (args[index] === "--output") {
      result.output = args[++index];
    } else {
      throw new Error(`Unknown argument: ${args[index]}`);
    }
  }
  if (!Number.isInteger(result.repeat) || result.repeat < 1 ||
      result.repeat > 10 || !result.output) {
    throw new Error("Use --repeat 1..10 and --output <directory>.");
  }
  return Object.freeze(result);
}
