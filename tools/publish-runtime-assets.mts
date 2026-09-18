import { sha256 } from '../src/platform/sha256.mts';
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runtimeAssets, setupObjectIds, RUNTIME_ASSET_ORIGIN } from "./runtime-assets.mts";
import { verifyPublished, reportVerification, type PublishAsset } from "./publish-verification.mts";

const BUCKET = "cssearth-assets";
const CONTENT_TYPE = "application/octet-stream";
const CACHE_CONTROL = "public,max-age=31536000,immutable";

function run(command: string, args: readonly string[]): Promise<void> {
  return new Promise((accept, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (code, signal) => code === 0 ? accept() : reject(new Error(`${command} failed: ${signal ?? code}`)));
  });
}

async function uploadOne(asset: PublishAsset): Promise<void> {
  await run("npx", ["--yes", "wrangler@4.129.0", "r2", "object", "put", `${BUCKET}/${asset.key}`,
    "--file", asset.file, "--remote", "--content-type", CONTENT_TYPE, "--cache-control", CACHE_CONTROL]);
}

// Maintainer command: publish only the files in the checked-in inventories. Each URL contains its content hash, so
// existing releases remain usable. `wrangler r2 bulk put` is fire-and-forget and has silently dropped a subset of a
// batch before, so every key is HEAD-verified afterward, misses are retried individually, and JSON keys plus a
// sample of the rest are byte-verified; see tools/publish-verification.mts.
export async function publishRuntimeAssets(objectIds: readonly string[]): Promise<void> {
  const assets = await runtimeAssets(resolve(import.meta.dirname, ".."), setupObjectIds(objectIds));
  for (const asset of assets) {
    const bytes = await readFile(asset.file);
    if (bytes.length !== asset.bytes || sha256(bytes) !== asset.sha256) {
      throw new Error(`Prepare ${asset.id}/${asset.filename} before publishing it.`);
    }
  }
  const directory = await mkdtemp(join(tmpdir(), "cssearth-publish-assets-"));
  try {
    const filename = join(directory, "assets.json");
    await writeFile(filename, JSON.stringify(assets.map(({ key, file }) => ({ key, file }))));
    console.log(`Publishing ${assets.length} prepared files (${(assets.reduce((sum, a) => sum + a.bytes, 0) / 1e6).toFixed(1)} MB).`);
    await run("npx", ["--yes", "wrangler@4.129.0", "r2", "bulk", "put", BUCKET,
      "--filename", filename, "--concurrency", "8", "--remote", "--force",
      "--content-type", CONTENT_TYPE, "--cache-control", CACHE_CONTROL]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  const result = await verifyPublished(assets, { origin: RUNTIME_ASSET_ORIGIN, uploadOne });
  reportVerification(result);
  console.log(`Verified ${assets.length} key(s) live on ${RUNTIME_ASSET_ORIGIN}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await publishRuntimeAssets(process.argv.slice(2));
}
