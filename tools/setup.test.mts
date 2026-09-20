import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { installRuntimeAssets, readAllowMissingFlag } from "./setup.mts";
import { inspectContextAvailability } from "./prepare-context-availability.mts";
import { writeContextPackage } from "../tests/fixtures/context-package.mts";

test("setup installs pinned files, reuses them offline, and repairs a corrupt file", async () => {
  const root = await mkdtemp(join(tmpdir(), "cssearth-setup-"));
  const bytes = Buffer.from("prepared image");
  const asset = { id: "earth", key: "earth/image.webp", filename: "image.webp", file: join(root, "image.webp"),
    url: "https://example.invalid/image.webp", bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex") };
  try {
    let requests = 0;
    const fetcher = async () => { requests++; return new Response(bytes); };
    assert.deepEqual(await installRuntimeAssets([asset], { fetcher }), { installed: 1, reused: 0, skipped: 0 });
    assert.deepEqual(await readFile(asset.file), bytes);
    assert.deepEqual(await installRuntimeAssets([asset], { fetcher }), { installed: 0, reused: 1, skipped: 0 });
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

test("setup reports every unavailable file instead of stopping at the first", async () => {
  const root = await mkdtemp(join(tmpdir(), "cssearth-setup-"));
  const asset = (name: string) => ({ id: "sun", key: `sun/${name}`, filename: name, file: join(root, name),
    url: `https://example.invalid/${name}`, bytes: 3, sha256: createHash("sha256").update("abc").digest("hex") });
  try {
    const missing = ["first.webp", "second.webp"];
    await assert.rejects(installRuntimeAssets(missing.map(asset), {
      concurrency: 1, attempts: 1, fetcher: async () => new Response(null, { status: 404 }),
    }), (error: Error) => missing.every(name => error.message.includes(name)) && error.message.includes("2 of 2"));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("setup retries a newly published asset through a fresh URL after a stale 404", async () => {
  const root = await mkdtemp(join(tmpdir(), "cssearth-setup-retry-"));
  const bytes = Buffer.from("prepared image");
  const asset = { id: "earth", key: "earth/image.webp", filename: "image.webp", file: join(root, "image.webp"),
    url: "https://example.invalid/image.webp", bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex") };
  const requests: string[] = [];
  try {
    assert.deepEqual(await installRuntimeAssets([asset], { retryDelayMs: 0, fetcher: async url => {
      requests.push(String(url));
      return requests.length === 1 ? new Response(null, { status: 404 }) : new Response(bytes);
    } }), { installed: 1, reused: 0, skipped: 0 });
    assert.equal(requests[0], asset.url);
    assert.match(requests[1]!, /image\.webp\?cssearth-retry=[a-f0-9]{64}-2$/u);
    assert.deepEqual(await readFile(asset.file), bytes);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("allow-missing (deploy only) skips a genuinely missing R2 file so the object's own unavailable path reports it, without a throw; default mode still fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "cssearth-setup-allow-missing-"));
  try {
    const helix = await writeContextPackage(root, "helix");
    await writeContextPackage(root, "lmc");
    const bankBytes = Buffer.from(JSON.stringify(helix.bank));
    const file = resolve(helix.directory, "prepared/lenses.json");
    await rm(file);
    const asset = { id: "helix", key: "helix/lenses.json", filename: "lenses.json", file,
      url: "https://example.invalid/helix/lenses.json", bytes: bankBytes.length,
      sha256: helix.descriptor.prepared.sha256 };
    const fetcher = async () => new Response(null, { status: 404 });

    // Allow-missing tolerates the 404: no install, no throw, the file stays absent.
    assert.deepEqual(await installRuntimeAssets([asset], { allowMissing: true, fetcher }), { installed: 0, reused: 0, skipped: 1 });
    await assert.rejects(readFile(file));

    // Build-ready state: helix is honestly unavailable (not a fabricated fallback), lmc is untouched.
    const availability = await inspectContextAvailability(root);
    assert.equal(availability.helix.available, false);
    assert.equal(availability.lmc.available, true);

    // Default mode (no allow-missing) still fails outright on the exact same 404.
    await assert.rejects(installRuntimeAssets([asset], { attempts: 1, fetcher }), /helix\/lenses\.json \(HTTP 404\)/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("allow-missing does not swallow a non-404 failure (mutation check: a 5xx must still fail the build)", async () => {
  const root = await mkdtemp(join(tmpdir(), "cssearth-setup-allow-missing-"));
  try {
    const asset = { id: "sun", key: "sun/x.webp", filename: "x.webp", file: join(root, "x.webp"),
      url: "https://example.invalid/x.webp", bytes: 3, sha256: createHash("sha256").update("abc").digest("hex") };
    await assert.rejects(installRuntimeAssets([asset], {
      allowMissing: true, attempts: 1, fetcher: async () => new Response(null, { status: 500 }),
    }), /HTTP 500/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("readAllowMissingFlag reads the CLI flag or the deploy-only env var", () => {
  const originalEnv = process.env.CSSEARTH_ALLOW_MISSING_ASSETS;
  try {
    delete process.env.CSSEARTH_ALLOW_MISSING_ASSETS;
    assert.equal(readAllowMissingFlag([]), false);
    assert.equal(readAllowMissingFlag(["--allow-missing"]), true);
    process.env.CSSEARTH_ALLOW_MISSING_ASSETS = "1";
    assert.equal(readAllowMissingFlag([]), true);
  } finally {
    if (originalEnv === undefined) delete process.env.CSSEARTH_ALLOW_MISSING_ASSETS;
    else process.env.CSSEARTH_ALLOW_MISSING_ASSETS = originalEnv;
  }
});
