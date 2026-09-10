// The existing runtime asset publisher, limited to this batch and one upload.
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runtimeAssets, setupObjectIds } from "../../tools/runtime-assets.mjs";

// Maintainer command: publish only the files in the checked-in inventories.
// Each URL contains its content hash, so existing releases remain usable.
const assets = await runtimeAssets(resolve(import.meta.dirname, "../.."), setupObjectIds(["--object=aethra","--object=lyyli","--object=hela","--object=kemi","--object=taurinensis"]));
for (const asset of assets) {
  const bytes = await readFile(asset.file);
  if (bytes.length !== asset.bytes || createHash("sha256").update(bytes).digest("hex") !== asset.sha256) {
    throw new Error(`Prepare ${asset.id}/${asset.filename} before publishing it.`);
  }
}
const directory = await mkdtemp(join(tmpdir(), "cssearth-publish-assets-"));
try {
  const filename = join(directory, "assets.json");
  await writeFile(filename, JSON.stringify(assets.map(({ key, file }) => ({ key, file }))));
  console.log(`Publishing ${assets.length} prepared files (${(assets.reduce((sum, a) => sum + a.bytes, 0) / 1e6).toFixed(1)} MB).`);
  await new Promise((accept, reject) => {
    const child = spawn("npx", ["--yes", "wrangler@4.129.0", "r2", "bulk", "put", "cssearth-assets",
      "--filename", filename, "--concurrency", "1", "--remote", "--force",
      "--content-type", "application/octet-stream", "--cache-control", "public,max-age=31536000,immutable"],
    { stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (code, signal) => code === 0 ? accept() : reject(new Error(`Asset publication failed: ${signal ?? code}`)));
  });
} finally {
  await rm(directory, { recursive: true, force: true });
}
