import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { inventoriedAssets, inventoriedObjectIds, RUNTIME_ASSET_ORIGIN, type RuntimeAssetLocation } from "./runtime-assets.mts";

/**
 * Phase 3 gate (`check:assets-published`): HEAD every key from both inventory kinds (`runtime-assets.json` and
 * Phase 2's `prepared-assets.json`) and report exactly which ones are missing from R2. Read-only: never uploads,
 * never deletes. A CI job runs this after `pnpm build` on a PR to prove the build did not silently depend on a
 * local file that was never published.
 */
export async function checkAssetsPublished(objectIds: readonly string[], { origin = RUNTIME_ASSET_ORIGIN, fetcher = fetch,
  root = resolve(import.meta.dirname, ".."), concurrency = 16 }:
  { origin?: string; fetcher?: typeof fetch; root?: string; concurrency?: number } = {}): Promise<{ checked: number; misses: readonly string[] }> {
  const ids = inventoriedObjectIds(objectIds, root);
  const assets = await inventoriedAssets(root, ids);
  const misses: string[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, assets.length) }, async () => {
    while (next < assets.length) {
      const asset: RuntimeAssetLocation = assets[next++]!;
      const response = await fetcher(`${origin}/${asset.key}`, { method: "HEAD" }).catch(() => null);
      // A compressed (e.g. brotli) response can omit content-length entirely — see publish-verification.mts's headOk.
      const contentLength = response?.headers.get("content-length") ?? null;
      const ok = !!response && response.ok && (contentLength === null || Number(contentLength) === asset.bytes);
      if (!ok) misses.push(`${asset.id}/${asset.filename} (${asset.key})`);
    }
  }));
  misses.sort((left, right) => left.localeCompare(right));
  return { checked: assets.length, misses };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { checked, misses } = await checkAssetsPublished(process.argv.slice(2));
  console.log(`Checked ${checked} inventoried file(s) against ${RUNTIME_ASSET_ORIGIN}.`);
  if (misses.length) {
    console.error(`${misses.length} file(s) are not published:`);
    for (const miss of misses) console.error(`  ${miss}`);
    process.exitCode = 1;
  } else {
    console.log("Every inventoried file is published.");
  }
}
