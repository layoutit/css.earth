import { sha256 } from '../../src/platform/sha256.mts';
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { inventoriedAssets, inventoriedObjectIds, RUNTIME_ASSET_ORIGIN } from "./runtime-assets.mts";
import { verifyPublished, reportVerification, type PublishAsset } from "./publish-verification.mts";

const BUCKET = "cssearth-assets";
const CACHE_CONTROL = "public,max-age=31536000,immutable";

interface PublishOptions {
  readonly fetcher?: typeof fetch;
  readonly runCommand?: typeof run;
}

export function contentType(key: string): string {
  return key.endsWith(".json") ? "application/json" : "application/octet-stream";
}

function run(command: string, args: readonly string[]): Promise<void> {
  return new Promise((accept, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (code, signal) => code === 0 ? accept() : reject(new Error(`${command} failed: ${signal ?? code}`)));
  });
}

async function requireLocalAsset(asset: PublishAsset): Promise<void> {
  const bytes = await readFile(asset.file);
  if (bytes.length !== asset.bytes || sha256(bytes) !== asset.sha256) {
    throw new Error(`Prepare ${asset.file} before publishing ${asset.key}: local bytes do not match the inventory.`);
  }
}

// A batch of hundreds to thousands of uploads over a real network will occasionally hit one transient failure
// (observed live: a single "fetch failed" mid-batch aborts wrangler's whole bulk-put run, having uploaded only
// a handful of the batch). Re-running the same batch is safe (`--force`, content-addressed keys) and cheap
// relative to giving up, so retry the whole batch a few times before surfacing the failure.
async function bulkPut(batch: readonly PublishAsset[], type: string, runCommand: typeof run, attempts = 8): Promise<void> {
  if (!batch.length) return;
  const directory = await mkdtemp(join(tmpdir(), "cssearth-publish-assets-"));
  try {
    const filename = join(directory, "assets.json");
    await writeFile(filename, JSON.stringify(batch.map(({ key, file }) => ({ key, file }))));
    for (let attempt = 1; ; attempt++) {
      // Validate at the upload boundary, including retries after local files may have changed.
      for (const asset of batch) await requireLocalAsset(asset);
      try {
        // A lower concurrency than wrangler's own default cuts how often the R2 API returns a transient
        // "fetch failed" / 500 under load (observed live: repeated failures at --concurrency 16, none once
        // reduced), at the cost of a slower first pass; --force + content-addressed keys keep every retry safe.
        await runCommand("npx", ["--yes", "wrangler@4.129.0", "r2", "bulk", "put", BUCKET,
          "--filename", filename, "--concurrency", "6", "--remote", "--force",
          "--content-type", type, "--cache-control", CACHE_CONTROL]);
        return;
      } catch (error) {
        if (attempt >= attempts) throw error;
        const waitMs = 3000 * attempt;
        console.log(`Bulk upload attempt ${attempt}/${attempts} failed (${(error as Error).message}); retrying the batch in ${waitMs}ms.`);
        await new Promise(accept => setTimeout(accept, waitMs));
      }
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function uploadOne(asset: PublishAsset, runCommand: typeof run): Promise<void> {
  // A live key can fail a later HEAD: it never passed the initial-miss validation.
  await requireLocalAsset(asset);
  await runCommand("npx", ["--yes", "wrangler@4.129.0", "r2", "object", "put", `${BUCKET}/${asset.key}`,
    "--file", asset.file, "--remote", "--content-type", contentType(asset.key), "--cache-control", CACHE_CONTROL]);
}

async function isPublished(key: string, expectedBytes: number, fetcher: typeof fetch): Promise<boolean> {
  const response = await fetcher(`${RUNTIME_ASSET_ORIGIN}/${key}`, { method: "HEAD" }).catch(() => null);
  if (!response || !response.ok) return false;
  if (response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== contentType(key)) return false;
  // See publish-verification.mts's headOk: a compressed (e.g. brotli) response can omit content-length entirely.
  const contentLength = response.headers.get("content-length");
  return contentLength === null || Number(contentLength) === expectedBytes;
}

async function findMisses<T extends PublishAsset>(assets: readonly T[], fetcher: typeof fetch, concurrency = 32): Promise<T[]> {
  const misses: T[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, assets.length) }, async () => {
    while (next < assets.length) {
      const asset = assets[next++]!;
      if (!(await isPublished(asset.key, asset.bytes, fetcher))) misses.push(asset);
    }
  }));
  return misses;
}

// Maintainer command: publish only the files in the checked-in inventories — both `runtime-assets.json` (public
// scene textures) and `prepared-assets.json` (baked `prepared/*` output git no longer tracks). Each
// URL contains its content hash, so existing releases remain usable and re-running this command is cheap: HEAD
// every key first (concurrently) and bulk-upload only the misses (`wrangler r2 bulk put`, batched by content
// type since one invocation takes one content type), then run the existing HEAD + byte verification pass, whose
// own retry path uses a per-key `wrangler r2 object put` for whatever it still finds missing — see
// tools/publish-verification.mts. `wrangler r2 bulk put` has silently dropped a subset of a batch before, which
// is exactly what that verification pass catches.
export async function publishRuntimeAssets(objectIds: readonly string[]): Promise<void> {
  const root = resolve(import.meta.dirname, "../..");
  const assets = await inventoriedAssets(root, inventoriedObjectIds(objectIds, root));
  await publishAssets(assets);
}

export async function publishAssets(assets: readonly PublishAsset[], options: PublishOptions = {}): Promise<void> {
  const fetcher = options.fetcher ?? fetch;
  const runCommand = options.runCommand ?? run;
  const totalBytes = assets.reduce((sum, a) => sum + a.bytes, 0);
  console.log(`Checking ${assets.length} inventoried file(s) (${(totalBytes / 1e6).toFixed(1)} MB) against ${RUNTIME_ASSET_ORIGIN}.`);
  const misses = await findMisses(assets, fetcher);
  // A partial maintainer checkout only needs the bytes that R2 is actually missing. Content-addressed keys
  // already verified live do not need to be materialized locally just to publish a newly generated subset.
  for (const asset of misses) await requireLocalAsset(asset);
  console.log(`${assets.length - misses.length} already published; uploading ${misses.length} miss(es).`);
  await bulkPut(misses.filter(a => a.key.endsWith(".json")), "application/json", runCommand);
  await bulkPut(misses.filter(a => !a.key.endsWith(".json")), "application/octet-stream", runCommand);
  // A key that was just written can briefly HEAD as missing on some edge before R2 finishes propagating it
  // (observed: a fresh write not yet visible seconds later). Retry the whole HEAD + byte verification pass a
  // few times with backoff before treating a miss as real; the check itself never loosens.
  const verification = { origin: RUNTIME_ASSET_ORIGIN, fetcher, uploadOne: (asset: PublishAsset) => uploadOne(asset, runCommand) };
  let result = await verifyPublished(assets, verification);
  for (let attempt = 0; (result.misses.length || result.sampleFailures.length) && attempt < 5; attempt++) {
    const waitMs = 2000 * 2 ** attempt;
    console.log(`Verification still lists ${result.misses.length} miss(es), ${result.sampleFailures.length} byte-check failure(s); retrying in ${waitMs}ms (attempt ${attempt + 1}/5).`);
    await new Promise(accept => setTimeout(accept, waitMs));
    result = await verifyPublished(assets, verification);
  }
  reportVerification(result);
  console.log(`Verified ${assets.length} key(s) live on ${RUNTIME_ASSET_ORIGIN}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await publishRuntimeAssets(process.argv.slice(2));
}
