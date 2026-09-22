import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { installRuntimeAssets, readAllowMissingFlag } from "./setup.mts";
import { preparedAssetObjectIds, preparedAssets } from "./runtime-assets.mts";

/** `pnpm setup:prepared`: restore each object's `prepared-assets.json` inventory (baked `prepared/*` output that
 * git no longer tracks). `setup:assets` runs this too, so a plain `pnpm setup:assets` remains the one command a
 * clean checkout needs. */
export async function setupPrepared(args: readonly string[], root = resolve(import.meta.dirname, "../..")) {
  const ids = preparedAssetObjectIds(args.filter(arg => arg !== "--allow-missing"), root);
  const assets = await preparedAssets(root, ids);
  return { ids, assets };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(import.meta.dirname, "../..");
  const argv = process.argv.slice(2);
  const allowMissing = readAllowMissingFlag(argv);
  const { ids, assets } = await setupPrepared(argv, root);
  console.log(`Setting up prepared assets for ${ids.join(", ")}: ${assets.length} file(s). No source preparation or geometry mirror required.`);
  const result = await installRuntimeAssets(assets, { allowMissing, onProgress: ({ completed, total }) => {
    if (completed % 100 === 0) console.log(`Prepared assets: ${completed}/${total}`);
  } });
  console.log(`Prepared setup complete: ${result.installed} downloaded, ${result.reused} reused${result.skipped ? `, ${result.skipped} skipped (missing on R2, allow-missing)` : ""}.`);
}
