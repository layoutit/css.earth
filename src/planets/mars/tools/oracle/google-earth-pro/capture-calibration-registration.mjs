import { createHash } from "node:crypto";
import { execFile, execFileSync } from "node:child_process";
import {
  access,
  mkdir,
  open,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

import sharp from "sharp";

import {
  getCurrentVersion,
  getViewInfo,
  saveScreenShot,
  setViewInfo,
  waitForStreaming,
} from "./controller.mjs";

const execFileAsync = promisify(execFile);
const workspaceRoot = resolve(import.meta.dirname, "../../../../../..");
const evidenceRoot = resolve(
  workspaceRoot,
  "output/playwright/google-earth-pro-mars-interaction-video-v1",
);
const options = parseArguments(process.argv.slice(2));
const outputRoot = resolve(options.output);
const launchRoot = resolve(outputRoot, "launch");
const rawRoot = resolve(outputRoot, "google-rgba");
const mappingRoot = resolve(outputRoot, "mapping");
const poseRoot = resolve(outputRoot, "poses");
const controlPath = resolve(outputRoot, "mode.bin");
const layerAuditPath = resolve(outputRoot, "programs.tsv");
const controlLogPath = resolve(outputRoot, "control.tsv");
const installLogPath = resolve(outputRoot, "install.tsv");
const drawAuditPath = resolve(outputRoot, "draws.jsonl");
const bindingLogPath = resolve(outputRoot, "bindings.jsonl");
const mappingPath = resolve(mappingRoot, "texture-map.tsv");
const cacheIndexPath = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/calibration/google-cache-index.json",
);
const reportPath = resolve(outputRoot, "registration.json");
const contactSheetPath = resolve(outputRoot, "contact-sheet.png");
const appPath = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/patched/" +
    "Google Earth Pro Mars Oracle.app",
);
const executablePath = resolve(appPath, "Contents/MacOS/Google Earth");
const bundleIdentifier = "dev.polycss.GoogleEarthProMarsOracle";
const appName = `id:${bundleIdentifier}`;
const launchScript = resolve(import.meta.dirname, "launch-headless.mjs");
const calibrationScript = resolve(
  import.meta.dirname,
  "prepare-calibration-surface.mjs",
);
const cacheExportScript = resolve(
  import.meta.dirname,
  "export-google-imagery-cache.mjs",
);
const calibrationMapScript = resolve(
  import.meta.dirname,
  "prepare-google-calibration-map.mjs",
);
const layerManifestPath = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/layer-oracles/manifest.json",
);
const calibrationManifestPath = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/calibration/manifest.json",
);
const calibrationMasterPath = resolve(
  calibrationManifestPath,
  "../mars-calibration-equirectangular.png",
);
const windowAuditPath = resolve(
  workspaceRoot,
  ".local/oracles/google-earth-pro/patched/window-audit",
);
const poses = Object.freeze([
  pose("equator-prime-default", 0, 0, 11_000_000, ["equator", "prime"]),
  pose("equator-east-default", 0, 90, 11_000_000, ["equator"]),
  pose("seam-east-default", 0, 179, 11_000_000, ["equator", "seam"]),
  pose("seam-west-default", 0, -179, 11_000_000, ["equator", "seam"]),
  pose("north-mid-default", 45, 0, 11_000_000, ["north", "prime"]),
  pose("south-mid-default", -45, 90, 11_000_000, ["south"]),
  pose("north-high-default", 75, -135, 11_000_000, ["north"]),
  pose("south-high-default", -75, 135, 11_000_000, ["south"]),
  pose("north-pole-default", 89, 0, 11_000_000, ["north", "pole"]),
  pose("south-pole-default", -89, 0, 11_000_000, ["south", "pole"]),
  pose("north-east-near", 20, 45, 8_500_000, ["north", "near"]),
  pose("south-west-far", -20, -45, 16_000_000, ["south", "far"]),
]);

