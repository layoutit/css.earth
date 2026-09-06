import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runtimeAssets, setupObjectIds } from "./runtime-assets.mjs";
import { planRuntimePublication, publishRuntimeAssetChanges } from "./runtime-asset-publication.mjs";

// Maintainer command: publish only the files in the checked-in inventories.
// Each URL contains its content hash, so existing releases remain usable.
export async function uploadRuntimeFiles(assets) {
  if (!assets.length) return;
  if (assets.some(asset => typeof asset.file !== "string" || !/^(?:runtime-assets|dataset-releases)\/[a-z0-9@._/-]+$/u.test(asset.key) || asset.key.includes(".."))) {
    throw new Error("Runtime publication has an invalid bucket key or local file.");
  }
  const directory = await mkdtemp(join(tmpdir(), "cssearth-publish-assets-"));
  try {
    const filename = join(directory, "assets.json");
    await writeFile(filename, JSON.stringify(assets.map(({ key, file }) => ({ key, file }))));
    console.log(`Publishing ${assets.length} prepared files (${(assets.reduce((sum, a) => sum + a.bytes, 0) / 1e6).toFixed(1)} MB).`);
    await new Promise((accept, reject) => {
      const child = spawn("npx", ["--yes", "wrangler@4.129.0", "r2", "bulk", "put", "cssearth-assets",
        "--filename", filename, "--concurrency", "8", "--remote", "--force",
        "--content-type", "application/octet-stream", "--cache-control", "public,max-age=31536000,immutable"],
      { stdio: "inherit" });
      child.once("error", reject);
      child.once("close", (code, signal) => code === 0 ? accept() : reject(new Error(`Asset publication failed: ${signal ?? code}`)));
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), dryRun = args.includes("--dry-run");
  const assets = await runtimeAssets(resolve(import.meta.dirname, ".."), setupObjectIds(args.filter(arg => arg !== "--dry-run")));
  if (dryRun) {
    const plan = await planRuntimePublication(assets);
    console.log(JSON.stringify({ files: assets.length, missing: plan.missing.map(({filename,bytes,sha256}) => ({filename,bytes,sha256})),
      reused: plan.present.length, uploadBytes: plan.missing.reduce((sum, asset) => sum + asset.bytes, 0) }, null, 2));
  } else {
    const result = await publishRuntimeAssetChanges(assets, { upload: uploadRuntimeFiles });
    console.log(JSON.stringify({ ...result, verified: result.verified.length }));
  }
}
