import { createHash } from "node:crypto";
import {
  mkdir,
  open,
  readFile,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

import sharp from "sharp";

import {
  getStreamingProgress,
  getCurrentVersion,
  getViewInfo,
  saveScreenShot,
  setViewInfo,
  waitForStreaming,
} from "./controller.mjs";
import { createPixelmatchTriptych } from "./triptych.mjs";

const workspaceRoot = resolve(import.meta.dirname, "../../../../../..");
const layerOracleRoot = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/layer-oracles",
);
const layerOracleManifestPath = resolve(layerOracleRoot, "manifest.json");
const liveEvidenceRoot = resolve(
  workspaceRoot,
  "output/playwright/google-earth-pro-mars-live-layer-matrix-v1",
);
const outputArgument = process.argv.slice(2).find((value) =>
  !value.startsWith("--"));
const outputRoot = resolve(outputArgument ?? resolve(
  liveEvidenceRoot,
  `run-${new Date().toISOString().replaceAll(/[:.]/gu, "-")}`,
));
const controlFilePath = resolve(liveEvidenceRoot, "mode.bin");
const controlLogPath = resolve(liveEvidenceRoot, "control.tsv");
const programAuditPath = resolve(liveEvidenceRoot, "programs.tsv");
const installLogPath = resolve(liveEvidenceRoot, "install.tsv");
const canonicalAppPath = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/patched/" +
    "Google Earth Pro Mars Oracle.app",
);
const canonicalExecutablePath = resolve(
  canonicalAppPath,
  "Contents/MacOS/Google Earth",
);
const canonicalBundleIdentifier = "dev.polycss.GoogleEarthProMarsOracle";
const canonicalAppName = `id:${canonicalBundleIdentifier}`;
const canonicalEventLogPath = resolve(
  workspaceRoot,
  "output/playwright/" +
    "google-earth-pro-mars-oracle-20260902-headless-final-v5/events.jsonl",
);
const windowAuditPath = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/patched/window-audit",
);
const viewport = Object.freeze({ width: 2092, height: 1295 });
const comparisonCrop = Object.freeze({
  left: 0,
  top: 80,
  width: 2092,
  height: 1070,
});
const distance = 11_000_000;
const layerOracleManifest = JSON.parse(
  await readFile(layerOracleManifestPath, "utf8"),
);

assertSafeOutputRoot(outputRoot);
await mkdir(liveEvidenceRoot, { recursive: true });
await mkdir(outputRoot, { recursive: true });
const liveOracle = await ensureLiveOracle();

