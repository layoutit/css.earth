import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { ClassicLevel } from "classic-level";

const MARKER = Buffer.from("EVLL Mars", "ascii");
const REQUEST_BYTES = 32;
const IMAGERY_REQUEST_KIND = 0x82;
const CACHE_VALUE_HEADER_BYTES = 20;
const DXT1_256_BYTES = 256 * 256 / 2;
const CACHE_PAYLOAD_PREFIX_BYTES = 1024;
const options = parseArguments(process.argv.slice(2));
const cacheRoot = resolve(options.cacheRoot);
const outputPath = resolve(options.output);
const payloadRoot = resolve(outputPath, "../google-cache-payloads");
const temporaryRoot = await mkdtemp(join(tmpdir(), "cssmars-google-cache-"));

try {
  const cacheDirectories = (await readdir(cacheRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() &&
      entry.name.startsWith("unified_cache_leveldb_leveldb2"))
    .map((entry) => resolve(cacheRoot, entry.name))
    .sort();
  if (cacheDirectories.length === 0) {
    throw new Error(`No Google Earth LevelDB caches found under ${cacheRoot}.`);
  }

  const entriesByIdentity = new Map();
  const snapshots = [];
  await mkdir(payloadRoot, { recursive: true });
  for (let index = 0; index < cacheDirectories.length; index += 1) {
    const sourcePath = cacheDirectories[index];
    const snapshotPath = resolve(
      temporaryRoot,
      `${String(index + 1).padStart(2, "0")}-${basename(sourcePath)}`,
    );
    await cp(sourcePath, snapshotPath, { recursive: true, force: false });
    const sourceFiles = await describeDirectory(sourcePath);
    const database = new ClassicLevel(snapshotPath, {
      keyEncoding: "buffer",
      valueEncoding: "buffer",
    });
    await database.open();
    let inspectedEntryCount = 0;
    let imageryEntryCount = 0;
    try {
      for await (const [key, value] of database.iterator()) {
        inspectedEntryCount += 1;
        const markerOffset = key.indexOf(MARKER);
        if (markerOffset < 0) continue;
        const requestText = key.subarray(
          markerOffset + MARKER.length,
        ).toString("ascii");
        const request = Buffer.from(requestText, "base64");
        if (request.length !== REQUEST_BYTES ||
            request[18] !== IMAGERY_REQUEST_KIND ||
            value.length !== CACHE_VALUE_HEADER_BYTES + DXT1_256_BYTES) {
          continue;
        }
        const level = request[20];
        const path = decodeQuadtreePath(request, level);
        const address = pathToAddress(path);
        const cachePayload = value.subarray(CACHE_VALUE_HEADER_BYTES);
        const cachePayloadSha256 = sha256(cachePayload);
        const cachePayloadPath = resolve(
          payloadRoot,
          `${cachePayloadSha256}.bin`,
        );
        await writeFile(cachePayloadPath, cachePayload);
        const identity = `${cachePayloadSha256}:${level}:${path}`;
        const existing = entriesByIdentity.get(identity);
        const cacheSource = Object.freeze({
          directory: sourcePath,
          requestKeyBase64: requestText,
          levelDbKeyBase64: key.toString("base64"),
          cacheValueSha256: sha256(value),
        });
        if (existing === undefined) {
          entriesByIdentity.set(identity, Object.freeze({
            cachePayloadSha256,
            cachePayloadByteCount: cachePayload.length,
            cachePayloadPrefixBase64:
              cachePayload.subarray(
                0,
                CACHE_PAYLOAD_PREFIX_BYTES,
              ).toString("base64"),
            cachePayloadPath,
            storage: "Google Earth fixed-size imagery cache payload",
            requestKind: request[18],
            level,
            path,
            row: address.row,
            col: address.col,
            longitudeRangeDegrees: longitudeRange(level, address.col),
            latitudeRangeDegrees: latitudeRange(level, address.row),
            cacheSources: [cacheSource],
          }));
        } else {
          existing.cacheSources.push(cacheSource);
        }
        imageryEntryCount += 1;
      }
    } finally {
      await database.close();
    }
    snapshots.push(Object.freeze({
      sourcePath,
      inspectedEntryCount,
      imageryEntryCount,
      sourceFiles,
    }));
  }

  const entries = [...entriesByIdentity.values()].sort((left, right) =>
    left.level - right.level ||
    left.path.localeCompare(right.path) ||
    left.cachePayloadSha256.localeCompare(right.cachePayloadSha256));
  const byCachePayloadSha256 = new Map();
  for (const entry of entries) {
    const candidates = byCachePayloadSha256.get(
      entry.cachePayloadSha256,
    ) ?? [];
    candidates.push(entry);
    byCachePayloadSha256.set(entry.cachePayloadSha256, candidates);
  }
  const ambiguousCachePayloadHashes = [...byCachePayloadSha256]
    .filter(([, candidates]) => new Set(candidates.map(({ level, path }) =>
      `${level}:${path}`)).size > 1)
    .map(([cachePayloadSha256, candidates]) => Object.freeze({
      cachePayloadSha256,
      addresses: candidates.map(({ level, path, row, col }) =>
        ({ level, path, row, col })),
    }));
  if (entries.length === 0) {
    throw new Error("No 256x256 Mars imagery entries were found in the cache.");
  }
  const report = Object.freeze({
    schema: "cssmars-google-earth-pro-imagery-cache-index@1",
    qualification: ambiguousCachePayloadHashes.length === 0
      ? "EXACT_GOOGLE_CACHE_PAYLOAD_ADDRESSES_INDEXED"
      : "INVALID_AMBIGUOUS_GOOGLE_CACHE_PAYLOAD_ADDRESSES",
    generatedAt: new Date().toISOString(),
    cacheRoot,
    payloadRoot,
    cacheValueHeaderBytes: CACHE_VALUE_HEADER_BYTES,
    cachePayloadPrefixByteCount: CACHE_PAYLOAD_PREFIX_BYTES,
    quadtreeContract: Object.freeze({
      pathOffsetBytes: 27,
      quadrantBitsPerLevel: 2,
      quadrantOrder: Object.freeze({
        0: "south-west",
        1: "south-east",
        2: "north-east",
        3: "north-west",
      }),
      rowOrigin: "south",
      columnOrigin: "west",
    }),
    snapshots,
    entryCount: entries.length,
    uniqueCachePayloadHashCount: byCachePayloadSha256.size,
    ambiguousCachePayloadHashes,
    entries,
  });
  await mkdir(resolve(outputPath, ".."), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    ok: report.qualification.startsWith("EXACT_"),
    outputPath,
    qualification: report.qualification,
    cacheCount: snapshots.length,
    entryCount: report.entryCount,
    uniqueCachePayloadHashCount: report.uniqueCachePayloadHashCount,
    ambiguousCachePayloadHashCount: ambiguousCachePayloadHashes.length,
  }, null, 2)}\n`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

function decodeQuadtreePath(request, level) {
  if (!Number.isInteger(level) || level < 0 || level > 20) {
    throw new Error(`Unsupported Google quadtree level ${level}.`);
  }
  let path = "";
  for (let position = 0; position < level; position += 1) {
    const byte = request[27 + Math.floor(position / 4)];
    const shift = 6 - 2 * (position % 4);
    path += String((byte >> shift) & 0x03);
  }
  return path;
}

function pathToAddress(path) {
  let row = 0;
  let col = 0;
  const rowBits = [0, 0, 1, 1];
  const colBits = [0, 1, 1, 0];
  for (const character of path) {
    const quadrant = Number(character);
    row = row * 2 + rowBits[quadrant];
    col = col * 2 + colBits[quadrant];
  }
  return Object.freeze({ row, col });
}

function longitudeRange(level, col) {
  const width = 360 / 2 ** level;
  return Object.freeze([-180 + col * width, -180 + (col + 1) * width]);
}

function latitudeRange(level, row) {
  const height = 180 / 2 ** level;
  return Object.freeze([-90 + row * height, -90 + (row + 1) * height]);
}

async function describeDirectory(directory) {
  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() &&
      (entry.name.endsWith(".sst") || entry.name.endsWith(".log") ||
       entry.name === "CURRENT" || entry.name.startsWith("MANIFEST-")))
    .sort((left, right) => left.name.localeCompare(right.name));
  return Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    const metadata = await stat(path);
    return Object.freeze({
      name: entry.name,
      bytes: metadata.size,
      sha256: sha256(await readFile(path)),
    });
  }));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseArguments(arguments_) {
  const parsed = {};
  for (let index = 0; index < arguments_.length; index += 2) {
    const name = arguments_[index];
    const value = arguments_[index + 1];
    if (name === "--cache-root") parsed.cacheRoot = value;
    if (name === "--output") parsed.output = value;
  }
  if (!parsed.cacheRoot || !parsed.output) {
    throw new Error(
      "Usage: export-google-imagery-cache.mjs --cache-root <path> --output <json>",
    );
  }
  return Object.freeze(parsed);
}
