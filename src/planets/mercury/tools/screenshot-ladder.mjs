#!/usr/bin/env node
// Renders the Mercury page in real Chrome at a ladder of camera distances
// and saves one PNG per distance plus a JSON manifest. Pure tooling: the
// scene code that honours `distanceKilometers` is being written in
// parallel, so this script is tolerant of that field being ignored,
// missing, or absent entirely from the camera state object it gets back.
//
// See src/planets/mercury/test/smoke-browser.mjs for the readiness /
// camera-interface conventions this script follows.

import { closeSync, openSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const DEFAULT_BASE_URL = "http://127.0.0.1:4210";
const DEFAULT_OUT_DIR =
  "/private/tmp/claude-501/-Users-apresmoi-Documents-cssEarth/" +
  "77ccf69f-07a2-4417-9a0f-3e55cc967ee8/scratchpad/mercury-ladder";
// Out to the whole planetary system: the dolly's far bound is about 91 AU
// (1.36e10 km); the last steps frame Mars, Jupiter, Saturn and Neptune.
const DEFAULT_DISTANCES_KM = [8000, 20000, 100000, 1e6, 1e7, 6e7, 1.6e8,
  4.5e8, 1.2e9, 3e9, 6e9, 1.36e10];
const DEV_SERVER_READY_TIMEOUT_MS = 90_000;
const PROBE_TIMEOUT_MS = 2000;

const options = parseArguments(process.argv.slice(2));
const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
const outDir = resolve(options.out ?? DEFAULT_OUT_DIR);
const viewport = parseViewport(options.viewport);
const deviceScaleFactor = options.dpr === undefined ? 1 : Number(options.dpr);
const distances = parseDistances(options.distances);
const pitch = options.pitch === undefined ? undefined : Number(options.pitch);
const yaw = options.yaw === undefined ? undefined : Number(options.yaw);
const extraEvalExpression = options.extraEval;

await mkdir(outDir, { recursive: true });

let devServer = null;
let browser = null;
let exitCode = 0;

const onSignal = () => {
  cleanup().finally(() => process.exit(1));
};
process.once("SIGINT", onSignal);
process.once("SIGTERM", onSignal);

try {
  devServer = await ensureDevServer({ baseUrl, outDir });

  browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
  });
  // Fresh context per run: asset URLs carry no content hash, so a warm
  // cache from a previous run could serve stale textures.
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
  });
  const page = await context.newPage();

  const consoleLog = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleLog.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    consoleLog.push(`pageerror: ${error.message}`);
  });

  const manifest = {
    baseUrl,
    viewport,
    dpr: deviceScaleFactor,
    startedAt: new Date().toISOString(),
    steps: [],
    initialState: null,
  };

  let readyFailure = null;
  try {
    const response = await page.goto(new URL("/mercury/", baseUrl).href, {
      waitUntil: "networkidle",
    });
    if (!response || !response.ok()) {
      throw new Error(`Navigation returned status ${response?.status() ?? "n/a"}`);
    }
    await page.waitForFunction(() =>
      window.__cssEarth?.ready === true &&
      window.__mercury?.ready === true &&
      document.documentElement.dataset.ready === "true");
  } catch (error) {
    readyFailure = error instanceof Error ? error.message : String(error);
  }

  if (readyFailure) {
    manifest.error = `Page never became ready: ${readyFailure}`;
    await writeManifest(outDir, manifest);
    console.error(manifest.error);
    exitCode = 1;
  } else {
    try {
      await page.evaluate(() => {
        const input = document.querySelector('input[name="motion"]');
        if (input.checked) input.click();
      });
    } catch (error) {
      consoleLog.push(`freezing motion threw: ${error instanceof Error ? error.message : String(error)}`);
    }

    manifest.initialState = await readCameraState(page);

    if (extraEvalExpression !== undefined) {
      try {
        manifest.extra = await page.evaluate(extraEvalExpression);
      } catch (error) {
        manifest.extra = {
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    const paddingWidth = Math.max(2, String(distances.length).length);
    for (let index = 0; index < distances.length; index += 1) {
      const requestedDistanceKilometers = distances[index];
      const problemsStartIndex = consoleLog.length;

      const params = { distanceKilometers: requestedDistanceKilometers };
      if (pitch !== undefined) params.controlPitch = pitch;
      if (yaw !== undefined) params.controlYaw = yaw;

      const setStateResult = await page.evaluate((setStateParams) => {
        try {
          const camera = window.__mercury?.camera;
          if (!camera || typeof camera.setState !== "function") {
            return {
              ok: false,
              error: "window.__mercury.camera.setState is not available",
              state: null,
            };
          }
          const returnedState = camera.setState(setStateParams);
          const resolvedState = returnedState ??
            (typeof camera.state === "function" ? camera.state() : null);
          return { ok: true, error: null, state: resolvedState ?? null };
        } catch (error) {
          return {
            ok: false,
            error: (error && (error.stack || error.message)) || String(error),
            state: null,
          };
        }
      }, params);

      if (!setStateResult.ok) {
        consoleLog.push(`setState error: ${setStateResult.error}`);
      }

      await page.evaluate(() => new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.waitForTimeout(150);

      const distanceLabel = formatDistanceCompact(requestedDistanceKilometers);
      const fileName = `${String(index).padStart(paddingWidth, "0")}-${distanceLabel}km.png`;
      const filePath = resolve(outDir, fileName);
      await page.screenshot({ path: filePath, fullPage: false });

      const problems = consoleLog.slice(problemsStartIndex);
      const state = setStateResult.state;
      const actualDistance = state && typeof state === "object" &&
        "distanceKilometers" in state ? state.distanceKilometers : "n/a";

      manifest.steps.push({
        index,
        requestedDistanceKilometers,
        state,
        file: filePath,
        problems,
      });

      console.log(
        `[${index}] requested=${requestedDistanceKilometers} ` +
        `actual=${actualDistance} file=${filePath}`,
      );
    }

    if (manifest.initialState) {
      try {
        await page.evaluate((initialState) => {
          window.__mercury?.camera?.setState?.(initialState);
        }, manifest.initialState);
      } catch {
        // Best effort restoration only.
      }
    }

    await writeManifest(outDir, manifest);
  }

  await context.close();
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
  await stopDevServer(devServer);
}

async function readCameraState(page) {
  try {
    return await page.evaluate(() => {
      const camera = window.__mercury?.camera;
      if (!camera || typeof camera.state !== "function") return null;
      return camera.state();
    });
  } catch {
    return null;
  }
}

async function writeManifest(dir, manifest) {
  await writeFile(resolve(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function formatDistanceCompact(value) {
  // JS number-to-string is already non-exponential for the magnitudes this
  // ladder deals in (e.g. 1e6 -> "1000000"), so this is mostly a documented
  // no-op guard against exotic inputs like NaN/Infinity.
  if (!Number.isFinite(value)) return String(value);
  return String(value);
}

async function ensureDevServer({ baseUrl, outDir }) {
  if (await isReachable(baseUrl)) {
    return null;
  }

  const logPath = resolve(outDir, "dev-server.log");
  const logFd = openSync(logPath, "a");
  const child = spawn("pnpm", ["dev"], {
    cwd: REPO_ROOT,
    stdio: ["ignore", logFd, logFd],
    detached: true,
  });
  closeSync(logFd);

  const readyUrl = new URL("/mercury/", baseUrl).href;
  const deadline = Date.now() + DEV_SERVER_READY_TIMEOUT_MS;
  let lastError = null;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `pnpm dev exited early with code ${child.exitCode}; see ${logPath}`,
      );
    }
    try {
      const response = await fetch(readyUrl, {
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      if (response.status === 200) {
        return child;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((accept) => setTimeout(accept, 500));
  }
  await stopDevServer(child);
  throw new Error(
    `Dev server did not become ready within ${DEV_SERVER_READY_TIMEOUT_MS}ms` +
    (lastError ? `: ${lastError.message}` : "") + `; see ${logPath}`,
  );
}

async function isReachable(baseUrl) {
  try {
    await fetch(baseUrl, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    return true;
  } catch {
    return false;
  }
}

async function stopDevServer(child) {
  if (!child || child.exitCode !== null) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    // Process may already be gone.
  }
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && child.exitCode === null) {
    await new Promise((accept) => setTimeout(accept, 100));
  }
  if (child.exitCode === null) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      // Best effort.
    }
  }
}

function parseViewport(value) {
  if (!value) return { width: 1440, height: 900 };
  const match = /^(\d+)x(\d+)$/.exec(value);
  if (!match) throw new TypeError(`--viewport must look like WxH, got "${value}"`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

function parseDistances(value) {
  if (!value) return DEFAULT_DISTANCES_KM;
  return value.split(",").map((token) => {
    const number = Number(token.trim());
    if (!Number.isFinite(number)) {
      throw new TypeError(`--distances contains a non-numeric value: "${token}"`);
    }
    return number;
  });
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