if (process.argv.includes("--texture-audit-only")) {
  const auditPlan = Object.freeze({
    ...statePlan(
      "texture-upload-audit",
      "textured",
      true,
      true,
      "unaltered renderer texture upload inventory",
    ),
    textureMode: "audit",
  });
  const auditRoot = resolve(outputRoot, auditPlan.id);
  await mkdir(auditRoot, { recursive: true });
  const audit = await withOracleProcess(
    auditPlan,
    auditRoot,
    async ({ appName, headless }) => {
      await setViewInfo({
        latitude: 0,
        longitude: 0,
        distance,
        tilt: 0,
        azimuth: 0,
        speed: 10,
        appName,
      });
      await waitForStreaming({ appName });
      const capture = await saveScreenShot({
        path: resolve(auditRoot, "audit"),
        appName,
      });
      await new Promise((accept) => setTimeout(accept, 500));
      const programAudit = await readLayerAudit(programAuditPath);
      return Object.freeze({
        headless,
        capture,
        programs: Object.freeze(programAudit),
      });
    },
  );
  const auditPath = resolve(auditRoot, "texture-upload-audit.json");
  await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    auditPath,
    programCount: audit.programs.length,
    groundProgramCount: audit.programs.filter(({ hasGroundTexture }) =>
      hasGroundTexture).length,
    skyMapProgramCount: audit.programs.filter(({ skyMapTextureLocation }) =>
      skyMapTextureLocation >= 0).length,
    programs: audit.programs,
  }, null, 2)}\n`);
  process.exit(0);
}

const cameraCalibration = await getCameraCalibration();
const camera = Object.freeze({
  ...cameraCalibration.camera,
  distance,
  tilt: 0,
  azimuth: 0,
  speed: 10,
});
const statePlans = Object.freeze([
  statePlan("textured-surface", "textured", false, false,
    "Google surface imagery; atmosphere off; Sun off", "off"),
  statePlan("untextured-surface", "untextured", false, false,
    "constant white ground albedo; atmosphere off; Sun off", "white-ground"),
  statePlan("untextured-lit", "untextured", false, true,
    "constant white ground albedo; atmosphere off; Sun on", "white-ground"),
  statePlan("textured-lit", "textured", false, true,
    "Google surface imagery; atmosphere off; Sun on", "off"),
  statePlan("starfield", "ground-hidden", false, false,
    "ground program draws suppressed; atmosphere off; Sun off",
    "hide-ground"),
  statePlan("starfield-sun", "ground-hidden", false, true,
    "ground program draws suppressed; atmosphere off; Sun on",
    "hide-ground"),
  statePlan("starfield-atmosphere", "ground-hidden", true, false,
    "ground program draws suppressed; atmosphere on; Sun off",
    "hide-ground"),
  statePlan("composite", "textured", true, true,
    "Google surface imagery; atmosphere on; Sun on", "off"),
]);

const captures = {};
for (const plan of statePlans) {
  captures[plan.id] = await captureState(plan, camera);
}

const comparisonPaths = {};
for (const [id, leftId, rightId] of [
  ["albedo", "textured-surface", "untextured-surface"],
  ["illumination-and-sun", "untextured-surface", "untextured-lit"],
  ["sun-on-background", "starfield", "starfield-sun"],
  ["sky-atmosphere", "starfield", "starfield-atmosphere"],
  ["full-atmosphere", "textured-lit", "composite"],
]) {
  const outputPath = resolve(outputRoot, `compare-${id}.png`);
  const metrics = await createPixelmatchTriptych({
    referencePath: captures[leftId].comparisonPath,
    candidatePath: captures[rightId].comparisonPath,
    outputPath,
    threshold: 0.1,
  });
  const metricsPath = resolve(outputRoot, `compare-${id}-metrics.json`);
  await writeFile(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`);
  comparisonPaths[id] = Object.freeze({ outputPath, metricsPath, metrics });
}

const contributionPaths = Object.freeze({
  sunOnBackground: resolve(outputRoot, "layer-sun-on-background-absolute.png"),
  atmosphere: resolve(outputRoot, "layer-atmosphere-absolute.png"),
  albedo: resolve(outputRoot, "layer-albedo-absolute.png"),
  unlitGround: resolve(outputRoot, "layer-ground-unlit-positive.png"),
  litGround: resolve(outputRoot, "layer-ground-lit-positive.png"),
  illumination: resolve(outputRoot, "layer-illumination-absolute.png"),
});
await Promise.all([
  absoluteDifference(
    captures["starfield-sun"].comparisonPath,
    captures.starfield.comparisonPath,
    contributionPaths.sunOnBackground,
  ),
  absoluteDifference(
    captures.composite.comparisonPath,
    captures["textured-lit"].comparisonPath,
    contributionPaths.atmosphere,
  ),
  absoluteDifference(
    captures["textured-surface"].comparisonPath,
    captures["untextured-surface"].comparisonPath,
    contributionPaths.albedo,
  ),
  positiveDifference(
    captures["untextured-surface"].comparisonPath,
    captures.starfield.comparisonPath,
    contributionPaths.unlitGround,
  ),
  positiveDifference(
    captures["untextured-lit"].comparisonPath,
    captures["starfield-sun"].comparisonPath,
    contributionPaths.litGround,
  ),
]);
await absoluteDifference(
  contributionPaths.litGround,
  contributionPaths.unlitGround,
  contributionPaths.illumination,
);

const contactSheetPath = resolve(outputRoot, "native-layer-contact-sheet.png");
await createContactSheet({
  panels: [
    [captures["textured-surface"].comparisonPath, "TEXTURED SURFACE"],
    [captures["untextured-surface"].comparisonPath, "UNTEXTURED SURFACE"],
    [captures["untextured-lit"].comparisonPath, "UNTEXTURED + SUN LIGHT"],
    [captures["textured-lit"].comparisonPath, "TEXTURED + SUN LIGHT"],
    [captures.composite.comparisonPath, "FINAL COMPOSITE"],
    [captures.starfield.comparisonPath, "STARFIELD ONLY"],
    [captures["starfield-sun"].comparisonPath, "STARFIELD + SUN TOGGLE"],
    [captures["starfield-atmosphere"].comparisonPath,
      "STARFIELD + ATMOSPHERE"],
  ],
  outputPath: contactSheetPath,
});

