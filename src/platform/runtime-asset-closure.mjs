import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SAFE_FILENAME = /^[a-z0-9][a-z0-9@._-]*$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

export function normalizeRuntimeAssetUrls({ planetId, urls }) {
  if (!/^[a-z][a-z0-9-]*$/u.test(planetId) || !Array.isArray(urls) || urls.length === 0) {
    throw new TypeError("Runtime asset inventory is incompatible.");
  }
  const prefix = `/scenes/${planetId}/`;
  const filenames = [];
  const seenUrls = new Set();
  const seenFilenames = new Set();
  for (const url of urls) {
    if (typeof url !== "string" || !url.startsWith(prefix) ||
        url.slice(prefix.length) !== basename(url) ||
        !SAFE_FILENAME.test(basename(url))) {
      throw new TypeError(`Planet ${planetId} has an unsafe runtime asset URL.`);
    }
    const filename = basename(url);
    if (seenUrls.has(url) || seenFilenames.has(filename)) {
      throw new TypeError(`Planet ${planetId} repeats runtime asset ${filename}.`);
    }
    seenUrls.add(url);
    seenFilenames.add(filename);
    filenames.push(filename);
  }
  return Object.freeze(filenames.sort((left, right) => left.localeCompare(right)));
}

export async function prepareRuntimeAssetManifest({
  planetId,
  urls,
  publicRoot,
  manifestPath,
}) {
  const filenames = normalizeRuntimeAssetUrls({ planetId, urls });
  await assertDirectoryClosure(publicRoot, filenames, planetId);
  const assets = [];
  for (const filename of filenames) {
    const bytes = await readFile(resolve(publicRoot, filename));
    assets.push(Object.freeze({
      filename,
      bytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    }));
  }
  const manifest = Object.freeze({
    schema: `css${planetId}-runtime-assets@1`,
    assets: Object.freeze(assets),
  });
  const outputPath = manifestPath instanceof URL
    ? fileURLToPath(manifestPath)
    : manifestPath;
  const temporary = `${outputPath}.partial-${process.pid}-${randomUUID()}`;
  try {
    await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
    await rename(temporary, outputPath);
  } finally {
    await rm(temporary, { force: true });
  }
  return manifest;
}

export async function assembleRuntimeAssetClosure({
  planetId,
  manifestPath,
  productionRoot,
}) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  validateRuntimeAssetManifest(planetId, manifest);
  const expected = new Set(manifest.assets.map(({ filename }) => filename));
  const entries = await readdir(productionRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) {
      throw new Error(`Unexpected ${planetId} production directory: ${entry.name}.`);
    }
    if (!expected.has(entry.name)) await unlink(resolve(productionRoot, entry.name));
  }
  await verifyRuntimeAssetClosure({ planetId, manifest, root: productionRoot });
  return manifest;
}

export async function verifyRuntimeAssetClosure({ planetId, manifest, root }) {
  validateRuntimeAssetManifest(planetId, manifest);
  await assertDirectoryClosure(root, manifest.assets.map(({ filename }) => filename), planetId);
  for (const asset of manifest.assets) {
    const bytes = await readFile(resolve(root, asset.filename));
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (bytes.byteLength !== asset.bytes || digest !== asset.sha256) {
      throw new Error(`Planet ${planetId} runtime asset drifted: ${asset.filename}.`);
    }
  }
  return true;
}

export function validateRuntimeAssetManifest(planetId, manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest) ||
      manifest.schema !== `css${planetId}-runtime-assets@1` ||
      !Array.isArray(manifest.assets) || manifest.assets.length === 0) {
    throw new TypeError(`Planet ${planetId} runtime asset manifest is incompatible.`);
  }
  const filenames = new Set();
  for (const asset of manifest.assets) {
    if (!asset || typeof asset !== "object" ||
        !SAFE_FILENAME.test(asset.filename ?? "") ||
        !Number.isSafeInteger(asset.bytes) || asset.bytes <= 0 ||
        !SHA256.test(asset.sha256 ?? "")) {
      throw new TypeError(`Planet ${planetId} has an invalid runtime asset entry.`);
    }
    if (filenames.has(asset.filename)) {
      throw new TypeError(`Planet ${planetId} repeats runtime asset ${asset.filename}.`);
    }
    filenames.add(asset.filename);
  }
  return true;
}

async function assertDirectoryClosure(root, filenames, planetId) {
  const entries = await readdir(root, { withFileTypes: true });
  const actual = [];
  for (const entry of entries) {
    if (!entry.isFile()) throw new Error(`Unexpected ${planetId} asset directory: ${entry.name}.`);
    actual.push(entry.name);
  }
  const expected = [...filenames].sort((left, right) => left.localeCompare(right));
  actual.sort((left, right) => left.localeCompare(right));
  if (expected.join("\0") !== actual.join("\0")) {
    const expectedSet = new Set(expected);
    const actualSet = new Set(actual);
    const missing = expected.filter((filename) => !actualSet.has(filename));
    const undeclared = actual.filter((filename) => !expectedSet.has(filename));
    throw new Error(
      `Planet ${planetId} runtime asset closure mismatch. Missing: ${missing.join(", ") || "none"}. Undeclared: ${undeclared.join(", ") || "none"}.`,
    );
  }
  for (const filename of actual) {
    const fileStat = await stat(resolve(root, filename));
    if (!fileStat.isFile()) throw new Error(`Planet ${planetId} runtime asset is not a file: ${filename}.`);
  }
}
