import { createHash } from "node:crypto";
import { execFile, execFileSync } from "node:child_process";
import {
  mkdir,
  readFile,
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
const outputRoot = resolve(process.argv[2] ??
  "output/playwright/google-earth-pro-mars-interaction-video-v1/input-smoke");
const launchRoot = resolve(outputRoot, "launch");
const inputPath = resolve(outputRoot, "input-control.json");
const reportPath = resolve(outputRoot, "native-input-smoke.json");
const launchScript = resolve(import.meta.dirname, "launch-headless.mjs");
const windowAuditPath = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/native-input/window-audit",
);
const executablePath = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/native-input/" +
    "Google Earth Pro Mars Native Input Oracle.app/Contents/MacOS/Google Earth",
);
const appPath = resolve(executablePath, "../../..");
const bundleIdentifier =
  "dev.polycss.GoogleEarthProMarsNativeInputOracle";
const appName = `id:${bundleIdentifier}`;
const camera = Object.freeze({
  latitude: 0,
  longitude: 0,
  distance: 11_000_000,
  tilt: 0,
  azimuth: 0,
  speed: 10,
});

const processPreflight = await assertNoExistingOracleProcesses();
await mkdir(outputRoot, { recursive: true });
await writeControl(0, []);

let oraclePid = null;
try {
  const launchResult = await execFileAsync(process.execPath, [
    launchScript,
    launchRoot,
  ], {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      CSSMARS_ORACLE_INPUT_FILE: inputPath,
      CSSMARS_ORACLE_ATMOSPHERE: "off",
      CSSMARS_ORACLE_SUN: "off",
      CSSMARS_GOOGLE_EARTH_APP_PATH: appPath,
      CSSMARS_GOOGLE_EARTH_WINDOW_AUDIT: windowAuditPath,
    },
    maxBuffer: 4 * 1024 * 1024,
  });
  const launch = JSON.parse(launchResult.stdout);
  oraclePid = launch.pid;
  await waitForEvent((event) => event.event === "ready");
  await waitForEvent((event) => event.event === "native-input-control-ready");
  const readyAudit = auditWindows(oraclePid);
  assertHeadless(readyAudit, oraclePid, "ready");
  await setViewInfo({ ...camera, appName });
  await waitForStreaming({ appName });

  const scenarios = [];
  scenarios.push(await runScenario({
    revision: 1,
    id: "horizontal-drag",
    events: dragEvents({ from: [0.5, 0.5], to: [0.62, 0.5] }),
  }));
  scenarios.push(await runScenario({
    revision: 2,
    id: "diagonal-drag",
    events: dragEvents({ from: [0.5, 0.5], to: [0.59, 0.59] }),
  }));
  scenarios.push(await runScenario({
    revision: 3,
    id: "wheel",
    events: [{
      id: "wheel-0",
      kind: "wheel",
      atMilliseconds: 0,
      x: 0.5,
      y: 0.5,
      deltaY: 4,
    }],
  }));
  scenarios.push(await runScenario({
    revision: 4,
    id: "double-click",
    events: doubleClickEvents([0.58, 0.56]),
  }));

  const finalAudit = auditWindows(oraclePid);
  assertHeadless(finalAudit, oraclePid, "after-input");
  const events = await readEvents();
  const postedEvents = events.filter(({ event }) =>
    event === "native-input-posted");
  const allEventsDelivered = postedEvents.length === scenarios.reduce(
    (total, scenario) => total + scenario.requestedEventCount,
    0,
  ) && postedEvents.every(({ delivered }) => delivered === true);
  const report = Object.freeze({
    schema: "cssmars-google-earth-pro-native-input-smoke@1",
    qualification: scenarios.every(({ changed }) => changed) &&
        allEventsDelivered
      ? "NATIVE_HEADLESS_POINTER_PATH_PROVEN"
      : "INVALID_NATIVE_POINTER_PATH_DID_NOT_CHANGE_CAMERA",
    application: Object.freeze({
      executablePath,
      executableSha256: sha256(await readFile(executablePath)),
      pid: oraclePid,
    }),
    inputControl: Object.freeze({
      path: inputPath,
      sha256: sha256(await readFile(inputPath)),
      requestedEventCount: scenarios.reduce(
        (total, scenario) => total + scenario.requestedEventCount,
        0,
      ),
      acceptedBatchCount: events.filter(({ event }) =>
        event === "native-input-batch-accepted").length,
      postedEventCount: events.filter(({ event }) =>
        event === "native-input-posted").length,
      deliveredEventCount: postedEvents.filter(({ delivered }) =>
        delivered === true).length,
      rejectedEventCount: events.filter(({ event }) =>
        event === "native-input-rejected").length,
    }),
    headless: Object.freeze({ ready: readyAudit, final: finalAudit }),
    processPreflight,
    scenarios: Object.freeze(scenarios),
  });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  if (!scenarios.every(({ changed }) => changed) || !allEventsDelivered) {
    throw new Error(`Native pointer smoke failed; inspect ${reportPath}.`);
  }
  process.stdout.write(`${JSON.stringify({
    ok: true,
    reportPath,
    qualification: report.qualification,
    scenarios: report.scenarios.map(({ id, delta }) => ({ id, delta })),
  }, null, 2)}\n`);
} finally {
  if (oraclePid !== null) await terminateOracle(oraclePid);
}

