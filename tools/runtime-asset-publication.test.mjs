import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { installRuntimeAssets } from "./setup.mjs";
import { planRuntimePublication, publishRuntimeAssetChanges } from "./runtime-asset-publication.mjs";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "cssearth-publication-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const remote = new Map(), requests = [], uploads = [];
  const assets = [];
  for (const [name, contents] of [["first.webp", "source one"], ["second.pack", "source two"]]) {
    const bytes = Buffer.from(contents), sha256 = createHash("sha256").update(bytes).digest("hex");
    const key = `runtime-assets/${sha256}/${name}`;
    const asset = { id: "earth", filename: name, file: join(root, name), bytes: bytes.length, sha256, key, url: `https://example.invalid/${key}` };
    await writeFile(asset.file, bytes); assets.push(asset);
  }
  const fetcher = async (url, options = {}) => {
    requests.push({ url, method: options.method ?? "GET" }); const bytes = remote.get(url);
    return new Response(options.method === "HEAD" ? null : bytes, { status: bytes ? 200 : 404,
      headers: bytes ? { "content-length": String(bytes.length), "cache-control": "public,max-age=31536000,immutable" } : {} });
  };
  const upload = async selected => {
    for (const asset of selected) { uploads.push(asset.key); remote.set(asset.url, await readFile(asset.file)); }
  };
  return { root, remote, requests, uploads, assets, fetcher, upload };
}

test("only missing immutable assets upload, then all bytes verify before the release becomes visible", async t => {
  const f = await fixture(t); await f.upload([f.assets[0]]); f.uploads.length = 0;
  let released = false;
  const result = await publishRuntimeAssetChanges(f.assets, { fetcher: f.fetcher, upload: f.upload,
    publishRelease: async () => { assert.equal(f.requests.filter(r => r.method === "GET").length, 2); released = true; } });
  assert.equal(result.uploaded, 1); assert.equal(result.reused, 1); assert.equal(result.verified.length, 2);
  assert.deepEqual(f.uploads, [f.assets[1].key]); assert.ok(released);
  const next = await publishRuntimeAssetChanges(f.assets, { fetcher: f.fetcher, upload: f.upload });
  assert.equal(next.uploaded, 0); assert.equal(next.reused, 2);
});

test("an interrupted upload exposes no release and resumes with the remaining file", async t => {
  const f = await fixture(t); let releases = 0;
  await assert.rejects(publishRuntimeAssetChanges(f.assets, { fetcher: f.fetcher,
    upload: async assets => { await f.upload([assets[0]]); throw Error("interrupted"); },
    publishRelease: async () => { releases++; } }), /interrupted/);
  assert.equal(releases, 0); assert.equal(f.remote.size, 1);
  const resumed = await publishRuntimeAssetChanges(f.assets, { fetcher: f.fetcher, upload: f.upload,
    publishRelease: async () => { releases++; } });
  assert.equal(resumed.uploaded, 1); assert.equal(releases, 1);
  assert.equal(new Set(f.uploads).size, f.uploads.length, "The successful first write is not uploaded again");
});

test("local corruption stops before transport; same-size remote corruption blocks release without overwriting immutable data", async t => {
  const f = await fixture(t);
  const original = await readFile(f.assets[0].file); await writeFile(f.assets[0].file, "corrupt");
  await assert.rejects(planRuntimePublication(f.assets, { fetcher: f.fetcher }), /Prepare/);
  assert.equal(f.requests.length, 0); await writeFile(f.assets[0].file, original);
  await f.upload(f.assets); f.uploads.length = 0;
  f.remote.set(f.assets[0].url, Buffer.alloc(f.assets[0].bytes));
  let released = false;
  await assert.rejects(publishRuntimeAssetChanges(f.assets, { fetcher: f.fetcher, upload: f.upload,
    publishRelease: async () => { released = true; } }), /hash mismatch/);
  assert.equal(released, false); assert.equal(f.uploads.length, 0);
});

test("an older pinned release installs after a newer version and both remote versions remain intact", async t => {
  const f = await fixture(t); await f.upload(f.assets);
  const prior = f.assets[0], bytes = Buffer.from("new source content"), sha256 = createHash("sha256").update(bytes).digest("hex");
  const current = { ...prior, bytes: bytes.length, sha256, key: `runtime-assets/${sha256}/${prior.filename}` };
  current.url = `https://example.invalid/${current.key}`;
  f.remote.set(current.url, bytes);
  const output = join(f.root, "installed.webp");
  await installRuntimeAssets([{ ...current, file: output }], { fetcher: f.fetcher });
  assert.deepEqual(await readFile(output), bytes);
  await installRuntimeAssets([{ ...prior, file: output }], { fetcher: f.fetcher });
  assert.deepEqual(await readFile(output), f.remote.get(prior.url));
  assert.ok(f.remote.has(prior.url)); assert.ok(f.remote.has(current.url));
});
