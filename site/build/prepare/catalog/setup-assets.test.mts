import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { installRuntimeAssets, readAllowMissingFlag } from "@cssearth/bake/asset-publication";
import { inspectContextAvailability } from "./prepare-context-availability.mts";
import { writeContextPackage } from "../../fixtures/context-package.mts";

/** Retries are asserted by count, not by waiting out the real backoff. */
const noWait = async () => {};

test("setup installs pinned files, reuses them offline, and repairs a corrupt file", async () => {
  const root = await mkdtemp(join(tmpdir(), "cssearth-setup-"));
  const bytes = Buffer.from("prepared image");
  const asset = { id: "earth", key: "earth/image.webp", location: "public" as const, filename: "image.webp", file: join(root, "image.webp"),
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
    }), /inventory/);
    assert.equal(await readFile(asset.file, "utf8"), "outdated");
    await installRuntimeAssets([asset], { fetcher });
    assert.deepEqual(await readFile(asset.file), bytes);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("bytes several bodies publish are fetched once, and each body still gets its file", async () => {
  const root = await mkdtemp(join(tmpdir(), "cssearth-setup-"));
  const bytes = Buffer.from("shared lighting sheet"), sha256 = createHash("sha256").update(bytes).digest("hex");
  const asset = (id: string) => ({ id, key: `${id}/lighting-sheet.webp`, location: "public" as const, filename: "lighting-sheet.webp",
    file: join(root, id, "lighting-sheet.webp"), url: `https://example.invalid/${sha256}/lighting-sheet.webp`, bytes: bytes.length, sha256 });
  const bodies = ["ariel", "titan", "miranda", "eris"].map(asset);
  try {
    let requests = 0;
    const fetcher = async () => { requests++; return new Response(bytes); };
    assert.deepEqual(await installRuntimeAssets(bodies, { fetcher, concurrency: 4 }), { installed: 4, reused: 0, skipped: 0 });
    assert.equal(requests, 1);
    for (const body of bodies) assert.deepEqual(await readFile(body.file), bytes);
    // A body that lost its file takes it from one that holds it, without the network.
    await rm(bodies[2]!.file);
    assert.deepEqual(await installRuntimeAssets(bodies, { fetcher: async () => { throw new Error("Expected a local copy"); } }), { installed: 1, reused: 3, skipped: 0 });
    // When the first fetch fails, the others still ask for themselves and each failure is named.
    await Promise.all(bodies.map(body => rm(body.file)));
    let attempts = 0;
    await assert.rejects(installRuntimeAssets(bodies, { fetcher: async () => { attempts++; return new Response("gone", { status: 404 }); }, concurrency: 4 }),
      /4 of 4 prepared files could not be installed/);
    assert.equal(attempts, 4);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("setup reports every unavailable file instead of stopping at the first", async () => {
  const root = await mkdtemp(join(tmpdir(), "cssearth-setup-"));
  const asset = (name: string) => ({ id: "sun", key: `sun/${name}`, location: "public" as const, filename: name, file: join(root, name),
    url: `https://example.invalid/${name}`, bytes: 3, sha256: createHash("sha256").update("abc").digest("hex") });
  try {
    const missing = ["first.webp", "second.webp"];
    await assert.rejects(installRuntimeAssets(missing.map(asset), {
      concurrency: 1, fetcher: async () => new Response(null, { status: 404 }),
    }), (error: Error) => missing.every(name => error.message.includes(name)) && error.message.includes("2 of 2"));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("allow-missing (deploy only) skips a genuinely missing R2 file so the object's own unavailable path reports it, without a throw; default mode still fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "cssearth-setup-allow-missing-"));
  try {
    const helix = await writeContextPackage(root, "helix");
    await writeContextPackage(root, "lmc");
    const bankBytes = Buffer.from(JSON.stringify(helix.bank));
    const file = resolve(helix.directory, "prepared/datasets.json");
    await rm(file);
    const asset = { id: "helix", key: "helix/datasets.json", location: "prepared" as const, filename: "datasets.json", file,
      url: "https://example.invalid/helix/lenses.json", bytes: bankBytes.length,
      sha256: createHash("sha256").update(bankBytes).digest("hex") };
    const fetcher = async () => new Response(null, { status: 404 });

    // Allow-missing tolerates the 404: no install, no throw, the file stays absent.
    assert.deepEqual(await installRuntimeAssets([asset], { allowMissing: true, fetcher }), { installed: 0, reused: 0, skipped: 1 });
    await assert.rejects(readFile(file));

    // Build-ready state: helix is honestly unavailable (not a fabricated fallback), lmc is untouched.
    const availability = await inspectContextAvailability(root);
    assert.equal(availability.helix.available, false);
    assert.equal(availability.lmc.available, true);

    // Default mode (no allow-missing) still fails outright on the exact same 404.
    await assert.rejects(installRuntimeAssets([asset], { fetcher }), /helix\/datasets\.json \(HTTP 404\)/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("allow-missing does not swallow a non-404 failure (mutation check: a 5xx must still fail the build)", async () => {
  const root = await mkdtemp(join(tmpdir(), "cssearth-setup-allow-missing-"));
  try {
    const asset = { id: "sun", key: "sun/x.webp", location: "public" as const, filename: "x.webp", file: join(root, "x.webp"),
      url: "https://example.invalid/x.webp", bytes: 3, sha256: createHash("sha256").update("abc").digest("hex") };
    await assert.rejects(installRuntimeAssets([asset], {
      allowMissing: true, fetcher: async () => new Response(null, { status: 500 }),
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

test("a dropped connection, a 5xx and a 429 are retried; a 404 is a verdict and is not", async () => {
  const root = await mkdtemp(join(tmpdir(), "cssearth-setup-retry-"));
  const bytes = Buffer.from("prepared image");
  const asset = { id: "earth", key: "earth/image.webp", location: "public" as const, filename: "image.webp", file: join(root, "image.webp"),
    url: "https://example.invalid/image.webp", bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex") };
  try {
    // Three transient failures — one network, one 5xx, one rate limit — then success. Across thousands of files a
    // single dropped connection must not fail the run.
    let requests = 0;
    const flaky = async () => {
      requests++;
      if (requests === 1) throw new TypeError("fetch failed");
      if (requests === 2) return new Response("upstream", { status: 503 });
      if (requests === 3) return new Response("slow down", { status: 429 });
      return new Response(bytes);
    };
    assert.deepEqual(await installRuntimeAssets([asset], { fetcher: flaky, wait: noWait }), { installed: 1, reused: 0, skipped: 0 });
    assert.equal(requests, 4);
    assert.deepEqual(await readFile(asset.file), bytes);

    // A 404 means the object is not published. That is a fact, not a blip: one request, no retry.
    await rm(asset.file);
    let missing = 0;
    const absent = async () => { missing++; return new Response("nope", { status: 404 }); };
    await assert.rejects(installRuntimeAssets([asset], { fetcher: absent }), /HTTP 404/);
    assert.equal(missing, 1);

    // Retries are bounded: a permanently broken network still fails rather than hanging forever.
    let attempts = 0;
    const broken = async () => { attempts++; throw new TypeError("fetch failed"); };
    await assert.rejects(installRuntimeAssets([asset], { fetcher: broken, wait: noWait }), /earth\/image\.webp \(https:\/\/example\.invalid\/image\.webp\): fetch failed/);
    assert.equal(attempts, 4);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a connection that drops while the body streams is retried, and a failure names its file", async () => {
  const root = await mkdtemp(join(tmpdir(), "cssearth-setup-stream-"));
  const bytes = Buffer.from("prepared image");
  const asset = { id: "pluto", key: "pluto/runtime.json", location: "prepared" as const, filename: "runtime.json", file: join(root, "runtime.json"),
    url: "https://example.invalid/runtime.json", bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex") };
  // A 200 whose body errors after its first chunk: undici reports this as "terminated".
  const dropped = () => new Response(new ReadableStream({ start(controller) { controller.enqueue(bytes.subarray(0, 4)); controller.error(new TypeError("terminated")); } }));
  try {
    let requests = 0;
    const once = async () => (++requests === 1 ? dropped() : new Response(bytes));
    assert.deepEqual(await installRuntimeAssets([asset], { fetcher: once, wait: noWait }), { installed: 1, reused: 0, skipped: 0 });
    assert.equal(requests, 2);
    await rm(asset.file);
    let drops = 0;
    const always = async () => { drops++; return dropped(); };
    await assert.rejects(installRuntimeAssets([asset], { fetcher: always, wait: noWait }), /pluto\/runtime\.json \(https:\/\/example\.invalid\/runtime\.json\): terminated/);
    assert.equal(drops, 4);
  } finally { await rm(root, { recursive: true, force: true }); }
});