if (options.renderer !== "native" || options.poses !== poses.length) {
  throw new Error(
    "This registration contract requires --renderer native --poses 12.",
  );
}
assertSafeOutputRoot(outputRoot);
const processPreflight = await assertNoLiveOracleProcesses();
await Promise.all([
  access(executablePath),
  access(windowAuditPath),
  access(layerManifestPath),
]);
await rm(outputRoot, { recursive: true, force: true });
await Promise.all([
  mkdir(launchRoot, { recursive: true }),
  mkdir(rawRoot, { recursive: true }),
  mkdir(mappingRoot, { recursive: true }),
  mkdir(poseRoot, { recursive: true }),
]);
await writeFile(mappingPath, "");
await writeLayerControl({
  mode: "cal-audit",
  atmosphere: false,
  sun: false,
  revision: 1,
});

const calibrationVerification = JSON.parse((await execFileAsync(
  process.execPath,
  [calibrationScript, "--verify"],
  { cwd: workspaceRoot, maxBuffer: 16 * 1024 * 1024 },
)).stdout);
const cacheExport = JSON.parse((await execFileAsync(
  process.execPath,
  [
    cacheExportScript,
    "--cache-root",
    resolve(process.env.HOME, "Library/Caches/Google Earth"),
    "--output",
    cacheIndexPath,
  ],
  { cwd: workspaceRoot, maxBuffer: 16 * 1024 * 1024 },
)).stdout);
const [layerManifest, calibrationManifest] = await Promise.all([
  readJson(layerManifestPath),
  readJson(calibrationManifestPath),
]);
if (layerManifest.hook.path.endsWith("_v3.dylib") === false) {
  throw new Error("Calibration registration requires the v3 draw-key hook.");
}
if (calibrationVerification.sourceDecodedRgbaSha256 !==
    calibrationManifest.source.decodedRgbaSha256) {
  throw new Error("Verified calibration source hash does not match its manifest.");
}
const masterRaw = await sharp(calibrationMasterPath)
  .toColorspace("srgb").ensureAlpha().raw().toBuffer();
if (sha256(masterRaw) !== calibrationManifest.source.decodedRgbaSha256) {
  throw new Error("Calibration master decoded bytes drifted before upload.");
}

