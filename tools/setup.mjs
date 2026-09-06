import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { publishSourceBytes } from "../src/platform/source-acquisition.mjs";
import { runtimeAssets, setupObjectIds } from "./runtime-assets.mjs";

// Install already prepared files. Source acquisition and geometry authoring
// remain separate; setup needs neither a browser nor the worldwide mirror.
export async function installRuntimeAssets(assets, { fetcher = fetch, concurrency = 8,
  onProgress = () => {} } = {}) {
  let next = 0, installed = 0, reused = 0, failure;
  await Promise.all(Array.from({ length: Math.min(concurrency, assets.length) }, async () => {
    while (!failure && next < assets.length) {
      const asset = assets[next++];
      try {
        let existing;
        try { existing = await readFile(asset.file); }
        catch (error) { if (error.code !== "ENOENT") throw error; }
        if (existing?.length === asset.bytes &&
            createHash("sha256").update(existing).digest("hex") === asset.sha256) {
          reused++;
        } else {
          const response = await fetcher(asset.url, { signal: AbortSignal.timeout(120000) });
          if (!response.ok || !response.body) {
            await response.body?.cancel();
            throw new Error(`Prepared asset unavailable: ${asset.id}/${asset.filename} (HTTP ${response.status}).`);
          }
          const chunks = [];
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
      } catch (error) { failure ??= error; }
    }
  }));
  if (failure) throw failure;
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
