import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

const args = parseArguments(process.argv.slice(2));
const auditPath = resolve(args.audit);
const overlayManifestPath = resolve(args.overlay);
const outputRoot = resolve(args.output);
const reportPath = resolve(outputRoot, "overlay-draw-map.json");
const bindingPath = resolve(outputRoot, "overlay-draw-bindings.jsonl");
const [auditSource, overlay] = await Promise.all([
  readFile(auditPath, "utf8"),
  readJson(overlayManifestPath),
]);
if (overlay.qualification !==
    "PREPARED_EXPLICIT_GEOGRAPHIC_CALIBRATION_BINDING") {
  throw new Error("Overlay manifest is not an explicit geographic binding.");
}
const candidates = await Promise.all(overlay.tiles.map(async (tile) => {
  const rgba = await sharp(tile.path).toColorspace("srgb").ensureAlpha()
    .raw().toBuffer();
  if (sha256(rgba) !== tile.decodedRgbaSha256) {
    throw new Error(`Prepared calibration tile drifted: ${tile.path}`);
  }
  return Object.freeze({
    ...tile,
    signal: await imageSignal(rgba, false),
  });
}));
const draws = auditSource.trim().split("\n").filter(Boolean).map((line) =>
  JSON.parse(line)).filter((draw) =>
  draw.textureWidth === 256 && draw.textureHeight === 256);
const latestByDrawRevision = new Map(draws.map((draw) => [
  `${draw.revision}/${draw.program}/${draw.texture}/` +
    `${draw.vertexBuffer}/${draw.elementBuffer}`,
  draw,
]));
const matchByRawHash = new Map();
const bindings = [];
const rejected = [];
for (const draw of latestByDrawRevision.values()) {
  const raw = await readFile(draw.rawPath);
  const rawSha256 = sha256(raw);
  let ranked = matchByRawHash.get(rawSha256);
  if (ranked === undefined) {
    const signal = await imageSignal(raw, true);
    ranked = candidates.map((candidate) => Object.freeze({
      tile: candidate,
      meanAbsoluteRgbError: meanAbsoluteError(signal, candidate.signal),
    })).sort((left, right) =>
      left.meanAbsoluteRgbError - right.meanAbsoluteRgbError);
    matchByRawHash.set(rawSha256, ranked);
  }
  const best = ranked[0];
  const runnerUp = ranked[1];
  const margin = runnerUp.meanAbsoluteRgbError - best.meanAbsoluteRgbError;
  if (best.meanAbsoluteRgbError > 32 || margin < 0.08) {
    rejected.push(Object.freeze({
      revision: draw.revision,
      program: draw.program,
      texture: draw.texture,
      vertexBuffer: draw.vertexBuffer,
      elementBuffer: draw.elementBuffer,
      rawPath: draw.rawPath,
      rawSha256,
      bestAddress: address(best.tile),
      bestMeanAbsoluteRgbError: best.meanAbsoluteRgbError,
      runnerUpAddress: address(runnerUp.tile),
      margin,
    }));
    continue;
  }
  bindings.push(Object.freeze({
    drawId: draw.drawId,
    revision: draw.revision,
    program: draw.program,
    texture: draw.texture,
    vertexBuffer: draw.vertexBuffer,
    elementBuffer: draw.elementBuffer,
    drawKind: draw.drawKind,
    count: draw.count,
    samplerUnit: draw.samplerUnit,
    sampler: draw.sampler,
    internalFormat: draw.internalFormat,
    uploadedDecodedRgbaPath: draw.rawPath,
    uploadedDecodedRgbaSha256: rawSha256,
    calibrationSourceDecodedRgbaSha256:
      overlay.sourceDecodedRgbaSha256,
    calibrationTile: Object.freeze({
      level: best.tile.level,
      x: best.tile.x,
      y: best.tile.y,
      path: best.tile.path,
      decodedRgbaSha256: best.tile.decodedRgbaSha256,
      longitudeRangeDegrees: best.tile.longitudeRangeDegrees,
      latitudeRangeDegrees: best.tile.latitudeRangeDegrees,
    }),
    matching: Object.freeze({
      method: "decoded-GL-texture-to-prepared-tile-64px-RGB-MAE",
      meanAbsoluteRgbError: best.meanAbsoluteRgbError,
      runnerUpAddress: address(runnerUp.tile),
      runnerUpMeanAbsoluteRgbError: runnerUp.meanAbsoluteRgbError,
      margin,
    }),
  }));
}
bindings.sort((left, right) =>
  left.revision - right.revision || left.drawId - right.drawId);
const boundAddresses = new Set(bindings.map(({ calibrationTile }) =>
  address(calibrationTile)));
const report = Object.freeze({
  schema: "cssmars-google-earth-pro-calibration-overlay-draw-map@1",
  qualification: bindings.length > 0
    ? "GOOGLE_NATIVE_OVERLAY_DRAWS_BOUND_TO_PREPARED_CALIBRATION_HASHES"
    : "INVALID_NO_CALIBRATION_OVERLAY_DRAWS",
  generatedAt: new Date().toISOString(),
  auditPath,
  auditSha256: sha256(Buffer.from(auditSource)),
  overlayManifestPath,
  sourceDecodedRgbaSha256: overlay.sourceDecodedRgbaSha256,
  candidateTileCount: candidates.length,
  auditedDrawCount: latestByDrawRevision.size,
  uniqueUploadedTextureCount: matchByRawHash.size,
  calibrationBindingCount: bindings.length,
  boundAddressCount: boundAddresses.size,
  rejectedDrawCount: rejected.length,
  bindingPath,
  bindings: Object.freeze(bindings),
  rejected: Object.freeze(rejected),
});
await mkdir(outputRoot, { recursive: true });
await Promise.all([
  writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`),
  writeFile(bindingPath, bindings.map((binding) =>
    JSON.stringify(binding)).join("\n") + "\n"),
]);
if (bindings.length === 0) {
  throw new Error(`No native overlay draws matched: ${reportPath}`);
}
process.stdout.write(`${JSON.stringify({
  ok: true,
  reportPath,
  bindingPath,
  qualification: report.qualification,
  calibrationBindingCount: report.calibrationBindingCount,
  boundAddressCount: report.boundAddressCount,
  rejectedDrawCount: report.rejectedDrawCount,
}, null, 2)}\n`);

async function imageSignal(rgba, bottomUp) {
  let pipeline = sharp(rgba, {
    raw: { width: 256, height: 256, channels: 4 },
  });
  if (bottomUp) pipeline = pipeline.flip();
  return pipeline.resize(64, 64, { kernel: sharp.kernel.lanczos3 })
    .removeAlpha().raw().toBuffer();
}

function meanAbsoluteError(left, right) {
  let total = 0;
  for (let index = 0; index < left.length; index += 1) {
    total += Math.abs(left[index] - right[index]);
  }
  return total / left.length;
}

function address({ level, x, y }) {
  return `${level}/${x}/${y}`;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseArguments(values) {
  const args = {};
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!["--audit", "--overlay", "--output"].includes(key) ||
        value === undefined) {
      throw new Error(
        "Usage: map-google-calibration-overlay-draws.mjs --audit <jsonl> " +
        "--overlay <manifest.json> --output <directory>",
      );
    }
    args[key.slice(2)] = value;
  }
  return Object.freeze(args);
}
