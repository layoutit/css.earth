#!/usr/bin/env node
// Photographs Mercury's rendered body at a dense ladder of on-screen
// silhouette diameters (small, where a level-of-detail crossfade can pop),
// crops a small window around the body from each frame, and assembles the
// crops into one labelled contact sheet plus a JSON manifest. Pure tooling:
// it makes no scene-code assumptions beyond the diagnostics interface
// documented on window.__mercury, and tolerates a `sky.state().lod` field
// being present or absent.
//
// Assumes a dev server is already running at --base-url; unlike
// screenshot-ladder.mjs this script does not spawn one, and fails clearly if
// the URL is unreachable.
//
// See src/planets/mercury/test/smoke-browser.mjs for the shadows-toggle,
// skybox-hide and camera-interface conventions this script follows, and
// src/planets/mercury/tools/screenshot-ladder.mjs for the argument-parsing
// and manifest-writing conventions.

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const DEFAULT_BASE_URL = "http://127.0.0.1:4210";
const DEFAULT_OUT_DIR =
  "/private/tmp/claude-501/-Users-apresmoi-Documents-cssEarth/" +
  "77ccf69f-07a2-4417-9a0f-3e55cc967ee8/scratchpad/mercury-lod-ladder/" +
  new Date().toISOString().replace(/[:.]/gu, "-");
const DEFAULT_DIAMETERS = [
  26, 24, 22, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7.5, 7, 6.5,
  6, 5.5, 5, 4.5, 4, 3.5, 3, 2,
];
const PROBE_TIMEOUT_MS = 2000;
const SHEET_BACKGROUND = "#101010";
const SHEET_GUTTER_PX = 2;
const HEADER_HEIGHT_PX = 64;
const LABEL_HEIGHT_PX = 56;

const options = parseArguments(process.argv.slice(2));
const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
const outDir = resolve(options.out ?? DEFAULT_OUT_DIR);
const viewport = parseViewport(options.viewport);
const deviceScaleFactor = options.dpr === undefined ? 2 : Number(options.dpr);
const diameters = parseDiameters(options.diameters);
const requestedPitch = options.pitch === undefined ? undefined : Number(options.pitch);
const requestedYaw = options.yaw === undefined ? undefined : Number(options.yaw);
const shadowsOn = parseBoolean(options.shadows, true);
const hideSky = parseBoolean(options.hideSky, true);
const orbitOn = parseBoolean(options.orbit, true);
const lensId = options.lens;
const cropPx = options.crop === undefined ? 40 : Number(options.crop);
const scale = options.scale === undefined ? 8 : Number(options.scale);
const columns = options.columns === undefined ? 9 : Number(options.columns);
const label = options.label ?? "";
const settleMs = options.settleMs === undefined ? 150 : Number(options.settleMs);

await mkdir(outDir, { recursive: true });