async function runScenario({ revision, id, events }) {
  await setViewInfo({ ...camera, appName });
  await new Promise((accept) => setTimeout(accept, 200));
  const before = await getViewInfo({ appName });
  await writeControl(revision, events);
  await waitForEvent((event) =>
    event.event === "native-input-posted" &&
    event.revision === revision &&
    event.id === events.at(-1).id &&
    event.delivered === true);
  await new Promise((accept) => setTimeout(accept, 800));
  const after = await getViewInfo({ appName });
  const delta = numericDelta(before, after);
  const changed = Object.values(delta).some((value) => Math.abs(value) > 1e-7);
  return Object.freeze({
    id,
    revision,
    requestedEventCount: events.length,
    before,
    after,
    delta,
    changed,
  });
}

function dragEvents({ from, to, steps = 8, interval = 16 }) {
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

function doubleClickEvents([x, y]) {
  return [
    ["double-down-1", "down", 0, 1],
    ["double-up-1", "up", 40, 1],
    ["double-down-2", "down", 90, 2],
    ["double-up-2", "up", 130, 2],
  ].map(([id, kind, atMilliseconds, clickCount]) => ({
    id,
    kind,
    atMilliseconds,
    x,
    y,
    clickCount,
  }));
}

async function writeControl(revision, events, { terminate = false } = {}) {
  const temporaryPath = `${inputPath}.next`;
  await writeFile(temporaryPath, `${JSON.stringify({
    schema: "cssmars-google-earth-pro-native-input@1",
    revision,
    events,
    terminate,
  })}\n`);
  await import("node:fs/promises").then(({ rename }) =>
    rename(temporaryPath, inputPath));
}

async function waitForEvent(predicate, timeoutMilliseconds = 20_000) {
  const started = Date.now();
  while (Date.now() - started <= timeoutMilliseconds) {
    for (const event of await readEvents()) {
      if (predicate(event)) return event;
    }
    await new Promise((accept) => setTimeout(accept, 25));
  }
  throw new Error("Timed out waiting for native oracle input evidence.");
}

async function readEvents() {
  try {
    const source = await readFile(resolve(launchRoot, "events.jsonl"), "utf8");
    return source.trim().split("\n").filter(Boolean).map((line) =>
      JSON.parse(line));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
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

async function assertNoExistingOracleProcesses() {
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
  const liveMatches = matches.filter(({ state }) => !state.includes("E"));
  if (liveMatches.length > 0) {
    throw new Error(
      "Refusing to launch another native oracle while a repository-local " +
      "Google Earth process is live. Exit-pending processes are inert and " +
      "the pinned -multiple launch path safely bypasses them:\n" +
      matches.map(formatProcess).join("\n"),
    );
  }
  return Object.freeze({
    qualification: matches.length === 0
      ? "NO_REPOSITORY_LOCAL_ORACLE_PROCESSES"
      : "ONLY_EXIT_PENDING_REPOSITORY_LOCAL_ORACLES_TOLERATED",
    exitPendingProcesses: Object.freeze(matches),
  });
}

function formatProcess({ pid, state, command }) {
  return `${pid} ${state} ${command}`;
}

async function terminateOracle(pid) {
  if (!processExists(pid)) return;
  await writeControl(Date.now(), [], { terminate: true });
  const started = Date.now();
  while (Date.now() - started < 15_000) {
    if (!processExists(pid)) return;
    await new Promise((accept) => setTimeout(accept, 100));
  }
  throw new Error(
    `Native oracle ${pid} did not complete its in-process graceful exit.`,
  );
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

function numericDelta(before, after) {
  return Object.freeze(Object.fromEntries(
    ["latitude", "longitude", "distance", "tilt", "azimuth"].map((key) =>
      [key, after[key] - before[key]]),
  ));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
