import { isArray } from './is-array.mts';
export interface RuntimeAsset { filename: string; bytes: number; sha256: string; location?: 'public'; }
export interface RuntimeAssetManifest { schema: string; resourceRoot?: 'prepared'; assets: readonly RuntimeAsset[]; }
import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir, rename, rm, stat, lstat, unlink, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SAFE_FILENAME = /^[a-z0-9][a-z0-9@._-]*$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

export function normalizeRuntimeAssetUrls({ planetId, urls }: { planetId: string; urls: readonly string[] }) {
  if (!/^[a-z][a-z0-9-]*$/u.test(planetId) || !isArray(urls) || urls.length === 0) {
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
  allowPreparationArtifacts = false,
}: { planetId: string; urls: readonly string[]; publicRoot: string; manifestPath: string | URL; allowPreparationArtifacts?: boolean }) {
  const filenames = normalizeRuntimeAssetUrls({ planetId, urls });
  // Offline baking may emit intermediate densities. They are not shipped;
  // production assembly and verification still enforce exact closure.
  if (!allowPreparationArtifacts) await assertDirectoryClosure(publicRoot, filenames, planetId);
  const assets = [];
  for (const filename of filenames) {
    if (!(await lstat(resolve(publicRoot, filename))).isFile()) throw new Error(`Runtime asset is not a regular file: ${filename}.`);
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
}: { planetId: string; manifestPath: string | URL; productionRoot: string }) {
  const manifest: RuntimeAssetManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  validateRuntimeAssetManifest(planetId, manifest);
  if (manifest.resourceRoot === "prepared") throw new TypeError("Prepared resources cannot be assembled by the public-scene asset assembler.");
  const expected = new Set(manifest.assets.map(({ filename }) => filename));
  const entries = await runtimeFiles(productionRoot, planetId, false);
  for (const name of entries) if (!expected.has(name)) await unlink(resolve(productionRoot, name));
  await verifyRuntimeAssetClosure({ planetId, manifest, root: productionRoot });
  return manifest;
}

export async function verifyRuntimeAssetClosure({ planetId, manifest, root, publicRoot }: { planetId: string; manifest: RuntimeAssetManifest; root: string; publicRoot?: string }) {
  validateRuntimeAssetManifest(planetId, manifest);
  const publicAssets = manifest.assets.filter(asset => asset.location === "public");
  if (publicAssets.length && !publicRoot) throw new TypeError("Public runtime assets require an explicit publicRoot for verification.");
  const prepared = manifest.resourceRoot === "prepared";
  await assertDirectoryClosure(root, manifest.assets.filter(asset => asset.location !== "public").map(({ filename }) => filename), planetId, prepared,
    prepared ? ["manifest.json", "runtime-assets.json"] : []);
  if (publicAssets.length) await assertDirectoryClosure(publicRoot!, publicAssets.map(({ filename }) => filename), planetId, true);
  for (const asset of manifest.assets) {
    const bytes = await readFile(resolve(asset.location === "public" ? publicRoot! : root, asset.filename));
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (bytes.byteLength !== asset.bytes || digest !== asset.sha256) {
      throw new Error(`Planet ${planetId} runtime asset drifted: ${asset.filename}.`);
    }
  }
  return true;
}

export function validateRuntimeAssetManifest(planetId: string, input: unknown): true {
  const manifest = input as RuntimeAssetManifest;
  if (!manifest || typeof manifest !== "object" || isArray(manifest) ||
      manifest.schema !== `css${planetId}-runtime-assets@1` ||
      (manifest.resourceRoot !== undefined && manifest.resourceRoot !== "prepared") ||
      !isArray(manifest.assets) || manifest.assets.length === 0) {
    throw new TypeError(`Planet ${planetId} runtime asset manifest is incompatible.`);
  }
  const filenames = new Set();
  for (const asset of manifest.assets) {
    if (!asset || typeof asset !== "object" ||
        typeof asset.filename !== "string" ||
        (asset.location !== undefined && (manifest.resourceRoot !== "prepared" || asset.location !== "public")) ||
        !(manifest.resourceRoot === "prepared"
          ? asset.filename.split("/").every(component => SAFE_FILENAME.test(component))
          : SAFE_FILENAME.test(asset.filename)) ||
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

export function requireRuntimeAssetManifest(planetId: string, input: unknown): Readonly<RuntimeAssetManifest> {
  validateRuntimeAssetManifest(planetId, input);
  return input as RuntimeAssetManifest;
}

async function runtimeFiles(root: string, planetId: string, nested: boolean, prefix = ""): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const name = `${prefix}${entry.name}`;
    if (entry.isFile()) files.push(name);
    else if (nested && entry.isDirectory() && SAFE_FILENAME.test(entry.name)) {
      files.push(...await runtimeFiles(resolve(root, entry.name), planetId, true, `${name}/`));
    } else throw new Error(`Unexpected ${planetId} asset directory: ${name}.`);
  }
  return files;
}

async function assertDirectoryClosure(root: string, filenames: readonly string[], planetId: string, nested = false, metadata: readonly string[] = []) {
  const actual = (await runtimeFiles(root, planetId, nested)).filter(filename => !metadata.includes(filename) || filenames.includes(filename));
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