let oraclePid = null;
let termination = null;
try {
  const launchResult = await execFileAsync(process.execPath, [
    launchScript,
    launchRoot,
  ], {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      CSSMARS_GOOGLE_EARTH_APP_PATH: appPath,
      CSSMARS_GOOGLE_EARTH_WINDOW_AUDIT: windowAuditPath,
      CSSMARS_ORACLE_ATMOSPHERE: "off",
      CSSMARS_ORACLE_SUN: "off",
    },
    maxBuffer: 4 * 1024 * 1024,
  });
  const launch = JSON.parse(launchResult.stdout);
  oraclePid = launch.pid;
  await waitForEvent((event) => event.event === "ready");
  const readyHeadless = auditWindows(oraclePid);
  assertHeadless(readyHeadless, oraclePid, "ready");
  attachHook(oraclePid, layerManifest.hook.path);
  await waitForHookInstallation(oraclePid, layerManifest.hook.path);
  await waitForControlRevision(1);
  await delay(500);

  const captures = [];
  let revision = 1;
  for (let index = 0; index < poses.length; index += 1) {
    const requested = poses[index];
    revision += 1;
    await writeLayerControl({
      mode: "cal-audit",
      atmosphere: false,
      sun: false,
      revision,
    });
    await waitForControlRevision(revision);
    const initialObservedCamera = await setViewInfo({
      ...requested.camera,
      speed: 10,
      appName,
    });
    const initialSettlement = await waitForStableCamera({ appName });
    const streaming = await waitForStreaming({
      appName,
      timeoutMilliseconds: 30_000,
      intervalMilliseconds: 250,
      stableReadings: 5,
    });
    const immediateObservedCamera = await setViewInfo({
      ...requested.camera,
      speed: 10,
      appName,
    });
    const settlement = await waitForStableCamera({ appName });
    const settledObservedCamera = settlement.camera;
    await delay(500);
    await waitForRevisionEvidence(drawAuditPath, revision);
    const auditRevision = revision;
    const mapping = JSON.parse((await execFileAsync(
      process.execPath,
      [
        calibrationMapScript,
        "--audit",
        drawAuditPath,
        "--output",
        mappingRoot,
        "--cache-index",
        cacheIndexPath,
        "--revision",
        String(auditRevision),
      ],
      { cwd: workspaceRoot, maxBuffer: 16 * 1024 * 1024 },
    )).stdout);
    if (!mapping.ok || mapping.mappingCount === 0) {
      throw new Error(`Pose ${requested.id} has no exact tile mapping.`);
    }
    const mappingReport = await readJson(mapping.reportPath);
    const uploadHashes = new Set(mappingReport.mappings.map(
      ({ calibrationTile }) => calibrationTile.uploadRgbaSha256,
    ));
    revision += 1;
    await writeLayerControl({
      mode: "cal",
      atmosphere: false,
      sun: false,
      revision,
    });
    await waitForControlRevision(revision);
    await delay(350);
    const rawCapture = await saveScreenShot({
      path: resolve(poseRoot, `${pad(index + 1)}-${requested.id}-calibration`),
      appName,
    });
    const final = await cropSceneCapture(
      rawCapture,
      resolve(poseRoot, `${pad(index + 1)}-${requested.id}-scene.png`),
    );
    await waitForStableFile(bindingLogPath, 1);
    const bindingValidation = (await readJsonLines(bindingLogPath))
      .filter((binding) => binding.revision === revision);
    if (bindingValidation.length === 0 ||
        bindingValidation.some(({ mapped, decodedRgbaSha256 }) =>
          !mapped || !uploadHashes.has(decodedRgbaSha256))) {
      throw new Error(`Pose ${requested.id} has no hash-bound calibration draws.`);
    }
    const headless = auditWindows(oraclePid);
    assertHeadless(headless, oraclePid, requested.id);
    const landmarkSignature = await analyzeLandmarkSignature(final.path);
    if (!landmarkSignature.calibrationVisible) {
      throw new Error(`Pose ${requested.id} has no visible calibration signature.`);
    }
    captures.push(Object.freeze({
      index: index + 1,
      ...requested,
      auditRevision,
      finalRevision: revision,
      initialObservedCamera,
      initialSettlement,
      immediateObservedCamera,
      settledObservedCamera,
      cameraResidual: cameraResidual(requested.camera, settledObservedCamera),
      settlement,
      streaming,
      final,
      bindingCount: bindingValidation.length,
      bindings: Object.freeze(bindingValidation),
      mapping: mappingReport,
      landmarkSignature,
      headless,
    }));
    process.stdout.write(`${JSON.stringify({
      event: "pose-complete",
      pose: requested.id,
      index: index + 1,
      bindingCount: bindingValidation.length,
    })}\n`);
  }

  await createContactSheet(captures, contactSheetPath);
  const finalAudit = auditWindows(oraclePid);
  assertHeadless(finalAudit, oraclePid, "final");
  const imageHashes = captures.map(({ final }) => final.sha256);
  const uniqueCaptureCount = new Set(imageHashes).size;
  const coverage = coverageReport(captures);
  const allDrawsMapped = captures.every(({ bindings }) =>
    bindings.length > 0) && captures.every(({ bindings, mapping }) => {
      const uploadHashes = new Set(mapping.mappings.map(
        ({ calibrationTile }) => calibrationTile.uploadRgbaSha256,
      ));
      return bindings.every((binding) =>
        binding.mapped && uploadHashes.has(binding.decodedRgbaSha256));
    });
  const allAddressesExact = captures.every(({ mapping }) =>
    mapping.qualification ===
      "EXACT_GOOGLE_DXT1_DRAWS_BOUND_TO_CALIBRATION_TILES" &&
    mapping.mappings.every(({ registrationQualification }) =>
      registrationQualification ===
        "EXACT_REVERSIBLE_BYTES_TO_GOOGLE_CACHE_QUADTREE_ADDRESS"));
  const allCamerasPaired = captures.every(({ cameraResidual }) =>
    cameraResidual.latitudeDegrees < 0.001 &&
    cameraResidual.longitudeDegrees < 0.001 &&
    cameraResidual.distanceRelative < 0.005 &&
    cameraResidual.tiltDegrees < 0.001 &&
    cameraResidual.azimuthDegrees < 0.001);
  const allHeadless = captures.every(({ headless }) =>
    headless.visibleWindowCount === 0 &&
    headless.frontmostApplication.pid !== oraclePid);
  const qualified = allDrawsMapped && allAddressesExact &&
    allCamerasPaired && allHeadless && coverage.complete &&
    uniqueCaptureCount === poses.length;
  const report = Object.freeze({
    schema: "cssmars-google-earth-pro-native-calibration-registration@1",
    qualification: qualified
      ? "NATIVE_GOOGLE_GEOMETRY_CALIBRATION_REGISTRATION_PROVEN"
      : "INVALID_NATIVE_CALIBRATION_REGISTRATION",
    generatedAt: new Date().toISOString(),
    renderer: options.renderer,
    poseCount: captures.length,
    application: Object.freeze({
      appPath,
      executablePath,
      executableSha256: await fileSha256(executablePath),
      bundleIdentifier,
      pid: oraclePid,
      version: await getCurrentVersion({ appName }),
      processPreflight,
    }),
    calibration: Object.freeze({
      manifestPath: calibrationManifestPath,
      sourceEncodedSha256: calibrationManifest.source.encodedSha256,
      sourceDecodedRgbaSha256:
        calibrationManifest.source.decodedRgbaSha256,
      masterPath: calibrationMasterPath,
      verification: calibrationVerification,
    }),
    instrumentation: Object.freeze({
      layerManifestPath,
      hookPath: layerManifest.hook.path,
      hookSha256: await fileSha256(layerManifest.hook.path),
      controlPath,
      layerAuditPath,
      drawAuditPath,
      bindingLogPath,
      cacheIndexPath,
      cacheIndexSha256: await fileSha256(cacheIndexPath),
      cacheExport,
      registrationContract:
        "single proven reversible byte transform from loaded DXT1 to " +
        "Google cache quadtree address",
      atmosphere: false,
      sun: false,
    }),
    gates: Object.freeze({
      allDrawsMapped,
      allAddressesExact,
      allCamerasPaired,
      cameraPairingTolerance: Object.freeze({
        latitudeDegrees: 0.001,
        longitudeDegrees: 0.001,
        distanceRelative: 0.005,
        tiltDegrees: 0.001,
        azimuthDegrees: 0.001,
        interpretation:
          "requested navigation endpoint paired to the stable native endpoint; " +
          "distance includes Google terrain-relative adjustment",
      }),
      allHeadless,
      uniqueCaptureCount,
      expectedUniqueCaptureCount: poses.length,
      coverage,
    }),
    contactSheet: Object.freeze({
      path: contactSheetPath,
      sha256: await fileSha256(contactSheetPath),
    }),
    readyHeadless,
    finalHeadless: finalAudit,
    captures: Object.freeze(captures),
  });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  if (!qualified) {
    throw new Error(`Native calibration registration is invalid: ${reportPath}`);
  }
  process.stdout.write(`${JSON.stringify({
    ok: true,
    reportPath,
    qualification: report.qualification,
    poseCount: report.poseCount,
    sourceDecodedRgbaSha256:
      report.calibration.sourceDecodedRgbaSha256,
    contactSheetPath,
    gates: report.gates,
  }, null, 2)}\n`);
} finally {
  if (oraclePid !== null) {
    termination = await terminateExactProcess(oraclePid);
    await writeFile(resolve(outputRoot, "termination.json"),
      `${JSON.stringify(termination, null, 2)}\n`);
  }
}

