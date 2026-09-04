import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

const options = parseArguments(process.argv.slice(2));
const calibrationRoot = resolve(
  import.meta.dirname,
  "../../../../../../.local/oracles/google-earth-pro/calibration",
);
const calibrationManifestPath = resolve(calibrationRoot, "manifest.json");
const calibrationSourcePath = resolve(
  calibrationRoot,
  "mars-calibration-equirectangular.png",
);
const cacheIndexPath = resolve(
  options.cacheIndex ?? resolve(calibrationRoot, "google-cache-index.json"),
);
const outputRoot = resolve(options.output);
const rawRoot = resolve(outputRoot, "rgba");
const mappingPath = resolve(outputRoot, "texture-map.tsv");
const reportPath = resolve(outputRoot, "texture-map.json");
const cacheTransformKeyPath = resolve(outputRoot, "cache-transform-key.bin");
await mkdir(rawRoot, { recursive: true });

const [calibrationManifest, cacheIndex, auditText, source] = await Promise.all([
  readJson(calibrationManifestPath),
  readJson(cacheIndexPath),
  readFile(resolve(options.audit), "utf8"),
  sharp(calibrationSourcePath).toColorspace("srgb").ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true }),
]);
if (cacheIndex.qualification !==
    "EXACT_GOOGLE_CACHE_PAYLOAD_ADDRESSES_INDEXED") {
  throw new Error(`Google cache index is not exact: ${cacheIndex.qualification}.`);
}
if (source.info.width !== 4096 || source.info.height !== 2048 ||
    source.info.channels !== 4) {
  throw new Error("Calibration master must decode to 4096x2048 RGBA.");
}
if (sha256(source.data) !== calibrationManifest.source.decodedRgbaSha256) {
  throw new Error("Calibration master decoded hash drifted.");
}

const cacheByPayloadHash = new Map();
for (const entry of cacheIndex.entries) {
  const candidates = cacheByPayloadHash.get(entry.cachePayloadSha256) ?? [];
  candidates.push(entry);
  cacheByPayloadHash.set(entry.cachePayloadSha256, candidates);
}
const draws = auditText.trim().split("\n").filter(Boolean).map((line) =>
  JSON.parse(line));
if (draws.length === 0) throw new Error("The ground draw audit is empty.");
const requestedRevision = options.revision === undefined
  ? Math.max(...draws.map(({ revision }) => revision))
  : Number(options.revision);
const latestDraws = new Map();
for (const draw of draws) {
  if (draw.revision !== requestedRevision) continue;
  if (draw.textureWidth !== 256 || draw.textureHeight !== 256 ||
      draw.internalFormat !== 33776 || !draw.compressed ||
      draw.compressedByteCount !== 32768) continue;
  latestDraws.set(drawKey(draw), draw);
}
if (latestDraws.size === 0) {
  throw new Error(`No 256x256 Google ground draws at revision ${requestedRevision}.`);
}

