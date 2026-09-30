import { sha256 } from '@cssearth/core/node';
import type { RuntimeAssetLocation } from '../delivery/index.ts';
interface InstallProgress {completed: number; total: number; installed: number; reused: number; skipped: number;}
/** Network failures and 5xx are retried; a 404 is a verdict and is never retried. */
const TRANSIENT_RETRIES = 3, RETRY_BACKOFF_MS = 500;
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
import { existsSync, statSync } from "node:fs";
import { readFile, utimes } from "node:fs/promises";
import { resolve } from "node:path";
import { publishSourceBytes } from "../delivery/index.ts";
import { PREPARED_CATALOGUE, readPreparedObjects } from "@cssearth/objects/node";
import { ASSET_LOCATIONS, type AssetLocation } from '@cssearth/objects/node';
import { inventoriedObjectIds, inventoryAssets, volumeMetadataAssets } from '../delivery/index.ts';

/** `node packages/bake/cli/setup-assets.mts --allow-missing` or `CSSEARTH_ALLOW_MISSING_ASSETS=1`: deploy builds only. */
export function readAllowMissingFlag(args: readonly string[] = []) {
  return args.includes("--allow-missing") || process.env.CSSEARTH_ALLOW_MISSING_ASSETS === "1";
}

// Install already prepared files. Source acquisition and geometry authoring
// remain separate; setup needs neither a browser nor the worldwide mirror.
//
// Reads are latency-bound: thousands of small files, each one round trip. At 8 a CI universe lane spent 163 of
// its 172-second restore fetching 16,143 files at about 100 a second. Timed on 1,200 files, 8 took 33.9s, 32 took
// 8.4s and 64 took 4.3s; on 3,000 files 256 and 512 returned every request with 200, no 429 and no retry. The
// assets are served from a custom domain, which R2 does not rate-limit (only r2.dev is), so the limit is the
// client, and past 256 the gain was inside the noise of one connection. A CI restore on 2026-09-24 still met one 429 in 9,417
// files, so a 429 is retried like a 5xx, after the Retry-After it names when it names one.
export const RUNTIME_ASSET_CONCURRENCY = 256;
export async function installRuntimeAssets(assets: readonly RuntimeAssetLocation[], { fetcher = fetch, concurrency = RUNTIME_ASSET_CONCURRENCY,
  allowMissing = false, trustFresh = false, onProgress = () => {}, wait = delay }: {fetcher?: typeof fetch; concurrency?: number; allowMissing?: boolean;
  /** Trust a file written after its inventory by its size (a developer's `setup:assets`); CI hashes every file. */
  trustFresh?: boolean; onProgress?: (progress: InstallProgress) => void;
  /** The pause before a retry; a test passes one that returns at once. */
  wait?: (ms: number) => Promise<void>} = {}) {
  let next = 0, installed = 0, reused = 0, skipped = 0;
  // A fresh checkout should learn about every missing or drifted file in one
  // run, so keep installing after a failure and report them together.
  const failures: string[] = [];
  // With `trustFresh`, a file written after its object's inventory was last checked out holds what that inventory pins, so
  // a matching size is enough. One older than its inventory predates a checkout that may have changed the pin, and is hashed; a verified
  // file is then touched so the next run trusts it. Hashing all 110,000 files cost every dev start 24 s. A same-size
  // local edit to a prepared file is left for CI and publishing, which hash every asset (verifyInventory).
  const inventoryTimes = new Map<string, Promise<number>>();
  const inventoryTime = (path: string) => {
    let time = inventoryTimes.get(path);
    if (!time) inventoryTimes.set(path, time = Promise.resolve(statSync(path, { throwIfNoEntry: false })?.mtimeMs ?? Number.POSITIVE_INFINITY));
    return time;
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, assets.length) }, async () => {
    while (next < assets.length) {
      const asset = assets[next++];
      try {
        // Synchronous: 110,000 async stats queue on libuv's four threads and cost seconds of idle.
        const info = statSync(asset.file, { throwIfNoEntry: false });
        let existing: Buffer | undefined;
        if (info?.size === asset.bytes && !(trustFresh && asset.inventory && info.mtimeMs > await inventoryTime(asset.inventory))) existing = await readFile(asset.file);
        if (info?.size === asset.bytes && (existing === undefined || sha256(existing) === asset.sha256)) {
          if (existing !== undefined) { const now = new Date(); await utimes(asset.file, now, now); }
          reused++;
        } else {
          // A dropped connection, a 5xx or a 429 is not a missing asset. Across 5,500+ files a single transient
          // failure would otherwise fail the whole run, so retry them with backoff, including a
          // connection that drops while the body streams. A 404 still fails (or skips) on the first
          // response: "not published" is a fact, not a blip.
          let bytes: Buffer | 'missing' | undefined;
          for (let attempt = 0; bytes === undefined; attempt++) {
            let response: Awaited<ReturnType<typeof fetcher>> | undefined;
            try {
              response = await fetcher(asset.url, { signal: AbortSignal.timeout(120000) });
              if ((response.status >= 500 || response.status === 429) && attempt < TRANSIENT_RETRIES) {
                const after = Number(response.headers.get('retry-after'));
                await response.body?.cancel(); await wait(after > 0 ? Math.min(after, 30) * 1000 : RETRY_BACKOFF_MS * 2 ** attempt); continue;
              }
              // A deploy build may tolerate one object's asset genuinely missing from R2 (a 404, not a flaky
              // 5xx/network error) rather than fail the whole build: skip it loudly and let the object's own
              // unavailable-package path report it, instead of installing a fabricated or partial file here.
              if (response.status === 404 && allowMissing) { await response.body?.cancel(); bytes = 'missing'; break; }
              if (!response.ok || !response.body) {
                await response.body?.cancel();
                throw new Error(`Prepared asset unavailable: ${asset.id}/${asset.filename} (HTTP ${response.status}).`);
              }
              const chunks: Uint8Array[] = [];
              let size = 0;
              for await (const chunk of response.body) {
                size += chunk.length;
                if (size > asset.bytes) throw new Error(`Prepared asset exceeds its expected size: ${asset.id}/${asset.filename}.`);
                chunks.push(chunk);
              }
              bytes = Buffer.concat(chunks);
            } catch (error) {
              // An HTTP answer is final; only a network error (before or during the body) is retried.
              if (response && !response.ok || attempt >= TRANSIENT_RETRIES || (error instanceof Error && error.message.startsWith('Prepared asset'))) throw error;
              await wait(RETRY_BACKOFF_MS * 2 ** attempt);
            }
          }
          if (bytes === 'missing') {
            console.warn(`Prepared asset missing on R2, skipping (allow-missing): ${asset.id}/${asset.filename} (HTTP 404).`);
            skipped++;
            onProgress({ completed: installed + reused + skipped, total: assets.length, installed, reused, skipped });
            continue;
          }
          if (bytes.length !== asset.bytes || sha256(bytes) !== asset.sha256) throw new Error(`Prepared asset does not match its inventory: ${asset.id}/${asset.filename}.`);
          await publishSourceBytes({ destination: asset.file, bytes });
          installed++;
        }
        onProgress({ completed: installed + reused + skipped, total: assets.length, installed, reused, skipped });
      } catch (error) {
        // Name the file on every failure: a bare network message ("terminated") says nothing about which one.
        const message = error instanceof Error ? error.message : String(error);
        failures.push(message.startsWith('Prepared asset') ? message : `${asset.id}/${asset.filename} (${asset.url}): ${message}`);
      }
    }
  }));
  if (failures.length) {
    throw new Error(`${failures.length} of ${assets.length} prepared files could not be installed:\n${failures.join('\n')}`);
  }
  return { installed, reused, skipped };
}