function pose(id, latitude, longitude, distance, coverage) {
  return Object.freeze({
    id,
    camera: Object.freeze({
      latitude,
      longitude,
      distance,
      tilt: 0,
      azimuth: 0,
    }),
    coverage: Object.freeze(coverage),
  });
}

function attachHook(pid, hookPath) {
  execFileSync("/usr/bin/lldb", [
    "-b",
    "-p",
    String(pid),
    "-o",
    lldbSetEnvironment("CSSMARS_ORACLE_LAYER_MODE_FILE", controlPath),
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

async function waitForHookInstallation(pid, hookPath) {
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
  throw new Error("Calibration layer hook was not bound to Google draw calls.");
}

async function writeLayerControl({ mode, atmosphere, sun, revision }) {
  if (Buffer.byteLength(mode) > 15) throw new Error("Layer mode is too long.");
  const bytes = Buffer.alloc(32);
  bytes.write(mode, 0, 15, "utf8");
  bytes[16] = atmosphere ? 49 : 48;
  bytes[17] = sun ? 49 : 48;
  bytes.writeUInt32LE(revision, 20);
  try {
    const descriptor = await open(controlPath, "r+");
    try {
      await descriptor.write(bytes, 0, bytes.length, 0);
      await descriptor.sync();
    } finally {
      await descriptor.close();
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await writeFile(controlPath, bytes);
  }
}

async function waitForControlRevision(revision) {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    try {
      const rows = (await readFile(controlLogPath, "utf8")).trim()
        .split("\n").filter(Boolean);
      if (rows.some((row) => row.includes(`revision=${revision}\t`) &&
          row.includes("atmosphere=0\tsun=0"))) return;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    await delay(50);
  }
  throw new Error(`Layer control revision ${revision} was not acknowledged.`);
}

async function waitForEvent(predicate, timeoutMilliseconds = 25_000) {
  const eventPath = resolve(launchRoot, "events.jsonl");
  const started = Date.now();
  while (Date.now() - started <= timeoutMilliseconds) {
    for (const event of await readJsonLines(eventPath)) {
      if (predicate(event)) return event;
    }
    await delay(50);
  }
  throw new Error("Timed out waiting for native ready evidence.");
}

async function waitForStableFile(path, minimumLines) {
  let previousSize = -1;
  let stable = 0;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const bytes = await readFile(path);
      const lineCount = bytes.toString("utf8").split("\n").filter(Boolean)
        .length;
      stable = bytes.length === previousSize && lineCount >= minimumLines
        ? stable + 1
        : 0;
      if (stable >= 3) return;
      previousSize = bytes.length;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    await delay(100);
  }
  throw new Error(`Evidence file did not settle: ${path}`);
}

async function waitForRevisionEvidence(path, revision) {
  let previousCount = -1;
  let stable = 0;
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const matches = (await readJsonLines(path)).filter((entry) =>
      entry.revision === revision);
    stable = matches.length > 0 && matches.length === previousCount
      ? stable + 1
      : 0;
    if (stable >= 10) return Object.freeze(matches);
    previousCount = matches.length;
    await delay(100);
  }
  throw new Error(
    `No stable ground-draw evidence for control revision ${revision}.`,
  );
}

async function waitForStableCamera({ appName }) {
  const started = Date.now();
  const samples = [];
  let stableReadings = 0;
  let previous = null;
  while (Date.now() - started <= 10_000) {
    const camera = await getViewInfo({ appName });
    samples.push(Object.freeze({
      elapsedMilliseconds: Date.now() - started,
      camera,
    }));
    const stable = previous !== null &&
      Math.abs(camera.latitude - previous.latitude) < 0.000_001 &&
      longitudeDistance(camera.longitude, previous.longitude) < 0.000_001 &&
      Math.abs(camera.distance - previous.distance) < 0.01 &&
      Math.abs(camera.tilt - previous.tilt) < 0.000_001 &&
      longitudeDistance(camera.azimuth, previous.azimuth) < 0.000_001;
    stableReadings = stable ? stableReadings + 1 : 0;
    if (stableReadings >= 3) {
      return Object.freeze({
        settled: true,
        elapsedMilliseconds: Date.now() - started,
        camera,
        samples: Object.freeze(samples),
      });
    }
    previous = camera;
    await delay(100);
  }
  throw new Error("Google Earth camera did not settle within 10000 ms.");
}

async function analyzeLandmarkSignature(path) {
  const { data, info } = await sharp(path).rotate().toColorspace("srgb")
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const signatures = Object.freeze({
    primeCyan: [57, 232, 241],
    seamMagenta: [244, 35, 194],
    seamYellow: [255, 214, 38],
    northCyan: [20, 203, 255],
    southOrange: [255, 112, 30],
  });
  const counts = Object.fromEntries(Object.keys(signatures).map((key) =>
    [key, 0]));
  let chromaticPixels = 0;
  let invalidCoordinatePixels = 0;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const pixel = [data[offset], data[offset + 1], data[offset + 2]];
    if (Math.hypot(
      pixel[0] - 249,
      pixel[1] - 125,
      pixel[2] - 117,
    ) <= 4) invalidCoordinatePixels += 1;
    if (Math.max(...pixel) - Math.min(...pixel) >= 38 &&
        Math.max(...pixel) >= 55) chromaticPixels += 1;
    for (const [name, color] of Object.entries(signatures)) {
      const distance = Math.hypot(
        pixel[0] - color[0],
        pixel[1] - color[1],
        pixel[2] - color[2],
      );
      if (distance <= 62) counts[name] += 1;
    }
  }
  return Object.freeze({
    width: info.width,
    height: info.height,
    chromaticPixels,
    chromaticPixelRatio: chromaticPixels / (info.width * info.height),
    invalidCoordinatePixels,
    signaturePixelCounts: Object.freeze(counts),
    calibrationVisible:
      chromaticPixels >= 250 && invalidCoordinatePixels < 100,
  });
}

async function cropSceneCapture(rawCapture, path) {
  const metadata = await sharp(rawCapture.path).metadata();
  if (!Number.isInteger(metadata.width) || !Number.isInteger(metadata.height) ||
      metadata.width < 1000 || metadata.height < 800) {
    throw new Error(
      `Native capture dimensions drifted: ${metadata.width}x${metadata.height}.`,
    );
  }
  const crop = Object.freeze({
    left: 0,
    top: 80,
    width: metadata.width,
    height: metadata.height - 225,
  });
  await sharp(rawCapture.path).extract(crop).png().toFile(path);
  return Object.freeze({
    path,
    bytes: (await sharp(path).metadata()).size,
    sha256: await fileSha256(path),
    raw: rawCapture,
    crop,
  });
}

async function createContactSheet(captures, path) {
  const tileWidth = 480;
  const imageHeight = 285;
  const labelHeight = 48;
  const tileHeight = imageHeight + labelHeight;
  const composites = [];
  for (let index = 0; index < captures.length; index += 1) {
    const capture = captures[index];
    const left = index % 3 * tileWidth;
    const top = Math.floor(index / 3) * tileHeight;
    const image = await sharp(capture.final.path).rotate().resize(
      tileWidth,
      imageHeight,
      { fit: "cover" },
    ).png().toBuffer();
    const label = Buffer.from(
      `<svg width="${tileWidth}" height="${labelHeight}">` +
      `<rect width="100%" height="100%" fill="#090b10"/>` +
      `<text x="14" y="30" fill="#f4f6f8" font-size="18" ` +
      `font-family="Menlo,monospace">${pad(index + 1)} ${capture.id}</text>` +
      "</svg>",
    );
    composites.push({ input: image, left, top });
    composites.push({ input: label, left, top: top + imageHeight });
  }
  await sharp({
    create: {
      width: tileWidth * 3,
      height: tileHeight * 4,
      channels: 3,
      background: "#000000",
    },
  }).composite(composites).png().toFile(path);
}

function coverageReport(captures) {
  const labels = new Set(captures.flatMap(({ coverage }) => coverage));
  const zooms = new Set(captures.map(({ camera }) => camera.distance));
  const required = ["equator", "north", "south", "seam", "pole", "near", "far"];
  return Object.freeze({
    labels: Object.freeze([...labels].sort()),
    required: Object.freeze(required),
    zoomDistancesMeters: Object.freeze([...zooms].sort((a, b) => a - b)),
    complete: required.every((label) => labels.has(label)) && zooms.size === 3,
  });
}

function cameraResidual(requested, observed) {
  return Object.freeze({
    latitudeDegrees: Math.abs(requested.latitude - observed.latitude),
    longitudeDegrees: longitudeDistance(
      requested.longitude,
      observed.longitude,
    ),
    distanceMeters: Math.abs(requested.distance - observed.distance),
    distanceRelative:
      Math.abs(requested.distance - observed.distance) / requested.distance,
    tiltDegrees: Math.abs(requested.tilt - observed.tilt),
    azimuthDegrees: longitudeDistance(requested.azimuth, observed.azimuth),
  });
}

function longitudeDistance(left, right) {
  return Math.abs(((left - right + 540) % 360) - 180);
}

async function assertNoLiveOracleProcesses() {
  const { stdout } = await execFileAsync("/bin/ps", [
    "-axo",
    "pid=,state=,command=",
  ]);
  const matches = stdout.split("\n").flatMap((line) => {
    const match = line.match(/^\s*(\d+)\s+(\S+)\s+(.+)$/u);
    if (match === null) return [];
    const [, pid, state, command] = match;
    if (command !== executablePath && !command.startsWith(`${executablePath} `)) {
      return [];
    }
    return [{ pid: Number(pid), state, command }];
  });
  const live = matches.filter(({ state }) => !state.includes("E"));
  if (live.length > 0) {
    throw new Error(
      "A live canonical Google oracle already exists: " +
      live.map(({ pid, state }) => `${pid}/${state}`).join(", "),
    );
  }
  return Object.freeze({
    exactExecutableMatches: Object.freeze(matches),
    liveCount: live.length,
    exitPendingCount: matches.length - live.length,
  });
}

function auditWindows(pid) {
  return JSON.parse(execFileSync(windowAuditPath, [String(pid)], {
    encoding: "utf8",
  }));
}

function assertHeadless(audit, pid, phase) {
  if (audit.visibleWindowCount !== 0 ||
      audit.frontmostApplication.pid === pid) {
    throw new Error(
      `Headless invariant failed at ${phase}: ` +
      `windows=${audit.visibleWindowCount}; ` +
      `frontmost=${audit.frontmostApplication.pid === pid}.`,
    );
  }
}

async function terminateExactProcess(pid) {
  if (!processExists(pid)) return Object.freeze({ reaped: true, mode: "exited" });
  process.kill(pid, "SIGTERM");
  const started = Date.now();
  while (Date.now() - started < 5_000) {
    if (!processExists(pid)) {
      return Object.freeze({
        reaped: true,
        mode: "sigterm",
        elapsedMilliseconds: Date.now() - started,
      });
    }
    await delay(100);
  }
  const state = processState(pid);
  if (state.includes("E")) {
    throw new Error(`Exact oracle ${pid} entered exit-pending state ${state}.`);
  }
  process.kill(pid, "SIGKILL");
  const forced = Date.now();
  while (Date.now() - forced < 5_000) {
    if (!processExists(pid)) {
      return Object.freeze({
        reaped: true,
        mode: "sigkill-after-grace",
        stateBeforeForce: state,
        elapsedMilliseconds: Date.now() - started,
      });
    }
    await delay(100);
  }
  throw new Error(`Exact oracle ${pid} was not reaped.`);
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

function processState(pid) {
  try {
    return execFileSync("/bin/ps", ["-o", "state=", "-p", String(pid)], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
}

async function readJsonLines(path) {
  try {
    const source = await readFile(path, "utf8");
    return source.trim().split("\n").filter(Boolean).flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function fileSha256(path) {
  return sha256(await readFile(path));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function lldbSetEnvironment(name, value) {
  return `expr (int)setenv(${lldbString(name)}, ${lldbString(value)}, 1)`;
}

function lldbString(value) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function assertSafeOutputRoot(path) {
  if (!path.startsWith(`${evidenceRoot}/`) ||
      path === evidenceRoot ||
      path.split("/").at(-1) !== "native-registration") {
    throw new Error(`Unsafe registration output root: ${path}`);
  }
}

function parseArguments(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!["--renderer", "--poses", "--output"].includes(key) ||
        value === undefined) {
      throw new Error(
        "Usage: capture-calibration-registration.mjs --renderer native " +
        "--poses 12 --output <native-registration>",
      );
    }
    values[key.slice(2)] = value;
  }
  return Object.freeze({
    renderer: values.renderer,
    poses: Number.parseInt(values.poses, 10),
    output: values.output,
  });
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function delay(milliseconds) {
  return new Promise((accept) => setTimeout(accept, milliseconds));
}