const preparedTiles = new Map();
const mappings = [];
const observedDraws = await Promise.all([...latestDraws.values()].map(
  async (draw) => {
    if (!draw.compressed || draw.compressedByteCount !== 32768 ||
        !draw.compressedPath) {
      throw new Error(
        `Draw ${draw.drawId} is not an audited 256x256 DXT1 texture.`,
      );
    }
    const compressedBytes = await readFile(draw.compressedPath);
    if (compressedBytes.length !== draw.compressedByteCount) {
      throw new Error(`Compressed dump size drifted for draw ${draw.drawId}.`);
    }
    return Object.freeze({ draw, compressedBytes });
  },
));
const cacheTransform = await deriveCacheTransform(
  observedDraws,
  cacheIndex.entries,
  cacheIndex.cachePayloadPrefixByteCount,
  await readFileIfPresent(cacheTransformKeyPath),
);
await writeFile(cacheTransformKeyPath, cacheTransform.keyBytes);
for (const { draw, compressedBytes } of observedDraws) {
  const compressedSha256 = sha256(compressedBytes);
  const transformedPayload = xorBuffers(
    compressedBytes,
    cacheTransform.keyBytes,
  );
  const transformedPayloadSha256 = sha256(transformedPayload);
  const cacheCandidates = cacheByPayloadHash.get(
    transformedPayloadSha256,
  ) ?? [];
  const uniqueAddresses = new Map(cacheCandidates.map((candidate) => [
    `${candidate.level}:${candidate.path}`,
    candidate,
  ]));
  if (uniqueAddresses.size !== 1) {
    throw new Error(
      `Draw ${draw.drawId} transformed payload ${transformedPayloadSha256} ` +
      `resolves to ` +
      `${uniqueAddresses.size} Google cache addresses.`,
    );
  }
  const address = [...uniqueAddresses.values()][0];
  const tileKey = `${address.level}:${address.path}`;
  let calibrationTile = preparedTiles.get(tileKey);
  if (calibrationTile === undefined) {
    calibrationTile = await prepareCalibrationTile({
      source,
      address,
      rawRoot,
      sourceDecodedRgbaSha256:
        calibrationManifest.source.decodedRgbaSha256,
    });
    preparedTiles.set(tileKey, calibrationTile);
  }
  mappings.push(Object.freeze({
    originalTexture: draw.texture,
    program: draw.program,
    vertexBuffer: draw.vertexBuffer,
    elementBuffer: draw.elementBuffer,
    auditRevision: draw.revision,
    drawId: draw.drawId,
    originalCompressedPath: draw.compressedPath,
    originalCompressedByteCount: compressedBytes.length,
    originalCompressedSha256: compressedSha256,
    transformedCachePayloadSha256: transformedPayloadSha256,
    cacheTransformKeySha256: cacheTransform.keySha256,
    originalDecodedRgbaPath: draw.rawPath,
    originalInternalFormat: draw.internalFormat,
    sampler: draw.sampler,
    googleCacheAddress: Object.freeze({
      requestKeyBase64: address.cacheSources[0].requestKeyBase64,
      level: address.level,
      path: address.path,
      row: address.row,
      col: address.col,
      longitudeRangeDegrees: address.longitudeRangeDegrees,
      latitudeRangeDegrees: address.latitudeRangeDegrees,
    }),
    calibrationTile,
    registrationQualification:
      "EXACT_REVERSIBLE_BYTES_TO_GOOGLE_CACHE_QUADTREE_ADDRESS",
  }));
}
mappings.sort((left, right) =>
  left.program - right.program ||
  left.originalTexture - right.originalTexture ||
  left.vertexBuffer - right.vertexBuffer ||
  left.elementBuffer - right.elementBuffer);

