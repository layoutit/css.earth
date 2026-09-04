import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PNG } from "pngjs";
import sharp from "sharp";

import {
  getCurrentVersion,
  getPointOnTerrain,
  getStreamingProgress,
  getViewInfo,
  saveScreenShot,
  setViewInfo,
  waitForStreaming,
} from "./controller.mjs";

const STABILITY_CHANNEL_TOLERANCE = 3;

const outputRoot = resolve(
  process.argv[2] ??
    "output/playwright/google-earth-pro-mars-oracle-interaction",
);
const requestedCamera = Object.freeze({
  latitude: numberArgument("--latitude", 0),
  longitude: numberArgument("--longitude", 0),
  distance: numberArgument("--distance", 11_000_000),
  tilt: numberArgument("--tilt", 0),
  azimuth: numberArgument("--azimuth", 0),
  speed: 10,
});
const eventLogPath = resolve(
  stringArgument("--event-log") ??
    process.env.CSSMARS_ORACLE_EVENT_LOG ??
    resolve(outputRoot, "../events.jsonl"),
);

await mkdir(outputRoot, { recursive: true });
const startedAt = new Date().toISOString();
const before = await getViewInfo();
const version = await getCurrentVersion();
const instrumentationBefore = await readInstrumentationEvents(eventLogPath);
const immediateObservedCamera = await setViewInfo(requestedCamera);
const streaming = await waitForStreaming();
const settledObservedCamera = await getViewInfo();
const instrumentationAfter = await readInstrumentationEvents(eventLogPath);
const terrain = [];
for (const y of [-0.75, 0, 0.75]) {
  for (const x of [-0.75, 0, 0.75]) {
    terrain.push(await getPointOnTerrain({ x, y }));
  }
}
const streamingProgressAtCapture = await getStreamingProgress();
const firstCapture = await saveScreenShot({
  path: resolve(outputRoot, "native-stability-a"),
});
const secondCapture = await saveScreenShot({
  path: resolve(outputRoot, "native-stability-b"),
});
const stability = await compareDecodedImages(
  firstCapture.path,
  secondCapture.path,
);
const captureMetadata = await sharp(secondCapture.path).metadata();

const evidence = Object.freeze({
  schema: "cssmars-google-earth-pro-interaction-evidence@1",
  qualification: stability.changedPixelRatioAboveTolerance <= 0.0005
    ? "NATIVE_INTERACTION_CAPTURE_STABLE"
    : "INVALID_NATIVE_INTERACTION_CAPTURE_UNSTABLE",
  startedAt,
  completedAt: new Date().toISOString(),
  version,
  interaction: Object.freeze({
    kind: "SetViewInfo",
    requestedCamera,
    before,
    immediateObservedCamera,
    settledObservedCamera,
    normalizationDelta: numericDelta(requestedCamera, settledObservedCamera),
  }),
  streaming,
  streamingProgressAtCapture,
  instrumentation: Object.freeze({
    eventLogPath,
    before: instrumentationBefore,
    after: instrumentationAfter,
  }),
  terrain: Object.freeze(terrain),
  captures: Object.freeze({
    first: firstCapture,
    second: secondCapture,
    metadata: captureMetadata,
    stability,
  }),
  missingFromPublicApi: Object.freeze([
    "vertical field of view",
    "camera roll",
    "renderer epoch",
    "Sun vector",
    "atmosphere coefficients after final composite",
  ]),
  inferenceInputsRecorded: Object.freeze([
    "planet silhouette and center from native capture",
    "terrain intersection grid",
    "requested-to-observed camera normalization",
    "menu toggle marks",
    "decoded-frame stability",
  ]),
});
const evidencePath = resolve(outputRoot, "interaction-evidence.json");
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ ok: true, evidencePath, ...evidence }, null, 2)}\n`);

async function compareDecodedImages(leftPath, rightPath) {
  const [leftBytes, rightBytes] = await Promise.all([
    normalizedPng(leftPath),
    normalizedPng(rightPath),
  ]);
  const left = PNG.sync.read(leftBytes);
  const right = PNG.sync.read(rightBytes);
  if (left.width !== right.width || left.height !== right.height) {
    throw new Error("Native stability captures have different dimensions.");
  }
  let changedPixels = 0;
  let changedPixelsAboveTolerance = 0;
  let absoluteRgbTotal = 0;
  for (let index = 0; index < left.data.length; index += 4) {
    let changed = false;
    let maximumChannelDelta = 0;
    for (let channel = 0; channel < 3; channel += 1) {
      const delta = Math.abs(
        left.data[index + channel] - right.data[index + channel],
      );
      absoluteRgbTotal += delta;
      maximumChannelDelta = Math.max(maximumChannelDelta, delta);
      if (delta !== 0) changed = true;
    }
    if (changed) changedPixels += 1;
    if (maximumChannelDelta > STABILITY_CHANNEL_TOLERANCE) {
      changedPixelsAboveTolerance += 1;
    }
  }
  const totalPixels = left.width * left.height;
  return Object.freeze({
    width: left.width,
    height: left.height,
    changedPixels,
    totalPixels,
    changedPixelRatio: changedPixels / totalPixels,
    channelTolerance: STABILITY_CHANNEL_TOLERANCE,
    changedPixelsAboveTolerance,
    changedPixelRatioAboveTolerance:
      changedPixelsAboveTolerance / totalPixels,
    meanAbsoluteRgbDelta: absoluteRgbTotal / (totalPixels * 3),
    decodedPngSha256: Object.freeze({
      first: sha256(leftBytes),
      second: sha256(rightBytes),
    }),
  });
}

async function normalizedPng(path) {
  return sharp(path).rotate().toColorspace("srgb").ensureAlpha().png().toBuffer();
}

function numericDelta(requested, observed) {
  return Object.freeze(Object.fromEntries(
    ["latitude", "longitude", "distance", "tilt", "azimuth"].map((key) =>
      [key, observed[key] - requested[key]]),
  ));
}

function numberArgument(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = Number.parseFloat(process.argv[index + 1]);
  if (!Number.isFinite(value)) throw new Error(`${name} requires a number.`);
  return value;
}

function stringArgument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

async function readInstrumentationEvents(path) {
  const source = await readFile(path, "utf8");
  return Object.freeze(source.trim().split("\n").filter(Boolean).map((line) =>
    Object.freeze(compactInstrumentationEvent(JSON.parse(line)))));
}

function compactInstrumentationEvent(event) {
  if (event.event !== "runtime-state") return event;
  const trackedObjectNames = new Set([
    "mars",
    "viewMenuAtmosphere",
    "viewMenuSun",
  ]);
  return {
    event: event.event,
    stage: event.stage,
    timestamp: event.timestamp,
    processId: event.processId,
    activationPolicy: event.activationPolicy,
    menuItemCount: event.menus?.length ?? 0,
    windows: (event.windows ?? []).map(({ title, visible, level, frame }) =>
      ({ title, visible, level, frame })),
    qtActions: (event.qtActions ?? []).filter(({ objectName }) =>
      trackedObjectNames.has(objectName)),
  };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