/**
 * `node packages/bake/cli/setup-assets.mts [--object=<id>…] [--location=public|prepared] [--metadata] [--allow-missing]`
 * restores inventoried files from R2. `--location` narrows to one location; `--metadata` restores only the
 * prepared presentation of the volume objects, which is all a deploy catalogue reads.
 */
export async function setupAssets(args: readonly string[], root = process.cwd()) {
  const allowMissing = readAllowMissingFlag(args), metadata = args.includes("--metadata");
  const locationArg = args.find(arg => arg.startsWith("--location="))?.slice("--location=".length);
  if (locationArg !== undefined && !(ASSET_LOCATIONS as readonly string[]).includes(locationArg)) throw new TypeError(`Unknown asset location: ${locationArg}.`);
  const rest = args.filter(arg => arg !== "--allow-missing" && arg !== "--metadata" && !arg.startsWith("--location="));
  const { ids, assets } = metadata ? await volumeMetadataAssets(root)
    : await (async () => { const ids = inventoriedObjectIds(rest, root); return { ids, assets: await inventoryAssets(root, ids, { location: locationArg as AssetLocation | undefined }) }; })();
  console.log(`Setting up ${metadata ? 'catalogue metadata for ' : ''}${ids.length} object(s): ${assets.length} file(s). No source preparation or geometry mirror required.`);
  const result = await installRuntimeAssets(assets, { allowMissing, trustFresh: true, onProgress: ({ completed, total }) => {
    if (completed % 100 === 0) console.log(`Prepared files: ${completed}/${total}`);
  } });
  console.log(`Setup complete: ${result.installed} downloaded, ${result.reused} reused${result.skipped ? `, ${result.skipped} skipped (missing on R2, allow-missing)` : ""}.`);
  return result;
}