const starfieldCenter = await centerDiskMean(captures.starfield.comparisonPath);
const untexturedCenter = await centerDiskMean(
  captures["untextured-surface"].comparisonPath,
);
const validation = Object.freeze({
  sourceShaderBound: layerOracleManifest.sourceFragmentShaderSha256 ===
    "bc256d14dc342c08bedad834c1bad2ea21e1b7cab9aa6aec3ab3eceec34b3be4",
  everyCaptureStable: Object.values(captures).every(({ stability }) =>
    stability.changedPixelRatioAboveTolerance <= 0.0005),
  everyCaptureHeadless: Object.values(captures).every(({ headless }) =>
    headless.visibleWindowCount === 0 && !headless.oracleOwnsForeground),
  texturePatchVisible:
    comparisonPaths.albedo.metrics.changedPixelRatio > 0.01,
  groundSuppressionVisible:
    starfieldCenter.meanRgb < untexturedCenter.meanRgb * 0.3,
  sunIlluminationDifferenceCaptured:
    comparisonPaths["illumination-and-sun"].metrics.changedPixelRatio > 0.01,
  atmosphereDifferenceCaptured:
    comparisonPaths["full-atmosphere"].metrics.changedPixels > 100,
  isolatedCapturesClassifiedByGoogleUniform:
    ["untextured-surface", "untextured-lit", "starfield",
      "starfield-sun", "starfield-atmosphere"].every((id) =>
      captures[id].instrumentation.layerAudit.some(({ hasGroundTexture }) =>
        hasGroundTexture)),
  sunOnBackgroundChangedPixels:
    comparisonPaths["sun-on-background"].metrics.changedPixels,
  centerDisk: Object.freeze({ starfieldCenter, untexturedCenter }),
});
const valid = Object.entries(validation)
  .filter(([, value]) => typeof value === "boolean")
  .every(([, value]) => value);
