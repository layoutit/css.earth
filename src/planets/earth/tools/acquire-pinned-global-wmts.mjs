#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createSourceManifest, assertSourceBytes } from "../../../platform/source-manifest.mjs";
import { publishSourceBytes } from "../../../platform/source-acquisition.mjs";
import { preparedCityAssetUrl } from "../../../platform/prepared-map/city-asset-url.mjs";
import { readWorldCoverCatalog } from "./city/worldcover-catalog.mjs";
import { releaseFiles, verifyLocalPack } from "./city/wmts-release.mjs";

const projectDirectory = resolve(import.meta.dirname, "../../../..");
const sourcePaths = ["city/wmts-release.json", "city/catalog-pin.json", "city/worldcover-rgbnir-2021.json.gz", "city/manifest.json"];

// Acquire an already published, hash-pinned release. Geometry authoring remains
// the separate prepare:earth-global command. Verification never uses the network.
export async function acquirePinnedGlobalWmts({ projectRoot = projectDirectory, verifyOnly = false,
  concurrency = 4, fetcher = fetch, onProgress = () => {} } = {}) {
  if (typeof verifyOnly !== "boolean" || !Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 8) {
    throw new TypeError("Pinned worldwide acquisition requires a boolean verifyOnly and concurrency from 1 to 8.");
  }
  const sourceRoot = resolve(projectRoot, "src/planets/earth/source");
  const source = await createSourceManifest({ planetId: "earth", planetName: "Earth", sourceRoot });
  const declarations = new Map([source.manifest.inputs, source.manifest.generatedIntermediates, source.manifest.documents]
    .flat().map(entry => [entry.path, entry]));
  const pinned = new Map(), sourceHashes = {};
  for (const path of sourcePaths) {
    const entry = declarations.get(path);
    if (!entry) throw new Error(`Earth worldwide source is not declared: ${path}`);
    const bytes = await readFile(resolve(sourceRoot, path));
    sourceHashes[path] = assertSourceBytes({ entry, bytes, planetName: "Earth" });
    pinned.set(path, bytes);
  }
  const release = JSON.parse(pinned.get("city/wmts-release.json")), content = JSON.parse(pinned.get("city/manifest.json"));
  const files = releaseFiles(release);
  const catalog = await readWorldCoverCatalog({ directory: pathToFileURL(resolve(sourceRoot, "city") + "/") });
  assert.equal(release.sourceSha256, catalog.pin.expectedSha256, "Worldwide release uses another source catalog");
  assert.equal(release.dataset, catalog.pin.dataset, "Worldwide release dataset changed");
  assert.equal(content.dataset, release.dataset, "Worldwide control content uses another dataset");
  const baseUrl = preparedCityAssetUrl(content.delivery?.assetOrigin, content.delivery?.keyPrefix, `wmts-${release.version}`);
  const directory = resolve(projectRoot, ".local/wmts-global", release.version);
  let cursor = 0, verified = 0, downloaded = 0, downloadedBytes = 0, failure = null;

  const worker = async () => {
    while (!failure && cursor < files.length) {
      const file = files[cursor++];
      try {
        try {
          await verifyLocalPack(directory, file);
        } catch (error) {
          if (verifyOnly) throw error;
          const bytes = await downloadPack(`${baseUrl}/${file.filename}`, file, fetcher);
          // publishSourceBytes verifies the complete replacement before creating
          // its temporary file, then renames it atomically over a corrupt cache.
          await publishSourceBytes({ destination: resolve(directory, file.filename), bytes,
            entry: { path: file.filename, expectedBytes: file.bytes, expectedSha256: file.sha256 }, planetName: "Earth worldwide" });
          downloaded++; downloadedBytes += bytes.length;
        }
        if (++verified % 1000 === 0 || verified === files.length) {
          onProgress({ verifiedPacks: verified, totalPacks: files.length, downloadedPacks: downloaded });
        }
      } catch (error) {
        failure ??= error;
      }
    }
  };
  // Drain already running work before reporting a failure; no background writer
  // can continue after the acquisition promise rejects.
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
  if (failure) throw failure;
  return { schema: "cssearth-pinned-wmts-acquisition@1", mode: verifyOnly ? "verify-only" : "acquire",
    version: release.version, dataset: release.dataset, sourceHashes, packs: files.length, bytes: release.bytes,
    packInventorySha256: createHash("sha256").update(JSON.stringify(files)).digest("hex"),
    verifiedPacks: verified, downloadedPacks: downloaded, downloadedBytes, geometry: "verified-pinned-input-not-regenerated" };
}

async function downloadPack(url, file, fetcher) {
  const response = await fetcher(url, { redirect: "error", signal: AbortSignal.timeout(120000),
    headers: { "accept-encoding": "identity", "user-agent": "cssEarth pinned worldwide acquisition" } });
  if (response.status !== 200 || !response.body) {
    await response.body?.cancel();
    throw new Error(`Pinned worldwide pack request failed: ${file.filename} (HTTP ${response.status}).`);
  }
  const declared = response.headers.get("content-length");
  if (declared !== null && Number(declared) !== file.bytes) {
    await response.body.cancel();
    throw new Error(`Pinned worldwide pack size mismatch: ${file.filename}.`);
  }
  const chunks = []; let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    if (bytes > file.bytes) throw new Error(`Pinned worldwide pack exceeds its declared size: ${file.filename}.`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, bytes);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== "--verify-only") || args.length > 1) {
    throw new TypeError("Pinned worldwide acquisition accepts only --verify-only.");
  }
  const report = await acquirePinnedGlobalWmts({ verifyOnly: args.includes("--verify-only"),
    onProgress: progress => console.log(`Pinned worldwide acquisition: ${progress.verifiedPacks}/${progress.totalPacks} packs verified (${progress.downloadedPacks} downloaded).`) });
  console.log(JSON.stringify(report));
}
