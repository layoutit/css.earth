import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { installRuntimeAssets } from "./setup.mjs";

test("setup installs pinned files, reuses them offline, and repairs a corrupt file", async () => {
  const root = await mkdtemp(join(tmpdir(), "cssearth-setup-"));
  const bytes = Buffer.from("prepared image");
  const asset = { id: "earth", filename: "image.webp", file: join(root, "image.webp"),
    url: "https://example.invalid/image.webp", bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex") };
  try {
    let requests = 0;
    const fetcher = async () => { requests++; return new Response(bytes); };
    assert.deepEqual(await installRuntimeAssets([asset], { fetcher }), { installed: 1, reused: 0 });
    assert.deepEqual(await readFile(asset.file), bytes);
    assert.deepEqual(await installRuntimeAssets([asset], { fetcher }), { installed: 0, reused: 1 });
    assert.equal(requests, 1);
    await writeFile(asset.file, "outdated");
    await assert.rejects(installRuntimeAssets([asset], {
      fetcher: async () => new Response(Buffer.alloc(bytes.length)),
    }), /hash drifted/);
    assert.equal(await readFile(asset.file, "utf8"), "outdated");
    await installRuntimeAssets([asset], { fetcher });
    assert.deepEqual(await readFile(asset.file), bytes);
  } finally { await rm(root, { recursive: true, force: true }); }
});
