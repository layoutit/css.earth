import { createHash } from "node:crypto";
import { closeSync, openSync } from "node:fs";
import { access as accessAsync, mkdir as mkdirAsync,
  readFile as readFileAsync, writeFile as writeFileAsync } from
  "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";

const workspaceRoot = resolve(import.meta.dirname, "../../../../../..");
const appPath = resolve(
  process.env.CSSMARS_GOOGLE_EARTH_APP_PATH ?? resolve(
    workspaceRoot,
    ".local/oracles/google-earth-pro/patched/Google Earth Pro Mars Oracle.app",
  ),
);
const executablePath = resolve(appPath, "Contents/MacOS/Google Earth");
const outputRoot = resolve(
  process.argv[2] ??
    "output/playwright/google-earth-pro-mars-oracle-isolated",
);
const eventLogPath = resolve(outputRoot, "events.jsonl");
const processLogPath = resolve(outputRoot, "process.log");
const windowAuditPath = resolve(
  process.env.CSSMARS_GOOGLE_EARTH_WINDOW_AUDIT ?? resolve(
    workspaceRoot,
    ".local/oracles/google-earth-pro/patched/window-audit",
  ),
);

const openPath = process.env.CSSMARS_ORACLE_OPEN_PATH === undefined
  ? null
  : resolve(process.env.CSSMARS_ORACLE_OPEN_PATH);
await Promise.all([
  accessAsync(executablePath),
  accessAsync(windowAuditPath),
  ...(openPath === null ? [] : [accessAsync(openPath)]),
]);
await mkdirAsync(outputRoot, { recursive: true });
const foregroundBefore = auditWindows(process.pid).frontmostApplication;
const processLog = openSync(processLogPath, "a");
const launchArguments = Object.freeze([
  "-multiple",
  ...(openPath === null ? [] : [openPath]),
]);
const child = spawn(executablePath, launchArguments, {
  cwd: dirname(executablePath),
  detached: true,
  env: {
    ...process.env,
    CSSMARS_ORACLE_EVENT_LOG: eventLogPath,
    CSSMARS_ORACLE_ATMOSPHERE:
      process.env.CSSMARS_ORACLE_ATMOSPHERE ?? "on",
    CSSMARS_ORACLE_SUN: process.env.CSSMARS_ORACLE_SUN ?? "off",
  },
  stdio: ["ignore", processLog, processLog],
});
closeSync(processLog);

let injected = false;
for (let attempt = 0; attempt < 200; attempt += 1) {
  if (child.exitCode !== null) break;
  try {
    const events = await readFileAsync(eventLogPath, "utf8");
    if (events.includes('"event":"injected"')) {
      injected = true;
      break;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await new Promise((accept) => setTimeout(accept, 100));
}
const windowAudit = auditWindows(child.pid);
const foregroundUnchanged =
  windowAudit.frontmostApplication.pid === foregroundBefore.pid;
const oracleOwnsForeground =
  windowAudit.frontmostApplication.pid === child.pid;
const headless = injected && windowAudit.visibleWindowCount === 0 &&
  !oracleOwnsForeground;
if (!headless) {
  child.kill("SIGTERM");
  throw new Error(
    `Headless preflight failed: injected=${injected}; visibleWindowCount=${windowAudit.visibleWindowCount}; oracleOwnsForeground=${oracleOwnsForeground}.`,
  );
}
child.unref();

const executableBytes = await readFileAsync(executablePath);
const launch = Object.freeze({
  schema: "cssmars-google-earth-pro-headless-launch@2",
  qualification: "HEADLESS_PREFLIGHT_PROVEN_AWAITING_READY_EVENT",
  pid: child.pid,
  arguments: launchArguments,
  appPath,
  executablePath,
  executableSha256: createHash("sha256")
    .update(executableBytes)
    .digest("hex"),
  eventLogPath,
  processLogPath,
  headlessPreflight: Object.freeze({
    injected,
    foregroundBefore,
    foregroundAfter: windowAudit.frontmostApplication,
    foregroundUnchanged,
    oracleOwnsForeground,
    visibleWindowCount: windowAudit.visibleWindowCount,
    windows: windowAudit.windows,
  }),
  requirements: Object.freeze({
    isolatedMacOsSession: false,
    multipleInstanceMode: true,
    visibleWindowCount: 0,
    foregroundOwnership: false,
  }),
});
const launchPath = resolve(outputRoot, "launch.json");
await writeFileAsync(launchPath, `${JSON.stringify(launch, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ ok: true, launchPath, ...launch }, null, 2)}\n`);

function auditWindows(pid) {
  return JSON.parse(execFileSync(windowAuditPath, [String(pid)], {
    encoding: "utf8",
  }));
}
