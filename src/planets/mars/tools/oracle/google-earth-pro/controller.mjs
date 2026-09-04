import { createHash } from "node:crypto";
import { access, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_APP_NAME = process.env.CSSMARS_GOOGLE_EARTH_APP_NAME ??
  "id:dev.polycss.GoogleEarthProMarsOracle";

export async function getViewInfo({ appName = DEFAULT_APP_NAME } = {}) {
  const output = await runGoogleEarthAppleScript(
    appName,
    "GetViewInfo",
  );
  return parseViewInfo(output);
}

export async function setViewInfo({
  latitude,
  longitude,
  distance,
  tilt = 0,
  azimuth = 0,
  speed = 10,
  appName = DEFAULT_APP_NAME,
}) {
  for (const [name, value] of Object.entries({
    latitude,
    longitude,
    distance,
    tilt,
    azimuth,
    speed,
  })) {
    if (!Number.isFinite(value)) throw new Error(`${name} must be finite.`);
  }
  await runGoogleEarthAppleScript(
    appName,
    `SetViewInfo {latitude:${latitude}, longitude:${longitude}, distance:${distance}, tilt:${tilt}, azimuth:${azimuth}} speed ${speed}`,
  );
  return getViewInfo({ appName });
}

export async function getStreamingProgress({
  appName = DEFAULT_APP_NAME,
} = {}) {
  const output = await runGoogleEarthAppleScript(
    appName,
    "GetStreamingProgress",
  );
  const progress = Number.parseInt(output, 10);
  if (!Number.isInteger(progress)) {
    throw new Error(`Unexpected streaming progress: ${output}`);
  }
  return progress;
}

export async function getPointOnTerrain({
  x,
  y,
  appName = DEFAULT_APP_NAME,
}) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error("Terrain screen coordinates must be finite.");
  }
  const output = await runGoogleEarthAppleScript(
    appName,
    `GetPointOnTerrain {${x}, ${y}}`,
  );
  const values = output.split(/,\s*/u).map((value) =>
    Number.parseFloat(value));
  if (values.length !== 3 || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`Unexpected terrain point: ${output}`);
  }
  return Object.freeze({
    screen: Object.freeze({ x, y }),
    latitude: values[0],
    longitude: values[1],
    groundAltitudeMeters: values[2],
  });
}

export async function moveCamera({
  x,
  y,
  appName = DEFAULT_APP_NAME,
}) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error("Camera velocities must be finite.");
  }
  const output = await runGoogleEarthAppleScript(
    appName,
    `MoveCamera {${x}, ${y}}`,
  );
  return Object.freeze({
    x,
    y,
    accepted: output === "" || output === "true",
    response: output,
  });
}

export async function getCurrentVersion({ appName = DEFAULT_APP_NAME } = {}) {
  const output = await runGoogleEarthAppleScript(
    appName,
    "GetCurrentVersion",
  );
  const values = output.split(/,\s*/u).map((value) =>
    Number.parseInt(value, 10));
  if (values.length !== 4 || values.some((value) => !Number.isInteger(value))) {
    throw new Error(`Unexpected Google Earth version: ${output}`);
  }
  return Object.freeze({
    major: values[0],
    minor: values[1],
    patch: values[2],
    build: values[3],
    string: values.join("."),
  });
}

export async function getUiInteractionState() {
  const output = await runRawAppleScript([
    'tell application "System Events"',
    'set earthProcesses to every application process whose name contains "Google Earth"',
    "if (count of earthProcesses) is not 1 then error \"Expected exactly one Google Earth process\"",
    "tell item 1 of earthProcesses",
    'set stateText to "processName=" & name',
    'set stateText to stateText & linefeed & "frontmost=" & (frontmost as string)',
    "set windowPosition to position of window 1",
    "set windowSize to size of window 1",
    'set stateText to stateText & linefeed & "windowX=" & (item 1 of windowPosition as string)',
    'set stateText to stateText & linefeed & "windowY=" & (item 2 of windowPosition as string)',
    'set stateText to stateText & linefeed & "windowWidth=" & (item 1 of windowSize as string)',
    'set stateText to stateText & linefeed & "windowHeight=" & (item 2 of windowSize as string)',
    "repeat with menuItemName in {\"Sidebar\", \"Toolbar\", \"Status Bar\", \"Sun\", \"Atmosphere\"}",
    "try",
    'set menuMark to value of attribute "AXMenuItemMarkChar" of menu item (menuItemName as string) of menu "View" of menu bar 1',
    'set stateText to stateText & linefeed & (menuItemName as string) & "=" & (menuMark as string)',
    "on error",
    'set stateText to stateText & linefeed & (menuItemName as string) & "=UNAVAILABLE"',
    "end try",
    "end repeat",
    "return stateText",
    "end tell",
    "end tell",
  ]);
  return Object.freeze(Object.fromEntries(
    output.split("\n").map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
  ));
}