const evidence = Object.freeze({
  schema: "cssmars-google-earth-pro-native-layer-matrix@1",
  qualification: valid
    ? "NATIVE_LAYER_MATRIX_CAPTURED_AND_DIFFERENTIALLY_ISOLATED"
    : "INVALID_NATIVE_LAYER_MATRIX_VALIDATION_FAILED",
  generatedAt: new Date().toISOString(),
  cameraCalibration,
  camera,
  viewport,
  comparisonCrop: Object.freeze({
    ...comparisonCrop,
    reason:
      "Identical bounded crop removes the native Sun timeline at the top " +
      "and Google attribution/status chrome at the bottom.",
  }),
  stabilityCalibration: Object.freeze({
    channelTolerance: 5,
    maximumChangedPixelRatioAboveTolerance: 0.0005,
    basis:
      "The preceding complete eight-state A/A run measured about 0.10 mean " +
      "RGB-level JPEG drift. At tolerance 5 every same-state registered " +
      "pair remained below 0.00026 changed-pixel ratio.",
    calibrationEvidencePath: cameraCalibration.reusedFrom?.path ?? null,
  }),
  layerOracleManifestPath,
  captures: Object.freeze(captures),
  comparisons: Object.freeze(comparisonPaths),
  contributions: contributionPaths,
  contactSheetPath,
  validation,
  interpretation: Object.freeze({
    starfield: "direct Google capture with ground fragments discarded",
    sunOnBackground:
      "absolute registered difference of ground-hidden Sun-on and Sun-off; " +
      "this records whether Google Earth draws a celestial Sun at the " +
      "selected framing without assuming that it does",
    atmosphere:
      "absolute registered difference of textured Sun-on atmosphere-on and " +
      "atmosphere-off; includes ground and sky atmospheric contribution",
    skyAtmosphere:
      "ground-hidden atmosphere-on versus off comparison is retained " +
      "separately as the sky-only atmospheric contribution",
    albedo:
      "absolute registered difference of textured and constant-albedo ground",
    illumination:
      "absolute difference between positive ground-only Sun-on and Sun-off " +
      "registered layers; common starfield and visible Sun are removed",
    composite: "direct Google capture with surface, atmosphere, and Sun on",
  }),
});
const evidencePath = resolve(outputRoot, "layer-matrix-evidence.json");
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  ok: valid,
  qualification: evidence.qualification,
  evidencePath,
  contactSheetPath,
  camera,
  validation,
  comparisons: Object.fromEntries(Object.entries(comparisonPaths).map(
    ([id, value]) => [id, {
      changedPixels: value.metrics.changedPixels,
      changedPixelRatio: value.metrics.changedPixelRatio,
      outputPath: value.outputPath,
    }],
  )),
}, null, 2)}\n`);
if (!valid) process.exitCode = 1;

function statePlan(
  id,
  variantId,
  atmosphere,
  sun,
  description,
  textureMode = "off",
) {
  return Object.freeze({
    id,
    variantId,
    atmosphere,
    sun,
    description,
    textureMode,
  });
}

async function getCameraCalibration() {
  const sourcePath = process.env.CSSMARS_LAYER_CAMERA_CALIBRATION;
  if (sourcePath === undefined) return selectSunResponsiveCamera();
  const absoluteSourcePath = resolve(sourcePath);
  const sourceBytes = await readFile(absoluteSourcePath);
  const sourceEvidence = JSON.parse(sourceBytes.toString("utf8"));
  const calibration = sourceEvidence.cameraCalibration;
  if (calibration?.qualification !==
      "SUN_RESPONSIVE_CAMERA_SELECTED_BY_NATIVE_REGISTERED_PIXEL_DELTA" ||
      calibration.candidateCount !== 40 ||
      calibration.selectedProbe?.score?.changedPixelRatioAboveTolerance <
        0.01) {
    throw new Error("Supplied camera calibration is not a complete 40-pose sweep.");
  }
  return Object.freeze({
    ...calibration,
    reusedFrom: Object.freeze({
      qualification:
        "REUSED_FROM_COMPLETE_NATIVE_40_ENDPOINT_REGISTERED_SWEEP",
      path: absoluteSourcePath,
      sha256: createHash("sha256").update(sourceBytes).digest("hex"),
    }),
  });
}

async function selectSunResponsiveCamera() {
  const plan = statePlan(
    "sun-camera-probe",
    "untextured",
    false,
    false,
    "Sun illumination camera calibration",
    "white-ground",
  );
  const probeRoot = resolve(outputRoot, "sun-camera-probe");
  await mkdir(probeRoot, { recursive: true });
  const candidates = [-60, -30, 0, 30, 60].flatMap((latitude) =>
    Array.from({ length: 8 }, (_, longitudeIndex) => ({
      latitude,
      longitude: longitudeIndex * 45,
    })));
  return withOracleProcess(plan, probeRoot, async ({ appName }) => {
    const probes = [];
    for (const candidate of candidates) {
      await setViewInfo({
        ...candidate,
        distance,
        tilt: 0,
        azimuth: 0,
        speed: 10,
        appName,
      });
      await waitForStreaming({
        appName,
        stableReadings: 2,
        intervalMilliseconds: 125,
        timeoutMilliseconds: 15_000,
      });
      const id = `lat-${candidate.latitude}-lon-${candidate.longitude}`;
      await setLayerControl({
        mode: "white-ground",
        atmosphere: false,
        sun: false,
      });
      await new Promise((accept) => setTimeout(accept, 300));
      const unlitCapture = await saveScreenShot({
        path: resolve(probeRoot, `${id}-sun-off`),
        appName,
      });
      await setLayerControl({
        mode: "white-ground",
        atmosphere: false,
        sun: true,
      });
      await new Promise((accept) => setTimeout(accept, 500));
      const litCapture = await saveScreenShot({
        path: resolve(probeRoot, `${id}-sun-on`),
        appName,
      });
      const score = await compareDecodedImages(
        unlitCapture.path,
        litCapture.path,
        3,
        comparisonCrop,
      );
      probes.push(Object.freeze({
        id,
        camera: candidate,
        unlitCapture,
        litCapture,
        score,
      }));
    }
    probes.sort((left, right) =>
      right.score.meanAbsoluteRgbDelta - left.score.meanAbsoluteRgbDelta);
    const selected = probes[0];
    if (selected.score.changedPixelRatioAboveTolerance < 0.01) {
      throw new Error(
        "Native Sun toggle produced no material registered illumination " +
        `difference; ratio=${selected.score.changedPixelRatioAboveTolerance}.`,
      );
    }
    return Object.freeze({
      qualification:
        "SUN_RESPONSIVE_CAMERA_SELECTED_BY_NATIVE_REGISTERED_PIXEL_DELTA",
      camera: selected.camera,
      selectedProbe: selected,
      candidateCount: probes.length,
      candidates: Object.freeze(probes),
    });
  });
}

async function captureState(plan, requestedCamera) {
  const stateRoot = resolve(outputRoot, plan.id);
  await mkdir(stateRoot, { recursive: true });
  return withOracleProcess(plan, stateRoot, async ({ appName, headless }) => {
    const immediateObservedCamera = await setViewInfo({
      ...requestedCamera,
      appName,
    });
    const streaming = await waitForStreaming({ appName });
    const settledObservedCamera = await getViewInfo({ appName });
    const streamingProgressAtCapture = await getStreamingProgress({ appName });
    const first = await saveScreenShot({
      path: resolve(stateRoot, "stability-a"),
      appName,
    });
    await new Promise((accept) => setTimeout(accept, 300));
    const second = await saveScreenShot({
      path: resolve(stateRoot, "stability-b"),
      appName,
    });
    const stability = await compareDecodedImages(
      first.path,
      second.path,
      5,
      comparisonCrop,
    );
    const comparisonPath = resolve(stateRoot, "comparison.png");
    await sharp(second.path).rotate().extract(comparisonCrop).png()
      .toFile(comparisonPath);
    const layerAudit = await readLayerAudit(headless.layerAuditLogPath);
    const controlHistory = await readControlLog(controlLogPath);
    return Object.freeze({
      plan,
      requestedCamera,
      immediateObservedCamera,
      settledObservedCamera,
      streaming,
      streamingProgressAtCapture,
      first,
      second,
      stability,
      comparisonPath,
      comparisonSha256: await fileSha256(comparisonPath),
      headless,
      instrumentation: Object.freeze({
        eventLogPath: headless.eventLogPath,
        layerAudit: Object.freeze(layerAudit),
        controlHistory: Object.freeze(controlHistory),
      }),
    });
  });
}

async function withOracleProcess(plan, stateRoot, operation) {
  await setLayerControl({
    mode: plan.textureMode,
    atmosphere: plan.atmosphere,
    sun: plan.sun,
  });
  await new Promise((accept) => setTimeout(accept, 2_000));
  const audit = auditWindows(liveOracle.pid);
  const headless = Object.freeze({
    ...liveOracle,
    variantId: plan.variantId,
    eventLogPath: canonicalEventLogPath,
    layerAuditLogPath: programAuditPath,
    controlFilePath,
    controlLogPath,
    foregroundAfter: audit.frontmostApplication,
    visibleWindowCount: audit.visibleWindowCount,
    oracleOwnsForeground: audit.frontmostApplication.pid === liveOracle.pid,
    windows: audit.windows,
  });
  if (headless.visibleWindowCount !== 0 || headless.oracleOwnsForeground) {
    throw new Error(
      `Headless proof failed for ${plan.id}: ` +
        `windows=${headless.visibleWindowCount}; ` +
        `foreground=${headless.oracleOwnsForeground}.`,
    );
  }
  return operation({ appName: canonicalAppName, headless });
}

async function ensureLiveOracle() {
  const processRows = execFileSync("/bin/ps", [
    "-axo",
    "pid=,state=,command=",
  ], { encoding: "utf8" }).split("\n").map((line) => {
    const match = line.match(/^\s*(\d+)\s+(\S+)\s+(.*)$/u);
    return match === null ? null : {
      pid: Number(match[1]),
      state: match[2],
      command: match[3],
    };
  }).filter((row) => row !== null &&
    row.command === canonicalExecutablePath && !row.state.includes("E"));
  if (processRows.length !== 1) {
    throw new Error(
      "Expected exactly one healthy canonical headless Google Earth process; " +
      `found ${processRows.length}.`,
    );
  }
  const [{ pid, state }] = processRows;
  const version = await getCurrentVersion({ appName: canonicalAppName });
  const initialAudit = auditWindows(pid);
  if (initialAudit.visibleWindowCount !== 0 ||
      initialAudit.frontmostApplication.pid === pid) {
    throw new Error("Canonical Google Earth process is not headless.");
  }
  let openFiles = execFileSync("/usr/sbin/lsof", ["-p", String(pid)], {
    encoding: "utf8",
  });
  let hookLoadedAtStart = openFiles.includes(layerOracleManifest.hook.path);
  if (!hookLoadedAtStart) {
    await initializeControlFile({
      mode: "audit",
      atmosphere: true,
      sun: false,
      revision: 1,
    });
    execFileSync("/usr/bin/lldb", [
      "-b",
      "-p",
      String(pid),
      "-o",
      lldbSetEnvironment("CSSMARS_ORACLE_LAYER_MODE_FILE", controlFilePath),
      "-o",
      lldbSetEnvironment("CSSMARS_ORACLE_LAYER_AUDIT_LOG", programAuditPath),
      "-o",
      lldbSetEnvironment("CSSMARS_ORACLE_LAYER_INSTALL_LOG", installLogPath),
      "-o",
      lldbSetEnvironment("CSSMARS_ORACLE_LAYER_CONTROL_LOG", controlLogPath),
      "-o",
      `expr (void*)dlopen(${lldbString(layerOracleManifest.hook.path)}, 2)`,
      "-o",
      "detach",
      "-o",
      "quit",
    ], { stdio: "inherit", maxBuffer: 4 * 1024 * 1024 });
    await new Promise((accept) => setTimeout(accept, 1_000));
    openFiles = execFileSync("/usr/sbin/lsof", ["-p", String(pid)], {
      encoding: "utf8",
    });
  }
  if (!openFiles.includes(layerOracleManifest.hook.path)) {
    throw new Error("Layer hook did not load into canonical Google Earth.");
  }
  const installLog = await readFile(installLogPath, "utf8");
  if (!installLog.includes("reboundDrawArrays=1") ||
      !installLog.includes("reboundDrawElements=1")) {
    throw new Error("Layer hook has no proven Google draw-slot binding.");
  }
  return Object.freeze({
    pid,
    processState: state,
    appPath: canonicalAppPath,
    executablePath: canonicalExecutablePath,
    executableSha256: await fileSha256(canonicalExecutablePath),
    bundleIdentifier: canonicalBundleIdentifier,
    hookPath: layerOracleManifest.hook.path,
    hookSha256: await fileSha256(layerOracleManifest.hook.path),
    hookLoadedAtStart,
    version,
    foregroundBefore: initialAudit.frontmostApplication,
  });
}

async function initializeControlFile({
  mode,
  atmosphere,
  sun,
  revision,
}) {
  const bytes = Buffer.alloc(32);
  bytes.write(mode, 0, 15, "utf8");
  bytes[16] = atmosphere ? 49 : 48;
  bytes[17] = sun ? 49 : 48;
  bytes.writeUInt32LE(revision, 20);
  await writeFile(controlFilePath, bytes);
}

async function setLayerControl({ mode, atmosphere, sun }) {
  if (Buffer.byteLength(mode, "utf8") > 15) {
    throw new Error(`Layer mode is too long: ${mode}`);
  }
  let previous;
  try {
    previous = await readFile(controlFilePath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    previous = Buffer.alloc(32);
  }
  if (previous.length !== 32) {
    throw new Error(`Layer control file must be 32 bytes; got ${previous.length}.`);
  }
  const revision = (previous.readUInt32LE(20) + 1) >>> 0 || 1;
  const bytes = Buffer.alloc(32);
  bytes.write(mode, 0, 15, "utf8");
  bytes[16] = atmosphere ? 49 : 48;
  bytes[17] = sun ? 49 : 48;
  bytes.writeUInt32LE(revision, 20);
  const descriptor = await open(controlFilePath, "r+");
  try {
    await descriptor.write(bytes, 0, bytes.length, 0);
    await descriptor.sync();
  } finally {
    await descriptor.close();
  }
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const controls = await readControlLog(controlLogPath);
    const applied = controls.find((entry) => entry.revision === revision);
    if (applied !== undefined) {
      if (applied.atmosphere !== atmosphere || applied.sun !== sun) {
        throw new Error(`Layer control ${revision} acknowledged wrong toggles.`);
      }
      return Object.freeze({ mode, atmosphere, sun, revision, applied });
    }
    await new Promise((accept) => setTimeout(accept, 50));
  }
  throw new Error(`Layer control revision ${revision} was not acknowledged.`);
}

function lldbSetEnvironment(name, value) {
  return `expr (int)setenv(${lldbString(name)}, ${lldbString(value)}, 1)`;
}

function lldbString(value) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

async function compareDecodedImages(
  leftPath,
  rightPath,
  tolerance,
  crop = null,
) {
  const [left, right] = await Promise.all([
    normalizedRgba(leftPath, crop),
    normalizedRgba(rightPath, crop),
  ]);
  if (left.info.width !== right.info.width ||
      left.info.height !== right.info.height) {
    throw new Error("Layer stability capture dimensions differ.");
  }
  let changedPixels = 0;
  let changedPixelsAboveTolerance = 0;
  let absoluteRgbTotal = 0;
  const totalPixels = left.info.width * left.info.height;
  for (let offset = 0; offset < left.data.length; offset += 4) {
    let changed = false;
    let aboveTolerance = false;
    for (let channel = 0; channel < 3; channel += 1) {
      const delta = Math.abs(
        left.data[offset + channel] - right.data[offset + channel],
      );
      absoluteRgbTotal += delta;
      if (delta !== 0) changed = true;
      if (delta > tolerance) aboveTolerance = true;
    }
    if (changed) changedPixels += 1;
    if (aboveTolerance) changedPixelsAboveTolerance += 1;
  }
  return Object.freeze({
    width: left.info.width,
    height: left.info.height,
    channelTolerance: tolerance,
    changedPixels,
    changedPixelRatio: changedPixels / totalPixels,
    changedPixelsAboveTolerance,
    changedPixelRatioAboveTolerance:
      changedPixelsAboveTolerance / totalPixels,
    meanAbsoluteRgbDelta: absoluteRgbTotal / (totalPixels * 3),
  });
}

async function absoluteDifference(subjectPath, baselinePath, outputPath) {
  return imageDifference(subjectPath, baselinePath, outputPath, false);
}

async function positiveDifference(subjectPath, baselinePath, outputPath) {
  return imageDifference(subjectPath, baselinePath, outputPath, true);
}

async function imageDifference(
  subjectPath,
  baselinePath,
  outputPath,
  positiveOnly,
) {
  const [subject, baseline] = await Promise.all([
    normalizedRgba(subjectPath),
    normalizedRgba(baselinePath),
  ]);
  if (subject.info.width !== baseline.info.width ||
      subject.info.height !== baseline.info.height) {
    throw new Error("Layer difference dimensions differ.");
  }
  const output = Buffer.alloc(subject.data.length);
  for (let offset = 0; offset < output.length; offset += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const delta = subject.data[offset + channel] -
        baseline.data[offset + channel];
      output[offset + channel] = positiveOnly
        ? Math.max(delta, 0)
        : Math.abs(delta);
    }
    output[offset + 3] = 255;
  }
  await sharp(output, {
    raw: {
      width: subject.info.width,
      height: subject.info.height,
      channels: 4,
    },
  }).png().toFile(outputPath);
}

async function normalizedRgba(path, crop = null) {
  let pipeline = sharp(path).rotate();
  if (crop !== null) pipeline = pipeline.extract(crop);
  return pipeline.toColorspace("srgb").ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
}

async function largestBrightComponent(path, crop, minimumChannel) {
  const { data, info } = await sharp(path).rotate().extract(crop)
    .toColorspace("srgb").removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const pixelCount = info.width * info.height;
  const mask = new Uint8Array(pixelCount);
  for (let pixel = 0, offset = 0; pixel < pixelCount;
    pixel += 1, offset += info.channels) {
    mask[pixel] = Math.max(
      data[offset],
      data[offset + 1],
      data[offset + 2],
    ) >= minimumChannel ? 1 : 0;
  }
  const queue = new Int32Array(pixelCount);
  let best = { pixelCount: 0 };
  for (let start = 0; start < pixelCount; start += 1) {
    if (mask[start] !== 1) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    mask[start] = 2;
    let count = 0;
    let minX = info.width;
    let maxX = 0;
    let minY = info.height;
    let maxY = 0;
    while (head < tail) {
      const current = queue[head++];
      const x = current % info.width;
      const y = (current - x) / info.width;
      count += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      for (const neighbor of [
        current - 1,
        current + 1,
        current - info.width,
        current + info.width,
      ]) {
        const sameRow = neighbor !== current - 1 &&
          neighbor !== current + 1 ||
          Math.floor(neighbor / info.width) === y;
        if (neighbor >= 0 && neighbor < pixelCount && sameRow &&
            mask[neighbor] === 1) {
          mask[neighbor] = 2;
          queue[tail++] = neighbor;
        }
      }
    }
    if (count > best.pixelCount) {
      best = {
        pixelCount: count,
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
      };
    }
  }
  return Object.freeze(best);
}

async function centerDiskMean(path) {
  const { data, info } = await sharp(path).rotate().toColorspace("srgb")
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const centerX = info.width / 2;
  const centerY = info.height / 2;
  const radiusSquared = 350 ** 2;
  let total = 0;
  let samples = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if ((x - centerX) ** 2 + (y - centerY) ** 2 > radiusSquared) continue;
      const offset = (y * info.width + x) * info.channels;
      total += data[offset] + data[offset + 1] + data[offset + 2];
      samples += 3;
    }
  }
  return Object.freeze({ meanRgb: total / samples, radiusPixels: 350 });
}

async function createContactSheet({ panels, outputPath }) {
  const panelWidth = 600;
  const imageHeight = 330;
  const labelHeight = 38;
  const panelHeight = imageHeight + labelHeight;
  const columns = 4;
  const rows = Math.ceil(panels.length / columns);
  const composites = [];
  for (let index = 0; index < panels.length; index += 1) {
    const [path, label] = panels[index];
    const left = index % columns * panelWidth;
    const top = Math.floor(index / columns) * panelHeight;
    const image = await sharp(path).resize(panelWidth, imageHeight, {
      fit: "fill",
    }).png().toBuffer();
    const caption = await sharp(Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" width="${panelWidth}"
           height="${labelHeight}">
        <rect width="100%" height="100%" fill="#050505"/>
        <text x="18" y="27" fill="#f3f3f3" font-size="21"
              font-family="Arial, Helvetica, sans-serif">${label}</text>
      </svg>
    `)).png().toBuffer();
    composites.push({ input: caption, left, top });
    composites.push({ input: image, left, top: top + labelHeight });
  }
  await sharp({
    create: {
      width: panelWidth * columns,
      height: panelHeight * rows,
      channels: 4,
      background: "#000000",
    },
  }).composite(composites).png().toFile(outputPath);
}

