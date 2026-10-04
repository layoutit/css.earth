import { projectRoot as checkoutProjectRoot, sha256 } from '@cssearth/core/node';
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join, resolve } from "node:path";
import { inventoryAssets, inventoriedObjectIds, expectedContentType, verifyPublished, reportVerification, type PublishAsset } from '../delivery/index.ts';
import { RUNTIME_ASSET_ORIGIN } from '../objects/sources/index.ts';

const BUCKET = "cssearth-assets";
const CACHE_CONTROL = "public,max-age=31536000,immutable";

interface PublishOptions {
  readonly fetcher?: typeof fetch;
  readonly runCommand?: typeof run;
}

/** One owner of the published media types (publish-verification.ts). */
export const contentType = expectedContentType;

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
// A retry asks R2 again which keys are still missing and uploads only those: a 429 aborts wrangler part-way, and re-sending
// the whole batch spent the rate limit on files already written (observed 2026-09-29: a 502-file batch failed all 8 attempts).
async function bulkPut(pending: readonly PublishAsset[], type: string, runCommand: typeof run,
  stillMissing: (assets: readonly PublishAsset[]) => Promise<readonly PublishAsset[]> = async assets => assets, attempts = 8): Promise<void> {
  let batch = pending;
  if (!batch.length) return;
  const directory = await mkdtemp(join(tmpdir(), "cssearth-publish-assets-"));
  try {
    const filename = join(directory, "assets.json");
    for (let attempt = 1; ; attempt++) {
      await writeFile(filename, JSON.stringify(batch.map(({ key, file }) => ({ key, file }))));
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
        // Cloudflare's API limit is counted over five minutes; a longer wait lets a rate-limited window drain.
        const waitMs = 30000 * attempt;
        await new Promise(accept => setTimeout(accept, waitMs));
        batch = await stillMissing(batch);
        console.log(`Bulk upload attempt ${attempt}/${attempts} failed (${(error as Error).message}); ${batch.length} key(s) still missing after ${waitMs}ms.`);
        if (!batch.length) return;
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
  // See headOk in packages/bake/src/delivery/publish-verification.ts: a compressed (e.g. brotli) response can omit content-length entirely.
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

// Maintainer command: publish only the files in the checked-in inventories (`inventory.json`: public scene
// textures and baked `prepared/*` output git does not hold). Each
// URL contains its content hash, so existing releases remain usable and re-running this command is cheap: HEAD
// every key first (concurrently) and bulk-upload only the misses (`wrangler r2 bulk put`, batched by content
// type since one invocation takes one content type), then run the existing HEAD + byte verification pass, whose
// own retry path uses a per-key `wrangler r2 object put` for whatever it still finds missing — see
// packages/bake/src/delivery/publish-verification.ts. `wrangler r2 bulk put` has silently dropped a subset of a batch before, which
// is exactly what that verification pass catches.
export async function publishRuntimeAssets(objectIds: readonly string[], { since }: { since?: string } = {}): Promise<void> {
  const root = checkoutProjectRoot(import.meta.url);
  const ids = inventoriedObjectIds(objectIds, root);
  const assets = await inventoryAssets(root, ids);
  if (since === undefined) return publishAssets(assets);
  // Every key a base revision's inventories list is already live: that revision's own CI restored it from R2. Only the
  // entries this checkout adds need a HEAD and an upload; checking the whole catalogue asks R2 what it already said.
  const published = new Set<string>();
  for (const id of ids) {
    const text = await promisify(execFile)("git", ["show", `${since}:src/objects/${id}/inventory.json`], { cwd: root, maxBuffer: 1 << 26 })
      .then(({ stdout }) => stdout, () => null);
    if (text === null) continue;
    for (const asset of (JSON.parse(text) as { assets: { sha256: string; filename: string }[] }).assets) published.add(`runtime-assets/${asset.sha256}/${asset.filename}`);
  }
  const added = assets.filter(asset => !published.has(asset.key));
  console.log(`${assets.length - added.length} of ${assets.length} inventoried file(s) are listed on ${since}; publishing the other ${added.length}.`);
  if (added.length) await publishAssets(added);
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
  const stillMissing = (batch: readonly PublishAsset[]) => findMisses(batch, fetcher);
  // A bulk upload carries one media type, so each type uploads on its own.
  for (const type of new Set(misses.map(asset => contentType(asset.key)))) {
    await bulkPut(misses.filter(asset => contentType(asset.key) === type), type, runCommand, stillMissing);
  }
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