export async function waitForStreaming({
  appName = DEFAULT_APP_NAME,
  timeoutMilliseconds = 60_000,
  intervalMilliseconds = 250,
  stableReadings = 4,
} = {}) {
  const started = Date.now();
  let consecutive = 0;
  const samples = [];
  while (Date.now() - started <= timeoutMilliseconds) {
    const progress = await getStreamingProgress({ appName });
    samples.push({ elapsedMilliseconds: Date.now() - started, progress });
    consecutive = progress === 0 || progress === 100 ? consecutive + 1 : 0;
    if (consecutive >= stableReadings) {
      return Object.freeze({
        settled: true,
        elapsedMilliseconds: Date.now() - started,
        samples: Object.freeze(samples),
      });
    }
    await new Promise((accept) => setTimeout(accept, intervalMilliseconds));
  }
  throw new Error(
    `Google Earth streaming did not settle within ${timeoutMilliseconds} ms.`,
  );
}

export async function saveScreenShot({
  path,
  appName = DEFAULT_APP_NAME,
}) {
  const requestedPath = resolve(path).replace(/\.jpg$/iu, "");
  const actualPath = `${requestedPath}.jpg`;
  await mkdir(dirname(actualPath), { recursive: true });
  const appleScriptPath = requestedPath
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"');
  const output = await runGoogleEarthAppleScript(
    appName,
    `SaveScreenShot "${appleScriptPath}"`,
  );
  if (output.trim() !== "true") {
    throw new Error(`Google Earth rejected screenshot request: ${output}`);
  }
  await access(actualPath);
  const bytes = await readFile(actualPath);
  return Object.freeze({
    path: actualPath,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

export function parseViewInfo(value) {
  const fields = Object.fromEntries(
    [...value.matchAll(
      /(?:^|,\s*)(latitude|longitude|distance|tilt|azimuth):([^,]+)/gu,
    )].map((match) => [match[1], Number.parseFloat(match[2])]),
  );
  for (const field of [
    "latitude",
    "longitude",
    "distance",
    "tilt",
    "azimuth",
  ]) {
    if (!Number.isFinite(fields[field])) {
      throw new Error(`Missing ${field} in Google Earth view: ${value}`);
    }
  }
  return Object.freeze(fields);
}

async function runGoogleEarthAppleScript(appName, command) {
  const isBundleIdentifier = appName.startsWith("id:");
  const target = isBundleIdentifier ? appName.slice(3) : appName;
  const escapedAppName = target.replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"');
  const script = [
    'using terms from application "Google Earth Pro"',
    isBundleIdentifier
      ? `tell application id "${escapedAppName}" to ${command}`
      : `tell application "${escapedAppName}" to ${command}`,
    "end using terms from",
  ];
  return runRawAppleScript(script);
}

async function runRawAppleScript(script) {
  const args = script.flatMap((line) => ["-e", line]);
  const { stdout } = await execFileAsync("/usr/bin/osascript", args, {
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const [command, ...args] = process.argv.slice(2);
  let result;
  if (command === "get-view") {
    result = await getViewInfo();
  } else if (command === "set-view") {
    result = await setViewInfo(parseNamedNumbers(args));
  } else if (command === "wait-stream") {
    result = await waitForStreaming();
  } else if (command === "terrain") {
    result = await getPointOnTerrain(parseNamedNumbers(args));
  } else if (command === "move") {
    result = await moveCamera(parseNamedNumbers(args));
  } else if (command === "version") {
    result = await getCurrentVersion();
  } else if (command === "ui-state") {
    result = await getUiInteractionState();
  } else if (command === "capture") {
    const pathIndex = args.indexOf("--path");
    if (pathIndex === -1 || !args[pathIndex + 1]) {
      throw new Error("capture requires --path <output path>.");
    }
    result = await saveScreenShot({ path: args[pathIndex + 1] });
  } else {
    throw new Error(
      "Commands: get-view | set-view --latitude N --longitude N --distance N [--tilt N --azimuth N --speed N] | move --x N --y N | wait-stream | terrain --x N --y N | version | ui-state | capture --path PATH",
    );
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function parseNamedNumbers(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index]?.replace(/^--/u, "");
    const value = Number.parseFloat(args[index + 1]);
    if (!name || !Number.isFinite(value)) {
      throw new Error(`Invalid numeric argument near ${args[index] ?? "end"}.`);
    }
    values[name] = value;
  }
  return values;
}