async function readLayerAudit(path) {
  if (path === null) return [];
  try {
    return (await readFile(path, "utf8")).trim().split("\n")
      .filter(Boolean)
      .map((line) => {
        const [program, groundTextureLocation, skyMapTextureLocation,
          hasGroundTexture, mode] = line.split("\t");
        return Object.freeze({
          program: Number(program),
          groundTextureLocation: Number(groundTextureLocation),
          skyMapTextureLocation: Number(skyMapTextureLocation),
          hasGroundTexture: hasGroundTexture === "1",
          mode,
        });
      });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function readControlLog(path) {
  try {
    return (await readFile(path, "utf8")).trim().split("\n")
      .filter(Boolean)
      .map((line) => Object.freeze(Object.fromEntries(
        line.split("\t").map((field) => {
          const separator = field.indexOf("=");
          const name = field.slice(0, separator);
          const rawValue = field.slice(separator + 1);
          const value = ["revision", "pid"].includes(name)
            ? Number(rawValue)
            : ["atmosphere", "sun"].includes(name)
              ? rawValue === "1"
              : rawValue;
          return [name, value];
        }),
      )));
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

function assertSafeOutputRoot(path) {
  if (!path.startsWith(`${liveEvidenceRoot}/run-`)) {
    throw new Error(`Refusing to replace unexpected output root: ${path}`);
  }
}

async function fileSha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}
