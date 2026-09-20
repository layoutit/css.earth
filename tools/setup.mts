import { sha256 } from '../src/platform/sha256.mts';
import type { RuntimeAssetLocation } from './runtime-assets.mts';
interface InstallProgress {completed: number; total: number; installed: number; reused: number; skipped: number;}
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { publishSourceBytes } from "../src/platform/source-acquisition.mts";
import { runtimeAssets, setupObjectIds } from "./runtime-assets.mts";

/** `node tools/setup.mts --allow-missing` or `CSSEARTH_ALLOW_MISSING_ASSETS=1`: deploy builds only. */
export function readAllowMissingFlag(args: readonly string[] = []) {
  return args.includes("--allow-missing") || process.env.CSSEARTH_ALLOW_MISSING_ASSETS === "1";
}

function retryUrl(url: string, sha256: string, attempt: number): string {
  if (attempt === 1) return url;
  const retried = new URL(url);
  retried.searchParams.set("cssearth-retry", `${sha256}-${attempt}`);
  return retried.href;
}

async function fetchRuntimeAsset(asset: RuntimeAssetLocation, fetcher: typeof fetch, attempts: number,
  retryDelayMs: number, retry404: boolean): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetcher(retryUrl(asset.url, asset.sha256, attempt), { signal: AbortSignal.timeout(120000) });
      const retryable = (retry404 && response.status === 404) || response.status === 408 || response.status === 429 || response.status >= 500;
      if (!retryable || attempt === attempts) return response;
      await response.body?.cancel();
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
    }
    await new Promise(resolveDelay => setTimeout(resolveDelay, retryDelayMs * 2 ** (attempt - 1)));
  }
  throw lastError;
}

// Install already prepared files. Source acquisition and geometry authoring
// remain separate; setup needs neither a browser nor the worldwide mirror.
export async function installRuntimeAssets(assets: readonly RuntimeAssetLocation[], { fetcher = fetch, concurrency = 8,
  allowMissing = false, attempts = 4, retryDelayMs = 1000, onProgress = () => {} }: {fetcher?: typeof fetch;
  concurrency?: number; allowMissing?: boolean; attempts?: number; retryDelayMs?: number;
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
          // A newly published immutable key can briefly be a regional 404 through the asset domain even after
          // R2 accepted it. Retry transient responses with a distinct query so an intermediary cannot keep
          // replaying one negative lookup. Deploy's explicit allow-missing mode still handles a real 404 at once.
          const response = await fetchRuntimeAsset(asset, fetcher, attempts, retryDelayMs, !allowMissing);
          // A deploy build may tolerate one object's asset genuinely missing from R2 (a 404, not a flaky
          // 5xx/network error) rather than fail the whole build: skip it loudly and let the object's own
          // unavailable-package path report it, instead of installing a fabricated or partial file here.
          if (response.status === 404 && allowMissing) {
            await response.body?.cancel();
            console.warn(`Prepared asset missing on R2, skipping (allow-missing): ${asset.id}/${asset.filename} (HTTP 404).`);
            skipped++;
            onProgress({ completed: installed + reused + skipped, total: assets.length, installed, reused, skipped });
            continue;
          }
          if (!response.ok || !response.body) {
            await response.body?.cancel();
            throw new Error(`Prepared asset unavailable: ${asset.id}/${asset.filename} (HTTP ${response.status}).`);
          }
          const chunks: Uint8Array[] = [];
          let size = 0;
          for await (const chunk of response.body) {
            size += chunk.length;
            if (size > asset.bytes) throw new Error(`Prepared asset exceeds its expected size: ${asset.filename}.`);
            chunks.push(chunk);
          }
          await publishSourceBytes({ destination: asset.file, bytes: Buffer.concat(chunks),
            planetName: asset.id, entry: { path: asset.filename,
              expectedBytes: asset.bytes, expectedSha256: asset.sha256 } });
          installed++;
        }
        onProgress({ completed: installed + reused + skipped, total: assets.length, installed, reused, skipped });
      } catch (error) { failures.push(error instanceof Error ? error.message : String(error)); }
    }
  }));
  if (failures.length) {
    throw new Error(`${failures.length} of ${assets.length} prepared files could not be installed:\n${failures.join('\n')}`);
  }
  return { installed, reused, skipped };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const allowMissing = readAllowMissingFlag(process.argv.slice(2));
  const ids = setupObjectIds(process.argv.slice(2).filter(arg => arg !== "--allow-missing"));
  const assets = await runtimeAssets(resolve(import.meta.dirname, ".."), ids);
  console.log(`Setting up ${ids.join(", ")}: ${assets.length} prepared files. No source preparation or geometry mirror required.`);
  const result = await installRuntimeAssets(assets, { allowMissing, onProgress: ({ completed, total }) => {
    if (completed % 100 === 0) console.log(`Prepared files: ${completed}/${total}`);
  } });
  console.log(`Setup complete: ${result.installed} downloaded, ${result.reused} reused${result.skipped ? `, ${result.skipped} skipped (missing on R2, allow-missing)` : ""}. Run pnpm dev.`);
}