const mappingBytes = Buffer.from(mappings.map((mapping) => [
  mapping.originalTexture,
  mapping.program,
  mapping.vertexBuffer,
  mapping.elementBuffer,
  mapping.auditRevision,
  mapping.googleCacheAddress.level,
  mapping.googleCacheAddress.col,
  mapping.googleCacheAddress.row,
  mapping.calibrationTile.uploadPath,
  mapping.calibrationTile.uploadRgbaSha256,
].join("\t")).join("\n") + "\n");
await writeFile(mappingPath, mappingBytes);
const report = Object.freeze({
  schema: "cssmars-google-earth-pro-calibration-texture-map@3",
  qualification: mappings.length === latestDraws.size
    ? "EXACT_GOOGLE_DXT1_DRAWS_BOUND_TO_CALIBRATION_TILES"
    : "INVALID_UNMAPPED_GOOGLE_DRAWS",
  generatedAt: new Date().toISOString(),
  revision: requestedRevision,
  auditPath: resolve(options.audit),
  auditSha256: sha256(Buffer.from(auditText)),
  cacheIndexPath,
  cacheIndexSha256: sha256(await readFile(cacheIndexPath)),
  cacheTransform: Object.freeze({
    qualification: cacheTransform.qualification,
    operation: "googleCachePayload = uploadedDxt1 XOR key",
    keyByteCount: cacheTransform.keyBytes.length,
    keySha256: cacheTransform.keySha256,
    keyPath: cacheTransformKeyPath,
    supportingDrawCount: cacheTransform.supportingDrawCount,
    runnerUpSupportingDrawCount:
      cacheTransform.runnerUpSupportingDrawCount,
  }),
  calibration: Object.freeze({
    manifestPath: calibrationManifestPath,
    sourcePath: calibrationSourcePath,
    sourceDecodedRgbaSha256: calibrationManifest.source.decodedRgbaSha256,
  }),
  mappingPath,
  mappingSha256: sha256(mappingBytes),
  auditedDrawCount: latestDraws.size,
  mappingCount: mappings.length,
  uniqueGoogleTextureCount: new Set(mappings.map(({ originalTexture }) =>
    originalTexture)).size,
  uniqueGoogleCacheAddressCount: new Set(mappings.map(({ googleCacheAddress }) =>
    `${googleCacheAddress.level}:${googleCacheAddress.path}`)).size,
  uniqueCalibrationTileCount: preparedTiles.size,
  mappings,
});
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  ok: report.qualification.startsWith("EXACT_"),
  reportPath,
  mappingPath,
  revision: requestedRevision,
  mappingCount: report.mappingCount,
  uniqueGoogleCacheAddressCount: report.uniqueGoogleCacheAddressCount,
  uniqueCalibrationTileCount: report.uniqueCalibrationTileCount,
}, null, 2)}\n`);

async function deriveCacheTransform(
  observedDraws,
  cacheEntries,
  prefixByteCount,
  existingKeyBytes,
) {
  if (existingKeyBytes !== null) {
    if (existingKeyBytes.length !== 32768) {
      throw new Error("Existing Google cache transform key has drifted.");
    }
    const knownPayloadHashes = new Set(cacheEntries.map(
      ({ cachePayloadSha256 }) => cachePayloadSha256,
    ));
    const supported = observedDraws.filter(({ compressedBytes }) =>
      knownPayloadHashes.has(sha256(xorBuffers(
        compressedBytes,
        existingKeyBytes,
      ))));
    if (supported.length !== observedDraws.length) {
      throw new Error(
        `Existing cache transform covers ${supported.length}/` +
        `${observedDraws.length} audited draws.`,
      );
    }
    return Object.freeze({
      qualification:
        "EXACT_PREVIOUSLY_PROVEN_XOR_KEY_COVERS_EVERY_AUDITED_DRAW",
      keyBytes: existingKeyBytes,
      keySha256: sha256(existingKeyBytes),
      supportingDrawCount: supported.length,
      runnerUpSupportingDrawCount: 0,
    });
  }
  if (!Number.isInteger(prefixByteCount) || prefixByteCount < 64) {
    throw new Error("Google cache index has no adequate payload prefix.");
  }
  const candidates = new Map();
  for (let drawIndex = 0; drawIndex < observedDraws.length; drawIndex += 1) {
    const uploadedPrefix = observedDraws[drawIndex].compressedBytes.subarray(
      0,
      prefixByteCount,
    );
    for (let cacheIndex = 0; cacheIndex < cacheEntries.length;
         cacheIndex += 1) {
      const cachePrefix = Buffer.from(
        cacheEntries[cacheIndex].cachePayloadPrefixBase64,
        "base64",
      );
      if (cachePrefix.length !== prefixByteCount) {
        throw new Error("Google cache payload prefix length drifted.");
      }
      const prefixKey = sha256(xorBuffers(uploadedPrefix, cachePrefix));
      const candidate = candidates.get(prefixKey);
      if (candidate === undefined) {
        candidates.set(prefixKey, {
          supportingDrawCount: 1,
          drawIndex,
          cacheIndex,
        });
      } else {
        candidate.supportingDrawCount += 1;
      }
    }
  }
  const ranked = [...candidates.values()].sort((left, right) =>
    right.supportingDrawCount - left.supportingDrawCount);
  const best = ranked[0];
  const runnerUp = ranked[1];
  if (best === undefined ||
      best.supportingDrawCount !== observedDraws.length ||
      (runnerUp?.supportingDrawCount ?? 0) >= best.supportingDrawCount) {
    throw new Error(
      "No unique fixed cache transform covers every audited Google draw: " +
      `best=${best?.supportingDrawCount ?? 0}; ` +
      `required=${observedDraws.length}; ` +
      `runnerUp=${runnerUp?.supportingDrawCount ?? 0}.`,
    );
  }
  const sourceDraw = observedDraws[best.drawIndex].compressedBytes;
  const sourceCachePayload = await readFile(
    cacheEntries[best.cacheIndex].cachePayloadPath,
  );
  if (sourceDraw.length !== sourceCachePayload.length) {
    throw new Error("Google upload and cache payload byte counts differ.");
  }
  const keyBytes = xorBuffers(sourceDraw, sourceCachePayload);
  return Object.freeze({
    qualification: "EXACT_SINGLE_XOR_KEY_COVERS_EVERY_AUDITED_DRAW",
    keyBytes,
    keySha256: sha256(keyBytes),
    supportingDrawCount: best.supportingDrawCount,
    runnerUpSupportingDrawCount: runnerUp?.supportingDrawCount ?? 0,
  });
}

function xorBuffers(left, right) {
  if (left.length !== right.length) {
    throw new Error(`Cannot XOR ${left.length} and ${right.length} bytes.`);
  }
  const output = Buffer.allocUnsafe(left.length);
  for (let index = 0; index < left.length; index += 1) {
    output[index] = left[index] ^ right[index];
  }
  return output;
}

async function prepareCalibrationTile({
  source,
  address,
  rawRoot,
  sourceDecodedRgbaSha256,
}) {
  const divisions = 2 ** address.level;
  const sourceLeft = Math.floor(address.col * source.info.width / divisions);
  const sourceRight = Math.floor(
    (address.col + 1) * source.info.width / divisions,
  );
  const topDownRow = divisions - 1 - address.row;
  const sourceTop = Math.floor(topDownRow * source.info.height / divisions);
  const sourceBottom = Math.floor(
    (topDownRow + 1) * source.info.height / divisions,
  );
  if (sourceRight <= sourceLeft || sourceBottom <= sourceTop) {
    throw new Error(
      `Calibration source has insufficient resolution for z${address.level} ` +
      `${address.path}.`,
    );
  }
  const topDown = await sharp(source.data, {
    raw: {
      width: source.info.width,
      height: source.info.height,
      channels: 4,
    },
  }).extract({
    left: sourceLeft,
    top: sourceTop,
    width: sourceRight - sourceLeft,
    height: sourceBottom - sourceTop,
  }).resize(256, 256, { fit: "fill", kernel: "nearest" }).raw().toBuffer();
  const uploadRgba = await sharp(topDown, {
    raw: { width: 256, height: 256, channels: 4 },
  }).flip().raw().toBuffer();
  const uploadPath = resolve(
    rawRoot,
    `tile-z${address.level}-path-${address.path || "root"}-` +
      `r${address.row}-c${address.col}.rgba`,
  );
  await writeFile(uploadPath, uploadRgba);
  return Object.freeze({
    uploadPath,
    uploadRgbaSha256: sha256(uploadRgba),
    semanticTopDownRgbaSha256: sha256(topDown),
    sourceDecodedRgbaSha256,
    width: 256,
    height: 256,
    channels: 4,
    sourceCrop: Object.freeze({
      left: sourceLeft,
      top: sourceTop,
      width: sourceRight - sourceLeft,
      height: sourceBottom - sourceTop,
    }),
  });
}

function drawKey(draw) {
  return [
    draw.revision,
    draw.program,
    draw.texture,
    draw.vertexBuffer,
    draw.elementBuffer,
  ].join(":");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readFileIfPresent(path) {
  try {
    return await readFile(path);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseArguments(arguments_) {
  const parsed = {};
  for (let index = 0; index < arguments_.length; index += 2) {
    const name = arguments_[index];
    const value = arguments_[index + 1];
    if (name === "--audit") parsed.audit = value;
    if (name === "--output") parsed.output = value;
    if (name === "--cache-index") parsed.cacheIndex = value;
    if (name === "--revision") parsed.revision = value;
  }
  if (!parsed.audit || !parsed.output) {
    throw new Error(
      "Usage: prepare-google-calibration-map.mjs " +
      "--audit <draws.jsonl> --output <directory> " +
      "[--cache-index <json>] [--revision <number>]",
    );
  }
  return Object.freeze(parsed);
}
