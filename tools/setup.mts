import { sha256 } from '../src/platform/sha256.mts';
import type { RuntimeAssetLocation } from './runtime-assets.mts';
interface InstallProgress {completed: number; total: number; installed: number; reused: number;}
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { publishSourceBytes } from "../src/platform/source-acquisition.mts";
import { runtimeAssets, setupObjectIds } from "./runtime-assets.mts";

// Install already prepared files. Source acquisition and geometry authoring
// remain separate; setup needs neither a browser nor the worldwide mirror.
export async function installRuntimeAssets(assets: readonly RuntimeAssetLocation[], { fetcher = fetch, concurrency = 8,
  onProgress = () => {} }: {fetcher?: typeof fetch; concurrency?: number; onProgress?: (progress: InstallProgress) => void} = {}) {
  let next = 0, installed = 0, reused = 0;
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
          const response = await fetcher(asset.url, { signal: AbortSignal.timeout(120000) });
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
        onProgress({ completed: installed + reused, total: assets.length, installed, reused });
      } catch (error) { failures.push(error instanceof Error ? error.message : String(error)); }
    }
  }));
  if (failures.length) {
    throw new Error(`${failures.length} of ${assets.length} prepared files could not be installed:\n${failures.join('\n')}`);
  }
  return { installed, reused };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const ids = setupObjectIds(process.argv.slice(2));
  const assets = await runtimeAssets(resolve(import.meta.dirname, ".."), ids);
  console.log(`Setting up ${ids.join(", ")}: ${assets.length} prepared files. No source preparation or geometry mirror required.`);
  const result = await installRuntimeAssets(assets, { onProgress: ({ completed, total }) => {
    if (completed % 100 === 0) console.log(`Prepared files: ${completed}/${total}`);
  } });
  console.log(`Setup complete: ${result.installed} downloaded, ${result.reused} reused. Run pnpm dev.`);
}