if (!(await isReachable(baseUrl))) {
  console.error(
    `Base URL ${baseUrl} is not reachable. This script does not start a dev ` +
    `server; start one first (or pass --base-url pointing at a running one).`,
  );
  process.exitCode = 1;
  process.exit(1);
}

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
  // Fresh context per run: asset URLs carry no content hash, so a warm cache
  // from a previous run could serve stale textures.
  const context = await browser.newContext({ viewport, deviceScaleFactor });
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
    outDir,
    settings: {
      viewport,
      dpr: deviceScaleFactor,
      diameters,
      pitch: requestedPitch,
      yaw: requestedYaw,
      shadows: shadowsOn ? "on" : "off",
      hideSky,
      crop: cropPx,
      scale,
      columns,
      label,
      settleMs,
    },
    startedAt: new Date().toISOString(),
    steps: [],
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
      await page.evaluate(() => window.__mercury?.pause?.());
    } catch (error) {
      consoleLog.push(`pause() threw: ${error instanceof Error ? error.message : String(error)}`);
    }

    await setShadows(page, shadowsOn, consoleLog);
    await setOrbit(page, orbitOn, consoleLog);
    if (lensId !== undefined) {
      try {
        await page.evaluate((id) => window.__mercury.lenses.select(id), lensId);
      } catch (error) {
        consoleLog.push(`lens select threw: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (hideSky) {
      try {
        await page.evaluate(() => {
          const skybox = document.querySelector(".mercury-skybox");
          if (skybox) skybox.style.visibility = "hidden";
        });
      } catch (error) {
        consoleLog.push(`hide-sky threw: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const stats = await page.evaluate(() => window.__mercury.camera.stats());
    const pitch = requestedPitch ?? stats.defaultControlPitchDegrees;
    const yaw = requestedYaw ?? stats.defaultControlYawDegrees;
    manifest.settings.pitch = pitch;
    manifest.settings.yaw = yaw;

    const paddingWidth = Math.max(2, String(diameters.length).length);
    for (let index = 0; index < diameters.length; index += 1) {
      const requestedDiameter = diameters[index];
      const zoom = 1.1 * requestedDiameter / 460;
      const problemsStartIndex = consoleLog.length;

      const setStateResult = await page.evaluate((params) => {
        try {
          const camera = window.__mercury?.camera;
          if (!camera || typeof camera.setState !== "function") {
            return { ok: false, error: "camera.setState is not available", state: null };
          }
          camera.setState(params);
          return { ok: true, error: null };
        } catch (error) {
          return {
            ok: false,
            error: (error && (error.stack || error.message)) || String(error),
          };
        }
      }, { zoom, controlPitch: pitch, controlYaw: yaw });

      if (!setStateResult.ok) {
        consoleLog.push(`setState error: ${setStateResult.error}`);
      }

      await nextPaint(page);
      await page.waitForTimeout(settleMs);

      const [cameraState, skyState] = await Promise.all([
        readCameraState(page),
        readSkyState(page),
      ]);

      const box = await page.locator(".mercury-camera").boundingBox();
      if (!box) {
        consoleLog.push(`rung ${index}: .mercury-camera has no bounding box`);
      }
      const clip = box ? clampClip({
        x: box.x + box.width / 2 - cropPx / 2,
        y: box.y + box.height / 2 - cropPx / 2,
        width: cropPx,
        height: cropPx,
      }, viewport) : { x: 0, y: 0, width: cropPx, height: cropPx };

      const diameterLabel = formatDiameterCompact(requestedDiameter);
      const fileName =
        `${String(index).padStart(paddingWidth, "0")}-d${diameterLabel}px.png`;
      const filePath = resolve(outDir, fileName);
      await page.screenshot({ path: filePath, clip });

      if (index === 0) {
        await page.screenshot({ path: resolve(outDir, "full-first.png") });
      }
      if (index === diameters.length - 1) {
        await page.screenshot({ path: resolve(outDir, "full-last.png") });
      }

      const problems = consoleLog.slice(problemsStartIndex);
      const measuredDiameter = typeof cameraState?.silhouetteRadius === "number"
        ? cameraState.silhouetteRadius * 2
        : null;

      manifest.steps.push({
        index,
        requestedDiameter,
        zoom,
        clip,
        state: cameraState,
        sky: skyState,
        measuredDiameter,
        file: filePath,
        problems,
      });

      console.log(
        `[${index}] d=${requestedDiameter} ` +
        `measured=${measuredDiameter === null ? "n/a" : measuredDiameter.toFixed(2)} ` +
        `file=${filePath}`,
      );
    }

    manifest.problems = consoleLog;

    const sheetPath = resolve(outDir, "sheet.png");
    await buildContactSheet({
      steps: manifest.steps,
      sheetPath,
      scale,
      columns,
      label,
      pitch,
      yaw,
      dpr: deviceScaleFactor,
      shadowsOn,
      viewport,
    });
    manifest.sheet = sheetPath;
    console.log(sheetPath);

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
}

async function setOrbit(page, wantOn, consoleLog) {
  try {
    const current = await page.locator('input[name="orbit"]').evaluate(
      (control) => control.checked,
    );
    if (current === wantOn) return;
    await page.locator('input[name="orbit"]').evaluate((control, value) => {
      control.checked = value;
      control.dispatchEvent(new Event("change", { bubbles: true }));
    }, wantOn);
  } catch (error) {
    consoleLog.push(`orbit toggle threw: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function setShadows(page, wantOn, consoleLog) {
  try {
    const current = await page.locator('input[name="shadows"]').evaluate(
      (control) => control.checked,
    );
    if (current === wantOn) return;
    await page.locator('input[name="shadows"]').evaluate((control, value) => {
      control.checked = value;
      control.dispatchEvent(new Event("change", { bubbles: true }));
    }, wantOn);
  } catch (error) {
    consoleLog.push(`shadows toggle threw: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function nextPaint(page) {
  await page.evaluate(() => new Promise((accept) =>
    requestAnimationFrame(() => requestAnimationFrame(accept))));
}

async function readCameraState(page) {
  try {
    return await page.evaluate(() => window.__mercury?.camera?.state?.() ?? null);
  } catch {
    return null;
  }
}

async function readSkyState(page) {
  try {
    return await page.evaluate(() => window.__mercury?.sky?.state?.() ?? null);
  } catch {
    return null;
  }
}

function clampClip(clip, viewport) {
  const x = Math.min(Math.max(0, clip.x), Math.max(0, viewport.width - clip.width));
  const y = Math.min(Math.max(0, clip.y), Math.max(0, viewport.height - clip.height));
  return { x, y, width: clip.width, height: clip.height };
}

async function writeManifest(dir, manifest) {
  await writeFile(resolve(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function buildContactSheet({
  steps, sheetPath, scale, columns, label, pitch, yaw, dpr, shadowsOn, viewport,
}) {
  const tileMetadata = await Promise.all(
    steps.map((step) => sharp(step.file).metadata()),
  );
  const tileImages = await Promise.all(
    steps.map((step, index) => sharp(step.file)
      .resize(
        tileMetadata[index].width * scale,
        tileMetadata[index].height * scale,
        { kernel: "nearest" },
      )
      .png()
      .toBuffer()),
  );
  const tileWidth = tileMetadata[0].width * scale;
  const tileHeight = tileMetadata[0].height * scale;
  const cellWidth = tileWidth;
  const cellHeight = tileHeight + LABEL_HEIGHT_PX;
  const rows = Math.ceil(steps.length / columns);

  const sheetWidth = columns * cellWidth + (columns - 1) * SHEET_GUTTER_PX;
  const sheetHeight = HEADER_HEIGHT_PX + rows * cellHeight +
    (rows - 1) * SHEET_GUTTER_PX;

  const composites = [];
  composites.push({
    input: headerSvg({ width: sheetWidth, height: HEADER_HEIGHT_PX, label, pitch, yaw, dpr, shadowsOn, viewport }),
    left: 0,
    top: 0,
  });

  for (let index = 0; index < steps.length; index += 1) {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const left = column * (cellWidth + SHEET_GUTTER_PX);
    const top = HEADER_HEIGHT_PX + row * (cellHeight + SHEET_GUTTER_PX);
    composites.push({ input: tileImages[index], left, top });
    composites.push({
      input: labelSvg({ width: tileWidth, height: LABEL_HEIGHT_PX, step: steps[index] }),
      left,
      top: top + tileHeight,
    });
  }

  await sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 4,
      background: SHEET_BACKGROUND,
    },
  }).composite(composites).png().toFile(sheetPath);
}

function headerSvg({ width, height, label, pitch, yaw, dpr, shadowsOn, viewport }) {
  const line = `label=${label || "(none)"}  pitch=${formatNumber(pitch)} ` +
    `yaw=${formatNumber(yaw)}  dpr=${dpr}  shadows=${shadowsOn ? "on" : "off"} ` +
    `viewport=${viewport.width}x${viewport.height}`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<rect width="100%" height="100%" fill="${SHEET_BACKGROUND}"/>` +
    `<text x="14" y="26" fill="#f4f6f8" font-size="18" ` +
    `font-family="Menlo,monospace">Mercury LOD ladder</text>` +
    `<text x="14" y="48" fill="#a9b0ba" font-size="14" ` +
    `font-family="Menlo,monospace">${escapeXml(line)}</text>` +
    "</svg>",
  );
}

function labelSvg({ width, height, step }) {
  const measured = step.measuredDiameter === null
    ? "n/a"
    : step.measuredDiameter.toFixed(1);
  const materialFrame = step.sky?.materialFrame ?? "n/a";
  const line1 = `d=${step.requestedDiameter} (${measured}) f=${materialFrame}`;
  const line2 = formatSkySecondLine(step.sky);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<rect width="100%" height="100%" fill="${SHEET_BACKGROUND}"/>` +
    `<text x="8" y="20" fill="#f4f6f8" font-size="14" ` +
    `font-family="Menlo,monospace">${escapeXml(line1)}</text>` +
    `<text x="8" y="40" fill="#8fd0ff" font-size="13" ` +
    `font-family="Menlo,monospace">${escapeXml(line2)}</text>` +
    "</svg>",
  );
}

function formatSkySecondLine(sky) {
  if (sky && typeof sky.lod === "object" && sky.lod !== null) {
    const parts = Object.entries(sky.lod).map(([key, value]) =>
      `${key}=${typeof value === "number" ? value.toFixed(2) : value}`);
    return parts.join(" ");
  }
  return `marker=${formatNumber(sky?.bodyMarkerOpacity)}`;
}

function formatNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return String(value);
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatDiameterCompact(value) {
  if (!Number.isFinite(value)) return String(value);
  return String(value);
}

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

async function isReachable(baseUrl) {
  try {
    await fetch(baseUrl, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    return true;
  } catch {
    return false;
  }
}

function parseDiameters(value) {
  if (!value) return DEFAULT_DIAMETERS;
  return value.split(",").map((token) => {
    const number = Number(token.trim());
    if (!Number.isFinite(number)) {
      throw new TypeError(`--diameters contains a non-numeric value: "${token}"`);
    }
    return number;
  });
}

function parseBoolean(value, defaultValue) {
  if (value === undefined) return defaultValue;
  return !["false", "0", "off", "no"].includes(String(value).toLowerCase());
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
