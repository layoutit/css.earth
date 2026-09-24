import { sha256 } from '../../src/platform/sha256.mts';
import type { RuntimeAssetLocation } from './runtime-assets.mts';
interface InstallProgress {completed: number; total: number; installed: number; reused: number; skipped: number;}
/** Network failures and 5xx are retried; a 404 is a verdict and is never retried. */
const TRANSIENT_RETRIES = 3, RETRY_BACKOFF_MS = 500;
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { publishSourceBytes } from "../../src/platform/source-acquisition.mts";
import { ASSET_LOCATIONS, type AssetLocation } from "../../src/platform/runtime-asset-closure.mts";
import { inventoriedObjectIds, inventoryAssets, volumeMetadataAssets } from "./runtime-assets.mts";

/** `node tools/assets/setup.mts --allow-missing` or `CSSEARTH_ALLOW_MISSING_ASSETS=1`: deploy builds only. */
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
// client, and past 256 the gain was inside the noise of one connection.
export const RUNTIME_ASSET_CONCURRENCY = 256;
export async function installRuntimeAssets(assets: readonly RuntimeAssetLocation[], { fetcher = fetch, concurrency = RUNTIME_ASSET_CONCURRENCY,
  allowMissing = false, onProgress = () => {} }: {fetcher?: typeof fetch; concurrency?: number; allowMissing?: boolean;
  onProgress?: (progress: InstallProgress) => void} = {}) {
  let next = 0, installed = 0, reused = 0, skipped = 0;
  // A fresh checkout should learn about every missing or drifted file in one
  // run, so keep installing after a failure and report them together.
  const failures: string[] = [];
  await Promise.all(Array.from({ length: Math.min(concurrency, assets.length) }, async () => {
    while (next < assets.length) {
      const asset = assets[next++];
      try {
        let existing: Buffer | undefined;
        try { existing = await readFile(asset.file); }
        catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; }
        if (existing?.length === asset.bytes &&
            sha256(existing) === asset.sha256) {
          reused++;
        } else {
          // A dropped connection is not a missing asset. Across 5,500+ files a single transient
          // failure would otherwise fail the whole run, so retry the network with backoff, including a
          // connection that drops while the body streams. A 404 still fails (or skips) on the first
          // response: "not published" is a fact, not a blip.
          let bytes: Buffer | 'missing' | undefined;
          for (let attempt = 0; bytes === undefined; attempt++) {
            let response: Awaited<ReturnType<typeof fetcher>> | undefined;
            try {
              response = await fetcher(asset.url, { signal: AbortSignal.timeout(120000) });
              if (response.status >= 500 && attempt < TRANSIENT_RETRIES) { await response.body?.cancel(); await delay(RETRY_BACKOFF_MS * 2 ** attempt); continue; }
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
              await delay(RETRY_BACKOFF_MS * 2 ** attempt);
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
 * `node tools/assets/setup.mts [--object=<id>…] [--location=public|prepared] [--metadata] [--allow-missing]`
 * restores inventoried files from R2. `--location` narrows to one location; `--metadata` restores only the
 * prepared record and presentation of the volume and context objects, which is all a deploy catalogue reads.
 */
/**
 * The files under a body's `prepared/` that a checkout derives itself (`isRegeneratedPreparedFile`): the JSON transport
 * and page from the restored runtime, and for layered bodies the provenance record. R2 never holds them, so a body
 * restored into a checkout that has not baked it has none until something derives them, and the first prepare step to
 * read one fails with a bare ENOENT. Derive them here for every restored scene body that lacks one; a body that has
 * them is left alone, so a repeat run costs nothing. Needs the renderer build (`pnpm prepare:shell`); without it the
 * caller is told which command finishes the job instead of failing on an import.
 */
export async function deriveRestoredPreparedFiles(ids: readonly string[], root: string) {
  const { SCENE_OBJECTS } = await import("../../site/objects.mts");
  const { provenanceIsRegenerated } = await import("../../src/platform/runtime-asset-closure.mts");
  const scene = ids.filter(id => SCENE_OBJECTS.some(object => object.id === id));
  const missing = (id: string, file: string) => !existsSync(resolve(root, "src/objects", id, "prepared", file));
  const pages: string[] = [], provenance: string[] = [];
  for (const id of scene) {
    if (missing(id, "page.json") || missing(id, "object.json")) pages.push(id);
    if (missing(id, "provenance.json") && await provenanceIsRegenerated(resolve(root, "src/objects", id))) provenance.push(id);
  }
  if (!pages.length && !provenance.length) return { pages: 0, provenance: 0 };
  if (!existsSync(new URL("../../src/renderers/css/dist/index.js", import.meta.url))) {
    console.log(`Derived page data not written for ${pages.length + provenance.length} restored object(s): the renderer is not built. Run pnpm prepare:shell && pnpm prepare:object-json.`);
    return { pages: 0, provenance: 0 };
  }
  if (pages.length) {
    const { restoreObjectJson } = await import("./restore-object-json.mts");
    await restoreObjectJson(pages, root, { restoredOnly: true });
  }
  if (provenance.length) {
    const { recoverObjectProvenance } = await import("../prepare/prepare-provenance.mts");
    await recoverObjectProvenance(provenance, { root, catalogue: false });
  }
  return { pages: pages.length, provenance: provenance.length };
}

export async function setupAssets(args: readonly string[], root = resolve(import.meta.dirname, "../..")) {
  const allowMissing = readAllowMissingFlag(args), metadata = args.includes("--metadata");
  const locationArg = args.find(arg => arg.startsWith("--location="))?.slice("--location=".length);
  if (locationArg !== undefined && !(ASSET_LOCATIONS as readonly string[]).includes(locationArg)) throw new TypeError(`Unknown asset location: ${locationArg}.`);
  const rest = args.filter(arg => arg !== "--allow-missing" && arg !== "--metadata" && !arg.startsWith("--location="));
  const { ids, assets } = metadata ? await volumeMetadataAssets(root)
    : await (async () => { const ids = inventoriedObjectIds(rest, root); return { ids, assets: await inventoryAssets(root, ids, { location: locationArg as AssetLocation | undefined }) }; })();
  console.log(`Setting up ${metadata ? 'catalogue metadata for ' : ''}${ids.length} object(s): ${assets.length} file(s). No source preparation or geometry mirror required.`);
  const result = await installRuntimeAssets(assets, { allowMissing, onProgress: ({ completed, total }) => {
    if (completed % 100 === 0) console.log(`Prepared files: ${completed}/${total}`);
  } });
  console.log(`Setup complete: ${result.installed} downloaded, ${result.reused} reused${result.skipped ? `, ${result.skipped} skipped (missing on R2, allow-missing)` : ""}.`);
  if (!metadata && locationArg !== "public") {
    const derived = await deriveRestoredPreparedFiles(ids, root);
    if (derived.pages || derived.provenance) console.log(`Derived page data for ${derived.pages} object(s) and provenance for ${derived.provenance}.`);
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await setupAssets(process.argv.slice(2));
}
